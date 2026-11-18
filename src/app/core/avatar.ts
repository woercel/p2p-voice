import { createAvatar } from '@dicebear/core';
import * as pixelArt from '@dicebear/pixel-art';

const cache = new Map<string, string>();

/** The same name gives the same avatar for everyone, without any network request. */
export function avatarUri(seed: string): string {
  let uri = cache.get(seed);
  if (!uri) {
    uri = createAvatar(pixelArt, { seed }).toDataUri();
    cache.set(seed, uri);
  }
  return uri;
}
