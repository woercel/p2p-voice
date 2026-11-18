import { DOCUMENT, Injectable, computed, inject, signal } from '@angular/core';
import { AudioEngine } from '../audio/audio-engine';
import { keyLabels } from '../i18n/labels';
import { RoomService } from '../net/room';
import { Settings } from '../settings';
import {
  bindingFromEvent,
  describeBinding,
  isModifierKey,
  matchesBinding,
  modifierBinding,
  worksWhileTyping,
} from './key-binding';

const isTyping = (target: EventTarget | null) =>
  target instanceof Element && !!target.closest('input, textarea, [contenteditable="true"]');

@Injectable({ providedIn: 'root' })
export class MuteHotkey {
  private readonly settings = inject(Settings);
  private readonly audio = inject(AudioEngine);
  private readonly room = inject(RoomService);
  private pendingModifier: string | null = null;

  readonly capturing = signal(false);
  readonly label = computed(() => describeBinding(this.settings.muteKey(), keyLabels()));

  constructor() {
    const document = inject(DOCUMENT);
    document.addEventListener('keydown', (event) => this.onKeyDown(event));
    document.addEventListener('keyup', (event) => this.onKeyUp(event));
  }

  startCapture(): void {
    this.pendingModifier = null;
    this.capturing.set(true);
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (this.capturing()) {
      event.preventDefault();
      if (event.key === 'Escape') this.capturing.set(false);
      else if (isModifierKey(event.key)) this.pendingModifier = event.code;
      else this.bind(bindingFromEvent(event));
      return;
    }

    const binding = this.settings.muteKey();
    if (this.room.status() !== 'joined' || event.repeat || !matchesBinding(binding, event)) return;
    if (isTyping(event.target) && !worksWhileTyping(binding)) return;
    event.preventDefault();
    this.audio.muted.update((muted) => !muted);
  }

  /** A modifier pressed and released on its own (e.g. right Ctrl) becomes the binding. */
  private onKeyUp(event: KeyboardEvent): void {
    if (this.capturing() && this.pendingModifier === event.code) this.bind(modifierBinding(event));
  }

  private bind(binding: ReturnType<typeof bindingFromEvent>): void {
    this.settings.muteKey.set(binding);
    this.pendingModifier = null;
    this.capturing.set(false);
  }
}
