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
import { ChannelPresence, channelCue } from '../channels/channel-cues';
import { I18n } from '../i18n/language';
import { Invite, Rendezvous, randomId } from '../invite';
import { forgetRoom, rememberRoom } from '../last-room';
import { Settings } from '../settings';
import { installRemoteSdpPatches } from './remote-sdp';
import { PeerStats, StatsSample, readPeerStats } from './peer-stats';
import { ExpectedPeer, RosterEntry, dropStale, expectFrom, lostTwin, rosterFor } from './roster';

const APP_ID = 'hifi-p2p-voice/v1';
const STATS_INTERVAL_MS = 1000;
/** Peers already in the room are discovered one by one right after joining; no chime for those. */
const JOIN_CUE_QUIET_MS = 4000;
/** How long a fresh join counts as still looking around before it says nobody is here. */
const SEARCH_MS = 5000;
/** A peer named in a roster that has not connected by then is given up on. */
const EXPECT_MS = 15_000;
/**
 * How long a peer whose connection dropped keeps its place. Trystero has already waited about
 * 5 s of silence by then, so this covers network outages of up to about 20 s.
 */
const RECONNECT_MS = 15_000;
/** Leaving should not hang on a goodbye that cannot be delivered anymore. */
const GOODBYE_WAIT_MS = 300;

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
  /** Known from another peer's roster, but our own connection is not up yet. */
  connecting: boolean;
};

type PeerRuntime = {
  playback?: Playback;
  parkedSenders: Set<RTCRtpSender>;
  sample?: StatsSample;
  /** ICE stopped hearing from them before the connection ended: a drop, not a closed page. */
  unreachable?: boolean;
  /** Their own info arrived; until then the name may only come from someone else's roster. */
  introduced?: boolean;
};

@Injectable({ providedIn: 'root' })
export class RoomService {
  private readonly settings = inject(Settings);
  private readonly audio = inject(AudioEngine);
  private readonly i18n = inject(I18n);

  private room: Room | null = null;
  private infoAction: MessageAction<PeerInfo> | null = null;
  private channelAction: MessageAction<ChannelMessage> | null = null;
  private rosterAction: MessageAction<RosterEntry[]> | null = null;
  private byeAction: MessageAction<string> | null = null;
  /** Peers that said goodbye; their connection closing is a real leave, not a drop. */
  private readonly departing = new Set<string>();
  /** A reloaded page comes back under a new peer id; its volume follows the name. */
  private readonly volumeByName = new Map<string, number>();
  private readonly runtime = new Map<string, PeerRuntime>();
  private statsTimer: ReturnType<typeof setInterval> | undefined;
  private searchTimer: ReturnType<typeof setTimeout> | undefined;
  private routing = false;
  private routeAgain = false;
  private joinedAt = 0;
  private presence: ChannelPresence | null = null;

  readonly status = signal<RoomStatus>('idle');
  readonly invite = signal<Invite | null>(null);
  readonly peers = signal<ReadonlyMap<string, Peer>>(new Map());
  readonly channelState = signal<ChannelState>(EMPTY_CHANNEL_STATE);
  /** Peers others told us about that we are still connecting to. */
  readonly expected = signal<ReadonlyMap<string, ExpectedPeer>>(new Map());
  /** Right after joining nobody has answered yet; that does not mean the room is empty. */
  readonly searching = signal(false);
  /** The browser says the network is gone; peers drop and come back once it returns. */
  readonly offline = signal(typeof navigator !== 'undefined' && navigator.onLine === false);
  private readonly selectedChannel = signal<string>(LOBBY);

  readonly channel = computed(() => resolveChannel(this.channelState(), this.selectedChannel()));
  readonly peerList = computed(() => [...this.peers().values()]);
  /** Everyone in the room as far as we know, including those still connecting. */
  readonly roster = computed<Peer[]>(() => [
    ...this.peerList(),
    ...[...this.expected().values()].map((peer) => ({
      id: peer.id,
      name: peer.name,
      muted: peer.muted,
      channel: peer.channel,
      hasAudio: false,
      volume: peer.volume,
      stats: null,
      connecting: true,
    })),
  ]);
  /** Peers whose audio we currently hear above the speaking level, as reported by their tiles. */
  readonly speakingPeers = signal<ReadonlySet<string>>(new Set());
  /** Someone in our channel, us included, is talking right now. */
  readonly anyoneSpeaking = computed(() => {
    if (this.audio.speaking()) return true;
    const own = this.channel();
    const speaking = this.speakingPeers();
    return this.peerList().some(
      (peer) => speaking.has(peer.id) && resolveChannel(this.channelState(), peer.channel) === own,
    );
  });
  /** How the connection to the room is doing, for the status dot in the header. */
  readonly health = computed<'offline' | 'connecting' | 'connected'>(() => {
    if (this.offline()) return 'offline';
    if (this.searching() || this.roster().some((peer) => peer.connecting)) return 'connecting';
    return 'connected';
  });
  private readonly ownInfo = computed<PeerInfo>(() => {
    const channel = this.channelState().channels.find((c) => c.id === this.channel());
    return {
      name: this.settings.name().trim() || this.i18n.text('peer.anonymous'),
      muted: this.audio.muted(),
      channel: this.channel(),
      channelNumber: channel?.number ?? null,
      channelCreatedAt: channel?.createdAt ?? null,
    };
  });

  constructor() {
    installRemoteSdpPatches(() => this.settings.bitrate());

    effect(() => {
      const info = this.ownInfo();
      untracked(() => void this.infoAction?.send(info));
    });
    effect(() => {
      this.channel();
      this.peers();
      untracked(() => void this.route());
    });
    effect(() => {
      const joined = this.status() === 'joined';
      const own = this.channel();
      const state = this.channelState();
      const peers = this.peers();
      untracked(() => this.cueChannelMoves(joined, own, state, peers));
    });

    const window = inject(DOCUMENT).defaultView;
    window?.addEventListener('pagehide', () => {
      const room = this.room;
      void this.sayGoodbye().then(() => room?.leave());
    });
    window?.addEventListener('online', () => this.offline.set(false));
    window?.addEventListener('offline', () => this.offline.set(true));
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
      this.rosterAction = room.makeAction<RosterEntry[]>('roster');
      this.rosterAction.onMessage = (roster) =>
        this.expected.update((expected) =>
          expectFrom(expected, roster, this.peers(), performance.now() + EXPECT_MS),
        );
      this.byeAction = room.makeAction<string>('bye');
      this.byeAction.onMessage = (_, { peerId }) => void this.departing.add(peerId);

      room.onPeerJoin = (peerId) => this.welcome(peerId, stream);
      room.onPeerLeave = (peerId) => this.peerLeft(peerId);
      room.onPeerStream = (remote, peerId) => this.attachStream(peerId, remote);

      this.statsTimer = setInterval(() => void this.pollStats(), STATS_INTERVAL_MS);
      this.searching.set(true);
      this.searchTimer = setTimeout(() => this.searching.set(false), SEARCH_MS);
      this.invite.set(invite);
      this.status.set('joined');
      this.joinedAt = performance.now();
      this.audio.playCue('join');
      rememberRoom(invite);
    } catch (error) {
      await this.teardown();
      throw error;
    }
  }

  async leave(): Promise<void> {
    forgetRoom();
    await this.sayGoodbye();
    await this.teardown();
  }

  /** Tells everyone this is a real leave, so they drop us right away instead of waiting. */
  private async sayGoodbye(): Promise<void> {
    const sent = this.byeAction?.send('').catch(() => undefined);
    if (!sent) return;
    await Promise.race([sent, new Promise((resolve) => setTimeout(resolve, GOODBYE_WAIT_MS))]);
  }

  private async teardown(): Promise<void> {
    clearInterval(this.statsTimer);
    clearTimeout(this.searchTimer);
    await this.room?.leave().catch(() => undefined);
    this.room = null;
    this.infoAction = null;
    this.channelAction = null;
    this.rosterAction = null;
    this.byeAction = null;
    this.departing.clear();
    this.volumeByName.clear();
    this.expected.set(new Map());
    this.speakingPeers.set(new Set());
    this.searching.set(false);
    this.runtime.forEach((r) => r.playback?.dispose());
    this.runtime.clear();
    await this.audio.stop();
    this.peers.set(new Map());
    this.channelState.set(EMPTY_CHANNEL_STATE);
    this.selectedChannel.set(LOBBY);
    this.invite.set(null);
    this.status.set('idle');
  }

  setSpeaking(peerId: string, speaking: boolean): void {
    if (this.speakingPeers().has(peerId) === speaking) return;
    this.speakingPeers.update((current) => {
      const next = new Set(current);
      if (speaking) next.add(peerId);
      else next.delete(peerId);
      return next;
    });
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
    const name = this.peers().get(peerId)?.name;
    if (name) this.volumeByName.set(name, volume);
  }

  analyserFor(peerId: string): AnalyserNode | null {
    return this.runtime.get(peerId)?.playback?.analyser ?? null;
  }

  private broadcastChannel(message: ChannelMessage): void {
    this.channelState.update((state) => applyChannelMessage(state, message));
    void this.channelAction?.send(message);
  }

  private welcome(peerId: string, stream: MediaStream): void {
    const announced = this.expected().get(peerId);
    const settling = performance.now() - this.joinedAt <= JOIN_CUE_QUIET_MS;
    if (!announced && !settling) this.audio.playCue('join');
    if (announced) this.forgetExpected(peerId);
    // Until their own info arrives, show what we knew instead of "connecting".
    this.patchPeer(
      peerId,
      announced
        ? {
            name: announced.name,
            muted: announced.muted,
            channel: announced.channel,
            volume: announced.volume,
          }
        : {},
    );
    this.searching.set(false);
    this.watchReachability(peerId);
    const sends = this.room?.addStream(stream, { target: peerId }) ?? [];
    void Promise.allSettled(sends).then(() => this.route());
    void this.channelAction?.send(snapshot(this.channelState()), { target: peerId });
    void this.infoAction?.send(this.ownInfo(), { target: peerId });
    void this.rosterAction?.send(rosterFor(this.peers().values(), peerId), { target: peerId });
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
    const name = String(info.name ?? '').slice(0, 32) || null;
    const patch: Partial<Peer> = {
      name,
      muted: Boolean(info.muted),
      channel: typeof info.channel === 'string' ? info.channel : LOBBY,
    };
    const runtime = this.runtimeFor(peerId);
    const firstInfo = !runtime.introduced;
    runtime.introduced = true;
    if (firstInfo && name) {
      const twin = lostTwin(this.expected(), name);
      if (twin && twin.id !== peerId) this.forgetExpected(twin.id);
      const volume = this.volumeByName.get(name);
      if (volume !== undefined) patch.volume = volume;
    }
    this.patchPeer(peerId, patch);
  }

  private attachStream(peerId: string, stream: MediaStream): void {
    const runtime = this.runtimeFor(peerId);
    runtime.playback?.dispose();
    runtime.playback = this.audio.createPlayback(stream);
    this.patchPeer(peerId, { hasAudio: true });
  }

  /**
   * A closed or reloaded page ends the connection cleanly, right away. A network drop first
   * goes silent; Trystero keeps announcing until both sides find each other again, and until
   * then the peer stays, marked as connecting.
   */
  private peerLeft(peerId: string): void {
    const peer = this.peers().get(peerId);
    const said = this.departing.delete(peerId);
    const dropped = this.runtime.get(peerId)?.unreachable === true;
    const name = peer?.name;
    if (said || !dropped || !peer || !name) {
      this.removePeer(peerId);
      return;
    }
    this.removePeer(peerId, false);
    this.expected.update((expected) =>
      new Map(expected).set(peerId, {
        id: peerId,
        name,
        muted: peer.muted,
        channel: peer.channel,
        volume: peer.volume,
        lost: true,
        until: performance.now() + RECONNECT_MS,
      }),
    );
  }

  private watchReachability(peerId: string): void {
    const connection = this.room?.getPeers()[peerId];
    if (!connection) return;
    const runtime = this.runtimeFor(peerId);
    const update = () => {
      const state = connection.iceConnectionState;
      if (state === 'disconnected' || state === 'failed') runtime.unreachable = true;
      else if (state === 'connected' || state === 'completed') runtime.unreachable = false;
    };
    connection.addEventListener('iceconnectionstatechange', update);
  }

  private forgetExpected(peerId: string): void {
    this.expected.update((expected) => {
      const next = new Map(expected);
      next.delete(peerId);
      return next;
    });
  }

  private removePeer(peerId: string, cue = true): void {
    if (cue && this.peers().has(peerId)) this.audio.playCue('leave');
    this.runtime.get(peerId)?.playback?.dispose();
    this.runtime.delete(peerId);
    this.setSpeaking(peerId, false);
    this.peers.update((peers) => {
      const next = new Map(peers);
      next.delete(peerId);
      return next;
    });
  }

  private cueChannelMoves(
    joined: boolean,
    own: string,
    state: ChannelState,
    peers: ReadonlyMap<string, Peer>,
  ): void {
    if (!joined) {
      this.presence = null;
      return;
    }
    const members = new Set<string>();
    const placed = new Set<string>();
    for (const peer of peers.values()) {
      if (peer.name === null) continue;
      placed.add(peer.id);
      if (resolveChannel(state, peer.channel) === own) members.add(peer.id);
    }
    const next = { channel: own, members, placed };
    const cue = channelCue(this.presence, next);
    if (cue) this.audio.playCue(cue);
    this.presence = next;
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
        connecting: false,
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
    const { kept, gone } = dropStale(this.expected(), now);
    if (gone.length) {
      this.expected.set(kept);
      // Only now is it clear that a dropped peer is not coming back.
      if (gone.some((peer) => peer.lost)) this.audio.playCue('leave');
    }
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
