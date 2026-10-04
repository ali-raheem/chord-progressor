# Chord Progressor

A focused guitar chord progression practice app. Pick progressions and keys, set the time per progression and the number of cycles, then loop each progression until the timer moves you on to the next one in a new key.

- 14 built-in progressions (pop, classic, jazz & blues, minor), written in Roman numerals and transposed to any of the 12 keys.
- Chord diagrams for every chord: open shapes where they exist, otherwise the lowest E- or A-shape barre chord.
- Chord order is kept as written by default. *Shuffled* turns each round into a chord-change drill.
- Installable and offline-capable (PWA). Settings are remembered in this browser.

## Development

No dependencies. Requires Node.js 20+.

```sh
npm start          # http://localhost:5174 (PORT overrides)
npm test           # unit tests for progressions.js
npm run release    # build dist/ with commit + UTC time stamped into version.js
```

## Sharing an origin with other apps

The app is designed to live in a subdirectory (for example `/cp/`) next to other apps on the same host:

- The service worker scope is its own directory. It only answers requests for its own file list and only creates or deletes Cache Storage entries named `chordprogressor-app-<scope>-*`.
- localStorage uses the single key `chordprogressor-settings` and never clears anything.
- The manifest `id` is the fixed `/chordprogressor`, so it never collides with another app's install identity.

## Deploying

Upload the contents of `dist/` (including `icons/`) to a directory served over HTTPS. Serve `manifest.webmanifest` as `application/manifest+json`, and preferably use `Cache-Control: no-cache` for the app directory. Bump `CACHE_VERSION` in `sw.js` (and the `?v=` on the stylesheet link) whenever a shipped file changes.

## Current production deployment

- URL: https://shoryuken.me/cp/
- Server: `root@185.163.204.17`, static directory `/var/www/shoryuken.me/cp`
- Nginx: the `/cp` blocks in `/etc/nginx/sites-enabled/shoryuken.me` (bare `/cp` redirects to `/cp/`, `no-cache` everywhere, manifest served as `application/manifest+json`).
- First deployed 2026-10-04 (commit `c8fcb58`, cache v1). The Nginx config from before `/cp` was added is backed up at `/var/backups/chordprogressor/20261004T085651Z/`.
- Deploy: commit, bump `CACHE_VERSION`, `npm run release`, back up the current `cp/`, then `tar czf - -C dist . | ssh root@185.163.204.17 'tar xzf - --no-same-owner -C /var/www/shoryuken.me/cp'`. Verify in Chromium (Cloudflare blocks scripted probes) that the footer shows the deployed commit.
