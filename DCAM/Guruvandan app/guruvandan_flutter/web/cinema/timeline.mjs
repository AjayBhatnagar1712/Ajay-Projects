export const clamp = (value, minimum = 0, maximum = 1) => Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));

export function compileFilm(film) {
  if (!film.clips?.length) throw new Error('The film needs at least one clip.');
  const overlap = Number(film.overlap ?? 0);
  if (!Number.isFinite(overlap) || overlap < 0) throw new Error('Invalid overlap.');
  const identities = new Set();
  let duration = 0;
  const clips = film.clips.map((clip, index) => {
    if (!clip.id || identities.has(clip.id)) throw new Error('Clip ids must be unique.');
    identities.add(clip.id);
    if (!Number.isFinite(clip.duration) || clip.duration <= Math.max(0, overlap * 2)) throw new Error('A clip must be longer than two overlaps.');
    if (!clip.poster) throw new Error('Every clip needs a poster fallback.');
    if (clip.sequence && (!Number.isInteger(clip.sequence.count) || clip.sequence.count < 2 || !clip.sequence.pattern?.includes('{frame}'))) {
      throw new Error('A sequence needs multiple frames and a {frame} URL pattern.');
    }
    const start = index === 0 ? 0 : duration - overlap;
    duration = start + clip.duration;
    return { ...clip, index, start, end: duration };
  });
  return { clips, duration, overlap };
}

export function frameUrl(clip, frame = 0) {
  if (!clip.sequence) return clip.poster;
  const index = Math.round(clamp(frame, 0, clip.sequence.count - 1));
  return clip.sequence.pattern.replace('{frame}', String(index).padStart(5, '0'));
}

export function sampleFilm(timeline, progress, reducedMotion = false) {
  const position = clamp(progress);
  const time = position * timeline.duration;
  const active = timeline.clips.filter(clip => time >= clip.start && time < clip.end);
  if (!active.length) active.push(timeline.clips.at(-1));
  const current = active.at(-1);
  if (reducedMotion) {
    return { progress: position, time, chapter: current.index, layers: [{ clip: current, frame: 0, opacity: 1, url: current.poster }] };
  }
  const blend = active.length > 1 ? clamp((time - current.start) / timeline.overlap) : 1;
  const incomingOpacity = blend * blend * (3 - 2 * blend);
  const layers = active.map((clip, index) => {
    const local = clamp((time - clip.start) / clip.duration);
    const frame = clip.sequence ? Math.min(clip.sequence.count - 1, Math.floor(local * clip.sequence.count)) : 0;
    return { clip, frame, url: frameUrl(clip, frame), opacity: index === 0 ? 1 : incomingOpacity };
  });
  return { progress: position, time, chapter: current.index, layers };
}

export function chapterProgress(timeline, index) {
  const clip = timeline.clips[clamp(Math.trunc(index), 0, timeline.clips.length - 1)];
  return (clip.start + (clip.index > 0 ? timeline.overlap : 0)) / timeline.duration;
}

export function coverRect(imageWidth, imageHeight, width, height, focus = [0.5, 0.5]) {
  const scale = Math.max(width / imageWidth, height / imageHeight);
  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;
  return { left: (width - drawWidth) * clamp(focus[0]), top: (height - drawHeight) * clamp(focus[1]), width: drawWidth, height: drawHeight };
}
