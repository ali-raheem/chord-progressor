// Pure, browser-free music logic. Everything here is unit-tested in progressions.test.js.

// Progressions are written in Roman numerals relative to the tonic, always measured
// against the major scale: minor-key progressions use flat degrees (i, bIII, bVI, bVII).
// Uppercase = major, lowercase = minor; "7" makes uppercase dominant 7 and lowercase m7.
export const PROGRESSIONS = [
  { id: 'pop', name: 'Pop anthem', group: 'Pop & rock', mode: 'major', numerals: ['I', 'V', 'vi', 'IV'] },
  { id: 'three-chord', name: 'Three-chord', group: 'Pop & rock', mode: 'major', numerals: ['I', 'IV', 'V'] },
  { id: 'minor-start', name: 'Minor-start pop', group: 'Pop & rock', mode: 'major', numerals: ['vi', 'IV', 'I', 'V'] },
  { id: 'singalong', name: 'Singalong', group: 'Pop & rock', mode: 'major', numerals: ['I', 'IV', 'vi', 'V'] },
  { id: 'fifties', name: '’50s doo-wop', group: 'Classic', mode: 'major', numerals: ['I', 'vi', 'IV', 'V'] },
  { id: 'canon', name: 'Pachelbel’s Canon', group: 'Classic', mode: 'major', numerals: ['I', 'V', 'vi', 'iii', 'IV', 'I', 'IV', 'V'] },
  { id: 'mixolydian', name: 'Mixolydian rock', group: 'Classic', mode: 'major', numerals: ['I', 'bVII', 'IV', 'I'] },
  { id: 'ii-v-i', name: 'ii–V–I', group: 'Jazz & blues', mode: 'major', numerals: ['ii7', 'V7', 'Imaj7'] },
  { id: 'turnaround', name: 'Jazz turnaround', group: 'Jazz & blues', mode: 'major', numerals: ['Imaj7', 'vi7', 'ii7', 'V7'] },
  { id: 'blues', name: '12-bar blues', group: 'Jazz & blues', mode: 'major', numerals: ['I7', 'I7', 'I7', 'I7', 'IV7', 'IV7', 'I7', 'I7', 'V7', 'IV7', 'I7', 'V7'] },
  { id: 'aeolian', name: 'Minor vamp', group: 'Minor', mode: 'minor', numerals: ['i', 'bVII', 'bVI', 'bVII'] },
  { id: 'minor-145', name: 'Minor i–iv–v', group: 'Minor', mode: 'minor', numerals: ['i', 'iv', 'v', 'i'] },
  { id: 'andalusian', name: 'Andalusian', group: 'Minor', mode: 'minor', numerals: ['i', 'bVII', 'bVI', 'V'] },
  { id: 'epic', name: 'Epic minor', group: 'Minor', mode: 'minor', numerals: ['i', 'bVI', 'bIII', 'bVII'] },
];
export const GROUPS = [...new Set(PROGRESSIONS.map(p => p.group))];

// Tonics by pitch class. Minor keys use the spelling with the friendlier key signature.
export const KEYS = [
  { pc: 0, major: 'C', minor: 'C' }, { pc: 1, major: 'Db', minor: 'C#' }, { pc: 2, major: 'D', minor: 'D' },
  { pc: 3, major: 'Eb', minor: 'D#' }, { pc: 4, major: 'E', minor: 'E' }, { pc: 5, major: 'F', minor: 'F' },
  { pc: 6, major: 'F#', minor: 'F#' }, { pc: 7, major: 'G', minor: 'G' }, { pc: 8, major: 'Ab', minor: 'G#' },
  { pc: 9, major: 'A', minor: 'A' }, { pc: 10, major: 'Bb', minor: 'Bb' }, { pc: 11, major: 'B', minor: 'B' },
];
export const keyName = (pc, mode) => KEYS[pc][mode];

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const SIMPLE = { sharp: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'], flat: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] };
const SUFFIX = { major: '', minor: 'm', dom7: '7', min7: 'm7', maj7: 'maj7' };

export function parseNumeral(numeral) {
  const match = /^([b#]?)([ivIV]+)(maj7|7)?$/.exec(numeral);
  const degree = match ? ROMAN.indexOf(match[2].toUpperCase()) : -1;
  if (degree < 0) throw new Error(`Unknown numeral: ${numeral}`);
  const minor = match[2] === match[2].toLowerCase();
  const quality = match[3] === 'maj7' ? 'maj7' : match[3] ? (minor ? 'min7' : 'dom7') : (minor ? 'minor' : 'major');
  const shift = match[1] === 'b' ? -1 : match[1] === '#' ? 1 : 0;
  return { degree, semitones: (MAJOR_STEPS[degree] + shift + 12) % 12, quality };
}

export function parseNote(name) {
  const letter = LETTERS.indexOf(name[0]);
  const accidental = [...name.slice(1)].reduce((sum, c) => sum + (c === '#' ? 1 : c === 'b' ? -1 : 0), 0);
  return { letter, pc: (LETTER_PC[letter] + accidental + 12) % 12 };
}

// Spell the root by letter (key D: bVI is Bb, not A#), then fall back to a plain
// name when that would need a double accidental or an odd one like Cb or E#.
export function spellRoot(tonic, numeral) {
  const { letter, pc } = parseNote(tonic);
  const { degree, semitones } = parseNumeral(numeral);
  const targetLetter = (letter + degree) % 7;
  const target = (pc + semitones) % 12;
  const offset = ((target - LETTER_PC[targetLetter] + 18) % 12) - 6;
  const name = LETTERS[targetLetter] + (offset > 0 ? '#'.repeat(offset) : 'b'.repeat(-offset));
  if (Math.abs(offset) > 1 || ['Cb', 'Fb', 'E#', 'B#'].includes(name)) return SIMPLE[offset > 0 ? 'sharp' : 'flat'][target];
  return name;
}

export function chordName(tonic, numeral) {
  return spellRoot(tonic, numeral) + SUFFIX[parseNumeral(numeral).quality];
}

export function progressionChords(progression, keyPc) {
  const tonic = keyName(keyPc, progression.mode);
  return progression.numerals.map(numeral => ({ numeral, name: chordName(tonic, numeral) }));
}

export function parseChord(name) {
  const match = /^([A-G][#b]?)(m7|maj7|m|7)?$/.exec(name);
  if (!match) throw new Error(`Unknown chord: ${name}`);
  const quality = { m: 'minor', 7: 'dom7', m7: 'min7', maj7: 'maj7' }[match[2]] || 'major';
  return { pc: parseNote(match[1]).pc, quality };
}

// Fret arrays run low E to high e; -1 = muted, 0 = open. Fingers use the same order.
const OPEN_SHAPES = [
  { name: 'C', frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0] },
  { name: 'D', frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2] },
  { name: 'E', frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0] },
  { name: 'F', frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1], barre: 1 },
  { name: 'G', frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3] },
  { name: 'A', frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0] },
  { name: 'Am', frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0] },
  { name: 'Dm', frets: [-1, -1, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1] },
  { name: 'Em', frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0] },
  { name: 'A7', frets: [-1, 0, 2, 0, 2, 0], fingers: [0, 0, 1, 0, 2, 0] },
  { name: 'B7', frets: [-1, 2, 1, 2, 0, 2], fingers: [0, 2, 1, 3, 0, 4] },
  { name: 'C7', frets: [-1, 3, 2, 3, 1, 0], fingers: [0, 3, 2, 4, 1, 0] },
  { name: 'D7', frets: [-1, -1, 0, 2, 1, 2], fingers: [0, 0, 0, 2, 1, 3] },
  { name: 'E7', frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0] },
  { name: 'G7', frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1] },
  { name: 'Am7', frets: [-1, 0, 2, 0, 1, 0], fingers: [0, 0, 2, 0, 1, 0] },
  { name: 'Bm7', frets: [-1, 2, 0, 2, 0, 2], fingers: [0, 1, 0, 2, 0, 3] },
  { name: 'Dm7', frets: [-1, -1, 0, 2, 1, 1], fingers: [0, 0, 0, 2, 1, 1] },
  { name: 'Em7', frets: [0, 2, 0, 0, 0, 0], fingers: [0, 2, 0, 0, 0, 0] },
  { name: 'Cmaj7', frets: [-1, 3, 2, 0, 0, 0], fingers: [0, 3, 2, 0, 0, 0] },
  { name: 'Dmaj7', frets: [-1, -1, 0, 2, 2, 2], fingers: [0, 0, 0, 1, 2, 3] },
  { name: 'Emaj7', frets: [0, 2, 1, 1, 0, 0], fingers: [0, 3, 1, 2, 0, 0] },
  { name: 'Fmaj7', frets: [-1, -1, 3, 2, 1, 0], fingers: [0, 0, 3, 2, 1, 0] },
  { name: 'Gmaj7', frets: [3, 2, 0, 0, 0, 2], fingers: [3, 2, 0, 0, 0, 1] },
  { name: 'Amaj7', frets: [-1, 0, 2, 1, 2, 0], fingers: [0, 0, 2, 1, 3, 0] },
];

// Movable barre shapes as offsets from the barre fret, rooted on low E or A.
const BARRE_SHAPES = {
  E: { root: 4, shapes: {
    major: { frets: [0, 2, 2, 1, 0, 0], fingers: [1, 3, 4, 2, 1, 1] },
    minor: { frets: [0, 2, 2, 0, 0, 0], fingers: [1, 3, 4, 1, 1, 1] },
    dom7: { frets: [0, 2, 0, 1, 0, 0], fingers: [1, 3, 1, 2, 1, 1] },
    min7: { frets: [0, 2, 0, 0, 0, 0], fingers: [1, 3, 1, 1, 1, 1] },
  } },
  A: { root: 9, shapes: {
    major: { frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 1, 2, 3, 4, 1] },
    minor: { frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 1, 3, 4, 2, 1] },
    dom7: { frets: [-1, 0, 2, 0, 2, 0], fingers: [0, 1, 3, 1, 4, 1] },
    min7: { frets: [-1, 0, 2, 0, 1, 0], fingers: [0, 1, 3, 1, 2, 1] },
    maj7: { frets: [-1, 0, 2, 1, 2, 0], fingers: [0, 1, 3, 2, 4, 1] },
  } },
};

// Prefer an open shape; otherwise the lowest-positioned E- or A-shape barre chord.
export function chordShape(name) {
  const { pc, quality } = parseChord(name);
  const open = OPEN_SHAPES.find(shape => { const s = parseChord(shape.name); return s.pc === pc && s.quality === quality; });
  if (open) return { frets: open.frets, fingers: open.fingers, barre: open.barre };
  let best;
  for (const { root, shapes } of Object.values(BARRE_SHAPES)) {
    const shape = shapes[quality];
    if (!shape) continue;
    const barre = ((pc - root + 12) % 12) || 12;
    if (!best || barre < best.barre) best = { frets: shape.frets.map(f => f < 0 ? -1 : f + barre), fingers: shape.fingers, barre };
  }
  return best;
}

export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// One round per selected progression per cycle. Progressions are shuffled within each
// cycle (never repeating back-to-back across a cycle boundary), and each round gets a
// random key from the selection, avoiding the same key twice in a row when possible.
export function buildSession({ progressionIds, keys, cycles, shuffleChords = false }, random = Math.random) {
  const chosen = PROGRESSIONS.filter(p => progressionIds.includes(p.id));
  const keyPcs = [...new Set(keys)].filter(pc => Number.isInteger(pc) && pc >= 0 && pc < 12);
  if (!chosen.length || !keyPcs.length || cycles < 1) return [];
  const rounds = [];
  for (let cycle = 0; cycle < cycles; cycle++) {
    let order = shuffle(chosen, random);
    if (order.length > 1 && rounds.length && order[0].id === rounds.at(-1).progression.id) order.push(order.shift());
    for (const progression of order) {
      const previousKey = rounds.at(-1)?.keyPc;
      const options = keyPcs.length > 1 ? keyPcs.filter(pc => pc !== previousKey) : keyPcs;
      const keyPc = options[Math.floor(random() * options.length)];
      let chords = progressionChords(progression, keyPc);
      if (shuffleChords) chords = shuffleDifferent(chords, random);
      rounds.push({ progression, keyPc, key: keyName(keyPc, progression.mode) + (progression.mode === 'minor' ? ' minor' : ' major'), chords });
    }
  }
  return rounds;
}

// A shuffle that changes the order whenever the chords allow a different order.
function shuffleDifferent(chords, random) {
  const same = (a, b) => a.every((c, i) => c.name === b[i].name);
  if (new Set(chords.map(c => c.name)).size < 2) return chords;
  for (let attempt = 0; attempt < 8; attempt++) {
    const result = shuffle(chords, random);
    if (!same(result, chords)) return result;
  }
  return [...chords.slice(1), chords[0]];
}

export function uniqueChords(chords) {
  return [...new Set(chords.map(c => c.name))];
}

export function formatTime(seconds) {
  const whole = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

// Compute from elapsed time so late/background callbacks do not slow the session.
export function sessionPosition(elapsedMs, durationSeconds, roundCount) {
  const durationMs = durationSeconds * 1000;
  const elapsed = Math.max(0, elapsedMs);
  const index = Math.min(Math.floor(elapsed / durationMs), roundCount);
  return {
    index,
    complete: index >= roundCount,
    remaining: index >= roundCount ? 0 : (durationMs - elapsed % durationMs) / 1000,
    progress: roundCount ? Math.min(elapsed / (durationMs * roundCount), 1) : 0,
  };
}
