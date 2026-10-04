import test from 'node:test';
import assert from 'node:assert/strict';
import { PROGRESSIONS, KEYS, parseNumeral, spellRoot, chordName, progressionChords, chordShape, buildSession, uniqueChords, formatTime, sessionPosition } from './progressions.js';

const names = (id, pc) => progressionChords(PROGRESSIONS.find(p => p.id === id), pc).map(c => c.name);
const cycling = values => { let i = 0; return () => values[i++ % values.length]; };

test('parses numerals into scale steps and qualities', () => {
  assert.deepEqual(parseNumeral('I'), { degree: 0, semitones: 0, quality: 'major' });
  assert.deepEqual(parseNumeral('vi'), { degree: 5, semitones: 9, quality: 'minor' });
  assert.deepEqual(parseNumeral('bVII'), { degree: 6, semitones: 10, quality: 'major' });
  assert.equal(parseNumeral('V7').quality, 'dom7');
  assert.equal(parseNumeral('ii7').quality, 'min7');
  assert.equal(parseNumeral('Imaj7').quality, 'maj7');
  assert.throws(() => parseNumeral('X'));
});

test('builds familiar progressions in common keys', () => {
  assert.deepEqual(names('pop', 0), ['C', 'G', 'Am', 'F']);
  assert.deepEqual(names('pop', 7), ['G', 'D', 'Em', 'C']);
  assert.deepEqual(names('ii-v-i', 0), ['Dm7', 'G7', 'Cmaj7']);
  assert.deepEqual(names('andalusian', 9), ['Am', 'G', 'F', 'E']);
  assert.deepEqual(names('mixolydian', 4), ['E', 'D', 'A', 'E']);
  assert.deepEqual(uniqueChords(progressionChords(PROGRESSIONS.find(p => p.id === 'blues'), 9)), ['A7', 'D7', 'E7']);
});

test('spells roots by letter and avoids awkward accidentals', () => {
  assert.equal(spellRoot('D', 'bVI'), 'Bb');
  assert.equal(spellRoot('Eb', 'IV'), 'Ab');
  assert.equal(spellRoot('F#', 'vii'), 'F');
  assert.equal(spellRoot('Db', 'bVII'), 'B');
  assert.equal(chordName('C#', 'bVI'), 'A');
  for (const progression of PROGRESSIONS) {
    for (const key of KEYS) {
      for (const { name } of progressionChords(progression, key.pc)) assert.match(name, /^[A-G][#b]?(m|7|m7|maj7)?$/, `${progression.id} in ${key.major}: ${name}`);
    }
  }
});

test('every chord in every key has a playable diagram', () => {
  for (const progression of PROGRESSIONS) {
    for (const key of KEYS) {
      for (const { name } of progressionChords(progression, key.pc)) {
        const shape = chordShape(name);
        assert.ok(shape, name);
        assert.equal(shape.frets.length, 6);
        const fretted = shape.frets.filter(f => f > 0);
        assert.ok(!fretted.length || Math.max(...fretted) - Math.min(...fretted) <= 3, `${name} spans too far`);
      }
    }
  }
});

test('prefers open shapes and falls back to the lowest barre shape', () => {
  assert.deepEqual(chordShape('G').frets, [3, 2, 0, 0, 0, 3]);
  assert.deepEqual(chordShape('Bm'), { frets: [-1, 2, 4, 4, 3, 2], fingers: [0, 1, 3, 4, 2, 1], barre: 2 });
  assert.deepEqual(chordShape('Gm').frets, [3, 5, 5, 3, 3, 3]);
  assert.deepEqual(chordShape('Bbmaj7').frets, [-1, 1, 3, 2, 3, 1]);
  assert.deepEqual(chordShape('C#m').frets, [-1, 4, 6, 6, 5, 4]);
});

test('a session has one round per progression per cycle, without back-to-back repeats', () => {
  const ids = ['pop', 'blues', 'ii-v-i'];
  for (let seed = 0; seed < 20; seed++) {
    const random = cycling([seed / 20, .7, .2, .95, .4]);
    const rounds = buildSession({ progressionIds: ids, keys: [0, 7], cycles: 3 }, random);
    assert.equal(rounds.length, 9);
    for (let cycle = 0; cycle < 3; cycle++) assert.deepEqual(rounds.slice(cycle * 3, cycle * 3 + 3).map(r => r.progression.id).sort(), [...ids].sort());
    rounds.slice(1).forEach((round, i) => {
      assert.notEqual(round.progression.id, rounds[i].progression.id);
      assert.notEqual(round.keyPc, rounds[i].keyPc);
    });
  }
});

test('keeps written order unless chord shuffling is requested', () => {
  const plain = buildSession({ progressionIds: ['pop'], keys: [0], cycles: 2 });
  assert.deepEqual(plain.map(r => r.chords.map(c => c.name)), [['C', 'G', 'Am', 'F'], ['C', 'G', 'Am', 'F']]);
  assert.equal(plain[0].key, 'C major');
  const mixed = buildSession({ progressionIds: ['pop'], keys: [0], cycles: 5, shuffleChords: true }, () => 0);
  for (const round of mixed) {
    assert.notDeepEqual(round.chords.map(c => c.name), ['C', 'G', 'Am', 'F']);
    assert.deepEqual(round.chords.map(c => c.name).sort(), ['Am', 'C', 'F', 'G']);
  }
});

test('returns an empty session for incomplete settings', () => {
  assert.deepEqual(buildSession({ progressionIds: [], keys: [0], cycles: 1 }), []);
  assert.deepEqual(buildSession({ progressionIds: ['pop'], keys: [], cycles: 1 }), []);
  assert.deepEqual(buildSession({ progressionIds: ['pop'], keys: [0], cycles: 0 }), []);
});

test('timer advances at boundaries and catches up after delayed callbacks', () => {
  assert.deepEqual(sessionPosition(0, 60, 6), { index: 0, complete: false, remaining: 60, progress: 0 });
  assert.equal(sessionPosition(59999, 60, 6).index, 0);
  assert.equal(sessionPosition(60000, 60, 6).index, 1);
  assert.equal(sessionPosition(185000, 60, 6).remaining, 55);
  assert.deepEqual(sessionPosition(400000, 60, 6), { index: 6, complete: true, remaining: 0, progress: 1 });
});

test('formats remaining seconds without showing zero early', () => {
  assert.equal(formatTime(60), '1:00');
  assert.equal(formatTime(.1), '0:01');
  assert.equal(formatTime(600), '10:00');
});
