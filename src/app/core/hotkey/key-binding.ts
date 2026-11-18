export type KeyBinding = {
  code: string;
  key: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
};

export type KeyEventLike = Pick<
  KeyboardEvent,
  'code' | 'key' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'
>;

export type KeyLabels = {
  ctrl: string;
  alt: string;
  altGr: string;
  shift: string;
  meta: string;
  space: string;
  left: string;
  right: string;
  numpad: string;
};

export const DEFAULT_MUTE_KEY: KeyBinding = {
  code: 'KeyM',
  key: 'm',
  ctrl: false,
  alt: false,
  shift: false,
  meta: false,
};

const MODIFIER_KEYS = ['Control', 'Shift', 'Alt', 'Meta', 'AltGraph'];
const MODIFIER_CODE = /^(Control|Shift|Alt|Meta)(Left|Right)$/;

export const isModifierKey = (key: string): boolean => MODIFIER_KEYS.includes(key);

const hasModifiers = (b: KeyBinding) => b.ctrl || b.alt || b.shift || b.meta;

export const isModifierOnly = (b: KeyBinding): boolean =>
  MODIFIER_CODE.test(b.code) && !hasModifiers(b);

export function bindingFromEvent(event: KeyEventLike): KeyBinding {
  return {
    code: event.code,
    key: event.key,
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
    meta: event.metaKey,
  };
}

export function modifierBinding(event: Pick<KeyboardEvent, 'code' | 'key'>): KeyBinding {
  return { code: event.code, key: event.key, ctrl: false, alt: false, shift: false, meta: false };
}

export function matchesBinding(binding: KeyBinding, event: KeyEventLike): boolean {
  if (isModifierOnly(binding)) return event.code === binding.code;
  return (
    event.code === binding.code &&
    event.ctrlKey === binding.ctrl &&
    event.altKey === binding.alt &&
    event.shiftKey === binding.shift &&
    event.metaKey === binding.meta
  );
}

/** Bindings without Ctrl/Alt/Meta would fire while typing, so they are ignored in text fields. */
export const worksWhileTyping = (b: KeyBinding): boolean =>
  !isModifierOnly(b) && (b.ctrl || b.alt || b.meta);

function baseName(binding: KeyBinding, labels: KeyLabels): string {
  const modifier = binding.code.match(MODIFIER_CODE);
  if (modifier) {
    const [, name, side] = modifier;
    if (name === 'Alt') return side === 'Right' ? labels.altGr : labels.alt;
    if (name === 'Meta') return labels.meta;
    const label = name === 'Control' ? labels.ctrl : labels.shift;
    return `${label} ${side === 'Left' ? labels.left : labels.right}`;
  }
  if (binding.code === 'Space') return labels.space;
  if (binding.code.startsWith('Numpad')) return `${labels.numpad} ${binding.code.slice(6)}`;
  return binding.key.length === 1 ? binding.key.toUpperCase() : binding.key;
}

export function describeBinding(binding: KeyBinding, labels: KeyLabels): string {
  return [
    binding.ctrl && labels.ctrl,
    binding.alt && labels.alt,
    binding.shift && labels.shift,
    binding.meta && labels.meta,
    baseName(binding, labels),
  ]
    .filter(Boolean)
    .join(' + ');
}
