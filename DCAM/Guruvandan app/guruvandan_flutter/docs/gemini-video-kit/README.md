# Guru Vandan — Gemini video generation kit

## Start here

There are **18 core video prompts plus 1 optional mountain prompt**. Every prompt has a numbered upload image and an output filename. Open `index.html` for the visual guide with image-download and copy-prompt buttons. The `prompts` directory also contains one plain-text file per shot. These are reference images and instructions, not finished videos.

**Generate only shot 14 first.** Upload `images/14-village-teaching.png`, paste its entire prompt, and download the original resulting MP4. Return that pilot for walking, anatomy, robe motion, image continuity and scroll-playback review. Do not spend your whole video allowance on all scenes before this check. Next useful tests are 04 (young walking) and 17 (phone and hands).

## How to use Gemini

1. Open Gemini's video-creation feature. Google currently documents it as **Gemini Omni**; some interfaces may still show Veo. These are natural-language image-to-video directions, not API parameters or a guarantee of a particular model.
2. Attach **only the image named on that scene card**. Do not attach the entire folder, a contact sheet, or all age variants together.
3. Choose landscape **16:9**. Aim for an approximately **8-second** take and **1080p if the interface actually offers it**. If those controls are absent, use the supported default and send the original output; a prompt cannot unlock an unavailable resolution, frame rate or duration.
4. Copy the complete scene prompt, submit one scene at a time, and inspect the whole clip before accepting it. These prompts already contain the necessary character and motion safeguards; do not paste an extra essay into every request.
5. Download the original video, not a screen recording. Rename it to the output filename on the card. Keep failed and alternate attempts separately, with `v02`, `v03`, etc. Do not trim, add music, speed-ramp, interpolate to 60 fps, or compress it through WhatsApp.
6. Send original MP4 files as files/documents or provide their local paths. We will measure their real duration, frame rate and resolution before integration.

Google's guidance favors a good source image and a focused motion request for image-to-video. One scene per request is more manageable than asking a short generation to tell the whole life story. Sources are linked in `SOURCES.md`.

## Continuity: how to make separate shots feel like one film

- Childhood uses 01. Young adulthood uses 02–06. Mature ascetic uses 07–10. Elder uses 11–16 and optional O1. Today's disciple in 17 is a different person. Do not ask the model to age someone inside a single clip.
- Keep the supplied photographic texture, restrained golden/indigo palette, natural saffron cloth and slim silhouette. The main monk stays back-facing or hair-obscured. Never ask for a frontal portrait or a 360-degree orbit.
- The guide's transitions are **editing directions for us**, not extra material to paste into Gemini. The copy button copies only the video prompt.
- For **05 → 06** and **11 → 12**, send the first approved clip back so a clean last frame can be extracted and used as the next start image. The kit includes fallback images for both, but these do not guarantee an exact match. A cropped screenshot of a video player is not an ideal reference.
- Different locations and eras need deliberate cuts or short light/leaf/shadow dissolves, not one long AI morph. We will choose actual edit points after seeing the footage.
- Short gentle camera moves are intentional. A command for a dramatic fast drone orbit usually conflicts with hidden faces, usable mobile crops and calm frame-by-frame scrolling.
- Leave brief calm motion at both ends. Do not force every clip to fade to black; that creates a slideshow feel. Do not force a loop.
- **Top-to-bottom scrolling does not require portrait video.** Desktop masters are 16:9. Mobile framing must be checked separately: centered subjects help, but full-width crowds and the two-person blessing will need a wider presentation or approved portrait variants rather than a destructive crop.
- Keep any provider-required watermark or provenance intact. Do not ask a generator to remove it or crop it out.

## The buttery-scroll requirement

This kit plans the footage. The website's smoothness comes from both good motion **and tested playback code**; no prompt guarantees a smooth website.

The intended interaction is a single continuous vertical document with one pinned cinematic viewport:

**Scroll down → advance the film → next scene. Stop scroll → hold the current frame. Scroll up → reverse through earlier frames.**

Lateral, rising and descending camera moves may happen inside a scene, but the visitor never needs to scroll sideways. This is not a feed of independent autoplay videos, not scroll-triggered play-to-the-end, and not a scroll-snap slideshow.

Engineering acceptance criteria before hosting:

- One scroll-derived timeline controls current frame, scene transition and final app reveal. No second autoplay clock or time-based easing that keeps moving after scroll position stops changing.
- Use measured clip lengths and one normalized frame cadence after edit review. Validate real stepping/seek behavior; requesting 60 fps in a prompt cannot create genuine captured detail.
- Prepare seek-friendly short media chunks or bounded frame sequences; choose through real-device tests rather than assuming a large MP4 seeks well.
- Preload/decode the next scene before the seam. If it is late, preserve a valid current frame rather than expose a black rectangle. Prioritize the first visible scene, not a giant all-scenes download.
- Limit memory and select mobile/desktop assets appropriately. An uncompressed 18-clip package is a production source archive, **not** the website download payload.
- Match color and motion direction at edit points. Use crossfades only where they improve the transition, not across mismatched body poses that produce ghosting.
- Test forward scroll, quick reversals, stop-and-hold, touch momentum, scene seams and resizing on real Android and iPhone devices, including constrained networks. Reduced-motion users get still scenes and normal accessible content.
- Keep logos, store buttons, header, shop and explanatory text in crisp real HTML, not generated video pixels. Preserve existing quote links and app associations.
- The replacement remains a local preview until video approval, performance checks and a separately authorized deployment. The mobile app source is untouched.

## Full-story pickups — optional until the core edit is reviewed

18 is the **core edit**, not a claim that 18 attempts will perfectly capture every small action in the long script. At an 8-second target, it is about 144 seconds of raw material before trimming and overlaps; website viewing time depends on scrolling. Optional O1 makes 19 shots. Failed takes, portrait alternatives and these pickups are additional generations.

| Pickup | Image / prerequisite | Focused request |
| --- | --- | --- |
| Nail planted before 01 | Prepare a close rear-side detail image of the hand and upright nail first | A hand gently presses the nail into soft earth, with the brass vessel stationary beside it; keep the camera fixed and face out of frame. |
| 04R, rain on the road | Same 04 image, ideally relit first to gentle overcast | Keep the same uninterrupted walk and rear tracking. Soft rain falls, robe edges move with believable wet weight, the path gradually darkens; no instant storm or flood. |
| 04L, leaves on the road | Same 04 image | Keep the same walk and camera pace. A few dry leaves drift across the road, stable warm exposure, no change of identity or location. |
| 08R, monsoon outside cave | Same 08 image | Monk and camera composition remain still; light rain crosses only the cave entrance and dimmer daylight reflects on the river; stable rock shapes. |
| 08D, dry season outside cave | Same 08 image | Same monk posture and cave; warm dry haze and subtle leaf movement outside, with no tree or river morphing. |
| 14P, villagers begin following | Clean final frame of approved 14 | Continue the same slow rear-view walk; the farmer joins from the side and the mother with child takes a few steps behind; no spontaneous cloning. |

If all five ready-plate pickups (04R, 04L, 08R, 08D, 14P) are needed, the count becomes 23 core/pickup clips, or 24 with the mountain. The nail detail would add another shot after its new start image is approved. These are editorial options, not instructions to generate everything now.

## Sound and the actual app

Generate visuals without dialogue or music; incidental ambience can be muted during assembly. Use one separately recorded, consistent devotional soundtrack instead of a different voice and music in each generation.

Preserve the requested narration:

1. After 03: **शान्ति स्थिरता वा निश्चलता को कहते हैं।**
2. After 09: **शांति को जो प्राप्त कर लेते हैं, संत कहलाते हैं।**
3. After 17: **संतों के मत वा धर्म को संतमत कहते हैं।**
4. Over the ending: the three sentences together, unbroken.

Chant supplied in the script: **Bhajo Om Om Prabhu Naam Wahi, Bhajo Om Om Mehi Naam Wahi, Bhajo Om.** Review pronunciation of **मेँहीँ**. Use an original calm narrator, not a claimed recording or cloned voice of Gurudev.

Audio needs a separate opt-in design because real speech cannot stay intelligible while scrubbed backward like frames. If everything must stop, sound must pause too; if narration may finish over a held image, that is a distinct user-approved mode. No soundtrack is created or synchronized yet.

Shot 17 deliberately has a blank phone screen. Insert an actual Guru Vandan screen by motion tracking afterward, and add real clickable store buttons in the website. Do not ask Gemini to hallucinate the app UI. No mobile code change is needed.

## Quality gate for each download

- Face stays hidden for the entire clip, including the final second.
- Hands, hair, robe color, age, proportions and staff remain consistent.
- Feet actually lift and plant; staff makes credible ground contact. No sliding cutout.
- No extra fingers, bending phone, melting buildings, duplicate crowd members or broken perspective.
- No rapid cuts, sudden exposure jump, flashing lights or unwanted text.
- Real action happens inside the scene, not only a camera zoom over an unmoving photo.
- Original source file retained. Check portrait framing before commissioning a second aspect ratio.

If a take fails, simplify that one action and regenerate; do not change every camera and character instruction at once. More elaborate prompts do not guarantee better output.

## Samadhi source

The new dawn reference is an AI-relit adaptation of the real **Kuppaghat Ashram** photograph by **Praveshksingh (2007), CC BY-SA 3.0**, obtained through Wikimedia Commons. It preserves the recognizable tapered pink temple rather than inventing a generic shrine. The original is in `references/`. Current appearance and tiny details still need human confirmation. Attribution and adaptation licensing must be carried into the public media credits; this is separate from the intrusive narrative disclaimers the user rejected. See `SOURCES.md`.
