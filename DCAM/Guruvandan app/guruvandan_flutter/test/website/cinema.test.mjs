import test from 'node:test';
import assert from 'node:assert/strict';
import { film } from '../../web/cinema/manifest.mjs';
import { compileFilm, sampleFilm, chapterProgress, frameUrl, coverRect } from '../../web/cinema/timeline.mjs';
import { FrameStore } from '../../web/cinema/frame-store.mjs';

const animatedFilm = { ...film, clips: film.clips.map(clip => ({ ...clip, sequence: { count: clip.duration * 24, pattern: `/frames/${clip.id}/{frame}.jpg` } })) };
const timeline = compileFilm(animatedFilm);

test('film covers all five acts and lamp, with exact start and end frames', () => {
  assert.equal(timeline.clips.length, 6);
  assert.equal(sampleFilm(timeline, 0).layers[0].frame, 0);
  const final = sampleFilm(timeline, 1).layers[0];
  assert.equal(final.clip.id, 'lamp');
  assert.equal(final.frame, final.clip.sequence.count - 1);
});

test('scroll position completely determines frames; freeze and reverse have no clock', () => {
  const forward = Array.from({ length: 12001 }, (_, index) => sampleFilm(timeline, index / 12000));
  for (let index = forward.length - 1; index >= 0; index -= 1) {
    assert.deepEqual(sampleFilm(timeline, index / 12000), forward[index]);
  }
  for (let count = 0; count < 30; count += 1) assert.deepEqual(sampleFilm(timeline, 0.537), sampleFilm(timeline, 0.537));
});

test('invalid progress and every intermediate sample are bounded', () => {
  for (const progress of [NaN, Infinity, -2, 3, ...Array.from({ length: 1801 }, (_, index) => index / 1800)]) {
    const sample = sampleFilm(timeline, progress);
    assert.ok(Number.isFinite(sample.time));
    assert.ok(sample.layers.length >= 1 && sample.layers.length <= 2);
    for (const layer of sample.layers) {
      assert.ok(layer.opacity >= 0 && layer.opacity <= 1);
      assert.ok(layer.frame >= 0 && layer.frame < layer.clip.sequence.count);
    }
  }
});

test('overlap advances both shots without resetting the incoming motion', () => {
  for (const clip of timeline.clips.slice(1)) {
    const start = sampleFilm(timeline, (clip.start + 0.0001) / timeline.duration);
    assert.equal(start.layers.length, 2);
    assert.ok(start.layers[1].opacity < 0.001);
    const before = sampleFilm(timeline, (clip.start + timeline.overlap - 0.0001) / timeline.duration);
    const after = sampleFilm(timeline, (clip.start + timeline.overlap + 0.0001) / timeline.duration);
    assert.ok(before.layers[1].opacity > 0.999);
    assert.ok(Math.abs(before.layers.at(-1).frame - after.layers[0].frame) <= 1);
  }
});

test('chapter controls land on the right scene in both motion modes', () => {
  timeline.clips.forEach(clip => {
    const progress = chapterProgress(timeline, clip.index);
    assert.equal(sampleFilm(timeline, progress).chapter, clip.index);
    const reduced = sampleFilm(timeline, progress, true);
    assert.equal(reduced.layers.length, 1);
    assert.equal(reduced.layers[0].url, clip.poster);
    assert.equal(reduced.layers[0].frame, 0);
  });
});

test('artwork stays genuinely static, not a fake animated sequence', () => {
  const artwork = compileFilm(film);
  assert.equal(film.status, 'art-direction-preview');
  for (const clip of artwork.clips) {
    assert.equal(clip.sequence, null);
    const first = sampleFilm(artwork, (clip.start + 3) / artwork.duration);
    const second = sampleFilm(artwork, (clip.start + 5) / artwork.duration);
    assert.deepEqual(first.layers, second.layers);
  }
});

test('frame URLs are padded, clamped, and never missing at the end', () => {
  const clip = timeline.clips[0];
  assert.equal(frameUrl(clip, -5), '/frames/seeker/00000.jpg');
  assert.equal(frameUrl(clip, 4), '/frames/seeker/00004.jpg');
  assert.equal(frameUrl(clip, 999999), '/frames/seeker/00431.jpg');
  assert.equal(frameUrl(film.clips[0], 55), film.clips[0].poster);
});

test('invalid timelines cannot silently produce broken video', () => {
  assert.throws(() => compileFilm({ clips: [] }));
  assert.throws(() => compileFilm({ ...film, overlap: -1 }));
  assert.throws(() => compileFilm({ ...film, clips: [film.clips[0], film.clips[0]] }));
  assert.throws(() => compileFilm({ ...film, clips: [{ ...film.clips[0], duration: 1 }] }));
  assert.throws(() => compileFilm({ ...film, clips: [{ ...film.clips[0], sequence: { count: 1, pattern: 'bad' } }] }));
});

test('mobile cover crop remains within the image and respects subject position', () => {
  const crop = coverRect(1672, 941, 390, 844, [0.47, 0.5]);
  assert.ok(crop.left <= 0 && crop.top <= 0);
  assert.ok(crop.width + crop.left >= 390 && crop.height + crop.top >= 844);
  const desktop = coverRect(1920, 1080, 1920, 1080);
  assert.deepEqual(desktop, { left: 0, top: 0, width: 1920, height: 1080 });
});

test('frame store deduplicates requests and releases unneeded bitmaps', async () => {
  let decodes = 0;
  const closed = [];
  const store = new FrameStore({ maxEntries: 2, decode: async url => {
    decodes += 1;
    return { width: 50, height: 50, close: () => closed.push(url) };
  } });
  store.retain(['first']);
  const original = store.get('first');
  assert.equal(store.get('first'), original);
  await original;
  await store.get('second');
  await store.get('third');
  assert.equal(decodes, 3);
  assert.deepEqual(closed, ['second']);
  assert.equal(store.entries.size, 2);
  store.dispose();
  assert.equal(closed.length, 3);
  await assert.rejects(store.get('first'), /closed/);
});

test('stale asynchronous decoding is aborted and never resurrects old frames', async () => {
  let finish;
  let closed = false;
  const store = new FrameStore({ decode: () => new Promise(resolve => { finish = resolve; }) });
  store.retain(['obsolete']);
  const promise = store.get('obsolete');
  await Promise.resolve();
  store.retain(['new']);
  const rejected = assert.rejects(promise, /superseded/);
  finish({ width: 5, height: 5, close: () => { closed = true; } });
  await rejected;
  assert.equal(closed, true);
  assert.equal(store.entries.size, 0);
});

test('decoded memory is bounded without evicting the displayed frame', async () => {
  const closed = [];
  const store = new FrameStore({ maxBytes: 800, decode: async url => ({ width: 10, height: 10, close: () => closed.push(url) }) });
  store.retain(['visible']);
  await store.get('visible');
  await store.get('old');
  await store.get('next');
  assert.deepEqual(closed, ['old']);
  assert.ok(store.entries.has('visible'));
  store.dispose();
});
