import de from '../../../../public/i18n/de.json';
import en from '../../../../public/i18n/en.json';

type Tree = { [key: string]: string | Tree };

const flatten = (tree: Tree, prefix = ''): Record<string, string> =>
  Object.entries(tree).reduce<Record<string, string>>((all, [key, value]) => {
    const path = prefix + key;
    return typeof value === 'string'
      ? { ...all, [path]: value }
      : { ...all, ...flatten(value, `${path}.`) };
  }, {});

const placeholders = (text: string) =>
  [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort();

describe('translations', () => {
  const english = flatten(en);
  const german = flatten(de);

  it('have the same keys in German and English', () => {
    expect(Object.keys(german).sort()).toEqual(Object.keys(english).sort());
  });

  it('use the same placeholders in both languages', () => {
    for (const [key, text] of Object.entries(english)) {
      expect(placeholders(german[key] ?? ''), key).toEqual(placeholders(text));
    }
  });
});
