import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const directory = path.dirname(fileURLToPath(import.meta.url));
const shots = JSON.parse(await readFile(path.join(directory, 'shots.json'), 'utf8'));
const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
await mkdir(path.join(directory, 'video-prompts'), { recursive: true });
for (const shot of shots) {
  await writeFile(path.join(directory, 'video-prompts', `${shot.slug}.txt`), `${shot.prompt}\n`, 'utf8');
}

const cards = shots.map(shot => `<article class="shot" id="scene-${shot.id}" aria-labelledby="title-${shot.id}">
  <div class="shot-top"><span class="scene-number">${shot.id}</span><span>${escapeHtml(shot.chapter)}</span><span class="ready">NEW REFERENCE</span></div>
  <a class="image-link" href="images/${shot.image}" target="_blank" rel="noopener" aria-label="Open scene ${shot.id} image at full size"><img src="images/${shot.image}" alt="${escapeHtml(shot.description)}" width="1672" height="941" loading="lazy" decoding="async"><span>View full image ↗</span></a>
  <div class="shot-body">
    <p class="subtitle">${escapeHtml(shot.subtitle)}</p><h2 id="title-${shot.id}">${escapeHtml(shot.title)}</h2>
    <p class="description">${escapeHtml(shot.description)}</p>
    <ul class="checks">${shot.checks.map(check => `<li>${escapeHtml(check)}</li>`).join('')}</ul>
    <p class="upload"><span>UPLOAD THIS IMAGE</span><code>${shot.image}</code></p>
    <div class="actions"><a class="button primary" href="images/${shot.image}" download="${shot.image}">Download image <span aria-hidden="true">↓</span></a><button class="button" type="button" data-copy="${shot.id}">Copy prompt <span aria-hidden="true">↗</span></button></div>
    <details class="prompt-details"><summary>Read / edit the video prompt</summary><label class="sr-only" for="prompt-${shot.id}">Gemini video prompt for scene ${shot.id}</label><textarea id="prompt-${shot.id}" spellcheck="false">${escapeHtml(shot.prompt)}</textarea><p class="note">You can adjust this copy before using the Copy prompt button. Reloading restores the original.</p><a href="video-prompts/${shot.slug}.txt" download>Download original prompt (.txt) ↓</a></details>
    <div class="review"><span class="small-label">BEFORE YOU ACCEPT</span><p>${escapeHtml(shot.review)}</p></div>
    <details class="continuity"><summary>Continuity & optional references</summary><p>${escapeHtml(shot.continuity)}</p>${shot.references.length ? `<p class="note">These explain the character or portrait—not the primary video starting frame. Upload the corrected scene image above first. Add these only if additional references are supported; otherwise they can confuse the framing.</p><div class="references">${shot.references.map(reference => `<a href="references/${reference}" download><img src="references/${reference}" alt="${reference.startsWith('teacher') ? 'Baba Devi Sahab: teacher clothing and physique reference' : 'Original Maharshi Mehi portrait'}" loading="lazy"><span>${reference.startsWith('teacher') ? 'Teacher reference' : 'Original Gurudev photo'} ↓</span></a>`).join('')}</div>` : ''}</details>
    <div class="save"><span>SAVE ORIGINAL MP4 AS</span><code>${shot.output}</code></div>
  </div>
</article>`).join('\n');

const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Guru Vandan · Revised Gemini Film Kit</title><meta name="description" content="Five corrected scene images, paired Gemini motion prompts and download instructions."><link rel="stylesheet" href="kit.css"><script src="kit.js" defer></script></head>
<body>
<a class="skip" href="#scenes">Skip to scene images</a>
<header><a class="brand" href="#top">Guru Vandan<span>THE FILM WORKSHOP</span></a><nav aria-label="Scene navigation">${shots.map(shot => `<a href="#scene-${shot.id}" aria-label="Scene ${shot.id}: ${escapeHtml(shot.title)}">${shot.id}</a>`).join('')}</nav><span class="edition">REVISION KIT / 28 SEP 2026</span></header>
<main id="top">
<section class="hero"><div class="hero-content"><p class="eyebrow">SHANTI · FIVE CAREFULLY REVISED SCENES</p><h1>The same journey.<br>A truer feeling.</h1><p>Corrected images. Matched motion prompts.<br>Ready for your Gemini video generator.</p><a class="hero-link" href="#scenes">Choose a scene <span aria-hidden="true">↓</span></a></div><div class="hero-count"><strong>05</strong><span>IMAGES + PROMPTS</span></div></section>
<section class="workflow" aria-label="Three steps to generate"><div><span class="step">01 / DOWNLOAD</span><h2>Take its image.</h2><p>Download the corrected PNG from a card. Use <strong>one scene at a time</strong>, not the old screenshot or old video.</p></div><div><span class="step">02 / GENERATE</span><h2>Give it movement.</h2><p>Upload that PNG in Gemini video creation. Copy its paired prompt. Use <strong>16:9 landscape</strong> and the highest native quality offered.</p></div><div><span class="step">03 / RETURN</span><h2>Keep the original.</h2><p>Save the original MP4 with the name on its card. Do not send a screen recording or a WhatsApp-compressed copy.</p></div></section>
<div class="production-note"><span class="note-mark" aria-hidden="true">✦</span><p><strong>Start with 06, then 07.</strong> Keep the teacher and room consistent. Request 10 seconds if supported; an 8-second result is also usable. We will measure the actual duration and tune the website’s scroll playback—smoothness is not guaranteed by a prompt alone.</p></div>
<section id="scenes" aria-labelledby="scenes-heading"><div class="section-heading"><div><p class="eyebrow">YOUR FIVE REPLACEMENTS</p><h2 id="scenes-heading">The corrected frames.</h2></div><p>Numbers match the current website’s scenes.<br>Scene 01 is the mountain prologue.</p></div><div class="grid">${cards}</div></section>
<section class="handoff" aria-labelledby="handoff-title"><div><p class="eyebrow">WHEN YOUR CLIPS ARE READY</p><h2 id="handoff-title">Bring the movement back.</h2><p>Save all five original MP4s here, then tell me they are ready:</p><code>D:\\Guruvandan_Videos\\replacements</code></div><div class="handoff-note"><p><strong>Scroll down → advance.<br>Stop scrolling → hold.<br>Scroll up → reverse.</strong></p><p>That behavior belongs in the website, not inside the generated footage. Each clip will be checked and optimized before replacing the live scene.</p></div></section>
<footer><span>Guru Vandan · Images generated with the built-in image tool; videos still to be generated in Gemini.</span><div><a href="IMAGE_PROMPTS.md" download>Image creation prompts ↓</a><a href="README.md" download>Instructions ↓</a></div><p>This local kit does not change the live website or the app. The older <code>references/*-current-frame.jpg</code> and MP4 files are uncorrected sources, not the images to upload for this workflow.</p></footer>
</main><div class="status" role="status" aria-live="polite"></div>
</body></html>`;
await writeFile(path.join(directory, 'index.html'), html, 'utf8');
console.log(`Built visual kit: ${shots.length} corrected-image cards and ${shots.length} motion prompts.`);
