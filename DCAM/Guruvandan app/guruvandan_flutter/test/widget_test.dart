import 'dart:async';
import 'dart:convert';

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:guruvandan_flutter/main.dart';

void main() {
  String dateKey(DateTime date) {
    final month = date.month.toString().padLeft(2, '0');
    final day = date.day.toString().padLeft(2, '0');
    return '${date.year}-$month-$day';
  }

  Future<void> pumpSavedHome(WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({
      'guruvandan_flutter:name': 'Ajay Bhatnagar',
      'guruvandan_flutter:language': 'english',
    });

    await tester.pumpWidget(
        const GuruvandanApp(firebaseReady: false, showOpening: false));
    await tester.pumpAndSettle();

    await tester.tap(find.textContaining('Enter'));
    await tester.pumpAndSettle();
  }

  testWidgets('First launch asks for language before profile',
      (WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({});

    await tester.pumpWidget(
        const GuruvandanApp(firebaseReady: false, showOpening: false));
    await tester.pumpAndSettle();

    expect(find.text('Choose the language of your journey'), findsOneWidget);
    expect(find.text('अपने साधना-पथ की भाषा चुनें'), findsOneWidget);
    expect(find.text('English'), findsOneWidget);
    expect(find.text('हिन्दी'), findsOneWidget);
    expect(find.text('Welcome to Guru Vandan'), findsNothing);

    await tester.tap(find.text('English'));
    await tester.pumpAndSettle();

    expect(find.text('Welcome to Guru Vandan'), findsOneWidget);
    expect(find.text('First name'), findsOneWidget);
    expect(find.text('Middle name'), findsOneWidget);
    expect(find.text('Last name'), findsOneWidget);
    expect(find.text('Today\'s Sacred Practice'), findsNothing);
  });

  testWidgets('Opening copy stays above the temple on compact devices',
      (tester) async {
    SharedPreferences.setMockInitialValues({
      'guruvandan_flutter:language': 'english',
    });
    for (final size in const [
      Size(320, 480),
      Size(360, 640),
      Size(430, 932),
      Size(900, 1600),
    ]) {
      await tester.binding.setSurfaceSize(size);
      await tester.pumpWidget(GuruvandanApp(
        key: ValueKey('opening-${size.width}-${size.height}'),
        firebaseReady: false,
        showOpening: true,
      ));
      await tester.pump(const Duration(milliseconds: 900));

      final subtitle = find.text('Remembrance. Satsang. Meditation.');
      expect(subtitle, findsOneWidget);
      expect(tester.getBottomRight(subtitle).dy, lessThan(size.height * 0.60));
      expect(tester.takeException(), isNull);
      await tester.pump(const Duration(seconds: 3));
    }
    await tester.binding.setSurfaceSize(null);
  });

  test('Firebase quote records normalize legacy author names', () {
    final quote = WisdomQuote.fromEntry('quote-id', {
      'textEnglish': 'Meditation brings clarity.',
      'textHindi': 'ध्यान स्पष्टता लाता है।',
      'authorEnglish': 'Sadguru Maharaj',
      'authorHindi': 'सद्गुरु महाराज',
      'createdAt': 1234,
    });

    expect(quote.text, 'Meditation brings clarity.');
    expect(quote.textHindi, 'ध्यान स्पष्टता लाता है।');
    expect(quote.author, 'Maharshi Mehi Paramhans');
    expect(quote.authorHindi, 'महर्षि मेँहीँ परमहंस');
    expect(quote.createdAt, 1234);
  });

  test('Firebase quote parser keeps every uploaded quote newest first', () {
    final firebaseValue = {
      for (var index = 1; index <= 20; index++)
        'quote-$index': {
          'textEnglish': 'Sacred quote $index',
          'textHindi': 'Pavan vachan $index',
          'authorEnglish': 'Sadguru Maharaj',
          'authorHindi': 'Sadguru Maharaj',
          'active': true,
          'createdAt': index,
        },
    };

    final quotes = wisdomQuotesFromFirebaseValue(
      firebaseValue,
      includeInactive: false,
      includeFallback: false,
    );

    expect(quotes, hasLength(20));
    expect(quotes.first.text, 'Sacred quote 20');
    expect(quotes.last.text, 'Sacred quote 1');
  });

  test('Quote service caches once per session and refreshes only on request',
      () async {
    var loadCount = 0;
    final remoteQuotes = List.generate(
      11,
      (index) => WisdomQuote(
        id: 'remote-$index',
        text: 'Remote quote $index',
        createdAt: index,
      ),
    );
    final service = FirebaseContentService(
      true,
      quoteLoader: () async {
        loadCount++;
        return remoteQuotes;
      },
    );
    addTearDown(service.dispose);

    final firstVisit = await service.quotes().first;
    final secondVisit = await service.quotes().first;

    expect(firstVisit, hasLength(11));
    expect(secondVisit, hasLength(11));
    expect(loadCount, 1);

    await service.refreshQuotes();
    final afterRefresh = await service.quotes().first;

    expect(afterRefresh, hasLength(11));
    expect(loadCount, 2);
  });

  test('Manual quote refresh fetches again during the startup load', () async {
    final firstLoad = Completer<List<WisdomQuote>>();
    var loadCount = 0;
    final service = FirebaseContentService(
      true,
      quoteLoader: () {
        loadCount++;
        if (loadCount == 1) return firstLoad.future;
        return Future.value(const [
          WisdomQuote(id: 'fresh', text: 'Fresh quote'),
        ]);
      },
    );
    addTearDown(service.dispose);

    final iterator = StreamIterator(service.quotes());
    final initialMove = iterator.moveNext();
    await Future<void>.delayed(Duration.zero);
    final refresh = service.refreshQuotes();
    firstLoad.complete(const [
      WisdomQuote(id: 'old', text: 'Old quote'),
    ]);

    expect(await initialMove, isTrue);
    expect(iterator.current.single.id, 'old');
    await refresh;
    expect(loadCount, 2);
    expect(await iterator.moveNext(), isTrue);
    expect(iterator.current.single.id, 'fresh');
    await iterator.cancel();
  });

  test('Quote queue advances one quote per calendar day', () {
    const quotes = [
      WisdomQuote(id: 'oldest', text: 'First', createdAt: 1),
      WisdomQuote(id: 'middle', text: 'Second', createdAt: 2),
      WisdomQuote(id: 'newest', text: 'Third', createdAt: 3),
    ];

    final firstDay = quoteTimelineForDate(
      quotes,
      now: DateTime(2026, 9, 24),
    );
    final secondDay = quoteTimelineForDate(
      quotes,
      now: DateTime(2026, 9, 25),
    );

    expect(firstDay.daily?.id, 'newest');
    expect(firstDay.archive, isEmpty);
    expect(firstDay.upcoming.map((quote) => quote.id), ['middle', 'oldest']);
    expect(secondDay.daily?.id, 'middle');
    expect(secondDay.archive.map((quote) => quote.id), ['newest']);
    expect(secondDay.upcoming.map((quote) => quote.id), ['oldest']);
    expect(nextQuoteScheduleDate(quotes, now: DateTime(2026, 9, 24)),
        DateTime(2026, 9, 27));
  });

  test('Quotes scheduled before day zero restart from today', () {
    const quotes = [
      WisdomQuote(
        id: 'older-upload',
        text: 'First uploaded quote',
        createdAt: 1,
        scheduledDate: '2026-09-13',
      ),
      WisdomQuote(
        id: 'newer-upload',
        text: 'Second uploaded quote',
        createdAt: 2,
        scheduledDate: '2026-09-14',
      ),
    ];

    final today = quoteTimelineForDate(quotes, now: DateTime(2026, 9, 24));
    final tomorrow = quoteTimelineForDate(quotes, now: DateTime(2026, 9, 25));

    expect(today.daily?.id, 'newer-upload');
    expect(today.archive, isEmpty);
    expect(today.upcoming.single.id, 'older-upload');
    expect(tomorrow.daily?.id, 'older-upload');
  });

  test('Sacred history combines routine records with timed activity', () {
    final date = DateTime(2026, 9, 24);
    final history = sacredActivityHistory(
      records: {
        dateKey(date): {
          'morningSatsang': true,
          'meditation': true,
        },
      },
      events: [
        DevoteeActivityEvent(
          id: 'morning',
          type: 'satsang_listened',
          timestamp: date.add(const Duration(hours: 7)).millisecondsSinceEpoch,
          label: 'morning: Astuti',
          durationSeconds: 600,
          completed: true,
        ),
        DevoteeActivityEvent(
          id: 'meditation',
          type: 'meditation_session',
          timestamp: date.add(const Duration(hours: 8)).millisecondsSinceEpoch,
          durationSeconds: 900,
          completed: true,
        ),
      ],
    );

    final day = history[dateKey(date)]!;
    expect(day.morningSatsang, isTrue);
    expect(day.eveningSatsang, isFalse);
    expect(day.meditation, isTrue);
    expect(day.morningSatsangSeconds, 600);
    expect(day.meditationSeconds, 900);
  });

  test('Sacred streak selects the strongest current and longest activity', () {
    final history = sacredActivityHistory(
      records: {
        '2026-09-21': {'meditation': true},
        '2026-09-22': {'meditation': true, 'morningSatsang': true},
        '2026-09-23': {'meditation': true, 'morningSatsang': true},
        '2026-09-24': {'meditation': true, 'morningSatsang': true},
      },
      events: const [],
    );

    final overview = sacredStreakOverviewFor(
      history: history,
      accountCreatedAt: DateTime(2026, 9, 21),
      now: DateTime(2026, 9, 24),
    );

    expect(overview.current.length, 4);
    expect(overview.current.kind, SacredStreakKind.meditation);
    expect(overview.longest.length, 4);
    expect(overview.longest.start, DateTime(2026, 9, 21));
    expect(overview.longest.end, DateTime(2026, 9, 24));
  });

  test('Streak analytics compares individual and combined practices', () {
    final history = sacredActivityHistory(
      records: {
        '2026-09-20': {
          'morningSatsang': true,
          'eveningSatsang': true,
          'meditation': true,
        },
        '2026-09-21': {
          'morningSatsang': true,
          'eveningSatsang': true,
          'meditation': true,
        },
        '2026-09-22': {
          'morningSatsang': true,
          'meditation': true,
        },
      },
      events: const [],
    );

    expect(
      sacredActivityDaysForKind(history, SacredStreakKind.meditation),
      3,
    );
    expect(
      sacredActivityDaysForKind(history, SacredStreakKind.fullPractice),
      2,
    );
    expect(
      sacredLongestStreakForKind(
        history: history,
        accountCreatedAt: DateTime(2026, 9, 20),
        kind: SacredStreakKind.fullPractice,
        now: DateTime(2026, 9, 24),
      ).length,
      2,
    );
  });

  testWidgets('Quote links identify the exact quote on web and in the app',
      (tester) async {
    late BuildContext context;
    await tester.pumpWidget(
      MaterialApp(
        home: LanguageScope(
          language: AppLanguage.english,
          onChanged: (_) {},
          child: Builder(
            builder: (value) {
              context = value;
              return const SizedBox();
            },
          ),
        ),
      ),
    );
    const quote = WisdomQuote(id: 'firebase-quote-1', text: 'A quote');
    expect(
      wisdomQuoteShareLink(quote),
      'https://guruvandan.com/quote/firebase-quote-1/',
    );
    final shareText = wisdomQuoteShareText(context, quote);
    expect(shareText, contains(quote.text));
    expect(shareText, contains(quote.author));
    expect(shareText, contains(wisdomQuoteShareLink(quote)));
    expect(
      quoteIdFromUri(Uri.parse('guruvandan://quote/firebase-quote-1')),
      'firebase-quote-1',
    );
    expect(
      quoteIdFromUri(Uri.parse(wisdomQuoteShareLink(quote))),
      'firebase-quote-1',
    );
  });

  test('Legacy Android user names are recognized as existing profiles', () {
    final profile = DevoteeProfile.fromMap({
      'name': 'Ravi Kumar',
      'email': 'ravi@example.com',
      'isProfileComplete': true,
    });

    expect(profile, isNotNull);
    expect(profile!.firstName, 'Ravi');
    expect(profile.lastName, 'Kumar');
    expect(profile.fullName, 'Ravi Kumar');
  });

  test('Apple identity creates a profile without separate name onboarding', () {
    final profile = profileForAuthenticatedProvider(
      providerIds: const ['apple.com'],
      displayName: 'Ajay Kumar Bhatnagar',
    );

    expect(profile, isNotNull);
    expect(profile!.firstName, 'Ajay');
    expect(profile.middleName, 'Kumar');
    expect(profile.lastName, 'Bhatnagar');
  });

  test('Returning Apple user without a shared name is not blocked', () {
    final profile = profileForAuthenticatedProvider(
      providerIds: const ['apple.com'],
    );

    expect(profile, isNotNull);
    expect(profile!.displayName, 'Devotee');
  });

  test('Non-Apple identity does not bypass normal profile onboarding', () {
    final profile = profileForAuthenticatedProvider(
      providerIds: const ['google.com'],
      displayName: 'Ajay Bhatnagar',
    );

    expect(profile, isNull);
  });

  test('Cloud user activity is parsed into meditation statistics', () {
    final now = DateTime.now();
    final yesterday = now.subtract(const Duration(days: 1));
    final activity = DevoteeActivity.fromEntry('uid-1', {
      'name': 'Ravi Kumar',
      'email': 'ravi@example.com',
      'routine': {
        dateKey(now): {
          'meditation': true,
          'morningSatsang': true,
        },
        dateKey(yesterday): {'meditation': true},
      },
    });

    expect(activity.name, 'Ravi Kumar');
    expect(activity.meditationStats.current, 2);
    expect(activity.meditationStats.total, 2);
    expect(activity.count(RoutineTask.morningSatsang), 1);
  });

  test('Detailed activity parses playback time and quote engagement', () {
    final activity = DevoteeActivity.fromEntry('uid-analytics', {
      'name': 'Meera',
      'activity': {
        'event-1': {
          'type': 'satsang_listened',
          'timestamp': 1700000000000,
          'durationSeconds': 620,
          'label': 'Morning satsang',
        },
        'event-2': {
          'type': 'meditation_session',
          'timestamp': 1700000060000,
          'durationSeconds': 300,
          'plannedDurationSeconds': 300,
          'completed': true,
        },
        'event-3': {
          'type': 'quote_shared',
          'timestamp': 1700000120000,
          'contentId': 'quote-1',
        },
      },
      'likedQuotes': {'quote-1': true, 'quote-2': false},
    });

    expect(activity.events, hasLength(3));
    expect(activity.satsangSeconds, 620);
    expect(activity.meditationSeconds, 300);
    expect(activity.quoteShares, 1);
    expect(activity.quoteLikes, 1);
    expect(activity.events.first.type, 'quote_shared');
  });

  test('Admin user search matches devotee name and email', () {
    final users = [
      DevoteeActivity.fromEntry('uid-ajay', {
        'name': 'Ajay Bhatnagar',
        'email': 'ajay@example.com',
        'createdAt': DateTime(2026, 9, 1).millisecondsSinceEpoch,
      }),
      DevoteeActivity.fromEntry('uid-meera', {
        'name': 'Meera Devi',
        'email': 'meera@example.com',
      }),
    ];

    expect(filterDevoteeActivities(users, 'AJAY').single.uid, 'uid-ajay');
    expect(
      filterDevoteeActivities(users, 'meera@example.com').single.uid,
      'uid-meera',
    );
    expect(
      users.first.accountCreatedOn,
      DateTime(2026, 9, 1),
    );
  });

  test('Activity durations use compact admin labels', () {
    expect(formatActivityDuration(42), '42s');
    expect(formatActivityDuration(300), '5m');
    expect(formatActivityDuration(3900), '1h 5m');
  });

  test('Meditation presets validate values and default in ascending order', () {
    expect(
      normalizeMeditationPresetMinutes(
        const ['30', '5', '5', '0', '1440', 'invalid'],
      ),
      const [30, 5],
    );
    expect(
      normalizeMeditationPresetMinutes(null, useDefaultsWhenEmpty: true),
      defaultMeditationPresetMinutes,
    );
  });

  test('Meditation presets can be rearranged by dragging', () {
    expect(
      reorderMeditationPresetMinutes(const [5, 10, 15], 15, 5),
      const [15, 10, 5],
    );
  });

  test('Remembered login remains active without automatic provider login', () {
    expect(
      shouldUseRememberedAuthSession(
        startupComplete: true,
        authStreamReady: true,
        hasAuthenticatedUser: false,
        hasRememberedSession: true,
        hasObservedAuthenticatedUser: false,
      ),
      isTrue,
    );
    expect(
      shouldUseRememberedAuthSession(
        startupComplete: true,
        authStreamReady: true,
        hasAuthenticatedUser: false,
        hasRememberedSession: false,
        hasObservedAuthenticatedUser: false,
      ),
      isFalse,
    );
    expect(
      shouldUseRememberedAuthSession(
        startupComplete: false,
        authStreamReady: true,
        hasAuthenticatedUser: false,
        hasRememberedSession: true,
        hasObservedAuthenticatedUser: false,
      ),
      isFalse,
    );
    expect(
      shouldUseRememberedAuthSession(
        startupComplete: true,
        authStreamReady: true,
        hasAuthenticatedUser: false,
        hasRememberedSession: true,
        hasObservedAuthenticatedUser: true,
      ),
      isFalse,
      reason: 'A real session that signed out must not fall back to Home.',
    );
  });

  test('Existing account profile migrates to remembered login', () {
    expect(
      legacyAuthenticatedUidFromPreferenceKeys({
        'guruvandan_flutter:language',
        'guruvandan_flutter:name:firebase-user-123',
      }),
      'firebase-user-123',
    );
    expect(
      legacyAuthenticatedUidFromPreferenceKeys({
        'guruvandan_flutter:name',
        'guruvandan_flutter:routine',
      }),
      isNull,
    );
  });

  testWidgets('Guru Vandan home renders with first name', (tester) async {
    SharedPreferences.setMockInitialValues({
      'guruvandan_flutter:name': 'Ajay Bhatnagar',
      'guruvandan_flutter:language': 'english',
    });

    await tester.pumpWidget(
        const GuruvandanApp(firebaseReady: false, showOpening: false));
    await tester.pumpAndSettle();

    expect(find.text('Guru Vandan'), findsWidgets);
    expect(find.text('Jai Guru, Ajay!'), findsOneWidget);
    expect(find.textContaining('Ajay'), findsWidgets);
    expect(find.textContaining('Bhatnagar'), findsNothing);
    expect(find.text('Today\'s Sacred Practice'), findsOneWidget);
    expect(find.text('Yesterday'), findsNothing);

    final practiceTop =
        tester.getTopLeft(find.text('Today\'s Sacred Practice'));
    final streakTop = tester.getTopLeft(
      find.byKey(const Key('sacred-streak-current')),
    );
    expect(practiceTop.dy, lessThan(streakTop.dy));
    expect(find.byKey(const Key('sacred-activity-calendar')), findsOneWidget);
  });

  testWidgets('Completed practice shows only the leading tick', (tester) async {
    SharedPreferences.setMockInitialValues({
      'guruvandan_flutter:name': 'Ajay Bhatnagar',
      'guruvandan_flutter:language': 'english',
      'guruvandan_flutter:routine': jsonEncode({
        dateKey(DateTime.now()): {'meditation': true},
      }),
    });

    await tester.pumpWidget(
        const GuruvandanApp(firebaseReady: false, showOpening: false));
    await tester.pumpAndSettle();
    await tester.tap(find.textContaining('Enter'));
    await tester.pumpAndSettle();

    final meditationTile = find.byKey(
      const Key('routine-tile-Meditation'),
    );
    expect(meditationTile, findsOneWidget);
    expect(
      find.descendant(
        of: meditationTile,
        matching: find.byIcon(Icons.check_rounded),
      ),
      findsOneWidget,
    );
    expect(
      find.descendant(
        of: meditationTile,
        matching: find.byIcon(Icons.verified_rounded),
      ),
      findsNothing,
    );
    expect(
      find.descendant(
        of: meditationTile,
        matching: find.byIcon(Icons.chevron_right_rounded),
      ),
      findsNothing,
    );
  });

  testWidgets('Home introductions expand only when tapped', (tester) async {
    await tester.binding.setSurfaceSize(const Size(900, 1600));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await pumpSavedHome(tester);

    const heading = 'ABOUT GURU MAHARAJ';
    const introduction =
        'Sadguru Maharshi Mehi Paramhans was one of the most respected saints and spiritual masters of the Sant Mat tradition in India. Born in Bihar, he dedicated his life to spreading the message of inner meditation, self-realization, universal love, and peace. He emphasized the practice of Surat Shabd Yoga and taught that true spirituality lies beyond caste, religion, and social divisions.\n\nThrough his profound writings, discourses, and compassionate guidance, he inspired millions of devotees to walk the path of devotion, simplicity, morality, and spiritual awakening. His teachings continue to guide seekers toward inner harmony and realization of the Divine within every soul.';

    await tester.ensureVisible(find.text(heading));
    await tester.pumpAndSettle();
    expect(find.text(introduction), findsNothing);

    await tester.tap(find.text(heading));
    await tester.pumpAndSettle();
    expect(find.text(introduction), findsOneWidget);

    await tester.tap(find.text(heading));
    await tester.pumpAndSettle();
    expect(find.text(introduction), findsNothing);

    const guruVandanHeading = 'ABOUT GURU VANDAN';
    const guruVandanIntroduction =
        'A sacred space for daily spiritual practice — satsang, meditation, Sadguru\'s wisdom and community of devotees, all in one place. Jai Guru.';
    await tester.ensureVisible(find.text(guruVandanHeading));
    await tester.tap(find.text(guruVandanHeading));
    await tester.pumpAndSettle();
    expect(find.text(guruVandanIntroduction), findsOneWidget);
  });

  testWidgets('Admin route opens the dedicated email and password entrance',
      (tester) async {
    SharedPreferences.setMockInitialValues({
      'guruvandan_flutter:name': 'Ajay Bhatnagar',
      'guruvandan_flutter:language': 'english',
    });

    await tester.pumpWidget(
      const GuruvandanApp(firebaseReady: false, showOpening: false),
    );
    await tester.pumpAndSettle();
    final navigator = tester.state<NavigatorState>(find.byType(Navigator));
    navigator.pushNamed('/admin');
    await tester.pumpAndSettle();

    expect(find.text('Admin Entrance'), findsOneWidget);
    expect(find.text('Admin email'), findsOneWidget);
    expect(find.text('Password'), findsOneWidget);
    expect(find.text('guruvandan11@trustkeyper.com'), findsOneWidget);
  });

  testWidgets('Streak actions stay compact and summarize sacred activity',
      (tester) async {
    final now = DateTime.now();
    final yesterday = now.subtract(const Duration(days: 1));
    final olderMeditation = now.subtract(const Duration(days: 5));
    final satsangOnly = now.subtract(const Duration(days: 4));

    SharedPreferences.setMockInitialValues({
      'guruvandan_flutter:name': 'Ajay Bhatnagar',
      'guruvandan_flutter:language': 'english',
      'guruvandan_flutter:routine': jsonEncode({
        dateKey(now): {'meditation': true},
        dateKey(yesterday): {'meditation': true},
        dateKey(olderMeditation): {'meditation': true},
        dateKey(satsangOnly): {
          'morningSatsang': true,
          'eveningSatsang': true,
        },
      }),
    });

    await tester.pumpWidget(
        const GuruvandanApp(firebaseReady: false, showOpening: false));
    await tester.pumpAndSettle();

    final current = tester.widget<Text>(
      find.byKey(const Key('sacred-streak-current')),
    );
    final best = tester.widget<Text>(
      find.byKey(const Key('sacred-streak-longest')),
    );

    expect(current.data, '2');
    expect(best.data, '2');
    expect(find.text('Current'), findsOneWidget);
    expect(find.text('Longest'), findsOneWidget);
    expect(find.byKey(const Key('sacred-activity-calendar')), findsOneWidget);
    expect(find.text('Continuity of meditation'), findsNothing);
    expect(find.text('Yesterday'), findsNothing);
  });

  testWidgets('Activity calendar shows daily satsang and meditation time',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(900, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final yesterday = today.subtract(const Duration(days: 1));
    SharedPreferences.setMockInitialValues({
      'guruvandan_flutter:name': 'Ajay Bhatnagar',
      'guruvandan_flutter:language': 'english',
      'guruvandan_flutter:account_created_at': yesterday.millisecondsSinceEpoch,
      'guruvandan_flutter:routine': jsonEncode({
        dateKey(today): {
          'morningSatsang': true,
          'meditation': true,
        },
      }),
      'guruvandan_flutter:activity': jsonEncode({
        'morning': {
          'type': 'satsang_listened',
          'timestamp':
              today.add(const Duration(hours: 7)).millisecondsSinceEpoch,
          'label': 'morning: Astuti',
          'durationSeconds': 600,
          'completed': true,
        },
        'meditation': {
          'type': 'meditation_session',
          'timestamp':
              today.add(const Duration(hours: 8)).millisecondsSinceEpoch,
          'durationSeconds': 900,
          'completed': true,
        },
      }),
    });

    await tester.pumpWidget(
      const GuruvandanApp(firebaseReady: false, showOpening: false),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Enter'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(
      find.byKey(const Key('sacred-activity-calendar')),
    );
    await tester.tap(find.byKey(const Key('sacred-activity-calendar')));
    await tester.pumpAndSettle();

    final calendar = tester.widget<CalendarDatePicker>(
      find.byType(CalendarDatePicker),
    );
    calendar.onDateChanged(today);
    await tester.pumpAndSettle();

    final details = find.byType(AlertDialog);
    expect(
      find.descendant(of: details, matching: find.text('Morning')),
      findsOneWidget,
    );
    expect(find.descendant(of: details, matching: find.text('10m')),
        findsOneWidget);
    expect(
      find.descendant(of: details, matching: find.text('Meditation')),
      findsOneWidget,
    );
    expect(find.descendant(of: details, matching: find.text('15m')),
        findsOneWidget);
  });

  testWidgets('Hindi streak controls use compact labels and Hindi calendar',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(900, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final now = DateTime.now();
    SharedPreferences.setMockInitialValues({
      'guruvandan_flutter:name': 'Ajay Bhatnagar',
      'guruvandan_flutter:language': 'hindi',
      'guruvandan_flutter:routine': jsonEncode({
        dateKey(now): {'meditation': true},
        dateKey(now.subtract(const Duration(days: 1))): {
          'meditation': true,
        },
      }),
    });

    await tester.pumpWidget(
      const GuruvandanApp(firebaseReady: false, showOpening: false),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('प्रवेश'));
    await tester.pumpAndSettle();

    expect(find.text('वर्तमान'), findsOneWidget);
    expect(find.text('दीर्घतम'), findsOneWidget);
    expect(
      tester.widget<Text>(find.byKey(const Key('sacred-streak-current'))).data,
      '२',
    );
    await tester.ensureVisible(
      find.byKey(const Key('sacred-activity-calendar')),
    );
    await tester.tap(find.byKey(const Key('sacred-activity-calendar')));
    await tester.pumpAndSettle();

    final calendarContext = tester.element(find.byType(CalendarDatePicker));
    expect(Localizations.localeOf(calendarContext).languageCode, 'hi');
  });

  testWidgets('Name onboarding saves split profile', (tester) async {
    SharedPreferences.setMockInitialValues({
      'guruvandan_flutter:language': 'english',
    });

    await tester.pumpWidget(
        const GuruvandanApp(firebaseReady: false, showOpening: false));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(EditableText).at(0), 'Ajay');
    await tester.enterText(find.byType(EditableText).at(1), 'Kumar');
    await tester.enterText(find.byType(EditableText).at(2), 'Bhatnagar');
    await tester.ensureVisible(find.text('Begin'));
    await tester.tap(find.text('Begin'));
    await tester.pumpAndSettle();

    expect(find.text('Jai Guru, Ajay!'), findsOneWidget);
    expect(find.textContaining('Ajay'), findsWidgets);
    expect(find.textContaining('Kumar'), findsNothing);
    expect(find.textContaining('Bhatnagar'), findsNothing);
    expect(find.text('Today\'s Sacred Practice'), findsOneWidget);

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpAndSettle();
    await tester.pumpWidget(
        const GuruvandanApp(firebaseReady: false, showOpening: false));
    await tester.pumpAndSettle();

    expect(find.text('Welcome to Guru Vandan'), findsNothing);
    expect(find.text('First name'), findsNothing);
    expect(find.text('Today\'s Sacred Practice'), findsOneWidget);
  });

  testWidgets('Home hero morning chip opens morning satsang', (tester) async {
    await pumpSavedHome(tester);

    await tester.tap(find.text('Morning'));
    await tester.pumpAndSettle();

    expect(find.text('Satsang'), findsWidgets);
    expect(find.text('Morning Satsang'), findsOneWidget);
  });

  testWidgets('Home hero evening chip opens evening satsang', (tester) async {
    await pumpSavedHome(tester);

    await tester.tap(find.text('Evening'));
    await tester.pumpAndSettle();

    expect(find.text('Satsang'), findsWidgets);
    expect(find.text('Evening Satsang'), findsOneWidget);
  });

  testWidgets('Home hero meditation chip opens meditation', (tester) async {
    await pumpSavedHome(tester);

    await tester.tap(find.text('Meditation').first);
    await tester.pumpAndSettle();

    expect(find.text('Meditation'), findsWidgets);
    expect(find.text('Om mantra'), findsOneWidget);
    expect(find.text('417Hz sacred mantra sound'), findsNothing);
  });

  testWidgets('More tab shows coming soon modules', (tester) async {
    await pumpSavedHome(tester);

    await tester.tap(find.text('Other'));
    await tester.pumpAndSettle();

    expect(find.text('Sacred offerings'), findsOneWidget);
    expect(find.text('Devotional Store'), findsOneWidget);
    expect(find.text('Spiritual Gatherings'), findsOneWidget);
    expect(find.text('Guru Gallery'), findsOneWidget);
    expect(find.text('Questions & Guidance'), findsOneWidget);
    expect(find.text('Coming soon'), findsNWidgets(4));
    expect(find.text('Logout'), findsOneWidget);
    expect(find.text('Admin content'), findsNothing);
    expect(find.text('Open admin console'), findsNothing);
  });

  testWidgets('More tab can update the devotee first name', (tester) async {
    await tester.binding.setSurfaceSize(const Size(900, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await pumpSavedHome(tester);

    await tester.tap(find.text('Other'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Name'));
    await tester.tap(find.text('Name'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('edit-first-name')), 'Ravi');
    await tester.tap(find.descendant(
      of: find.byType(AlertDialog),
      matching: find.text('Save'),
    ));
    await tester.pumpAndSettle();
    final preferences = await SharedPreferences.getInstance();
    expect(
      DevoteeProfile.fromStoredValue(
        preferences.getString('guruvandan_flutter:name'),
      )?.displayName,
      'Ravi',
    );
    expect(find.text('Ravi Bhatnagar'), findsOneWidget);
  });

  testWidgets('Wisdom tab keeps the daily quote and archive layout',
      (tester) async {
    await pumpSavedHome(tester);

    await tester.tap(find.text('Wisdom'));
    await tester.pumpAndSettle();

    final dailyQuote = quoteTimelineForDate(fallbackQuotes).daily;
    if (dailyQuote == null) {
      expect(find.text('No quote scheduled today'), findsOneWidget);
    } else {
      expect(find.text(dailyQuote.text), findsOneWidget);
    }
    expect(find.text('Quote of the Day'), findsOneWidget);
    expect(find.text('Archive'), findsOneWidget);
    expect(find.byType(RefreshIndicator), findsOneWidget);
    expect(find.byKey(const Key('refresh-wisdom-quotes')), findsOneWidget);
  });

  testWidgets('More tab switches app language to Hindi', (tester) async {
    await pumpSavedHome(tester);

    await tester.tap(find.text('Other'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Hindi'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Hindi'));
    await tester.pumpAndSettle();

    expect(find.text('भाषा'), findsOneWidget);
    expect(find.text('आगामी अनुभाग'), findsOneWidget);
    expect(find.text('सत्संग सामग्री'), findsOneWidget);
    expect(find.text('गृह'), findsOneWidget);
    expect(find.text('Other'), findsNothing);
    expect(find.text('Sacred offerings'), findsNothing);
  });

  testWidgets('Logout returns to sign-in and preserves the saved name',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(900, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await pumpSavedHome(tester);

    await tester.tap(find.text('Other'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Logout'));
    await tester.tap(find.text('Logout'));
    await tester.pumpAndSettle();

    final confirmLogout = find.descendant(
      of: find.byType(AlertDialog),
      matching: find.text('Logout'),
    );
    expect(confirmLogout, findsOneWidget);
    await tester.tap(confirmLogout);
    await tester.pumpAndSettle();

    expect(find.text('Enter Guru Vandan'), findsOneWidget);
    final preferences = await SharedPreferences.getInstance();
    final savedProfile = DevoteeProfile.fromStoredValue(
      preferences.getString('guruvandan_flutter:name'),
    );
    expect(
      savedProfile?.displayName,
      'Ajay',
    );
  });

  testWidgets('Bottom navigation stays aligned on a narrow phone',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(360, 800));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await pumpSavedHome(tester);

    expect(find.text('Home'), findsOneWidget);
    expect(find.text('Satsang'), findsOneWidget);
    final meditationLabel = find.descendant(
      of: find.byType(NavigationBar),
      matching: find.text('Focus'),
    );
    expect(meditationLabel, findsOneWidget);
    expect(find.text('Wisdom'), findsOneWidget);
    expect(find.text('Other'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Bottom navigation labels stay readable in dark mode',
      (tester) async {
    SharedPreferences.setMockInitialValues({
      'guruvandan_flutter:name': 'Ajay Bhatnagar',
      'guruvandan_flutter:language': 'english',
      'guruvandan_flutter:theme_mode': 'dark',
    });

    await tester.pumpWidget(
        const GuruvandanApp(firebaseReady: false, showOpening: false));
    await tester.pumpAndSettle();
    await tester.tap(find.textContaining('Enter'));
    await tester.pumpAndSettle();

    final navigationBar =
        tester.widget<NavigationBar>(find.byType(NavigationBar));
    final labelColor = navigationBar.labelTextStyle?.resolve({})?.color;
    expect(labelColor, const Color(0xFFFFF7EE));
  });

  testWidgets('Custom meditation timer follows the dark theme', (tester) async {
    await tester.binding.setSurfaceSize(const Size(900, 1200));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    SharedPreferences.setMockInitialValues({
      'guruvandan_flutter:name': 'Ajay Bhatnagar',
      'guruvandan_flutter:language': 'english',
      'guruvandan_flutter:theme_mode': 'dark',
    });

    await tester.pumpWidget(
        const GuruvandanApp(firebaseReady: false, showOpening: false));
    await tester.pumpAndSettle();
    await tester.tap(find.textContaining('Enter'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Meditation').first);
    await tester.pumpAndSettle();

    final customChip = find.widgetWithText(ActionChip, 'Custom');
    expect(customChip, findsOneWidget);
    expect(
      tester.widget<ActionChip>(customChip).backgroundColor,
      const Color(0xFF43282D),
    );
    await tester.tap(customChip);
    await tester.pumpAndSettle();

    final pickerTheme = tester.widget<CupertinoTheme>(
      find
          .ancestor(
            of: find.byType(CupertinoTimerPicker),
            matching: find.byType(CupertinoTheme),
          )
          .first,
    );
    expect(pickerTheme.data.brightness, Brightness.dark);
    expect(pickerTheme.data.primaryColor, const Color(0xFFE2BC73));
  });

  testWidgets('Saved meditation timers persist and support delete mode',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(900, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    SharedPreferences.setMockInitialValues({
      'guruvandan_flutter:name': 'Ajay Bhatnagar',
      'guruvandan_flutter:language': 'english',
      'guruvandan_flutter:meditation_presets': ['1', '5', '10'],
      'guruvandan_flutter:selected_meditation_minutes': 1,
    });

    await tester.pumpWidget(
        const GuruvandanApp(firebaseReady: false, showOpening: false));
    await tester.pumpAndSettle();
    await tester.tap(find.textContaining('Enter'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Meditation').first);
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('meditation-preset-1')), findsOneWidget);
    expect(find.widgetWithText(ActionChip, 'Custom'), findsOneWidget);

    await tester.longPress(
      find.byKey(const ValueKey('meditation-preset-1')),
    );
    await tester.pump(const Duration(milliseconds: 250));

    expect(find.text('Done'), findsOneWidget);
    expect(
      find.byKey(const Key('delete-meditation-preset-5')),
      findsOneWidget,
    );
    await tester.tap(find.byKey(const Key('delete-meditation-preset-5')));
    await tester.pump(const Duration(milliseconds: 250));

    final preferences = await SharedPreferences.getInstance();
    expect(
      preferences.getStringList('guruvandan_flutter:meditation_presets'),
      const ['1', '10'],
    );
    await tester.tap(find.text('Done'));
    await tester.pumpAndSettle();
  });

  testWidgets('Meditation start asks user to put phone on silent',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(900, 1000));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await pumpSavedHome(tester);

    await tester.tap(find.text('Meditation').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Start'));
    await tester.pumpAndSettle();

    expect(find.text('Prepare for sacred listening'), findsOneWidget);
    expect(
      find.textContaining('Please silence your phone'),
      findsOneWidget,
    );
  });

  testWidgets('Selecting Om waits for the meditation timer', (tester) async {
    await tester.binding.setSurfaceSize(const Size(900, 1000));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await pumpSavedHome(tester);
    await tester.tap(find.text('Meditation').first);
    await tester.pumpAndSettle();

    final omSwitch = find.byType(Switch);
    expect(omSwitch, findsOneWidget);
    await tester.tap(omSwitch);
    await tester.pumpAndSettle();

    expect(tester.widget<Switch>(omSwitch).value, isTrue);
    expect(find.text('Ready for stillness'), findsOneWidget);
    expect(find.text('Prepare for sacred listening'), findsNothing);

    await tester.tap(find.text('Start'));
    await tester.pumpAndSettle();
    expect(find.text('Prepare for sacred listening'), findsOneWidget);
  });
}
