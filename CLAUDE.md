# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

No dependencies and no install step. Requires Node.js 20+.

```sh
npm start                          # static dev server on http://localhost:5174 (PORT env var overrides)
npm test                           # node --test, runs *.test.js
npm run release                    # build dist/ with commit + UTC time stamped into version.js
node --test --test-name-pattern="spells roots" progressions.test.js   # single test
```

## Architecture

A vanilla-JS, zero-dependency PWA, structured the same way as the sibling `../ChordChange` app (styles, `pwa.js`, the service worker pattern and the timer model all come from there).

- `progressions.js` is pure and unit-tested: the `PROGRESSIONS` table (Roman numerals, always measured against the major scale, so minor keys use `i`, `bIII`, `bVI`, `bVII`), `KEYS` (spelling per mode), letter-based root spelling with a fallback for double accidentals and Cb/Fb/E#/B#, `chordShape()` (open shapes first, then the lowest E/A-shape barre), `buildSession()` (one round per progression per cycle, shuffled per cycle, random key per round, no back-to-back repeats), and the `sessionPosition()` timer maths.
- `app.js` owns DOM and session state and must not re-implement music or timing logic. `pretty()` turns `b`/`#` into ♭/♯ for display only. Data stays ASCII.
- Timer model: wall-clock `elapsed` + `startedAt`, derived via `sessionPosition()` every 100ms. Skip sets `elapsed = index * duration * 1000`.
- State machine `ready | running | paused | complete`; `renderState()` maps state to UI and `configure()` rebuilds the session (no-op while running/paused).

## Same-origin safety (do not break)

- localStorage: only the key `chordprogressor-settings`; never call `localStorage.clear()`.
- Cache Storage: only names starting `chordprogressor-app-<scope>-`; `activate` deletes only those.
- The service worker only intercepts its explicit `APP_FILES`.
- Manifest `id` is fixed at `/chordprogressor`. Never set it to `./` or change it casually (that orphans installs).

## Adding or changing files

Keep `SHIPPED_FILES` in `shipped-files.js` and `APP_FILES` in `sw.js` in sync. When any cached file changes, bump `CACHE_VERSION` in `sw.js` and the `?v=` on the stylesheet link in `index.html`.
