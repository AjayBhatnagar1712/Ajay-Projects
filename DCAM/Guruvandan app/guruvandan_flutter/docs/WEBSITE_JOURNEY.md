# Guru Vandan: scroll-controlled 3D journey

## Website-only scope

This replaces the earlier photo/parallax concept with a procedural Three.js scene. It changes the public homepage only, not Flutter app code, mobile assets, signing, versions, or app-store builds. Quote pages, shop, shared site styles, app-association files and store destinations remain unchanged.

The character is a stylized fictional elderly monk inspired by the supplied photographs, not a photoreal recreation or archival representation of Maharshi Mehi Paramhans Ji Maharaj. The separate inspiration section uses the user's unmodified `guru2.jpg` as `web/story-assets/gurudev.jpg`.

The mountains are symbolic. Spiritual seeking, compassion for villagers, meditation at Kuppaghat and Sant Mat teaching draw on the [traditional biography](https://www.maharishimehi.com/about/). Fictional scenes are labelled as interpretation, not literal historical events.

## Interaction

- The initial scene is still. Normal scrolling advances the character, camera and environment.
- The monk walks with articulated legs, knees, shoulders, elbows and hands. Cloth folds and beard move with his stride.
- The five chapters are seeking, offering care, meditation, satsang and the Guru Vandan app.
- Returning to a scroll position produces the same pose. There is no autoplay, animation clock, CSS animation, damping or time-based loop.
- The scrubber supports keyboard arrows. Chapter controls and the skip link provide alternatives to the long scroll.
- Reduced-motion mode uses five static chapter poses plus the visible text transcript. A readable fallback appears if WebGL fails.
- All Three.js modules are served locally; no runtime CDN is needed.

The character/environment are code-generated stylized 3D sculptures. This is not a photoreal film or a reproduction of Santioni's commissioned character assets.

## Files

- `web/index.html`: homepage structure, copy, accessible transcript, navigation, download links.
- `web/journey.css`: isolated homepage layout, mobile breakpoints and motion preferences.
- `web/journey.js`: input handling and on-demand rendering.
- `web/story-timeline.mjs`: deterministic, testable pose timeline.
- `web/story-scene.js`: character rig, scenery, camera and app reveal.
- `web/vendor/`: Three.js 0.180.0 and BufferGeometryUtils, MIT license retained. The utility's bare import is changed to the local module path.
- `test/website/story-timeline.test.mjs`: website-specific tests, independent of Flutter.

## Preview and validation

From the repository root:

```powershell
node tool/website_preview.cjs
node --test test/website/story-timeline.test.mjs
```

Open `http://127.0.0.1:4173/`. The preview serves `web/` first and uses the existing `build/web/` only for unchanged generated quote pages and app image assets. It listens on the local machine only.

The tests cover bounded inputs, deterministic freeze/reverse behavior, continuous chapter transitions, the five actions and reduced-motion gait. Browser checks also inspect on-demand render counts and frame stepping.

## Hosting preparation

Firebase Hosting currently publishes `build/web/`. Overlay the homepage files, the `vendor/` folder and `story-assets/gurudev.jpg` into that directory. Do not rebuild the Android or iOS app for this change. Preserve generated quote pages, legal pages and existing asset paths. JavaScript modules must be served with a JavaScript MIME type, including `.mjs`.

No deployment or Git push is implied by previewing or copying files. Review the local animation before publishing.
