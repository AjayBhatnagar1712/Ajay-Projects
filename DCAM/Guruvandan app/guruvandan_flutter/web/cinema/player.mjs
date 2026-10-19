import { film } from './manifest.mjs';
import { compileFilm, sampleFilm, chapterProgress, coverRect, frameUrl, clamp } from './timeline.mjs';
import { FrameStore } from './frame-store.mjs';

const timeline = compileFilm(film);
const canvas = document.querySelector('#cinema-canvas');
const context = canvas.getContext('2d', { alpha: false });
const journey = document.querySelector('#cinema-journey');
const stage = document.querySelector('.cinema-stage');
const scrubber = document.querySelector('#cinema-scrubber');
const chapterLabel = document.querySelector('#cinema-chapter');
const progressLabel = document.querySelector('#cinema-position');
const status = document.querySelector('#cinema-status');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const store = new FrameStore({ maxEntries: 8, maxBytes: 48 * 1024 * 1024 });
const failedClips = new Set();
const events = new AbortController();
let pendingFrame = 0;
let generation = 0;
let previousProgress = 0;
let currentProgress = 0;
let lastSignature = '';
let lastSize = '';
let painted = 0;

document.documentElement.dataset.filmStatus = film.status;
document.documentElement.classList.add('cinema-enabled');

function scrollProgress() {
  return clamp(-journey.getBoundingClientRect().top / Math.max(1, journey.offsetHeight - stage.offsetHeight));
}

function goTo(progress) {
  window.scrollTo({ top: window.scrollY + journey.getBoundingClientRect().top + clamp(progress) * (journey.offsetHeight - stage.offsetHeight), behavior: 'instant' });
}

function updateControls(sample) {
  scrubber.value = String(Math.round(sample.progress * Number(scrubber.max)));
  const clip = timeline.clips[sample.chapter];
  scrubber.setAttribute('aria-valuetext', `${clip.title}, ${Math.round(sample.progress * 100)} percent`);
  chapterLabel.textContent = clip.title;
  progressLabel.textContent = `${String(sample.chapter + 1).padStart(2, '0')} / ${String(timeline.clips.length).padStart(2, '0')}`;
  canvas.setAttribute('aria-label', clip.description);
  document.querySelectorAll('[data-chapter]').forEach(button => {
    if (Number(button.dataset.chapter) === sample.chapter) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  });
  document.querySelector('.scroll-invitation').hidden = sample.progress > 0.025;
}

async function paint(progress, force = false) {
  const sample = sampleFilm(timeline, progress, motion.matches);
  updateControls(sample);
  const layers = sample.layers.filter(layer => layer.opacity > 0).map(layer => failedClips.has(layer.clip.id) ? { ...layer, url: layer.clip.poster, frame: 0 } : layer);
  const bounds = stage.getBoundingClientRect();
  const ratio = Math.min(devicePixelRatio || 1, 1.5, 1920 / Math.max(1, bounds.width));
  const width = Math.max(1, Math.round(bounds.width * ratio));
  const height = Math.max(1, Math.round(bounds.height * ratio));
  const size = `${width}:${height}`;
  const signature = JSON.stringify(layers.map(layer => [layer.url, layer.opacity]));
  if (!force && signature === lastSignature && size === lastSize) return;
  lastSignature = signature;
  lastSize = size;
  const requestGeneration = ++generation;
  store.retain(layers.map(layer => layer.url));
  stage.setAttribute('aria-busy', 'true');
  try {
    const frames = await Promise.all(layers.map(layer => store.get(layer.url)));
    if (requestGeneration !== generation) return;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    context.globalAlpha = 1;
    context.fillStyle = '#090e10';
    context.fillRect(0, 0, width, height);
    layers.forEach((layer, index) => {
      const image = frames[index];
      const rectangle = coverRect(image.width, image.height, width, height, layer.clip.focus);
      context.globalAlpha = layer.opacity;
      context.drawImage(image, rectangle.left, rectangle.top, rectangle.width, rectangle.height);
    });
    context.globalAlpha = 1;
    canvas.dataset.frame = layers.map(layer => `${layer.clip.id}:${layer.frame}`).join('|');
    canvas.dataset.paintCount = String(++painted);
    canvas.dataset.media = layers.every(layer => layer.clip.sequence && !failedClips.has(layer.clip.id)) ? 'footage' : 'keyframe';
    document.documentElement.classList.add('cinema-painted');
    document.documentElement.classList.remove('cinema-media-error');
    status.textContent = '';
    const direction = progress >= previousProgress ? 1 : -1;
    if (!motion.matches && !navigator.connection?.saveData) {
      const ahead = layers.flatMap(layer => layer.clip.sequence && !failedClips.has(layer.clip.id)
        ? [1, 2].map(offset => frameUrl(layer.clip, layer.frame + offset * direction)) : []);
      store.retain([...layers.map(layer => layer.url), ...ahead]);
      for (const url of new Set(ahead)) store.get(url).catch(() => {});
    }
    previousProgress = progress;
  } catch {
    if (requestGeneration !== generation) return;
    const missing = layers.filter(layer => layer.url !== layer.clip.poster);
    if (missing.length) {
      missing.forEach(layer => failedClips.add(layer.clip.id));
      lastSignature = '';
      schedule(true);
    } else {
      lastSignature = '';
      status.textContent = 'The scene could not be loaded. Check your connection or continue to Guru Vandan below.';
      document.documentElement.classList.add('cinema-media-error');
    }
  } finally {
    if (requestGeneration === generation) stage.setAttribute('aria-busy', 'false');
  }
}

let forceNextPaint = false;
function schedule(force = false) {
  forceNextPaint ||= force;
  if (pendingFrame) return;
  pendingFrame = requestAnimationFrame(() => {
    pendingFrame = 0;
    currentProgress = scrollProgress();
    const force = forceNextPaint;
    forceNextPaint = false;
    paint(currentProgress, force);
  });
}

scrubber.addEventListener('input', () => goTo(Number(scrubber.value) / Number(scrubber.max)), { signal: events.signal });
document.querySelectorAll('[data-chapter]').forEach(button => {
  button.addEventListener('click', () => goTo(chapterProgress(timeline, Number(button.dataset.chapter))), { signal: events.signal });
});
document.querySelector('#cinema-restart').addEventListener('click', () => goTo(0), { signal: events.signal });
window.addEventListener('scroll', () => schedule(), { passive: true, signal: events.signal });
window.addEventListener('resize', () => schedule(true), { signal: events.signal });
window.addEventListener('pageshow', () => schedule(true), { signal: events.signal });
motion.addEventListener('change', () => schedule(true), { signal: events.signal });
window.addEventListener('pagehide', event => {
  if (event.persisted) return;
  generation += 1;
  cancelAnimationFrame(pendingFrame);
  events.abort();
  store.dispose();
});
schedule(true);
