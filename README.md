# P2P Voice

Voice chat that runs directly between browsers. Audio is sent peer to peer with Opus at up to
510 kbit/s stereo; public Nostr relays, BitTorrent trackers or MQTT brokers are only used so peers
can find each other.

Live: https://woercel.github.io/p2p-voice/

## Features

- Rooms via invite link (room name, password and rendezvous are encoded in one token in the URL hash)
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

Texts use [ngx-translate](https://ngx-translate.org/) with keys like `lobby.title`: the `translate`
pipe in templates, `I18n.text()` in code. Translations live in `public/i18n/en.json` and `de.json`
and are loaded over HTTP, so the language switches instantly, even during a call. A test fails if
the two files differ in keys or placeholders.

## Structure

```
src/app/core/        services and pure logic (audio, network, channels, hotkey, i18n, theme)
src/app/ui/          components (lobby, call, channel card, peer tile, level meter …)
public/worklets/     noise gate AudioWorklet
public/i18n/         English and German translations
```

## Deployment

Every push to `main` runs tests and the build, then deploys to GitHub Pages
(`.github/workflows/ci.yml`). Pull requests only run tests and the build.
