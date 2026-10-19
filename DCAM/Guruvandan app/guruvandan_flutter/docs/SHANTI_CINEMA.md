# Shanti: cinematic website production

## Current state

The replacement is a separate, local art-direction preview at `/cinema/`, not the published homepage. Six generated photographic keyframes establish the child, young adult, mature seeker, elder and lamp. They are still images. They do not yet implement the requested walking, hand, cloth or camera animation. Do not describe the preview as the finished film.

The original user narrative is preserved in `SHANTI_ORIGINAL_NARRATIVE.txt`. Exact built-in image-generation prompts are in `SHANTI_IMAGE_PROMPTS.md`. Working art is in `web/cinema/art/`. No Flutter, Android, iOS or mobile assets were changed. The live site, existing quote pages and shop were not deployed or changed by this cinema work.

The user has chosen to generate source footage manually with Gemini's video generator. `gemini-video-kit/index.html` pairs 18 core prompts and one optional mountain prompt with numbered source images. Start with the village pilot (14) and review real motion before generating the full batch. The kit includes continuity guidance and optional pickups for the complete narrative. No video generation has been submitted by the agent. Any later paid generation still requires showing the proposed cost and obtaining approval first; a Runway upgrade is not required for this user-supplied-video workflow.

The chant and narration have not been recorded or generated. No fake audio toggle is shown. The final footage should not be released until all narrative beats, audio and mobile performance are reviewed.

## Locked art direction

- Lean Indian ascetic, narrow shoulders, simple weathered staff, natural saffron cotton, bare feet, realistic physical weight and cloth.
- Dark loose hair when young, mixed gray when mature, long silver-white hair when old. Same silhouette and body proportions throughout.
- Back views or rear three-quarter views. Hair conceals the eyes and face. Never orbit into a frontal face, including at the end of a shot.
- Warm village dawn, earthy green and ochre; indigo lamp-lit interiors and cave; restrained golden inner light. Natural film texture, not glossy fantasy or procedural geometry.
- No story captions, date titles or prominent disclaimers over the imagery. Site navigation and playback controls are distinct from story text.
- Use the user's narrative as the creative script, not a verified historical record. Generated scenes are not archival footage. This production distinction belongs in internal documentation, not an intrusive story overlay.
- Do not use a slow pan over these stills as a substitute for body animation. Camera movement belongs in the footage; the web renderer does not move a cardboard character across a backdrop.

## Shot plan

Generate and review short shots separately. Do not cram an entire act into one short request. Match lighting, character, screen direction and final/first frames before assembly.

| Shot | Action and transition | Camera and concealment |
| --- | --- | --- |
| 1A | Bihar dawn; boy presses nail into soil, pours water, then folds hands. | Crane gently down from the banyan canopy to the boy's back. No front view. |
| 1B | Leaves sweep toward camera and match-cut to exam papers. The young man sets down his pen. | Move right to left across the desk; stay behind his shoulder. |
| 1C | He rises, bows toward the invigilator and leaves through a bright door. | Follow from behind into white light; voice line one. |
| 2A | Dusty search road; walking through rain, heat and falling leaves. | Lateral left-to-right tracking, natural gait and staff contact. Hair hides profile. |
| 2B | He bows at Baba Devi Sahab's feet; the teacher's hand rests on his head; lamp steadies. | Intimate rear view; slow inward approach. No exposed face for either character. |
| 2C | Lamp becomes indigo darkness, mantra glow, the teacher's silhouette and a still bright point. | Pass through the lamp's glow rather than a face close-up, preserving requested anonymity. |
| 3A | Moonlit Ganga; mature monk enters the vine-covered cave and sits. | Track right-to-left along the river then follow his back into the cave. |
| 3B | Seasons pass outside while the seated monk remains still. | Hold body pose; very slow downward camera approach behind shoulders. |
| 3C | Stars, radiance and expanding sound rings; a soul-point ascends to stillness. | Vertical ascent, no letters or diagram labels; voice line two. |
| 3D | Dawn cave exit. | Camera retreats as he steps into the light, still viewed from behind or hair-obscured profile. |
| 4A | He writes; manuscript pages turn. | Rear-shoulder tracking left; anatomically correct hands and pen. |
| 4B | Ink rises into the stages of the inner path; streams from diverse scriptures converge. | Vertical movement following a small point of light; restrained volumetric effects, not a neon UI. |
| 4C | Satsang Yog and Mokshadarshan settle on a shelf. | Close detail; any legible book typography must be composited accurately, not generated gibberish. |
| 5A | A farmer pauses, mother and child join, the elder follows. | Track backward in front of the group only if monk stays rear-obscured; otherwise side-rear tracking. |
| 5B | Procession becomes a vast meditating satsang and sea of lamps. | Crane up and outward vertically. Avoid cloning visibly identical people. |
| 5C | Seasons to Kuppaghat samadhi at dawn, marigold petals drifting. | A respectful slow descent, no invented building details; obtain an authentic architectural reference before generating. |
| 5D | Present-day disciple holding Guru Vandan places phone down and meditates. | Over shoulder; use a real app screen as a tracked insert, not an invented app interface; voice line three. |
| End | Single steady lamp on black; full spoken line and one final chant cycle. | Fixed camera; the final lamp remains on screen. |

The supplied mountain image establishes atmosphere and is available as a possible connective landscape. It is not inserted as a claim about a particular Himalayan journey. The latest supplied script starts in Bihar.

## Audio production

Use an original recording or approved synthesis, not a cloned voice of Gurudev. Chant: “Bhajo Om Om Prabhu Naam Wahi, Bhajo Om Om Mehi Naam Wahi, Bhajo Om”. Preserve the exact Hindi narration from the supplied file. Review pronunciation of मेँहीँ with the user. Add quiet tanpura, bell and conch only where the script asks for them.

Sound must be opt-in after a user gesture. Narration occurs at act peaks, not continuously retriggered by tiny backward scrolls. The final experience must define whether audio pauses with scrolling or can finish a spoken sentence while the picture stays still, and verify that behavior before release. All motion must stop when scrolling stops. Do not wire autoplay or a perpetual CSS animation as a workaround.

## Implementation

- `web/cinema/manifest.mjs`: honest readiness state, still posters, subject crop focus, per-act duration and eventual frame-sequence URLs. All `sequence` fields are currently null.
- `timeline.mjs`: deterministic scroll-to-frame mapping; incoming and outgoing clips overlap without restarting the incoming shot. No animation clock or inertia.
- `frame-store.mjs`: deduplicated decoding, stale request cancellation, bounded bitmap cache and cleanup. Based on the browser's [createImageBitmap API](https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap).
- `player.mjs`: paints on input only; no autoplay or continuous render loop. Reverse input selects previous frames. No movement is invented inside the still posters. Reduced motion uses one static poster per act. Network failures fall back to that act's poster.
- `index.html` and `style.css`: isolated dark full-screen film preview, unobstructed images, non-overlapping responsive navigation, chapter controls, app links and lamp-to-app ending. Preview is `noindex`.
- `tool/prepare_cinema_clip.mjs`: exports approved footage into 24 fps JPEG sequences without changing source media or the manifest. Requires FFmpeg. Output goes into a new timestamped directory; never overwrites or deletes existing files.
- `tool/check_cinema.mjs --production`: refuses a release while footage is missing or the manifest is still marked as a study. This is a manual preflight, not a Firebase deployment hook.

The poster preview durations are story weights, not generated video runtimes. Replace them with each approved sequence's measured duration. Camera direction changes and character movement must be authored in the footage. Native images alone cannot supply them.

## Local commands

```powershell
$env:PORT = '4174'
node tool/website_preview.cjs
node --test test/website/*.test.mjs
node tool/check_cinema.mjs
```

Open `http://127.0.0.1:4174/cinema/`. The preview server is bound to loopback. It uses existing `build/web` assets only as fallback for the unchanged brand logo and shop/legal pages.

After video approval:

```powershell
$env:FFMPEG_PATH = 'C:\path\to\ffmpeg.exe'
node tool/prepare_cinema_clip.mjs seeker 'C:\path\to\approved-seeker.mp4'
```

Review all exported frames. Copy the reported `duration` and `sequence` into the corresponding manifest entry. Recheck full-face exposure, hands, staff contact, repeated villagers, wardrobe continuity, reversed playback and mobile crops. A failed export is retained for diagnosis, never automatically used.

## Validation and remaining release work

- 18 website tests pass (12 new cinema tests, 6 earlier procedural scene tests).
- The preview asset check passes for all six posters.
- The production asset check intentionally fails because moving footage is absent.
- Desktop and 390px browser checks show no horizontal overflow or missing assets. Chapter keyboard navigation works. The canvas paint count stays unchanged when no scroll/resize occurs. Browser error logs are empty in the checks performed.
- Actual video smoothness, end-to-end video export and audio are NOT tested: source footage is unavailable.
- Before release, measure real device bandwidth, first-frame latency and total download size. If frame sequences exceed the agreed budget, use short keyframe-optimized video chunks instead; don't ship hundreds of MB per visitor. Do not claim production performance based on six still images.
- Finish ALL shot-plan beats, including the examination hall and present-day app scene; the six concept posters intentionally represent acts, not every shot.
- Replace the actual homepage only after film/audio approval. Preserve quote routing, shop, store destinations, search metadata and app association files. Remove preview `noindex` only from the final public homepage. Run mobile/browser validation and production preflight before a separately authorized deployment.
