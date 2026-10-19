import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'dart:ui' as ui;

import 'package:audio_session/audio_session.dart';
import 'package:app_links/app_links.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_database/firebase_database.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';
import 'package:just_audio/just_audio.dart' as ja;
import 'package:just_audio_background/just_audio_background.dart';
import 'package:share_plus/share_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';

const allowedAdminEmail = 'guruvandan11@gmail.com';
const appShareLink = String.fromEnvironment(
  'GURU_VANDAN_WEB_URL',
  defaultValue: 'https://guruvandan.com',
);
const androidStoreLink =
    'https://play.google.com/store/apps/details?id=com.ivar.guruvandan';
const iosStoreLink = 'https://apps.apple.com/app/id6807657972';
const _legacyQuoteScheduleStart = '2026-09-24';
final ValueNotifier<String?> incomingQuoteId = ValueNotifier<String?>(null);
const firebaseDatabaseUrl =
    'https://guru-vandan-default-rtdb.asia-southeast1.firebasedatabase.app';
const _googleServerClientId =
    '540841544767-tlaebghbususiucprk4g2i2t1n2m5fmk.apps.googleusercontent.com';
const _rememberedAuthUidKey = 'guruvandan_flutter:authenticated_uid';
const _authenticatedProfileKeyPrefix = 'guruvandan_flutter:name:';
const _meditationPresetsKey = 'guruvandan_flutter:meditation_presets';
const _selectedMeditationMinutesKey =
    'guruvandan_flutter:selected_meditation_minutes';
const defaultMeditationPresetMinutes = <int>[5, 10, 15, 20, 25, 30];

const _firebaseApiKey = String.fromEnvironment(
  'FIREBASE_API_KEY',
  defaultValue: 'AIzaSyBDnC1IE0BImeYue5vaOicS4_Miw0Vd2xE',
);

const _firebaseWebOptions = FirebaseOptions(
  apiKey: String.fromEnvironment(
    'FIREBASE_API_KEY',
    defaultValue: 'AIzaSyDfp3ijzKvfGovXKAur63s5l2KUUdYaJtk',
  ),
  appId: String.fromEnvironment(
    'FIREBASE_WEB_APP_ID',
    defaultValue: '1:540841544767:web:f7c6730ac63bbdd8cebc8a',
  ),
  messagingSenderId: '540841544767',
  projectId: 'guru-vandan',
  authDomain: 'guru-vandan.firebaseapp.com',
  databaseURL: firebaseDatabaseUrl,
  storageBucket: 'guru-vandan.firebasestorage.app',
  measurementId: 'G-67CCGE1TTQ',
);

const _firebaseAndroidOptions = FirebaseOptions(
  apiKey: _firebaseApiKey,
  appId: String.fromEnvironment(
    'FIREBASE_ANDROID_APP_ID',
    defaultValue: '1:540841544767:android:6f5d1b40aba4f0c3cebc8a',
  ),
  messagingSenderId: '540841544767',
  projectId: 'guru-vandan',
  databaseURL: firebaseDatabaseUrl,
  storageBucket: 'guru-vandan.firebasestorage.app',
);

const _firebaseIosOptions = FirebaseOptions(
  apiKey: String.fromEnvironment(
    'FIREBASE_IOS_API_KEY',
    defaultValue: 'AIzaSyBp2KIcoIKAw1EJCbDF8SaK0KOjE49uQHk',
  ),
  appId: String.fromEnvironment(
    'FIREBASE_IOS_APP_ID',
    defaultValue: '1:540841544767:ios:a622bd4baf314086cebc8a',
  ),
  messagingSenderId: '540841544767',
  projectId: 'guru-vandan',
  databaseURL: firebaseDatabaseUrl,
  storageBucket: 'guru-vandan.firebasestorage.app',
  iosClientId:
      '540841544767-qt1h14f37kh1vrv3cm0oko6gli8a158r.apps.googleusercontent.com',
  iosBundleId: 'com.ivar.guruvandan',
);

FirebaseOptions get firebaseOptions {
  if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
    return _firebaseAndroidOptions;
  }
  if (!kIsWeb && defaultTargetPlatform == TargetPlatform.iOS) {
    return _firebaseIosOptions;
  }
  return _firebaseWebOptions;
}

ja.AudioPlayer? _backgroundAudioPlayer;
Future<void>? _googleSignInInitialization;
const _androidDiagnosticsChannel =
    MethodChannel('guru_vandan/android_diagnostics');

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await _configureBackgroundAudio();
  var firebaseReady = false;

  try {
    if (kIsWeb) {
      await Firebase.initializeApp(options: _firebaseWebOptions);
    } else {
      await Firebase.initializeApp();
    }
    if (kIsWeb) {
      await FirebaseAuth.instance.setPersistence(Persistence.LOCAL);
    }
    firebaseReady = true;
  } catch (_) {
    firebaseReady = false;
  }

  runApp(GuruvandanApp(firebaseReady: firebaseReady));
}

Future<void> _configureBackgroundAudio() async {
  try {
    await JustAudioBackground.init(
      androidNotificationChannelId: 'com.ivar.guruvandan.audio',
      androidNotificationChannelName: 'Guru Vandan playback',
      androidNotificationChannelDescription:
          'Satsang, meditation, and Om mantra playback controls',
      androidNotificationOngoing: true,
      androidStopForegroundOnPause: false,
    );

    _backgroundAudioPlayer = ja.AudioPlayer(
      handleInterruptions: true,
      handleAudioSessionActivation: true,
    );

    final session = await AudioSession.instance;
    await session.configure(AudioSessionConfiguration.music());
  } catch (_) {
    _backgroundAudioPlayer ??= ja.AudioPlayer();
  }
}

class GuruvandanApp extends StatefulWidget {
  const GuruvandanApp({
    required this.firebaseReady,
    this.showOpening = true,
    super.key,
  });

  final bool firebaseReady;
  final bool showOpening;

  static const languageKey = 'guruvandan_flutter:language';
  static const themeModeKey = 'guruvandan_flutter:theme_mode';

  @override
  State<GuruvandanApp> createState() => _GuruvandanAppState();
}

class _GuruvandanAppState extends State<GuruvandanApp> {
  AppLanguage? language;
  ThemeMode themeMode = ThemeMode.light;
  bool languageLoaded = false;
  AppLinks? appLinks;
  StreamSubscription<Uri>? appLinkSubscription;

  @override
  void initState() {
    super.initState();
    _listenForAppLinks();
    _loadPreferences();
  }

  void _listenForAppLinks() {
    try {
      appLinks = AppLinks();
      appLinkSubscription = appLinks!.uriLinkStream.listen(
        (uri) {
          final quoteId = quoteIdFromUri(uri);
          if (quoteId != null && quoteId.isNotEmpty) {
            incomingQuoteId.value = quoteId;
          }
        },
        onError: (_) {},
      );
    } catch (_) {
      // Link handling is unavailable on unsupported platforms.
    }
  }

  @override
  void dispose() {
    unawaited(appLinkSubscription?.cancel());
    super.dispose();
  }

  Future<void> _loadPreferences() async {
    final prefs = await SharedPreferences.getInstance();
    final savedValue = prefs.getString(GuruvandanApp.languageKey);
    final saved =
        savedValue == null ? null : AppLanguagePreference.fromValue(savedValue);
    final savedThemeMode = AppThemeModePreference.fromValue(
        prefs.getString(GuruvandanApp.themeModeKey));
    if (mounted) {
      setState(() {
        language = saved;
        themeMode = savedThemeMode;
        languageLoaded = true;
      });
    }
  }

  Future<void> _setLanguage(AppLanguage value) async {
    if (language != value) setState(() => language = value);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(GuruvandanApp.languageKey, value.name);
  }

  Future<void> _setThemeMode(ThemeMode value) async {
    if (themeMode != value) setState(() => themeMode = value);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(GuruvandanApp.themeModeKey, value.name);
  }

  @override
  Widget build(BuildContext context) {
    final activeLanguage = language ?? AppLanguage.english;
    _activeAppBrightness =
        themeMode == ThemeMode.dark ? Brightness.dark : Brightness.light;

    return AppearanceScope(
      themeMode: themeMode,
      onChanged: _setThemeMode,
      child: LanguageScope(
        language: activeLanguage,
        onChanged: _setLanguage,
        child: MaterialApp(
          title: 'Guru Vandan',
          debugShowCheckedModeBanner: false,
          locale: activeLanguage == AppLanguage.hindi
              ? const Locale('hi')
              : const Locale('en'),
          supportedLocales: const [Locale('en'), Locale('hi')],
          localizationsDelegates: GlobalMaterialLocalizations.delegates,
          themeMode: themeMode,
          theme: _buildAppTheme(activeLanguage, Brightness.light),
          darkTheme: _buildAppTheme(activeLanguage, Brightness.dark),
          home: !languageLoaded
              ? const _LanguageLoadingScreen()
              : language == null
                  ? _FirstLaunchLanguageScreen(onSelected: _setLanguage)
                  : widget.showOpening
                      ? SpiritualOpening(firebaseReady: widget.firebaseReady)
                      : AuthGate(firebaseReady: widget.firebaseReady),
          routes: {
            '/admin': (_) => _AdminRoute(firebaseReady: widget.firebaseReady),
          },
        ),
      ),
    );
  }
}

class AppColors {
  static const maroon = Color(0xFF7B171D);
  static const crimson = Color(0xFFA42A30);
  static const deepCrimson = Color(0xFF4E1014);
  static const cream = Color(0xFFFBF6EC);
  static const offWhite = Color(0xFFFFFCF7);
  static const parchment = Color(0xFFF6E8D6);
  static const rose = Color(0xFFF4E1DF);
  static const gold = Color(0xFFC9963E);
  static const softGold = Color(0xFFF2D193);
  static const sage = Color(0xFF55745B);
  static const river = Color(0xFF5E8290);
  static const copper = Color(0xFFB96B3D);
  static const ink = Color(0xFF2B211F);
  static const taupe = Color(0xFF675A55);
  static const muted = Color(0xFF91857E);
  static const border = Color(0xFFE6D9CC);
  static const borderStrong = Color(0xFFD2BDA7);
  static const surface = Color(0xFFFFFFFF);
  static const darkCanvas = Color(0xFF15100F);
  static const darkSurface = Color(0xFF211918);
  static const darkSurfaceRaised = Color(0xFF2B211F);
  static const darkSurfaceSoft = Color(0xFF372A2D);
  static const darkRose = Color(0xFF43282D);
  static const darkBorder = Color(0xFF4C3933);
  static const darkInk = Color(0xFFFFF7EE);
  static const darkTaupe = Color(0xFFD6C5BB);
  static const darkRoseAccent = Color(0xFFE59A9E);
  static const darkGold = Color(0xFFE2BC73);
  static const darkSage = Color(0xFF9FC3A6);
  static const darkRiver = Color(0xFF9BC0CC);
}

class _AppIconMark extends StatelessWidget {
  const _AppIconMark();

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      'assets/images/chakra_logo.png',
      fit: BoxFit.contain,
      filterQuality: FilterQuality.high,
    );
  }
}

enum PracticeTab { home, satsang, meditate, wisdom, more }

enum SatsangSession { morning, evening, aarti }

enum RoutineTask { morningSatsang, eveningSatsang, meditation }

enum MeditationChantPhase { closing }

enum AppLanguage { english, hindi }

enum BackgroundPlaybackKind { none, satsang, mantra, meditation, closingChant }

Brightness _activeAppBrightness = Brightness.light;

bool get _appIsDark => _activeAppBrightness == Brightness.dark;

bool shouldUseRememberedAuthSession({
  required bool startupComplete,
  required bool authStreamReady,
  required bool hasAuthenticatedUser,
  required bool hasRememberedSession,
  required bool hasObservedAuthenticatedUser,
}) {
  return startupComplete &&
      authStreamReady &&
      !hasAuthenticatedUser &&
      hasRememberedSession &&
      !hasObservedAuthenticatedUser;
}

String? legacyAuthenticatedUidFromPreferenceKeys(Iterable<String> keys) {
  for (final key in keys) {
    if (!key.startsWith(_authenticatedProfileKeyPrefix)) continue;
    final uid = key.substring(_authenticatedProfileKeyPrefix.length).trim();
    if (uid.isNotEmpty) return uid;
  }
  return null;
}

Color _surfaceColor([Color light = AppColors.surface]) {
  if (!_appIsDark) return light;
  if (light == AppColors.rose) return AppColors.darkRose;
  if (light == AppColors.parchment || light == AppColors.cream) {
    return AppColors.darkSurfaceRaised;
  }
  if (light.computeLuminance() > 0.72) return AppColors.darkSurface;
  return Color.alphaBlend(
    light.withValues(alpha: 0.1),
    AppColors.darkSurfaceRaised,
  );
}

Color _raisedSurfaceColor([Color light = AppColors.offWhite]) {
  if (!_appIsDark) return light;
  return AppColors.darkSurfaceRaised;
}

Color _borderColor([Color light = AppColors.border]) {
  if (!_appIsDark) return light;
  if (light == AppColors.border || light == AppColors.borderStrong) {
    return AppColors.darkBorder;
  }
  return Color.alphaBlend(
    light.withValues(alpha: 0.42),
    AppColors.darkBorder,
  );
}

Color? _readableColor(Color? color) {
  if (!_appIsDark || color == null) return color;
  if (color == AppColors.ink) return AppColors.darkInk;
  if (color == AppColors.taupe || color == AppColors.muted) {
    return AppColors.darkTaupe;
  }
  if (color == AppColors.maroon ||
      color == AppColors.crimson ||
      color == AppColors.deepCrimson) {
    return AppColors.darkRoseAccent;
  }
  if (color == AppColors.gold ||
      color == AppColors.softGold ||
      color == AppColors.copper) {
    return AppColors.darkGold;
  }
  if (color == AppColors.sage) return AppColors.darkSage;
  if (color == AppColors.river) return AppColors.darkRiver;
  if (color == Colors.black) return AppColors.darkInk;
  return color;
}

Color _primaryActionColor() =>
    _appIsDark ? AppColors.darkGold : AppColors.maroon;

Color _onPrimaryActionColor() =>
    _appIsDark ? AppColors.darkCanvas : AppColors.cream;

ThemeData _buildAppTheme(AppLanguage language, Brightness brightness) {
  final isDark = brightness == Brightness.dark;
  final textTheme = language == AppLanguage.hindi
      ? GoogleFonts.notoSansDevanagariTextTheme()
      : GoogleFonts.interTextTheme();
  final backgroundColor = isDark ? AppColors.darkCanvas : AppColors.cream;
  final surfaceColor = isDark ? AppColors.darkSurface : AppColors.surface;
  final foregroundColor = isDark ? AppColors.darkInk : AppColors.ink;
  final bodyColor = isDark ? AppColors.darkTaupe : AppColors.taupe;
  final borderColor = isDark ? AppColors.darkBorder : AppColors.borderStrong;
  final primaryColor = isDark ? AppColors.darkGold : AppColors.maroon;

  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: ColorScheme.fromSeed(
      seedColor: AppColors.maroon,
      primary: primaryColor,
      onPrimary: isDark ? AppColors.darkCanvas : AppColors.cream,
      secondary: isDark ? AppColors.darkRoseAccent : AppColors.gold,
      onSecondary: isDark ? AppColors.darkCanvas : AppColors.ink,
      surface: surfaceColor,
      onSurface: foregroundColor,
      outline: borderColor,
      brightness: brightness,
    ),
    scaffoldBackgroundColor: backgroundColor,
    appBarTheme: AppBarTheme(
      backgroundColor: backgroundColor,
      foregroundColor: foregroundColor,
      centerTitle: false,
      elevation: 0,
      titleTextStyle: _headingStyle(
        language,
        color: foregroundColor,
        fontSize: 22,
        fontWeight: FontWeight.w800,
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: primaryColor,
        foregroundColor: isDark ? AppColors.darkCanvas : AppColors.cream,
        disabledBackgroundColor:
            isDark ? AppColors.darkSurfaceSoft : AppColors.border,
        disabledForegroundColor: isDark ? AppColors.darkTaupe : AppColors.muted,
        minimumSize: const Size(56, 56),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        textStyle: _bodyStyle(
          language,
          fontSize: 17,
          fontWeight: FontWeight.w800,
        ),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: isDark ? AppColors.darkGold : AppColors.maroon,
        minimumSize: const Size(56, 54),
        side: BorderSide(color: borderColor),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        textStyle: _bodyStyle(
          language,
          fontSize: 16,
          fontWeight: FontWeight.w800,
        ),
      ),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor:
          isDark ? AppColors.darkSurfaceRaised : AppColors.offWhite,
      surfaceTintColor: Colors.transparent,
      titleTextStyle: _headingStyle(
        language,
        color: foregroundColor,
        fontSize: 22,
        fontWeight: FontWeight.w800,
      ),
      contentTextStyle: _bodyStyle(
        language,
        color: bodyColor,
        fontSize: 16,
        height: 1.42,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: borderColor),
      ),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor:
          isDark ? AppColors.darkSurfaceRaised : AppColors.offWhite,
      modalBackgroundColor:
          isDark ? AppColors.darkSurfaceRaised : AppColors.offWhite,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
        side: BorderSide(color: borderColor),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: isDark ? AppColors.darkSurfaceRaised : AppColors.offWhite,
      labelStyle: TextStyle(color: bodyColor),
      hintStyle: TextStyle(color: bodyColor),
      prefixIconColor: isDark ? AppColors.darkGold : AppColors.maroon,
      suffixIconColor: isDark ? AppColors.darkGold : AppColors.maroon,
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: BorderSide(color: borderColor),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: BorderSide(color: primaryColor, width: 1.5),
      ),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: isDark ? AppColors.darkRose : AppColors.rose,
      selectedColor: primaryColor,
      disabledColor: isDark ? AppColors.darkSurfaceSoft : AppColors.border,
      labelStyle: TextStyle(color: foregroundColor),
      secondaryLabelStyle: TextStyle(
        color: isDark ? AppColors.darkCanvas : AppColors.cream,
      ),
      side: BorderSide(color: borderColor),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor:
          isDark ? AppColors.darkSurfaceRaised : AppColors.offWhite,
      indicatorColor: isDark ? AppColors.darkRose : AppColors.rose,
      iconTheme: WidgetStateProperty.resolveWith((states) {
        return IconThemeData(
          color:
              states.contains(WidgetState.selected) ? primaryColor : bodyColor,
        );
      }),
      labelTextStyle: WidgetStateProperty.resolveWith((states) {
        return TextStyle(
          color:
              states.contains(WidgetState.selected) ? primaryColor : bodyColor,
          fontWeight: FontWeight.w800,
        );
      }),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor:
          isDark ? AppColors.darkSurfaceSoft : AppColors.deepCrimson,
      contentTextStyle: TextStyle(
        color: isDark ? AppColors.darkInk : AppColors.cream,
      ),
      actionTextColor: isDark ? AppColors.darkGold : AppColors.softGold,
    ),
    iconTheme: IconThemeData(
      color: isDark ? AppColors.darkTaupe : AppColors.taupe,
    ),
    dividerTheme: DividerThemeData(color: borderColor),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) return primaryColor;
        return isDark ? AppColors.darkTaupe : AppColors.muted;
      }),
      trackColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) {
          return isDark ? AppColors.darkRose : AppColors.softGold;
        }
        return isDark ? AppColors.darkSurfaceSoft : AppColors.border;
      }),
    ),
    textTheme: textTheme.copyWith(
      displayLarge: _headingStyle(
        language,
        fontSize: 40,
        fontWeight: FontWeight.w800,
        color: foregroundColor,
        height: 1.04,
      ),
      headlineMedium: _headingStyle(
        language,
        fontSize: 27,
        fontWeight: FontWeight.w800,
        color: foregroundColor,
        height: 1.12,
      ),
      titleLarge: _bodyStyle(
        language,
        fontSize: 21,
        fontWeight: FontWeight.w800,
        color: foregroundColor,
      ),
      bodyLarge: _bodyStyle(
        language,
        fontSize: 18,
        height: 1.42,
        color: bodyColor,
      ),
    ),
  );
}

class AppLanguagePreference {
  static AppLanguage fromValue(String? value) {
    return value == AppLanguage.hindi.name
        ? AppLanguage.hindi
        : AppLanguage.english;
  }
}

class AppThemeModePreference {
  static ThemeMode fromValue(String? value) {
    return value == ThemeMode.dark.name ? ThemeMode.dark : ThemeMode.light;
  }
}

class _LanguageLoadingScreen extends StatelessWidget {
  const _LanguageLoadingScreen();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          const Positioned.fill(child: _SacredBackground()),
          Center(
            child: CircularProgressIndicator(
              color: _primaryActionColor(),
              backgroundColor: _surfaceColor(AppColors.rose),
            ),
          ),
        ],
      ),
    );
  }
}

class _FirstLaunchLanguageScreen extends StatelessWidget {
  const _FirstLaunchLanguageScreen({required this.onSelected});

  final ValueChanged<AppLanguage> onSelected;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          const Positioned.fill(child: _SacredBackground()),
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 460),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Center(
                        child: SizedBox(
                          width: 126,
                          height: 126,
                          child: const _AppIconMark(),
                        ),
                      ),
                      const SizedBox(height: 28),
                      Text(
                        'Choose the language of your journey',
                        textAlign: TextAlign.center,
                        style: GoogleFonts.lora(
                          color: _readableColor(AppColors.ink),
                          fontSize: 31,
                          fontWeight: FontWeight.w800,
                          height: 1.12,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'अपने साधना-पथ की भाषा चुनें',
                        textAlign: TextAlign.center,
                        style: GoogleFonts.notoSerifDevanagari(
                          color: _readableColor(AppColors.maroon),
                          fontSize: 27,
                          fontWeight: FontWeight.w800,
                          height: 1.35,
                        ),
                      ),
                      const SizedBox(height: 30),
                      _LanguageChoiceButton(
                        iconText: 'A',
                        title: 'English',
                        onTap: () => onSelected(AppLanguage.english),
                      ),
                      const SizedBox(height: 14),
                      _LanguageChoiceButton(
                        iconText: 'अ',
                        title: 'हिन्दी',
                        hindi: true,
                        onTap: () => onSelected(AppLanguage.hindi),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _LanguageChoiceButton extends StatelessWidget {
  const _LanguageChoiceButton({
    required this.iconText,
    required this.title,
    required this.onTap,
    this.hindi = false,
  });

  final String iconText;
  final String title;
  final VoidCallback onTap;
  final bool hindi;

  @override
  Widget build(BuildContext context) {
    final titleStyle = hindi
        ? GoogleFonts.notoSansDevanagari(
            color: _readableColor(AppColors.ink),
            fontSize: 19,
            fontWeight: FontWeight.w800,
          )
        : GoogleFonts.inter(
            color: _readableColor(AppColors.ink),
            fontSize: 18,
            fontWeight: FontWeight.w800,
          );

    return Material(
      color: _raisedSurfaceColor(),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: BorderSide(color: _borderColor(AppColors.borderStrong)),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 78),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
            child: Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: _surfaceColor(AppColors.rose),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    iconText,
                    style: hindi
                        ? GoogleFonts.notoSerifDevanagari(
                            color: _readableColor(AppColors.maroon),
                            fontSize: 24,
                            fontWeight: FontWeight.w900,
                          )
                        : GoogleFonts.lora(
                            color: _readableColor(AppColors.maroon),
                            fontSize: 23,
                            fontWeight: FontWeight.w900,
                          ),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Text(title, style: titleStyle),
                ),
                Icon(
                  Icons.arrow_forward_rounded,
                  color: _readableColor(AppColors.maroon),
                  size: 26,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class LanguageScope extends InheritedWidget {
  const LanguageScope({
    required this.language,
    required this.onChanged,
    required super.child,
    super.key,
  });

  final AppLanguage language;
  final ValueChanged<AppLanguage> onChanged;

  static LanguageScope of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<LanguageScope>();
    assert(scope != null, 'LanguageScope was not found in the widget tree.');
    return scope!;
  }

  @override
  bool updateShouldNotify(LanguageScope oldWidget) {
    return language != oldWidget.language || onChanged != oldWidget.onChanged;
  }
}

class AppearanceScope extends InheritedWidget {
  const AppearanceScope({
    required this.themeMode,
    required this.onChanged,
    required super.child,
    super.key,
  });

  final ThemeMode themeMode;
  final ValueChanged<ThemeMode> onChanged;

  bool get isDark => themeMode == ThemeMode.dark;

  static AppearanceScope of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<AppearanceScope>();
    assert(scope != null, 'AppearanceScope was not found in the widget tree.');
    return scope!;
  }

  @override
  bool updateShouldNotify(AppearanceScope oldWidget) {
    return themeMode != oldWidget.themeMode || onChanged != oldWidget.onChanged;
  }
}

String appText(BuildContext context, String english, String hindi) {
  return LanguageScope.of(context).language == AppLanguage.hindi
      ? hindi
      : english;
}

TextStyle _headingStyle(
  AppLanguage language, {
  Color? color,
  double? fontSize,
  FontWeight? fontWeight,
  double? height,
}) {
  final resolvedColor = _readableColor(color);
  if (language == AppLanguage.hindi) {
    return GoogleFonts.notoSerifDevanagari(
      color: resolvedColor,
      fontSize: fontSize,
      fontWeight: fontWeight,
      height: height,
    );
  }
  return GoogleFonts.lora(
    color: resolvedColor,
    fontSize: fontSize,
    fontWeight: fontWeight,
    height: height,
  );
}

TextStyle _bodyStyle(
  AppLanguage language, {
  Color? color,
  double? fontSize,
  FontWeight? fontWeight,
  double? height,
}) {
  final resolvedColor = _readableColor(color);
  if (language == AppLanguage.hindi) {
    return GoogleFonts.notoSansDevanagari(
      color: resolvedColor,
      fontSize: fontSize,
      fontWeight: fontWeight,
      height: height,
    );
  }
  return GoogleFonts.inter(
    color: resolvedColor,
    fontSize: fontSize,
    fontWeight: fontWeight,
    height: height,
  );
}

class DevoteeProfile {
  const DevoteeProfile({
    required this.firstName,
    this.middleName = '',
    this.lastName = '',
  });

  final String firstName;
  final String middleName;
  final String lastName;

  String get displayName => firstName;

  String get fullName => [
        firstName,
        middleName,
        lastName,
      ].where((part) => part.trim().isNotEmpty).join(' ');

  Map<String, String> toJson() => {
        'firstName': firstName,
        'middleName': middleName,
        'lastName': lastName,
      };

  static DevoteeProfile? fromMap(Object? value) {
    if (value is! Map) return null;
    final structured = fromParts(
      firstName: value['firstName']?.toString() ?? '',
      middleName: value['middleName']?.toString() ?? '',
      lastName: value['lastName']?.toString() ?? '',
    );
    if (structured != null) return structured;

    return fromStoredValue(value['name']?.toString());
  }

  static DevoteeProfile? fromParts({
    required String firstName,
    required String middleName,
    required String lastName,
  }) {
    final first = _cleanNamePart(firstName);
    if (first.isEmpty) return null;

    return DevoteeProfile(
      firstName: first,
      middleName: _cleanNamePart(middleName),
      lastName: _cleanNamePart(lastName),
    );
  }

  static DevoteeProfile? fromStoredValue(String? value) {
    final clean = value?.trim();
    if (clean == null || clean.isEmpty) return null;

    if (clean.startsWith('{')) {
      try {
        final decoded = jsonDecode(clean);
        final profile = fromMap(decoded);
        if (profile != null) return profile;
      } catch (_) {
        return null;
      }
    }

    final parts = clean.split(RegExp(r'\s+'));
    if (parts.isEmpty) return null;
    if (parts.length == 1) {
      return fromParts(firstName: parts.first, middleName: '', lastName: '');
    }
    if (parts.length == 2) {
      return fromParts(
          firstName: parts.first, middleName: '', lastName: parts.last);
    }

    return fromParts(
      firstName: parts.first,
      middleName: parts.sublist(1, parts.length - 1).join(' '),
      lastName: parts.last,
    );
  }
}

DevoteeProfile? profileForAuthenticatedProvider({
  required Iterable<String> providerIds,
  String? displayName,
}) {
  if (!providerIds.contains(AppleAuthProvider.PROVIDER_ID)) return null;

  // Apple supplies the user's name only on the first authorization. Firebase
  // normally preserves it as displayName, but returning Apple users may not
  // have one. They must still be able to enter the app without being asked to
  // provide identity information that Sign in with Apple already handles.
  return DevoteeProfile.fromStoredValue(displayName) ??
      const DevoteeProfile(firstName: 'Devotee');
}

class SatsangTrack {
  const SatsangTrack({
    required this.id,
    required this.session,
    required this.title,
    required this.description,
    required this.durationLabel,
    this.audioUrl,
    this.assetPath,
    this.active = true,
    this.createdAt,
  });

  final String id;
  final SatsangSession session;
  final String title;
  final String description;
  final String durationLabel;
  final String? audioUrl;
  final String? assetPath;
  final bool active;
  final int? createdAt;

  factory SatsangTrack.fromEntry(String id, Map<dynamic, dynamic> value) {
    return SatsangTrack(
      id: id,
      session: _satsangSessionFromValue(value['session']),
      title: (value['title'] ?? 'Satsang').toString(),
      description: (value['description'] ?? 'Sacred audio for daily practice.')
          .toString(),
      durationLabel: (value['durationLabel'] ?? '00:00').toString(),
      audioUrl: value['audioUrl']?.toString(),
      active: value['active'] != false,
      createdAt: value['createdAt'] is int ? value['createdAt'] as int : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'session': session.name,
      'title': title,
      'description': description,
      'durationLabel': durationLabel,
      'audioUrl': audioUrl,
      'active': active,
      'createdAt': createdAt,
    };
  }
}

class WisdomQuote {
  const WisdomQuote({
    required this.id,
    required this.text,
    this.textHindi = '',
    this.author = 'Maharshi Mehi Paramhans',
    this.authorHindi = 'महर्षि मेँहीँ परमहंस',
    this.active = true,
    this.createdAt,
    this.scheduledDate,
  });

  final String id;
  final String text;
  final String textHindi;
  final String author;
  final String authorHindi;
  final bool active;
  final int? createdAt;
  final String? scheduledDate;

  WisdomQuote copyWith({String? scheduledDate}) {
    return WisdomQuote(
      id: id,
      text: text,
      textHindi: textHindi,
      author: author,
      authorHindi: authorHindi,
      active: active,
      createdAt: createdAt,
      scheduledDate: scheduledDate ?? this.scheduledDate,
    );
  }

  factory WisdomQuote.fromEntry(String id, Map<dynamic, dynamic> value) {
    final rawAuthor =
        (value['authorEnglish'] ?? value['author'] ?? '').toString().trim();
    final rawAuthorHindi = (value['authorHindi'] ?? '').toString().trim();

    return WisdomQuote(
      id: id,
      text: (value['textEnglish'] ?? value['text'] ?? '').toString(),
      textHindi: (value['textHindi'] ?? '').toString(),
      author: rawAuthor.isEmpty || rawAuthor == 'Sadguru Maharaj'
          ? 'Maharshi Mehi Paramhans'
          : rawAuthor,
      authorHindi: rawAuthorHindi.isEmpty || rawAuthorHindi == 'सद्गुरु महाराज'
          ? 'महर्षि मेँहीँ परमहंस'
          : rawAuthorHindi,
      active: value['active'] != false,
      createdAt: value['createdAt'] is int ? value['createdAt'] as int : null,
      scheduledDate: value['scheduledDate']?.toString(),
    );
  }
}

class QuoteTimeline {
  const QuoteTimeline({
    required this.daily,
    required this.archive,
    required this.upcoming,
  });

  final WisdomQuote? daily;
  final List<WisdomQuote> archive;
  final List<WisdomQuote> upcoming;
}

DateTime _dateOnly(DateTime value) =>
    DateTime(value.year, value.month, value.day);

String quoteDateKey(DateTime value) =>
    DateFormat('yyyy-MM-dd').format(_dateOnly(value));

DateTime? quoteScheduledDay(WisdomQuote quote) {
  final parsed = DateTime.tryParse(quote.scheduledDate ?? '');
  return parsed == null ? null : _dateOnly(parsed);
}

List<WisdomQuote> quotesWithSchedule(List<WisdomQuote> quotes) {
  final ordered = [...quotes]
    ..sort((a, b) => (b.createdAt ?? 0).compareTo(a.createdAt ?? 0));
  final legacyStart = DateTime.parse(_legacyQuoteScheduleStart);
  final reservedDays = ordered
      .map(quoteScheduledDay)
      .whereType<DateTime>()
      .where((day) => !day.isBefore(legacyStart))
      .map(quoteDateKey)
      .toSet();
  final assignedDays = <String>{};
  var nextLegacyDay = legacyStart;

  return ordered.map((quote) {
    final existingDay = quoteScheduledDay(quote);
    final existingKey = existingDay == null ? null : quoteDateKey(existingDay);
    if (existingDay != null &&
        !existingDay.isBefore(legacyStart) &&
        existingKey != null &&
        assignedDays.add(existingKey)) {
      return quote;
    }

    var scheduledKey = quoteDateKey(nextLegacyDay);
    while (reservedDays.contains(scheduledKey) ||
        assignedDays.contains(scheduledKey)) {
      nextLegacyDay = nextLegacyDay.add(const Duration(days: 1));
      scheduledKey = quoteDateKey(nextLegacyDay);
    }
    final scheduled = nextLegacyDay;
    assignedDays.add(scheduledKey);
    nextLegacyDay = nextLegacyDay.add(const Duration(days: 1));
    return quote.copyWith(scheduledDate: quoteDateKey(scheduled));
  }).toList(growable: false);
}

QuoteTimeline quoteTimelineForDate(
  List<WisdomQuote> quotes, {
  DateTime? now,
}) {
  final day = _dateOnly(now ?? DateTime.now());
  final scheduled = quotesWithSchedule(quotes);
  WisdomQuote? daily;
  final archive = <WisdomQuote>[];
  final upcoming = <WisdomQuote>[];

  for (final quote in scheduled) {
    final quoteDay = quoteScheduledDay(quote);
    if (quoteDay == null) continue;
    final comparison = quoteDay.compareTo(day);
    if (comparison == 0 && daily == null) {
      daily = quote;
    } else if (comparison < 0) {
      archive.add(quote);
    } else if (comparison > 0) {
      upcoming.add(quote);
    }
  }

  int newestFirst(WisdomQuote a, WisdomQuote b) =>
      quoteScheduledDay(b)!.compareTo(quoteScheduledDay(a)!);
  int oldestFirst(WisdomQuote a, WisdomQuote b) =>
      quoteScheduledDay(a)!.compareTo(quoteScheduledDay(b)!);
  archive.sort(newestFirst);
  upcoming.sort(oldestFirst);

  return QuoteTimeline(daily: daily, archive: archive, upcoming: upcoming);
}

DateTime nextQuoteScheduleDate(
  List<WisdomQuote> quotes, {
  DateTime? now,
}) {
  final today = _dateOnly(now ?? DateTime.now());
  var next = today;
  for (final quote in quotesWithSchedule(quotes)) {
    final scheduled = quoteScheduledDay(quote);
    if (scheduled != null && !scheduled.isBefore(next)) {
      next = scheduled.add(const Duration(days: 1));
    }
  }
  return next;
}

class RoutineStats {
  const RoutineStats({
    required this.current,
    required this.best,
    required this.total,
    required this.daysToMilestone,
  });

  final int current;
  final int best;
  final int total;
  final int daysToMilestone;
}

Map<String, Map<String, bool>> routineRecordsFromValue(Object? value) {
  if (value is! Map) return {};

  return value.map((date, rawTasks) {
    if (rawTasks is! Map) {
      return MapEntry(date.toString(), <String, bool>{});
    }
    return MapEntry(
      date.toString(),
      rawTasks.map(
        (task, complete) => MapEntry(task.toString(), complete == true),
      ),
    );
  });
}

RoutineStats routineStatsFromRecords(
  Map<String, Map<String, bool>> records, {
  DateTime? now,
}) {
  final completeKeys = records.entries
      .where((entry) => entry.value[RoutineTask.meditation.name] == true)
      .map((entry) => entry.key)
      .where((key) => DateTime.tryParse(key) != null)
      .toList()
    ..sort();

  var best = 0;
  var run = 0;
  DateTime? previous;
  for (final key in completeKeys) {
    final current = DateTime.parse(key);
    if (previous != null && current.difference(previous).inDays == 1) {
      run++;
    } else {
      run = 1;
    }
    best = max(best, run);
    previous = current;
  }

  var cursor = now ?? DateTime.now();
  String keyFor(DateTime value) => DateFormat('yyyy-MM-dd').format(value);
  if (records[keyFor(cursor)]?[RoutineTask.meditation.name] != true) {
    cursor = cursor.subtract(const Duration(days: 1));
  }

  var current = 0;
  while (records[keyFor(cursor)]?[RoutineTask.meditation.name] == true) {
    current++;
    cursor = cursor.subtract(const Duration(days: 1));
  }

  const milestones = [7, 21, 40, 90, 108, 365];
  final next = milestones.firstWhere(
    (item) => item > current,
    orElse: () => current + 108,
  );
  return RoutineStats(
    current: current,
    best: best,
    total: completeKeys.length,
    daysToMilestone: next - current,
  );
}

class DevoteeActivityEvent {
  const DevoteeActivityEvent({
    required this.id,
    required this.type,
    required this.timestamp,
    this.label = '',
    this.contentId = '',
    this.durationSeconds = 0,
    this.plannedDurationSeconds = 0,
    this.completed = false,
  });

  final String id;
  final String type;
  final int timestamp;
  final String label;
  final String contentId;
  final int durationSeconds;
  final int plannedDurationSeconds;
  final bool completed;

  DateTime get occurredAt =>
      DateTime.fromMillisecondsSinceEpoch(timestamp, isUtc: false);

  factory DevoteeActivityEvent.fromEntry(
    String id,
    Map<dynamic, dynamic> value,
  ) {
    int integerValue(String key) {
      final raw = value[key];
      return raw is num ? raw.toInt() : int.tryParse('$raw') ?? 0;
    }

    return DevoteeActivityEvent(
      id: id,
      type: (value['type'] ?? '').toString(),
      timestamp: integerValue('timestamp'),
      label: (value['label'] ?? '').toString(),
      contentId: (value['contentId'] ?? '').toString(),
      durationSeconds: max(0, integerValue('durationSeconds')),
      plannedDurationSeconds: max(0, integerValue('plannedDurationSeconds')),
      completed: value['completed'] == true,
    );
  }

  Map<String, Object> toJson() => {
        'type': type,
        'timestamp': timestamp,
        if (label.isNotEmpty) 'label': label,
        if (contentId.isNotEmpty) 'contentId': contentId,
        if (durationSeconds > 0) 'durationSeconds': durationSeconds,
        if (plannedDurationSeconds > 0)
          'plannedDurationSeconds': plannedDurationSeconds,
        if (completed) 'completed': true,
      };
}

List<DevoteeActivityEvent> devoteeActivityEventsFromValue(Object? value) {
  if (value is! Map) return const [];
  final events = value.entries
      .where((entry) => entry.value is Map)
      .map(
        (entry) => DevoteeActivityEvent.fromEntry(
          entry.key.toString(),
          Map<dynamic, dynamic>.from(entry.value as Map),
        ),
      )
      .where((event) => event.type.isNotEmpty && event.timestamp > 0)
      .toList()
    ..sort((a, b) => b.timestamp.compareTo(a.timestamp));
  return events;
}

class SacredDayActivity {
  SacredDayActivity(this.date);

  final DateTime date;
  bool morningSatsang = false;
  bool eveningSatsang = false;
  bool meditation = false;
  int morningSatsangSeconds = 0;
  int eveningSatsangSeconds = 0;
  int otherSatsangSeconds = 0;
  int meditationSeconds = 0;

  bool get hasSatsang =>
      morningSatsang || eveningSatsang || otherSatsangSeconds > 0;
  bool get hasAny => hasSatsang || meditation;
  bool get bothSatsangs => morningSatsang && eveningSatsang;
  int get totalSatsangSeconds =>
      morningSatsangSeconds + eveningSatsangSeconds + otherSatsangSeconds;
}

Map<String, SacredDayActivity> sacredActivityHistory({
  required Map<String, Map<String, bool>> records,
  required Iterable<DevoteeActivityEvent> events,
}) {
  final history = <String, SacredDayActivity>{};

  SacredDayActivity dayFor(DateTime date) {
    final normalized = _dateOnly(date);
    final key = DateFormat('yyyy-MM-dd').format(normalized);
    return history.putIfAbsent(key, () => SacredDayActivity(normalized));
  }

  for (final entry in records.entries) {
    final date = DateTime.tryParse(entry.key);
    if (date == null) continue;
    final day = dayFor(date);
    day.morningSatsang = entry.value[RoutineTask.morningSatsang.name] == true;
    day.eveningSatsang = entry.value[RoutineTask.eveningSatsang.name] == true;
    day.meditation = entry.value[RoutineTask.meditation.name] == true;
  }

  for (final event in events) {
    final day = dayFor(event.occurredAt);
    if (event.type == 'meditation_session') {
      day.meditation =
          day.meditation || event.completed || event.durationSeconds > 0;
      day.meditationSeconds += event.durationSeconds;
      continue;
    }
    if (event.type != 'satsang_listened') continue;
    final label = event.label.toLowerCase();
    if (label.startsWith('morning:')) {
      day.morningSatsang = true;
      day.morningSatsangSeconds += event.durationSeconds;
    } else if (label.startsWith('evening:')) {
      day.eveningSatsang = true;
      day.eveningSatsangSeconds += event.durationSeconds;
    } else {
      day.otherSatsangSeconds += event.durationSeconds;
    }
  }

  return history;
}

enum SacredStreakKind {
  fullPractice,
  satsangAndMeditation,
  bothSatsangs,
  meditation,
  morningSatsang,
  eveningSatsang,
}

bool sacredActivityMatchesKind(
  SacredDayActivity? day,
  SacredStreakKind kind,
) {
  if (day == null) return false;
  return switch (kind) {
    SacredStreakKind.fullPractice => day.bothSatsangs && day.meditation,
    SacredStreakKind.satsangAndMeditation => day.hasSatsang && day.meditation,
    SacredStreakKind.bothSatsangs => day.bothSatsangs,
    SacredStreakKind.meditation => day.meditation,
    SacredStreakKind.morningSatsang => day.morningSatsang,
    SacredStreakKind.eveningSatsang => day.eveningSatsang,
  };
}

int sacredActivityDaysForKind(
  Map<String, SacredDayActivity> history,
  SacredStreakKind kind,
) {
  return history.values
      .where((day) => sacredActivityMatchesKind(day, kind))
      .length;
}

SacredStreakSummary sacredLongestStreakForKind({
  required Map<String, SacredDayActivity> history,
  required DateTime accountCreatedAt,
  required SacredStreakKind kind,
  DateTime? now,
}) {
  final today = _dateOnly(now ?? DateTime.now());
  final firstDay = _dateOnly(accountCreatedAt).isAfter(today)
      ? today
      : _dateOnly(accountCreatedAt);
  String keyFor(DateTime date) => DateFormat('yyyy-MM-dd').format(date);
  var cursor = firstDay;
  var runLength = 0;
  var bestLength = 0;
  DateTime? runStart;
  DateTime? bestStart;
  DateTime? bestEnd;

  while (!cursor.isAfter(today)) {
    if (sacredActivityMatchesKind(history[keyFor(cursor)], kind)) {
      runStart ??= cursor;
      runLength++;
      if (runLength > bestLength) {
        bestLength = runLength;
        bestStart = runStart;
        bestEnd = cursor;
      }
    } else {
      runLength = 0;
      runStart = null;
    }
    cursor = cursor.add(const Duration(days: 1));
  }

  if (bestLength == 0) return const SacredStreakSummary.empty();
  return SacredStreakSummary(
    length: bestLength,
    kind: kind,
    start: bestStart,
    end: bestEnd,
  );
}

class SacredStreakSummary {
  const SacredStreakSummary({
    required this.length,
    required this.kind,
    this.start,
    this.end,
  });

  const SacredStreakSummary.empty()
      : length = 0,
        kind = SacredStreakKind.meditation,
        start = null,
        end = null;

  final int length;
  final SacredStreakKind kind;
  final DateTime? start;
  final DateTime? end;
}

class SacredStreakOverview {
  const SacredStreakOverview({required this.current, required this.longest});

  final SacredStreakSummary current;
  final SacredStreakSummary longest;
}

SacredStreakOverview sacredStreakOverviewFor({
  required Map<String, SacredDayActivity> history,
  required DateTime accountCreatedAt,
  DateTime? now,
}) {
  final today = _dateOnly(now ?? DateTime.now());
  final firstDay = _dateOnly(accountCreatedAt).isAfter(today)
      ? today
      : _dateOnly(accountCreatedAt);
  final kinds = SacredStreakKind.values;
  final candidates = <SacredStreakSummary>[];
  final currentCandidates = <SacredStreakSummary>[];
  String keyFor(DateTime date) => DateFormat('yyyy-MM-dd').format(date);

  bool matches(SacredStreakKind kind, DateTime date) =>
      sacredActivityMatchesKind(history[keyFor(date)], kind);

  for (final kind in kinds) {
    var cursor = firstDay;
    var runLength = 0;
    DateTime? runStart;
    while (!cursor.isAfter(today)) {
      if (matches(kind, cursor)) {
        runStart ??= cursor;
        runLength++;
      } else if (runLength > 0) {
        candidates.add(SacredStreakSummary(
          length: runLength,
          kind: kind,
          start: runStart,
          end: cursor.subtract(const Duration(days: 1)),
        ));
        runLength = 0;
        runStart = null;
      }
      cursor = cursor.add(const Duration(days: 1));
    }
    if (runLength > 0) {
      candidates.add(SacredStreakSummary(
        length: runLength,
        kind: kind,
        start: runStart,
        end: today,
      ));
    }

    var currentEnd = today;
    if (!matches(kind, currentEnd)) {
      currentEnd = currentEnd.subtract(const Duration(days: 1));
    }
    var currentLength = 0;
    var currentStart = currentEnd;
    while (!currentStart.isBefore(firstDay) && matches(kind, currentStart)) {
      currentLength++;
      currentStart = currentStart.subtract(const Duration(days: 1));
    }
    if (currentLength > 1) {
      currentCandidates.add(SacredStreakSummary(
        length: currentLength,
        kind: kind,
        start: currentStart.add(const Duration(days: 1)),
        end: currentEnd,
      ));
    }
  }

  int compare(SacredStreakSummary left, SacredStreakSummary right) {
    final lengthComparison = right.length.compareTo(left.length);
    if (lengthComparison != 0) return lengthComparison;
    return left.kind.index.compareTo(right.kind.index);
  }

  candidates.sort(compare);
  currentCandidates.sort(compare);
  return SacredStreakOverview(
    current: currentCandidates.isEmpty
        ? const SacredStreakSummary.empty()
        : currentCandidates.first,
    longest: candidates.isEmpty
        ? const SacredStreakSummary.empty()
        : candidates.first,
  );
}

class DevoteeActivity {
  const DevoteeActivity({
    required this.uid,
    required this.name,
    required this.email,
    required this.phone,
    required this.records,
    required this.events,
    required this.likedQuoteIds,
    this.createdAt,
    this.lastActiveAt,
  });

  final String uid;
  final String name;
  final String email;
  final String phone;
  final Map<String, Map<String, bool>> records;
  final List<DevoteeActivityEvent> events;
  final Set<String> likedQuoteIds;
  final int? createdAt;
  final int? lastActiveAt;

  factory DevoteeActivity.fromEntry(String uid, Map<dynamic, dynamic> value) {
    final profile = DevoteeProfile.fromMap(value['profile']) ??
        DevoteeProfile.fromMap(value);
    final name = profile?.fullName.trim().isNotEmpty == true
        ? profile!.fullName
        : (value['name'] ?? '').toString().trim();
    final rawActivity = value['activity'];
    final events = rawActivity is Map
        ? rawActivity.entries
            .where((entry) => entry.value is Map)
            .map(
              (entry) => DevoteeActivityEvent.fromEntry(
                entry.key.toString(),
                Map<dynamic, dynamic>.from(entry.value as Map),
              ),
            )
            .where((event) => event.type.isNotEmpty && event.timestamp > 0)
            .toList()
        : <DevoteeActivityEvent>[];
    events.sort((a, b) => b.timestamp.compareTo(a.timestamp));

    return DevoteeActivity(
      uid: uid,
      name: name.isEmpty ? 'Devotee' : name,
      email: (value['email'] ?? '').toString(),
      phone: (value['phone'] ?? '').toString(),
      records: routineRecordsFromValue(value['routine'] ?? value['records']),
      events: events,
      likedQuoteIds: value['likedQuotes'] is Map
          ? (value['likedQuotes'] as Map)
              .entries
              .where((entry) => entry.value == true)
              .map((entry) => entry.key.toString())
              .toSet()
          : <String>{},
      createdAt: value['createdAt'] is num
          ? (value['createdAt'] as num).toInt()
          : int.tryParse('${value['createdAt']}'),
      lastActiveAt:
          value['lastActiveAt'] is int ? value['lastActiveAt'] as int : null,
    );
  }

  RoutineStats get meditationStats => routineStatsFromRecords(records);

  int count(RoutineTask task) =>
      records.values.where((day) => day[task.name] == true).length;

  int durationFor(String eventType) => events
      .where((event) => event.type == eventType)
      .fold(0, (total, event) => total + event.durationSeconds);

  int eventCount(String eventType) =>
      events.where((event) => event.type == eventType).length;

  int get satsangSeconds => durationFor('satsang_listened');

  int get meditationSeconds => durationFor('meditation_session');

  int get quoteViews => eventCount('quote_viewed');

  int get quoteShares => eventCount('quote_shared');

  int get quoteLikes => likedQuoteIds.length;

  Map<String, SacredDayActivity> get sacredHistory => sacredActivityHistory(
        records: records,
        events: events,
      );

  DateTime get accountCreatedOn {
    final candidates = <int>[
      if (createdAt != null && createdAt! > 0) createdAt!,
      ...records.keys
          .map(DateTime.tryParse)
          .whereType<DateTime>()
          .map((date) => date.millisecondsSinceEpoch),
      ...events.map((event) => event.timestamp),
      if (lastActiveAt != null && lastActiveAt! > 0) lastActiveAt!,
    ];
    if (candidates.isEmpty) return _dateOnly(DateTime.now());
    return _dateOnly(
      DateTime.fromMillisecondsSinceEpoch(candidates.reduce(min)),
    );
  }

  bool activeOn(DateTime day) {
    final key = DateFormat('yyyy-MM-dd').format(day);
    if (records[key]?.values.contains(true) == true) return true;
    return events.any(
        (event) => DateFormat('yyyy-MM-dd').format(event.occurredAt) == key);
  }

  String get contact => email.trim().isNotEmpty
      ? email.trim()
      : phone.trim().isNotEmpty
          ? phone.trim()
          : uid;
}

List<DevoteeActivity> filterDevoteeActivities(
  Iterable<DevoteeActivity> users,
  String query,
) {
  final normalized = query.trim().toLowerCase();
  if (normalized.isEmpty) return users.toList(growable: false);
  return users
      .where((user) => [user.name, user.email, user.phone]
          .any((value) => value.toLowerCase().contains(normalized)))
      .toList(growable: false);
}

String formatActivityDuration(int totalSeconds) {
  final safeSeconds = max(0, totalSeconds);
  if (safeSeconds < 60) return '${safeSeconds}s';
  final hours = safeSeconds ~/ 3600;
  final minutes = (safeSeconds % 3600) ~/ 60;
  if (hours == 0) return '${minutes}m';
  return minutes == 0 ? '${hours}h' : '${hours}h ${minutes}m';
}

String _hindiDigits(String value) {
  const western = '0123456789';
  const devanagari = '०१२३४५६७८९';
  return value.split('').map((character) {
    final index = western.indexOf(character);
    return index < 0 ? character : devanagari[index];
  }).join();
}

String localizedActivityDuration(BuildContext context, int totalSeconds) {
  final value = formatActivityDuration(totalSeconds);
  if (LanguageScope.of(context).language != AppLanguage.hindi) return value;
  return _hindiDigits(
      value.replaceAll('h', 'घं').replaceAll('m', 'मि').replaceAll('s', 'से'));
}

const fallbackSatsangs = [
  SatsangTrack(
    id: 'local-morning',
    session: SatsangSession.morning,
    title: 'Morning Satsang',
    description: 'Awaken the day with the sacred Astuti of Rishikesh.',
    durationLabel: '57:10',
    assetPath: 'audio/morning_satsang_astuti_rishikesh.mp3',
  ),
  SatsangTrack(
    id: 'local-evening',
    session: SatsangSession.evening,
    title: 'Evening Satsang',
    description: 'Offer the evening to the complete sacred satsang.',
    durationLabel: '24:11',
    assetPath: 'audio/shaam_satsang_full.mp3',
  ),
  SatsangTrack(
    id: 'local-aarti',
    session: SatsangSession.aarti,
    title: 'Evening Aarti',
    description: 'Receive the evening in devotion and gratitude.',
    durationLabel: '08:46',
    assetPath: 'audio/shaam_aarti.mp3',
  ),
];

const fallbackQuotes = [
  WisdomQuote(
    id: 'quote-1',
    text:
        'Remember the Guru with a simple heart, and every step becomes worship.',
  ),
  WisdomQuote(
    id: 'quote-2',
    text: 'When the day opens and closes in satsang, the heart becomes gentle.',
  ),
  WisdomQuote(
    id: 'quote-3',
    text:
        'Meditation is not withdrawal from life; it is a return to the divine light within.',
  ),
];

List<WisdomQuote> wisdomQuotesFromFirebaseValue(
  Object? value, {
  required bool includeInactive,
  bool includeFallback = true,
}) {
  final parsed = value is Map
      ? value.entries
          .map((entry) {
            if (entry.value is! Map) return null;
            return WisdomQuote.fromEntry(
              entry.key.toString(),
              Map<dynamic, dynamic>.from(entry.value as Map),
            );
          })
          .whereType<WisdomQuote>()
          .where((item) =>
              item.text.trim().isNotEmpty || item.textHindi.trim().isNotEmpty)
          .toList()
      : <WisdomQuote>[];
  final remote = quotesWithSchedule(parsed)
      .where((item) => includeInactive || item.active)
      .toList(growable: false);

  if (remote.isNotEmpty || !includeFallback) return remote;
  return fallbackQuotes;
}

SatsangTrack localizedSatsangTrack(
  BuildContext context,
  SatsangTrack track,
) {
  if (LanguageScope.of(context).language != AppLanguage.hindi) return track;

  switch (track.id) {
    case 'local-morning':
      return SatsangTrack(
        id: track.id,
        session: track.session,
        title: 'प्रातः सत्संग',
        description: 'ऋषिकेश की पावन स्तुति से दिवस आरंभ करें।',
        durationLabel: track.durationLabel,
        assetPath: track.assetPath,
        audioUrl: track.audioUrl,
        active: track.active,
        createdAt: track.createdAt,
      );
    case 'local-evening':
      return SatsangTrack(
        id: track.id,
        session: track.session,
        title: 'सायं सत्संग',
        description: 'पूर्ण सायं सत्संग द्वारा दिवस को अंतःशांति में ले जाएँ।',
        durationLabel: track.durationLabel,
        assetPath: track.assetPath,
        audioUrl: track.audioUrl,
        active: track.active,
        createdAt: track.createdAt,
      );
    case 'local-aarti':
      return SatsangTrack(
        id: track.id,
        session: track.session,
        title: 'सायं आरती',
        description: 'भक्ति और कृतज्ञता से युक्त पावन सायं आरती।',
        durationLabel: track.durationLabel,
        assetPath: track.assetPath,
        audioUrl: track.audioUrl,
        active: track.active,
        createdAt: track.createdAt,
      );
    default:
      return track;
  }
}

WisdomQuote localizedWisdomQuote(
  BuildContext context,
  WisdomQuote quote,
) {
  if (LanguageScope.of(context).language != AppLanguage.hindi) return quote;

  if (quote.textHindi.trim().isNotEmpty) {
    return WisdomQuote(
      id: quote.id,
      text: quote.textHindi,
      textHindi: quote.textHindi,
      author: quote.authorHindi.trim().isEmpty
          ? 'महर्षि मेँहीँ परमहंस'
          : quote.authorHindi,
      authorHindi: quote.authorHindi,
      active: quote.active,
      createdAt: quote.createdAt,
      scheduledDate: quote.scheduledDate,
    );
  }

  switch (quote.id) {
    case 'quote-1':
      return WisdomQuote(
        id: quote.id,
        text: 'सरल हृदय से गुरु-स्मरण करें; प्रत्येक चरण पूजा बन जाता है।',
        author: 'महर्षि मेँहीँ परमहंस',
        active: quote.active,
        createdAt: quote.createdAt,
        scheduledDate: quote.scheduledDate,
      );
    case 'quote-2':
      return WisdomQuote(
        id: quote.id,
        text: 'दिवस का आरंभ और समापन सत्संग में हो तो हृदय कोमल हो जाता है।',
        author: 'महर्षि मेँहीँ परमहंस',
        active: quote.active,
        createdAt: quote.createdAt,
        scheduledDate: quote.scheduledDate,
      );
    case 'quote-3':
      return WisdomQuote(
        id: quote.id,
        text:
            'ध्यान जीवन से विमुखता नहीं; यह अंतःस्थित दिव्य प्रकाश में पुनरागमन है।',
        author: 'महर्षि मेँहीँ परमहंस',
        active: quote.active,
        createdAt: quote.createdAt,
        scheduledDate: quote.scheduledDate,
      );
    default:
      if (quote.author == 'Maharshi Mehi Paramhans' ||
          quote.author == 'Sadguru Maharaj') {
        return WisdomQuote(
          id: quote.id,
          text: quote.text,
          author: 'महर्षि मेँहीँ परमहंस',
          active: quote.active,
          createdAt: quote.createdAt,
          scheduledDate: quote.scheduledDate,
        );
      }
      return quote;
  }
}

String wisdomQuoteShareText(BuildContext context, WisdomQuote quote) {
  final heading = appText(
    context,
    'A sacred thought from Guru Vandan',
    'गुरु वंदन का पावन वचन',
  );
  return '$heading\n\n“${quote.text}”\n\n— ${quote.author}\n\n${wisdomQuoteShareLink(quote)}';
}

String wisdomQuoteShareLink(WisdomQuote quote) =>
    '$appShareLink/quote/${Uri.encodeComponent(quote.id)}/';

String? quoteIdFromUri(Uri uri) {
  if (uri.scheme == 'guruvandan' && uri.host == 'quote') {
    return uri.pathSegments.isEmpty ? null : uri.pathSegments.first;
  }

  final quoteIndex = uri.pathSegments.indexOf('quote');
  if ((uri.scheme == 'https' || uri.scheme == 'http') &&
      quoteIndex >= 0 &&
      quoteIndex + 1 < uri.pathSegments.length) {
    return uri.pathSegments[quoteIndex + 1];
  }

  return uri.queryParameters['quote'];
}

Future<bool> shareWisdomQuote(BuildContext context, WisdomQuote quote) async {
  final renderBox = context.findRenderObject();
  final origin = renderBox is RenderBox
      ? renderBox.localToGlobal(Offset.zero) & renderBox.size
      : null;
  final shareText = wisdomQuoteShareText(context, quote);
  final unavailableText = appText(
    context,
    'Sharing is not available on this device right now.',
    'इस उपकरण पर अभी साझा करने की सुविधा उपलब्ध नहीं है।',
  );

  try {
    final cardBytes = await _buildWisdomShareCard(quote);
    await SharePlus.instance.share(
      ShareParams(
        text: shareText,
        subject: 'Guru Vandan',
        files: [
          XFile.fromData(
            cardBytes,
            mimeType: 'image/png',
            name: 'guru-vandan-${quote.id}.png',
          ),
        ],
        sharePositionOrigin: origin,
      ),
    );
    return true;
  } catch (_) {
    try {
      await SharePlus.instance.share(
        ShareParams(
          text: shareText,
          subject: 'Guru Vandan',
          sharePositionOrigin: origin,
        ),
      );
      return true;
    } catch (_) {}
    if (!context.mounted) return false;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          unavailableText,
        ),
      ),
    );
    return false;
  }
}

Future<Uint8List> _buildWisdomShareCard(WisdomQuote quote) async {
  const width = 1080.0;
  const height = 1350.0;
  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder);
  final bounds = const Rect.fromLTWH(0, 0, width, height);
  final background = Paint()
    ..shader = ui.Gradient.linear(
      const Offset(0, 0),
      const Offset(width, height),
      const [Color(0xFFFFFBF3), Color(0xFFF2E5D2)],
    );
  canvas.drawRect(bounds, background);

  final panel = RRect.fromRectAndRadius(
    const Rect.fromLTWH(38, 38, 1004, 1274),
    const Radius.circular(38),
  );
  canvas.drawRRect(panel, Paint()..color = const Color(0xFFFFFDF9));
  canvas.drawRRect(
    panel,
    Paint()
      ..color = const Color(0xFFD8C4AD)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2,
  );

  final portraitData = await rootBundle.load('assets/images/guru_image.jpeg');
  final portraitCodec = await ui.instantiateImageCodec(
    portraitData.buffer.asUint8List(),
    targetWidth: 1004,
  );
  final portraitFrame = await portraitCodec.getNextFrame();
  final portraitClip = RRect.fromRectAndCorners(
    const Rect.fromLTWH(38, 38, 1004, 530),
    topLeft: const Radius.circular(38),
    topRight: const Radius.circular(38),
  );
  canvas.save();
  canvas.clipRRect(portraitClip);
  paintImage(
    canvas: canvas,
    rect: portraitClip.outerRect,
    image: portraitFrame.image,
    fit: BoxFit.cover,
    alignment: Alignment.topCenter,
    filterQuality: FilterQuality.high,
  );
  canvas.drawRect(
    const Rect.fromLTWH(38, 330, 1004, 238),
    Paint()
      ..shader = ui.Gradient.linear(
        const Offset(0, 330),
        const Offset(0, 568),
        const [Color(0x001F0D0C), Color(0xC73C1014)],
      ),
  );
  canvas.restore();

  canvas.drawRRect(
    RRect.fromRectAndRadius(
      const Rect.fromLTWH(68, 64, 350, 74),
      const Radius.circular(20),
    ),
    Paint()..color = const Color(0xB83C1014),
  );

  final logoData = await rootBundle.load('assets/images/chakra_logo.png');
  final codec = await ui.instantiateImageCodec(
    logoData.buffer.asUint8List(),
    targetWidth: 92,
    targetHeight: 116,
  );
  final logoFrame = await codec.getNextFrame();

  void drawText(
    String value,
    Rect area,
    TextStyle textStyle, {
    int? maxLines,
    TextAlign align = TextAlign.left,
  }) {
    final painter = TextPainter(
      text: TextSpan(text: value, style: textStyle),
      textDirection: ui.TextDirection.ltr,
      textAlign: align,
      maxLines: maxLines,
      ellipsis: maxLines == null ? null : '…',
    )..layout(maxWidth: area.width);
    painter.paint(
      canvas,
      Offset(area.left, area.top + ((area.height - painter.height) / 2)),
    );
  }

  drawText(
    'GURU VANDAN',
    const Rect.fromLTWH(94, 76, 300, 48),
    const TextStyle(
      color: Color(0xFFFFE6A8),
      fontSize: 28,
      fontWeight: FontWeight.w800,
      letterSpacing: 3.2,
      shadows: [
        Shadow(
          color: Color(0x99000000),
          offset: Offset(0, 2),
          blurRadius: 5,
        ),
      ],
    ),
  );
  drawText(
    '“',
    const Rect.fromLTWH(420, 574, 240, 92),
    const TextStyle(
      color: Color(0xFFD4A446),
      fontSize: 108,
      fontWeight: FontWeight.w700,
      height: 0.85,
    ),
    maxLines: 1,
    align: TextAlign.center,
  );

  final quoteSize = quote.text.length < 105
      ? 55.0
      : quote.text.length < 180
          ? 45.0
          : quote.text.length < 260
              ? 37.0
              : 31.0;
  drawText(
    quote.text,
    const Rect.fromLTWH(112, 655, 856, 346),
    TextStyle(
      color: const Color(0xFF2B211F),
      fontSize: quoteSize,
      fontWeight: FontWeight.w700,
      height: 1.28,
    ),
    maxLines: 7,
    align: TextAlign.center,
  );
  final containsHindi = RegExp(r'[\u0900-\u097F]').hasMatch(quote.text);
  drawText(
    containsHindi ? 'परमहंस महर्षि मेँहीँ' : 'Paramhans Maharshi Mehi',
    const Rect.fromLTWH(140, 1017, 800, 56),
    TextStyle(
      color: Color(0xFF7B171D),
      fontSize: containsHindi ? 31 : 28,
      fontWeight: FontWeight.w800,
      letterSpacing: containsHindi ? 0 : 1.1,
    ),
    maxLines: 2,
    align: TextAlign.center,
  );

  canvas.drawLine(
    const Offset(160, 1120),
    const Offset(920, 1120),
    Paint()
      ..color = const Color(0xFFE2D3C2)
      ..strokeWidth = 2,
  );

  const footerLogoRect = Rect.fromLTWH(294, 1150, 76, 104);
  paintImage(
    canvas: canvas,
    rect: footerLogoRect,
    image: logoFrame.image,
    fit: BoxFit.contain,
    filterQuality: FilterQuality.high,
  );
  drawText(
    'SHARED FROM',
    const Rect.fromLTWH(398, 1160, 390, 30),
    const TextStyle(
      color: Color(0xFF806D63),
      fontSize: 18,
      fontWeight: FontWeight.w700,
      letterSpacing: 5,
    ),
    maxLines: 1,
  );
  drawText(
    'Guru Vandan App',
    const Rect.fromLTWH(396, 1196, 470, 58),
    const TextStyle(
      color: Color(0xFF3C1014),
      fontSize: 38,
      fontWeight: FontWeight.w800,
    ),
    maxLines: 1,
  );

  final image = await recorder.endRecording().toImage(
        width.toInt(),
        height.toInt(),
      );
  final png = await image.toByteData(format: ui.ImageByteFormat.png);
  portraitFrame.image.dispose();
  logoFrame.image.dispose();
  image.dispose();
  if (png == null) throw StateError('Could not create the quote share card.');
  return png.buffer.asUint8List();
}

class FirebaseContentService {
  FirebaseContentService(
    this.ready, {
    Future<List<WisdomQuote>> Function()? quoteLoader,
  }) : _quoteLoader = quoteLoader;

  final bool ready;
  final Future<List<WisdomQuote>> Function()? _quoteLoader;
  final StreamController<List<WisdomQuote>> _quoteUpdates =
      StreamController<List<WisdomQuote>>.broadcast();
  List<WisdomQuote>? _cachedQuotes;
  Future<List<WisdomQuote>>? _quoteLoad;

  List<WisdomQuote>? get cachedQuotes => _cachedQuotes;

  Stream<List<SatsangTrack>> satsangs() {
    return Stream.value(fallbackSatsangs);
  }

  List<WisdomQuote> _quotesFromValue(
    Object? value, {
    required bool includeInactive,
    bool includeFallback = true,
  }) =>
      wisdomQuotesFromFirebaseValue(
        value,
        includeInactive: includeInactive,
        includeFallback: includeFallback,
      );

  Future<List<WisdomQuote>> _publicQuotesFromRest() async {
    final uri = Uri.parse('$firebaseDatabaseUrl/quotes.json');
    final response = await http.get(
      uri,
      headers: const {
        'Cache-Control': 'no-cache, no-store, max-age=0',
        'Pragma': 'no-cache',
      },
    ).timeout(const Duration(seconds: 10));
    if (response.statusCode != 200) return const [];

    final decoded = jsonDecode(response.body);
    return _quotesFromValue(
      decoded,
      includeInactive: false,
      includeFallback: false,
    );
  }

  Stream<List<WisdomQuote>> quotes() {
    late final StreamController<List<WisdomQuote>> controller;
    StreamSubscription<List<WisdomQuote>>? updates;
    controller = StreamController<List<WisdomQuote>>(
      onListen: () {
        updates = _quoteUpdates.stream.listen(
          controller.add,
          onError: controller.addError,
          onDone: controller.close,
        );
        unawaited(() async {
          try {
            final cached = _cachedQuotes;
            final initial = cached ?? await _loadPublicQuotes();
            if (!controller.isClosed) controller.add(initial);
          } catch (error, stackTrace) {
            if (!controller.isClosed) controller.addError(error, stackTrace);
          }
        }());
      },
      onCancel: () => updates?.cancel(),
    );
    return controller.stream;
  }

  Future<void> refreshQuotes() async {
    final refreshed = await _loadPublicQuotes(force: true);
    if (!_quoteUpdates.isClosed) _quoteUpdates.add(refreshed);
  }

  Future<List<WisdomQuote>> _loadPublicQuotes({bool force = false}) async {
    if (!force && _cachedQuotes != null) {
      return _cachedQuotes!;
    }
    final activeLoad = _quoteLoad;
    if (activeLoad != null) {
      if (!force) return activeLoad;
      try {
        await activeLoad;
      } catch (_) {}
    }

    final load = _fetchPublicQuotes();
    _quoteLoad = load;
    try {
      final quotes = await load;
      _cachedQuotes = List<WisdomQuote>.unmodifiable(quotes);
      return _cachedQuotes!;
    } finally {
      if (identical(_quoteLoad, load)) _quoteLoad = null;
    }
  }

  Future<List<WisdomQuote>> _fetchPublicQuotes() async {
    final customLoader = _quoteLoader;
    if (customLoader != null) return customLoader();
    if (!ready) return fallbackQuotes;

    try {
      final restQuotes = await _publicQuotesFromRest();
      if (restQuotes.isNotEmpty) return restQuotes;
    } catch (_) {
      // The Firebase SDK request below provides the authenticated fallback.
    }

    final reference = FirebaseDatabase.instance.ref('quotes');
    final snapshot = await reference.get().timeout(const Duration(seconds: 8));
    return _quotesFromValue(
      snapshot.value,
      includeInactive: false,
      includeFallback: false,
    );
  }

  Future<void> dispose() async {
    await _quoteUpdates.close();
  }

  Stream<List<WisdomQuote>> adminQuotes() async* {
    if (!ready) {
      yield fallbackQuotes;
      return;
    }

    final reference = FirebaseDatabase.instance.ref('quotes');

    try {
      final snapshot = await reference.get().timeout(
            const Duration(seconds: 8),
          );
      yield _quotesFromValue(
        snapshot.value,
        includeInactive: true,
        includeFallback: false,
      );

      await for (final event in reference.onValue) {
        yield _quotesFromValue(
          event.snapshot.value,
          includeInactive: true,
          includeFallback: false,
        );
      }
    } catch (_) {
      yield fallbackQuotes;
    }
  }

  Stream<List<DevoteeActivity>> adminActivity() async* {
    if (!ready) {
      yield const [];
      return;
    }

    await for (final event in FirebaseDatabase.instance.ref('users').onValue) {
      final value = event.snapshot.value;
      if (value is! Map) {
        yield const [];
        continue;
      }

      final users = value.entries
          .map((entry) {
            if (entry.value is! Map) return null;
            return DevoteeActivity.fromEntry(
              entry.key.toString(),
              Map<dynamic, dynamic>.from(entry.value as Map),
            );
          })
          .whereType<DevoteeActivity>()
          .toList()
        ..sort((a, b) => (b.lastActiveAt ?? 0).compareTo(a.lastActiveAt ?? 0));
      yield users;
    }
  }

  Future<String> publishQuote({
    required String textEnglish,
    required String textHindi,
    required String authorEnglish,
    required String authorHindi,
  }) async {
    if (!ready) throw StateError('Firebase is not configured.');
    final quotesReference = FirebaseDatabase.instance.ref('quotes');
    final snapshot = await quotesReference.get();
    final existing = _quotesFromValue(
      snapshot.value,
      includeInactive: true,
      includeFallback: false,
    );
    final scheduledDate = nextQuoteScheduleDate(existing);
    final key = quotesReference.push().key;
    if (key == null) throw StateError('Could not create a quote record.');
    await quotesReference.child(key).set({
      'text': textEnglish,
      'textEnglish': textEnglish,
      'textHindi': textHindi,
      'author': authorEnglish,
      'authorEnglish': authorEnglish,
      'authorHindi': authorHindi,
      'active': true,
      'createdAt': ServerValue.timestamp,
      'createdBy': FirebaseAuth.instance.currentUser?.email,
      'scheduledDate': quoteDateKey(scheduledDate),
    });
    return quoteDateKey(scheduledDate);
  }

  Future<void> updateQuote({
    required String id,
    required String textEnglish,
    required String textHindi,
    required String authorEnglish,
    required String authorHindi,
  }) async {
    if (!ready) throw StateError('Firebase is not configured.');
    await FirebaseDatabase.instance.ref('quotes/$id').update({
      'text': textEnglish,
      'textEnglish': textEnglish,
      'textHindi': textHindi,
      'author': authorEnglish,
      'authorEnglish': authorEnglish,
      'authorHindi': authorHindi,
      'updatedAt': ServerValue.timestamp,
      'updatedBy': FirebaseAuth.instance.currentUser?.email,
    });
  }

  Future<bool> isAdmin(User? user) async {
    if (!ready || user == null) return false;
    return user.email?.trim().toLowerCase() == allowedAdminEmail;
  }
}

class SpiritualOpening extends StatefulWidget {
  const SpiritualOpening({required this.firebaseReady, super.key});

  final bool firebaseReady;

  @override
  State<SpiritualOpening> createState() => _SpiritualOpeningState();
}

class _SpiritualOpeningState extends State<SpiritualOpening>
    with SingleTickerProviderStateMixin {
  late final AnimationController controller;
  bool showApp = false;

  @override
  void initState() {
    super.initState();
    controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2600),
    )..forward();
    _openApp();
  }

  Future<void> _openApp() async {
    await Future<void>.delayed(const Duration(milliseconds: 2850));
    if (mounted) setState(() => showApp = true);
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 650),
      switchInCurve: Curves.easeOutCubic,
      switchOutCurve: Curves.easeInCubic,
      child: showApp
          ? AuthGate(
              key: const ValueKey('devotee-shell'),
              firebaseReady: widget.firebaseReady)
          : _OpeningScreen(
              key: const ValueKey('opening'), progress: controller),
    );
  }
}

class _OpeningScreen extends StatelessWidget {
  const _OpeningScreen({required this.progress, super.key});

  final Animation<double> progress;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      backgroundColor: isDark ? AppColors.darkCanvas : AppColors.cream,
      body: AnimatedBuilder(
        animation: progress,
        builder: (context, _) {
          final eased = Curves.easeOutCubic.transform(progress.value);
          return Stack(
            fit: StackFit.expand,
            children: [
              CustomPaint(
                painter: _OpeningScenePainter(eased, isDark: isDark),
              ),
              SafeArea(
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    final iconSize =
                        (constraints.maxHeight * 0.13).clamp(76.0, 132.0);
                    final titleSize =
                        (constraints.maxWidth * 0.105).clamp(31.0, 42.0);
                    final logoGap =
                        (constraints.maxHeight * 0.025).clamp(14.0, 28.0);
                    final progressGap =
                        (constraints.maxHeight * 0.028).clamp(16.0, 32.0);

                    return Align(
                      alignment: Alignment.topCenter,
                      child: FractionallySizedBox(
                        heightFactor: 0.60,
                        widthFactor: 1,
                        child: Center(
                          child: ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 420),
                            child: Padding(
                              padding:
                                  const EdgeInsets.symmetric(horizontal: 24),
                              child: Transform.translate(
                                offset: Offset(0, 18 * (1 - eased)),
                                child: Opacity(
                                  opacity: eased,
                                  child: Column(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      SizedBox(
                                        width: iconSize * 1.5,
                                        height: iconSize * 1.18,
                                        child: Stack(
                                          alignment: Alignment.center,
                                          clipBehavior: Clip.none,
                                          children: [
                                            Positioned(
                                              bottom: 0,
                                              child: Container(
                                                width: iconSize * 1.2,
                                                height: iconSize * 0.34,
                                                decoration: BoxDecoration(
                                                  borderRadius:
                                                      BorderRadius.circular(99),
                                                  gradient: RadialGradient(
                                                    colors: [
                                                      AppColors.softGold
                                                          .withValues(
                                                              alpha: 0.58),
                                                      AppColors.softGold
                                                          .withValues(alpha: 0),
                                                    ],
                                                  ),
                                                ),
                                              ),
                                            ),
                                            SizedBox(
                                              width: iconSize,
                                              height: iconSize,
                                              child: const _AppIconMark(),
                                            ),
                                          ],
                                        ),
                                      ),
                                      SizedBox(height: logoGap),
                                      Text(
                                        'Guru Vandan',
                                        textAlign: TextAlign.center,
                                        maxLines: 1,
                                        style: GoogleFonts.lora(
                                          color: isDark
                                              ? AppColors.darkInk
                                              : AppColors.deepCrimson,
                                          fontSize: titleSize,
                                          height: 1.05,
                                          fontWeight: FontWeight.w900,
                                        ),
                                      ),
                                      const SizedBox(height: 8),
                                      Text(
                                        appText(
                                          context,
                                          'Remembrance. Satsang. Meditation.',
                                          'स्मरण। सत्संग। ध्यान।',
                                        ),
                                        textAlign: TextAlign.center,
                                        style: _bodyStyle(
                                          LanguageScope.of(context).language,
                                          color: AppColors.taupe,
                                          fontSize: constraints.maxWidth < 340
                                              ? 15
                                              : 18,
                                          height: 1.3,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                      SizedBox(height: progressGap),
                                      SizedBox(
                                        width: min(
                                          180,
                                          constraints.maxWidth * 0.5,
                                        ),
                                        child: ClipRRect(
                                          borderRadius:
                                              BorderRadius.circular(99),
                                          child: LinearProgressIndicator(
                                            value: progress.value,
                                            minHeight: 7,
                                            color: _primaryActionColor(),
                                            backgroundColor: _surfaceColor(
                                              AppColors.rose,
                                            ),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _OpeningScenePainter extends CustomPainter {
  _OpeningScenePainter(this.progress, {required this.isDark});

  final double progress;
  final bool isDark;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final sky = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: isDark
            ? const [
                AppColors.darkCanvas,
                AppColors.darkSurface,
                AppColors.darkRose,
              ]
            : const [
                Color(0xFFFFFBF4),
                Color(0xFFF6E1C6),
                Color(0xFFEAB78C),
              ],
      ).createShader(rect);
    canvas.drawRect(rect, sky);

    final sunY = size.height * (0.78 - 0.26 * progress);
    final sunPaint = Paint()
      ..color = AppColors.softGold.withValues(alpha: 0.46 + 0.28 * progress)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 18);
    canvas.drawCircle(
        Offset(size.width * 0.5, sunY), size.width * 0.23, sunPaint);

    final horizon = Paint()
      ..color = (isDark ? AppColors.darkGold : AppColors.maroon)
          .withValues(alpha: isDark ? 0.06 : 0.08);
    final hill = Path()
      ..moveTo(0, size.height * 0.72)
      ..quadraticBezierTo(size.width * 0.25, size.height * 0.61,
          size.width * 0.5, size.height * 0.7)
      ..quadraticBezierTo(
          size.width * 0.78, size.height * 0.79, size.width, size.height * 0.64)
      ..lineTo(size.width, size.height)
      ..lineTo(0, size.height)
      ..close();
    canvas.drawPath(hill, horizon);

    final foreground = Paint()
      ..color = isDark ? const Color(0xFF8A704E) : AppColors.deepCrimson;
    final templeOutline = Paint()
      ..color = isDark
          ? AppColors.darkGold.withValues(alpha: 0.82)
          : AppColors.maroon.withValues(alpha: 0.36)
      ..style = PaintingStyle.stroke
      ..strokeWidth = isDark ? 2.2 : 1.2;
    final templeScale = (size.height / 780).clamp(0.58, 1.0);
    final baseY = size.height * 0.84;
    final templeWidth = min(size.width * 0.48, min(230.0, size.height * 0.34));
    final templeLeft = (size.width - templeWidth) / 2;
    final templeRight = templeLeft + templeWidth;
    final pillarWidth = templeWidth * 0.1;

    final roof = Path()
      ..moveTo(templeLeft + templeWidth * 0.08, baseY - 74 * templeScale)
      ..lineTo(size.width / 2, baseY - (132 + 18 * progress) * templeScale)
      ..lineTo(templeRight - templeWidth * 0.08, baseY - 74 * templeScale)
      ..close();
    canvas.drawPath(roof, foreground);
    canvas.drawPath(roof, templeOutline);
    final templeLintel = RRect.fromRectAndRadius(
      Rect.fromLTWH(
        templeLeft + templeWidth * 0.18,
        baseY - 72 * templeScale,
        templeWidth * 0.64,
        10 * templeScale,
      ),
      const Radius.circular(3),
    );
    canvas.drawRRect(templeLintel, foreground);
    canvas.drawRRect(templeLintel, templeOutline);
    for (final x in [
      templeLeft + templeWidth * 0.25,
      templeLeft + templeWidth * 0.43,
      templeLeft + templeWidth * 0.57,
      templeLeft + templeWidth * 0.75,
    ]) {
      final pillar = RRect.fromRectAndRadius(
        Rect.fromLTWH(
          x - pillarWidth / 2,
          baseY - 66 * templeScale,
          pillarWidth,
          66 * templeScale,
        ),
        const Radius.circular(4),
      );
      canvas.drawRRect(pillar, foreground);
      canvas.drawRRect(pillar, templeOutline);
    }
    final templeBase = RRect.fromRectAndRadius(
      Rect.fromLTWH(
        templeLeft + templeWidth * 0.14,
        baseY,
        templeWidth * 0.72,
        12 * templeScale,
      ),
      const Radius.circular(4),
    );
    canvas.drawRRect(templeBase, foreground);
    canvas.drawRRect(templeBase, templeOutline);

    final diyaCenter = Offset(size.width * 0.5, size.height * 0.93);
    final flameHeight = 70 * templeScale;
    final flame = Path()
      ..moveTo(diyaCenter.dx, diyaCenter.dy - flameHeight * progress)
      ..cubicTo(
          diyaCenter.dx - 25 * templeScale,
          diyaCenter.dy - 38 * templeScale,
          diyaCenter.dx - 8 * templeScale,
          diyaCenter.dy - 18 * templeScale,
          diyaCenter.dx,
          diyaCenter.dy - 28 * templeScale)
      ..cubicTo(
          diyaCenter.dx + 18 * templeScale,
          diyaCenter.dy - 49 * templeScale,
          diyaCenter.dx + 11 * templeScale,
          diyaCenter.dy - 59 * templeScale,
          diyaCenter.dx,
          diyaCenter.dy - flameHeight * progress)
      ..close();
    canvas.drawPath(
        flame, Paint()..color = AppColors.gold.withValues(alpha: progress));
    canvas.drawOval(
      Rect.fromCenter(
        center: diyaCenter,
        width: 150 * templeScale,
        height: 34 * templeScale,
      ),
      Paint()..color = AppColors.maroon.withValues(alpha: 0.9),
    );
  }

  @override
  bool shouldRepaint(covariant _OpeningScenePainter oldDelegate) {
    return oldDelegate.progress != progress || oldDelegate.isDark != isDark;
  }
}

class AuthGate extends StatefulWidget {
  const AuthGate({required this.firebaseReady, super.key});

  final bool firebaseReady;

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  late final Future<String?> startup = _prepareAuthStartup();
  bool keepRememberedSession = false;
  bool hasObservedAuthenticatedUser = false;

  Future<String?> _prepareAuthStartup() async {
    final language = LanguageScope.of(context).language;
    if (!widget.firebaseReady) return null;
    final googleCouldNotComplete = appText(
      context,
      'Google sign-in could not be completed. Please try again.',
      'Google द्वारा प्रवेश पूर्ण नहीं हो सका। कृपया पुनः प्रयास करें।',
    );

    final prefs = await SharedPreferences.getInstance();
    var rememberedUid = (prefs.getString(_rememberedAuthUidKey) ?? '').trim();
    if (rememberedUid.isEmpty) {
      rememberedUid =
          legacyAuthenticatedUidFromPreferenceKeys(prefs.getKeys()) ?? '';
      if (rememberedUid.isNotEmpty) {
        await prefs.setString(_rememberedAuthUidKey, rememberedUid);
      }
    }
    keepRememberedSession = rememberedUid.isNotEmpty;

    if (!kIsWeb) return null;

    try {
      await FirebaseAuth.instance.setPersistence(Persistence.LOCAL);
      await FirebaseAuth.instance.getRedirectResult();
    } on FirebaseAuthException catch (error) {
      return _friendlyAuthMessage(
        language,
        error,
        'Google sign-in could not be completed.',
        'Google द्वारा प्रवेश पूर्ण नहीं हो सका।',
      );
    } catch (_) {
      return googleCouldNotComplete;
    }

    return null;
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.firebaseReady) {
      return const DevoteeShell(firebaseReady: false);
    }

    return FutureBuilder<String?>(
      future: startup,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting &&
            FirebaseAuth.instance.currentUser == null) {
          return const _AuthLoadingScaffold();
        }

        final startupError = snapshot.data;

        return StreamBuilder<User?>(
          stream: FirebaseAuth.instance.idTokenChanges(),
          initialData: FirebaseAuth.instance.currentUser,
          builder: (context, authSnapshot) {
            final user = authSnapshot.data;
            if (authSnapshot.connectionState == ConnectionState.waiting &&
                user == null) {
              return const _AuthLoadingScaffold();
            }

            if (user == null) {
              if (shouldUseRememberedAuthSession(
                startupComplete:
                    snapshot.connectionState == ConnectionState.done,
                authStreamReady:
                    authSnapshot.connectionState != ConnectionState.waiting,
                hasAuthenticatedUser: false,
                hasRememberedSession: keepRememberedSession,
                hasObservedAuthenticatedUser: hasObservedAuthenticatedUser,
              )) {
                return const DevoteeShell(firebaseReady: false);
              }
              return _SignInScreen(
                initialStatus: startupError,
                initialStatusIsError: startupError != null,
              );
            }

            hasObservedAuthenticatedUser = true;
            unawaited(_rememberAuthenticatedUser(user));

            return DevoteeShell(
              key: ValueKey('devotee-shell-${user.uid}'),
              firebaseReady: widget.firebaseReady,
              user: user,
            );
          },
        );
      },
    );
  }
}

class _AuthLoadingScaffold extends StatelessWidget {
  const _AuthLoadingScaffold();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Stack(
        children: [
          Positioned.fill(child: _SacredBackground()),
          SafeArea(child: _ProfileLoadingScreen()),
        ],
      ),
    );
  }
}

class _SignInScreen extends StatefulWidget {
  const _SignInScreen({
    this.initialStatus,
    this.initialStatusIsError = false,
    this.onSignedIn,
  });

  final String? initialStatus;
  final bool initialStatusIsError;
  final VoidCallback? onSignedIn;

  @override
  State<_SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends State<_SignInScreen> {
  final phone = TextEditingController();
  final otp = TextEditingController();
  ConfirmationResult? confirmationResult;
  String? verificationId;
  bool otpSent = false;
  bool busy = false;
  String? status;
  bool statusIsError = false;

  bool get _phoneSignInEnabled => false;

  @override
  void initState() {
    super.initState();
    status = widget.initialStatus;
    statusIsError = widget.initialStatusIsError;
  }

  @override
  void dispose() {
    phone.dispose();
    otp.dispose();
    super.dispose();
  }

  Future<void> _signInWithGoogle() async {
    final language = LanguageScope.of(context).language;
    final googleCouldNotComplete = appText(
      context,
      'Google sign-in could not be completed.',
      'Google द्वारा प्रवेश पूर्ण नहीं हो सका।',
    );

    setState(() {
      busy = true;
      status = null;
      statusIsError = false;
    });

    try {
      final credential = await _signInToFirebaseWithGoogle(
        confirmAccountLink: _confirmAccountLink,
      );
      final user = credential.user;
      if (user != null) await _rememberAuthenticatedUser(user);
      widget.onSignedIn?.call();
    } on _AuthFlowCanceled {
      // The user intentionally closed a provider or account-linking flow.
    } on _AuthIntegrityException catch (error) {
      _setError(error.message);
    } on FirebaseAuthException catch (error) {
      if (error.code == 'redirect-started') return;
      _setError(await _friendlyDiagnosedAuthMessage(
        language: language,
        error: error,
        fallbackEnglish: 'Google sign-in could not be completed.',
        fallbackHindi: 'Google द्वारा प्रवेश पूर्ण नहीं हो सका।',
      ));
    } on GoogleSignInException catch (error) {
      _setError(await _friendlyDiagnosedGoogleSignInMessage(
        language: language,
        error: error,
        fallbackEnglish: 'Google sign-in could not be completed.',
        fallbackHindi: 'Google द्वारा प्रवेश पूर्ण नहीं हो सका।',
      ));
    } catch (_) {
      _setError(googleCouldNotComplete);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _signInWithApple() async {
    final language = LanguageScope.of(context).language;
    final appleCouldNotComplete = appText(
      context,
      'Sign in with Apple could not be completed.',
      'Apple द्वारा प्रवेश पूर्ण नहीं हो सका।',
    );

    setState(() {
      busy = true;
      status = null;
      statusIsError = false;
    });

    try {
      final credential = await _signInToFirebaseWithApple(
        confirmAccountLink: _confirmAccountLink,
      );
      final user = credential.user;
      if (user != null) await _rememberAuthenticatedUser(user);
      widget.onSignedIn?.call();
    } on _AuthFlowCanceled {
      // The user intentionally closed a provider or account-linking flow.
    } on _AuthIntegrityException catch (error) {
      _setError(error.message);
    } on FirebaseAuthException catch (error) {
      _setError(await _friendlyDiagnosedAuthMessage(
        language: language,
        error: error,
        fallbackEnglish: 'Sign in with Apple could not be completed.',
        fallbackHindi: 'Apple द्वारा प्रवेश पूर्ण नहीं हो सका।',
      ));
    } catch (_) {
      _setError(appleCouldNotComplete);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<bool> _confirmAccountLink(
    String existingProvider,
    String email,
  ) async {
    if (!mounted) return false;
    return await showDialog<bool>(
          context: context,
          barrierDismissible: false,
          builder: (dialogContext) => AlertDialog(
            icon: Icon(
              Icons.link_rounded,
              color: _readableColor(AppColors.maroon),
              size: 34,
            ),
            title: Text(
              appText(
                context,
                'Securely link your sign-ins',
                'अपने प्रवेश सुरक्षित रूप से जोड़ें',
              ),
              textAlign: TextAlign.center,
            ),
            content: Text(
              appText(
                context,
                'A Guru Vandan account already uses $email. Continue with $existingProvider to verify that account and securely link both sign-in methods. Your profile and routine data will remain in one account.',
                '$email से एक गुरु वंदन सदस्यता पहले से जुड़ी है। उस सदस्यता को प्रमाणित करने और दोनों प्रवेश-विधियों को सुरक्षित रूप से जोड़ने के लिए $existingProvider से आगे बढ़ें। आपका परिचय और साधना-विवरण एक ही सदस्यता में रहेगा।',
              ),
              textAlign: TextAlign.center,
            ),
            actionsAlignment: MainAxisAlignment.center,
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext, false),
                child: Text(appText(context, 'Cancel', 'निरस्त करें')),
              ),
              FilledButton.icon(
                onPressed: () => Navigator.pop(dialogContext, true),
                icon: const Icon(Icons.verified_user_rounded),
                label: Text(appText(
                  context,
                  'Continue securely',
                  'सुरक्षित रूप से आगे बढ़ें',
                )),
              ),
            ],
          ),
        ) ??
        false;
  }

  Future<void> _sendOtp() async {
    final language = LanguageScope.of(context).language;
    final couldNotSendOtp = appText(
      context,
      'Could not send OTP. Try again.',
      'एकबारगी कूट (OTP) प्रेषित नहीं किया जा सका। कृपया पुनः प्रयास करें।',
    );
    final phoneNumber = _normalizedPhone(phone.text);
    if (phoneNumber == null) {
      _setError(appText(
        context,
        'Enter a valid phone number with country code.',
        'देश-कूट सहित मान्य दूरभाष क्रमांक अंकित करें।',
      ));
      return;
    }

    setState(() {
      busy = true;
      status = null;
      statusIsError = false;
    });

    try {
      if (kIsWeb) {
        confirmationResult =
            await FirebaseAuth.instance.signInWithPhoneNumber(phoneNumber);
        if (mounted) {
          setState(() {
            otpSent = true;
            status = appText(
              context,
              'OTP sent to $phoneNumber.',
              '$phoneNumber पर एकबारगी कूट (OTP) प्रेषित किया गया।',
            );
            statusIsError = false;
          });
        }
      } else {
        await FirebaseAuth.instance.verifyPhoneNumber(
          phoneNumber: phoneNumber,
          verificationCompleted: (credential) async {
            final result =
                await FirebaseAuth.instance.signInWithCredential(credential);
            final user = result.user;
            if (user != null) await _rememberAuthenticatedUser(user);
            widget.onSignedIn?.call();
          },
          verificationFailed: (error) {
            if (mounted) {
              _setError(_friendlyAuthMessage(
                language,
                error,
                'Phone verification could not be completed.',
                'दूरभाष प्रमाणीकरण पूर्ण नहीं हो सका।',
              ));
            }
          },
          codeSent: (id, _) {
            if (mounted) {
              setState(() {
                verificationId = id;
                otpSent = true;
                status = appText(
                  context,
                  'OTP sent to $phoneNumber.',
                  '$phoneNumber पर एकबारगी कूट (OTP) प्रेषित किया गया।',
                );
                statusIsError = false;
              });
            }
          },
          codeAutoRetrievalTimeout: (id) {
            verificationId = id;
          },
        );
      }
    } on FirebaseAuthException catch (error) {
      _setError(_friendlyAuthMessage(
        language,
        error,
        'The OTP could not be sent.',
        'एकबारगी कूट (OTP) प्रेषित नहीं किया जा सका।',
      ));
    } catch (_) {
      _setError(couldNotSendOtp);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _verifyOtp() async {
    final language = LanguageScope.of(context).language;
    final otpCouldNotComplete = appText(
      context,
      'OTP verification could not be completed.',
      'एकबारगी कूट (OTP) का प्रमाणीकरण पूर्ण नहीं हो सका।',
    );
    final code = otp.text.trim();
    if (code.length < 4) {
      _setError(appText(
        context,
        'Enter the OTP received on your phone.',
        'दूरभाष पर प्राप्त एकबारगी कूट (OTP) अंकित करें।',
      ));
      return;
    }

    setState(() {
      busy = true;
      status = null;
      statusIsError = false;
    });

    try {
      if (kIsWeb) {
        final result = confirmationResult;
        if (result == null) {
          _setError(appText(
            context,
            'Please request OTP again.',
            'कृपया एकबारगी कूट (OTP) पुनः मँगाएँ।',
          ));
          return;
        }
        final credential = await result.confirm(code);
        final user = credential.user;
        if (user != null) await _rememberAuthenticatedUser(user);
      } else {
        final id = verificationId;
        if (id == null) {
          _setError(appText(
            context,
            'Please request OTP again.',
            'कृपया एकबारगी कूट (OTP) पुनः मँगाएँ।',
          ));
          return;
        }
        final credential = PhoneAuthProvider.credential(
          verificationId: id,
          smsCode: code,
        );
        final result =
            await FirebaseAuth.instance.signInWithCredential(credential);
        final user = result.user;
        if (user != null) await _rememberAuthenticatedUser(user);
      }
      widget.onSignedIn?.call();
    } on FirebaseAuthException catch (error) {
      _setError(_friendlyAuthMessage(
        language,
        error,
        'OTP verification could not be completed.',
        'एकबारगी कूट (OTP) का प्रमाणीकरण पूर्ण नहीं हो सका।',
      ));
    } catch (_) {
      _setError(otpCouldNotComplete);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  void _setError(String message) {
    if (!mounted) return;
    setState(() {
      status = message;
      statusIsError = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          const Positioned.fill(child: _SacredBackground()),
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 540),
                  child: Container(
                    padding: const EdgeInsets.fromLTRB(24, 26, 24, 24),
                    decoration:
                        _cardDecoration(color: AppColors.offWhite).copyWith(
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.deepCrimson.withValues(alpha: 0.11),
                          blurRadius: 30,
                          offset: const Offset(0, 18),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Center(
                          child: SizedBox(
                            width: 116,
                            height: 116,
                            child: const _AppIconMark(),
                          ),
                        ),
                        const SizedBox(height: 24),
                        Text(
                          appText(
                            context,
                            'Enter Guru Vandan',
                            'गुरु वंदन में प्रवेश करें',
                          ),
                          textAlign: TextAlign.center,
                          style: _headingStyle(
                            LanguageScope.of(context).language,
                            color: AppColors.ink,
                            fontSize: 31,
                            height: 1.08,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 24),
                        FilledButton.icon(
                          onPressed: busy ? null : _signInWithGoogle,
                          icon:
                              const Icon(Icons.g_mobiledata_rounded, size: 31),
                          label: Text(appText(
                            context,
                            'Google',
                            'Google',
                          )),
                          style: FilledButton.styleFrom(
                            minimumSize: const Size.fromHeight(58),
                            backgroundColor: _primaryActionColor(),
                            foregroundColor: _onPrimaryActionColor(),
                          ),
                        ),
                        if (_appleSignInAvailable) ...[
                          const SizedBox(height: 12),
                          FilledButton.icon(
                            key: const Key('sign-in-with-apple'),
                            onPressed: busy ? null : _signInWithApple,
                            icon: const Icon(Icons.apple),
                            label: const Text('Sign in with Apple'),
                            style: FilledButton.styleFrom(
                              minimumSize: const Size.fromHeight(58),
                              backgroundColor: Colors.black,
                              foregroundColor: Colors.white,
                            ),
                          ),
                        ],
                        if (_phoneSignInEnabled) ...[
                          const SizedBox(height: 20),
                          Row(
                            children: [
                              const Expanded(child: Divider()),
                              Padding(
                                padding:
                                    const EdgeInsets.symmetric(horizontal: 12),
                                child: Text(
                                  appText(
                                      context, 'or use phone', 'अथवा दूरभाष'),
                                  style: TextStyle(
                                    color: _readableColor(AppColors.taupe),
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ),
                              const Expanded(child: Divider()),
                            ],
                          ),
                          const SizedBox(height: 20),
                          TextField(
                            controller: phone,
                            enabled: !busy && !otpSent,
                            keyboardType: TextInputType.phone,
                            textInputAction: TextInputAction.next,
                            decoration: _inputDecoration(appText(
                              context,
                              'Phone number',
                              'दूरभाष क्रमांक',
                            )).copyWith(
                              hintText: '+91 98765 43210',
                              prefixIcon: const Icon(Icons.phone_rounded),
                            ),
                          ),
                          if (otpSent) ...[
                            const SizedBox(height: 14),
                            TextField(
                              controller: otp,
                              enabled: !busy,
                              keyboardType: TextInputType.number,
                              textInputAction: TextInputAction.done,
                              onSubmitted: (_) => _verifyOtp(),
                              decoration: _inputDecoration(appText(
                                context,
                                'OTP code',
                                'एकबारगी कूट (OTP)',
                              )).copyWith(
                                prefixIcon: const Icon(Icons.sms_rounded),
                              ),
                            ),
                          ],
                          const SizedBox(height: 16),
                          OutlinedButton.icon(
                            onPressed:
                                busy ? null : (otpSent ? _verifyOtp : _sendOtp),
                            icon: Icon(otpSent
                                ? Icons.verified_user_rounded
                                : Icons.sms_rounded),
                            label: Text(otpSent
                                ? appText(context, 'Verify', 'प्रमाणित')
                                : appText(context, 'Send', 'प्रेषित')),
                          ),
                          if (otpSent) ...[
                            const SizedBox(height: 10),
                            TextButton(
                              onPressed: busy
                                  ? null
                                  : () {
                                      setState(() {
                                        otp.clear();
                                        confirmationResult = null;
                                        verificationId = null;
                                        otpSent = false;
                                        status = null;
                                      });
                                    },
                              child: Text(appText(
                                context,
                                'Change',
                                'परिवर्तन',
                              )),
                            ),
                          ],
                        ],
                        if (status != null) ...[
                          const SizedBox(height: 14),
                          _StatusText(
                            status!,
                            isError: statusIsError,
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class DevoteeShell extends StatefulWidget {
  const DevoteeShell({required this.firebaseReady, this.user, super.key});

  final bool firebaseReady;
  final User? user;

  @override
  State<DevoteeShell> createState() => _DevoteeShellState();
}

class _DevoteeShellState extends State<DevoteeShell>
    with WidgetsBindingObserver {
  static const routineKey = 'guruvandan_flutter:routine';
  static const nameKey = 'guruvandan_flutter:name';
  static const likedQuotesKey = 'guruvandan_flutter:liked_quotes';
  static const activityKey = 'guruvandan_flutter:activity';
  static const accountCreatedAtKey = 'guruvandan_flutter:account_created_at';

  late final FirebaseContentService content;
  final List<StreamSubscription<dynamic>> audioSubscriptions = [];

  PracticeTab tab = PracticeTab.home;
  SatsangSession selectedSession = _defaultSession();
  DevoteeProfile? devoteeProfile;
  bool localStateLoaded = false;
  bool needsProfileName = false;
  bool showSignInAfterLogout = false;
  Map<String, Map<String, bool>> records = {};
  List<DevoteeActivityEvent> activityEvents = [];
  DateTime accountCreatedAt = _dateOnly(DateTime.now());
  String? activeTrackId;
  RoutineTask? activeTrackTask;
  Duration audioPosition = Duration.zero;
  Duration audioDuration = Duration.zero;
  DateTime? satsangListeningStartedAt;
  String activeTrackAnalyticsTitle = '';
  SatsangSession? activeTrackAnalyticsSession;
  bool meditationActivityOpen = false;
  int trackedMeditationPlannedSeconds = 0;
  final Set<String> trackedQuoteViews = {};
  Set<String> likedQuoteIds = {};

  int selectedDurationSeconds = 10 * 60;
  int remainingSeconds = 10 * 60;
  List<int> meditationPresetMinutes = [...defaultMeditationPresetMinutes];
  bool meditationPresetEditMode = false;
  bool meditationRunning = false;
  bool meditationComplete = false;
  bool meditationFinishing = false;
  bool meditationSessionStarted = false;
  bool mantraLoopEnabled = false;
  bool mantraLoopPlaying = false;
  bool meditationUsesMantra = false;
  bool backgroundAudioPlaying = false;
  bool audioMutationInProgress = false;
  bool audioCompletionHandled = false;
  bool silentPromptOpen = false;
  BackgroundPlaybackKind playbackKind = BackgroundPlaybackKind.none;
  int meditationRunToken = 0;
  MeditationChantPhase? meditationChantPhase;
  DateTime? meditationEndsAt;
  bool welcomeDialogShown = false;
  bool accountDeletionInProgress = false;
  Timer? meditationTimer;
  String? selectedQuoteId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    content = FirebaseContentService(widget.firebaseReady);
    selectedQuoteId = incomingQuoteId.value;
    if (selectedQuoteId != null) {
      tab = PracticeTab.wisdom;
      incomingQuoteId.value = null;
    }
    incomingQuoteId.addListener(_handleIncomingQuote);
    _loadLocalState();
    _wireAudio();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    incomingQuoteId.removeListener(_handleIncomingQuote);
    meditationTimer?.cancel();
    unawaited(_finishSatsangActivity());
    unawaited(_recordMeditationActivity(completed: false));
    unawaited(content.dispose());
    for (final subscription in audioSubscriptions) {
      unawaited(subscription.cancel());
    }
    super.dispose();
  }

  void _handleIncomingQuote() {
    final quoteId = incomingQuoteId.value;
    if (quoteId == null || quoteId.isEmpty) return;
    incomingQuoteId.value = null;
    if (!mounted) return;
    setState(() {
      selectedQuoteId = quoteId;
      tab = PracticeTab.wisdom;
    });
    unawaited(_trackActivity(
      'quote_viewed',
      contentId: quoteId,
      label: 'Shared quote',
    ));
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _syncMeditationTimerWithClock();
    }
  }

  void _wireAudio() {
    final player = _backgroundAudioPlayer;
    if (player == null) return;

    audioSubscriptions.add(player.positionStream.listen((position) {
      if (mounted && playbackKind == BackgroundPlaybackKind.satsang) {
        setState(() => audioPosition = position);
      }
    }));
    audioSubscriptions.add(player.durationStream.listen((duration) {
      if (mounted &&
          playbackKind == BackgroundPlaybackKind.satsang &&
          duration != null) {
        setState(() => audioDuration = duration);
      }
    }));
    audioSubscriptions.add(
      player.playerStateStream.listen(_handleBackgroundPlayerState),
    );
  }

  void _handleBackgroundPlayerState(ja.PlayerState state) {
    final kind = playbackKind;

    if (kind == BackgroundPlaybackKind.satsang) {
      if (state.playing && satsangListeningStartedAt == null) {
        satsangListeningStartedAt = DateTime.now();
      } else if (!state.playing && satsangListeningStartedAt != null) {
        unawaited(_finishSatsangActivity(
          completed: state.processingState == ja.ProcessingState.completed,
        ));
      }
    }

    if (mounted) {
      setState(() {
        backgroundAudioPlaying = state.playing;
        mantraLoopPlaying = state.playing &&
            (kind == BackgroundPlaybackKind.mantra ||
                (kind == BackgroundPlaybackKind.meditation &&
                    meditationUsesMantra));
      });
    }

    if (audioMutationInProgress) return;

    if (state.processingState == ja.ProcessingState.completed &&
        !audioCompletionHandled) {
      audioCompletionHandled = true;
      unawaited(_handleBackgroundCompletion(kind));
      return;
    }

    if (kind == BackgroundPlaybackKind.meditation &&
        meditationSessionStarted &&
        meditationChantPhase == null) {
      if (!state.playing &&
          meditationRunning &&
          state.processingState == ja.ProcessingState.ready) {
        _pauseMeditationClock();
      } else if (state.playing && !meditationRunning && remainingSeconds > 0) {
        _startMeditationTimer(meditationRunToken);
      }
    }

    if (state.processingState == ja.ProcessingState.idle &&
        kind != BackgroundPlaybackKind.none) {
      unawaited(_handleBackgroundStop(kind));
    }
  }

  String get _nameStorageKey =>
      widget.user == null ? nameKey : '$nameKey:${widget.user!.uid}';

  String get _routineStorageKey =>
      widget.user == null ? routineKey : '$routineKey:${widget.user!.uid}';

  String get _likedQuotesStorageKey => widget.user == null
      ? likedQuotesKey
      : '$likedQuotesKey:${widget.user!.uid}';

  String get _activityStorageKey =>
      widget.user == null ? activityKey : '$activityKey:${widget.user!.uid}';

  String get _accountCreatedAtStorageKey => widget.user == null
      ? accountCreatedAtKey
      : '$accountCreatedAtKey:${widget.user!.uid}';

  String get _meditationPresetsStorageKey => widget.user == null
      ? _meditationPresetsKey
      : '$_meditationPresetsKey:${widget.user!.uid}';

  String get _selectedMeditationMinutesStorageKey => widget.user == null
      ? _selectedMeditationMinutesKey
      : '$_selectedMeditationMinutesKey:${widget.user!.uid}';

  DatabaseReference? get _cloudUserReference {
    final user = widget.user;
    if (!widget.firebaseReady || user == null) return null;
    return FirebaseDatabase.instance.ref('users/${user.uid}');
  }

  Future<void> _trackActivity(
    String type, {
    String label = '',
    String contentId = '',
    int durationSeconds = 0,
    int plannedDurationSeconds = 0,
    bool completed = false,
  }) async {
    final reference = _cloudUserReference;
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    final key = reference?.child('activity').push().key ??
        'local-$timestamp-${activityEvents.length}';

    final event = <String, Object>{
      'type': type,
      'timestamp': timestamp,
      if (label.isNotEmpty) 'label': label,
      if (contentId.isNotEmpty) 'contentId': contentId,
      if (durationSeconds > 0) 'durationSeconds': durationSeconds,
      if (plannedDurationSeconds > 0)
        'plannedDurationSeconds': plannedDurationSeconds,
      if (completed) 'completed': true,
    };

    final localEvent = DevoteeActivityEvent.fromEntry(key, event);
    if (mounted) {
      setState(() {
        activityEvents = [
          localEvent,
          ...activityEvents.where((item) => item.id != key),
        ];
      });
    } else {
      activityEvents = [
        localEvent,
        ...activityEvents.where((item) => item.id != key),
      ];
    }
    await _saveLocalActivityEvents();

    if (reference == null) return;

    try {
      await reference.update({
        'activity/$key': event,
        'lastActiveAt': ServerValue.timestamp,
      }).timeout(const Duration(seconds: 8));
    } catch (_) {
      // Analytics must never interrupt the devotee's practice.
    }
  }

  Future<void> _finishSatsangActivity({bool completed = false}) async {
    final startedAt = satsangListeningStartedAt;
    if (startedAt == null) return;
    satsangListeningStartedAt = null;
    final seconds = max(0, DateTime.now().difference(startedAt).inSeconds);
    if (seconds == 0) return;

    await _trackActivity(
      'satsang_listened',
      label: activeTrackAnalyticsSession == null
          ? activeTrackAnalyticsTitle
          : '${activeTrackAnalyticsSession!.name}: $activeTrackAnalyticsTitle',
      contentId: activeTrackId ?? '',
      durationSeconds: seconds,
      completed: completed,
    );
  }

  Future<void> _recordMeditationActivity({required bool completed}) async {
    if (!meditationActivityOpen) return;
    meditationActivityOpen = false;
    final planned = trackedMeditationPlannedSeconds > 0
        ? trackedMeditationPlannedSeconds
        : selectedDurationSeconds;
    final elapsed = completed ? planned : max(0, planned - remainingSeconds);
    if (elapsed == 0) return;

    await _trackActivity(
      'meditation_session',
      label: meditationUsesMantra ? 'Meditation with Om' : 'Meditation',
      durationSeconds: elapsed,
      plannedDurationSeconds: planned,
      completed: completed,
    );
  }

  void _selectTab(PracticeTab value) {
    if (tab == value) return;
    setState(() {
      tab = value;
      if (value != PracticeTab.meditate) {
        meditationPresetEditMode = false;
      }
    });
    unawaited(_trackActivity('screen_view', label: value.name));
  }

  void _trackQuoteViewed(WisdomQuote quote) {
    if (!trackedQuoteViews.add(quote.id)) return;
    unawaited(_trackActivity(
      'quote_viewed',
      contentId: quote.id,
      label: quote.author,
    ));
  }

  void _trackQuoteShared(WisdomQuote quote) {
    unawaited(_trackActivity(
      'quote_shared',
      contentId: quote.id,
      label: quote.author,
    ));
  }

  Future<void> _toggleQuoteLiked(WisdomQuote quote) async {
    final liked = !likedQuoteIds.contains(quote.id);
    if (mounted) {
      setState(() {
        if (liked) {
          likedQuoteIds.add(quote.id);
        } else {
          likedQuoteIds.remove(quote.id);
        }
      });
    }

    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(
      _likedQuotesStorageKey,
      likedQuoteIds.toList()..sort(),
    );

    final reference = _cloudUserReference;
    if (reference != null) {
      try {
        await reference.update({
          'likedQuotes/${quote.id}': liked ? true : null,
          'lastActiveAt': ServerValue.timestamp,
        }).timeout(const Duration(seconds: 8));
      } catch (_) {
        // The local preference remains available until the next change.
      }
    }

    await _trackActivity(
      liked ? 'quote_liked' : 'quote_unliked',
      contentId: quote.id,
      label: quote.text,
    );
  }

  Future<DevoteeProfile?> _loadCloudProfile() async {
    final reference = _cloudUserReference;
    if (reference == null) return null;

    try {
      final snapshot =
          await reference.get().timeout(const Duration(seconds: 6));
      final value = snapshot.value;
      if (value is! Map) return null;
      return DevoteeProfile.fromMap(value['profile']) ??
          DevoteeProfile.fromMap(value);
    } catch (_) {
      return null;
    }
  }

  Future<void> _saveCloudProfile(DevoteeProfile profile) async {
    final reference = _cloudUserReference;
    if (reference == null) return;
    final user = widget.user;

    try {
      await reference.update({
        'profile': profile.toJson(),
        'name': profile.fullName,
        'uid': user?.uid,
        'email': user?.email ?? '',
        'phone': user?.phoneNumber ?? '',
        'isEmailVerified': user?.emailVerified ?? false,
        'isProfileComplete': true,
        'profileCompleted': true,
        'updatedAt': ServerValue.timestamp,
      }).timeout(const Duration(seconds: 8));
    } catch (_) {
      // The local account copy remains available while Firebase is offline.
    }
  }

  Future<Map<String, Map<String, bool>>> _loadCloudRecords() async {
    final reference = _cloudUserReference?.child('routine');
    if (reference == null) return {};

    try {
      final snapshot =
          await reference.get().timeout(const Duration(seconds: 6));
      return routineRecordsFromValue(snapshot.value);
    } catch (_) {
      return {};
    }
  }

  Future<Set<String>> _loadCloudLikedQuotes() async {
    final reference = _cloudUserReference?.child('likedQuotes');
    if (reference == null) return {};
    try {
      final snapshot =
          await reference.get().timeout(const Duration(seconds: 6));
      final value = snapshot.value;
      if (value is! Map) return {};
      return value.entries
          .where((entry) => entry.value == true)
          .map((entry) => entry.key.toString())
          .toSet();
    } catch (_) {
      return {};
    }
  }

  Future<List<DevoteeActivityEvent>> _loadCloudActivityEvents() async {
    final reference = _cloudUserReference?.child('activity');
    if (reference == null) return const [];
    try {
      final snapshot =
          await reference.get().timeout(const Duration(seconds: 6));
      return devoteeActivityEventsFromValue(snapshot.value);
    } catch (_) {
      return const [];
    }
  }

  Future<int?> _loadCloudAccountCreatedAt() async {
    final reference = _cloudUserReference?.child('createdAt');
    if (reference == null) return null;
    try {
      final snapshot =
          await reference.get().timeout(const Duration(seconds: 6));
      final value = snapshot.value;
      return value is num ? value.toInt() : int.tryParse('$value');
    } catch (_) {
      return null;
    }
  }

  Future<void> _ensureCloudAccountCreatedAt(int timestamp) async {
    final reference = _cloudUserReference?.child('createdAt');
    if (reference == null) return;
    try {
      final snapshot =
          await reference.get().timeout(const Duration(seconds: 6));
      if (!snapshot.exists) {
        await reference.set(timestamp).timeout(const Duration(seconds: 6));
      }
    } catch (_) {
      // Firebase Auth and the local timestamp still preserve the start date.
    }
  }

  Future<void> _saveLocalActivityEvents() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _activityStorageKey,
      jsonEncode(
          {for (final event in activityEvents) event.id: event.toJson()}),
    );
  }

  Future<void> _saveCloudRecords() async {
    final reference = _cloudUserReference;
    if (reference == null) return;

    try {
      await reference.update({
        'routine': records,
        'lastActiveAt': ServerValue.timestamp,
      }).timeout(const Duration(seconds: 8));
    } catch (_) {
      // Local activity remains available until the next successful sync.
    }
  }

  Future<void> _loadLocalState() async {
    final prefs = await SharedPreferences.getInstance();
    final savedUserName = prefs.getString(_nameStorageKey);
    final savedRecords = prefs.getString(_routineStorageKey) ??
        (widget.user == null ? null : prefs.getString(routineKey));
    final localLikedQuotes =
        prefs.getStringList(_likedQuotesStorageKey) ?? const <String>[];
    final localActivityValue = prefs.getString(_activityStorageKey);
    var localActivityEvents = const <DevoteeActivityEvent>[];
    if (localActivityValue != null) {
      try {
        localActivityEvents =
            devoteeActivityEventsFromValue(jsonDecode(localActivityValue));
      } catch (_) {
        localActivityEvents = const [];
      }
    }
    final locallyCreatedAt = prefs.getInt(_accountCreatedAtStorageKey);
    final savedMeditationPresets =
        prefs.getStringList(_meditationPresetsStorageKey) ??
            (widget.user == null
                ? null
                : prefs.getStringList(_meditationPresetsKey));
    meditationPresetMinutes = normalizeMeditationPresetMinutes(
      savedMeditationPresets,
      useDefaultsWhenEmpty: true,
    );
    final savedMeditationMinutes =
        prefs.getInt(_selectedMeditationMinutesStorageKey) ??
            (widget.user == null
                ? null
                : prefs.getInt(_selectedMeditationMinutesKey));
    if (savedMeditationMinutes != null &&
        savedMeditationMinutes >= 1 &&
        savedMeditationMinutes < 24 * 60) {
      selectedDurationSeconds = savedMeditationMinutes * 60;
      remainingSeconds = selectedDurationSeconds;
    }
    var savedProfile = DevoteeProfile.fromStoredValue(savedUserName);

    if (savedProfile == null && widget.user == null) {
      savedProfile = DevoteeProfile.fromStoredValue(prefs.getString(nameKey));
    }
    savedProfile ??= await _loadCloudProfile();
    final user = widget.user;
    savedProfile ??= user == null
        ? null
        : profileForAuthenticatedProvider(
            providerIds:
                user.providerData.map((provider) => provider.providerId),
            displayName: user.displayName,
          );

    if (savedProfile != null) {
      devoteeProfile = savedProfile;
      await prefs.setString(_nameStorageKey, jsonEncode(savedProfile.toJson()));
      if (widget.user != null) {
        await prefs.setString(nameKey, jsonEncode(savedProfile.toJson()));
        unawaited(_saveCloudProfile(savedProfile));
      }
    } else {
      needsProfileName = true;
    }

    final cloudRecords = await _loadCloudRecords();
    final cloudLikedQuotes = await _loadCloudLikedQuotes();
    final cloudActivityEvents = await _loadCloudActivityEvents();
    final cloudCreatedAt = await _loadCloudAccountCreatedAt();
    likedQuoteIds = {...cloudLikedQuotes, ...localLikedQuotes};
    activityEvents = {
      for (final event in [...cloudActivityEvents, ...localActivityEvents])
        event.id: event,
    }.values.toList()
      ..sort((a, b) => b.timestamp.compareTo(a.timestamp));

    records = {...cloudRecords};
    if (savedRecords != null) {
      try {
        final decoded = jsonDecode(savedRecords);
        final localRecords = routineRecordsFromValue(decoded);
        for (final entry in localRecords.entries) {
          records[entry.key] = {
            ...?records[entry.key],
            ...entry.value,
          };
        }
      } catch (_) {
        // Keep any activity restored from Firebase.
      }
    }

    final creationCandidates = <int>[
      if (locallyCreatedAt != null) locallyCreatedAt,
      if (cloudCreatedAt != null) cloudCreatedAt,
      if (widget.user?.metadata.creationTime != null)
        widget.user!.metadata.creationTime!.millisecondsSinceEpoch,
      ...records.keys
          .map(DateTime.tryParse)
          .whereType<DateTime>()
          .map((date) => date.millisecondsSinceEpoch),
      ...activityEvents.map((event) => event.timestamp),
    ];
    final resolvedCreatedAt = creationCandidates.isEmpty
        ? DateTime.now().millisecondsSinceEpoch
        : creationCandidates.reduce(min);
    accountCreatedAt = _dateOnly(
      DateTime.fromMillisecondsSinceEpoch(resolvedCreatedAt),
    );
    await prefs.setInt(_accountCreatedAtStorageKey, resolvedCreatedAt);
    unawaited(_ensureCloudAccountCreatedAt(resolvedCreatedAt));
    await _saveLocalActivityEvents();

    if (widget.user != null && records.isNotEmpty) {
      unawaited(_saveCloudRecords());
    }

    localStateLoaded = true;
    if (mounted) setState(() {});
    unawaited(_trackActivity('app_opened', label: 'Home'));
    _scheduleWelcomeDialog();
  }

  Future<void> _saveMeditationPresetState() async {
    final prefs = await SharedPreferences.getInstance();
    final values =
        meditationPresetMinutes.map((minutes) => '$minutes').toList();
    final selectedMinutes = selectedDurationSeconds ~/ 60;
    await prefs.setStringList(_meditationPresetsStorageKey, values);
    await prefs.setInt(_selectedMeditationMinutesStorageKey, selectedMinutes);
    if (widget.user != null) {
      await prefs.setStringList(_meditationPresetsKey, values);
      await prefs.setInt(_selectedMeditationMinutesKey, selectedMinutes);
    }
  }

  Future<void> _saveProfile(DevoteeProfile profile) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_nameStorageKey, jsonEncode(profile.toJson()));
    if (widget.user != null) {
      await prefs.setString(nameKey, jsonEncode(profile.toJson()));
      unawaited(_saveCloudProfile(profile));
    }
    if (mounted) {
      setState(() {
        devoteeProfile = profile;
        needsProfileName = false;
      });
    }
    _scheduleWelcomeDialog();
  }

  void _scheduleWelcomeDialog() {
    if (welcomeDialogShown || needsProfileName || devoteeProfile == null) {
      return;
    }

    welcomeDialogShown = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || needsProfileName || devoteeProfile == null) return;
      showGeneralDialog<void>(
        context: context,
        barrierDismissible: false,
        barrierLabel: 'Welcome',
        barrierColor: Colors.black.withValues(alpha: 0.64),
        transitionDuration: const Duration(milliseconds: 360),
        pageBuilder: (context, animation, secondaryAnimation) {
          return _GuruWelcomeDialog(name: devoteeProfile!.displayName);
        },
        transitionBuilder: (context, animation, secondaryAnimation, child) {
          final curve = CurvedAnimation(
            parent: animation,
            curve: Curves.easeOutCubic,
            reverseCurve: Curves.easeInCubic,
          );
          return FadeTransition(
            opacity: curve,
            child: ScaleTransition(
              scale: Tween<double>(begin: 0.94, end: 1).animate(curve),
              child: child,
            ),
          );
        },
      );
    });
  }

  Future<void> _saveRecords() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_routineStorageKey, jsonEncode(records));
    await _saveCloudRecords();
  }

  String get todayKey => DateFormat('yyyy-MM-dd').format(DateTime.now());

  Map<String, bool> get today => records[todayKey] ?? {};

  Future<void> _markTask(RoutineTask task) async {
    setState(() {
      records[todayKey] = {
        ...today,
        task.name: true,
      };
    });
    await _saveRecords();
  }

  MediaItem _backgroundMediaItem({
    required String id,
    required String title,
    required String description,
    Duration? duration,
  }) {
    return MediaItem(
      id: id,
      album: 'Guru Vandan',
      title: title,
      artist: description,
      duration: duration,
    );
  }

  ja.UriAudioSource _assetAudioSource(
    String assetPath,
    MediaItem mediaItem,
  ) {
    final normalized =
        assetPath.startsWith('assets/') ? assetPath : 'assets/$assetPath';
    return ja.AudioSource.asset(normalized, tag: mediaItem);
  }

  Future<void> _prepareBackgroundAudio({
    required ja.AudioSource source,
    required BackgroundPlaybackKind kind,
    required bool loop,
    required double volume,
  }) async {
    final player = _backgroundAudioPlayer;
    if (player == null) return;

    audioMutationInProgress = true;
    audioCompletionHandled = false;
    try {
      await player.stop();
      playbackKind = kind;
      await player.setLoopMode(loop ? ja.LoopMode.one : ja.LoopMode.off);
      await player.setVolume(volume);
      await player.setAudioSource(source);
    } finally {
      audioMutationInProgress = false;
    }
  }

  void _playPreparedBackgroundAudio() {
    final player = _backgroundAudioPlayer;
    if (player == null) return;
    unawaited(player.play());
  }

  Future<void> _stopBackgroundAudio() async {
    final player = _backgroundAudioPlayer;
    if (playbackKind == BackgroundPlaybackKind.satsang) {
      await _finishSatsangActivity();
    }
    audioMutationInProgress = true;
    try {
      playbackKind = BackgroundPlaybackKind.none;
      if (player != null) {
        await player.stop();
        await player.setLoopMode(ja.LoopMode.off);
        await player.setVolume(1);
      }
    } finally {
      audioMutationInProgress = false;
      backgroundAudioPlaying = false;
    }
  }

  Future<void> _handleBackgroundCompletion(
      BackgroundPlaybackKind completedKind) async {
    if (completedKind == BackgroundPlaybackKind.satsang) {
      final completedTask = activeTrackTask;
      if (mounted) {
        setState(() {
          activeTrackId = null;
          activeTrackTask = null;
          audioPosition = Duration.zero;
          backgroundAudioPlaying = false;
        });
      }
      if (completedTask != null) await _markTask(completedTask);
      await _stopBackgroundAudio();
      return;
    }

    if (completedKind == BackgroundPlaybackKind.meditation &&
        meditationSessionStarted &&
        meditationChantPhase == null) {
      final token = meditationRunToken;
      meditationTimer?.cancel();
      if (mounted) {
        setState(() {
          remainingSeconds = 0;
          meditationRunning = false;
          meditationEndsAt = null;
          backgroundAudioPlaying = false;
        });
      }
      await _finishMeditationSession(token);
    }
  }

  Future<void> _handleBackgroundStop(BackgroundPlaybackKind stoppedKind) async {
    if (audioMutationInProgress || playbackKind != stoppedKind) return;

    playbackKind = BackgroundPlaybackKind.none;
    if (stoppedKind == BackgroundPlaybackKind.meditation) {
      _pauseMeditationClock();
    }
    if (!mounted) return;
    setState(() {
      backgroundAudioPlaying = false;
      if (stoppedKind == BackgroundPlaybackKind.satsang) {
        activeTrackId = null;
        activeTrackTask = null;
        audioPosition = Duration.zero;
      }
      if (stoppedKind == BackgroundPlaybackKind.mantra) {
        mantraLoopEnabled = false;
        mantraLoopPlaying = false;
      }
    });
  }

  void _pauseMeditationClock() {
    if (!meditationRunning) return;
    _syncMeditationTimerWithClock();
    if (!meditationRunning) return;
    meditationTimer?.cancel();
    if (mounted) {
      setState(() {
        meditationRunning = false;
        meditationEndsAt = null;
      });
    }
  }

  Future<void> _resetToday() async {
    meditationRunToken++;
    await _recordMeditationActivity(completed: false);
    if (playbackKind == BackgroundPlaybackKind.meditation ||
        playbackKind == BackgroundPlaybackKind.closingChant) {
      await _stopBackgroundAudio();
    }
    setState(() {
      records.remove(todayKey);
      meditationComplete = false;
      meditationFinishing = false;
      meditationRunning = false;
      meditationSessionStarted = false;
      meditationChantPhase = null;
      meditationEndsAt = null;
      meditationUsesMantra = false;
      mantraLoopEnabled = false;
      mantraLoopPlaying = false;
      remainingSeconds = selectedDurationSeconds;
    });
    meditationTimer?.cancel();
    await _saveRecords();
  }

  Future<void> _signOut() async {
    meditationRunToken++;
    meditationTimer?.cancel();
    meditationEndsAt = null;
    await _recordMeditationActivity(completed: false);
    await _finishSatsangActivity();
    await _stopBackgroundAudio();
    try {
      if (Firebase.apps.isNotEmpty) {
        await FirebaseAuth.instance.signOut();
        await _signOutFromGoogleProvider();
      }
    } finally {
      // Clear this last so a pending authenticated-user callback cannot
      // recreate the remembered session after Firebase has signed out.
      await _forgetAuthenticatedUser();
      if (mounted) {
        setState(() => showSignInAfterLogout = true);
      }
    }
  }

  Future<void> _deleteAccount() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null || widget.user == null || user.uid != widget.user!.uid) {
      throw const _AuthIntegrityException(
        'Your signed-in session could not be verified. Sign in again before deleting the account.',
      );
    }

    if (mounted) setState(() => accountDeletionInProgress = true);
    try {
      final authorization = await _reauthenticateForAccountDeletion(user);

      final appleAuthorizationCode = authorization.appleAuthorizationCode;
      if (appleAuthorizationCode != null) {
        await FirebaseAuth.instance
            .revokeTokenWithAuthorizationCode(appleAuthorizationCode);
      }

      if (authorization.hasGoogleProvider) {
        try {
          await _ensureGoogleSignInReady();
          await GoogleSignIn.instance.disconnect();
        } catch (_) {
          // Firebase account deletion below still permanently removes the
          // Google sign-in association from Guru Vandan.
        }
      }

      await FirebaseDatabase.instance
          .ref('users/${user.uid}')
          .remove()
          .timeout(const Duration(seconds: 12));

      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('$nameKey:${user.uid}');
      await prefs.remove('$routineKey:${user.uid}');
      await prefs.remove('$likedQuotesKey:${user.uid}');
      await prefs.remove(nameKey);
      await prefs.remove(routineKey);
      await prefs.remove(likedQuotesKey);
      await prefs.remove(_rememberedAuthUidKey);

      await user.delete();
      await _signOutFromGoogleProvider();

      if (mounted) {
        setState(() => showSignInAfterLogout = true);
      }
    } finally {
      if (mounted) setState(() => accountDeletionInProgress = false);
    }
  }

  Future<void> _playSatsang(SatsangTrack track) async {
    final task = _routineTaskForSatsangSession(track.session);
    final player = _backgroundAudioPlayer;

    try {
      if (activeTrackId == track.id) {
        if (player?.playing == true) {
          await player?.pause();
        } else {
          final confirmed =
              await _confirmPhoneSilent('your satsang can continue peacefully');
          if (!confirmed) return;
          _playPreparedBackgroundAudio();
        }
        setState(() {});
        return;
      }

      final confirmed =
          await _confirmPhoneSilent('your satsang can continue peacefully');
      if (!confirmed) return;

      _pauseMeditationClock();
      await _stopBackgroundAudio();
      if (!mounted) return;
      audioPosition = Duration.zero;
      audioDuration = Duration.zero;

      final displayTrack = localizedSatsangTrack(context, track);
      activeTrackAnalyticsTitle = displayTrack.title;
      activeTrackAnalyticsSession = track.session;
      final mediaItem = _backgroundMediaItem(
        id: 'satsang:${track.id}',
        title: displayTrack.title,
        description: track.session == SatsangSession.aarti
            ? appText(context, 'Aarti', 'आरती')
            : appText(context, 'Satsang', 'सत्संग'),
      );

      late final ja.AudioSource source;
      if (track.audioUrl != null && track.audioUrl!.isNotEmpty) {
        source = ja.AudioSource.uri(
          Uri.parse(track.audioUrl!),
          tag: mediaItem,
        );
      } else if (track.assetPath != null && track.assetPath!.isNotEmpty) {
        source = _assetAudioSource(track.assetPath!, mediaItem);
      } else {
        source = _assetAudioSource(
          'audio/morning_satsang_astuti_rishikesh.mp3',
          mediaItem,
        );
      }

      await _prepareBackgroundAudio(
        source: source,
        kind: BackgroundPlaybackKind.satsang,
        loop: false,
        volume: 1,
      );

      setState(() {
        activeTrackId = track.id;
        activeTrackTask = task;
        mantraLoopEnabled = false;
        mantraLoopPlaying = false;
        meditationUsesMantra = false;
      });
      _playPreparedBackgroundAudio();
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(appText(
            context,
            'The sacred satsang recording could not begin.',
            'पावन सत्संग-ध्वनि का श्रवण आरंभ नहीं हो सका।',
          )),
        ),
      );
    }
  }

  void _setMeditationPresetMinutes(int minutes) {
    _setMeditationDuration(Duration(minutes: minutes));
  }

  void _setMeditationDuration(Duration duration) {
    unawaited(_recordMeditationActivity(completed: false));
    meditationRunToken++;
    meditationTimer?.cancel();
    if (playbackKind == BackgroundPlaybackKind.meditation ||
        playbackKind == BackgroundPlaybackKind.closingChant) {
      unawaited(_stopBackgroundAudio());
    }
    final safeSeconds = _minimumMeditationDuration(duration).inSeconds;
    setState(() {
      selectedDurationSeconds = safeSeconds;
      remainingSeconds = safeSeconds;
      meditationPresetEditMode = false;
      meditationRunning = false;
      meditationComplete = false;
      meditationFinishing = false;
      meditationSessionStarted = false;
      meditationChantPhase = null;
      meditationEndsAt = null;
      meditationUsesMantra = false;
      mantraLoopEnabled = false;
      mantraLoopPlaying = false;
    });
    unawaited(_saveMeditationPresetState());
  }

  Future<void> _openCustomMeditationDuration() async {
    if (meditationRunning || meditationChantPhase != null) return;

    final picked = await showModalBottomSheet<Duration>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _CustomDurationSheet(
        initialDuration: Duration(seconds: selectedDurationSeconds),
      ),
    );

    if (picked == null) return;
    final minutes = _minimumMeditationDuration(picked).inMinutes;
    setState(() {
      if (!meditationPresetMinutes.contains(minutes)) {
        meditationPresetMinutes = [...meditationPresetMinutes, minutes]..sort();
      }
    });
    _setMeditationDuration(Duration(minutes: minutes));
  }

  void _beginMeditationPresetEditing() {
    if (meditationRunning || meditationChantPhase != null) return;
    if (!meditationPresetEditMode) {
      setState(() => meditationPresetEditMode = true);
    }
  }

  void _finishMeditationPresetEditing() {
    if (meditationPresetEditMode) {
      setState(() => meditationPresetEditMode = false);
    }
  }

  void _removeMeditationPreset(int minutes) {
    if (meditationRunning || meditationChantPhase != null) return;
    setState(() {
      meditationPresetMinutes =
          meditationPresetMinutes.where((preset) => preset != minutes).toList();
      if (meditationPresetMinutes.isEmpty) {
        meditationPresetEditMode = false;
      }
    });
    unawaited(_saveMeditationPresetState());
  }

  void _reorderMeditationPresets(int draggedMinutes, int targetMinutes) {
    if (meditationRunning || meditationChantPhase != null) return;
    final reordered = reorderMeditationPresetMinutes(
      meditationPresetMinutes,
      draggedMinutes,
      targetMinutes,
    );
    if (listEquals(reordered, meditationPresetMinutes)) return;
    setState(() => meditationPresetMinutes = reordered);
    unawaited(_saveMeditationPresetState());
  }

  void _toggleMeditation() {
    if (meditationChantPhase != null) return;

    if (meditationRunning) {
      unawaited(_pauseMeditationSession());
      return;
    }

    unawaited(_beginMeditationSession());
  }

  Future<void> _pauseMeditationSession() async {
    _pauseMeditationClock();
    if (playbackKind == BackgroundPlaybackKind.meditation) {
      await _backgroundAudioPlayer?.pause();
    }
  }

  Future<void> _beginMeditationSession() async {
    final confirmed =
        await _confirmPhoneSilent('your meditation can stay undisturbed');
    if (!confirmed) return;

    if (remainingSeconds <= 0) {
      setState(() {
        remainingSeconds = selectedDurationSeconds;
        meditationComplete = false;
      });
    }

    final token = ++meditationRunToken;
    await _prepareMeditationBackgroundAudio(
      withMantra: mantraLoopEnabled,
    );
    if (!mounted || token != meditationRunToken) return;
    setState(() {
      if (!meditationActivityOpen) {
        meditationActivityOpen = true;
        trackedMeditationPlannedSeconds = selectedDurationSeconds;
      }
      meditationSessionStarted = true;
      meditationFinishing = false;
      meditationUsesMantra = mantraLoopEnabled;
      activeTrackId = null;
      activeTrackTask = null;
      audioPosition = Duration.zero;
    });
    _startMeditationTimer(token);
    _playPreparedBackgroundAudio();
  }

  Future<void> _prepareMeditationBackgroundAudio({
    required bool withMantra,
  }) async {
    final duration = Duration(seconds: remainingSeconds);
    final durationLabel = _formatDurationLabel(context, duration);
    final mediaItem = _backgroundMediaItem(
      id: 'meditation-${duration.inSeconds}-${withMantra ? 'om' : 'silent'}',
      title: withMantra
          ? appText(context, 'Meditation with Om', 'ॐ के साथ ध्यान')
          : appText(context, 'Meditation', 'ध्यान'),
      description: appText(
        context,
        '$durationLabel meditation',
        '$durationLabel की ध्यान-साधना',
      ),
      duration: duration,
    );

    final source = _assetAudioSource(
      withMantra
          ? 'audio/om_mantra_417hz_loop.mp3'
          : 'audio/meditation_chant.mp3',
      mediaItem,
    );

    await _prepareBackgroundAudio(
      source: withMantra
          ? ja.ClippingAudioSource(
              child: source,
              end: duration,
              tag: mediaItem,
              duration: duration,
            )
          : source,
      kind: BackgroundPlaybackKind.meditation,
      loop: !withMantra,
      volume: withMantra ? 1 : 0,
    );
  }

  void _startMeditationTimer(int token) {
    meditationTimer?.cancel();
    meditationEndsAt = DateTime.now().add(Duration(seconds: remainingSeconds));
    meditationTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (token != meditationRunToken) {
        timer.cancel();
        return;
      }

      _syncMeditationTimerWithClock(token: token);
    });

    setState(() => meditationRunning = true);
  }

  void _syncMeditationTimerWithClock({int? token}) {
    if (!mounted ||
        !meditationRunning ||
        meditationChantPhase != null ||
        meditationEndsAt == null) {
      return;
    }
    if (token != null && token != meditationRunToken) return;

    final millisecondsLeft =
        meditationEndsAt!.difference(DateTime.now()).inMilliseconds;
    final nextRemaining = max(0, (millisecondsLeft / 1000).ceil());

    if (nextRemaining <= 0) {
      final activeToken = token ?? meditationRunToken;
      meditationTimer?.cancel();
      setState(() {
        remainingSeconds = 0;
        meditationRunning = false;
        meditationEndsAt = null;
      });
      unawaited(_finishMeditationSession(activeToken));
      return;
    }

    if (nextRemaining != remainingSeconds) {
      setState(() => remainingSeconds = nextRemaining);
    }
  }

  Future<void> _finishMeditationSession(int token) async {
    if (!mounted || token != meditationRunToken || meditationFinishing) return;
    meditationFinishing = true;

    try {
      final completionChimeError = appText(
        context,
        'The closing chant could not be heard; your meditation is still recorded as complete.',
        'समापन मंत्र का श्रवण नहीं हो सका; आपकी ध्यान-साधना पूर्ण अंकित है।',
      );

      await _stopBackgroundAudio();

      if (!mounted || token != meditationRunToken) return;

      setState(() {
        meditationChantPhase = MeditationChantPhase.closing;
        meditationRunning = false;
        meditationEndsAt = null;
        meditationUsesMantra = false;
        mantraLoopEnabled = false;
        mantraLoopPlaying = false;
      });

      try {
        await _playMeditationChant();
      } catch (_) {
        _showMeditationAudioError(completionChimeError);
      }

      if (!mounted || token != meditationRunToken) return;

      await _markTask(RoutineTask.meditation);
      await _recordMeditationActivity(completed: true);

      if (!mounted || token != meditationRunToken) return;

      setState(() {
        meditationChantPhase = null;
        meditationComplete = true;
        meditationSessionStarted = false;
        meditationEndsAt = null;
      });
    } finally {
      meditationFinishing = false;
    }
  }

  Future<void> _playMeditationChant() async {
    final player = _backgroundAudioPlayer;
    if (player == null) return;

    final mediaItem = _backgroundMediaItem(
      id: 'meditation-closing-chant',
      title: appText(context, 'Meditation complete', 'ध्यान पूर्ण'),
      description: appText(context, 'Sacred closing chant', 'पावन समापन मंत्र'),
    );
    await _prepareBackgroundAudio(
      source: _assetAudioSource('audio/meditation_chant.mp3', mediaItem),
      kind: BackgroundPlaybackKind.closingChant,
      loop: false,
      volume: 1,
    );

    final completed = Completer<void>();
    void finish() {
      if (!completed.isCompleted) completed.complete();
    }

    final stateSub = player.playerStateStream.listen((state) {
      if (state.processingState == ja.ProcessingState.completed ||
          state.processingState == ja.ProcessingState.idle) {
        finish();
      }
    });

    try {
      _playPreparedBackgroundAudio();
      await completed.future.timeout(const Duration(minutes: 5));
    } finally {
      await stateSub.cancel();
      await _stopBackgroundAudio();
    }
  }

  Future<void> _setMantraLoopEnabled(bool enabled) async {
    if (meditationChantPhase != null) return;

    if (!meditationSessionStarted) {
      if (playbackKind == BackgroundPlaybackKind.mantra) {
        await _stopBackgroundAudio();
      }
      if (!mounted) return;
      setState(() {
        mantraLoopEnabled = enabled;
        mantraLoopPlaying = false;
        meditationUsesMantra = false;
      });
      return;
    }

    if (enabled) {
      await _playMantraLoop();
    } else {
      await _stopMantraLoop();
    }
  }

  Future<void> _playMantraLoop() async {
    if (meditationChantPhase != null) return;

    try {
      if (meditationSessionStarted && remainingSeconds > 0) {
        final shouldKeepPlaying = meditationRunning;
        await _prepareMeditationBackgroundAudio(withMantra: true);

        if (!mounted) return;
        setState(() {
          mantraLoopEnabled = true;
          mantraLoopPlaying = shouldKeepPlaying;
          meditationUsesMantra = true;
        });
        if (shouldKeepPlaying) _playPreparedBackgroundAudio();
        return;
      }
      if (!mounted) return;
      setState(() {
        mantraLoopEnabled = true;
        mantraLoopPlaying = false;
        meditationUsesMantra = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        mantraLoopEnabled = false;
        mantraLoopPlaying = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(appText(
            context,
            'The Om mantra sound could not begin.',
            'ॐ मंत्र-नाद आरंभ नहीं हो सका।',
          )),
        ),
      );
    }
  }

  Future<void> _stopMantraLoop() async {
    if (meditationSessionStarted &&
        remainingSeconds > 0 &&
        meditationChantPhase == null) {
      final shouldKeepPlaying = meditationRunning;
      await _prepareMeditationBackgroundAudio(withMantra: false);
      if (!mounted) return;
      setState(() {
        mantraLoopEnabled = false;
        mantraLoopPlaying = false;
        meditationUsesMantra = false;
      });
      if (shouldKeepPlaying) _playPreparedBackgroundAudio();
      return;
    }

    if (playbackKind == BackgroundPlaybackKind.mantra) {
      await _stopBackgroundAudio();
    }
    if (!mounted) return;
    setState(() {
      mantraLoopEnabled = false;
      mantraLoopPlaying = false;
      meditationUsesMantra = false;
    });
  }

  Future<bool> _confirmPhoneSilent(String reason) async {
    if (!mounted) return false;
    if (silentPromptOpen) return false;

    silentPromptOpen = true;
    try {
      final confirmed = await showDialog<bool>(
        context: context,
        barrierDismissible: false,
        builder: (context) => _SilentPhoneDialog(reason: reason),
      );
      return confirmed == true;
    } finally {
      silentPromptOpen = false;
    }
  }

  void _resetMeditation() {
    unawaited(_recordMeditationActivity(completed: false));
    meditationRunToken++;
    meditationTimer?.cancel();
    if (playbackKind == BackgroundPlaybackKind.meditation ||
        playbackKind == BackgroundPlaybackKind.closingChant) {
      unawaited(_stopBackgroundAudio());
    }
    setState(() {
      meditationRunning = false;
      meditationComplete = false;
      meditationSessionStarted = false;
      meditationChantPhase = null;
      meditationEndsAt = null;
      meditationUsesMantra = false;
      if (playbackKind != BackgroundPlaybackKind.mantra) {
        mantraLoopEnabled = false;
        mantraLoopPlaying = false;
      }
      remainingSeconds = selectedDurationSeconds;
    });
  }

  void _showMeditationAudioError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _seekSatsang(Duration position) async {
    if (playbackKind != BackgroundPlaybackKind.satsang) return;
    final duration = audioDuration;
    if (duration <= Duration.zero) return;
    final bounded = Duration(
      milliseconds: position.inMilliseconds.clamp(
        0,
        duration.inMilliseconds,
      ),
    );
    await _backgroundAudioPlayer?.seek(bounded);
    if (mounted) setState(() => audioPosition = bounded);
  }

  @override
  Widget build(BuildContext context) {
    if (showSignInAfterLogout) {
      return _SignInScreen(
        onSignedIn: () {
          if (mounted) setState(() => showSignInAfterLogout = false);
        },
      );
    }

    if (!localStateLoaded || needsProfileName) {
      return Scaffold(
        body: Stack(
          children: [
            const Positioned.fill(child: _SacredBackground()),
            SafeArea(
              child: !localStateLoaded
                  ? const _ProfileLoadingScreen()
                  : _NameOnboardingScreen(onContinue: _saveProfile),
            ),
          ],
        ),
      );
    }

    final screens = {
      PracticeTab.home: _HomeScreen(
        name: devoteeProfile?.displayName ?? appText(context, 'Bhakt', 'भक्त'),
        today: today,
        records: records,
        activityEvents: activityEvents,
        accountCreatedAt: accountCreatedAt,
        onOpenSatsang: (session) {
          setState(() {
            selectedSession = session;
          });
          _selectTab(PracticeTab.satsang);
        },
        onOpenMeditation: () => _selectTab(PracticeTab.meditate),
        onResetToday: _resetToday,
        quotesStream: content.quotes(),
        onQuoteShared: _trackQuoteShared,
        likedQuoteIds: likedQuoteIds,
        onQuoteLiked: (quote) => unawaited(_toggleQuoteLiked(quote)),
      ),
      PracticeTab.satsang: _SatsangScreen(
        tracksStream: content.satsangs(),
        selectedSession: selectedSession,
        activeTrackId: activeTrackId,
        audioPosition: audioPosition,
        audioDuration: audioDuration,
        isPlaying: playbackKind == BackgroundPlaybackKind.satsang &&
            backgroundAudioPlaying,
        today: today,
        onSessionChanged: (session) async {
          if (playbackKind == BackgroundPlaybackKind.satsang) {
            await _stopBackgroundAudio();
          }
          setState(() {
            selectedSession = session;
            activeTrackId = null;
            activeTrackTask = null;
          });
        },
        onPlay: _playSatsang,
        onSeek: _seekSatsang,
        onMark: _markTask,
      ),
      PracticeTab.meditate: _MeditationScreen(
        selectedDurationSeconds: selectedDurationSeconds,
        remainingSeconds: remainingSeconds,
        meditationRunning: meditationRunning,
        meditationComplete: meditationComplete,
        meditationChantPhase: meditationChantPhase,
        mantraLoopEnabled: mantraLoopEnabled,
        presetMinutes: meditationPresetMinutes,
        presetEditMode: meditationPresetEditMode,
        todayDone: today[RoutineTask.meditation.name] == true,
        onPresetMinutesChanged: _setMeditationPresetMinutes,
        onCustomDuration: _openCustomMeditationDuration,
        onPresetEditStarted: _beginMeditationPresetEditing,
        onPresetEditFinished: _finishMeditationPresetEditing,
        onPresetRemoved: _removeMeditationPreset,
        onPresetReordered: _reorderMeditationPresets,
        onMantraLoopChanged: _setMantraLoopEnabled,
        onToggle: _toggleMeditation,
        onReset: _resetMeditation,
      ),
      PracticeTab.wisdom: _WisdomScreen(
        quotesStream: content.quotes(),
        initialQuotes: content.cachedQuotes,
        onRefresh: content.refreshQuotes,
        selectedQuoteId: selectedQuoteId,
        onQuoteViewed: _trackQuoteViewed,
        onQuoteShared: _trackQuoteShared,
        likedQuoteIds: likedQuoteIds,
        onQuoteLiked: (quote) => unawaited(_toggleQuoteLiked(quote)),
      ),
      PracticeTab.more: _MoreScreen(
        user: widget.user,
        profile: devoteeProfile!,
        onProfileChanged: _saveProfile,
        onSignOut: _signOut,
        onDeleteAccount: _deleteAccount,
        accountDeletionInProgress: accountDeletionInProgress,
      ),
    };

    return Scaffold(
      body: Stack(
        children: [
          const Positioned.fill(child: _SacredBackground()),
          SafeArea(
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 320),
              switchInCurve: Curves.easeOutCubic,
              switchOutCurve: Curves.easeInCubic,
              child: KeyedSubtree(
                key: ValueKey(tab),
                child: screens[tab]!,
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: _NavBar(
        selected: tab,
        onSelected: _selectTab,
      ),
    );
  }

  static SatsangSession _defaultSession() {
    final hour = DateTime.now().hour;
    return hour >= 3 && hour < 12
        ? SatsangSession.morning
        : SatsangSession.evening;
  }
}

class _ProfileLoadingScreen extends StatelessWidget {
  const _ProfileLoadingScreen();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SizedBox(
        width: 58,
        height: 58,
        child: CircularProgressIndicator(
          strokeWidth: 5,
          color: _primaryActionColor(),
          backgroundColor: _surfaceColor(AppColors.rose),
        ),
      ),
    );
  }
}

class _NameOnboardingScreen extends StatefulWidget {
  const _NameOnboardingScreen({required this.onContinue});

  final ValueChanged<DevoteeProfile> onContinue;

  @override
  State<_NameOnboardingScreen> createState() => _NameOnboardingScreenState();
}

class _NameOnboardingScreenState extends State<_NameOnboardingScreen> {
  final firstName = TextEditingController();
  final middleName = TextEditingController();
  final lastName = TextEditingController();
  String? error;

  @override
  void dispose() {
    firstName.dispose();
    middleName.dispose();
    lastName.dispose();
    super.dispose();
  }

  void _continue() {
    final profile = DevoteeProfile.fromParts(
      firstName: firstName.text,
      middleName: middleName.text,
      lastName: lastName.text,
    );
    if (profile == null) {
      setState(() => error = appText(
            context,
            'Please enter your first name.',
            'कृपया अपना प्रथम नाम अंकित करें।',
          ));
      return;
    }
    widget.onContinue(profile);
  }

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 520),
          child: Container(
            padding: const EdgeInsets.fromLTRB(24, 26, 24, 24),
            decoration: _cardDecoration(color: AppColors.offWhite).copyWith(
              boxShadow: [
                BoxShadow(
                  color: AppColors.deepCrimson.withValues(alpha: 0.11),
                  blurRadius: 30,
                  offset: const Offset(0, 18),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: SizedBox(
                    width: 118,
                    height: 118,
                    child: const _AppIconMark(),
                  ),
                ),
                const SizedBox(height: 24),
                Text(
                  appText(
                    context,
                    'Welcome to Guru Vandan',
                    'गुरु वंदन में हार्दिक अभिनंदन',
                  ),
                  textAlign: TextAlign.center,
                  style: _headingStyle(
                    LanguageScope.of(context).language,
                    color: AppColors.ink,
                    fontSize: 31,
                    height: 1.08,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 24),
                TextField(
                  controller: firstName,
                  autofocus: true,
                  textCapitalization: TextCapitalization.words,
                  textInputAction: TextInputAction.next,
                  onChanged: (_) {
                    if (error != null) setState(() => error = null);
                  },
                  decoration: _inputDecoration(
                    appText(context, 'First name', 'प्रथम नाम'),
                  ).copyWith(
                    errorText: error,
                    prefixIcon: const Icon(Icons.person_rounded),
                  ),
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: middleName,
                  textCapitalization: TextCapitalization.words,
                  textInputAction: TextInputAction.next,
                  decoration: _inputDecoration(
                    appText(context, 'Middle name', 'मध्य नाम'),
                  ).copyWith(
                    prefixIcon: const Icon(Icons.badge_rounded),
                  ),
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: lastName,
                  textCapitalization: TextCapitalization.words,
                  textInputAction: TextInputAction.done,
                  onSubmitted: (_) => _continue(),
                  decoration: _inputDecoration(
                    appText(context, 'Last name', 'कुलनाम'),
                  ).copyWith(
                    prefixIcon: const Icon(Icons.family_restroom_rounded),
                  ),
                ),
                const SizedBox(height: 18),
                FilledButton.icon(
                  onPressed: _continue,
                  icon: const Icon(Icons.arrow_forward_rounded),
                  label: Text(
                    appText(context, 'Begin', 'आरंभ'),
                  ),
                  style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(58),
                    backgroundColor: _primaryActionColor(),
                    foregroundColor: _onPrimaryActionColor(),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _GuruWelcomeDialog extends StatelessWidget {
  const _GuruWelcomeDialog({required this.name});

  final String name;

  @override
  Widget build(BuildContext context) {
    final language = LanguageScope.of(context).language;
    final dark = Theme.of(context).brightness == Brightness.dark;

    return SafeArea(
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 326),
            child: Material(
              color: _raisedSurfaceColor(),
              elevation: 24,
              shadowColor: Colors.black.withValues(alpha: 0.48),
              borderRadius: BorderRadius.circular(26),
              child: Container(
                clipBehavior: Clip.antiAlias,
                decoration: BoxDecoration(
                  color: _raisedSurfaceColor(),
                  borderRadius: BorderRadius.circular(26),
                  border: Border.all(
                    color: dark
                        ? AppColors.darkGold.withValues(alpha: 0.55)
                        : AppColors.gold.withValues(alpha: 0.52),
                    width: 1.2,
                  ),
                ),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(22, 20, 22, 22),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            width: 54,
                            height: 54,
                            padding: const EdgeInsets.all(3),
                            decoration: BoxDecoration(
                              color: _surfaceColor(AppColors.parchment),
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: _readableColor(AppColors.gold)!,
                                width: 1.5,
                              ),
                            ),
                            child: ClipOval(
                              child: Image.asset(
                                'assets/images/guru_image.jpeg',
                                fit: BoxFit.cover,
                                alignment: Alignment.topCenter,
                              ),
                            ),
                          ),
                          const SizedBox(width: 13),
                          Flexible(
                            child: Text(
                              'Guru Vandan',
                              maxLines: 1,
                              overflow: TextOverflow.fade,
                              softWrap: false,
                              style: _headingStyle(
                                language,
                                color: AppColors.ink,
                                fontSize: 19,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                          ),
                        ],
                      ),
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 17),
                        child: Divider(
                          height: 1,
                          color: _borderColor(AppColors.borderStrong),
                        ),
                      ),
                      Text(
                        appText(
                          context,
                          'Jai Guru, $name!',
                          'जय गुरु, $name!',
                        ),
                        textAlign: TextAlign.center,
                        style: _headingStyle(
                          language,
                          color: AppColors.maroon,
                          fontSize: 22,
                          height: 1.15,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 19),
                      SizedBox(
                        width: 136,
                        height: 44,
                        child: FilledButton(
                          onPressed: () => Navigator.of(context).pop(),
                          style: FilledButton.styleFrom(
                            backgroundColor: _primaryActionColor(),
                            foregroundColor: _onPrimaryActionColor(),
                            padding: const EdgeInsets.symmetric(horizontal: 18),
                            shape: const StadiumBorder(),
                            elevation: 3,
                            shadowColor:
                                AppColors.maroon.withValues(alpha: 0.32),
                            textStyle: _bodyStyle(
                              language,
                              fontSize: 15,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          child: Text(
                            appText(context, 'Enter', 'प्रवेश'),
                            textAlign: TextAlign.center,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ignore: unused_element
class _GuruWelcomeDialogLegacy extends StatelessWidget {
  const _GuruWelcomeDialogLegacy({required this.name});

  final String name;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(18),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 380),
            child: Material(
              color: Colors.transparent,
              child: Container(
                clipBehavior: Clip.antiAlias,
                decoration: BoxDecoration(
                  color: _raisedSurfaceColor(),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: _borderColor(AppColors.borderStrong),
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.deepCrimson.withValues(alpha: 0.28),
                      blurRadius: 38,
                      offset: const Offset(0, 24),
                    ),
                  ],
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.fromLTRB(22, 22, 22, 20),
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          colors: [AppColors.maroon, AppColors.crimson],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                      ),
                      child: Column(
                        children: [
                          Container(
                            width: 78,
                            height: 78,
                            padding: const EdgeInsets.all(4),
                            decoration: BoxDecoration(
                              color: AppColors.offWhite,
                              shape: BoxShape.circle,
                              border: Border.all(
                                  color: AppColors.softGold, width: 2),
                              boxShadow: [
                                BoxShadow(
                                  color: AppColors.deepCrimson
                                      .withValues(alpha: 0.32),
                                  blurRadius: 18,
                                  offset: const Offset(0, 10),
                                ),
                              ],
                            ),
                            child: ClipOval(
                              child: Image.asset(
                                'assets/images/guru_image.jpeg',
                                fit: BoxFit.cover,
                                alignment: Alignment.topCenter,
                              ),
                            ),
                          ),
                          const SizedBox(height: 12),
                          Text(
                            'Guru Vandan',
                            textAlign: TextAlign.center,
                            style: GoogleFonts.lora(
                              color: AppColors.offWhite,
                              fontSize: 24,
                              height: 1.05,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(24, 22, 24, 24),
                      child: Column(
                        children: [
                          Text(
                            'जय गुरु, $name!',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: _readableColor(AppColors.maroon),
                              fontSize: 23,
                              height: 1.18,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(height: 10),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Container(
                                width: 34,
                                height: 3,
                                decoration: BoxDecoration(
                                  color: AppColors.softGold,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                              ),
                              const SizedBox(width: 10),
                              const Icon(Icons.format_quote_rounded,
                                  color: AppColors.rose, size: 30),
                              const SizedBox(width: 10),
                              Container(
                                width: 34,
                                height: 3,
                                decoration: BoxDecoration(
                                  color: AppColors.softGold,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 20),
                          FilledButton(
                            onPressed: () => Navigator.of(context).pop(),
                            style: FilledButton.styleFrom(
                              minimumSize: const Size(170, 56),
                              backgroundColor: _primaryActionColor(),
                              foregroundColor: _onPrimaryActionColor(),
                              padding:
                                  const EdgeInsets.symmetric(horizontal: 26),
                              shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(8)),
                              elevation: 8,
                              shadowColor:
                                  AppColors.maroon.withValues(alpha: 0.24),
                              textStyle: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w900,
                                height: 1.15,
                              ),
                            ),
                            child: const Text(
                              'प्रवेश करें —\nEnter',
                              textAlign: TextAlign.center,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SilentPhoneDialog extends StatelessWidget {
  const _SilentPhoneDialog({required this.reason});

  final String reason;

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      child: AlertDialog(
        backgroundColor: _raisedSurfaceColor(),
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
          side: BorderSide(color: _borderColor(AppColors.borderStrong)),
        ),
        icon: Container(
          width: 58,
          height: 58,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: _surfaceColor(AppColors.rose),
          ),
          child: Icon(
            Icons.notifications_paused_rounded,
            color: _readableColor(AppColors.maroon),
            size: 31,
          ),
        ),
        title: Text(
          appText(
            context,
            'Prepare for sacred listening',
            'साधना हेतु दूरभाष मौन करें',
          ),
          textAlign: TextAlign.center,
          style: _headingStyle(
            LanguageScope.of(context).language,
            color: AppColors.ink,
            fontSize: 25,
            height: 1.1,
            fontWeight: FontWeight.w900,
          ),
        ),
        content: Text(
          appText(
            context,
            'Please silence your phone so $reason.',
            'निर्विघ्न साधना हेतु कृपया दूरभाष को मौन अवस्था में रखें।',
          ),
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodyLarge,
        ),
        actionsAlignment: MainAxisAlignment.center,
        actionsPadding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
        actions: [
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: FilledButton.styleFrom(
              minimumSize: const Size.fromHeight(54),
              backgroundColor: _primaryActionColor(),
              foregroundColor: _onPrimaryActionColor(),
            ),
            child: Text(appText(context, 'Continue', 'स्वीकार')),
          ),
        ],
      ),
    );
  }
}

class _HomeScreen extends StatelessWidget {
  const _HomeScreen({
    required this.name,
    required this.today,
    required this.records,
    required this.activityEvents,
    required this.accountCreatedAt,
    required this.onOpenSatsang,
    required this.onOpenMeditation,
    required this.onResetToday,
    required this.quotesStream,
    required this.onQuoteShared,
    required this.likedQuoteIds,
    required this.onQuoteLiked,
  });

  final String name;
  final Map<String, bool> today;
  final Map<String, Map<String, bool>> records;
  final List<DevoteeActivityEvent> activityEvents;
  final DateTime accountCreatedAt;
  final ValueChanged<SatsangSession> onOpenSatsang;
  final VoidCallback onOpenMeditation;
  final VoidCallback onResetToday;
  final Stream<List<WisdomQuote>> quotesStream;
  final ValueChanged<WisdomQuote> onQuoteShared;
  final Set<String> likedQuoteIds;
  final ValueChanged<WisdomQuote> onQuoteLiked;

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<List<WisdomQuote>>(
      stream: quotesStream,
      initialData: fallbackQuotes,
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return _PageScaffold(
            children: [
              _ScreenTitle(
                icon: Icons.format_quote_rounded,
                title: appText(context, 'Guru Vani', 'गुरु वाणी'),
              ),
              const _WisdomLoadingCard(),
            ],
          );
        }

        final quotes =
            snapshot.data?.isNotEmpty == true ? snapshot.data! : fallbackQuotes;
        final dailyQuote = quoteTimelineForDate(quotes).daily;

        return _PageScaffold(
          children: [
            _HeroPanel(
              name: name,
              onMorningSatsang: () => onOpenSatsang(SatsangSession.morning),
              onMeditation: onOpenMeditation,
              onEveningSatsang: () => onOpenSatsang(SatsangSession.evening),
            ),
            _SectionHeader(
              title: appText(
                context,
                'Today\'s Sacred Practice',
                'आज की साधना',
              ),
              action: IconButton.filledTonal(
                onPressed: onResetToday,
                icon: const Icon(Icons.restart_alt_rounded),
                tooltip: appText(context, 'Clear today\'s record',
                    'आज का साधना-लेख निरस्त करें'),
              ),
            ),
            _RoutineTile(
              title: appText(context, 'Morning satsang', 'प्रातः सत्संग'),
              done: today[RoutineTask.morningSatsang.name] == true,
              icon: Icons.wb_sunny_rounded,
              onTap: () => onOpenSatsang(SatsangSession.morning),
            ),
            _RoutineTile(
              title: appText(context, 'Meditation', 'ध्यान'),
              done: today[RoutineTask.meditation.name] == true,
              icon: Icons.self_improvement_rounded,
              onTap: onOpenMeditation,
            ),
            _RoutineTile(
              title: appText(context, 'Evening satsang', 'सायं सत्संग'),
              done: today[RoutineTask.eveningSatsang.name] == true,
              icon: Icons.nights_stay_rounded,
              onTap: () => onOpenSatsang(SatsangSession.evening),
            ),
            _MeditationStreakPanel(
              records: records,
              activityEvents: activityEvents,
              accountCreatedAt: accountCreatedAt,
            ),
            if (dailyQuote != null)
              _WisdomFeature(
                quote: localizedWisdomQuote(context, dailyQuote),
                onShared: onQuoteShared,
                liked: likedQuoteIds.contains(dailyQuote.id),
                onLiked: onQuoteLiked,
              ),
            const _AboutHomeSection(),
          ],
        );
      },
    );
  }
}

class _HeroPanel extends StatelessWidget {
  const _HeroPanel({
    required this.name,
    required this.onMorningSatsang,
    required this.onMeditation,
    required this.onEveningSatsang,
  });

  final String name;
  final VoidCallback onMorningSatsang;
  final VoidCallback onMeditation;
  final VoidCallback onEveningSatsang;

  @override
  Widget build(BuildContext context) {
    final language = LanguageScope.of(context).language;
    final hour = DateTime.now().hour;
    final greeting = hour < 12
        ? appText(context, 'Jai Guru, $name', 'जय गुरु, $name')
        : hour < 18
            ? appText(context, 'Grace-filled afternoon, $name',
                'मंगलमय मध्याह्न, $name')
            : appText(
                context, 'Blessed evening, $name', 'मंगलमय संध्या, $name');

    return LayoutBuilder(
      builder: (context, constraints) {
        final compact = constraints.maxWidth < 430;
        return Container(
          height: compact ? 480 : 340,
          clipBehavior: Clip.antiAlias,
          decoration: _cardDecoration(
            color: AppColors.deepCrimson,
            borderColor: AppColors.maroon.withValues(alpha: 0.28),
          ).copyWith(
            boxShadow: [
              BoxShadow(
                color: AppColors.maroon.withValues(alpha: 0.22),
                blurRadius: 34,
                offset: const Offset(0, 18),
              ),
            ],
          ),
          child: Stack(
            fit: StackFit.expand,
            children: [
              CustomPaint(painter: _DawnTemplePainter()),
              Positioned(
                right: compact ? 18 : 26,
                top: compact ? 18 : 24,
                child: _GuruPortrait(size: compact ? 92 : 118),
              ),
              Padding(
                padding: EdgeInsets.fromLTRB(24, compact ? 126 : 28, 24, 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 7),
                      decoration: BoxDecoration(
                        color: AppColors.offWhite.withValues(alpha: 0.13),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                            color: AppColors.softGold.withValues(alpha: 0.58)),
                      ),
                      child: Text(
                        'Guru Vandan',
                        style: GoogleFonts.inter(
                          color: AppColors.softGold,
                          fontSize: 15,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      greeting,
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: _headingStyle(
                        language,
                        color: AppColors.surface,
                        fontSize: compact ? 29 : 34,
                        fontWeight: FontWeight.w900,
                        height: 1.06,
                      ),
                    ),
                    const SizedBox(height: 20),
                    Wrap(
                      spacing: 10,
                      runSpacing: 10,
                      children: [
                        _HeroChip(
                          icon: Icons.wb_sunny_rounded,
                          label: appText(context, 'Morning', 'प्रातः'),
                          onTap: onMorningSatsang,
                        ),
                        _HeroChip(
                          icon: Icons.self_improvement_rounded,
                          label: appText(context, 'Meditation', 'ध्यान'),
                          onTap: onMeditation,
                        ),
                        _HeroChip(
                          icon: Icons.nights_stay_rounded,
                          label: appText(context, 'Evening', 'सायं'),
                          onTap: onEveningSatsang,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _GuruPortrait extends StatelessWidget {
  const _GuruPortrait({required this.size});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: AppColors.offWhite,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.softGold, width: 2),
        boxShadow: [
          BoxShadow(
            color: AppColors.deepCrimson.withValues(alpha: 0.28),
            blurRadius: 22,
            offset: const Offset(0, 14),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(5),
        child: Image.asset('assets/images/guru_image.jpeg',
            fit: BoxFit.cover, alignment: Alignment.topCenter),
      ),
    );
  }
}

class _HeroChip extends StatelessWidget {
  const _HeroChip({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(8),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(8),
          child: Ink(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: AppColors.offWhite.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(8),
              border:
                  Border.all(color: AppColors.offWhite.withValues(alpha: 0.22)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 18, color: AppColors.softGold),
                const SizedBox(width: 7),
                Text(
                  label,
                  style: const TextStyle(
                    color: AppColors.offWhite,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _DawnTemplePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final sky = Paint()
      ..shader = const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          Color(0xFF6E171A),
          Color(0xFF9D2B27),
          Color(0xFFD9814E),
        ],
      ).createShader(rect);
    canvas.drawRect(rect, sky);

    final glow = Paint()
      ..color = AppColors.softGold.withValues(alpha: 0.25)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 28);
    canvas.drawCircle(
        Offset(size.width * 0.72, size.height * 0.2), size.width * 0.26, glow);

    final river = Path()
      ..moveTo(0, size.height * 0.76)
      ..cubicTo(size.width * 0.22, size.height * 0.7, size.width * 0.42,
          size.height * 0.86, size.width, size.height * 0.72)
      ..lineTo(size.width, size.height)
      ..lineTo(0, size.height)
      ..close();
    canvas.drawPath(river,
        Paint()..color = const Color(0xFF582B34).withValues(alpha: 0.42));

    final pathPaint = Paint()
      ..color = AppColors.offWhite.withValues(alpha: 0.18)
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke;
    final path = Path()
      ..moveTo(size.width * 0.02, size.height * 0.88)
      ..quadraticBezierTo(size.width * 0.35, size.height * 0.74,
          size.width * 0.98, size.height * 0.82);
    canvas.drawPath(path, pathPaint);
  }

  @override
  bool shouldRepaint(covariant _DawnTemplePainter oldDelegate) => false;
}

class _MeditationStreakPanel extends StatelessWidget {
  const _MeditationStreakPanel({
    required this.records,
    required this.activityEvents,
    required this.accountCreatedAt,
  });

  final Map<String, Map<String, bool>> records;
  final List<DevoteeActivityEvent> activityEvents;
  final DateTime accountCreatedAt;

  @override
  Widget build(BuildContext context) {
    final history = sacredActivityHistory(
      records: records,
      events: activityEvents,
    );
    final overview = sacredStreakOverviewFor(
      history: history,
      accountCreatedAt: accountCreatedAt,
    );

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: _cardDecoration(color: AppColors.offWhite),
      child: Row(
        children: [
          Expanded(
            child: _StreakActionButton(
              valueKey: const Key('sacred-streak-current'),
              value: overview.current.length,
              label: appText(context, 'Current', 'वर्तमान'),
              color: AppColors.maroon,
              onTap: () => _showStreak(
                context,
                overview.current,
                current: true,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _StreakActionButton(
              valueKey: const Key('sacred-streak-longest'),
              value: overview.longest.length,
              label: appText(context, 'Longest', 'दीर्घतम'),
              color: AppColors.sage,
              onTap: () => _showStreak(
                context,
                overview.longest,
                current: false,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Semantics(
            button: true,
            label: appText(context, 'Calendar', 'पंचांग'),
            child: Material(
              color: _surfaceColor(AppColors.parchment),
              borderRadius: BorderRadius.circular(16),
              child: InkWell(
                key: const Key('sacred-activity-calendar'),
                onTap: () => _showCalendar(context, history),
                borderRadius: BorderRadius.circular(16),
                child: SizedBox(
                  width: 70,
                  height: 78,
                  child: Icon(
                    Icons.calendar_month_rounded,
                    color: _readableColor(AppColors.gold),
                    size: 31,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _showStreak(
    BuildContext context,
    SacredStreakSummary streak, {
    required bool current,
  }) async {
    final language = LanguageScope.of(context).language;
    await showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(
          current
              ? appText(context, 'Current', 'वर्तमान')
              : appText(context, 'Longest', 'दीर्घतम'),
          textAlign: TextAlign.center,
        ),
        content: streak.length == 0
            ? Text(
                appText(context, 'No active streak', 'कोई सक्रिय क्रम नहीं'),
                textAlign: TextAlign.center,
              )
            : Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    LanguageScope.of(context).language == AppLanguage.hindi
                        ? '${_hindiDigits('${streak.length}')} दिन'
                        : '${streak.length} days',
                    style: _headingStyle(
                      language,
                      color: AppColors.maroon,
                      fontSize: 28,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _streakKindLabel(context, streak.kind),
                    textAlign: TextAlign.center,
                    style: _bodyStyle(
                      language,
                      color: AppColors.ink,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 5),
                  Text(
                    _dateRangeLabel(context, streak.start!, streak.end!),
                    textAlign: TextAlign.center,
                    style: _bodyStyle(language, color: AppColors.taupe),
                  ),
                ],
              ),
        actionsAlignment: MainAxisAlignment.center,
        actions: [
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: Text(appText(context, 'Done', 'पूर्ण')),
          ),
        ],
      ),
    );
  }

  Future<void> _showCalendar(
    BuildContext context,
    Map<String, SacredDayActivity> history,
  ) async {
    final today = _dateOnly(DateTime.now());
    final firstDate = _dateOnly(accountCreatedAt).isAfter(today)
        ? today
        : _dateOnly(accountCreatedAt);
    final picked = await showDialog<DateTime>(
      context: context,
      builder: (dialogContext) => Dialog(
        insetPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 24),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 390),
          child: CalendarDatePicker(
            initialDate: today,
            firstDate: firstDate,
            lastDate: today,
            currentDate: today,
            onDateChanged: (date) => Navigator.pop(dialogContext, date),
          ),
        ),
      ),
    );
    if (picked == null || !context.mounted) return;
    final key = DateFormat('yyyy-MM-dd').format(picked);
    await _showDay(context, picked, history[key]);
  }

  Future<void> _showDay(
    BuildContext context,
    DateTime date,
    SacredDayActivity? activity,
  ) async {
    await showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(
          _dateLabel(context, date),
          textAlign: TextAlign.center,
        ),
        content: activity == null || !activity.hasAny
            ? Text(
                appText(
                  context,
                  'No sacred activity happened',
                  'कोई साधना नहीं हुई',
                ),
                textAlign: TextAlign.center,
              )
            : Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (activity.morningSatsang)
                    _ActivityDetailRow(
                      icon: Icons.wb_sunny_rounded,
                      label: appText(context, 'Morning', 'प्रातः'),
                      value: activity.morningSatsangSeconds > 0
                          ? localizedActivityDuration(
                              context,
                              activity.morningSatsangSeconds,
                            )
                          : appText(context, 'Done', 'पूर्ण'),
                    ),
                  if (activity.eveningSatsang)
                    _ActivityDetailRow(
                      icon: Icons.nights_stay_rounded,
                      label: appText(context, 'Evening', 'सायं'),
                      value: activity.eveningSatsangSeconds > 0
                          ? localizedActivityDuration(
                              context,
                              activity.eveningSatsangSeconds,
                            )
                          : appText(context, 'Done', 'पूर्ण'),
                    ),
                  if (activity.otherSatsangSeconds > 0)
                    _ActivityDetailRow(
                      icon: Icons.headphones_rounded,
                      label: appText(context, 'Satsang', 'सत्संग'),
                      value: localizedActivityDuration(
                        context,
                        activity.otherSatsangSeconds,
                      ),
                    ),
                  if (activity.meditation)
                    _ActivityDetailRow(
                      icon: Icons.self_improvement_rounded,
                      label: appText(context, 'Meditation', 'ध्यान'),
                      value: activity.meditationSeconds > 0
                          ? localizedActivityDuration(
                              context,
                              activity.meditationSeconds,
                            )
                          : appText(context, 'Done', 'पूर्ण'),
                    ),
                ],
              ),
        actionsAlignment: MainAxisAlignment.center,
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: Text(appText(context, 'Close', 'बंद')),
          ),
        ],
      ),
    );
  }

  String _streakKindLabel(BuildContext context, SacredStreakKind kind) {
    return switch (kind) {
      SacredStreakKind.fullPractice => appText(
          context, 'Morning + evening + meditation', 'प्रातः + सायं + ध्यान'),
      SacredStreakKind.satsangAndMeditation =>
        appText(context, 'Satsang + meditation', 'सत्संग + ध्यान'),
      SacredStreakKind.bothSatsangs =>
        appText(context, 'Morning + evening', 'प्रातः + सायं'),
      SacredStreakKind.meditation => appText(context, 'Meditation', 'ध्यान'),
      SacredStreakKind.morningSatsang =>
        appText(context, 'Morning satsang', 'प्रातः सत्संग'),
      SacredStreakKind.eveningSatsang =>
        appText(context, 'Evening satsang', 'सायं सत्संग'),
    };
  }

  String _dateRangeLabel(
    BuildContext context,
    DateTime start,
    DateTime end,
  ) {
    final startLabel = _dateLabel(context, start);
    final endLabel = _dateLabel(context, end);
    return startLabel == endLabel ? startLabel : '$startLabel – $endLabel';
  }

  String _dateLabel(BuildContext context, DateTime date) {
    final hindi = LanguageScope.of(context).language == AppLanguage.hindi;
    final value = DateFormat('d MMM y', hindi ? 'hi' : 'en').format(date);
    return hindi ? _hindiDigits(value) : value;
  }
}

class _StreakActionButton extends StatelessWidget {
  const _StreakActionButton({
    required this.valueKey,
    required this.value,
    required this.label,
    required this.color,
    required this.onTap,
  });

  final Key valueKey;
  final int value;
  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final language = LanguageScope.of(context).language;
    final displayValue =
        language == AppLanguage.hindi ? _hindiDigits('$value') : '$value';
    return Material(
      color: _surfaceColor(AppColors.parchment),
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: SizedBox(
          height: 78,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                displayValue,
                key: valueKey,
                style: GoogleFonts.inter(
                  color: _readableColor(color),
                  fontSize: 25,
                  fontWeight: FontWeight.w900,
                ),
              ),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: _bodyStyle(
                  language,
                  color: AppColors.ink,
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ActivityDetailRow extends StatelessWidget {
  const _ActivityDetailRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Icon(icon, size: 20, color: _readableColor(AppColors.maroon)),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                color: _readableColor(AppColors.ink),
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          Text(
            value,
            style: TextStyle(
              color: _readableColor(AppColors.taupe),
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }
}

class _SatsangScreen extends StatelessWidget {
  const _SatsangScreen({
    required this.tracksStream,
    required this.selectedSession,
    required this.activeTrackId,
    required this.audioPosition,
    required this.audioDuration,
    required this.isPlaying,
    required this.today,
    required this.onSessionChanged,
    required this.onPlay,
    required this.onSeek,
    required this.onMark,
  });

  final Stream<List<SatsangTrack>> tracksStream;
  final SatsangSession selectedSession;
  final String? activeTrackId;
  final Duration audioPosition;
  final Duration audioDuration;
  final bool isPlaying;
  final Map<String, bool> today;
  final ValueChanged<SatsangSession> onSessionChanged;
  final ValueChanged<SatsangTrack> onPlay;
  final ValueChanged<Duration> onSeek;
  final ValueChanged<RoutineTask> onMark;

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<List<SatsangTrack>>(
      stream: tracksStream,
      initialData: fallbackSatsangs,
      builder: (context, snapshot) {
        final tracks = (snapshot.data ?? fallbackSatsangs)
            .where((track) => track.session == selectedSession)
            .toList();
        final visibleTracks = tracks.isEmpty
            ? fallbackSatsangs
                .where((track) => track.session == selectedSession)
                .toList()
            : tracks;

        return _PageScaffold(
          children: [
            _ScreenTitle(
              icon: Icons.headphones_rounded,
              title: appText(context, 'Satsang', 'सत्संग'),
            ),
            _SessionSwitch(
                selected: selectedSession, onChanged: onSessionChanged),
            ...visibleTracks.map((track) {
              final displayTrack = localizedSatsangTrack(context, track);
              final task = _routineTaskForSatsangSession(track.session);
              final done = task != null && today[task.name] == true;
              final active = activeTrackId == track.id;
              final progress = active && audioDuration.inMilliseconds > 0
                  ? audioPosition.inMilliseconds / audioDuration.inMilliseconds
                  : 0.0;

              return _AudioCard(
                track: displayTrack,
                done: done,
                active: active,
                playing: active && isPlaying,
                progress: progress.clamp(0, 1),
                position: active ? _formatDuration(audioPosition) : '00:00',
                duration: active && audioDuration.inSeconds > 0
                    ? _formatDuration(audioDuration)
                    : track.durationLabel,
                onPlay: () => onPlay(track),
                onSeek: active && audioDuration.inMilliseconds > 0
                    ? (value) => onSeek(
                          Duration(
                            milliseconds:
                                (audioDuration.inMilliseconds * value).round(),
                          ),
                        )
                    : null,
                onMark: task == null ? null : () => onMark(task),
              );
            }),
          ],
        );
      },
    );
  }
}

class _SessionSwitch extends StatelessWidget {
  const _SessionSwitch({required this.selected, required this.onChanged});

  final SatsangSession selected;
  final ValueChanged<SatsangSession> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(6),
      decoration: BoxDecoration(
        color: _raisedSurfaceColor(),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: _borderColor(AppColors.borderStrong)),
      ),
      child: Row(
        children: SatsangSession.values.map((session) {
          final active = selected == session;
          return Expanded(
            child: InkWell(
              borderRadius: BorderRadius.circular(7),
              onTap: () => onChanged(session),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 220),
                height: 56,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: active ? _primaryActionColor() : Colors.transparent,
                  borderRadius: BorderRadius.circular(7),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      _satsangSessionIcon(session),
                      size: 22,
                      color: active
                          ? _onPrimaryActionColor()
                          : _readableColor(AppColors.maroon),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      _satsangSessionLabel(context, session),
                      style: TextStyle(
                        color: active
                            ? _onPrimaryActionColor()
                            : _readableColor(AppColors.maroon),
                        fontSize: 17,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _AudioCard extends StatelessWidget {
  const _AudioCard({
    required this.track,
    required this.done,
    required this.active,
    required this.playing,
    required this.progress,
    required this.position,
    required this.duration,
    required this.onPlay,
    this.onSeek,
    this.onMark,
  });

  final SatsangTrack track;
  final bool done;
  final bool active;
  final bool playing;
  final double progress;
  final String position;
  final String duration;
  final VoidCallback onPlay;
  final ValueChanged<double>? onSeek;
  final VoidCallback? onMark;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: _cardDecoration(
        color: active ? const Color(0xFFFFFBF2) : AppColors.surface,
        borderColor: active ? AppColors.softGold : AppColors.border,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 54,
                height: 54,
                decoration: BoxDecoration(
                  color: active
                      ? _primaryActionColor()
                      : _surfaceColor(AppColors.rose),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  _satsangSessionIcon(track.session),
                  color: active
                      ? _onPrimaryActionColor()
                      : _readableColor(AppColors.maroon),
                  size: 29,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _satsangSessionEyebrow(context, track.session),
                      style: TextStyle(
                        color: _readableColor(AppColors.gold),
                        fontSize: 15,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 7),
                    Text(track.title,
                        style: Theme.of(context).textTheme.titleLarge),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          SliderTheme(
            data: SliderTheme.of(context).copyWith(
              trackHeight: 7,
              activeTrackColor: _readableColor(AppColors.gold),
              inactiveTrackColor: _surfaceColor(AppColors.rose),
              thumbColor: _primaryActionColor(),
              overlayColor: _primaryActionColor().withValues(alpha: 0.12),
              thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 9),
              overlayShape: const RoundSliderOverlayShape(overlayRadius: 18),
            ),
            child: Slider(
              value: active ? progress.clamp(0, 1) : 0,
              onChanged: onSeek,
              semanticFormatterCallback: (value) =>
                  '${(value * 100).round()} percent',
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: Text(
                  '$position / $duration',
                  style: TextStyle(
                    color: _readableColor(AppColors.taupe),
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: onPlay,
                  icon: Icon(
                      playing ? Icons.pause_rounded : Icons.play_arrow_rounded),
                  label: Text(playing
                      ? appText(context, 'Pause', 'विराम')
                      : appText(context, 'Play', 'श्रवण')),
                  style: FilledButton.styleFrom(
                    backgroundColor: _primaryActionColor(),
                    foregroundColor: _onPrimaryActionColor(),
                  ),
                ),
              ),
              if (onMark != null) ...[
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: onMark,
                    icon: Icon(done
                        ? Icons.verified_rounded
                        : Icons.check_circle_outline_rounded),
                    label: Text(done
                        ? appText(context, 'Done', 'पूर्ण')
                        : appText(context, 'Mark', 'अंकित')),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: _readableColor(
                        done ? AppColors.sage : AppColors.maroon,
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _MeditationScreen extends StatelessWidget {
  const _MeditationScreen({
    required this.selectedDurationSeconds,
    required this.remainingSeconds,
    required this.meditationRunning,
    required this.meditationComplete,
    required this.meditationChantPhase,
    required this.mantraLoopEnabled,
    required this.presetMinutes,
    required this.presetEditMode,
    required this.todayDone,
    required this.onPresetMinutesChanged,
    required this.onCustomDuration,
    required this.onPresetEditStarted,
    required this.onPresetEditFinished,
    required this.onPresetRemoved,
    required this.onPresetReordered,
    required this.onMantraLoopChanged,
    required this.onToggle,
    required this.onReset,
  });

  final int selectedDurationSeconds;
  final int remainingSeconds;
  final bool meditationRunning;
  final bool meditationComplete;
  final MeditationChantPhase? meditationChantPhase;
  final bool mantraLoopEnabled;
  final List<int> presetMinutes;
  final bool presetEditMode;
  final bool todayDone;
  final ValueChanged<int> onPresetMinutesChanged;
  final VoidCallback onCustomDuration;
  final VoidCallback onPresetEditStarted;
  final VoidCallback onPresetEditFinished;
  final ValueChanged<int> onPresetRemoved;
  final void Function(int draggedMinutes, int targetMinutes) onPresetReordered;
  final ValueChanged<bool> onMantraLoopChanged;
  final VoidCallback onToggle;
  final VoidCallback onReset;

  @override
  Widget build(BuildContext context) {
    final progress = selectedDurationSeconds == 0
        ? 0.0
        : 1 - remainingSeconds / selectedDurationSeconds;
    final chantPlaying = meditationChantPhase != null;
    final locked = meditationRunning || chantPlaying;
    final statusLabel = meditationChantPhase == MeditationChantPhase.closing
        ? appText(context, 'Sacred closing chant', 'पावन समापन मंत्र')
        : meditationRunning
            ? appText(context, 'In meditation', 'ध्यान-साधना')
            : meditationComplete
                ? appText(context, 'Complete', 'पूर्ण')
                : appText(
                    context, 'Ready for stillness', 'अंतर्मौन हेतु तत्पर');
    final actionLabel = meditationChantPhase == MeditationChantPhase.closing
        ? appText(context, 'Chant', 'मंत्र')
        : meditationRunning
            ? appText(context, 'Pause', 'विराम')
            : appText(context, 'Start', 'आरंभ');

    return _PageScaffold(
      children: [
        _ScreenTitle(
          icon: Icons.self_improvement_rounded,
          title: appText(context, 'Meditation', 'ध्यान'),
        ),
        Container(
          padding: const EdgeInsets.all(22),
          clipBehavior: Clip.antiAlias,
          decoration: _cardDecoration(color: AppColors.offWhite),
          child: Column(
            children: [
              SizedBox(
                height: 268,
                width: 268,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    CustomPaint(
                      size: const Size.square(268),
                      painter: _MeditationHaloPainter(
                          active: meditationRunning || chantPlaying),
                    ),
                    SizedBox.expand(
                      child: CircularProgressIndicator(
                        value: progress.clamp(0, 1),
                        strokeWidth: 14,
                        color: _readableColor(AppColors.gold),
                        backgroundColor: _surfaceColor(AppColors.rose),
                        strokeCap: StrokeCap.round,
                      ),
                    ),
                    Container(
                      width: 198,
                      height: 198,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: LinearGradient(
                          colors: _appIsDark
                              ? const [
                                  AppColors.darkSurfaceRaised,
                                  AppColors.darkRose,
                                ]
                              : const [
                                  Color(0xFFFFFFFF),
                                  Color(0xFFF8EAD7),
                                ],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        border: Border.all(
                          color: _borderColor(AppColors.softGold),
                          width: 1.5,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.maroon.withValues(alpha: 0.12),
                            blurRadius: 24,
                            offset: const Offset(0, 14),
                          ),
                        ],
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          SizedBox(
                            width: 158,
                            child: FittedBox(
                              fit: BoxFit.scaleDown,
                              child: Text(
                                _formatSeconds(remainingSeconds),
                                maxLines: 1,
                                style: GoogleFonts.inter(
                                  color: _readableColor(AppColors.maroon),
                                  fontSize: 46,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                            ),
                          ),
                          Text(
                            statusLabel,
                            style: TextStyle(
                              color: _readableColor(AppColors.taupe),
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              if (presetEditMode) ...[
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Expanded(
                      child: Text(
                        appText(
                          context,
                          'Drag to arrange or tap × to delete',
                          'क्रम बदलने के लिए खींचें या हटाने के लिए × दबाएँ',
                        ),
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: _readableColor(AppColors.taupe),
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    TextButton(
                      onPressed: onPresetEditFinished,
                      child: Text(appText(context, 'Done', 'पूर्ण')),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
              ],
              Wrap(
                spacing: 10,
                runSpacing: 10,
                alignment: WrapAlignment.center,
                children: [
                  ...presetMinutes.asMap().entries.map((entry) {
                    final minutes = entry.value;
                    final active = selectedDurationSeconds == minutes * 60;
                    return _MeditationPresetChip(
                      key: ValueKey('meditation-preset-$minutes'),
                      minutes: minutes,
                      orderIndex: entry.key,
                      selected: active,
                      locked: locked,
                      editing: presetEditMode,
                      onSelected: () => onPresetMinutesChanged(minutes),
                      onEditStarted: onPresetEditStarted,
                      onDelete: () => onPresetRemoved(minutes),
                      onReorder: (draggedMinutes) =>
                          onPresetReordered(draggedMinutes, minutes),
                    );
                  }),
                  ActionChip(
                    avatar: Icon(
                      Icons.add_alarm_rounded,
                      size: 18,
                      color: _readableColor(AppColors.maroon),
                    ),
                    label: Text(appText(context, 'Custom', 'स्वनिर्धारित')),
                    onPressed:
                        locked || presetEditMode ? null : onCustomDuration,
                    backgroundColor: _surfaceColor(AppColors.rose),
                    labelStyle: TextStyle(
                      color: _readableColor(AppColors.maroon),
                      fontWeight: FontWeight.w900,
                    ),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8)),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 12),
                  ),
                ],
              ),
              const SizedBox(height: 22),
              _MantraLoopSwitch(
                enabled: mantraLoopEnabled,
                locked: chantPlaying,
                onChanged: onMantraLoopChanged,
              ),
              const SizedBox(height: 18),
              Row(
                children: [
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: chantPlaying ? null : onToggle,
                      icon: Icon(chantPlaying
                          ? Icons.music_note_rounded
                          : meditationRunning
                              ? Icons.pause_rounded
                              : Icons.play_arrow_rounded),
                      label: Text(actionLabel),
                      style: FilledButton.styleFrom(
                        minimumSize: const Size.fromHeight(58),
                        backgroundColor: meditationRunning
                            ? (_appIsDark
                                ? AppColors.darkRoseAccent
                                : AppColors.crimson)
                            : _primaryActionColor(),
                        foregroundColor: _onPrimaryActionColor(),
                        textStyle: const TextStyle(
                            fontSize: 18, fontWeight: FontWeight.w900),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton.tonalIcon(
                      onPressed: onReset,
                      icon: const Icon(Icons.restart_alt_rounded),
                      label: Text(
                        appText(context, 'Reset', 'पुनःस्थापन'),
                      ),
                      style: FilledButton.styleFrom(
                        minimumSize: const Size.fromHeight(58),
                        textStyle: const TextStyle(
                            fontSize: 18, fontWeight: FontWeight.w900),
                      ),
                    ),
                  ),
                ],
              ),
              if (todayDone) ...[
                const SizedBox(height: 18),
                _CompletionBanner(
                  text: appText(
                    context,
                    'Today\'s meditation is complete',
                    'आज की ध्यान-साधना पूर्ण',
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _MeditationPresetChip extends StatefulWidget {
  const _MeditationPresetChip({
    required this.minutes,
    required this.orderIndex,
    required this.selected,
    required this.locked,
    required this.editing,
    required this.onSelected,
    required this.onEditStarted,
    required this.onDelete,
    required this.onReorder,
    super.key,
  });

  final int minutes;
  final int orderIndex;
  final bool selected;
  final bool locked;
  final bool editing;
  final VoidCallback onSelected;
  final VoidCallback onEditStarted;
  final VoidCallback onDelete;
  final ValueChanged<int> onReorder;

  @override
  State<_MeditationPresetChip> createState() => _MeditationPresetChipState();
}

class _MeditationPresetChipState extends State<_MeditationPresetChip>
    with SingleTickerProviderStateMixin {
  late final AnimationController shakeController = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 150),
  );

  @override
  void initState() {
    super.initState();
    if (widget.editing) shakeController.repeat(reverse: true);
  }

  @override
  void didUpdateWidget(covariant _MeditationPresetChip oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.editing == oldWidget.editing) return;
    if (widget.editing) {
      shakeController.repeat(reverse: true);
    } else {
      shakeController
        ..stop()
        ..value = 0.5;
    }
  }

  @override
  void dispose() {
    shakeController.dispose();
    super.dispose();
  }

  Widget _chip(BuildContext context, {required bool interactive}) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        ChoiceChip(
          label: Text(_formatDurationLabel(
            context,
            Duration(minutes: widget.minutes),
          )),
          selected: widget.selected,
          onSelected: !interactive || widget.locked || widget.editing
              ? null
              : (_) => widget.onSelected(),
          selectedColor: _primaryActionColor(),
          backgroundColor: _surfaceColor(AppColors.rose),
          labelStyle: TextStyle(
            color: widget.selected
                ? _onPrimaryActionColor()
                : _readableColor(AppColors.maroon),
            fontWeight: FontWeight.w900,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        ),
        if (widget.editing && interactive)
          Positioned(
            right: -8,
            top: -8,
            child: Semantics(
              button: true,
              label: appText(context, 'Delete timer', 'समय हटाएँ'),
              child: InkWell(
                key: Key('delete-meditation-preset-${widget.minutes}'),
                customBorder: const CircleBorder(),
                onTap: widget.onDelete,
                child: Container(
                  width: 26,
                  height: 26,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: _primaryActionColor(),
                    border: Border.all(color: _onPrimaryActionColor()),
                  ),
                  child: Icon(
                    Icons.close_rounded,
                    size: 17,
                    color: _onPrimaryActionColor(),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final chip = Padding(
      padding: EdgeInsets.only(
        top: widget.editing ? 8 : 0,
        right: widget.editing ? 8 : 0,
      ),
      child: DragTarget<int>(
        onWillAcceptWithDetails: (details) =>
            widget.editing && details.data != widget.minutes,
        onAcceptWithDetails: (details) => widget.onReorder(details.data),
        builder: (context, candidates, rejected) {
          final target = candidates.isNotEmpty;
          return AnimatedScale(
            scale: target ? 1.08 : 1,
            duration: const Duration(milliseconds: 120),
            child: _chip(context, interactive: true),
          );
        },
      ),
    );

    final draggable = widget.locked
        ? chip
        : LongPressDraggable<int>(
            data: widget.minutes,
            onDragStarted: widget.onEditStarted,
            feedback: Material(
              color: Colors.transparent,
              child: _chip(context, interactive: false),
            ),
            childWhenDragging: Opacity(opacity: 0.34, child: chip),
            child: chip,
          );

    return AnimatedBuilder(
      animation: shakeController,
      child: draggable,
      builder: (context, child) {
        if (!widget.editing) return child!;
        final direction = widget.orderIndex.isEven ? 1.0 : -1.0;
        return Transform.rotate(
          angle: (shakeController.value - 0.5) * 0.045 * direction,
          child: child,
        );
      },
    );
  }
}

class _MantraLoopSwitch extends StatelessWidget {
  const _MantraLoopSwitch({
    required this.enabled,
    required this.locked,
    required this.onChanged,
  });

  final bool enabled;
  final bool locked;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      decoration: _cardDecoration(
        color: const Color(0xFFFFF8EF),
        borderColor: enabled ? AppColors.softGold : AppColors.border,
      ).copyWith(
        boxShadow: [
          BoxShadow(
            color: AppColors.gold.withValues(alpha: enabled ? 0.16 : 0.08),
            blurRadius: 18,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: enabled
                  ? _readableColor(AppColors.gold)!.withValues(alpha: 0.16)
                  : _surfaceColor(AppColors.rose),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(
                color: _borderColor(
                  enabled ? AppColors.softGold : AppColors.border,
                ),
              ),
            ),
            child: Icon(
              enabled ? Icons.spatial_audio_rounded : Icons.music_note_rounded,
              color: _readableColor(
                enabled ? AppColors.gold : AppColors.maroon,
              ),
              size: 27,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Text(
              appText(context, 'Om mantra', 'ॐ मंत्र'),
              style: Theme.of(context)
                  .textTheme
                  .titleLarge
                  ?.copyWith(fontSize: 19),
            ),
          ),
          const SizedBox(width: 10),
          Switch.adaptive(
            value: enabled,
            onChanged: locked ? null : onChanged,
            activeThumbColor: _primaryActionColor(),
            activeTrackColor:
                _appIsDark ? AppColors.darkRose : AppColors.softGold,
          ),
        ],
      ),
    );
  }
}

class _CustomDurationSheet extends StatefulWidget {
  const _CustomDurationSheet({required this.initialDuration});

  final Duration initialDuration;

  @override
  State<_CustomDurationSheet> createState() => _CustomDurationSheetState();
}

class _CustomDurationSheetState extends State<_CustomDurationSheet> {
  late Duration duration = _minimumMeditationDuration(widget.initialDuration);

  @override
  Widget build(BuildContext context) {
    final bottomPadding = MediaQuery.paddingOf(context).bottom;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final accent = isDark ? AppColors.darkGold : AppColors.maroon;
    final onAccent = isDark ? AppColors.darkCanvas : AppColors.cream;

    return Material(
      color: Colors.transparent,
      child: Align(
        alignment: Alignment.bottomCenter,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 560),
          child: Container(
            width: double.infinity,
            padding: EdgeInsets.fromLTRB(22, 18, 22, 18 + bottomPadding),
            decoration: BoxDecoration(
              color: isDark ? AppColors.darkSurfaceRaised : AppColors.offWhite,
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(8)),
              border: Border.all(
                color: isDark ? AppColors.darkBorder : AppColors.borderStrong,
              ),
              boxShadow: [
                BoxShadow(
                  color: AppColors.deepCrimson.withValues(alpha: 0.16),
                  blurRadius: 30,
                  offset: const Offset(0, -12),
                ),
              ],
            ),
            child: SafeArea(
              top: false,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      _IconBadge(
                        icon: Icons.schedule_rounded,
                        background:
                            isDark ? AppColors.darkRose : AppColors.rose,
                        color: accent,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          appText(
                            context,
                            'Choose meditation duration',
                            'ध्यान-अवधि निर्धारित करें',
                          ),
                          style: _headingStyle(
                            LanguageScope.of(context).language,
                            color: AppColors.ink,
                            fontSize: 24,
                            fontWeight: FontWeight.w900,
                            height: 1.08,
                          ),
                        ),
                      ),
                      IconButton(
                        onPressed: () => Navigator.of(context).pop(),
                        icon: const Icon(Icons.close_rounded),
                        tooltip: appText(context, 'Close', 'संवाद समाप्त करें'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 12),
                    decoration: BoxDecoration(
                      color: isDark
                          ? AppColors.darkRose
                          : AppColors.rose.withValues(alpha: 0.56),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: isDark ? AppColors.darkBorder : AppColors.border,
                      ),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.self_improvement_rounded, color: accent),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            _formatDurationLabel(context, duration),
                            style: _bodyStyle(
                              LanguageScope.of(context).language,
                              color: accent,
                              fontSize: 20,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    height: 216,
                    child: CupertinoTheme(
                      data: CupertinoThemeData(
                        brightness: isDark ? Brightness.dark : Brightness.light,
                        primaryColor: accent,
                        textTheme: CupertinoTextThemeData(
                          pickerTextStyle: _bodyStyle(
                            LanguageScope.of(context).language,
                            color: isDark ? AppColors.darkInk : AppColors.ink,
                            fontSize: 24,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      child: CupertinoTimerPicker(
                        mode: CupertinoTimerPickerMode.hm,
                        minuteInterval: 1,
                        initialTimerDuration: duration,
                        onTimerDurationChanged: (value) {
                          setState(() =>
                              duration = _minimumMeditationDuration(value));
                        },
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => Navigator.of(context).pop(),
                          child:
                              Text(appText(context, 'Cancel', 'निरस्त करें')),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: () => Navigator.of(context).pop(duration),
                          icon: const Icon(Icons.check_rounded),
                          label: Text(appText(context, 'Set', 'निर्धारित')),
                          style: FilledButton.styleFrom(
                            backgroundColor: accent,
                            foregroundColor: onAccent,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _MeditationHaloPainter extends CustomPainter {
  const _MeditationHaloPainter({required this.active});

  final bool active;

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final glow = Paint()
      ..color = (active ? AppColors.gold : AppColors.maroon)
          .withValues(alpha: active ? 0.12 : 0.06)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;

    for (var i = 0; i < 4; i++) {
      final inset = 14.0 + i * 18;
      canvas.drawOval(
          Rect.fromLTWH(
              inset, inset, size.width - inset * 2, size.height - inset * 2),
          glow);
    }

    final petalPaint = Paint()
      ..color = AppColors.maroon.withValues(alpha: 0.08);
    for (var i = 0; i < 8; i++) {
      final angle = (pi / 4) * i;
      final petalCenter = Offset(
        center.dx + cos(angle) * size.width * 0.35,
        center.dy + sin(angle) * size.height * 0.35,
      );
      canvas.save();
      canvas.translate(petalCenter.dx, petalCenter.dy);
      canvas.rotate(angle);
      canvas.drawOval(
          Rect.fromCenter(center: Offset.zero, width: 17, height: 42),
          petalPaint);
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(covariant _MeditationHaloPainter oldDelegate) {
    return oldDelegate.active != active;
  }
}

class _WisdomScreen extends StatelessWidget {
  const _WisdomScreen({
    required this.quotesStream,
    required this.initialQuotes,
    required this.onRefresh,
    required this.onQuoteViewed,
    required this.onQuoteShared,
    required this.likedQuoteIds,
    required this.onQuoteLiked,
    this.selectedQuoteId,
  });

  final Stream<List<WisdomQuote>> quotesStream;
  final List<WisdomQuote>? initialQuotes;
  final Future<void> Function() onRefresh;
  final ValueChanged<WisdomQuote> onQuoteViewed;
  final ValueChanged<WisdomQuote> onQuoteShared;
  final Set<String> likedQuoteIds;
  final ValueChanged<WisdomQuote> onQuoteLiked;
  final String? selectedQuoteId;

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<List<WisdomQuote>>(
      stream: quotesStream,
      initialData: initialQuotes,
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return _PageScaffold(
            onRefresh: onRefresh,
            children: [
              _ScreenTitle(
                icon: Icons.format_quote_rounded,
                title: appText(context, 'Guru Vani', 'गुरु वाणी'),
              ),
              if (snapshot.hasError)
                _WisdomLoadErrorCard(onRetry: onRefresh)
              else
                const _WisdomLoadingCard(),
            ],
          );
        }

        final quotes = snapshot.data!;
        final timeline = quoteTimelineForDate(quotes);
        final dailyQuote = timeline.daily;
        final selectedQuote = selectedQuoteId == null
            ? null
            : quotesWithSchedule(quotes)
                .where((quote) => quote.id == selectedQuoteId)
                .firstOrNull;
        final showOpenedQuote = selectedQuote != null &&
            (dailyQuote == null || selectedQuote.id != dailyQuote.id);
        final viewedQuote = selectedQuote ?? dailyQuote;
        if (viewedQuote != null) {
          WidgetsBinding.instance.addPostFrameCallback(
            (_) => onQuoteViewed(viewedQuote),
          );
        }

        return _PageScaffold(
          onRefresh: onRefresh,
          children: [
            _ScreenTitle(
              icon: Icons.format_quote_rounded,
              title: appText(context, 'Guru Vani', 'गुरु वाणी'),
            ),
            if (showOpenedQuote) ...[
              _SectionHeader(
                title: appText(context, 'Opened Quote', 'खोला गया वचन'),
              ),
              _WisdomQuoteCard(
                quote: localizedWisdomQuote(context, selectedQuote),
                highlighted: true,
                date: quoteScheduledDay(selectedQuote),
                onShared: onQuoteShared,
                liked: likedQuoteIds.contains(selectedQuote.id),
                onLiked: onQuoteLiked,
              ),
            ],
            _SectionHeader(
              title: appText(context, 'Quote of the Day', 'आज का वचन'),
              action: _WisdomRefreshButton(onRefresh: onRefresh),
            ),
            if (dailyQuote != null)
              _WisdomFeature(
                quote: localizedWisdomQuote(context, dailyQuote),
                onShared: onQuoteShared,
                liked: likedQuoteIds.contains(dailyQuote.id),
                onLiked: onQuoteLiked,
              )
            else
              _EmptyDailyQuote(),
            _QuoteArchiveSection(
              quotes: timeline.archive,
              selectedQuoteId: selectedQuoteId,
              onQuoteShared: onQuoteShared,
              likedQuoteIds: likedQuoteIds,
              onQuoteLiked: onQuoteLiked,
            ),
          ],
        );
      },
    );
  }
}

class _WisdomRefreshButton extends StatefulWidget {
  const _WisdomRefreshButton({required this.onRefresh});

  final Future<void> Function() onRefresh;

  @override
  State<_WisdomRefreshButton> createState() => _WisdomRefreshButtonState();
}

class _WisdomRefreshButtonState extends State<_WisdomRefreshButton> {
  bool refreshing = false;

  Future<void> _refresh() async {
    if (refreshing) return;
    setState(() => refreshing = true);
    try {
      await widget.onRefresh();
    } finally {
      if (mounted) setState(() => refreshing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return IconButton.filledTonal(
      key: const Key('refresh-wisdom-quotes'),
      onPressed: refreshing ? null : _refresh,
      tooltip: appText(context, 'Refresh quotes', 'वचन पुनः लोड करें'),
      icon: refreshing
          ? const SizedBox.square(
              dimension: 20,
              child: CircularProgressIndicator(strokeWidth: 2.4),
            )
          : const Icon(Icons.refresh_rounded),
    );
  }
}

class _EmptyDailyQuote extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: _cardDecoration(color: AppColors.offWhite),
      child: Row(
        children: [
          Icon(
            Icons.event_busy_rounded,
            color: _readableColor(AppColors.gold),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              appText(
                context,
                'No quote scheduled today',
                'आज कोई वचन निर्धारित नहीं है',
              ),
              style: Theme.of(context).textTheme.titleLarge,
            ),
          ),
        ],
      ),
    );
  }
}

class _QuoteArchiveSection extends StatelessWidget {
  const _QuoteArchiveSection({
    required this.quotes,
    required this.onQuoteShared,
    required this.likedQuoteIds,
    required this.onQuoteLiked,
    this.selectedQuoteId,
  });

  final List<WisdomQuote> quotes;
  final ValueChanged<WisdomQuote> onQuoteShared;
  final Set<String> likedQuoteIds;
  final ValueChanged<WisdomQuote> onQuoteLiked;
  final String? selectedQuoteId;

  @override
  Widget build(BuildContext context) {
    final selectedIsArchived =
        quotes.any((quote) => quote.id == selectedQuoteId);

    return Theme(
      data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
      child: ExpansionTile(
        key: ValueKey('quote-archive-$selectedQuoteId'),
        initiallyExpanded: selectedIsArchived,
        tilePadding: EdgeInsets.zero,
        childrenPadding: EdgeInsets.zero,
        leading: const _IconBadge(
          icon: Icons.history_rounded,
          background: AppColors.rose,
          color: AppColors.maroon,
        ),
        title: Text(
          appText(context, 'Archive', 'पुराने वचन'),
          style: Theme.of(context).textTheme.titleLarge,
        ),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
              decoration: BoxDecoration(
                color: _surfaceColor(AppColors.rose),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                '${quotes.length}',
                style: TextStyle(
                  color: _readableColor(AppColors.maroon),
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
            const SizedBox(width: 4),
            const Icon(Icons.expand_more_rounded),
          ],
        ),
        children: [
          for (final quote in quotes) ...[
            _WisdomQuoteCard(
              quote: localizedWisdomQuote(context, quote),
              highlighted: quote.id == selectedQuoteId,
              date: quoteScheduledDay(quote),
              onShared: onQuoteShared,
              liked: likedQuoteIds.contains(quote.id),
              onLiked: onQuoteLiked,
            ),
            if (quote != quotes.last) const SizedBox(height: 12),
          ],
        ],
      ),
    );
  }
}

class _WisdomLoadingCard extends StatelessWidget {
  const _WisdomLoadingCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: _cardDecoration(color: AppColors.offWhite),
      child: Row(
        children: [
          const SizedBox(
            width: 26,
            height: 26,
            child: CircularProgressIndicator(strokeWidth: 3),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Text(
              appText(
                context,
                'Loading Guru Vani...',
                'गुरु वाणी लोड हो रही है...',
              ),
              style: Theme.of(context).textTheme.bodyLarge,
            ),
          ),
        ],
      ),
    );
  }
}

class _WisdomLoadErrorCard extends StatelessWidget {
  const _WisdomLoadErrorCard({required this.onRetry});

  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: _cardDecoration(color: AppColors.offWhite),
      child: Column(
        children: [
          Icon(
            Icons.cloud_off_rounded,
            color: _readableColor(AppColors.maroon),
            size: 34,
          ),
          const SizedBox(height: 12),
          Text(
            appText(
              context,
              'Quotes could not be loaded. Pull down or try again.',
              'वचन लोड नहीं हो सके। नीचे खींचें या पुनः प्रयास करें।',
            ),
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyLarge,
          ),
          const SizedBox(height: 14),
          FilledButton.icon(
            onPressed: () => unawaited(onRetry()),
            icon: const Icon(Icons.refresh_rounded),
            label: Text(appText(context, 'Try again', 'पुनः प्रयास')),
          ),
        ],
      ),
    );
  }
}

class _WisdomQuoteCard extends StatelessWidget {
  const _WisdomQuoteCard({
    required this.quote,
    this.highlighted = false,
    this.date,
    this.onShared,
    this.liked = false,
    this.onLiked,
  });

  final WisdomQuote quote;
  final bool highlighted;
  final DateTime? date;
  final ValueChanged<WisdomQuote>? onShared;
  final bool liked;
  final ValueChanged<WisdomQuote>? onLiked;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: _cardDecoration(
        color: const Color(0xFFFFFCF8),
        borderColor: highlighted ? AppColors.gold : AppColors.border,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: _surfaceColor(AppColors.rose),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(
              Icons.spa_rounded,
              color: _readableColor(AppColors.maroon),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  quote.text,
                  style: _headingStyle(
                    LanguageScope.of(context).language,
                    fontSize: 20,
                    color: AppColors.ink,
                    height: 1.45,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  quote.author,
                  style: TextStyle(
                    color: _readableColor(AppColors.maroon),
                    fontWeight: FontWeight.w900,
                  ),
                ),
                if (date != null) ...[
                  const SizedBox(height: 7),
                  Text(
                    DateFormat('d MMMM y').format(date!),
                    style: _bodyStyle(
                      LanguageScope.of(context).language,
                      color: AppColors.taupe,
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            children: [
              _WisdomLikeButton(
                quote: quote,
                liked: liked,
                onLiked: onLiked,
              ),
              const SizedBox(height: 8),
              _WisdomShareButton(quote: quote, onShared: onShared),
            ],
          ),
        ],
      ),
    );
  }
}

class _WisdomShareButton extends StatelessWidget {
  const _WisdomShareButton({
    required this.quote,
    this.prominent = false,
    this.onShared,
  });

  final WisdomQuote quote;
  final bool prominent;
  final ValueChanged<WisdomQuote>? onShared;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      onPressed: () async {
        final shared = await shareWisdomQuote(context, quote);
        if (shared) onShared?.call(quote);
      },
      icon: const Icon(Icons.ios_share_rounded),
      tooltip: appText(context, 'Share quote', 'वचन साझा करें'),
      style: IconButton.styleFrom(
        fixedSize: const Size(42, 42),
        minimumSize: const Size(42, 42),
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        backgroundColor: prominent && !_appIsDark
            ? Colors.white.withValues(alpha: 0.82)
            : _surfaceColor(AppColors.rose),
        foregroundColor: _readableColor(AppColors.maroon),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
    );
  }
}

class _WisdomLikeButton extends StatelessWidget {
  const _WisdomLikeButton({
    required this.quote,
    required this.liked,
    this.onLiked,
    this.prominent = false,
  });

  final WisdomQuote quote;
  final bool liked;
  final ValueChanged<WisdomQuote>? onLiked;
  final bool prominent;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      onPressed: onLiked == null ? null : () => onLiked!(quote),
      icon: Icon(
        liked ? Icons.favorite_rounded : Icons.favorite_border_rounded,
      ),
      tooltip: liked
          ? appText(context, 'Remove from liked quotes', 'पसंद से हटाएँ')
          : appText(context, 'Like quote', 'वचन पसंद करें'),
      style: IconButton.styleFrom(
        fixedSize: const Size(42, 42),
        minimumSize: const Size(42, 42),
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        backgroundColor: prominent && !_appIsDark
            ? Colors.white.withValues(alpha: 0.82)
            : _surfaceColor(AppColors.rose),
        foregroundColor: _readableColor(
          liked ? AppColors.crimson : AppColors.maroon,
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
    );
  }
}

class _MoreScreen extends StatelessWidget {
  const _MoreScreen({
    required this.user,
    required this.profile,
    required this.onProfileChanged,
    required this.onSignOut,
    required this.onDeleteAccount,
    required this.accountDeletionInProgress,
  });

  final User? user;
  final DevoteeProfile profile;
  final Future<void> Function(DevoteeProfile profile) onProfileChanged;
  final Future<void> Function() onSignOut;
  final Future<void> Function() onDeleteAccount;
  final bool accountDeletionInProgress;

  Future<void> _editName(BuildContext context) async {
    final updated = await showDialog<DevoteeProfile>(
      context: context,
      barrierDismissible: false,
      builder: (_) => _EditNameDialog(profile: profile),
    );
    if (updated != null) await onProfileChanged(updated);
  }

  Future<void> _confirmSignOut(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        icon: Icon(
          Icons.logout_rounded,
          color: _readableColor(AppColors.maroon),
          size: 34,
        ),
        title: Text(
          appText(context, 'Leave this account?', 'सदस्यता से प्रस्थान करें?'),
          textAlign: TextAlign.center,
        ),
        content: Text(
          appText(
            context,
            'You will return to the Guru Vandan entrance.',
            'आप गुरु वंदन के प्रवेश-पृष्ठ पर लौटेंगे।',
          ),
          textAlign: TextAlign.center,
        ),
        actionsAlignment: MainAxisAlignment.center,
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: Text(appText(context, 'Stay', 'रहें')),
          ),
          FilledButton.icon(
            onPressed: () => Navigator.pop(dialogContext, true),
            icon: const Icon(Icons.logout_rounded),
            label: Text(appText(context, 'Logout', 'प्रस्थान')),
          ),
        ],
      ),
    );

    if (confirmed == true) await onSignOut();
  }

  Future<void> _confirmDeleteAccount(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => AlertDialog(
        icon: const Icon(
          Icons.delete_forever_rounded,
          color: Color(0xFFB3261E),
          size: 36,
        ),
        title: Text(
          appText(
            context,
            'Permanently delete account?',
            'सदस्यता स्थायी रूप से मिटाएँ?',
          ),
          textAlign: TextAlign.center,
        ),
        content: Text(
          appText(
            context,
            'This permanently deletes your Guru Vandan account, profile, routine history, and app sign-in access from this device and Firebase. Linked Apple or Google authorization will be revoked where available. This cannot be undone.',
            'यह आपकी गुरु वंदन सदस्यता, परिचय, साधना-इतिहास और ऐप प्रवेश को इस उपकरण तथा Firebase से स्थायी रूप से मिटा देगा। उपलब्ध होने पर संबद्ध Apple अथवा Google अनुमति भी निरस्त की जाएगी। इसे वापस नहीं किया जा सकता।',
          ),
          textAlign: TextAlign.center,
        ),
        actionsAlignment: MainAxisAlignment.center,
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: Text(appText(context, 'Cancel', 'निरस्त करें')),
          ),
          FilledButton.icon(
            key: const Key('confirm-delete-account'),
            onPressed: () => Navigator.pop(dialogContext, true),
            icon: const Icon(Icons.delete_forever_rounded),
            label: Text(appText(
              context,
              'Delete permanently',
              'स्थायी रूप से मिटाएँ',
            )),
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFFB3261E),
              foregroundColor: Colors.white,
            ),
          ),
        ],
      ),
    );

    if (confirmed != true || !context.mounted) return;

    try {
      await onDeleteAccount();
    } on _AuthFlowCanceled {
      return;
    } on _AuthIntegrityException catch (error) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(error.message)));
    } on FirebaseAuthException catch (error) {
      if (!context.mounted) return;
      final message = error.code == 'requires-recent-login'
          ? appText(
              context,
              'For security, sign out, sign in again, and retry account deletion.',
              'सुरक्षा हेतु प्रस्थान करके पुनः प्रवेश करें और सदस्यता मिटाने का प्रयास दोहराएँ।',
            )
          : appText(
              context,
              'Account deletion could not be completed. Sign in again and retry. If the problem continues, contact support so we can verify and complete deletion.',
              'सदस्यता-विलोपन पूर्ण नहीं हो सका। पुनः प्रवेश करके प्रयास दोहराएँ। समस्या बनी रहे तो विलोपन की पुष्टि और पूर्णता हेतु सहायता से संपर्क करें।',
            );
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(message)));
    } catch (_) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(appText(
          context,
          'Account deletion could not be completed. Check your connection and try again.',
          'सदस्यता-विलोपन पूर्ण नहीं हो सका। संपर्क जाँचकर पुनः प्रयास करें।',
        )),
      ));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Positioned.fill(
          child: _PageScaffold(
            children: [
              _ScreenTitle(
                icon: Icons.tune_rounded,
                title: appText(context, 'Other', 'अन्य'),
              ),
              Container(
                padding: const EdgeInsets.all(22),
                decoration: _cardDecoration(),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    SizedBox(
                      width: 126,
                      height: 126,
                      child: const _AppIconMark(),
                    ),
                    const SizedBox(height: 22),
                    Text(
                      'Guru Vandan',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                  ],
                ),
              ),
              const _LanguageSettingsCard(),
              const _AppearanceSettingsCard(),
              const _ComingSoonModules(),
              Container(
                padding: const EdgeInsets.all(18),
                decoration: _cardDecoration(color: AppColors.offWhite),
                child: Row(
                  children: [
                    const _IconBadge(
                      icon: Icons.person_rounded,
                      background: AppColors.rose,
                      color: AppColors.maroon,
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            profile.fullName,
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                          if (user != null)
                            Text(
                              _userLabel(context, user!),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context)
                                  .textTheme
                                  .bodyLarge
                                  ?.copyWith(fontSize: 14),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              OutlinedButton.icon(
                onPressed: () => _editName(context),
                icon: const Icon(Icons.manage_accounts_rounded),
                label: Text(appText(context, 'Name', 'नाम')),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(58),
                  foregroundColor: _readableColor(AppColors.maroon),
                  backgroundColor: _raisedSurfaceColor(),
                ),
              ),
              FilledButton.icon(
                onPressed: accountDeletionInProgress
                    ? null
                    : () => _confirmSignOut(context),
                icon: const Icon(Icons.logout_rounded),
                label: Text(appText(context, 'Logout', 'प्रस्थान')),
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(58),
                  backgroundColor: _primaryActionColor(),
                  foregroundColor: _onPrimaryActionColor(),
                ),
              ),
              if (user != null) ...[
                const SizedBox(height: 4),
                OutlinedButton.icon(
                  key: const Key('delete-account'),
                  onPressed: accountDeletionInProgress
                      ? null
                      : () => _confirmDeleteAccount(context),
                  icon: accountDeletionInProgress
                      ? const SizedBox.square(
                          dimension: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.delete_forever_rounded),
                  label: Text(accountDeletionInProgress
                      ? appText(
                          context,
                          'Deleting account...',
                          'सदस्यता मिटाई जा रही है...',
                        )
                      : appText(
                          context,
                          'Delete account permanently',
                          'सदस्यता स्थायी रूप से मिटाएँ',
                        )),
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size.fromHeight(58),
                    foregroundColor: const Color(0xFFB3261E),
                    backgroundColor: _raisedSurfaceColor(),
                    side: const BorderSide(color: Color(0xFFB3261E)),
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _EditNameDialog extends StatefulWidget {
  const _EditNameDialog({required this.profile});

  final DevoteeProfile profile;

  @override
  State<_EditNameDialog> createState() => _EditNameDialogState();
}

class _EditNameDialogState extends State<_EditNameDialog> {
  late final TextEditingController firstName;
  late final TextEditingController middleName;
  late final TextEditingController lastName;
  String? error;

  @override
  void initState() {
    super.initState();
    firstName = TextEditingController(text: widget.profile.firstName);
    middleName = TextEditingController(text: widget.profile.middleName);
    lastName = TextEditingController(text: widget.profile.lastName);
  }

  @override
  void dispose() {
    firstName.dispose();
    middleName.dispose();
    lastName.dispose();
    super.dispose();
  }

  void _save() {
    final profile = DevoteeProfile.fromParts(
      firstName: firstName.text,
      middleName: middleName.text,
      lastName: lastName.text,
    );
    if (profile == null) {
      setState(() => error = appText(
            context,
            'Please enter your first name.',
            'कृपया अपना प्रथम नाम अंकित करें।',
          ));
      return;
    }
    Navigator.pop(context, profile);
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      icon: Icon(
        Icons.manage_accounts_rounded,
        color: _readableColor(AppColors.maroon),
        size: 34,
      ),
      title: Text(
        appText(context, 'Change your name', 'अपना नाम बदलें'),
        textAlign: TextAlign.center,
      ),
      content: SizedBox(
        width: 460,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                key: const Key('edit-first-name'),
                controller: firstName,
                autofocus: true,
                textCapitalization: TextCapitalization.words,
                textInputAction: TextInputAction.next,
                decoration: _inputDecoration(
                  appText(context, 'First name', 'प्रथम नाम'),
                ).copyWith(errorText: error),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: middleName,
                textCapitalization: TextCapitalization.words,
                textInputAction: TextInputAction.next,
                decoration: _inputDecoration(
                  appText(context, 'Middle name', 'मध्य नाम'),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: lastName,
                textCapitalization: TextCapitalization.words,
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _save(),
                decoration: _inputDecoration(
                  appText(context, 'Last name', 'कुलनाम'),
                ),
              ),
            ],
          ),
        ),
      ),
      actionsAlignment: MainAxisAlignment.center,
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text(appText(context, 'Cancel', 'निरस्त')),
        ),
        FilledButton.icon(
          onPressed: _save,
          icon: const Icon(Icons.check_rounded),
          label: Text(appText(context, 'Save', 'सहेजें')),
        ),
      ],
    );
  }
}

class _LanguageSettingsCard extends StatelessWidget {
  const _LanguageSettingsCard();

  @override
  Widget build(BuildContext context) {
    final scope = LanguageScope.of(context);

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: _cardDecoration(color: AppColors.offWhite),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _IconBadge(
                icon: Icons.translate_rounded,
                background: AppColors.rose,
                color: AppColors.maroon,
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Text(
                  appText(context, 'Language', 'भाषा'),
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: SegmentedButton<AppLanguage>(
              segments: [
                ButtonSegment(
                  value: AppLanguage.english,
                  icon: const Icon(Icons.language_rounded),
                  label: Text(appText(context, 'English', 'अंग्रेज़ी')),
                ),
                ButtonSegment(
                  value: AppLanguage.hindi,
                  icon: const Icon(Icons.translate_rounded),
                  label: Text(appText(context, 'Hindi', 'हिन्दी')),
                ),
              ],
              selected: {scope.language},
              onSelectionChanged: (value) => scope.onChanged(value.first),
              style: ButtonStyle(
                visualDensity: VisualDensity.comfortable,
                textStyle: WidgetStatePropertyAll(
                  _bodyStyle(
                    scope.language,
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AppearanceSettingsCard extends StatelessWidget {
  const _AppearanceSettingsCard();

  @override
  Widget build(BuildContext context) {
    final appearance = AppearanceScope.of(context);
    final darkMode = appearance.isDark;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: _cardDecoration(color: AppColors.offWhite),
      child: Row(
        children: [
          _IconBadge(
            icon: darkMode ? Icons.dark_mode_rounded : Icons.light_mode_rounded,
            background: AppColors.rose,
            color: AppColors.maroon,
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Text(
              appText(context, 'Appearance', 'रूप-रंग'),
              style: Theme.of(context).textTheme.titleLarge,
            ),
          ),
          const SizedBox(width: 12),
          Switch.adaptive(
            value: darkMode,
            onChanged: (value) {
              appearance.onChanged(value ? ThemeMode.dark : ThemeMode.light);
            },
            activeThumbColor: _primaryActionColor(),
            activeTrackColor:
                _appIsDark ? AppColors.darkRose : AppColors.maroon,
          ),
        ],
      ),
    );
  }
}

class _ComingSoonModules extends StatelessWidget {
  const _ComingSoonModules();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _SectionHeader(
            title: appText(context, 'Sacred offerings', 'आगामी अनुभाग')),
        LayoutBuilder(
          builder: (context, constraints) {
            final twoColumns = constraints.maxWidth >= 560;
            final spacing = twoColumns ? 12.0 : 10.0;
            final cardWidth = twoColumns
                ? (constraints.maxWidth - spacing) / 2
                : constraints.maxWidth;

            return Wrap(
              spacing: spacing,
              runSpacing: spacing,
              children: [
                _ComingSoonModuleCard(
                  icon: Icons.shopping_bag_outlined,
                  title: appText(context, 'Devotional Store', 'सत्संग सामग्री'),
                  accentColor: AppColors.gold,
                ),
                _ComingSoonModuleCard(
                  icon: Icons.event_available_rounded,
                  title: appText(
                      context, 'Spiritual Gatherings', 'आध्यात्मिक आयोजन'),
                  accentColor: AppColors.sage,
                ),
                _ComingSoonModuleCard(
                  icon: Icons.photo_library_rounded,
                  title: appText(context, 'Guru Gallery', 'गुरु चित्रदीर्घा'),
                  accentColor: AppColors.river,
                ),
                _ComingSoonModuleCard(
                  icon: Icons.question_answer_rounded,
                  title: appText(context, 'Questions & Guidance', 'जिज्ञासा'),
                  accentColor: AppColors.maroon,
                ),
              ].map((card) => SizedBox(width: cardWidth, child: card)).toList(),
            );
          },
        ),
      ],
    );
  }
}

class _ComingSoonModuleCard extends StatelessWidget {
  const _ComingSoonModuleCard({
    required this.icon,
    required this.title,
    required this.accentColor,
  });

  final IconData icon;
  final String title;
  final Color accentColor;

  @override
  Widget build(BuildContext context) {
    final displayAccent = _readableColor(accentColor)!;
    return Container(
      constraints: const BoxConstraints(minHeight: 132),
      padding: const EdgeInsets.all(18),
      decoration: _cardDecoration(
        color: AppColors.offWhite,
        borderColor: AppColors.border,
      ).copyWith(
        boxShadow: [
          BoxShadow(
            color: displayAccent.withValues(alpha: 0.09),
            blurRadius: 18,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: displayAccent.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                  border:
                      Border.all(color: displayAccent.withValues(alpha: 0.22)),
                ),
                child: Icon(icon, color: displayAccent, size: 26),
              ),
              const Spacer(),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: _surfaceColor(AppColors.rose),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: _borderColor(AppColors.border)),
                ),
                child: Text(
                  appText(context, 'Coming soon', 'शीघ्र उपलब्ध'),
                  style: TextStyle(
                    color: _readableColor(AppColors.maroon),
                    fontSize: 12,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 15),
          Text(
            title,
            style:
                Theme.of(context).textTheme.titleLarge?.copyWith(fontSize: 19),
          ),
        ],
      ),
    );
  }
}

class _AdminRoute extends StatelessWidget {
  const _AdminRoute({required this.firebaseReady});

  final bool firebaseReady;

  @override
  Widget build(BuildContext context) {
    return AdminConsole(
      content: FirebaseContentService(firebaseReady),
      firebaseReady: firebaseReady,
    );
  }
}

class AdminConsole extends StatefulWidget {
  const AdminConsole(
      {required this.content, required this.firebaseReady, super.key});

  final FirebaseContentService content;
  final bool firebaseReady;

  @override
  State<AdminConsole> createState() => _AdminConsoleState();
}

class _AdminConsoleState extends State<AdminConsole> {
  final email = TextEditingController(text: allowedAdminEmail);
  final password = TextEditingController();
  final quoteEnglish = TextEditingController();
  final quoteHindi = TextEditingController();
  final authorEnglish = TextEditingController(text: 'Maharshi Mehi Paramhans');
  final authorHindi = TextEditingController(text: 'महर्षि मेँहीँ परमहंस');
  final userSearch = TextEditingController();

  bool busy = false;
  String status = '';
  String userSearchQuery = '';

  @override
  void dispose() {
    unawaited(widget.content.dispose());
    email.dispose();
    password.dispose();
    quoteEnglish.dispose();
    quoteHindi.dispose();
    authorEnglish.dispose();
    authorHindi.dispose();
    userSearch.dispose();
    super.dispose();
  }

  Future<void> _signIn() async {
    if (!widget.firebaseReady) {
      setState(() => status = appText(
            context,
            'Firebase is not configured yet.',
            'Firebase का विन्यास अभी पूर्ण नहीं है।',
          ));
      return;
    }

    setState(() => busy = true);
    try {
      await FirebaseAuth.instance.signInWithEmailAndPassword(
        email: email.text.trim(),
        password: password.text,
      );
      setState(() => status = appText(
            context,
            'Signed in.',
            'प्रवेश पूर्ण।',
          ));
    } on FirebaseAuthException catch (error) {
      setState(() => status = appText(
            context,
            error.message ?? 'Admin sign-in failed.',
            'प्रशासक प्रवेश विफल रहा।',
          ));
    } finally {
      setState(() => busy = false);
    }
  }

  Future<void> _publishQuote() async {
    if (quoteEnglish.text.trim().isEmpty || quoteHindi.text.trim().isEmpty) {
      setState(() => status = appText(
            context,
            'Enter the sacred quote in both English and Hindi.',
            'पावन वचन का अंग्रेज़ी और हिन्दी रूप अंकित करें।',
          ));
      return;
    }

    setState(() => busy = true);
    try {
      final scheduledDate = await widget.content.publishQuote(
        textEnglish: quoteEnglish.text.trim(),
        textHindi: quoteHindi.text.trim(),
        authorEnglish: authorEnglish.text.trim().isEmpty
            ? 'Maharshi Mehi Paramhans'
            : authorEnglish.text.trim(),
        authorHindi: authorHindi.text.trim().isEmpty
            ? 'महर्षि मेँहीँ परमहंस'
            : authorHindi.text.trim(),
      );
      quoteEnglish.clear();
      quoteHindi.clear();
      setState(() => status = appText(
            context,
            'Quote scheduled for $scheduledDate.',
            'वचन $scheduledDate के लिए निर्धारित।',
          ));
    } catch (error) {
      setState(() => status = appText(
            context,
            'The quote could not be published. Please try again.',
            'वचन प्रकाशित नहीं हो सका। कृपया पुनः प्रयास करें।',
          ));
    } finally {
      setState(() => busy = false);
    }
  }

  Future<void> _editQuote(WisdomQuote item) async {
    final englishText = TextEditingController(text: item.text);
    final hindiText = TextEditingController(text: item.textHindi);
    final englishAuthor = TextEditingController(text: item.author);
    final hindiAuthor = TextEditingController(text: item.authorHindi);
    final formKey = GlobalKey<FormState>();

    final draft = await showDialog<_QuoteDraft>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => AlertDialog(
        title: Row(
          children: [
            Icon(
              Icons.edit_note_rounded,
              color: _readableColor(AppColors.maroon),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(appText(
                context,
                'Edit sacred quote',
                'पावन वचन संशोधित करें',
              )),
            ),
          ],
        ),
        content: SizedBox(
          width: 620,
          child: SingleChildScrollView(
            child: Form(
              key: formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextFormField(
                    controller: englishText,
                    minLines: 4,
                    maxLines: 7,
                    decoration: _inputDecoration(appText(
                      context,
                      'Sacred quote in English',
                      'पावन वचन का अंग्रेज़ी रूप',
                    )),
                    validator: (value) => value == null || value.trim().isEmpty
                        ? appText(
                            context,
                            'The English form is required.',
                            'अंग्रेज़ी रूप आवश्यक है।',
                          )
                        : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: hindiText,
                    minLines: 4,
                    maxLines: 7,
                    decoration: _inputDecoration(appText(
                      context,
                      'Sacred quote in Hindi',
                      'पावन वचन का हिन्दी रूप',
                    )),
                    validator: (value) => value == null || value.trim().isEmpty
                        ? appText(
                            context,
                            'The Hindi form is required.',
                            'हिन्दी रूप आवश्यक है।',
                          )
                        : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: englishAuthor,
                    decoration: _inputDecoration(appText(
                      context,
                      'Attribution in English',
                      'अंग्रेज़ी श्रेय',
                    )),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: hindiAuthor,
                    decoration: _inputDecoration(appText(
                      context,
                      'Attribution in Hindi',
                      'हिन्दी श्रेय',
                    )),
                  ),
                ],
              ),
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: Text(appText(context, 'Cancel', 'निरस्त करें')),
          ),
          FilledButton.icon(
            onPressed: () {
              if (formKey.currentState?.validate() != true) return;
              Navigator.pop(
                dialogContext,
                _QuoteDraft(
                  textEnglish: englishText.text.trim(),
                  textHindi: hindiText.text.trim(),
                  authorEnglish: englishAuthor.text.trim().isEmpty
                      ? 'Maharshi Mehi Paramhans'
                      : englishAuthor.text.trim(),
                  authorHindi: hindiAuthor.text.trim().isEmpty
                      ? 'महर्षि मेँहीँ परमहंस'
                      : hindiAuthor.text.trim(),
                ),
              );
            },
            icon: const Icon(Icons.save_rounded),
            label: Text(appText(context, 'Save', 'सुरक्षित')),
          ),
        ],
      ),
    );

    englishText.dispose();
    hindiText.dispose();
    englishAuthor.dispose();
    hindiAuthor.dispose();
    if (draft == null || !mounted) return;

    setState(() => busy = true);
    try {
      await widget.content.updateQuote(
        id: item.id,
        textEnglish: draft.textEnglish,
        textHindi: draft.textHindi,
        authorEnglish: draft.authorEnglish,
        authorHindi: draft.authorHindi,
      );
      if (mounted) {
        setState(() => status = appText(
              context,
              'Sacred quote updated.',
              'पावन वचन संशोधित।',
            ));
      }
    } catch (_) {
      if (mounted) {
        setState(() => status = appText(
              context,
              'The quote could not be updated. Please try again.',
              'वचन संशोधित नहीं हो सका। कृपया पुनः प्रयास करें।',
            ));
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _appIsDark ? AppColors.darkCanvas : AppColors.cream,
      appBar: AppBar(
        title: Text(appText(
          context,
          'Guru Vandan Admin',
          'गुरु वंदन प्रशासक',
        )),
        actions: [
          IconButton(
            onPressed: () async {
              await _forgetAuthenticatedUser();
              await _signOutFromGoogleProvider();
              await FirebaseAuth.instance.signOut();
            },
            icon: const Icon(Icons.logout_rounded),
            tooltip: appText(context, 'Leave account', 'प्रस्थान'),
          ),
        ],
      ),
      body: SafeArea(
        child: StreamBuilder<User?>(
          stream: widget.firebaseReady
              ? FirebaseAuth.instance.authStateChanges()
              : Stream<User?>.value(null),
          builder: (context, authSnapshot) {
            final user = authSnapshot.data;

            if (user == null) {
              return _PageScaffold(
                maxWidth: 560,
                children: [
                  _ScreenTitle(
                    icon: Icons.admin_panel_settings_rounded,
                    title: appText(context, 'Admin Entrance', 'प्रशासक प्रवेश'),
                  ),
                  _AdminCard(
                    children: [
                      TextField(
                          controller: email,
                          decoration: _inputDecoration(
                            appText(context, 'Admin email', 'प्रशासक ई-पत्र'),
                          )),
                      const SizedBox(height: 12),
                      TextField(
                        controller: password,
                        obscureText: true,
                        decoration: _inputDecoration(
                          appText(context, 'Password', 'गुप्त शब्द'),
                        ),
                      ),
                      const SizedBox(height: 16),
                      FilledButton.icon(
                        onPressed: busy ? null : _signIn,
                        icon: const Icon(Icons.lock_open_rounded),
                        label: Text(appText(context, 'Open', 'खोलें')),
                      ),
                      if (status.isNotEmpty) _StatusText(status),
                    ],
                  ),
                ],
              );
            }

            return FutureBuilder<bool>(
              future: widget.content.isAdmin(user),
              builder: (context, adminSnapshot) {
                final admin = adminSnapshot.data == true;
                if (!admin) {
                  return _PageScaffold(
                    maxWidth: 680,
                    children: [
                      _ScreenTitle(
                        icon: Icons.block_rounded,
                        title: appText(
                          context,
                          'Administrative access not enabled',
                          'प्रशासकीय प्रवेश अधिकृत नहीं',
                        ),
                      ),
                      _AdminCard(
                        children: [
                          Text(
                            appText(
                              context,
                              'This account is not authorized for the Guru Vandan admin portal.',
                              'यह खाता गुरु वंदन प्रशासन-पटल के लिए अधिकृत नहीं है।',
                            ),
                            style: Theme.of(context).textTheme.bodyLarge,
                          ),
                        ],
                      ),
                    ],
                  );
                }

                return _PageScaffold(
                  maxWidth: 820,
                  children: [
                    _ScreenTitle(
                      icon: Icons.dashboard_customize_rounded,
                      title: appText(context, 'Administration', 'प्रशासन-पटल'),
                    ),
                    _activityDashboard(),
                    _AdminCard(children: _quoteForm()),
                    _quoteManager(),
                    if (status.isNotEmpty) _StatusText(status),
                  ],
                );
              },
            );
          },
        ),
      ),
    );
  }

  List<Widget> _quoteForm() {
    return [
      Text(
        appText(context, 'Publish a bilingual sacred quote',
            'द्विभाषी पावन वचन प्रकाशित करें'),
        style: Theme.of(context).textTheme.titleLarge,
      ),
      const SizedBox(height: 6),
      Text(
        appText(
          context,
          'Both forms are required so each devotee receives the teaching in their chosen language.',
          'प्रत्येक भक्त को चयनित भाषा में महर्षि मेँहीँ परमहंस वाणी प्राप्त हो, इस हेतु दोनों रूप आवश्यक हैं।',
        ),
        style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontSize: 15),
      ),
      const SizedBox(height: 14),
      TextField(
        controller: quoteEnglish,
        decoration: _inputDecoration(appText(
          context,
          'Sacred quote in English',
          'पावन वचन का अंग्रेज़ी रूप',
        )),
        minLines: 4,
        maxLines: 7,
      ),
      const SizedBox(height: 12),
      TextField(
        controller: quoteHindi,
        decoration: _inputDecoration(appText(
          context,
          'Sacred quote in Hindi',
          'पावन वचन का हिन्दी रूप',
        )),
        minLines: 4,
        maxLines: 7,
      ),
      const SizedBox(height: 12),
      TextField(
        controller: authorEnglish,
        decoration: _inputDecoration(appText(
          context,
          'Attribution in English',
          'अंग्रेज़ी श्रेय',
        )),
      ),
      const SizedBox(height: 12),
      TextField(
        controller: authorHindi,
        decoration: _inputDecoration(appText(
          context,
          'Attribution in Hindi',
          'हिन्दी श्रेय',
        )),
      ),
      const SizedBox(height: 16),
      FilledButton.icon(
        onPressed: busy ? null : _publishQuote,
        icon: const Icon(Icons.format_quote_rounded),
        label: Text(appText(context, 'Publish', 'प्रकाशित')),
      ),
    ];
  }

  Widget _quoteManager() {
    return StreamBuilder<List<WisdomQuote>>(
      stream: widget.content.adminQuotes(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting &&
            !snapshot.hasData) {
          return const _AdminCard(
            children: [
              Center(child: CircularProgressIndicator()),
            ],
          );
        }

        if (snapshot.hasError) {
          return _AdminCard(
            children: [
              Text(
                appText(
                  context,
                  'Quotes could not be loaded. Check the Firebase database rules.',
                  'वचन प्राप्त नहीं हो सके। Firebase डेटा-संग्रह के नियम जाँचें।',
                ),
                style: TextStyle(
                  color: _readableColor(AppColors.crimson),
                ),
              ),
            ],
          );
        }

        final quotes = [...?snapshot.data]..sort((a, b) {
            final aDate = quoteScheduledDay(a);
            final bDate = quoteScheduledDay(b);
            if (aDate == null && bDate == null) return 0;
            if (aDate == null) return 1;
            if (bDate == null) return -1;
            return aDate.compareTo(bDate);
          });
        return _AdminCard(
          children: [
            Row(
              children: [
                const _IconBadge(
                  icon: Icons.library_books_rounded,
                  background: AppColors.rose,
                  color: AppColors.maroon,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        appText(context, 'Daily quote queue', 'दैनिक वचन क्रम'),
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      Text(
                        appText(
                          context,
                          'One scheduled quote is shown each day.',
                          'प्रतिदिन एक निर्धारित वचन प्रदर्शित होगा।',
                        ),
                        style: Theme.of(context)
                            .textTheme
                            .bodyLarge
                            ?.copyWith(fontSize: 15),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                  decoration: BoxDecoration(
                    color: _surfaceColor(AppColors.parchment),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    '${quotes.length}',
                    style: TextStyle(
                      color: _readableColor(AppColors.maroon),
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            if (quotes.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 18),
                child: Text(
                  appText(
                    context,
                    'No Firebase quotes yet. Publish the first one above.',
                    'Firebase में अभी कोई पावन वचन उपलब्ध नहीं। ऊपर प्रथम वचन प्रकाशित करें।',
                  ),
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
              )
            else
              for (var index = 0; index < quotes.length; index++) ...[
                _AdminQuoteListItem(
                  quote: quotes[index],
                  onEdit: busy ? null : () => _editQuote(quotes[index]),
                ),
                if (index != quotes.length - 1) const Divider(height: 28),
              ],
          ],
        );
      },
    );
  }

  Widget _activityDashboard() {
    return StreamBuilder<List<DevoteeActivity>>(
      stream: widget.content.adminActivity(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting &&
            !snapshot.hasData) {
          return const _AdminCard(
            children: [Center(child: CircularProgressIndicator())],
          );
        }

        if (snapshot.hasError) {
          return _AdminCard(
            children: [
              Text(
                appText(
                  context,
                  'User activity could not be loaded. Check the Firebase database rules.',
                  'सदस्य-साधना विवरण प्राप्त नहीं हो सका। Firebase नियमों की जाँच करें।',
                ),
                style: TextStyle(
                  color: _readableColor(AppColors.crimson),
                ),
              ),
            ],
          );
        }

        final users = snapshot.data ?? const <DevoteeActivity>[];
        final filteredUsers = filterDevoteeActivities(users, userSearchQuery);
        final now = DateTime.now();
        final activeToday = users.where((user) => user.activeOn(now)).length;
        final satsangSeconds = users.fold<int>(
          0,
          (total, user) => total + user.satsangSeconds,
        );
        final meditationSeconds = users.fold<int>(
          0,
          (total, user) => total + user.meditationSeconds,
        );
        final quoteShares = users.fold<int>(
          0,
          (total, user) => total + user.quoteShares,
        );
        final quoteLikes = users.fold<int>(
          0,
          (total, user) => total + user.quoteLikes,
        );

        return _AdminCard(
          children: [
            Row(
              children: [
                const _IconBadge(
                  icon: Icons.insights_rounded,
                  background: Color(0xFFE7EFE9),
                  color: AppColors.sage,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    appText(context, 'Devotee activity', 'सदस्य-साधना विवरण'),
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                _AdminMetric(
                  label: appText(context, 'Registered', 'पंजीकृत'),
                  value: '${users.length}',
                  icon: Icons.people_alt_rounded,
                ),
                _AdminMetric(
                  label: appText(context, 'Active today', 'आज सक्रिय'),
                  value: '$activeToday',
                  icon: Icons.today_rounded,
                ),
                _AdminMetric(
                  label: appText(context, 'Satsang time', 'सत्संग समय'),
                  value: formatActivityDuration(satsangSeconds),
                  icon: Icons.headphones_rounded,
                ),
                _AdminMetric(
                  label: appText(context, 'Meditation time', 'ध्यान समय'),
                  value: formatActivityDuration(meditationSeconds),
                  icon: Icons.self_improvement_rounded,
                ),
                _AdminMetric(
                  label: appText(context, 'Quote shares', 'वचन साझा'),
                  value: '$quoteShares',
                  icon: Icons.ios_share_rounded,
                ),
                _AdminMetric(
                  label: appText(context, 'Quote likes', 'पसंद किए वचन'),
                  value: '$quoteLikes',
                  icon: Icons.favorite_rounded,
                ),
              ],
            ),
            const SizedBox(height: 20),
            Text(
              appText(
                context,
                'Active devotees in the last seven days',
                'गत सात दिवसों के सक्रिय सदस्य',
              ),
              style: TextStyle(
                color: _readableColor(AppColors.ink),
                fontSize: 16,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 10),
            _SevenDayActivityChart(users: users),
            const SizedBox(height: 22),
            Text(
              appText(context, 'Practice time', 'साधना समय'),
              style: TextStyle(
                color: _readableColor(AppColors.ink),
                fontSize: 16,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 12),
            _PracticeTimeChart(users: users),
            const SizedBox(height: 22),
            _AdminStreakAnalytics(users: users),
            const SizedBox(height: 22),
            Text(
              appText(context, 'Feature interest', 'सुविधा रुचि'),
              style: TextStyle(
                color: _readableColor(AppColors.ink),
                fontSize: 16,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 12),
            _FeatureInterestChart(users: users),
            _MostLikedQuotes(users: users),
            const Divider(height: 30),
            Text(
              appText(context, 'Individual practice history',
                  'व्यक्तिगत साधना-विवरण'),
              style: TextStyle(
                color: _readableColor(AppColors.ink),
                fontSize: 17,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              key: const Key('admin-user-search'),
              controller: userSearch,
              onChanged: (value) => setState(() => userSearchQuery = value),
              decoration: _inputDecoration(
                appText(context, 'Search name or email', 'नाम या ई-पत्र खोजें'),
              ).copyWith(
                prefixIcon: const Icon(Icons.search_rounded),
                suffixIcon: userSearchQuery.isEmpty
                    ? null
                    : IconButton(
                        onPressed: () {
                          userSearch.clear();
                          setState(() => userSearchQuery = '');
                        },
                        icon: const Icon(Icons.close_rounded),
                        tooltip: appText(context, 'Clear', 'मिटाएँ'),
                      ),
              ),
            ),
            const SizedBox(height: 8),
            if (users.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 18),
                child: Text(
                  appText(
                    context,
                    'No registered devotees are available yet.',
                    'अभी कोई पंजीकृत सदस्य उपलब्ध नहीं है।',
                  ),
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
              )
            else if (filteredUsers.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 18),
                child: Text(
                  appText(
                    context,
                    'No matching user',
                    'कोई मेल खाता सदस्य नहीं',
                  ),
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
              )
            else
              for (final user in filteredUsers)
                _AdminUserActivityTile(user: user),
          ],
        );
      },
    );
  }
}

class _AdminMetric extends StatelessWidget {
  const _AdminMetric({
    required this.label,
    required this.value,
    required this.icon,
  });

  final String label;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minWidth: 150),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: _raisedSurfaceColor(),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: _borderColor(AppColors.border)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: _readableColor(AppColors.maroon)),
          const SizedBox(width: 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                value,
                style: TextStyle(
                  color: _readableColor(AppColors.ink),
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                ),
              ),
              Text(
                label,
                style: TextStyle(color: _readableColor(AppColors.taupe)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SevenDayActivityChart extends StatelessWidget {
  const _SevenDayActivityChart({required this.users});

  final List<DevoteeActivity> users;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final days = List.generate(
      7,
      (index) => now.subtract(Duration(days: 6 - index)),
    );
    final counts = days.map((day) {
      return users.where((user) => user.activeOn(day)).length;
    }).toList();
    final maxCount = max(1, counts.fold<int>(0, max));

    return SizedBox(
      height: 176,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          for (var index = 0; index < days.length; index++)
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 3),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    Text(
                      '${counts[index]}',
                      style: TextStyle(
                        color: _readableColor(AppColors.maroon),
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Container(
                      height: 18 + (92 * counts[index] / maxCount),
                      decoration: BoxDecoration(
                        color: counts[index] == 0
                            ? AppColors.rose
                            : AppColors.maroon,
                        borderRadius: const BorderRadius.vertical(
                          top: Radius.circular(6),
                        ),
                      ),
                    ),
                    const SizedBox(height: 7),
                    Text(
                      DateFormat('EEE').format(days[index]),
                      maxLines: 1,
                      style: TextStyle(
                        color: _readableColor(AppColors.taupe),
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _PracticeTimeChart extends StatelessWidget {
  const _PracticeTimeChart({required this.users});

  final List<DevoteeActivity> users;

  @override
  Widget build(BuildContext context) {
    final satsangSeconds = users.fold<int>(
      0,
      (total, user) => total + user.satsangSeconds,
    );
    final meditationSeconds = users.fold<int>(
      0,
      (total, user) => total + user.meditationSeconds,
    );
    final maximum = max(1, max(satsangSeconds, meditationSeconds));

    return Column(
      children: [
        _AnalyticsBar(
          icon: Icons.headphones_rounded,
          label: appText(context, 'Satsang', 'सत्संग'),
          value: satsangSeconds,
          maximum: maximum,
          valueLabel: formatActivityDuration(satsangSeconds),
          color: AppColors.maroon,
        ),
        const SizedBox(height: 12),
        _AnalyticsBar(
          icon: Icons.self_improvement_rounded,
          label: appText(context, 'Meditation', 'ध्यान'),
          value: meditationSeconds,
          maximum: maximum,
          valueLabel: formatActivityDuration(meditationSeconds),
          color: AppColors.sage,
        ),
      ],
    );
  }
}

class _AdminStreakAnalytics extends StatefulWidget {
  const _AdminStreakAnalytics({required this.users});

  final List<DevoteeActivity> users;

  @override
  State<_AdminStreakAnalytics> createState() => _AdminStreakAnalyticsState();
}

class _AdminStreakAnalyticsState extends State<_AdminStreakAnalytics> {
  SacredStreakKind selectedKind = SacredStreakKind.meditation;

  @override
  Widget build(BuildContext context) {
    final points = widget.users
        .map((user) {
          final history = user.sacredHistory;
          final activeDays = sacredActivityDaysForKind(history, selectedKind);
          final longest = sacredLongestStreakForKind(
            history: history,
            accountCreatedAt: user.accountCreatedOn,
            kind: selectedKind,
          ).length;
          return _AdminStreakPoint(
            user: user,
            activeDays: activeDays,
            longest: longest,
          );
        })
        .where((point) => point.activeDays > 0 || point.longest > 0)
        .toList()
      ..sort((a, b) {
        final streakComparison = b.longest.compareTo(a.longest);
        return streakComparison != 0
            ? streakComparison
            : b.activeDays.compareTo(a.activeDays);
      });
    final maximum = points.fold<int>(
      1,
      (value, point) => max(value, max(point.activeDays, point.longest)),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          appText(context, 'Streak comparison', 'साधना क्रम तुलना'),
          style: TextStyle(
            color: _readableColor(AppColors.ink),
            fontSize: 16,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 10),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: _raisedSurfaceColor(),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: _borderColor(AppColors.border)),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<SacredStreakKind>(
              key: const Key('admin-streak-aspect'),
              value: selectedKind,
              isExpanded: true,
              borderRadius: BorderRadius.circular(12),
              items: SacredStreakKind.values
                  .map(
                    (kind) => DropdownMenuItem(
                      value: kind,
                      child: Text(_adminStreakKindLabel(context, kind)),
                    ),
                  )
                  .toList(),
              onChanged: (value) {
                if (value != null) setState(() => selectedKind = value);
              },
            ),
          ),
        ),
        const SizedBox(height: 10),
        Row(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            _ChartLegend(
              color: AppColors.maroon,
              label: appText(context, 'Days', 'दिवस'),
            ),
            const SizedBox(width: 14),
            _ChartLegend(
              color: AppColors.sage,
              label: appText(context, 'Longest', 'दीर्घतम'),
            ),
          ],
        ),
        const SizedBox(height: 8),
        if (points.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 18),
            child: Text(
              appText(context, 'No activity yet', 'अभी कोई गतिविधि नहीं'),
              textAlign: TextAlign.center,
              style: TextStyle(color: _readableColor(AppColors.taupe)),
            ),
          )
        else
          for (final point in points.take(12))
            _AdminStreakChartRow(point: point, maximum: maximum),
      ],
    );
  }

  String _adminStreakKindLabel(
    BuildContext context,
    SacredStreakKind kind,
  ) {
    return switch (kind) {
      SacredStreakKind.fullPractice => appText(
          context,
          'Morning + evening + meditation',
          'प्रातः + सायं + ध्यान',
        ),
      SacredStreakKind.satsangAndMeditation =>
        appText(context, 'Satsang + meditation', 'सत्संग + ध्यान'),
      SacredStreakKind.bothSatsangs =>
        appText(context, 'Morning + evening satsang', 'प्रातः + सायं सत्संग'),
      SacredStreakKind.meditation => appText(context, 'Meditation', 'ध्यान'),
      SacredStreakKind.morningSatsang =>
        appText(context, 'Morning satsang', 'प्रातः सत्संग'),
      SacredStreakKind.eveningSatsang =>
        appText(context, 'Evening satsang', 'सायं सत्संग'),
    };
  }
}

class _AdminStreakPoint {
  const _AdminStreakPoint({
    required this.user,
    required this.activeDays,
    required this.longest,
  });

  final DevoteeActivity user;
  final int activeDays;
  final int longest;
}

class _AdminStreakChartRow extends StatelessWidget {
  const _AdminStreakChartRow({
    required this.point,
    required this.maximum,
  });

  final _AdminStreakPoint point;
  final int maximum;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            point.user.name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: _readableColor(AppColors.ink),
              fontWeight: FontWeight.w900,
            ),
          ),
          if (point.user.email.trim().isNotEmpty)
            Text(
              point.user.email,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: _readableColor(AppColors.taupe),
                fontSize: 12,
              ),
            ),
          const SizedBox(height: 6),
          _AdminComparisonBar(
            value: point.activeDays,
            maximum: maximum,
            color: AppColors.maroon,
            prefix: appText(context, 'D', 'दि'),
          ),
          const SizedBox(height: 5),
          _AdminComparisonBar(
            value: point.longest,
            maximum: maximum,
            color: AppColors.sage,
            prefix: appText(context, 'S', 'क्र'),
          ),
        ],
      ),
    );
  }
}

class _AdminComparisonBar extends StatelessWidget {
  const _AdminComparisonBar({
    required this.value,
    required this.maximum,
    required this.color,
    required this.prefix,
  });

  final int value;
  final int maximum;
  final Color color;
  final String prefix;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: LinearProgressIndicator(
              minHeight: 9,
              value: value / max(1, maximum),
              color: _readableColor(color),
              backgroundColor: _surfaceColor(AppColors.rose),
            ),
          ),
        ),
        const SizedBox(width: 8),
        SizedBox(
          width: 42,
          child: Text(
            '$prefix $value',
            textAlign: TextAlign.right,
            style: TextStyle(
              color: _readableColor(AppColors.ink),
              fontSize: 12,
              fontWeight: FontWeight.w900,
            ),
          ),
        ),
      ],
    );
  }
}

class _ChartLegend extends StatelessWidget {
  const _ChartLegend({required this.color, required this.label});

  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(
            color: _readableColor(color),
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 5),
        Text(
          label,
          style: TextStyle(
            color: _readableColor(AppColors.taupe),
            fontSize: 12,
            fontWeight: FontWeight.w800,
          ),
        ),
      ],
    );
  }
}

class _FeatureInterestChart extends StatelessWidget {
  const _FeatureInterestChart({required this.users});

  final List<DevoteeActivity> users;

  @override
  Widget build(BuildContext context) {
    final satsangUsers = users
        .where((user) =>
            user.satsangSeconds > 0 ||
            user.count(RoutineTask.morningSatsang) > 0 ||
            user.count(RoutineTask.eveningSatsang) > 0)
        .length;
    final meditationUsers = users
        .where((user) =>
            user.meditationSeconds > 0 || user.meditationStats.total > 0)
        .length;
    final wisdomUsers = users
        .where((user) =>
            user.quoteViews > 0 || user.quoteShares > 0 || user.quoteLikes > 0)
        .length;
    final maximum = max(1, users.length);

    return Column(
      children: [
        _AnalyticsBar(
          icon: Icons.headphones_rounded,
          label: appText(context, 'Satsang', 'सत्संग'),
          value: satsangUsers,
          maximum: maximum,
          valueLabel: '$satsangUsers',
          color: AppColors.maroon,
        ),
        const SizedBox(height: 12),
        _AnalyticsBar(
          icon: Icons.self_improvement_rounded,
          label: appText(context, 'Meditation', 'ध्यान'),
          value: meditationUsers,
          maximum: maximum,
          valueLabel: '$meditationUsers',
          color: AppColors.sage,
        ),
        const SizedBox(height: 12),
        _AnalyticsBar(
          icon: Icons.format_quote_rounded,
          label: appText(context, 'Wisdom', 'गुरु वाणी'),
          value: wisdomUsers,
          maximum: maximum,
          valueLabel: '$wisdomUsers',
          color: AppColors.gold,
        ),
      ],
    );
  }
}

class _MostLikedQuotes extends StatelessWidget {
  const _MostLikedQuotes({required this.users});

  final List<DevoteeActivity> users;

  @override
  Widget build(BuildContext context) {
    final counts = <String, int>{};
    final labels = <String, String>{};
    for (final user in users) {
      for (final quoteId in user.likedQuoteIds) {
        counts.update(quoteId, (value) => value + 1, ifAbsent: () => 1);
      }
      for (final event in user.events.where(
        (event) => event.type == 'quote_liked' && event.contentId.isNotEmpty,
      )) {
        if (event.label.isNotEmpty) labels[event.contentId] = event.label;
      }
    }
    final ranked = counts.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    if (ranked.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 22),
        Text(
          appText(context, 'Most liked quotes', 'सर्वाधिक पसंद वचन'),
          style: TextStyle(
            color: _readableColor(AppColors.ink),
            fontSize: 16,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 8),
        for (final entry in ranked.take(5))
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 5),
            child: Row(
              children: [
                Icon(
                  Icons.favorite_rounded,
                  size: 18,
                  color: _readableColor(AppColors.crimson),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    labels[entry.key] ?? entry.key,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(color: _readableColor(AppColors.ink)),
                  ),
                ),
                const SizedBox(width: 10),
                Text(
                  '${entry.value}',
                  style: TextStyle(
                    color: _readableColor(AppColors.maroon),
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class _AnalyticsBar extends StatelessWidget {
  const _AnalyticsBar({
    required this.icon,
    required this.label,
    required this.value,
    required this.maximum,
    required this.valueLabel,
    required this.color,
  });

  final IconData icon;
  final String label;
  final int value;
  final int maximum;
  final String valueLabel;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final fraction = (value / max(1, maximum)).clamp(0.0, 1.0);
    final displayColor = _readableColor(color)!;
    return Row(
      children: [
        Icon(icon, size: 20, color: displayColor),
        const SizedBox(width: 8),
        SizedBox(
          width: 82,
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: _readableColor(AppColors.ink),
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              minHeight: 12,
              value: fraction,
              color: displayColor,
              backgroundColor: _surfaceColor(AppColors.rose),
            ),
          ),
        ),
        const SizedBox(width: 10),
        SizedBox(
          width: 68,
          child: Text(
            valueLabel,
            textAlign: TextAlign.right,
            style: TextStyle(
              color: _readableColor(AppColors.ink),
              fontWeight: FontWeight.w900,
            ),
          ),
        ),
      ],
    );
  }
}

class _AdminUserActivityTile extends StatelessWidget {
  const _AdminUserActivityTile({required this.user});

  final DevoteeActivity user;

  @override
  Widget build(BuildContext context) {
    final recentDays = user.records.entries
        .where((entry) => entry.value.values.contains(true))
        .toList()
      ..sort((a, b) => b.key.compareTo(a.key));

    return ExpansionTile(
      tilePadding: EdgeInsets.zero,
      childrenPadding: const EdgeInsets.only(bottom: 14),
      leading: CircleAvatar(
        backgroundColor: _surfaceColor(AppColors.rose),
        foregroundColor: _readableColor(AppColors.maroon),
        child: Text(user.name.characters.first.toUpperCase()),
      ),
      title: Text(
        user.name,
        style: TextStyle(
          color: _readableColor(AppColors.ink),
          fontWeight: FontWeight.w900,
        ),
      ),
      subtitle: Text(
        user.contact,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            _ActivityPill(
              label: appText(context, 'Satsang time', 'सत्संग समय'),
              value: formatActivityDuration(user.satsangSeconds),
            ),
            _ActivityPill(
              label: appText(context, 'Meditation time', 'ध्यान समय'),
              value: formatActivityDuration(user.meditationSeconds),
            ),
            _ActivityPill(
              label: appText(context, 'Quote views', 'वचन देखे'),
              value: '${user.quoteViews}',
            ),
            _ActivityPill(
              label: appText(context, 'Quote shares', 'वचन साझा'),
              value: '${user.quoteShares}',
            ),
            _ActivityPill(
              label: appText(context, 'Quote likes', 'पसंद वचन'),
              value: '${user.quoteLikes}',
            ),
          ],
        ),
        const SizedBox(height: 14),
        _MeditationStreakPanel(
          records: user.records,
          activityEvents: user.events,
          accountCreatedAt: user.accountCreatedOn,
        ),
        const SizedBox(height: 16),
        Align(
          alignment: Alignment.centerLeft,
          child: Text(
            appText(context, 'Recent activity', 'हाल की गतिविधि'),
            style: TextStyle(
              color: _readableColor(AppColors.ink),
              fontWeight: FontWeight.w900,
            ),
          ),
        ),
        const SizedBox(height: 8),
        if (user.events.isEmpty && recentDays.isEmpty)
          Align(
            alignment: Alignment.centerLeft,
            child: Text(
              appText(
                context,
                'No practice has been recorded from the updated app yet.',
                'अद्यतन अनुप्रयोग से अभी कोई साधना अंकित नहीं हुई है।',
              ),
              style: TextStyle(color: _readableColor(AppColors.taupe)),
            ),
          )
        else if (user.events.isNotEmpty)
          for (final event in user.events.take(20))
            _AdminActivityEventRow(event: event),
        if (recentDays.isNotEmpty) ...[
          const SizedBox(height: 12),
          Align(
            alignment: Alignment.centerLeft,
            child: Text(
              appText(context, 'Completed practices', 'पूर्ण साधनाएँ'),
              style: TextStyle(
                color: _readableColor(AppColors.ink),
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
          const SizedBox(height: 5),
          for (final day in recentDays.take(14))
            _AdminActivityDay(date: day.key, tasks: day.value),
        ],
      ],
    );
  }
}

class _AdminActivityEventRow extends StatelessWidget {
  const _AdminActivityEventRow({required this.event});

  final DevoteeActivityEvent event;

  @override
  Widget build(BuildContext context) {
    final details = <String>[
      DateFormat('dd MMM, h:mm a').format(event.occurredAt),
      if (event.durationSeconds > 0)
        formatActivityDuration(event.durationSeconds),
      if (event.completed) appText(context, 'completed', 'पूर्ण'),
    ];

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(_icon, size: 19, color: _color),
          const SizedBox(width: 9),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _title(context),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: _readableColor(AppColors.ink),
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  details.join(' | '),
                  style: TextStyle(
                    color: _readableColor(AppColors.taupe),
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _title(BuildContext context) {
    final fallback = event.label.trim();
    return switch (event.type) {
      'app_opened' => appText(context, 'Opened the app', 'ऐप खोला'),
      'screen_view' => appText(
          context,
          'Visited ${fallback.isEmpty ? 'a page' : fallback}',
          '${fallback.isEmpty ? 'पृष्ठ' : fallback} देखा',
        ),
      'satsang_listened' => fallback.isEmpty
          ? appText(context, 'Listened to satsang', 'सत्संग सुना')
          : fallback,
      'meditation_session' => event.completed
          ? appText(context, 'Completed meditation', 'ध्यान पूर्ण किया')
          : appText(context, 'Meditated', 'ध्यान किया'),
      'quote_viewed' => appText(context, 'Viewed a quote', 'वचन देखा'),
      'quote_shared' => appText(context, 'Shared a quote', 'वचन साझा किया'),
      'quote_liked' => event.label.isEmpty
          ? appText(context, 'Liked a quote', 'वचन पसंद किया')
          : appText(
              context,
              'Liked: ${event.label}',
              'पसंद: ${event.label}',
            ),
      'quote_unliked' => appText(
          context,
          'Removed a quote from likes',
          'वचन को पसंद से हटाया',
        ),
      _ => fallback.isEmpty ? event.type : fallback,
    };
  }

  IconData get _icon => switch (event.type) {
        'app_opened' => Icons.phone_android_rounded,
        'screen_view' => Icons.visibility_rounded,
        'satsang_listened' => Icons.headphones_rounded,
        'meditation_session' => Icons.self_improvement_rounded,
        'quote_viewed' => Icons.format_quote_rounded,
        'quote_shared' => Icons.ios_share_rounded,
        'quote_liked' => Icons.favorite_rounded,
        'quote_unliked' => Icons.heart_broken_rounded,
        _ => Icons.circle_rounded,
      };

  Color get _color => switch (event.type) {
        'meditation_session' => AppColors.sage,
        'quote_viewed' ||
        'quote_shared' ||
        'quote_liked' ||
        'quote_unliked' =>
          AppColors.gold,
        _ => AppColors.maroon,
      };
}

class _ActivityPill extends StatelessWidget {
  const _ActivityPill({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: _surfaceColor(AppColors.parchment),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        '$label: $value',
        style: TextStyle(
          color: _readableColor(AppColors.ink),
          fontSize: 13,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _AdminActivityDay extends StatelessWidget {
  const _AdminActivityDay({required this.date, required this.tasks});

  final String date;
  final Map<String, bool> tasks;

  @override
  Widget build(BuildContext context) {
    final completed = <String>[
      if (tasks[RoutineTask.morningSatsang.name] == true)
        appText(context, 'Morning satsang', 'प्रातः सत्संग'),
      if (tasks[RoutineTask.eveningSatsang.name] == true)
        appText(context, 'Evening satsang', 'सायं सत्संग'),
      if (tasks[RoutineTask.meditation.name] == true)
        appText(context, 'Meditation', 'ध्यान'),
    ];
    final parsed = DateTime.tryParse(date);
    final dateLabel =
        parsed == null ? date : DateFormat('dd MMM yyyy').format(parsed);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            Icons.check_circle_rounded,
            size: 18,
            color: _readableColor(AppColors.sage),
          ),
          const SizedBox(width: 8),
          SizedBox(
            width: 92,
            child: Text(
              dateLabel,
              style: TextStyle(
                color: _readableColor(AppColors.ink),
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          Expanded(
            child: Text(
              completed.join(', '),
              style: TextStyle(color: _readableColor(AppColors.taupe)),
            ),
          ),
        ],
      ),
    );
  }
}

class _QuoteDraft {
  const _QuoteDraft({
    required this.textEnglish,
    required this.textHindi,
    required this.authorEnglish,
    required this.authorHindi,
  });

  final String textEnglish;
  final String textHindi;
  final String authorEnglish;
  final String authorHindi;
}

class _AdminQuoteListItem extends StatelessWidget {
  const _AdminQuoteListItem({
    required this.quote,
    required this.onEdit,
  });

  final WisdomQuote quote;
  final VoidCallback? onEdit;

  @override
  Widget build(BuildContext context) {
    final localizations = MaterialLocalizations.of(context);
    final scheduled = quoteScheduledDay(quote);
    final timestamp = scheduled == null
        ? appText(context, 'Date unavailable', 'तिथि उपलब्ध नहीं')
        : appText(
            context,
            'Scheduled: ${localizations.formatMediumDate(scheduled)}',
            'निर्धारित: ${localizations.formatMediumDate(scheduled)}',
          );

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      timestamp,
                      style: TextStyle(
                        color: _readableColor(AppColors.muted),
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Text(
                  quote.text,
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        color: _readableColor(AppColors.ink),
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const SizedBox(height: 4),
                Text(
                  '- ${quote.author}',
                  style: TextStyle(color: _readableColor(AppColors.taupe)),
                ),
                const SizedBox(height: 10),
                Text(
                  quote.textHindi.trim().isEmpty
                      ? 'हिन्दी रूप अभी अंकित नहीं है।'
                      : quote.textHindi,
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        color: quote.textHindi.trim().isEmpty
                            ? _readableColor(AppColors.crimson)
                            : _readableColor(AppColors.ink),
                      ),
                ),
                if (quote.textHindi.trim().isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    '- ${quote.authorHindi}',
                    style: TextStyle(color: _readableColor(AppColors.taupe)),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 12),
          IconButton.filledTonal(
            onPressed: onEdit,
            icon: const Icon(Icons.edit_rounded),
            tooltip:
                appText(context, 'Edit sacred quote', 'पावन वचन संशोधित करें'),
          ),
        ],
      ),
    );
  }
}

class _SacredBackground extends StatelessWidget {
  const _SacredBackground();

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: isDark
              ? const [
                  Color(0xFF15100F),
                  Color(0xFF211513),
                  Color(0xFF2B1B18),
                ]
              : const [
                  Color(0xFFFFFCF7),
                  Color(0xFFFBF3E7),
                  Color(0xFFF5E7D7),
                ],
        ),
      ),
      child: CustomPaint(painter: _QuietTexturePainter(isDark: isDark)),
    );
  }
}

class _QuietTexturePainter extends CustomPainter {
  const _QuietTexturePainter({required this.isDark});

  final bool isDark;

  @override
  void paint(Canvas canvas, Size size) {
    final line = Paint()
      ..color = (isDark ? AppColors.softGold : AppColors.maroon)
          .withValues(alpha: isDark ? 0.045 : 0.035)
      ..strokeWidth = 1.4
      ..style = PaintingStyle.stroke;

    for (var y = size.height * 0.08; y < size.height; y += 92) {
      final path = Path()
        ..moveTo(0, y)
        ..quadraticBezierTo(size.width * 0.22, y + 24, size.width * 0.48, y + 4)
        ..quadraticBezierTo(size.width * 0.72, y - 16, size.width, y + 18);
      canvas.drawPath(path, line);
    }

    final band = Paint()
      ..color = AppColors.gold.withValues(alpha: isDark ? 0.05 : 0.08);
    canvas.drawRect(
        Rect.fromLTWH(0, size.height * 0.84, size.width, size.height * 0.16),
        band);
  }

  @override
  bool shouldRepaint(covariant _QuietTexturePainter oldDelegate) {
    return isDark != oldDelegate.isDark;
  }
}

class _PageScaffold extends StatelessWidget {
  const _PageScaffold({
    required this.children,
    this.maxWidth = 720,
    this.onRefresh,
  });

  final List<Widget> children;
  final double maxWidth;
  final Future<void> Function()? onRefresh;

  @override
  Widget build(BuildContext context) {
    final scrollView = CustomScrollView(
      key: ValueKey(children.first.runtimeType),
      physics: onRefresh == null ? null : const AlwaysScrollableScrollPhysics(),
      slivers: [
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(18, 18, 18, 110),
          sliver: SliverToBoxAdapter(
            child: Center(
              child: ConstrainedBox(
                constraints: BoxConstraints(maxWidth: maxWidth),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: children
                      .map((child) => Padding(
                            padding: const EdgeInsets.only(bottom: 16),
                            child: child,
                          ))
                      .toList(),
                ),
              ),
            ),
          ),
        ),
      ],
    );

    final refresh = onRefresh;
    if (refresh == null) return scrollView;
    return RefreshIndicator(
      onRefresh: refresh,
      color: _primaryActionColor(),
      child: scrollView,
    );
  }
}

class _ScreenTitle extends StatelessWidget {
  const _ScreenTitle({
    required this.icon,
    required this.title,
  });

  final IconData icon;
  final String title;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 58,
          height: 58,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: _surfaceColor(AppColors.rose),
          ),
          child: Icon(
            icon,
            color: _readableColor(AppColors.maroon),
            size: 31,
          ),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Text(title, style: Theme.of(context).textTheme.headlineMedium),
        ),
      ],
    );
  }
}

class _IconBadge extends StatelessWidget {
  const _IconBadge({
    required this.icon,
    required this.background,
    required this.color,
  });

  final IconData icon;
  final Color background;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 48,
      height: 48,
      decoration: BoxDecoration(
        color: _surfaceColor(background),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Icon(icon, color: _readableColor(color), size: 27),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title, this.action});

  final String title;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
            child: Text(title, style: Theme.of(context).textTheme.titleLarge)),
        if (action != null) action!,
      ],
    );
  }
}

class _RoutineTile extends StatelessWidget {
  const _RoutineTile({
    required this.title,
    required this.done,
    required this.icon,
    required this.onTap,
  });

  final String title;
  final bool done;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      key: Key('routine-tile-$title'),
      borderRadius: BorderRadius.circular(8),
      onTap: onTap,
      child: Container(
        constraints: const BoxConstraints(minHeight: 92),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
        decoration: _cardDecoration(
          color: done ? const Color(0xFFFFFBF4) : AppColors.surface,
          borderColor: done ? const Color(0xFFD8C39E) : AppColors.border,
        ),
        child: Row(
          children: [
            Container(
              width: 58,
              height: 58,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(8),
                color: done
                    ? _primaryActionColor()
                    : _surfaceColor(AppColors.rose),
              ),
              child: Icon(done ? Icons.check_rounded : icon,
                  color: done
                      ? _onPrimaryActionColor()
                      : _readableColor(AppColors.maroon),
                  size: 30),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Text(title,
                  style: Theme.of(context)
                      .textTheme
                      .titleLarge
                      ?.copyWith(fontSize: 19)),
            ),
            if (!done) ...[
              const SizedBox(width: 10),
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: _surfaceColor(AppColors.cream),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: _borderColor(AppColors.border)),
                ),
                child: Icon(
                  Icons.chevron_right_rounded,
                  color: _readableColor(AppColors.maroon),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _WisdomFeature extends StatelessWidget {
  const _WisdomFeature({
    required this.quote,
    this.onShared,
    this.liked = false,
    this.onLiked,
  });

  final WisdomQuote quote;
  final ValueChanged<WisdomQuote>? onShared;
  final bool liked;
  final ValueChanged<WisdomQuote>? onLiked;

  @override
  Widget build(BuildContext context) {
    final language = LanguageScope.of(context).language;

    return Container(
      padding: const EdgeInsets.all(22),
      decoration: _cardDecoration(
        color: const Color(0xFFFFF8EF),
        borderColor: const Color(0xFFECD9BC),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.format_quote_rounded,
                color: _readableColor(AppColors.gold),
                size: 36,
              ),
              const Spacer(),
              _WisdomLikeButton(
                quote: quote,
                liked: liked,
                onLiked: onLiked,
                prominent: true,
              ),
              const SizedBox(width: 8),
              _WisdomShareButton(
                quote: quote,
                prominent: true,
                onShared: onShared,
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            quote.text,
            style: _headingStyle(
              language,
              color: AppColors.ink,
              fontSize: 24,
              height: 1.35,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 14),
          Text(
            quote.author,
            style: TextStyle(
              color: _readableColor(AppColors.maroon),
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }
}

class _AboutHomeSection extends StatelessWidget {
  const _AboutHomeSection();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _AboutAccordionCard(
          title: appText(
            context,
            'ABOUT GURU MAHARAJ',
            'महर्षि मेँहीँ परमहंस',
          ),
          body: appText(
            context,
            'Sadguru Maharshi Mehi Paramhans was one of the most respected saints and spiritual masters of the Sant Mat tradition in India. Born in Bihar, he dedicated his life to spreading the message of inner meditation, self-realization, universal love, and peace. He emphasized the practice of Surat Shabd Yoga and taught that true spirituality lies beyond caste, religion, and social divisions.\n\nThrough his profound writings, discourses, and compassionate guidance, he inspired millions of devotees to walk the path of devotion, simplicity, morality, and spiritual awakening. His teachings continue to guide seekers toward inner harmony and realization of the Divine within every soul.',
            'सद्गुरु महर्षि मेँहीँ परमहंस भारत की संतमत परंपरा के अत्यंत सम्मानित संत और आध्यात्मिक गुरु थे। बिहार में जन्मे महर्षि मेँहीँ ने अपना जीवन अंतर्ध्यान, आत्म-साक्षात्कार, सार्वभौमिक प्रेम और शांति का संदेश फैलाने के लिए समर्पित किया। उन्होंने सुरत-शब्द योग की साधना पर बल दिया और सिखाया कि सच्ची आध्यात्मिकता जाति, धर्म और सामाजिक भेदभाव से परे है।\n\nअपने गहन लेखन, प्रवचनों और करुणामय मार्गदर्शन से उन्होंने लाखों भक्तों को भक्ति, सरलता, नैतिकता और आध्यात्मिक जागरण के मार्ग पर चलने के लिए प्रेरित किया। उनकी शिक्षाएं आज भी साधकों को आंतरिक सामंजस्य और प्रत्येक आत्मा में स्थित दिव्यता की अनुभूति की ओर मार्गदर्शन देती हैं।',
          ),
          accentColor: AppColors.maroon,
          icon: Icons.auto_awesome_rounded,
        ),
        const SizedBox(height: 14),
        _AboutAccordionCard(
          title: appText(context, 'ABOUT GURU VANDAN', 'गुरु वंदन परिचय'),
          body: appText(
            context,
            'A sacred space for daily spiritual practice — satsang, meditation, Sadguru\'s wisdom and community of devotees, all in one place. Jai Guru.',
            'दैनिक आध्यात्मिक साधना के लिए एक पावन स्थान — सत्संग, ध्यान, सद्गुरु की वाणी और भक्तों का समुदाय, सब एक ही स्थान पर। जय गुरु।',
          ),
          accentColor: AppColors.gold,
          icon: Icons.volunteer_activism_rounded,
        ),
      ],
    );
  }
}

class _AboutAccordionCard extends StatelessWidget {
  const _AboutAccordionCard({
    required this.title,
    required this.body,
    required this.accentColor,
    required this.icon,
  });

  final String title;
  final String body;
  final Color accentColor;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final language = LanguageScope.of(context).language;
    final displayAccent = _readableColor(accentColor)!;

    return Container(
      decoration: _cardDecoration(
        color: AppColors.offWhite,
        borderColor: AppColors.border,
      ).copyWith(
        boxShadow: [
          BoxShadow(
            color: displayAccent.withValues(alpha: 0.08),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: ExpansionTile(
        key: Key('about-$title'),
        initiallyExpanded: false,
        maintainState: true,
        tilePadding: const EdgeInsets.fromLTRB(22, 8, 18, 8),
        childrenPadding: const EdgeInsets.fromLTRB(22, 0, 22, 20),
        iconColor: displayAccent,
        collapsedIconColor: displayAccent,
        shape: const Border(),
        collapsedShape: const Border(),
        leading: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: displayAccent.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color: displayAccent.withValues(alpha: 0.22),
            ),
          ),
          child: Icon(icon, color: displayAccent, size: 23),
        ),
        title: Text(
          title,
          style: _bodyStyle(
            language,
            color: displayAccent,
            fontSize: 15,
            fontWeight: FontWeight.w900,
          ),
        ),
        children: [
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: Text(
              body,
              style: _bodyStyle(
                language,
                color: AppColors.ink,
                fontSize: 15,
                height: 1.55,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CompletionBanner extends StatelessWidget {
  const _CompletionBanner({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: _appIsDark ? AppColors.darkSurfaceSoft : const Color(0xFFEDF4ED),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: _appIsDark ? AppColors.darkSage : const Color(0xFFD6E3D6),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.verified_rounded,
            color: _readableColor(AppColors.sage),
          ),
          const SizedBox(width: 8),
          Text(
            text,
            style: TextStyle(
              color: _readableColor(AppColors.sage),
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }
}

class _AdminCard extends StatelessWidget {
  const _AdminCard({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: _cardDecoration(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: children,
      ),
    );
  }
}

class _StatusText extends StatelessWidget {
  const _StatusText(this.text, {this.isError = false});

  final String text;
  final bool isError;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 14),
      child: Text(
        text,
        style: TextStyle(
          color: _readableColor(
            isError ? AppColors.crimson : AppColors.sage,
          ),
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}

class _NavBar extends StatelessWidget {
  const _NavBar({required this.selected, required this.onSelected});

  final PracticeTab selected;
  final ValueChanged<PracticeTab> onSelected;

  @override
  Widget build(BuildContext context) {
    final language = LanguageScope.of(context).language;
    final compact = MediaQuery.sizeOf(context).width < 420;

    return Container(
      margin: const EdgeInsets.fromLTRB(14, 0, 14, 14),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      decoration: BoxDecoration(
        color: _raisedSurfaceColor(AppColors.surface),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _borderColor()),
        boxShadow: [
          BoxShadow(
            color: (_appIsDark ? Colors.black : AppColors.maroon)
                .withValues(alpha: _appIsDark ? 0.32 : 0.12),
            blurRadius: 30,
            offset: const Offset(0, 16),
          ),
        ],
      ),
      child: NavigationBar(
        selectedIndex: selected.index,
        onDestinationSelected: (index) => onSelected(PracticeTab.values[index]),
        backgroundColor: Colors.transparent,
        elevation: 0,
        indicatorColor: _appIsDark ? AppColors.darkRose : AppColors.rose,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.home_rounded),
            label: appText(context, 'Home', 'गृह'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.headphones_rounded),
            label: appText(context, 'Satsang', 'सत्संग'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.timer_rounded),
            label: appText(context, 'Focus', 'ध्यान'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.format_quote_rounded),
            label: appText(context, 'Wisdom', 'वाणी'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.more_horiz_rounded),
            label: appText(context, 'Other', 'अन्य'),
          ),
        ],
        labelTextStyle: WidgetStatePropertyAll(
          _bodyStyle(
            language,
            color: _appIsDark ? AppColors.darkInk : AppColors.ink,
            fontSize: compact ? 11 : 13,
            height: 1,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}

BoxDecoration _cardDecoration(
    {Color color = AppColors.surface, Color borderColor = AppColors.border}) {
  return BoxDecoration(
    color: _surfaceColor(color),
    borderRadius: BorderRadius.circular(8),
    border: Border.all(color: _borderColor(borderColor)),
    boxShadow: [
      BoxShadow(
        color: (_appIsDark ? Colors.black : AppColors.deepCrimson)
            .withValues(alpha: _appIsDark ? 0.28 : 0.07),
        blurRadius: 22,
        offset: const Offset(0, 12),
      ),
    ],
  );
}

InputDecoration _inputDecoration(String label) {
  final borderColor = _borderColor();
  return InputDecoration(
    labelText: label,
    filled: true,
    fillColor: _surfaceColor(AppColors.cream),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(8),
      borderSide: BorderSide(color: borderColor),
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(8),
      borderSide: BorderSide(color: borderColor),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(8),
      borderSide: BorderSide(
        color: _primaryActionColor(),
        width: 1.5,
      ),
    ),
  );
}

String _formatDuration(Duration duration) {
  final minutes = duration.inMinutes.remainder(60).toString().padLeft(2, '0');
  final seconds = duration.inSeconds.remainder(60).toString().padLeft(2, '0');
  return '$minutes:$seconds';
}

String _formatSeconds(int total) {
  final safe = max(0, total);
  final hours = safe ~/ 3600;
  final minutes = ((safe % 3600) ~/ 60).toString().padLeft(2, '0');
  final seconds = (safe % 60).toString().padLeft(2, '0');
  if (hours > 0) {
    return '${hours.toString().padLeft(2, '0')}:$minutes:$seconds';
  }
  return '$minutes:$seconds';
}

List<int> normalizeMeditationPresetMinutes(
  Iterable<String>? values, {
  bool useDefaultsWhenEmpty = false,
}) {
  final normalized = <int>[];
  for (final value in values ?? const <String>[]) {
    final minutes = int.tryParse(value.trim());
    if (minutes == null ||
        minutes < 1 ||
        minutes >= 24 * 60 ||
        normalized.contains(minutes)) {
      continue;
    }
    normalized.add(minutes);
  }
  if (normalized.isEmpty && useDefaultsWhenEmpty) {
    return [...defaultMeditationPresetMinutes];
  }
  return normalized;
}

List<int> reorderMeditationPresetMinutes(
  List<int> values,
  int draggedMinutes,
  int targetMinutes,
) {
  final reordered = [...values];
  final draggedIndex = reordered.indexOf(draggedMinutes);
  final targetIndex = reordered.indexOf(targetMinutes);
  if (draggedIndex < 0 || targetIndex < 0 || draggedIndex == targetIndex) {
    return reordered;
  }
  final target = reordered[targetIndex];
  reordered[targetIndex] = reordered[draggedIndex];
  reordered[draggedIndex] = target;
  return reordered;
}

Duration _minimumMeditationDuration(Duration duration) {
  if (duration.inSeconds < 60) return const Duration(minutes: 1);
  return Duration(minutes: duration.inMinutes);
}

String _formatDurationLabel(BuildContext context, Duration duration) {
  final safe = _minimumMeditationDuration(duration);
  final totalMinutes = safe.inMinutes;
  final hours = totalMinutes ~/ 60;
  final minutes = totalMinutes % 60;

  if (hours == 0) return _formatMinutesLabel(context, minutes);
  if (minutes == 0) {
    return appText(
      context,
      hours == 1 ? '1 hour' : '$hours hours',
      hours == 1 ? '1 घंटा' : '$hours घंटे',
    );
  }
  return appText(
    context,
    '$hours ${hours == 1 ? 'hour' : 'hours'} $minutes minutes',
    '$hours ${hours == 1 ? 'घंटा' : 'घंटे'} $minutes मिनट',
  );
}

String _formatMinutesLabel(BuildContext context, int minutes) {
  return appText(
    context,
    minutes == 1 ? '1 minute' : '$minutes minutes',
    '$minutes मिनट',
  );
}

SatsangSession _satsangSessionFromValue(Object? value) {
  switch (value?.toString()) {
    case 'evening':
      return SatsangSession.evening;
    case 'aarti':
      return SatsangSession.aarti;
    case 'morning':
    default:
      return SatsangSession.morning;
  }
}

RoutineTask? _routineTaskForSatsangSession(SatsangSession session) {
  switch (session) {
    case SatsangSession.morning:
      return RoutineTask.morningSatsang;
    case SatsangSession.evening:
      return RoutineTask.eveningSatsang;
    case SatsangSession.aarti:
      return null;
  }
}

IconData _satsangSessionIcon(SatsangSession session) {
  switch (session) {
    case SatsangSession.morning:
      return Icons.wb_sunny_rounded;
    case SatsangSession.evening:
      return Icons.nights_stay_rounded;
    case SatsangSession.aarti:
      return Icons.local_fire_department_rounded;
  }
}

String _satsangSessionLabel(BuildContext context, SatsangSession session) {
  switch (session) {
    case SatsangSession.morning:
      return appText(context, 'Morning', 'प्रातः');
    case SatsangSession.evening:
      return appText(context, 'Evening', 'सायं');
    case SatsangSession.aarti:
      return appText(context, 'Aarti', 'आरती');
  }
}

String _satsangSessionEyebrow(BuildContext context, SatsangSession session) {
  switch (session) {
    case SatsangSession.morning:
      return appText(context, 'Morning satsang', 'प्रातः सत्संग');
    case SatsangSession.evening:
      return appText(context, 'Evening satsang', 'सायं सत्संग');
    case SatsangSession.aarti:
      return appText(context, 'Aarti', 'आरती');
  }
}

String _cleanNamePart(String value) {
  return value.trim().replaceAll(RegExp(r'\s+'), ' ');
}

String? _normalizedPhone(String value) {
  var clean = value.trim().replaceAll(RegExp(r'[\s()\-]'), '');
  if (clean.isEmpty) return null;
  if (!clean.startsWith('+') && RegExp(r'^\d{10}$').hasMatch(clean)) {
    clean = '+91$clean';
  }
  if (!RegExp(r'^\+[1-9]\d{7,14}$').hasMatch(clean)) return null;
  return clean;
}

String _userLabel(BuildContext context, User user) {
  if ((user.email ?? '').trim().isNotEmpty) return user.email!.trim();
  if ((user.phoneNumber ?? '').trim().isNotEmpty) {
    return user.phoneNumber!.trim();
  }
  return appText(context, 'Devotee account', 'भक्त-सदस्यता');
}

Future<void> _ensureGoogleSignInReady() {
  if (kIsWeb) return Future<void>.value();
  return _googleSignInInitialization ??= GoogleSignIn.instance.initialize(
    clientId: defaultTargetPlatform == TargetPlatform.iOS
        ? _firebaseIosOptions.iosClientId
        : null,
    serverClientId: defaultTargetPlatform == TargetPlatform.android ||
            defaultTargetPlatform == TargetPlatform.iOS
        ? _googleServerClientId
        : null,
  );
}

Future<void> _rememberAuthenticatedUser(User user) async {
  final uid = user.uid.trim();
  if (uid.isEmpty) return;
  final prefs = await SharedPreferences.getInstance();
  if (prefs.getString(_rememberedAuthUidKey) != uid) {
    await prefs.setString(_rememberedAuthUidKey, uid);
  }
}

Future<void> _forgetAuthenticatedUser() async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.remove(_rememberedAuthUidKey);
}

typedef _ConfirmAccountLink = Future<bool> Function(
  String existingProvider,
  String email,
);

class _AuthFlowCanceled implements Exception {
  const _AuthFlowCanceled();
}

class _AuthIntegrityException implements Exception {
  const _AuthIntegrityException(this.message);

  final String message;
}

bool get _appleSignInAvailable =>
    !kIsWeb && defaultTargetPlatform == TargetPlatform.iOS;

bool _isAccountProviderConflict(FirebaseAuthException error) =>
    error.code == 'account-exists-with-different-credential' ||
    error.code == 'email-already-in-use';

String? _accountLinkEmail(FirebaseAuthException error) {
  final email = error.email?.trim();
  return email == null || email.isEmpty ? null : email;
}

Future<AuthCredential> _googleFirebaseCredential() async {
  await _ensureGoogleSignInReady();
  final account = await GoogleSignIn.instance.authenticate(
    scopeHint: const <String>['email', 'profile'],
  );
  final idToken = account.authentication.idToken;

  if (idToken == null) {
    throw const _AuthIntegrityException(
      'Google did not return the secure identity token needed to sign in. Please try again.',
    );
  }

  return GoogleAuthProvider.credential(idToken: idToken);
}

AppleAuthProvider _appleAuthProvider() => AppleAuthProvider()
  ..addScope('email')
  ..addScope('name');

Future<UserCredential> _directSignInWithApple() {
  final provider = _appleAuthProvider();
  return kIsWeb
      ? FirebaseAuth.instance.signInWithPopup(provider)
      : FirebaseAuth.instance.signInWithProvider(provider);
}

Future<UserCredential> _linkCredentialToVerifiedAccount({
  required UserCredential verifiedAccount,
  required AuthCredential pendingCredential,
  required String expectedEmail,
}) async {
  final user = verifiedAccount.user;
  if (user == null) {
    throw const _AuthIntegrityException(
      'The existing account could not be verified. No accounts were linked.',
    );
  }

  final verifiedEmail = user.email?.trim().toLowerCase();
  final normalizedExpected = expectedEmail.trim().toLowerCase();
  if (!user.emailVerified ||
      !normalizedExpected.contains('@') ||
      verifiedEmail != normalizedExpected) {
    await _forgetAuthenticatedUser();
    await FirebaseAuth.instance.signOut();
    throw const _AuthIntegrityException(
      'The verified account uses a different email address. For your security, no accounts were linked.',
    );
  }

  try {
    return await user.linkWithCredential(pendingCredential);
  } on FirebaseAuthException catch (error) {
    if (error.code == 'provider-already-linked') return verifiedAccount;
    await _forgetAuthenticatedUser();
    await FirebaseAuth.instance.signOut();
    if (error.code == 'credential-already-in-use') {
      throw const _AuthIntegrityException(
        'These sign-ins are already attached to separate Guru Vandan accounts. No data was changed. Contact support before attempting to merge them.',
      );
    }
    rethrow;
  } catch (_) {
    await _forgetAuthenticatedUser();
    await FirebaseAuth.instance.signOut();
    rethrow;
  }
}

Future<UserCredential> _signInToFirebaseWithApple({
  _ConfirmAccountLink? confirmAccountLink,
}) async {
  try {
    return await _directSignInWithApple();
  } on FirebaseAuthException catch (error) {
    if (!_isAccountProviderConflict(error)) rethrow;

    final pendingAppleCredential = error.credential;
    if (pendingAppleCredential == null || confirmAccountLink == null) {
      throw const _AuthIntegrityException(
        'This email already belongs to another sign-in method, but the secure Apple credential could not be linked. No account was created.',
      );
    }

    final email = _accountLinkEmail(error);
    if (email == null) {
      throw const _AuthIntegrityException(
        'The existing account email could not be securely verified. No accounts were linked.',
      );
    }
    final confirmed = await confirmAccountLink('Google', email);
    if (!confirmed) throw const _AuthFlowCanceled();

    final verifiedGoogleAccount = await FirebaseAuth.instance
        .signInWithCredential(await _googleFirebaseCredential());
    return _linkCredentialToVerifiedAccount(
      verifiedAccount: verifiedGoogleAccount,
      pendingCredential: pendingAppleCredential,
      expectedEmail: email,
    );
  }
}

Future<UserCredential> _signInToFirebaseWithGoogle({
  _ConfirmAccountLink? confirmAccountLink,
}) async {
  final provider = GoogleAuthProvider()
    ..addScope('email')
    ..addScope('profile');

  if (kIsWeb) {
    try {
      return await FirebaseAuth.instance.signInWithPopup(provider);
    } on FirebaseAuthException catch (error) {
      if (!_shouldFallbackToRedirect(error.code)) rethrow;
      await FirebaseAuth.instance.signInWithRedirect(provider);
      throw FirebaseAuthException(
        code: 'redirect-started',
        message: 'Google sign-in redirect started.',
      );
    }
  }

  final pendingGoogleCredential = await _googleFirebaseCredential();
  try {
    return await FirebaseAuth.instance
        .signInWithCredential(pendingGoogleCredential);
  } on FirebaseAuthException catch (error) {
    if (!_isAccountProviderConflict(error) ||
        !_appleSignInAvailable ||
        confirmAccountLink == null) {
      rethrow;
    }

    final email = _accountLinkEmail(error);
    if (email == null) {
      throw const _AuthIntegrityException(
        'The existing account email could not be securely verified. No accounts were linked.',
      );
    }
    final confirmed = await confirmAccountLink('Apple', email);
    if (!confirmed) throw const _AuthFlowCanceled();

    final verifiedAppleAccount = await _directSignInWithApple();
    return _linkCredentialToVerifiedAccount(
      verifiedAccount: verifiedAppleAccount,
      pendingCredential: error.credential ?? pendingGoogleCredential,
      expectedEmail: email,
    );
  }
}

Future<void> _signOutFromGoogleProvider() async {
  if (kIsWeb) return;
  try {
    await _ensureGoogleSignInReady();
    await GoogleSignIn.instance.signOut();
  } catch (_) {
    // Firebase sign-out below is still the source of truth for app access.
  }
}

class _DeletionAuthorization {
  const _DeletionAuthorization({
    required this.hasGoogleProvider,
    this.appleAuthorizationCode,
  });

  final bool hasGoogleProvider;
  final String? appleAuthorizationCode;
}

Future<_DeletionAuthorization> _reauthenticateForAccountDeletion(
  User user,
) async {
  final providerIds =
      user.providerData.map((provider) => provider.providerId).toSet();
  final hasApple = providerIds.contains(AppleAuthProvider.PROVIDER_ID);
  final hasGoogle = providerIds.contains(GoogleAuthProvider.PROVIDER_ID);

  if (hasApple) {
    if (!_appleSignInAvailable) {
      throw const _AuthIntegrityException(
        'Open Guru Vandan on an Apple device to securely verify and delete this Apple-linked account.',
      );
    }

    final result = await user.reauthenticateWithProvider(_appleAuthProvider());
    final authorizationCode =
        result.additionalUserInfo?.authorizationCode?.trim();
    if (authorizationCode == null || authorizationCode.isEmpty) {
      throw const _AuthIntegrityException(
        'Apple verification did not return the authorization needed to revoke app access. Nothing was deleted; please try again.',
      );
    }

    return _DeletionAuthorization(
      hasGoogleProvider: hasGoogle,
      appleAuthorizationCode: authorizationCode,
    );
  }

  if (hasGoogle) {
    if (kIsWeb) {
      final provider = GoogleAuthProvider()
        ..addScope('email')
        ..addScope('profile');
      await user.reauthenticateWithPopup(provider);
    } else {
      await user.reauthenticateWithCredential(
        await _googleFirebaseCredential(),
      );
    }
    return const _DeletionAuthorization(hasGoogleProvider: true);
  }

  throw const _AuthIntegrityException(
    'This account has no supported sign-in provider for secure deletion. Sign out and contact Guru Vandan support.',
  );
}

String _friendlyGoogleSignInMessage(
  AppLanguage language,
  GoogleSignInException error,
  String fallbackEnglish,
  String fallbackHindi,
) {
  String localized(String english, String hindi) =>
      language == AppLanguage.hindi ? hindi : english;

  switch (error.code) {
    case GoogleSignInExceptionCode.canceled:
    case GoogleSignInExceptionCode.interrupted:
      return localized(
        'Google sign-in was closed before completion. Please begin again.',
        'Google प्रवेश पूर्ण होने से पूर्व समाप्त हो गया। कृपया पुनः आरंभ करें।',
      );
    case GoogleSignInExceptionCode.clientConfigurationError:
    case GoogleSignInExceptionCode.providerConfigurationError:
      final detail = (error.description ?? '').trim();
      return detail.isEmpty
          ? '${localized(fallbackEnglish, fallbackHindi)} [google-configuration]'
          : '${localized(fallbackEnglish, fallbackHindi)} [$detail]';
    default:
      final detail = (error.description ?? error.code.name).trim();
      return '${localized(fallbackEnglish, fallbackHindi)} [$detail]';
  }
}

Future<String> _friendlyDiagnosedGoogleSignInMessage({
  required AppLanguage language,
  required GoogleSignInException error,
  required String fallbackEnglish,
  required String fallbackHindi,
}) async {
  final message = _friendlyGoogleSignInMessage(
    language,
    error,
    fallbackEnglish,
    fallbackHindi,
  );
  if (!_isCertificateHashFailure(
    error.code.name,
    error.description,
    message,
  )) {
    return message;
  }
  return _withAndroidSignatureDiagnostic(message);
}

String _friendlyAuthMessage(
  AppLanguage language,
  FirebaseAuthException error,
  String fallbackEnglish,
  String fallbackHindi,
) {
  String localized(String english, String hindi) =>
      language == AppLanguage.hindi ? hindi : english;

  switch (error.code) {
    case 'operation-not-allowed':
      return localized(
        'This entrance method is not enabled. Please contact the Guru Vandan administrator.',
        'यह प्रवेश-विधि अभी सक्रिय नहीं है। कृपया गुरु वंदन प्रशासक से संपर्क करें।',
      );
    case 'unauthorized-domain':
      return localized(
        'This website is not authorized for sign-in. Please contact the Guru Vandan administrator.',
        'यह जालस्थल प्रवेश हेतु अधिकृत नहीं है। कृपया गुरु वंदन प्रशासक से संपर्क करें।',
      );
    case 'popup-closed-by-user':
    case 'cancelled-popup-request':
      return localized(
        'Google sign-in was closed before completion. Please begin again.',
        'Google प्रवेश पूर्ण होने से पूर्व समाप्त हो गया। कृपया पुनः आरंभ करें।',
      );
    case 'network-request-failed':
      return localized(
        'The connection was interrupted during sign-in. Please check your internet and begin again.',
        'प्रवेश के समय संचार-संपर्क बाधित हुआ। अंतर्जाल संपर्क जाँचकर पुनः आरंभ करें।',
      );
    case 'invalid-phone-number':
      return localized(
        'Enter a valid phone number with its country code, for example +91 98765 43210.',
        'देश-कूट सहित मान्य दूरभाष क्रमांक अंकित करें, जैसे +91 98765 43210।',
      );
    case 'invalid-verification-code':
      return localized(
        'The OTP is incorrect. Please check it and try again.',
        'एकबारगी कूट (OTP) अशुद्ध है। उसे जाँचकर पुनः प्रयास करें।',
      );
    case 'too-many-requests':
      return localized(
        'Too many attempts were made. Please pause for a while before trying again.',
        'अत्यधिक प्रयास किए गए हैं। कुछ समय प्रतीक्षा कर पुनः प्रयास करें।',
      );
    default:
      return '${localized(fallbackEnglish, fallbackHindi)} [${error.code}]';
  }
}

Future<String> _friendlyDiagnosedAuthMessage({
  required AppLanguage language,
  required FirebaseAuthException error,
  required String fallbackEnglish,
  required String fallbackHindi,
}) async {
  final message = _friendlyAuthMessage(
    language,
    error,
    fallbackEnglish,
    fallbackHindi,
  );
  if (!_isCertificateHashFailure(error.code, error.message, message)) {
    return message;
  }
  return _withAndroidSignatureDiagnostic(message);
}

bool _isCertificateHashFailure(
  String code,
  String? description,
  String message,
) {
  final haystack = '$code ${description ?? ''} $message'.toLowerCase();
  return haystack.contains('invalid-cert-hash') ||
      haystack.contains('certificate') && haystack.contains('hash');
}

Future<String> _withAndroidSignatureDiagnostic(String message) async {
  final diagnostic = await _androidSignatureDiagnostic();
  if (diagnostic == null || diagnostic.isEmpty) return message;
  return '$message\n\n$diagnostic';
}

Future<String?> _androidSignatureDiagnostic() async {
  if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) return null;
  try {
    final details = await _androidDiagnosticsChannel
        .invokeMapMethod<String, Object?>('appSignatureInfo');
    if (details == null) return null;

    final versionName = details['versionName']?.toString().trim();
    final versionCode = details['versionCode']?.toString().trim();
    final packageName = details['packageName']?.toString().trim();
    final sha1 = details['sha1']?.toString().trim();
    final sha256 = details['sha256']?.toString().trim();

    return [
      'Installed app check:',
      if (packageName != null && packageName.isNotEmpty)
        'Package: $packageName',
      if (versionName != null && versionName.isNotEmpty)
        'Version: $versionName${versionCode == null || versionCode.isEmpty ? '' : '+$versionCode'}',
      if (sha1 != null && sha1.isNotEmpty) 'SHA-1: $sha1',
      if (sha256 != null && sha256.isNotEmpty) 'SHA-256: $sha256',
    ].join('\n');
  } catch (_) {
    return null;
  }
}

bool _shouldFallbackToRedirect(String code) {
  return code == 'popup-blocked' ||
      code == 'popup-closed-by-user' ||
      code == 'cancelled-popup-request' ||
      code == 'web-context-cancelled' ||
      code == 'internal-error';
}
