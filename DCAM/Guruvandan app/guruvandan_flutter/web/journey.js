import { CHAPTERS, sampleStory, clamp, smooth, interval } from './story-timeline.mjs';

if (document.documentElement.classList.contains('story-home')) {
  const root = document.documentElement;
  const film = document.getElementById('journey');
  const stage = document.querySelector('.film-stage');
  const canvas = document.getElementById('story-canvas');
  const title = document.getElementById('film-title');
  const copy = document.getElementById('film-copy');
  const eyebrow = document.getElementById('film-eyebrow');
  const instruction = document.getElementById('film-instruction');
  const downloads = document.getElementById('film-downloads');
  const scrubber = document.getElementById('film-scrubber');
  const loading = document.getElementById('film-loading');
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  const menu = document.getElementById('journey-menu');
  const menuButton = document.querySelector('.journey-menu-toggle');
  let scene;
  let framePending = false;
  let currentProgress = 0;
  let lastRenderedProgress = -1;
  let lastChapter = -2;

  function closeMenu() {
    menu.classList.remove('is-open');
    menuButton.setAttribute('aria-expanded', 'false');
  }
  menuButton.addEventListener('click', () => menuButton.setAttribute('aria-expanded', String(menu.classList.toggle('is-open'))));
  menu.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.classList.contains('is-open')) { closeMenu(); menuButton.focus(); }
  });
  root.classList.add('journey-menu-ready');

  function scrollToProgress(progress) {
    const top = film.getBoundingClientRect().top + window.scrollY;
    const distance = film.offsetHeight - stage.offsetHeight;
    window.scrollTo({ top: top + clamp(progress) * distance, behavior: 'instant' });
  }
  document.querySelectorAll('[data-story-progress]').forEach(button => {
    button.addEventListener('click', () => scrollToProgress(Number(button.dataset.storyProgress)));
  });
  scrubber.addEventListener('input', () => scrollToProgress(Number(scrubber.value) / 1800));

  function updateCaptions(sample) {
    const chapter = CHAPTERS[sample.chapter];
    const opening = sample.progress < 0.028;
    const captionIndex = opening ? -1 : sample.chapter;
    if (captionIndex !== lastChapter) {
      lastChapter = captionIndex;
      title.replaceChildren();
      const lines = opening ? ['A life turned', 'towards the light.'] : chapter.title.split('\n');
      title.append(document.createTextNode(lines[0]), document.createElement('br'));
      const emphasis = document.createElement('em');
      emphasis.textContent = lines[1];
      title.append(emphasis);
      eyebrow.textContent = opening ? 'GURU VANDAN · A JOURNEY INWARD' : String(sample.chapter + 1).padStart(2, '0') + ' / ' + chapter.hindi + ' · ' + chapter.label.toUpperCase();
      copy.textContent = opening ? 'An animated journey inspired by the spirit of Maharshi Mehi Paramhans Ji Maharaj.' : chapter.copy;
      instruction.textContent = opening ? '↓ Scroll to bring the journey to life.' : '↓ Scroll to move. Stop to hold this moment.';
      document.getElementById('film-place').textContent = opening ? 'A FICTIONAL MONK · INSPIRED BY GURUDEV' : chapter.note;
    }
    downloads.hidden = !(sample.chapter === 4 && sample.local > 0.48);
    instruction.hidden = !downloads.hidden;
    document.getElementById('film-chapter-label').textContent = opening ? 'THE JOURNEY AWAITS' : chapter.label.toUpperCase();
    document.getElementById('film-position').textContent = (opening ? '00' : String(sample.chapter + 1).padStart(2, '0')) + ' / 05';
    scrubber.value = String(sample.frame);
    scrubber.setAttribute('aria-valuetext', Math.round(sample.progress * 100) + ' percent: ' + chapter.label);
    document.querySelectorAll('.film-chapters button').forEach((button, index) => {
      if (index === sample.chapter) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    const transition = sample.chapter > 0 ? smooth(interval(sample.local, 0, 0.12)) : 1;
    document.querySelector('.film-heading').style.opacity = String(0.15 + transition * 0.85);
    stage.dataset.progress = sample.progress.toFixed(7);
  }

  function renderProgress(force = false) {
    framePending = false;
    if (!scene) return;
    const bounds = film.getBoundingClientRect();
    currentProgress = clamp(-bounds.top / Math.max(1, film.offsetHeight - stage.offsetHeight));
    if (!force && currentProgress === lastRenderedProgress) return;
    lastRenderedProgress = currentProgress;
    const sample = sampleStory(currentProgress, motionPreference.matches);
    const reducedPoses = [0.06, 0.36, 0.61, 0.8, 0.99];
    scene.render(motionPreference.matches ? sampleStory(reducedPoses[sample.chapter], true) : sample);
    updateCaptions(sample);
  }

  function scheduleRender() {
    if (framePending) return;
    framePending = true;
    requestAnimationFrame(() => renderProgress());
  }

  function resizeScene() {
    if (!scene) return;
    scene.resize(stage.clientWidth, stage.clientHeight);
    renderProgress(true);
  }

  function showFallback(message) {
    root.classList.remove('film-ready', 'film-pending');
    root.classList.add('film-fallback');
    loading.textContent = message;
    loading.hidden = false;
    instruction.textContent = '↓ Scroll to read the journey.';
    instruction.hidden = false;
    document.getElementById('film-fallback-note').textContent = message + ' You can read the complete journey below.';
    scene?.dispose();
    scene = undefined;
  }

  window.addEventListener('scroll', scheduleRender, { passive: true });
  window.addEventListener('resize', resizeScene, { passive: true });
  motionPreference.addEventListener('change', () => {
    root.classList.toggle('film-reduced-motion', motionPreference.matches);
    renderProgress(true);
  });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    showFallback('The animated scene is unavailable on this device.');
  });
  window.addEventListener('pagehide', () => scene?.dispose(), { once: true });
  window.addEventListener('pageshow', event => { if (event.persisted) window.location.reload(); });
  root.classList.toggle('film-reduced-motion', motionPreference.matches);

  try {
    const { createStoryScene } = await import('./story-scene.js?v=2');
    scene = createStoryScene(canvas, () => { if (scene) renderProgress(true); });
    root.classList.add('film-ready');
    root.classList.remove('film-pending');
    loading.hidden = true;
    resizeScene();
  } catch (error) {
    console.error('Guru Vandan story could not start:', error);
    showFallback('Your browser could not load the 3D journey.');
  }
}
