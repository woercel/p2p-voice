import source from './messages.json';
import { DE } from './de';

const placeholders = (text: string) =>
  [...text.matchAll(/\{\$[A-Za-z_]+\}|\{INTERPOLATION(?:_\d+)?\}|VAR_PLURAL|VAR_SELECT/g)]
    .map((m) => m[0])
    .sort();

describe('German translations', () => {
  const messages = source.translations as Record<string, string>;

  it('cover exactly the extracted messages', () => {
    expect(Object.keys(DE).sort()).toEqual(Object.keys(messages).sort());
  });

  it('keep every placeholder of the source text', () => {
    for (const [id, text] of Object.entries(messages)) {
      expect(placeholders(DE[id] ?? ''), id).toEqual(placeholders(text));
    }
  });
});
