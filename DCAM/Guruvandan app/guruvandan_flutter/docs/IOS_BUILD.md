# Guruvandan iOS Build Handoff

The iOS source is configured for the Firebase project `guru-vandan` and the
bundle identifier `com.ivar.guruvandan`. App audio is bundled in the Flutter
assets, so the iOS build contains the same offline satsang, aarti, meditation
chime, and Om audio as Android.

## Already Prepared

- Native Firebase iOS app and `GoogleService-Info.plist`
- Google sign-in callback URL scheme
- Firebase phone-auth background modes and push entitlement
- Background audio mode for lock-screen and Control Center playback
- Guruvandan app name, icon set, and launch screen
- App privacy manifest for account and devotional activity data
- CocoaPods configuration with iOS 13 as the minimum version
- Unsigned cloud compilation workflow

## Build On A Mac

1. Install the latest stable Xcode, Flutter 3.38.6 or newer, and CocoaPods.
2. Clone the repository and run:

   ```bash
   flutter pub get
   cd ios
   pod install
   cd ..
   open ios/Runner.xcworkspace
   ```

3. In Xcode, select `Runner` -> `Signing & Capabilities`, choose your Apple
   Developer Team, and keep `Automatically manage signing` enabled.
4. Confirm the bundle identifier remains `com.ivar.guruvandan`.
5. Confirm these capabilities are present: Background Modes (Audio, Background
   fetch, Remote notifications) and Push Notifications.
6. Run on a real iPhone once, then create the signed archive with:

   ```bash
   flutter build ipa --release
   ```

The IPA is created under `build/ios/ipa/`.

## Compile In GitHub Cloud

Open the repository's **Actions** tab, select **Build iOS (unsigned)**, and click
**Run workflow**. Download the `Guruvandan-iOS-unsigned` artifact after the job
finishes. This verifies the complete iOS build but cannot be installed on an
iPhone because Apple signing is intentionally absent.

## Apple Account Step For Phone Login

Firebase phone authentication on iOS uses silent APNs verification and falls
back to reCAPTCHA when needed. After the Apple Developer account is available:

1. Create an APNs authentication key in Apple Developer.
2. Upload the `.p8` key in Firebase Console -> Project settings -> Cloud
   Messaging -> Guruvandan iOS app.
3. Keep Push Notifications and the Remote notifications background mode enabled
   in Xcode.

This Apple credential cannot be generated on Windows and must never be committed
to the repository.

## Before App Store Submission

Apple also requires a public privacy-policy URL and accurate App Privacy answers
in App Store Connect. Because the app creates user accounts, review the current
Apple requirements for in-app account deletion and Sign in with Apple before the
first public submission. These are store-account decisions, not iOS compilation
requirements.
