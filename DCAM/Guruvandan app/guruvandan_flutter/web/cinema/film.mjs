import {clamp, compileReel, ease, neighbors, sampleReel, sceneGeometry} from './reel.mjs';
import {VideoPool} from './video-pool.mjs';
import {t, getLanguage} from '../website-language.mjs';

if (document.documentElement.classList.contains('cinema-home')) startFilm().catch(() => {
  document.documentElement.classList.remove('film-ready');
  document.getElementById('film-status').textContent = t('The film could not load. You can still explore Guru Vandan below.');
});

async function startFilm() {
  const root = document.documentElement;
  const node = id => document.getElementById(id);
  const journey = node('film-journey');
  const stage = journey.querySelector('.film-stage');
  const canvas = node('film-canvas');
  const context = canvas.getContext('2d', {alpha:false});
  if (!context) throw new Error('Canvas unavailable');
  const response = await fetch('/cinema/media/v2/manifest.json');
  if (!response.ok) throw new Error('Film unavailable');
  const reel = compileReel(await response.json());
  const saveData = navigator.connection?.saveData === true;
  let reduced = false;
  let pendingFrame = 0;
  let lastSignature = '';
  let disposed = false;
  let activeMoment = 'light';
  const posters = new Map();
  const events = new AbortController();
  const soundtrack = node('site-audio');
  const soundToggle = node('sound-toggle');
  let soundRequested = true;
  soundtrack.preload = 'auto';
  const chapters = ['The calling', 'The restless seeker', 'The inner door', 'Into stillness', 'Wisdom takes form', 'A river of seekers', 'The journey is yours'];
  const numerals = ['PROLOGUE', 'ACT I', 'ACT II', 'ACT III', 'ACT IV', 'ACT V', 'GURU VANDAN'];
  const pool = new VideoPool(node('film-decoders'), schedule, matchMedia('(max-width: 760px)').matches || saveData);
  const listen = (target, name, handler, options = {}) => target.addEventListener(name, handler, {...options, signal:events.signal});

  function schedule() {
    if (!disposed && !pendingFrame) pendingFrame = requestAnimationFrame(paint);
  }

  function progress() {
    return clamp(-journey.getBoundingClientRect().top / Math.max(1, journey.offsetHeight - stage.offsetHeight));
  }

  function goTo(value) {
    const start = journey.getBoundingClientRect().top + scrollY;
    window.scrollTo({top:start + clamp(value) * (journey.offsetHeight - stage.offsetHeight), behavior:'instant'});
    schedule();
  }

  function getPoster(clip) {
    if (posters.has(clip.id)) return posters.get(clip.id);
    const image = new Image();
    const record = {image, ready:false};
    posters.set(clip.id, record);
    image.onload = () => { record.ready = true; schedule(); };
    image.onerror = () => { record.failed = true; schedule(); };
    image.src = clip.poster;
    return record;
  }

  function updateControls(sample) {
    const clip = sample.current.clip;
    const clipProgress = clamp(sample.current.time / clip.duration);
    node('film-intro').hidden = clip.index !== 0;
    node('film-intro').style.opacity = String(1 - ease((clipProgress - 0.68) / 0.3));
    node('film-caption').hidden = clip.index === 0;
    node('film-caption').style.opacity = String(reduced ? 1 : 1 - 0.7 * ease((clipProgress - 0.4) / 0.4));
    node('scene-title').textContent = t(clip.title);
    node('scene-line').textContent = t(clip.line);
    node('film-count').textContent = `${String(clip.index + 1).padStart(2, '0')} — ${reel.clips.length}`;
    node('film-progress').value = String(Math.round(sample.progress * 10000));
    node('film-progress').setAttribute('aria-valuetext', `${t(clip.title)}, ${Math.round(sample.progress * 100)} ${getLanguage() === 'hi' ? 'प्रतिशत' : 'percent'}`);
    node('film-progress').style.setProperty('--progress', `${sample.progress * 100}%`);
    canvas.setAttribute('aria-label', `${t(clip.title)}. ${t(clip.line)}`);
    canvas.dataset.scene = clip.id;
    canvas.dataset.target = sample.current.time.toFixed(3);
    canvas.dataset.progress = sample.progress.toFixed(5);
    const moment = clip.act === 3 ? 'stillness' : clip.act === 4 ? 'teaching' : 'light';
    activeMoment = moment;
    node('moment-open').hidden = clip.act < 2;
    node('moment-label').textContent = t({light:'Carry a light',stillness:'A moment of stillness',teaching:'A teaching to keep'}[moment]);
    for (const button of node('chapter-list').children) {
      if (Number(button.dataset.act) === clip.act) button.setAttribute('aria-current','step');
      else button.removeAttribute('aria-current');
    }
  }

  function drawScene(image, clip, opacity) {
    const sourceWidth = image.videoWidth || image.naturalWidth || image.width;
    const sourceHeight = image.videoHeight || image.naturalHeight || image.height;
    const geometry = sceneGeometry(sourceWidth, sourceHeight, canvas.width, canvas.height, clip.focus, clip.portraitFit);
    context.save();
    context.globalAlpha = opacity;
    if (canvas.width / canvas.height < 0.9) {
      context.fillStyle = '#0c1316';
      context.fillRect(0,0,canvas.width,canvas.height);
    }
    context.drawImage(image, geometry.x, geometry.y, geometry.width, geometry.height);
    context.restore();
  }

  function paint() {
    pendingFrame = 0;
    if (disposed) return;
    const rect = stage.getBoundingClientRect();
    root.classList.toggle('at-finale',rect.bottom < 150);
    const finale = node('download').getBoundingClientRect();
    root.style.setProperty('--orbit-angle', `${reduced ? 0 : clamp(1 - finale.top / innerHeight, 0, 3) * 30}deg`);
    if (rect.bottom < 0 || document.hidden) return;
    const density = Math.min(devicePixelRatio || 1, 1.5, 1920 / rect.width);
    const width = Math.round(rect.width * density);
    const height = Math.round(rect.height * density);
    if (width !== canvas.width || height !== canvas.height) {
      canvas.width = width;
      canvas.height = height;
      lastSignature = '';
    }
    const sample = sampleReel(reel, progress());
    updateControls(sample);
    const retained = reduced ? [] : neighbors(reel, sample, saveData);
    pool.retain(retained.map(index => reel.clips[index]));
    const layers = reduced ? [{...sample.current, opacity:1, time:0}] : sample.layers;
    const drawings = layers.map(layer => {
      const poster = getPoster(layer.clip);
      const entry = reduced ? null : pool.request(layer.clip, layer.time);
      const decoded = entry && entry.decodedTime >= 0;
      return {...layer, source:decoded ? entry.frame : poster.ready ? poster.image : null, stamp:decoded ? entry.decodedTime.toFixed(3) : 'poster', failed:entry?.failed};
    });
    const needed = new Set([...layers.map(layer => layer.clip.id), ...retained.map(index => reel.clips[index].id)]);
    for (const [id, poster] of posters) if (!needed.has(id)) { poster.image.onload = null; poster.image.onerror = null; posters.delete(id); }
    if (!saveData) for (const index of retained) getPoster(reel.clips[index]);
    node('film-status').textContent = drawings.some(layer => layer.failed) ? t('Still image shown. This video is unavailable.') : '';
    if (drawings.some(layer => !layer.source)) return;
    const signature = `${width}x${height}:${drawings.map(layer => `${layer.clip.id}/${layer.stamp}/${layer.opacity.toFixed(4)}`).join('|')}`;
    if (signature === lastSignature) return;
    context.fillStyle = '#0c1316';
    context.fillRect(0,0,width,height);
    for (const layer of drawings) drawScene(layer.source,layer.clip,layer.opacity);
    lastSignature = signature;
    canvas.dataset.frame = signature;
    canvas.dataset.paintCount = String(Number(canvas.dataset.paintCount || 0) + 1);
    canvas.dataset.media = reduced ? 'still' : drawings.some(layer => layer.stamp !== 'poster') ? 'video' : 'poster';
    root.classList.add('film-painted');
  }

  function updateMotion(preserve = true) {
    const previous = progress();
    root.style.setProperty('--journey-height', reduced ? '900svh' : '1900svh');
    node('motion-toggle').setAttribute('aria-pressed',String(reduced));
    node('motion-toggle').textContent = t(reduced ? 'Still mode ◯' : 'Motion on ◉');
    lastSignature = '';
    if (preserve) goTo(previous);
    schedule();
  }

  function updateSoundControl() {
    const inactive = !soundRequested || soundtrack.muted;
    soundToggle.setAttribute('aria-pressed', String(inactive));
    const label = t(inactive ? 'Play sound' : 'Mute sound');
    soundToggle.setAttribute('aria-label', label);
    soundToggle.title = label;
  }

  async function playSound() {
    soundRequested = true;
    soundtrack.muted = false;
    soundtrack.volume = 0.82;
    updateSoundControl();
    try { await soundtrack.play(); } catch (_) {}
    if (!soundRequested) {
      soundtrack.muted = true;
      soundtrack.pause();
    }
    updateSoundControl();
  }

  function pauseSound() {
    soundRequested = false;
    soundtrack.muted = true;
    soundtrack.pause();
    updateSoundControl();
  }

  for (const [act,title] of chapters.entries()) {
    const clip = reel.clips.find(item => item.act === act);
    if (!clip) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.act = String(act);
    const prefix = document.createElement('span');
    prefix.textContent = t(numerals[act]);
    const label = document.createElement('strong');
    label.textContent = t(title);
    button.append(prefix,label);
    listen(button,'click',() => { node('chapters-dialog').close(); goTo((clip.begin + (act ? reel.overlap : 0)) / reel.duration); });
    node('chapter-list').append(button);
  }
  listen(node('chapters-open'),'click',() => node('chapters-dialog').showModal());
  listen(node('credits-open'),'click',() => node('credits-dialog').showModal());
  listen(node('moment-open'),'click',() => {
    for (const type of ['light','stillness','teaching']) node(`${type}-ritual`).hidden = type !== activeMoment;
    node('moment-title').textContent = t({light:'Turn toward the light.',stillness:'Be here. Just here.',teaching:'A thought to carry.'}[activeMoment]);
    node('moment-dialog').showModal();
  });
  for (const button of document.querySelectorAll('[data-close]')) listen(button,'click',() => button.closest('dialog').close());
  for (const dialog of document.querySelectorAll('.film-dialog')) {
    listen(dialog,'click',event => { if (event.target === dialog) { const bounds = dialog.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close(); } });
    listen(dialog,'close',schedule);
  }
  listen(node('light-seed'),'click',() => {
    const lit = node('light-seed').getAttribute('aria-pressed') !== 'true';
    node('light-seed').setAttribute('aria-pressed',String(lit));
    node('light-response').textContent = t(lit ? 'May this light become kindness in your day.' : 'Touch the light. Carry a quiet intention.');
  });
  listen(node('stillness-button'),'click',() => {
    const present = node('stillness-button').getAttribute('aria-pressed') !== 'true';
    node('stillness-button').setAttribute('aria-pressed',String(present));
    node('stillness-button').textContent = t(present ? 'Nothing to seek. Simply be.' : 'I am here');
    node('stillness-ritual').dataset.present = String(present);
  });
  listen(node('motion-toggle'),'click',() => { reduced = !reduced; updateMotion(); });
  listen(soundToggle,'click',() => soundRequested ? pauseSound() : playSound());
  listen(soundtrack,'play',updateSoundControl);
  listen(soundtrack,'pause',updateSoundControl);
  listen(soundtrack,'ended',pauseSound);
  function resumeRequestedSound(event) {
    if (event.target instanceof Element && event.target.closest('#sound-toggle')) return;
    if (soundRequested && soundtrack.paused) playSound();
  }
  listen(document,'pointerdown',resumeRequestedSound);
  listen(document,'touchend',resumeRequestedSound,{passive:true});
  listen(document,'click',resumeRequestedSound);
  listen(document,'keydown',resumeRequestedSound);
  listen(node('film-progress'),'input',event => goTo(Number(event.target.value) / 10000));
  listen(node('film-restart'),'click',() => goTo(0));
  listen(window,'scroll',schedule,{passive:true});
  listen(window,'resize',schedule,{passive:true});
  listen(window,'pageshow',schedule);
  listen(document,'website-language-change',() => {
    for (const button of node('chapter-list').children) {
      const act = Number(button.dataset.act);
      button.querySelector('span').textContent = t(numerals[act]);
      button.querySelector('strong').textContent = t(chapters[act]);
    }
    node('motion-toggle').textContent = t(reduced ? 'Still mode ◯' : 'Motion on ◉');
    updateSoundControl();
    node('moment-title').textContent = t({light:'Turn toward the light.',stillness:'Be here. Just here.',teaching:'A thought to carry.'}[activeMoment]);
    node('light-response').textContent = t(node('light-seed').getAttribute('aria-pressed') === 'true' ? 'May this light become kindness in your day.' : 'Touch the light. Carry a quiet intention.');
    node('stillness-button').textContent = t(node('stillness-button').getAttribute('aria-pressed') === 'true' ? 'Nothing to seek. Simply be.' : 'I am here');
    updateControls(sampleReel(reel, progress()));
    schedule();
  });
  listen(document,'visibilitychange',schedule);
  listen(window,'pagehide',event => {
    if (event.persisted) return;
    disposed = true;
    events.abort();
    pool.dispose();
    cancelAnimationFrame(pendingFrame);
    posters.clear();
  });
  root.classList.add('film-ready');
  updateMotion(false);
  playSound();
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  schedule();
}
