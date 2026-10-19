import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { film } from '../web/cinema/manifest.mjs';

const [clipId, input] = process.argv.slice(2);
if (!film.clips.some(clip => clip.id === clipId) || !input || !fs.existsSync(input)) {
  console.error('Usage: node tool/prepare_cinema_clip.mjs <seeker|guru|cave|writing|village|lamp> <approved-video-path>');
  process.exit(1);
}
const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
const available = spawnSync(ffmpeg, ['-version'], { encoding: 'utf8', windowsHide: true });
if (available.error || available.status !== 0) {
  console.error('FFmpeg is required. Set FFMPEG_PATH to its executable. No media has been changed.');
  process.exit(1);
}
const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = `${clipId}-${Date.now()}`;
const output = path.join(workspace, 'web', 'cinema', 'frames', version);
fs.mkdirSync(output, { recursive: true });
const result = spawnSync(ffmpeg, ['-nostdin', '-n', '-i', path.resolve(input), '-an', '-vf', 'fps=24,scale=1280:-2', '-q:v', '3', '-start_number', '0', path.join(output, '%05d.jpg')], { stdio: 'inherit', windowsHide: true });
if (result.error || result.status !== 0) {
  console.error(`Frame export failed. Partial output retained at ${output}; do not use it in the film.`);
  process.exit(1);
}
const frames = fs.readdirSync(output).filter(name => /^\d{5}\.jpg$/.test(name)).sort();
if (frames.length < 2 || frames.some((name, index) => name !== `${String(index).padStart(5, '0')}.jpg`)) {
  console.error('Export did not produce a complete moving sequence.');
  process.exit(1);
}
const sequence = { count: frames.length, pattern: `/cinema/frames/${version}/{frame}.jpg` };
const metadata = { id: clipId, duration: frames.length / 24, fps: 24, sequence };
fs.writeFileSync(path.join(output, 'sequence.json'), JSON.stringify(metadata, null, 2) + '\n');
console.log(JSON.stringify(metadata, null, 2));
console.log('Review every shot before copying duration and sequence into web/cinema/manifest.mjs. This command does not deploy or edit the app.');
