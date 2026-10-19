import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_displaymode/flutter_displaymode.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';

const Color _appBackgroundColor = Color(0xFF041B33);
final Uri _homeUrl = Uri.parse('https://dcamclasses.in');
const String _externalBrowserBridgeScheme = 'dcamclassesapp';
const String _externalBrowserBridgeHost = 'open-external';
const String _appBridgeChannelName = 'DcamAppBridge';
const String _appGoogleSignInResultEvent = 'dcam-app-google-sign-in-result';
const String _appFcmTokenEvent = 'dcam-app-fcm-token';
const String _appBellNotificationSyncType = 'sync-bell-notifications';
const String _appShowLocalNotificationType = 'show-local-notification';
const String _appSessionSyncType = 'sync-session-state';
const String _googleServerClientId =
    '1059390458247-pphpoanbocti7vkksaqvsasbaa5a4nsd.apps.googleusercontent.com';
const String _notificationChannelId = 'dcam_bell_notifications_v2';
const String _notificationChannelName = 'DCAM Updates';
const String _notificationChannelDescription =
    'Class reminders, purchases, schedule changes, and account alerts from DCAM Classes.';
const String _notificationUserIdPreferenceKey =
    'dcam_native_notifications_user_id';
const String _notificationActiveIdsPreferencePrefix =
    'dcam_native_notifications_active_ids:';
const String _notificationDeliveredKeysPreferencePrefix =
    'dcam_native_notifications_delivered_keys:';
const String _appLaunchPathPreferenceKey = 'dcam_native_app_launch_path';
const String _adminEnquiryTopicPreferenceKey =
    'dcam_native_admin_enquiry_topic_subscribed';
const String _adminEnquiryTopic = 'dcam_admin_enquiries';
const int _maxStoredDeliveryKeys = 500;

const FirebaseOptions _firebaseOptions = FirebaseOptions(
  apiKey: 'AIzaSyASFhsSpSbaVWYj71_BZjeuO7gqtEMU4Jo',
  appId: '1:1059390458247:web:996f6f8b4c65edb759eb22',
  messagingSenderId: '1059390458247',
  projectId: 'dcam-classes-c0715',
  storageBucket: 'dcam-classes-c0715.firebasestorage.app',
);

const AndroidNotificationChannel _bellNotificationChannel =
    AndroidNotificationChannel(
      _notificationChannelId,
      _notificationChannelName,
      description: _notificationChannelDescription,
      importance: Importance.max,
    );

@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp(options: _firebaseOptions);
}

String _cleanString(Object? value) => (value?.toString() ?? '').trim();

String? _cleanNullableString(Object? value) {
  final String normalized = _cleanString(value);
  return normalized.isEmpty ? null : normalized;
}

String _firstNonEmptyString(Iterable<Object?> values) {
  for (final Object? value in values) {
    final String normalized = _cleanString(value);
    if (normalized.isNotEmpty) {
      return normalized;
    }
  }
  return '';
}

int _readInt(Object? value) {
  if (value is int) {
    return value;
  }
  if (value is num) {
    return value.toInt();
  }
  return int.tryParse(_cleanString(value)) ?? 0;
}

bool _readBool(Object? value) {
  if (value is bool) {
    return value;
  }
  return _cleanString(value).toLowerCase() == 'true';
}

String _activeNotificationsPreferenceKey(String userId) =>
    '$_notificationActiveIdsPreferencePrefix$userId';

String _deliveredNotificationsPreferenceKey(String userId) =>
    '$_notificationDeliveredKeysPreferencePrefix$userId';

int _stableNotificationId(String value) {
  int hash = 0x811C9DC5;
  for (final int codeUnit in value.codeUnits) {
    hash ^= codeUnit;
    hash = (hash * 0x01000193) & 0x7FFFFFFF;
  }
  return hash == 0 ? 1 : hash;
}

class _BellNotificationSnapshot {
  const _BellNotificationSnapshot({
    required this.id,
    required this.title,
    required this.message,
    required this.notificationType,
    required this.createdAtMs,
    required this.keepUntilAction,
    this.href,
  });

  final String id;
  final String title;
  final String message;
  final String notificationType;
  final int createdAtMs;
  final bool keepUntilAction;
  final String? href;

  String get deliveryKey => '$id:$createdAtMs';

  int get platformNotificationId => _stableNotificationId(id);

  String buildPayload(String userId) => jsonEncode(<String, Object?>{
    'id': id,
    'href': href,
    'userId': userId,
    'notificationType': notificationType,
  });

  Map<String, Object?> toJson() => <String, Object?>{
    'id': id,
    'title': title,
    'message': message,
    'href': href,
    'notificationType': notificationType,
    'createdAtMs': createdAtMs,
    'keepUntilAction': keepUntilAction,
  };

  static _BellNotificationSnapshot? fromJson(Object? value) {
    if (value is! Map) {
      return null;
    }

    final int createdAtMs = _readInt(value['createdAtMs']);
    final String title = _firstNonEmptyString(<Object?>[
      value['title'],
      value['heading'],
      value['subject'],
      value['name'],
    ]);
    final String message = _firstNonEmptyString(<Object?>[
      value['message'],
      value['body'],
      value['description'],
      value['text'],
    ]);
    final String notificationType = _firstNonEmptyString(<Object?>[
      value['notificationType'],
      value['type'],
      value['category'],
    ]);
    final String id = _firstNonEmptyString(<Object?>[
      value['id'],
      value['notificationId'],
      value['enquiryId'],
      value['docId'],
      title.isEmpty && message.isEmpty
          ? null
          : '$notificationType:$createdAtMs:$title:$message',
    ]);
    if (id.isEmpty || (title.isEmpty && message.isEmpty)) {
      return null;
    }

    return _BellNotificationSnapshot(
      id: id,
      title: title.isEmpty ? 'DCAM Classes' : title,
      message: message.isEmpty ? 'Tap to view details.' : message,
      href: _cleanNullableString(
        _firstNonEmptyString(<Object?>[
          value['href'],
          value['path'],
          value['url'],
          value['link'],
        ]),
      ),
      notificationType: notificationType.isEmpty ? 'general' : notificationType,
      createdAtMs: createdAtMs == 0
          ? DateTime.now().millisecondsSinceEpoch
          : createdAtMs,
      keepUntilAction: _readBool(value['keepUntilAction']),
    );
  }
}

class _BellNotificationSyncSnapshot {
  const _BellNotificationSyncSnapshot({
    required this.userId,
    required this.notifications,
  });

  final String? userId;
  final List<_BellNotificationSnapshot> notifications;

  static _BellNotificationSyncSnapshot? fromJson(Map<String, dynamic> json) {
    final Object? rawNotifications = json['notifications'];
    if (rawNotifications is! List) {
      return null;
    }

    return _BellNotificationSyncSnapshot(
      userId: _cleanNullableString(json['userId']),
      notifications: rawNotifications
          .map(_BellNotificationSnapshot.fromJson)
          .whereType<_BellNotificationSnapshot>()
          .toList(growable: false),
    );
  }
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: _firebaseOptions);
  FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

  await SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      statusBarBrightness: Brightness.dark,
      systemNavigationBarColor: Colors.transparent,
      systemNavigationBarDividerColor: Colors.transparent,
      systemNavigationBarIconBrightness: Brightness.light,
      systemStatusBarContrastEnforced: false,
      systemNavigationBarContrastEnforced: false,
    ),
  );

  if (Platform.isAndroid) {
    try {
      await FlutterDisplayMode.setHighRefreshRate();
    } catch (e) {
      debugPrint('Display mode setting failed: $e');
    }
  }

  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'DCAM CLASSES',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: _appBackgroundColor,
          brightness: Brightness.dark,
        ),
        useMaterial3: true,
        scaffoldBackgroundColor: _appBackgroundColor,
      ),
      home: const WebViewScreen(),
      debugShowCheckedModeBanner: false,
    );
  }
}

class WebViewScreen extends StatefulWidget {
  const WebViewScreen({super.key});

  @override
  State<WebViewScreen> createState() => _WebViewScreenState();
}

class _WebViewScreenState extends State<WebViewScreen> {
  late final WebViewController _controller;
  late final WebViewWidget _webView;
  final GoogleSignIn _googleSignIn = GoogleSignIn.instance;
  final FlutterLocalNotificationsPlugin _notificationsPlugin =
      FlutterLocalNotificationsPlugin();
  bool _isLoading = true;
  bool _isNativeGoogleSignInInProgress = false;
  bool _isHandlingBackNavigation = false;
  bool _hasRequestedNotificationPermission = false;
  bool _isWebViewReady = false;
  late final Future<void> _googleSignInReady;
  late final Future<void> _localNotificationsReady;
  late final Future<void> _firebaseMessagingReady;
  SharedPreferences? _sharedPreferences;
  String? _pendingNotificationTarget;

  @override
  void initState() {
    super.initState();
    _controller = _createController();
    _webView = _createWebView();
    _googleSignInReady = _initializeGoogleSignIn();
    _localNotificationsReady = _initializeLocalNotifications();
    _firebaseMessagingReady = _initializeFirebaseMessaging();
    unawaited(_googleSignInReady);
    unawaited(_localNotificationsReady);
    unawaited(_firebaseMessagingReady);
    unawaited(_initializeWebView());
  }

  Future<void> _initializeGoogleSignIn() {
    return _googleSignIn.initialize(serverClientId: _googleServerClientId);
  }

  Future<void> _initializeLocalNotifications() async {
    _sharedPreferences = await SharedPreferences.getInstance();

    final NotificationAppLaunchDetails? appLaunchDetails =
        await _notificationsPlugin.getNotificationAppLaunchDetails();

    const InitializationSettings initializationSettings =
        InitializationSettings(
          android: AndroidInitializationSettings('@mipmap/launcher_icon'),
          iOS: DarwinInitializationSettings(
            requestAlertPermission: false,
            requestBadgePermission: false,
            requestSoundPermission: false,
          ),
        );

    await _notificationsPlugin.initialize(
      settings: initializationSettings,
      onDidReceiveNotificationResponse: _handleLocalNotificationResponse,
    );

    if (Platform.isAndroid) {
      final AndroidFlutterLocalNotificationsPlugin? androidNotifications =
          _notificationsPlugin
              .resolvePlatformSpecificImplementation<
                AndroidFlutterLocalNotificationsPlugin
              >();
      await androidNotifications?.createNotificationChannel(
        _bellNotificationChannel,
      );
    }

    if (appLaunchDetails?.didNotificationLaunchApp == true) {
      final String? launchTarget = _extractNotificationTarget(
        appLaunchDetails?.notificationResponse?.payload,
      );
      if (launchTarget != null) {
        _queueNotificationTarget(launchTarget);
      }
    }
  }

  Future<void> _initializeFirebaseMessaging() async {
    try {
      await FirebaseMessaging.instance
          .setForegroundNotificationPresentationOptions(
            alert: true,
            badge: true,
            sound: true,
          );

      FirebaseMessaging.onMessage.listen((RemoteMessage message) {
        unawaited(_handleForegroundFirebaseMessage(message));
      });
      FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
        _handleFirebaseNotificationOpen(message);
      });
      FirebaseMessaging.instance.onTokenRefresh.listen((String token) {
        unawaited(_dispatchFcmTokenToWeb(token));
      });

      final RemoteMessage? initialMessage = await FirebaseMessaging.instance
          .getInitialMessage();
      if (initialMessage != null) {
        _handleFirebaseNotificationOpen(initialMessage);
      }
      await _dispatchCurrentFcmTokenToWeb();
    } catch (error) {
      debugPrint('Firebase messaging setup failed: $error');
    }
  }

  Future<void> _dispatchCurrentFcmTokenToWeb() async {
    try {
      final String? token = await FirebaseMessaging.instance.getToken();
      if (token == null || token.trim().isEmpty) {
        return;
      }
      await _dispatchFcmTokenToWeb(token);
    } catch (error) {
      debugPrint('Could not read Firebase messaging token: $error');
    }
  }

  Future<void> _dispatchFcmTokenToWeb(String token) async {
    final String normalizedToken = token.trim();
    if (normalizedToken.isEmpty) {
      return;
    }

    await _dispatchWebEvent(_appFcmTokenEvent, <String, Object?>{
      'token': normalizedToken,
      'platform': Platform.isAndroid ? 'android' : 'unknown',
    });
  }

  _BellNotificationSnapshot? _notificationFromRemoteMessage(
    RemoteMessage message,
  ) {
    final Map<String, Object?> data = <String, Object?>{...message.data};
    final RemoteNotification? remoteNotification = message.notification;

    data.putIfAbsent(
      'id',
      () =>
          message.messageId ??
          data['notificationId'] ??
          data['enquiryId'] ??
          'fcm:${DateTime.now().millisecondsSinceEpoch}',
    );
    data.putIfAbsent('title', () => remoteNotification?.title);
    data.putIfAbsent('message', () => remoteNotification?.body);
    data.putIfAbsent('href', () => '/admin/enquiries');
    data.putIfAbsent('notificationType', () => 'admin_new_enquiry');
    data.putIfAbsent(
      'createdAtMs',
      () =>
          message.sentTime?.millisecondsSinceEpoch ??
          DateTime.now().millisecondsSinceEpoch,
    );

    return _BellNotificationSnapshot.fromJson(data);
  }

  Future<void> _handleForegroundFirebaseMessage(RemoteMessage message) async {
    final _BellNotificationSnapshot? notification =
        _notificationFromRemoteMessage(message);
    if (notification == null) {
      return;
    }

    final SharedPreferences preferences = await _getSharedPreferences();
    final String userId =
        _cleanNullableString(message.data['userId']) ??
        _cleanNullableString(
          preferences.getString(_notificationUserIdPreferenceKey),
        ) ??
        'local';

    await _handleShowLocalNotification(<String, dynamic>{
      'type': _appShowLocalNotificationType,
      'userId': userId,
      'notification': notification.toJson(),
    });
  }

  void _handleFirebaseNotificationOpen(RemoteMessage message) {
    final String? target =
        _cleanNullableString(message.data['href']) ??
        _cleanNullableString(message.data['path']) ??
        _notificationFromRemoteMessage(message)?.href;
    if (target == null) {
      return;
    }

    _queueNotificationTarget(target);
    unawaited(_openPendingNotificationTargetIfNeeded());
  }

  Future<void> _syncAdminEnquiryTopicSubscription({
    required bool isAdmin,
  }) async {
    await _firebaseMessagingReady;

    final SharedPreferences preferences = await _getSharedPreferences();
    final bool isSubscribed =
        preferences.getBool(_adminEnquiryTopicPreferenceKey) ?? false;

    try {
      if (isAdmin && !isSubscribed) {
        await FirebaseMessaging.instance.subscribeToTopic(_adminEnquiryTopic);
        await preferences.setBool(_adminEnquiryTopicPreferenceKey, true);
        return;
      }

      if (!isAdmin && isSubscribed) {
        await FirebaseMessaging.instance.unsubscribeFromTopic(
          _adminEnquiryTopic,
        );
        await preferences.setBool(_adminEnquiryTopicPreferenceKey, false);
      }
    } catch (error) {
      debugPrint('Admin enquiry topic sync failed: $error');
    }
  }

  Future<void> _ensureNotificationPermission() async {
    if (await _areNotificationsAllowed()) {
      return;
    }

    if (_hasRequestedNotificationPermission) {
      return;
    }

    _hasRequestedNotificationPermission = true;

    try {
      if (Platform.isAndroid) {
        final AndroidFlutterLocalNotificationsPlugin? androidNotifications =
            _notificationsPlugin
                .resolvePlatformSpecificImplementation<
                  AndroidFlutterLocalNotificationsPlugin
                >();
        await androidNotifications?.requestNotificationsPermission();
        return;
      }

      if (Platform.isIOS) {
        final IOSFlutterLocalNotificationsPlugin? iosNotifications =
            _notificationsPlugin
                .resolvePlatformSpecificImplementation<
                  IOSFlutterLocalNotificationsPlugin
                >();
        await iosNotifications?.requestPermissions(
          alert: true,
          badge: true,
          sound: true,
        );
      }
    } catch (error) {
      debugPrint('Notification permission request failed: $error');
    }
  }

  Future<bool> _areNotificationsAllowed() async {
    try {
      if (Platform.isAndroid) {
        final AndroidFlutterLocalNotificationsPlugin? androidNotifications =
            _notificationsPlugin
                .resolvePlatformSpecificImplementation<
                  AndroidFlutterLocalNotificationsPlugin
                >();
        return await androidNotifications?.areNotificationsEnabled() ?? false;
      }

      if (Platform.isIOS) {
        return true;
      }
    } catch (error) {
      debugPrint('Notification permission status check failed: $error');
    }

    return true;
  }

  void _handleLocalNotificationResponse(NotificationResponse response) {
    final String? target = _extractNotificationTarget(response.payload);
    if (target == null) {
      return;
    }

    _queueNotificationTarget(target);
    unawaited(_openPendingNotificationTargetIfNeeded());
  }

  String? _extractNotificationTarget(String? payload) {
    final String? normalizedPayload = _cleanNullableString(payload);
    if (normalizedPayload == null) {
      return null;
    }

    try {
      final dynamic decoded = jsonDecode(normalizedPayload);
      if (decoded is Map) {
        return _cleanNullableString(decoded['href']);
      }
    } catch (_) {
      return normalizedPayload;
    }

    return null;
  }

  void _queueNotificationTarget(String target) {
    _pendingNotificationTarget = _resolveAppTargetUri(target).toString();
  }

  Future<Uri> _resolveInitialLaunchUri() async {
    final SharedPreferences preferences = await _getSharedPreferences();
    final String launchPath =
        _cleanNullableString(
          preferences.getString(_appLaunchPathPreferenceKey),
        ) ??
        '/';
    return _resolveAppTargetUri(launchPath);
  }

  Uri _resolveAppTargetUri(String target) {
    final Uri? parsedTarget = Uri.tryParse(target.trim());
    if (parsedTarget == null) {
      return _homeUrl;
    }

    if (parsedTarget.hasScheme) {
      return parsedTarget;
    }

    final String normalizedTarget = target.startsWith('/')
        ? target
        : '/$target';
    return _homeUrl.resolve(normalizedTarget);
  }

  Future<void> _openPendingNotificationTargetIfNeeded() async {
    if (!_isWebViewReady) {
      return;
    }

    final String? pendingTarget = _pendingNotificationTarget;
    if (pendingTarget == null || pendingTarget.isEmpty) {
      return;
    }

    _pendingNotificationTarget = null;
    try {
      await _controller.loadRequest(Uri.parse(pendingTarget));
    } catch (error) {
      debugPrint('Could not open notification target in the app: $error');
      _pendingNotificationTarget = pendingTarget;
    }
  }

  Future<SharedPreferences> _getSharedPreferences() async {
    final SharedPreferences? existingPreferences = _sharedPreferences;
    if (existingPreferences != null) {
      return existingPreferences;
    }

    final SharedPreferences loadedPreferences =
        await SharedPreferences.getInstance();
    _sharedPreferences = loadedPreferences;
    return loadedPreferences;
  }

  Future<void> _clearMirroredNotifications(
    SharedPreferences preferences, {
    String? userId,
  }) async {
    final String? effectiveUserId =
        _cleanNullableString(userId) ??
        _cleanNullableString(
          preferences.getString(_notificationUserIdPreferenceKey),
        );

    final List<String> activeIds = effectiveUserId == null
        ? const <String>[]
        : List<String>.from(
            preferences.getStringList(
                  _activeNotificationsPreferenceKey(effectiveUserId),
                ) ??
                const <String>[],
          );

    if (activeIds.isEmpty) {
      await _notificationsPlugin.cancelAll();
    } else {
      for (final String activeId in activeIds) {
        await _notificationsPlugin.cancel(id: _stableNotificationId(activeId));
      }
    }

    if (effectiveUserId != null) {
      await preferences.remove(
        _activeNotificationsPreferenceKey(effectiveUserId),
      );
      await preferences.remove(
        _deliveredNotificationsPreferenceKey(effectiveUserId),
      );
    }
  }

  Future<bool> _showMirroredNotification(
    String userId,
    _BellNotificationSnapshot notification,
  ) async {
    if (!await _areNotificationsAllowed()) {
      return false;
    }

    final AndroidNotificationDetails androidDetails =
        AndroidNotificationDetails(
          _notificationChannelId,
          _notificationChannelName,
          channelDescription: _notificationChannelDescription,
          icon: '@mipmap/launcher_icon',
          importance: Importance.max,
          priority: Priority.high,
          styleInformation: BigTextStyleInformation(notification.message),
          ticker: 'DCAM Classes',
          visibility: NotificationVisibility.public,
          autoCancel: false,
        );
    const DarwinNotificationDetails iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    try {
      await _notificationsPlugin.show(
        id: notification.platformNotificationId,
        title: notification.title,
        body: notification.message,
        notificationDetails: NotificationDetails(
          android: androidDetails,
          iOS: iosDetails,
        ),
        payload: notification.buildPayload(userId),
      );
      return true;
    } catch (error) {
      debugPrint('Could not show mirrored notification: $error');
      return false;
    }
  }

  Future<void> _handleBellNotificationSync(
    Map<String, dynamic> decodedMessage,
  ) async {
    await _localNotificationsReady;

    final _BellNotificationSyncSnapshot? snapshot =
        _BellNotificationSyncSnapshot.fromJson(decodedMessage);
    if (snapshot == null) {
      return;
    }

    final SharedPreferences preferences = await _getSharedPreferences();
    final String? previousUserId = _cleanNullableString(
      preferences.getString(_notificationUserIdPreferenceKey),
    );
    final String? nextUserId = snapshot.userId;

    if (previousUserId != nextUserId) {
      await _clearMirroredNotifications(preferences, userId: previousUserId);
    }

    if (nextUserId == null) {
      await preferences.remove(_notificationUserIdPreferenceKey);
      return;
    }

    await preferences.setString(_notificationUserIdPreferenceKey, nextUserId);

    if (snapshot.notifications.isNotEmpty) {
      await _ensureNotificationPermission();
    }

    final List<String> previousActiveIds = List<String>.from(
      preferences.getStringList(
            _activeNotificationsPreferenceKey(nextUserId),
          ) ??
          const <String>[],
    );
    final Set<String> nextActiveIds = snapshot.notifications
        .map((notification) => notification.id)
        .toSet();

    for (final String previousActiveId in previousActiveIds) {
      if (!nextActiveIds.contains(previousActiveId)) {
        await _notificationsPlugin.cancel(
          id: _stableNotificationId(previousActiveId),
        );
      }
    }

    final List<String> deliveredKeys = List<String>.from(
      preferences.getStringList(
            _deliveredNotificationsPreferenceKey(nextUserId),
          ) ??
          const <String>[],
    );
    final Set<String> deliveredKeySet = deliveredKeys.toSet();

    for (final _BellNotificationSnapshot notification
        in snapshot.notifications) {
      final String deliveryKey = notification.deliveryKey;
      if (deliveredKeySet.contains(deliveryKey)) {
        continue;
      }

      final bool didShowNotification = await _showMirroredNotification(
        nextUserId,
        notification,
      );
      if (!didShowNotification) {
        continue;
      }

      deliveredKeys.add(deliveryKey);
      deliveredKeySet.add(deliveryKey);
    }

    final List<String> trimmedDeliveredKeys =
        deliveredKeys.length <= _maxStoredDeliveryKeys
        ? deliveredKeys
        : deliveredKeys.sublist(deliveredKeys.length - _maxStoredDeliveryKeys);

    final List<String> sortedActiveIds = nextActiveIds.toList()..sort();
    await preferences.setStringList(
      _activeNotificationsPreferenceKey(nextUserId),
      sortedActiveIds,
    );
    await preferences.setStringList(
      _deliveredNotificationsPreferenceKey(nextUserId),
      trimmedDeliveredKeys,
    );
  }

  Future<void> _handleShowLocalNotification(
    Map<String, dynamic> decodedMessage,
  ) async {
    await _localNotificationsReady;

    final Object? rawNotification = decodedMessage['notification'];
    final _BellNotificationSnapshot? notification =
        _BellNotificationSnapshot.fromJson(
          rawNotification is Map ? rawNotification : decodedMessage,
        );
    if (notification == null) {
      return;
    }

    final SharedPreferences preferences = await _getSharedPreferences();
    final String userId =
        _cleanNullableString(decodedMessage['userId']) ??
        _cleanNullableString(
          preferences.getString(_notificationUserIdPreferenceKey),
        ) ??
        'local';

    if (userId != 'local') {
      await preferences.setString(_notificationUserIdPreferenceKey, userId);
    }

    await _ensureNotificationPermission();

    final List<String> deliveredKeys = List<String>.from(
      preferences.getStringList(_deliveredNotificationsPreferenceKey(userId)) ??
          const <String>[],
    );
    final Set<String> deliveredKeySet = deliveredKeys.toSet();
    if (deliveredKeySet.contains(notification.deliveryKey)) {
      return;
    }

    final bool didShowNotification = await _showMirroredNotification(
      userId,
      notification,
    );
    if (!didShowNotification) {
      return;
    }

    final List<String> activeIds = List<String>.from(
      preferences.getStringList(_activeNotificationsPreferenceKey(userId)) ??
          const <String>[],
    );
    final Set<String> activeIdSet = activeIds.toSet()..add(notification.id);

    deliveredKeys.add(notification.deliveryKey);
    final List<String> trimmedDeliveredKeys =
        deliveredKeys.length <= _maxStoredDeliveryKeys
        ? deliveredKeys
        : deliveredKeys.sublist(deliveredKeys.length - _maxStoredDeliveryKeys);
    final List<String> sortedActiveIds = activeIdSet.toList()..sort();

    await preferences.setStringList(
      _activeNotificationsPreferenceKey(userId),
      sortedActiveIds,
    );
    await preferences.setStringList(
      _deliveredNotificationsPreferenceKey(userId),
      trimmedDeliveredKeys,
    );
  }

  Future<void> _handleSessionSync(Map<String, dynamic> decodedMessage) async {
    final SharedPreferences preferences = await _getSharedPreferences();
    final String? userId = _cleanNullableString(decodedMessage['userId']);
    final bool resetToHome = _readBool(decodedMessage['resetToHome']);

    if (userId == null) {
      if (!resetToHome) {
        return;
      }
      await preferences.setString(_appLaunchPathPreferenceKey, '/');
      await _clearMirroredNotifications(preferences);
      await _syncAdminEnquiryTopicSubscription(isAdmin: false);
      await preferences.remove(_notificationUserIdPreferenceKey);
      return;
    }

    final String launchPath =
        _cleanNullableString(decodedMessage['launchPath']) ?? '/dashboard';
    await preferences.setString(_appLaunchPathPreferenceKey, launchPath);

    final bool isAdmin = _readBool(decodedMessage['isAdmin']);
    if (isAdmin) {
      await _ensureNotificationPermission();
      await _dispatchCurrentFcmTokenToWeb();
    }
    await _syncAdminEnquiryTopicSubscription(isAdmin: isAdmin);
  }

  WebViewController _createController() {
    final WebViewController controller =
        WebViewController.fromPlatformCreationParams(
          const PlatformWebViewControllerCreationParams(),
        );

    final platformController = controller.platform;
    if (platformController is AndroidWebViewController) {
      AndroidWebViewController.enableDebugging(kDebugMode);
      unawaited(
        platformController.setOverScrollMode(WebViewOverScrollMode.never),
      );
      unawaited(platformController.setMediaPlaybackRequiresUserGesture(false));
      unawaited(platformController.setTextZoom(100));
      unawaited(platformController.setVerticalScrollBarEnabled(false));
      unawaited(platformController.setHorizontalScrollBarEnabled(false));
    }

    return controller;
  }

  WebViewWidget _createWebView() {
    PlatformWebViewWidgetCreationParams params =
        PlatformWebViewWidgetCreationParams(
          controller: _controller.platform,
          gestureRecognizers: <Factory<OneSequenceGestureRecognizer>>{
            Factory<OneSequenceGestureRecognizer>(
              () => EagerGestureRecognizer(),
            ),
          },
        );

    if (_controller.platform is AndroidWebViewController) {
      params =
          AndroidWebViewWidgetCreationParams.fromPlatformWebViewWidgetCreationParams(
            params,
            displayWithHybridComposition: false,
          );
    }

    return WebViewWidget.fromPlatformCreationParams(params: params);
  }

  Future<void> _configureChromeLikeWebView() async {
    final platformController = _controller.platform;
    if (platformController is! AndroidWebViewController) {
      return;
    }

    try {
      final String? currentUserAgent = await platformController.getUserAgent();
      final String? chromeLikeUserAgent = _buildChromeLikeUserAgent(
        currentUserAgent,
      );
      if (chromeLikeUserAgent != null) {
        await platformController.setUserAgent(chromeLikeUserAgent);
      }
    } catch (error) {
      debugPrint('Could not configure Chrome-like WebView settings: $error');
    }
  }

  String? _buildChromeLikeUserAgent(String? userAgent) {
    final String normalizedUserAgent = _cleanString(userAgent);
    if (normalizedUserAgent.isEmpty) {
      return null;
    }

    return normalizedUserAgent
        .replaceAll('; wv)', ')')
        .replaceAll(' wv)', ')')
        .replaceAll(RegExp(r'\s+Version/\d+(?:\.\d+)*'), '')
        .replaceAll(RegExp(r'\s{2,}'), ' ')
        .trim();
  }

  Future<void> _initializeWebView() async {
    await _controller.setJavaScriptMode(JavaScriptMode.unrestricted);
    await _controller.setBackgroundColor(_appBackgroundColor);
    await _configureChromeLikeWebView();
    await _controller.addJavaScriptChannel(
      _appBridgeChannelName,
      onMessageReceived: (JavaScriptMessage message) {
        unawaited(_handleAppBridgeMessage(message.message));
      },
    );
    await _controller.setNavigationDelegate(
      NavigationDelegate(
        onNavigationRequest: (NavigationRequest request) async {
          final Uri? uri = Uri.tryParse(request.url);
          if (uri == null) {
            return NavigationDecision.navigate;
          }

          if (await _handleExternalBrowserBridge(uri)) {
            return NavigationDecision.prevent;
          }

          if (await _handleGoogleAuthNavigation(uri)) {
            return NavigationDecision.prevent;
          }

          return NavigationDecision.navigate;
        },
        onPageStarted: (_) => _setLoadingState(true),
        onPageFinished: (_) {
          _isWebViewReady = true;
          _setLoadingState(false);
          unawaited(_ensureNotificationPermission());
          unawaited(_openPendingNotificationTargetIfNeeded());
        },
        onWebResourceError: (WebResourceError error) {
          if (error.isForMainFrame != true) {
            return;
          }

          debugPrint('Page failed to load: ${error.description}');
          _setLoadingState(false);
        },
      ),
    );
    await _controller.loadRequest(await _resolveInitialLaunchUri());
  }

  Future<void> _handleAppBridgeMessage(String message) async {
    dynamic decodedMessage;
    try {
      decodedMessage = jsonDecode(message);
    } catch (error) {
      debugPrint('Ignoring invalid app bridge message: $error');
      return;
    }

    if (decodedMessage is! Map<String, dynamic>) {
      return;
    }

    switch (decodedMessage['type']) {
      case 'google-sign-in':
        await _handleNativeGoogleSignInRequest();
      case _appBellNotificationSyncType:
        await _handleBellNotificationSync(decodedMessage);
      case _appShowLocalNotificationType:
        await _handleShowLocalNotification(decodedMessage);
      case _appSessionSyncType:
        await _handleSessionSync(decodedMessage);
      default:
        return;
    }
  }

  Future<void> _handleNativeGoogleSignInRequest() async {
    if (_isNativeGoogleSignInInProgress) {
      return;
    }

    _isNativeGoogleSignInInProgress = true;
    try {
      await _googleSignInReady;
      if (!_googleSignIn.supportsAuthenticate()) {
        await _dispatchGoogleSignInResult(<String, Object?>{
          'status': 'error',
          'code': 'uiUnavailable',
          'message': 'Google sign-in is not supported on this device.',
        });
        return;
      }

      try {
        await _googleSignIn.signOut();
      } catch (error) {
        debugPrint('Native Google sign-out before login failed: $error');
      }

      final GoogleSignInAccount account = await _googleSignIn.authenticate();
      final String? idToken = account.authentication.idToken;
      if (idToken == null || idToken.isEmpty) {
        await _dispatchGoogleSignInResult(<String, Object?>{
          'status': 'error',
          'code': 'missingIdToken',
          'message': 'Google sign-in completed without returning an ID token.',
        });
        return;
      }

      await _dispatchGoogleSignInResult(<String, Object?>{
        'status': 'success',
        'idToken': idToken,
      });
    } on GoogleSignInException catch (error) {
      await _dispatchGoogleSignInResult(<String, Object?>{
        'status': 'error',
        'code': error.code.name,
        'message': error.description ?? error.toString(),
      });
    } catch (error) {
      await _dispatchGoogleSignInResult(<String, Object?>{
        'status': 'error',
        'code': 'unknownError',
        'message': error.toString(),
      });
    } finally {
      _isNativeGoogleSignInInProgress = false;
    }
  }

  Future<void> _dispatchGoogleSignInResult(Map<String, Object?> detail) async {
    await _dispatchWebEvent(_appGoogleSignInResultEvent, detail);
  }

  Future<void> _dispatchWebEvent(
    String eventName,
    Map<String, Object?> detail,
  ) async {
    final String detailJson = jsonEncode(detail);
    final String eventNameJson = jsonEncode(eventName);
    try {
      await _controller.runJavaScript(
        'window.dispatchEvent(new CustomEvent($eventNameJson, { detail: $detailJson }));',
      );
    } catch (error) {
      debugPrint('Could not dispatch $eventName to the web app: $error');
    }
  }

  Future<bool> _handleExternalBrowserBridge(Uri uri) async {
    if (uri.scheme != _externalBrowserBridgeScheme ||
        uri.host != _externalBrowserBridgeHost) {
      return false;
    }

    final String? target = uri.queryParameters['url'];
    if (target == null || target.isEmpty) {
      return true;
    }

    final Uri? targetUri = Uri.tryParse(target);
    if (targetUri == null) {
      return true;
    }

    await _launchExternally(targetUri);
    return true;
  }

  Future<bool> _handleGoogleAuthNavigation(Uri uri) async {
    if (!_isGoogleAuthUri(uri)) {
      return false;
    }

    await _launchExternally(uri);
    return true;
  }

  bool _isGoogleAuthUri(Uri uri) {
    final String host = uri.host.toLowerCase();
    if (host == 'accounts.google.com') {
      return true;
    }

    return false;
  }

  Future<void> _launchExternally(Uri uri) async {
    final bool didLaunch = await launchUrl(
      uri,
      mode: LaunchMode.externalApplication,
    );
    if (!didLaunch) {
      debugPrint('Could not open external URL: $uri');
    }
  }

  void _setLoadingState(bool isLoading) {
    if (!mounted || _isLoading == isLoading) {
      return;
    }

    setState(() {
      _isLoading = isLoading;
    });
  }

  Future<void> _handleBackNavigation() async {
    if (_isHandlingBackNavigation) {
      return;
    }

    _isHandlingBackNavigation = true;
    try {
      if (await _controller.canGoBack()) {
        await _controller.goBack();
        return;
      }

      await SystemNavigator.pop();
    } finally {
      _isHandlingBackNavigation = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    final EdgeInsets viewPadding = MediaQuery.viewPaddingOf(context);

    return PopScope<Object?>(
      canPop: false,
      onPopInvokedWithResult: (bool didPop, Object? result) {
        if (didPop) {
          return;
        }

        unawaited(_handleBackNavigation());
      },
      child: Scaffold(
        body: ColoredBox(
          color: _appBackgroundColor,
          child: Padding(
            padding: EdgeInsets.only(
              top: viewPadding.top,
              bottom: viewPadding.bottom,
            ),
            child: Stack(
              fit: StackFit.expand,
              children: [
                _webView,
                if (_isLoading)
                  const ColoredBox(
                    color: _appBackgroundColor,
                    child: Center(child: CircularProgressIndicator()),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
