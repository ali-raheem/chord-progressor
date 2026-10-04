import { PROGRESSIONS, GROUPS, KEYS, chordShape, buildSession, uniqueChords, formatTime, sessionPosition } from './progressions.js';

const $ = id => document.getElementById(id);
const paths = {
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 .4c0 1.8-2.5 2-2.5 3.6m0 3h.01"/>',
  sliders: '<path d="M4 7h6m4 0h6M4 17h10m4 0h2"/><circle cx="12" cy="7" r="2"/><circle cx="16" cy="17" r="2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  shuffle: '<path d="M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 3-2 4-4m4-4c1-2 2-4 4-4h3m-4-4 4 4-4 4"/>',
  'volume-off': '<path d="m11 5-6 4H2v6h3l6 4V5Zm5 4 6 6m0-6-6 6"/>',
  'screen-off': '<rect x="6" y="2.5" width="12" height="19" rx="2"/><path d="M11 18h2M4 4l16 16"/>',
  screen: '<rect x="6" y="2.5" width="12" height="19" rx="2"/><path d="M11 18h2M9.5 9.5 12 7l2.5 2.5M12 7v6"/>',
  volume: '<path d="m11 5-6 4H2v6h3l6 4V5Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  play: '<path d="m8 4 12 8-12 8Z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M8 5v14M16 5v14" stroke-width="4"/>',
  reset: '<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
  skip: '<path d="m5 5 11 7-11 7Z"/><path d="M19 5v14"/>',
  repeat: '<path d="M4 10V7a2 2 0 0 1 2-2h14m-4-4 4 4-4 4M20 14v3a2 2 0 0 1-2 2H4m4-4-4 4 4 4"/>',
  list: '<path d="M9 6h12M9 12h12M9 18h12M3 6h.01M3 12h.01M3 18h.01"/>',
  sparkles: '<path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3Zm7-2v4m-2-2h4"/>',
  guitar: '<path d="m13 11 7-7m-2-1 3 3M9 8c-2-1-4 1-3 3-5 1-5 7-1 9s7-1 7-4c3 0 4-3 2-5l-5-3Z"/><circle cx="9" cy="15" r="1.5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
document.querySelectorAll('[data-icon]').forEach(el => el.innerHTML = icon(el.dataset.icon));

// Display-only typography: B♭, F♯m, ♭VII.
const pretty = text => text.replace(/^([A-G])b/, '$1♭').replace(/^b/, '♭').replace('#', '♯');
const OPEN_KEYS = [0, 2, 4, 7, 9];
const PRESETS = [30, 60, 120];
const MAX_CYCLES = 20;
// Namespaced so other apps on the same origin are never affected.
const STORAGE_KEY = 'chordprogressor-settings';

let selected = new Set(['pop', 'three-chord']);
let keys = new Set([0, 7, 2]);
let shuffleChords = false;
let duration = 60;
let cycles = 2;
let keepAwake = false;
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (saved && Array.isArray(saved.progressions)) selected = new Set(saved.progressions.filter(id => PROGRESSIONS.some(p => p.id === id)));
  if (saved && Array.isArray(saved.keys)) keys = new Set(saved.keys.filter(pc => Number.isInteger(pc) && pc >= 0 && pc < 12));
  if (saved && typeof saved.shuffleChords === 'boolean') shuffleChords = saved.shuffleChords;
  if (saved && Number.isInteger(saved.duration) && saved.duration >= 10 && saved.duration <= 900) duration = saved.duration;
  if (saved && Number.isInteger(saved.cycles) && saved.cycles >= 1 && saved.cycles <= MAX_CYCLES) cycles = saved.cycles;
  if (saved && saved.keepAwake === true) keepAwake = true;
} catch { /* Storage is optional. */ }
let rounds = [];
let state = 'ready';
let index = 0;
let elapsed = 0;
let startedAt = 0;
let interval;
let sound = false;
let audioContext;
let skipped = 0;
// Screen Wake Lock needs a secure context; the browser also drops the lock whenever the page is hidden.
const wakeLockSupported = 'wakeLock' in navigator && window.isSecureContext;
let wakeLock;
let wakeLockRequest;

function announce(message) { $('announcement').textContent = message; }
function saveSettings() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ progressions: [...selected], keys: [...keys], shuffleChords, duration, cycles, keepAwake })); } catch { /* Storage is optional. */ }
}

function wakeLockWanted() { return keepAwake && (state === 'running' || state === 'paused') && !document.hidden; }
function syncWakeLock() {
  if (!wakeLockSupported) return;
  if (wakeLockWanted()) {
    if (wakeLock || wakeLockRequest) return;
    wakeLockRequest = navigator.wakeLock.request('screen').then(lock => {
      wakeLock = lock;
      lock.addEventListener('release', () => { if (wakeLock === lock) wakeLock = undefined; });
      if (!wakeLockWanted()) lock.release().catch(() => {});
    }).catch(() => { /* Practice continues; the screen may dim. */ }).finally(() => { wakeLockRequest = undefined; });
  } else if (wakeLock) {
    wakeLock.release().catch(() => {});
  }
}
function renderAwakeToggle() {
  const button = $('awake-toggle');
  button.innerHTML = icon(keepAwake ? 'screen' : 'screen-off');
  button.setAttribute('aria-pressed', String(keepAwake));
  const label = wakeLockSupported ? `${keepAwake ? 'Let the screen dim' : 'Keep the screen awake'} during practice` : 'Keeping the screen awake is not available in this browser';
  button.setAttribute('aria-label', label); button.title = label;
  button.disabled = !wakeLockSupported;
}

// Four-fret window; chords above the fourth fret show their starting fret instead of the nut.
function chordDiagram(name) {
  const chord = chordShape(name);
  const fretted = chord.frets.filter(f => f > 0);
  const base = fretted.length && Math.max(...fretted) > 4 ? Math.min(...fretted) : 1;
  const x = i => 20 + i * 20;
  const y = fret => 35 + (fret - base + .5) * 24;
  let grid = '';
  for (let i = 0; i < 6; i++) grid += `<line x1="${x(i)}" y1="35" x2="${x(i)}" y2="131" stroke="#c9c2d4" stroke-width="${1.3 - i * .1}"/>`;
  for (let i = 0; i <= 4; i++) grid += `<line x1="20" y1="${35 + i * 24}" x2="120" y2="${35 + i * 24}" stroke="${i || base > 1 ? '#d6d0df' : '#756783'}" stroke-width="${i || base > 1 ? 1 : 3}"/>`;
  if (base > 1) grid += `<text x="9" y="${y(base) + 4}" text-anchor="middle" fill="#8d839f" font-family="sans-serif" font-size="10" font-weight="600">${base}</text>`;
  if (chord.barre) {
    const start = chord.frets.findIndex(f => f === chord.barre);
    grid += `<line x1="${x(start)}" y1="${y(chord.barre)}" x2="120" y2="${y(chord.barre)}" stroke="#9474c7" stroke-width="14" stroke-linecap="round"/>`;
  }
  chord.frets.forEach((fret, i) => {
    if (fret <= 0) grid += `<text x="${x(i)}" y="24" text-anchor="middle" fill="#a295b2" font-family="sans-serif" font-size="12">${fret < 0 ? '×' : '○'}</text>`;
    else grid += `<circle cx="${x(i)}" cy="${y(fret)}" r="8" fill="#9474c7"/><text x="${x(i)}" y="${y(fret) + 3}" text-anchor="middle" fill="white" font-family="sans-serif" font-size="8" font-weight="600">${chord.fingers[i]}</text>`;
    grid += `<text x="${x(i)}" y="147" text-anchor="middle" fill="#ada3b7" font-family="sans-serif" font-size="8">${['E', 'A', 'D', 'G', 'B', 'e'][i]}</text>`;
  });
  const description = chord.frets.map((f, i) => `${['low E', 'A', 'D', 'G', 'B', 'high E'][i]} ${f < 0 ? 'muted' : f === 0 ? 'open' : `fret ${f}, finger ${chord.fingers[i]}`}`).join('; ');
  return `<figure class="shape"><figcaption>${pretty(name)}</figcaption><svg class="chord-diagram" viewBox="0 0 140 158" role="img" aria-label="${pretty(name)}: ${description}">${grid}</svg></figure>`;
}

function renderSelection() {
  $('progression-groups').innerHTML = GROUPS.map(group => `<div class="progression-group"><h3>${group}</h3><div class="progression-buttons">${PROGRESSIONS.filter(p => p.group === group).map(p => `<button type="button" class="progression-button" data-progression="${p.id}" aria-pressed="false"><span class="progression-name">${p.name}</span><span class="progression-numerals">${p.numerals.map(pretty).join(' – ')}</span></button>`).join('')}</div></div>`).join('');
  $('key-buttons').innerHTML = KEYS.map(k => `<button type="button" class="key-button" data-key="${k.pc}" aria-pressed="false" aria-label="${pretty(k.major)}${k.minor !== k.major ? ` (${pretty(k.minor)} minor)` : ''}">${pretty(k.major)}</button>`).join('');
}

const roundTitle = round => `${round.progression.name} in ${pretty(round.key)}`;

function renderQueue() {
  $('queue').innerHTML = rounds.map((round, i) => {
    const done = i < index || state === 'complete';
    return `<div class="queue-pair ${done ? 'done' : i === index ? 'active' : ''}" ${i === index ? 'aria-current="step"' : ''}><span class="pair-number">${done ? '✓' : String(i + 1).padStart(2, '0')}</span><span>${round.progression.name}</span><span class="pair-arrow">·</span><span>${pretty(round.key.replace(' major', '').replace(' minor', 'm'))}</span></div>`;
  }).join('') || '<span class="field-description">Your practice rounds will appear here.</span>';
  const active = $('queue').querySelector('.active');
  if (active) $('queue').scrollLeft = Math.max(0, active.offsetLeft - 12);
}

function renderRound() {
  const round = rounds[Math.min(index, rounds.length - 1)];
  $('round-stage').classList.toggle('empty', !round);
  if (round) {
    $('practice-title').textContent = round.progression.name;
    $('key-pill').textContent = pretty(round.key);
    $('order-pill').hidden = !shuffleChords;
    const columns = Math.min(round.chords.length, 4);
    $('progression-strip').style.setProperty('--columns', columns);
    $('progression-strip').innerHTML = round.chords.map((chord, i) => `<li class="strip-chord"><span class="strip-name">${pretty(chord.name)}</span><span class="strip-numeral">${pretty(chord.numeral)}</span><span class="sr-only">${i === round.chords.length - 1 ? ', then back to the start' : ''}</span></li>`).join('');
    $('shapes').innerHTML = uniqueChords(round.chords).map(chordDiagram).join('');
  } else {
    $('practice-title').textContent = 'Pick a progression to begin';
    $('key-pill').textContent = keys.size ? 'Any key' : 'Choose a key';
    $('order-pill').hidden = true;
    $('progression-strip').innerHTML = '';
    $('shapes').innerHTML = '';
  }
  const next = rounds[index + 1];
  $('up-next-text').textContent = state === 'complete' ? 'All rounds played' : next ? `Up next: ${roundTitle(next)}` : rounds.length ? 'Last one. Make it count.' : 'Up next: —';
  renderQueue();
  $('round-counter').textContent = state === 'ready' ? `${rounds.length} ${rounds.length === 1 ? 'round' : 'rounds'}. One focused session.` : state === 'complete' ? 'Session complete. Nicely done.' : `Round ${index + 1} of ${rounds.length}`;
}

function updateTimer(remaining, progress = 0) {
  $('timer').textContent = formatTime(remaining);
  $('timer-fill').style.width = `${Math.max(0, remaining / duration * 100)}%`;
  $('overall-fill').style.width = `${progress * 100}%`;
  $('progress-percent').textContent = `${Math.floor(progress * 100)}%`;
}

function renderState() {
  const active = state === 'running' || state === 'paused';
  $('settings').disabled = active;
  $('shuffle-button').disabled = active || rounds.length === 0;
  $('reset-button').disabled = state === 'ready';
  $('skip-button').disabled = !active;
  $('start-button').disabled = rounds.length === 0 || !$('duration').checkValidity();
  const labels = { ready: ['play', 'Start practice'], running: ['pause', 'Pause practice'], paused: ['play', 'Keep playing'], complete: ['repeat', 'Practice again'] };
  const [symbol, label] = labels[state];
  $('start-button').innerHTML = `${icon(symbol)}<span>${label}</span>`;
  $('status').textContent = { ready: 'READY WHEN YOU ARE', running: 'IN THE FLOW', paused: 'TAKE A BREATHER', complete: 'SESSION COMPLETE' }[state];
  $('status-pill').classList.toggle('running', state === 'running');
  if (state === 'complete') $('practice-title').textContent = 'A little better than yesterday.';
  $('practice-description').textContent = rounds.length === 0 && state === 'ready'
    ? 'Choose at least one progression and one key.'
    : { ready: 'Here’s your first one. Get comfortable and let’s play.', running: shuffleChords ? 'Play the chords in this order, then loop.' : 'Play through in order, then loop back to the start.', paused: 'Take a breath. Pick up right where you left off.', complete: 'Every minute you show up makes a difference.' }[state];
  $('settings-note').textContent = active ? 'End the session ↺ to change your settings.' : 'A fresh order and fresh keys each session.';
  $('timer-label').textContent = state === 'ready' ? 'TIME PER PROGRESSION' : state === 'complete' ? 'ALL DONE' : 'TIME REMAINING';
  $('progress-label').textContent = state === 'ready' ? 'Ready to make a little progress?' : state === 'complete' ? 'You made time for your music.' : `${index} of ${rounds.length} rounds finished${skipped ? ` · ${skipped} skipped` : ''}`;
  $('round-stage').hidden = state === 'complete';
  $('completion').hidden = state !== 'complete';
  $('keyboard-hint').innerHTML = state === 'complete' ? 'Fresh keys. A fresh flow. Go again when you’re ready.' : 'Press <kbd>space</kbd> to start or pause';
  syncWakeLock();
}

function configure() {
  if (state === 'running' || state === 'paused') return;
  state = 'ready'; index = 0; elapsed = 0; skipped = 0;
  rounds = buildSession({ progressionIds: [...selected], keys: [...keys], cycles, shuffleChords });
  document.querySelectorAll('[data-progression]').forEach(el => {
    el.classList.toggle('selected', selected.has(el.dataset.progression));
    el.setAttribute('aria-pressed', String(selected.has(el.dataset.progression)));
  });
  document.querySelectorAll('[data-key]').forEach(el => {
    const on = keys.has(Number(el.dataset.key));
    el.classList.toggle('selected', on); el.setAttribute('aria-pressed', String(on));
  });
  document.querySelectorAll('[data-order]').forEach(el => {
    const on = (el.dataset.order === 'shuffled') === shuffleChords;
    el.classList.toggle('selected', on); el.setAttribute('aria-pressed', String(on));
  });
  $('order-hint').textContent = shuffleChords ? 'A drill for the changes. Each round mixes the chords up.' : 'The order is what makes it a progression.';
  $('selected-count').textContent = `${selected.size} selected`;
  $('keys-count').textContent = `${keys.size} selected`;
  $('cycles').textContent = cycles;
  $('cycles-down').disabled = cycles <= 1;
  $('cycles-up').disabled = cycles >= MAX_CYCLES;
  $('summary-rounds').textContent = `${rounds.length} ${rounds.length === 1 ? 'round' : 'rounds'}`;
  $('summary-time').textContent = rounds.length ? `${formatTime(rounds.length * duration)} of practice` : 'Choose a progression and a key to start';
  $('duration').value = duration;
  document.querySelectorAll('[data-duration]').forEach(el => el.classList.toggle('selected', Number(el.dataset.duration) === duration));
  $('custom-duration').classList.toggle('selected', !PRESETS.includes(duration));
  renderRound(); renderState(); updateTimer(duration); saveSettings();
}

// Two soft sine notes at the start of each round; the second note rises higher when the session is done.
function chime(completed = false) {
  if (!sound || !audioContext) return;
  try {
    const t = audioContext.currentTime;
    [523.25, completed ? 783.99 : 659.25].forEach((frequency, i) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, t + i * .14);
      gain.gain.linearRampToValueAtTime(.12, t + i * .14 + .015);
      gain.gain.exponentialRampToValueAtTime(.001, t + i * .14 + .45);
      oscillator.connect(gain); gain.connect(audioContext.destination);
      oscillator.start(t + i * .14); oscillator.stop(t + i * .14 + .5);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    });
  } catch { /* Timer works even if audio is unavailable. */ }
}

function roundAnnouncement(round) {
  return `${roundTitle(round)}: ${round.chords.map(c => pretty(c.name)).join(', ')}.`;
}

function finish() {
  clearInterval(interval); state = 'complete'; index = rounds.length;
  const played = rounds.length - skipped;
  $('completion-message').textContent = `${played} ${played === 1 ? 'progression' : 'progressions'} played${skipped ? ` · ${skipped} skipped` : ''}. Keep that feeling going.`;
  updateTimer(0, 1); renderRound(); renderState(); chime(true);
  announce(`Session complete. ${played} progressions played.`);
}

function tick() {
  if (state !== 'running') return;
  const position = sessionPosition(elapsed + Date.now() - startedAt, duration, rounds.length);
  if (position.complete) { finish(); return; }
  if (position.index !== index) {
    index = position.index; renderRound(); renderState(); chime();
    announce(`Round ${index + 1} of ${rounds.length}. ${roundAnnouncement(rounds[index])}`);
  }
  updateTimer(position.remaining, position.progress);
}

function togglePractice() {
  if ($('start-button').disabled) return;
  if (state === 'running') {
    tick();
    if (state === 'complete') return;
    elapsed += Date.now() - startedAt;
    clearInterval(interval); state = 'paused'; renderState(); announce('Practice paused.');
    return;
  }
  if (state === 'complete') configure();
  const fresh = state === 'ready';
  if (fresh) { elapsed = 0; index = 0; skipped = 0; }
  state = 'running'; startedAt = Date.now();
  if (audioContext?.state === 'suspended') audioContext.resume().catch(() => {});
  renderState(); renderRound(); tick(); interval = setInterval(tick, 100);
  if (fresh) chime();
  announce(`Practice started. ${roundAnnouncement(rounds[index])} ${duration} seconds.`);
}

$('progression-groups').addEventListener('click', event => {
  const button = event.target.closest('[data-progression]');
  if (!button || $('settings').disabled) return;
  const id = button.dataset.progression;
  selected.has(id) ? selected.delete(id) : selected.add(id);
  configure();
});
$('select-all').addEventListener('click', () => { selected = new Set(PROGRESSIONS.map(p => p.id)); configure(); });
$('clear-selection').addEventListener('click', () => { selected.clear(); configure(); });
$('key-buttons').addEventListener('click', event => {
  const button = event.target.closest('[data-key]');
  if (!button || $('settings').disabled) return;
  const pc = Number(button.dataset.key);
  keys.has(pc) ? keys.delete(pc) : keys.add(pc);
  configure();
});
$('open-keys').addEventListener('click', () => { keys = new Set(OPEN_KEYS); configure(); });
$('all-keys').addEventListener('click', () => { keys = new Set(KEYS.map(k => k.pc)); configure(); });
$('order-options').addEventListener('click', event => {
  const button = event.target.closest('[data-order]');
  if (!button) return;
  shuffleChords = button.dataset.order === 'shuffled'; configure();
});
$('duration-presets').addEventListener('click', event => {
  const button = event.target.closest('[data-duration]');
  if (!button) return;
  duration = Number(button.dataset.duration); $('custom-time').hidden = true; configure();
});
$('custom-duration').addEventListener('click', () => { $('custom-time').hidden = false; $('duration').focus(); $('duration').select(); });
$('duration').addEventListener('input', () => {
  if ($('duration').checkValidity() && $('duration').value !== '') { duration = Number($('duration').value); configure(); }
  else $('start-button').disabled = true;
});
$('cycles-down').addEventListener('click', () => { cycles = Math.max(1, cycles - 1); configure(); });
$('cycles-up').addEventListener('click', () => { cycles = Math.min(MAX_CYCLES, cycles + 1); configure(); });
$('start-button').addEventListener('click', togglePractice);
$('shuffle-button').addEventListener('click', () => { configure(); announce('Practice rounds reshuffled.'); });
$('reset-button').addEventListener('click', () => { clearInterval(interval); state = 'ready'; configure(); announce('Session ended. Settings are ready to edit.'); });
$('skip-button').addEventListener('click', () => {
  if (state !== 'running' && state !== 'paused') return;
  if (state === 'running') tick();
  if (state === 'complete') return;
  skipped++; index++; elapsed = index * duration * 1000; startedAt = Date.now();
  if (index >= rounds.length) { finish(); return; }
  renderRound(); renderState(); updateTimer(duration, index / rounds.length); chime();
  announce(`Next: ${roundAnnouncement(rounds[index])}`);
});
$('sound-toggle').addEventListener('click', async () => {
  sound = !sound;
  if (sound) {
    try { audioContext ||= new (window.AudioContext || window.webkitAudioContext)(); await audioContext.resume(); }
    catch { sound = false; announce('Sound is unavailable in this browser.'); }
  }
  $('sound-toggle').innerHTML = icon(sound ? 'volume' : 'volume-off');
  $('sound-toggle').setAttribute('aria-pressed', String(sound));
  const label = `${sound ? 'Disable' : 'Enable'} sound at progression changes`;
  $('sound-toggle').setAttribute('aria-label', label); $('sound-toggle').title = label;
  if (sound) chime();
});
$('awake-toggle').addEventListener('click', () => {
  keepAwake = !keepAwake;
  renderAwakeToggle(); saveSettings(); syncWakeLock();
  announce(keepAwake ? 'The screen will stay awake during practice.' : 'The screen may dim during practice.');
});
$('help-button').addEventListener('click', () => $('help-dialog').showModal());
$('close-help').addEventListener('click', () => $('help-dialog').close());
$('got-it').addEventListener('click', () => $('help-dialog').close());
$('help-dialog').addEventListener('click', event => { if (event.target === $('help-dialog')) { const rect = $('help-dialog').getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) $('help-dialog').close(); } });
document.addEventListener('keydown', event => {
  if (event.code !== 'Space' || event.repeat || event.altKey || event.ctrlKey || event.metaKey || $('help-dialog').open || event.target.closest('button, input, textarea, select, a, [contenteditable]')) return;
  event.preventDefault(); togglePractice();
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); syncWakeLock(); });
renderSelection();
renderAwakeToggle();
$('custom-time').hidden = PRESETS.includes(duration);
configure();
