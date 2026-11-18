import {
  DEFAULT_MUTE_KEY,
  KeyEventLike,
  KeyLabels,
  bindingFromEvent,
  describeBinding,
  isModifierOnly,
  matchesBinding,
  modifierBinding,
  worksWhileTyping,
} from './key-binding';

const labels: KeyLabels = {
  ctrl: 'Ctrl',
  alt: 'Alt',
  altGr: 'AltGr',
  shift: 'Shift',
  meta: 'Win',
  space: 'Space',
  left: 'left',
  right: 'right',
  numpad: 'Num',
};

const key = (code: string, key: string, mods: Partial<KeyEventLike> = {}): KeyEventLike => ({
  code,
  key,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  ...mods,
});

describe('key bindings', () => {
  it('matches plain keys only without modifiers', () => {
    expect(matchesBinding(DEFAULT_MUTE_KEY, key('KeyM', 'm'))).toBe(true);
    expect(matchesBinding(DEFAULT_MUTE_KEY, key('KeyM', 'M', { shiftKey: true }))).toBe(false);
  });

  it('matches combinations exactly', () => {
    const combo = bindingFromEvent(key('KeyM', 'M', { ctrlKey: true, shiftKey: true }));
    expect(matchesBinding(combo, key('KeyM', 'M', { ctrlKey: true, shiftKey: true }))).toBe(true);
    expect(matchesBinding(combo, key('KeyM', 'm', { ctrlKey: true }))).toBe(false);
    expect(describeBinding(combo, labels)).toBe('Ctrl + Shift + M');
  });

  it('distinguishes left and right modifiers when bound alone', () => {
    const rightCtrl = modifierBinding({ code: 'ControlRight', key: 'Control' });
    expect(isModifierOnly(rightCtrl)).toBe(true);
    expect(matchesBinding(rightCtrl, key('ControlRight', 'Control', { ctrlKey: true }))).toBe(true);
    expect(matchesBinding(rightCtrl, key('ControlLeft', 'Control', { ctrlKey: true }))).toBe(false);
    expect(describeBinding(rightCtrl, labels)).toBe('Ctrl right');
  });

  it('describes special keys', () => {
    expect(describeBinding(bindingFromEvent(key('Space', ' ')), labels)).toBe('Space');
    expect(describeBinding(bindingFromEvent(key('Numpad0', '0')), labels)).toBe('Num 0');
    expect(describeBinding(bindingFromEvent(key('F8', 'F8')), labels)).toBe('F8');
    expect(describeBinding(modifierBinding({ code: 'AltRight', key: 'AltGraph' }), labels)).toBe(
      'AltGr',
    );
  });

  it('only lets bindings with Ctrl, Alt or Win fire while typing', () => {
    expect(worksWhileTyping(DEFAULT_MUTE_KEY)).toBe(false);
    expect(worksWhileTyping(bindingFromEvent(key('KeyM', 'M', { shiftKey: true })))).toBe(false);
    expect(worksWhileTyping(bindingFromEvent(key('KeyM', 'm', { ctrlKey: true })))).toBe(true);
    expect(worksWhileTyping(modifierBinding({ code: 'ControlRight', key: 'Control' }))).toBe(false);
  });
});
