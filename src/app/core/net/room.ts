import { DOCUMENT, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import type { MessageAction, Room } from '@trystero-p2p/nostr';
import { AudioEngine, Playback } from '../audio/audio-engine';
import {
  ChannelMessage,
  ChannelState,
  EMPTY_CHANNEL_STATE,
  LOBBY,
  applyChannelMessage,
  newChannel,
  resolveChannel,
  snapshot,
} from '../channels/channel-state';
import { Invite, Rendezvous, randomId } from '../invite';
import { Settings } from '../settings';
import { installOpusTuning } from './opus-sdp';
import { PeerStats, StatsSample, readPeerStats } from './peer-stats';

const APP_ID = 'hifi-p2p-voice/v1';
const STATS_INTERVAL_MS = 1000;

const STRATEGIES: Record<
  Rendezvous,
  () => Promise<{ joinRoom: typeof import('@trystero-p2p/nostr').joinRoom }>
> = {
  nostr: () => import('@trystero-p2p/nostr'),
  torrent: () => import('@trystero-p2p/torrent'),
  mqtt: () => import('@trystero-p2p/mqtt'),
};

type PeerInfo = {
  name: string;
  muted: boolean;
  channel: string;
  channelNumber: number | null;
  channelCreatedAt: number | null;
};

export type RoomStatus = 'idle' | 'joining' | 'joined';

export type Peer = {
  id: string;
  name: string | null;
  muted: boolean;
  channel: string;
  hasAudio: boolean;
  volume: number;
  stats: PeerStats | null;
};

type PeerRuntime = {
  playback?: Playback;
  parkedSenders: Set<RTCRtpSender>;
  sample?: StatsSample;
};

@Injectable({ providedIn: 'root' })
export class RoomService {
  private readonly settings = inject(Settings);
  private readonly audio = inject(AudioEngine);

  private room: Room | null = null;
  private infoAction: MessageAction<PeerInfo> | null = null;
  private channelAction: MessageAction<ChannelMessage> | null = null;
  private readonly runtime = new Map<string, PeerRuntime>();
  private statsTimer: ReturnType<typeof setInterval> | undefined;
  private routing = false;
  private routeAgain = false;

  readonly status = signal<RoomStatus>('idle');
  readonly invite = signal<Invite | null>(null);
  readonly peers = signal<ReadonlyMap<string, Peer>>(new Map());
  readonly channelState = signal<ChannelState>(EMPTY_CHANNEL_STATE);
  private readonly selectedChannel = signal<string>(LOBBY);

  readonly channel = computed(() => resolveChannel(this.channelState(), this.selectedChannel()));
  readonly peerList = computed(() => [...this.peers().values()]);
  private readonly ownInfo = computed<PeerInfo>(() => {
    const channel = this.channelState().channels.find((c) => c.id === this.channel());
    return {
      name: this.settings.name().trim() || $localize`:@@peer.anonymous:Anonymous`,
      muted: this.audio.muted(),
      channel: this.channel(),
      channelNumber: channel?.number ?? null,
      channelCreatedAt: channel?.createdAt ?? null,
    };
  });

  constructor() {
    installOpusTuning(() => this.settings.bitrate());

    effect(() => {
      const info = this.ownInfo();
      untracked(() => void this.infoAction?.send(info));
    });
    effect(() => {
      this.channel();
      this.peers();
      untracked(() => void this.route());
    });

    inject(DOCUMENT).defaultView?.addEventListener('pagehide', () => void this.room?.leave());
  }

  async join(invite: Invite, testTone: boolean): Promise<void> {
    this.status.set('joining');
    try {
      const stream = await this.audio.start(testTone);
      const { joinRoom } = await STRATEGIES[invite.via]();
      const room = joinRoom({ appId: APP_ID, password: invite.password }, invite.room);
      this.room = room;

      this.infoAction = room.makeAction<PeerInfo>('info');
      this.infoAction.onMessage = (info, { peerId }) => this.receiveInfo(peerId, info);
      this.channelAction = room.makeAction<ChannelMessage>('chan');
      this.channelAction.onMessage = (message) =>
        this.channelState.update((state) => applyChannelMessage(state, message));

      room.onPeerJoin = (peerId) => this.welcome(peerId, stream);
      room.onPeerLeave = (peerId) => this.removePeer(peerId);
      room.onPeerStream = (remote, peerId) => this.attachStream(peerId, remote);

      this.statsTimer = setInterval(() => void this.pollStats(), STATS_INTERVAL_MS);
      this.invite.set(invite);
      this.status.set('joined');
    } catch (error) {
      await this.leave();
      throw error;
    }
  }

  async leave(): Promise<void> {
    clearInterval(this.statsTimer);
    await this.room?.leave().catch(() => undefined);
    this.room = null;
    this.infoAction = null;
    this.channelAction = null;
    this.runtime.forEach((r) => r.playback?.dispose());
    this.runtime.clear();
    await this.audio.stop();
    this.peers.set(new Map());
    this.channelState.set(EMPTY_CHANNEL_STATE);
    this.selectedChannel.set(LOBBY);
    this.invite.set(null);
    this.status.set('idle');
  }

  enterChannel(id: string): void {
    this.selectedChannel.set(id);
  }

  createGroup(): void {
    const channel = newChannel(this.channelState(), `g${randomId(10)}`, Date.now());
    this.broadcastChannel({ op: 'create', channel });
  }

  deleteGroup(id: string): void {
    this.broadcastChannel({ op: 'delete', id });
  }

  setVolume(peerId: string, volume: number): void {
    this.patchPeer(peerId, { volume });
  }

  analyserFor(peerId: string): AnalyserNode | null {
    return this.runtime.get(peerId)?.playback?.analyser ?? null;
  }

  private broadcastChannel(message: ChannelMessage): void {
    this.channelState.update((state) => applyChannelMessage(state, message));
    void this.channelAction?.send(message);
  }

  private welcome(peerId: string, stream: MediaStream): void {
    this.patchPeer(peerId, {});
    const sends = this.room?.addStream(stream, { target: peerId }) ?? [];
    void Promise.allSettled(sends).then(() => this.route());
    void this.channelAction?.send(snapshot(this.channelState()), { target: peerId });
    void this.infoAction?.send(this.ownInfo(), { target: peerId });
  }

  private receiveInfo(peerId: string, info: PeerInfo): void {
    if (!info || typeof info !== 'object') return;
    if (info.channelNumber !== null && info.channelCreatedAt !== null) {
      const channel = {
        id: info.channel,
        number: info.channelNumber,
        createdAt: info.channelCreatedAt,
      };
      this.channelState.update((state) => applyChannelMessage(state, { op: 'create', channel }));
    }
    this.patchPeer(peerId, {
      name: String(info.name ?? '').slice(0, 32) || null,
      muted: Boolean(info.muted),
      channel: typeof info.channel === 'string' ? info.channel : LOBBY,
    });
  }

  private attachStream(peerId: string, stream: MediaStream): void {
    const runtime = this.runtimeFor(peerId);
    runtime.playback?.dispose();
    runtime.playback = this.audio.createPlayback(stream);
    this.patchPeer(peerId, { hasAudio: true });
  }

  private removePeer(peerId: string): void {
    this.runtime.get(peerId)?.playback?.dispose();
    this.runtime.delete(peerId);
    this.peers.update((peers) => {
      const next = new Map(peers);
      next.delete(peerId);
      return next;
    });
  }

  private runtimeFor(peerId: string): PeerRuntime {
    let runtime = this.runtime.get(peerId);
    if (!runtime) {
      runtime = { parkedSenders: new Set() };
      this.runtime.set(peerId, runtime);
    }
    return runtime;
  }

  private patchPeer(peerId: string, patch: Partial<Peer>): void {
    this.runtimeFor(peerId);
    this.peers.update((peers) => {
      const current = peers.get(peerId) ?? {
        id: peerId,
        name: null,
        muted: false,
        channel: LOBBY,
        hasAudio: false,
        volume: 100,
        stats: null,
      };
      return new Map(peers).set(peerId, { ...current, ...patch });
    });
  }

  /**
   * Audio only flows within a channel: for peers elsewhere the sender's track is set to null,
   * which stops transmission without renegotiation. Received audio is gated as well.
   */
  private async route(): Promise<void> {
    if (!this.room) return;
    if (this.routing) {
      this.routeAgain = true;
      return;
    }
    this.routing = true;
    try {
      const track = this.audio.sendStream()?.getAudioTracks()[0];
      const state = this.channelState();
      const own = this.channel();
      const connections = this.room.getPeers();

      for (const peer of this.peers().values()) {
        const runtime = this.runtimeFor(peer.id);
        const audible = resolveChannel(state, peer.channel) === own;
        runtime.playback?.setGain(audible ? peer.volume / 100 : 0);

        const connection = connections[peer.id];
        if (!connection || !track) continue;
        if (audible) {
          for (const sender of runtime.parkedSenders)
            await sender.replaceTrack(track).catch(() => undefined);
          runtime.parkedSenders.clear();
        } else {
          for (const sender of connection.getSenders()) {
            if (sender.track !== track) continue;
            await sender.replaceTrack(null).catch(() => undefined);
            runtime.parkedSenders.add(sender);
          }
        }
      }
    } finally {
      this.routing = false;
      if (this.routeAgain) {
        this.routeAgain = false;
        void this.route();
      }
    }
  }

  private async pollStats(): Promise<void> {
    if (!this.room) return;
    const now = performance.now();
    const updates = new Map<string, PeerStats>();
    for (const [peerId, connection] of Object.entries(this.room.getPeers())) {
      const runtime = this.runtime.get(peerId);
      if (!runtime) continue;
      try {
        const { stats, sample } = readPeerStats(await connection.getStats(), runtime.sample, now);
        runtime.sample = sample;
        updates.set(peerId, stats);
      } catch {
        // Connection closed between listing and reading stats.
      }
    }
    this.peers.update((peers) => {
      const next = new Map(peers);
      updates.forEach((stats, peerId) => {
        const peer = next.get(peerId);
        if (peer) next.set(peerId, { ...peer, stats });
      });
      return next;
    });
  }
}
