# Guruvandan

Guruvandan is a Flutter app for a spiritual school where devotees can follow a simple daily practice routine.

## Features

- Morning and evening satsang audio
- Meditation timer with preset durations, custom hour/minute picker, and a
  completion chime after the timed session
- Daily Sadguru Maharaj quotes
- Local streak tracking for routine consistency
- Firebase-backed admin console for bilingual Sadguru quotes

## Tech Stack

- Flutter and Dart for Android, iOS, and web
- Firebase Auth for admin login
- Firebase Realtime Database for bilingual quotes and user profiles
- `just_audio` and `audio_service` for foreground and background audio
- `shared_preferences` for local streak tracking

## Bundled Audio

- Morning satsang: `assets/audio/morning_satsang_astuti_rishikesh.mp3`
- Shaam satsang: `assets/audio/shaam_satsang_full.mp3`
- Aarti: `assets/audio/shaam_aarti.mp3`
- Meditation completion chime: `assets/audio/meditation_chant.mp3`

## Local Preview

Flutter is installed on this machine at:

```text
C:\src\flutter\flutter_windows_3.38.6-stable\flutter\bin\flutter.bat
```

Run the app locally:

```powershell
cd "D:\DCAM\Guruvandan app\guruvandan_flutter"
& "C:\src\flutter\flutter_windows_3.38.6-stable\flutter\bin\flutter.bat" pub get
& "C:\src\flutter\flutter_windows_3.38.6-stable\flutter\bin\flutter.bat" run -d chrome
```

Build web:

```powershell
& "C:\src\flutter\flutter_windows_3.38.6-stable\flutter\bin\flutter.bat" build web
```

## Live Web App

This repo includes a GitHub Actions workflow that builds Flutter Web and deploys it to GitHub Pages.

Expected public URL after GitHub Pages is enabled:

```text
https://ajaybhatnagar1712.github.io/Guru-vandan/
```

## Firebase

The project currently uses Firebase project values discovered from the Android repo:

- project id: `guru-vandan`
- realtime database: `https://guru-vandan-default-rtdb.asia-southeast1.firebasedatabase.app/`

The native Firebase iOS app is registered with bundle identifier
`com.ivar.guruvandan`. Its platform configuration is included in the iOS project.

## iOS

The iOS source, native Firebase configuration, background audio modes, phone-auth
capabilities, app icons, and CocoaPods setup are ready. Apple signing still has
to be completed with an Apple Developer account on macOS or a cloud macOS build
service. Follow [docs/IOS_BUILD.md](docs/IOS_BUILD.md) for the exact handoff.

## Sign In Setup

The app asks first-time users to sign in before entering the routine screens.
After sign-in, it collects first, middle, and last name separately. The home
screen greets the devotee by first name only.

Supported sign-in methods:

- Google sign-in
- Phone number OTP sign-in

On web, Google sign-in tries Firebase popup login first and automatically falls
back to redirect login if the browser closes or blocks the popup.

Enable these in Firebase Console:

```text
Firebase Console -> Authentication -> Sign-in method
```

For the live web app, also add this under Firebase authorized domains:

```text
ajaybhatnagar1712.github.io
```

If Google sign-in opens briefly and returns without signing in, check these first:

- Google provider is enabled in Firebase Authentication
- `ajaybhatnagar1712.github.io` is listed in authorized domains
- The Firebase web app id in `lib/main.dart` matches the Firebase project

## Admin Console

Open the private admin route directly:

```text
https://ajaybhatnagar1712.github.io/Guru-vandan/#/admin
```

The quote manager stores English and Hindi together, lists the newest entries
first, and allows existing quotes to be edited from the same page.

Allowed admin email is currently:

```text
ajaybhatnagar1712@gmail.com
```
