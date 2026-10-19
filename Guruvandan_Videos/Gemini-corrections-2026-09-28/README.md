# Guru Vandan — visual Gemini correction kit

## Recommended: corrected image + motion prompt

Open `index.html`, or the local preview at `http://127.0.0.1:4178/` while its server is running. This is the visual webkit: **five newly corrected PNG images**, one paired motion prompt each, image downloads and Copy prompt buttons. It also works directly from disk; if clipboard access is unavailable, the prompt is selected for manual copying.

1. Start with **06, then 07** in the same Gemini conversation for teacher continuity. Make the remaining scenes separately.
2. Download the corrected PNG from that card and upload **only that image** as the video starting frame. Do not use the old screenshot or old MP4 for this workflow.
3. Click **Copy prompt** and paste it in Gemini video creation. Choose landscape 16:9 and the highest native quality available. Request 10 seconds if supported; keep an 8-second result if that is what your account produces.
4. Check the entire clip against the card's acceptance guidance. These prompts cannot guarantee an error-free video or smooth browser decoding by themselves.
5. Download the original MP4 and save it in `D:\Guruvandan_Videos\replacements` with its specified filename. Do not overwrite old files or WhatsApp-compress the result.

| Website scene | Upload from images | Motion prompt | Save original result as |
|---|---|---|---|
| 01 — Mountain prologue | 01-horizon-corrected.png | video-prompts/01-horizon.txt | 01-horizon-fixed.mp4 |
| 06 — Blessing | 06-blessing-corrected.png | video-prompts/06-blessing.txt | 06-blessing-fixed.mp4 |
| 07 — Inner door | 07-inner-door-corrected.png | video-prompts/07-inner-door.txt | 07-inner-door-fixed.mp4 |
| 15 — Satsang | 15-satsang-corrected.png | video-prompts/15-satsang.txt | 15-satsang-fixed.mp4 |
| 17 — Modern disciple | 17-disciple-corrected.png | video-prompts/17-disciple.txt | 17-disciple-fixed.mp4 |

The teacher and Gurudev portraits in each card are optional supporting references, not the main starting image. The supplied corrections were created with the built-in image-generation tool and visually reviewed; the exact creation prompts are in `IMAGE_PROMPTS.md`. Scene 17 uses the supplied Gurudev photograph as a visual insert reference; check that the generated video preserves it faithfully.

`shots.json` is the content source. Run `node build-kit.mjs` from this directory to rebuild the static HTML and motion prompt text files. `kit.css` and `kit.js` are local assets; no external scripts or fonts are required. Neither the app nor the live website is changed by this kit.

## Alternative: older surgical video-edit prompts

The original `prompts/` folder and the current-scene MP4s/JPGs are retained below for optional video-to-video editing. They are **not** the primary workflow above. The old JPGs are uncorrected; use the new files in `images/` when generating from a still.

Generate **5 replacement videos**, not the complete film. Website scene numbers are used here: scene 01 is the mountain prologue (original `optional.mp4`), not the original `1st.mp4`.

### How to use the alternative video-edit prompts

1. Open Gemini's **Create video** mode. For each numbered prompt, attach that scene's MP4 from `references`, plus the listed JPGs. Paste its complete prompt from `prompts`.
2. The scene frames are **current, uncorrected references**, not approved final artwork. The prompt describes the corrections. Do not upload the browser screenshots with website text.
3. If your account supports video editing, use the attached clip as the edit source. If it only supports photo-to-video, omit the MP4, attach the JPGs and replace “Use the attached scene video as continuity reference” with “Re-create the attached scene reference with the requested corrections already present in the first frame.”
4. Request landscape 16:9 and 10 seconds if available; choose the highest native quality offered. If your interface produces 8 seconds instead, keep that duration — we will adjust the website timeline to the actual file, not stretch or falsely relabel it.
5. Generate scenes **06 then 07 in the same Gemini conversation** to help keep the teacher's black clothes and room consistent. If possible, attach a frame from your approved corrected scene 06 as a continuity reference for scene 07.
6. Download the original MP4s, not WhatsApp-compressed copies. Save them in `D:\\Guruvandan_Videos\\replacements` using the filenames below. Do not overwrite the originals.

Google's current help documents one video plus up to five image references and video editing where available. UI and access vary by account and location: [Gemini video help](https://support.google.com/gemini/answer/16126339), [current video overview](https://gemini.google/overview/video-generation/). These prompts do not guarantee a perfect generation; review every frame before accepting.

| Scene | Attach from references | Save result as |
|---|---|---|
| 01 — Open, untied hair | 01-current-scene.mp4, 01-current-frame.jpg | 01-horizon-fixed.mp4 |
| 06 — Teacher's blessing — no faces | 06-current-scene.mp4, 06-current-frame.jpg, teacher-baba-devi-sahab-1.jpg, teacher-baba-devi-sahab-2.jpg | 06-blessing-fixed.mp4 |
| 07 — The inner door — teacher continuity | 07-current-scene.mp4, 07-current-frame.jpg, teacher-baba-devi-sahab-1.jpg, teacher-baba-devi-sahab-2.jpg | 07-inner-door-fixed.mp4 |
| 15 — Audience faces the teacher | 15-current-scene.mp4, 15-current-frame.jpg | 15-satsang-fixed.mp4 |
| 17 — Gurudev's portrait in the room | 17-current-scene.mp4, 17-current-frame.jpg, gurudev-mehi-portrait.jpg | 17-disciple-fixed.mp4 |

## Acceptance checklist

- 01: ALL hair is open; no half-up tie/bun in any frame. No face reveal.
- 06: teacher in black sleeves; blessing hand visible; both faces completely outside framing or concealed. No frontal face is fixed merely by blur.
- 07: same teacher, black clothing and room; both men shown from behind for the entire shot. No camera orbit into profiles.
- 15: audience faces the near-foreground teacher from beginning to end. No rotating crowd, duplicate teachers or reversed rows.
- 17: no tall diya stand; no shelf idol/deity picture; one faithful framed supplied Gurudev portrait visible; devotee stays rear-facing.
- All: consistent bodies/hands, no warped architecture, no visible scene morphing, no black frames or generated captions, natural slow movement.

## Integration status

The website clips have **not** been replaced by these reference files. After corrected MP4s are supplied, they must be inspected, encoded into a new versioned media directory with fresh posters and mobile variants, measured for actual duration and checked for forward/reverse scroll seeking before release. Never overwrite immutable `/cinema/media/v1` URLs with different video bytes.
