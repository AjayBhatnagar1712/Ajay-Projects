import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const shots = JSON.parse(await readFile(join(directory, 'shots.json'), 'utf8'));
const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const identifiers = new Set();
await mkdir(join(directory, 'prompts'), { recursive: true });

for (const shot of shots) {
  if (identifiers.has(shot.id) || !shot.prompt || !shot.image || !shot.output) throw new Error(`Invalid shot ${shot.id}`);
  identifiers.add(shot.id);
  await access(join(directory, 'images', shot.image));
  await writeFile(join(directory, 'prompts', `${shot.id}.txt`), `${shot.prompt}\n`, 'utf8');
}

if (shots.filter(shot => !shot.optional).length !== 18 || shots.filter(shot => shot.optional).length !== 1) throw new Error('Expected 18 core shots and one optional shot');

const cards = shots.map(shot => `<article class="shot ${shot.pilot ? 'pilot' : ''}" id="shot-${escapeHtml(shot.id)}">
  <a class="image-link" href="images/${escapeHtml(shot.image)}" target="_blank" rel="noopener"><img src="images/${escapeHtml(shot.image)}" alt="Reference image for ${escapeHtml(shot.title)}" width="1672" height="941" loading="lazy" decoding="async"></a>
  <div class="shot-body">
    <div class="eyebrow">${escapeHtml(shot.act)}${shot.pilot ? '<span class="badge">Generate this first</span>' : ''}</div>
    <h2><span class="number">${escapeHtml(shot.id)}</span> ${escapeHtml(shot.title)}</h2>
    <p class="filename">Upload <strong>${escapeHtml(shot.image)}</strong></p>
    <div class="actions"><a class="button" href="images/${escapeHtml(shot.image)}" download>Download image</a><button type="button" class="button primary" data-copy="${escapeHtml(shot.id)}">Copy prompt ${escapeHtml(shot.id)}</button></div>
    <details><summary>Read the exact video prompt</summary><textarea id="prompt-${escapeHtml(shot.id)}" aria-label="Video prompt ${escapeHtml(shot.id)}" readonly spellcheck="false">${escapeHtml(shot.prompt)}</textarea><a href="prompts/${escapeHtml(shot.id)}.txt" download>Download prompt text</a></details>
    <p class="edit"><strong>Continuity / edit:</strong> ${escapeHtml(shot.transition)}</p>
    <p class="note">${escapeHtml(shot.note)}</p>
    <p class="output">Save as <code>${escapeHtml(shot.output)}</code></p>
  </div>
</article>`).join('\n');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>Guru Vandan · Gemini Film Kit</title>
<style>
:root{color-scheme:dark;--bg:#101b1a;--panel:#172321;--line:#34443e;--ink:#f5efe1;--muted:#c2c9bd;--gold:#e4c07a;--deep:#13201b}
*{box-sizing:border-box}html{scroll-behavior:auto}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.65 system-ui,-apple-system,Segoe UI,sans-serif}a{color:var(--gold);text-underline-offset:4px}button,a{touch-action:manipulation}button{font:inherit}a:focus-visible,button:focus-visible,summary:focus-visible,textarea:focus-visible{outline:3px solid var(--gold);outline-offset:4px}header{border-bottom:1px solid var(--line);padding:19px max(24px,calc((100vw - 1260px)/2));display:flex;justify-content:space-between;gap:20px;align-items:center;flex-wrap:wrap}.brand{font-family:Georgia,serif;font-size:24px;letter-spacing:.03em}.header-note{color:var(--muted);font-size:12px;letter-spacing:.13em;text-transform:uppercase}main{max-width:1308px;margin:auto;padding:0 24px 72px}.hero{padding:70px 0 36px;max-width:930px}.eyebrow{text-transform:uppercase;letter-spacing:.13em;font-size:11px;color:var(--gold);font-weight:650}.hero h1{font:clamp(42px,6vw,78px)/1.08 Georgia,serif;letter-spacing:-.03em;margin:18px 0 25px}.intro{font-size:19px;color:var(--muted);max-width:790px}.stats{display:flex;gap:30px;flex-wrap:wrap;margin-top:29px}.stats strong{font-size:25px;font-weight:500;display:block;color:var(--ink)}.stats span{font-size:13px;color:var(--muted)}.setup{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:20px 0 30px}.box{border:1px solid var(--line);border-radius:16px;padding:24px;background:var(--panel)}.box h2{font:26px Georgia,serif;margin:0 0 15px}.box ol,.box ul{padding-left:23px;margin:0}.box li{margin:8px 0;color:var(--muted)}.box strong{color:var(--ink)}.flow{padding:20px 0;font:clamp(21px,3vw,30px)/1.4 Georgia,serif;color:var(--gold)}.navigation{display:flex;flex-wrap:wrap;gap:8px;margin:22px 0 32px}.navigation a{min-width:42px;text-align:center;padding:8px 13px;border:1px solid var(--line);border-radius:8px;text-decoration:none}.navigation a:hover{background:var(--panel)}.navigation .pilot-link{background:var(--gold);color:var(--deep);font-weight:700}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:28px;align-items:start}.shot{border:1px solid var(--line);background:var(--panel);border-radius:17px;overflow:hidden;scroll-margin-top:24px}.shot.pilot{border-color:var(--gold)}.image-link{display:block;background:#080f0e}.shot img{display:block;width:100%;height:auto;aspect-ratio:16/9;object-fit:contain}.shot-body{padding:24px}.shot h2{font:26px/1.28 Georgia,serif;letter-spacing:-.02em;margin:14px 0 17px}.number{color:var(--gold);font:14px system-ui,sans-serif;padding-right:8px}.badge{display:inline-block;border:1px solid var(--gold);border-radius:99px;padding:3px 8px;margin-left:10px;letter-spacing:.02em}.filename{font-size:13px;color:var(--muted);overflow-wrap:anywhere}.filename strong{font-weight:500;color:var(--ink)}.actions{display:flex;gap:10px;flex-wrap:wrap;margin:19px 0}.button{display:inline-flex;align-items:center;justify-content:center;min-height:44px;cursor:pointer;padding:9px 16px;border:1px solid #7a8776;border-radius:9px;background:transparent;color:var(--ink);font-size:13px;font-weight:650;text-decoration:none}.button.primary{background:var(--gold);border-color:var(--gold);color:#15201b}.button:hover{filter:brightness(1.1)}details{border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:15px 0;font-size:14px}summary{cursor:pointer;color:var(--ink)}textarea{width:100%;min-height:290px;margin:16px 0 8px;resize:vertical;border:1px solid var(--line);border-radius:7px;padding:15px;color:var(--ink);background:#0f1918;font:14px/1.65 system-ui,sans-serif}.edit{font-size:14px;color:var(--muted);margin-top:20px}.edit strong{color:var(--ink)}.note{font-size:13px;color:#b2bdad}.output{border-top:1px solid var(--line);padding-top:14px;margin-bottom:0;font-size:12px;color:var(--muted)}code{color:var(--gold);overflow-wrap:anywhere}footer{border-top:1px solid var(--line);padding:30px 0 0;margin-top:40px;color:var(--muted);font-size:13px}footer p{max-width:1000px}.links{display:flex;gap:22px;flex-wrap:wrap}.status{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:5;border:1px solid var(--gold);border-radius:10px;padding:13px 20px;background:#25372d;color:var(--ink);box-shadow:0 10px 30px #0006;max-width:calc(100vw - 32px);font-size:14px}.status:empty{display:none}@media(max-width:760px){.grid,.setup{grid-template-columns:1fr}.hero{padding-top:40px}.hero h1{font-size:45px}.intro{font-size:17px}main{padding-inline:16px}.shot-body{padding:20px}header{padding:16px}.header-note{font-size:10px}.stats{gap:22px}.flow{font-size:24px}}@media print{body{background:white;color:#18211e}.grid{display:block}.shot{break-inside:avoid;margin-bottom:28px}.status,.actions,.navigation{display:none}details{display:block}textarea{height:auto;color:black;background:white}.note,.edit,.filename{color:#333}}
</style>
</head>
<body>
<header><span class="brand">Guru Vandan</span><span class="header-note">Shanti / Gemini production kit / 27 Sep 2026</span></header>
<main>
<section class="hero"><div class="eyebrow">Images ready. Prompts paired. One journey.</div><h1>Give the story<br>its movement.</h1><p class="intro">A scene-by-scene kit for your Gemini video generator. The monk stays back-facing, the motion stays human, and each shot has a place in one continuous top-to-bottom scroll.</p><div class="stats"><div><strong>18</strong><span>core video prompts</span></div><div><strong>+ 1</strong><span>optional mountain scene</span></div><div><strong>16:9</strong><span>landscape source images</span></div><div><strong>~8 sec</strong><span>target per take, if supported</span></div></div></section>
<section class="setup" aria-label="How to use this kit">
<div class="box"><h2>Start with just one scene.</h2><ol><li><strong>Generate 14 first:</strong> download its image and copy its prompt.</li><li>In Gemini, open video creation and upload <strong>only that image</strong>.</li><li>Paste the copied prompt. Select landscape and 1080p if offered; otherwise keep the supported settings.</li><li>Download the <strong>original MP4</strong>, use the specified filename, and send it back for review.</li></ol><p><a class="button primary" href="#shot-14">Go to the village pilot ↓</a></p></div>
<div class="box"><h2>Smoothness is a production step.</h2><ul><li>These are <strong>reference images, not completed videos</strong>.</li><li>Use gentle motion, real foot contact, consistent hair and robes. No fast cuts or face reveals.</li><li>For <strong>05 → 06</strong> and <strong>11 → 12</strong>, a clean last frame from the preceding approved clip gives better continuity than the supplied fallback.</li><li>Don't generate every scene yet. Website decoding, transitions and mobile performance need a pilot test first.</li></ul></div>
</section>
<div class="flow">Scroll down → advance. Stop → hold. Scroll up → reverse.</div>
<p class="intro">This is the intended website behavior—not an instruction to put a scrollbar inside the generated video. Camera movement can go sideways or vertically while the visitor always scrolls down the page.</p>
<nav class="navigation" aria-label="Scene index">${shots.map(shot=>`<a class="${shot.pilot?'pilot-link':''}" href="#shot-${escapeHtml(shot.id)}">${escapeHtml(shot.id)}</a>`).join('')}</nav>
<section class="grid" aria-label="Images and exact prompts">${cards}</section>
<footer><div class="links"><a href="README.md">Full workflow, pickups &amp; smooth-scroll requirements</a><a href="SOURCES.md">Sources &amp; media credits</a><a href="IMAGE_PROMPTS.md">Still-image creation prompts</a><a href="shots.json">All video prompts as JSON</a></div><p><strong>Gemini interface note:</strong> Google's current help calls its video generator Gemini Omni. If your interface still says Veo, use the available video mode; this kit does not assume API-only settings. <a href="https://support.google.com/gemini/answer/16126339?hl=en" target="_blank" rel="noopener">Official Gemini instructions</a> · <a href="https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/video/best-practice" target="_blank" rel="noopener">Google's prompting guidance</a>.</p><p><strong>Samadhi credit:</strong> Kuppaghat Ashram photograph by <a href="https://commons.wikimedia.org/wiki/File:Kuppaghat_Ashram.jpg" target="_blank" rel="noopener">Praveshksingh</a>, <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener">CC BY-SA 3.0</a>; AI-adapted for dawn lighting and framing. Preserve this credit and adaptation license in resulting public media. The original reference is included in the kit. This is not a new documentary photograph.</p><p>No videos have been generated by this kit. No changes to the live website or mobile app are included.</p></footer>
</main>
<div class="status" role="status" aria-live="polite"></div>
<script>
const statusElement = document.querySelector('.status');
let messageTimer;
for (const button of document.querySelectorAll('[data-copy]')) {
  button.addEventListener('click', async () => {
    const prompt = document.getElementById('prompt-' + button.dataset.copy);
    try {
      await navigator.clipboard.writeText(prompt.value);
      statusElement.textContent = 'Prompt ' + button.dataset.copy + ' copied. Upload only its matching image in Gemini.';
    } catch {
      prompt.closest('details').open = true;
      prompt.focus();
      prompt.select();
      statusElement.textContent = 'Prompt selected. Press Ctrl+C or Command+C to copy.';
    }
    clearTimeout(messageTimer);
    messageTimer = setTimeout(() => { statusElement.textContent = ''; }, 6500);
  });
}
</script>
</body></html>`;

await writeFile(join(directory, 'index.html'), html, 'utf8');
console.log(`Built guide: ${shots.length} matched images, ${shots.length} prompt files; no video generation or deployment.`);
