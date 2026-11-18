import { avatarUri } from './avatar';

describe('avatarUri', () => {
  it('creates an inline SVG that depends only on the name', () => {
    const uri = avatarUri('Woercel');
    expect(uri).toMatch(/^data:image\/svg\+xml;/);
    expect(avatarUri('Woercel')).toBe(uri);
    expect(avatarUri('Someone else')).not.toBe(uri);
  });
});
