import { Injectable, WritableSignal, effect, signal } from '@angular/core';
import { GATE_OFF_DB } from './audio/levels';
import { DEFAULT_MUTE_KEY, KeyBinding } from './hotkey/key-binding';
import { readStored, writeStored } from './storage';

export type ThemeMode = 'system' | 'light' | 'dark';

export const BITRATES = [510_000, 256_000, 128_000, 64_000] as const;

function persisted<T>(key: string, fallback: T): WritableSignal<T> {
  const value = signal<T>(readStored(key, fallback));
  effect(() => writeStored(key, value()));
  return value;
}

@Injectable({ providedIn: 'root' })
export class Settings {
  readonly name = persisted('name', '');
  readonly bitrate = persisted<number>('bitrate', 128_000);
  readonly headphoneMode = persisted('headphones', true);
  readonly microphoneId = persisted('microphone', '');
  readonly outputId = persisted('output', '');
  /** Master output gain applied to all received voices, in percent. */
  readonly outputVolume = persisted('outputVolume', 100);
  readonly gateDb = persisted('gateDb', GATE_OFF_DB);
  /** Gain applied to the microphone before the gate, in percent. */
  readonly micVolume = persisted('micVolume', 100);
  /** The recording setup was offered once after joining; it is not offered again unasked. */
  readonly setupOffered = persisted('setupOffered', false);
  readonly muteKey = persisted<KeyBinding>('muteKey', DEFAULT_MUTE_KEY);
  readonly theme = persisted<ThemeMode>('theme', 'system');
}
