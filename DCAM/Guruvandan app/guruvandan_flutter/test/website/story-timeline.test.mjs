import test from 'node:test';
import assert from 'node:assert/strict';
import { CHAPTERS, sampleStory } from '../../web/story-timeline.mjs';

test('scroll input is clamped and always produces finite poses', () => {
  for (const progress of [-2, NaN, Infinity, ...Array.from({ length: 1801 }, (_, index) => index / 1800), 2]) {
    const sample = sampleStory(progress);
    for (const value of Object.values(sample)) assert.ok(Number.isFinite(value));
    assert.ok(sample.progress >= 0 && sample.progress <= 1);
    assert.ok(sample.chapter >= 0 && sample.chapter < 5);
  }
});

test('a stopped scroll always returns exactly the same pose', () => {
  for (const progress of [0, 0.1, 0.36, 0.61, 0.8, 0.98]) {
    const first = sampleStory(progress);
    for (let repeat = 0; repeat < 100; repeat += 1) assert.deepEqual(sampleStory(progress), first);
  }
});

test('reversing the scroll retraces every pose, without accumulated state', () => {
  const forward = Array.from({ length: 1801 }, (_, index) => sampleStory(index / 1800));
  for (let frame = 1800; frame >= 0; frame -= 1) assert.deepEqual(sampleStory(frame / 1800), forward[frame]);
});

test('chapter transitions preserve position and body pose', () => {
  for (const { start } of CHAPTERS.slice(1)) {
    const before = sampleStory(start - 0.00000001);
    const after = sampleStory(start);
    for (const key of ['position', 'sit', 'help', 'teach', 'turn', 'elevation', 'walking']) {
      assert.ok(Math.abs(before[key] - after[key]) < 0.001, key + ' jumps at ' + start);
    }
  }
});

test('the timeline includes walking, offering, sitting, gestures and app reveal', () => {
  assert.notEqual(sampleStory(0.1).stride, sampleStory(0.11).stride);
  assert.ok(sampleStory(0.36).help > 0.7);
  assert.equal(sampleStory(0.63).sit, 1);
  assert.ok(sampleStory(0.82).teach > sampleStory(0.79).teach);
  assert.equal(sampleStory(1).reveal, 1);
  assert.equal(sampleStory(0.85).reveal, 0);
});

test('reduced motion disables repetitive walking and fabric movement', () => {
  for (const progress of [0.1, 0.27, 0.5, 0.72, 0.9]) {
    assert.equal(sampleStory(progress, true).walking, 0);
    assert.equal(sampleStory(progress, true).stride, 0);
  }
});
