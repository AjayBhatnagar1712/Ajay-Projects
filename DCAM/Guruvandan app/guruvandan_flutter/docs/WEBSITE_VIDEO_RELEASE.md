# Shanti — supplied-video website edition

## Scope

Website-only replacement of the procedural homepage. No Flutter, Android, iOS, Firebase database, user-account or store configuration changes. Published to Firebase Hosting on 28 September 2026; not pushed to GitHub.

## Source footage and edit

Originals are preserved at `D:\Guruvandan_Videos`. The original edit decision list lives in `web/cinema/edit.json`; the live release uses `web/cinema/media/v2/manifest.json`, combining thirteen unchanged v1 shots with five new shots. The original manifest and assets remain available under v1.

- Source material: 1280 × 720, 24 fps. No claim of native 4K or 60 fps.
- The mountain clip is the prologue, followed by prayer, departure, search, blessing, inward practice, writing, community, Kuppaghat and the modern disciple.
- `5th and 6th.mp4` provides both blessing and lamp approach. The standalone `5th.mp4` is an alternate, not repeated in the edit.
- There is no `13th.mp4`. Despite its name, `14th.mp4` contains writing/light/books, not village teaching. Its final books shot is used in the wisdom chapter. `15th.mp4` provides the community satsang scene. A separate walking/village-helping shot is not present in this delivery.
- Source generation marks are not removed. No fake phone UI or unprovided narration is fabricated.
- The Kuppaghat adaptation is credited under CC BY-SA 3.0 in the film-credits dialog; see the image source details in `docs/gemini-video-kit/SOURCES.md`.

## Playback design

Vertical native scrolling maps directly to the timeline, in both directions. Videos never call `play()` and remain paused. Seeking uses a 6-frame GOP, no B-frames, H.264/yuv420p, silent tracks and fast-start MP4 headers. Browser seek completion supplies a decoded canvas snapshot. Scroll cannot accumulate an autoplay clock.

At most three video elements are retained; obsolete decoders are unloaded. Only adjacent scenes are prefetched, rather than downloading the entire film at entry. Desktop files are 1280 pixels wide; phone files are 768 pixels wide. Reduced-motion preference and data-saving mode start with stills and no video decoders. A visible motion toggle also allows still mode.

The brief dissolves keep the outgoing image opaque. Phone framing preserves the entire source height while cropping horizontally around each shot's focus. No fake character movement is created by sliding a still picture.

Optional light, stillness and teaching dialogs are accessible by keyboard, do not gate scrolling, and can be dismissed with Escape. Chapter navigation, an accessible scrubber, skip link, transcript and app download links offer alternatives to a long scroll.

The film is intentionally silent. The supplied clips do not provide a continuous finished score/narration; independently playing their audio would drift from scroll-controlled visuals. The app's existing audio is not modified.

## Local preview and tests

```powershell
$env:PORT = '4176'
node tool/website_preview.cjs
node --test test/website/*.test.mjs
```

The preview server supports HTTP byte ranges, which are important for seeking. Open `http://127.0.0.1:4176/`. Shared-quote routes use the existing `quote_page.js`; shop and legal pages are unchanged.

To regenerate video assets, install `imageio-ffmpeg` into the ignored `build/video-tools` directory and run `tool/prepare_story_videos.py` with Python/Pillow available. Existing output files are not overwritten. Use a new version directory and update the manifest URL when making a new encode, so production caches cannot serve mixed versions.

Physical Android Chrome and iPhone Safari testing on mobile data remains recommended. Never run a mobile build to deploy this page. Preserve the original footage outside Git.

## Production release

Live at https://guruvandan.com/ on Firebase project/site `guru-vandan`. Latest hosting version: `802fc6186411458d`, successfully deployed on 28 September 2026 and verified at `2026-09-28T16:14:16.090Z`. The previous bilingual/shop release was `3c468932408f1fda` at `2026-09-28T14:09:41.176Z`. The initial film release was `4f13429d52219923` at `2026-09-28T04:43:42.922Z`.

`tool/stage_website_release.mjs` copies the existing `build/web` baseline into a separate timestamped release directory, overlays only the cinematic homepage assets, and checks that the existing app bundle and association files remain unchanged. The generated hosting-only config adds JavaScript/video MIME types and immutable caching for versioned media. It does not deploy database rules or change billing.

```powershell
node tool/stage_website_release.mjs
$release = Get-Content -LiteralPath 'build/website-release-latest.json' -Raw | ConvertFrom-Json
firebase deploy --only hosting --project guru-vandan --config $release.config --non-interactive
node tool/verify_website_release.mjs
```

The deployed release and rollback metadata are saved under `build/hosting-releases/2026-09-28T04-41-54-775Z`. Verification passed for the homepage across the apex, www and Firebase domains, all 54 media assets, MP4 byte-range requests, cache headers, preserved app files and shared-quote links. Live browser checks confirmed forward/reverse seeking and a stationary frame when scrolling stops. All 27 website tests passed.

## English/Hindi and shop follow-up

The subsequent release is recorded under `build/hosting-releases/2026-09-28T14-07-42-352Z`. It adds a website-only, persistent English/Hindi switch between Journey and Shop; localized film captions, chapter navigation, interactions, app introduction and public legal/support pages; and a dark-green/gold shop with the corrected English sentence. English quote pages remain bilingual; Hindi mode displays the Hindi quote. Existing static quote pages receive the same localized shell while retaining their social-preview metadata and card images. No mobile app or admin code was changed.

All 33 website tests pass. Browser checks cover switching back to English, cross-page preference persistence, translated dynamic captions, quote data, and 320/390-pixel layouts without horizontal overflow. Production hash checks cover the changed files, old quote routes, unchanged app files and all 54 video/poster assets.

## Replacement video revision — published

Five Gemini outputs were received from `D:\Guruvandan_Videos\replacements` on 28 September 2026. All are native 1280 × 720 at 24 fps, with 240 video frames. The originals are unchanged. Scene mapping and exact trims are recorded in `web/cinema/revisions/2026-09-28.json`; source hashes are in `web/cinema/media/v2/source-review.json`.

| Website scene | Source suffix | Encoded duration | Review |
|---|---|---|---|
| 01 — horizon | fec440d7 | 9.5 s | Open silver hair, rear-facing monk |
| 06 — blessing | 5b0a6c33 | 9.5 s | Black clothing; teacher's face outside the frame |
| 07 — inner door | dff222fa | 9.5 s | Both figures back-facing |
| 15 — satsang | 42d0604b | 4.25 s | Audience faces teacher; only continuous dusk portion retained |
| 17 — disciple | d9d29b42 | 9.5 s | Gurudev photograph on shelf; diya stand and idols removed |

Visual review used four overview frames and twenty half-second samples per source. The satsang output contains a generated dissolve from dusk into a daylight scene around five seconds; its selected range ends at 4.5 seconds, before that change. No claim of frame-by-frame visual inspection is made. All selected encodes are fully decoded for structural validation.

`tool/prepare_replacement_videos.py` creates new immutable v2 MP4/poster assets, verifies the actual encoded frame counts, and writes the combined manifest only after all encodes succeed. It refuses to overwrite an existing version directory. Desktop/phone widths remain 1280/768, keyframes every six frames, no B-frames, silent H.264, fast-start MP4. Motion is still driven exclusively by scroll position. The inner-door and disciple shots use full-width letterboxed compositions on portrait screens so both figures and the shelf photograph are not cropped away. Other scene framing is unchanged.

The release stager retains every old v1 asset and manifest for already-open clients while adding v2. This revision was deployed to Firebase Hosting only at the user's request. Deployment result and live-verification records are in `build/hosting-releases/2026-09-28T15-07-57-484Z`. Production verification passed across the apex, www and Firebase domains, changed website hashes, unchanged app files and association files, static shared-quote routes, all 54 current media assets, and replacement MP4 byte-range/immutable-cache responses.

Validation: all 35 website tests pass. Ten replacement encodes were fully decoded and checked for expected frame count, I/P-only frames, six-frame maximum keyframe spacing, no audio, and fast-start headers. The staged release `build/hosting-releases/2026-09-28T15-07-57-484Z` passes 73 local file-hash/HTTP checks and ten byte-range checks. Eight baseline app/association/supporting files are preserved byte-for-byte by staging. After publishing, all four local preview servers on ports 4176, 4177, 4178 and 4179 were stopped at the user's request; no preview listeners or matching processes remained. Files were retained, and unrelated tool services were not stopped. The shutdown report is saved beside the release records.

Browser checks confirmed a stationary frame/paint count while scrolling stopped, reverse seeking followed by forward retracing to the same decoded time, three paused decoders, no reported browser errors, and small-screen MP4 selection after a fresh 390-pixel load. The full disciple composition including the shelf photograph remains visible on that narrow layout, with no horizontal overflow. Proof images are `build/website-preview/replacement-inner-door.png`, `replacement-disciple-mobile.png` and `replacement-satsang.png`. Physical iPhone/Android performance remains to be checked on actual devices.

The user-generated footage came from the five image/prompt pairs in `docs/gemini-revisions-2026-09-28`, also saved at `D:\Guruvandan_Videos\Gemini-corrections-2026-09-28`. No Runway credits were spent. App source, app binaries, authentication, database and store configuration remain untouched.
