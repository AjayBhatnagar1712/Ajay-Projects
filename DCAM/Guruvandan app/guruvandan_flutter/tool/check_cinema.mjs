import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { film } from '../web/cinema/manifest.mjs';
import { compileFilm, frameUrl } from '../web/cinema/timeline.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../web');
const production = process.argv.includes('--production');
const timeline = compileFilm(film);
const problems = [];
function checkAsset(url) {
  const filename = path.resolve(root, url.replace(/^\/+/, ''));
  if (!filename.startsWith(root + path.sep) || !fs.existsSync(filename) || !fs.statSync(filename).isFile()) problems.push(`Missing local asset: ${url}`);
}
for (const clip of timeline.clips) {
  checkAsset(clip.poster);
  if (clip.sequence) {
    for (let frame = 0; frame < clip.sequence.count; frame += 1) checkAsset(frameUrl(clip, frame));
  } else if (production) {
    problems.push(`${clip.id}: moving footage is not ready.`);
  }
}
if (production && film.status !== 'production-ready') problems.push('The film is an art-direction preview, not an approved production release.');
if (problems.length) {
  console.error(problems.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Cinema ${production ? 'production' : 'preview'} assets checked: ${timeline.clips.length} scenes.`);
}
