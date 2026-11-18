# P2P Voice

Voice chat that runs directly between browsers. Audio is sent peer to peer with Opus at up to
510 kbit/s stereo; public Nostr relays, BitTorrent trackers or MQTT brokers are only used so peers
can find each other.

Live: https://woercel.github.io/p2p-voice/

## Features

- Rooms via invite link (room name, password and rendezvous live in the URL hash)
- Lobby plus groups that anyone can create and delete; audio only flows within a channel
- Voice threshold (noise gate in an AudioWorklet), headphone mode without browser filters
- Speaking indicator, per-person volume, connection stats
- Configurable mute key, German and English, light/dark/system theme

## Development

```bash
npm install
npm start          # http://localhost:4200
npm run test:ci    # unit tests (Vitest)
npm run build      # production build in dist/
```

Append `&tone=1` to an invite link to send a stereo test tone instead of the microphone.

### Translations

Texts use Angular i18n with fixed IDs (`i18n="@@id"`, `` $localize`:@@id:…` ``). After changing
texts run `npm run i18n`, then update `src/locale/de.ts`; a test fails if IDs or placeholders
don't match. Translations are loaded at runtime before bootstrap, so there is a single build.

## Structure

```
src/app/core/        services and pure logic (audio, network, channels, hotkey, i18n, theme)
src/app/ui/          components (lobby, call, channel card, peer tile, level meter …)
public/worklets/     noise gate AudioWorklet
src/locale/          extracted messages and German translation
```

## Deployment

Every push to `main` runs tests and the build, then deploys to GitHub Pages
(`.github/workflows/ci.yml`). Pull requests only run tests and the build.
