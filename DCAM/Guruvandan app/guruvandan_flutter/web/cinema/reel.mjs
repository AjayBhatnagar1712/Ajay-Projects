export const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
export const ease = value => { const amount = clamp(value); return amount * amount * (3 - 2 * amount); };

export function compileReel(shots, overlap = 0.65) {
  if (!Array.isArray(shots) || !shots.length) throw new Error('The reel needs shots.');
  const ids = new Set();
  let cursor = 0;
  const clips = shots.map((shot, index) => {
    if (!shot.id || ids.has(shot.id) || !Number.isFinite(shot.duration) || shot.duration <= overlap || !shot.src || !shot.poster) throw new Error('Invalid shot.');
    ids.add(shot.id);
    const clip = {...shot, index, begin: cursor, finish: cursor + shot.duration};
    cursor = clip.finish - (index < shots.length - 1 ? overlap : 0);
    return clip;
  });
  return {clips, duration: cursor, overlap};
}

export function frameTime(time, duration, fps = 24) {
  return Math.floor(clamp(time, 0, Math.max(0, duration - 1 / fps)) * fps + 0.00001) / fps;
}

export function sampleReel(reel, progress) {
  const time = clamp(progress) * reel.duration;
  const visible = reel.clips.filter(clip => time >= clip.begin && time <= clip.finish);
  if (!visible.length) visible.push(reel.clips.at(-1));
  const layers = visible.map((clip, index) => ({clip, time: frameTime(time - clip.begin, clip.duration, clip.fps), opacity: index === 0 ? 1 : ease((time - clip.begin) / reel.overlap)}));
  const current = layers.length > 1 && layers[1].opacity >= 0.5 ? layers[1] : layers[0];
  return {time, layers, current, progress: clamp(progress)};
}

export function sceneGeometry(sourceWidth, sourceHeight, width, height, focus = 0.5, portraitFit = 'cover') {
  const portrait = width / height < 0.9;
  const scale = portrait
    ? portraitFit === 'contain' ? Math.min(width / sourceWidth, height * 0.6 / sourceHeight) : Math.max(width / sourceWidth, height * 0.6 / sourceHeight)
    : Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  return {x: (width - drawWidth) * (portrait && portraitFit === 'contain' ? 0.5 : clamp(focus)), y: (height - drawHeight) * (portrait ? 0.36 : 0.5), width: drawWidth, height: drawHeight};
}

export function neighbors(reel, sample, saveData = false) {
  const indices = new Set(sample.layers.map(layer => layer.clip.index));
  if (!saveData) {
    indices.add(Math.min(reel.clips.length - 1, sample.current.clip.index + 1));
    if (indices.size < 3) indices.add(Math.max(0, sample.current.clip.index - 1));
  }
  return [...indices];
}
