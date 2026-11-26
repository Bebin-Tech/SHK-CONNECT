import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

class PushConfiguration {
  static const projectId = String.fromEnvironment(
    'FIREBASE_PROJECT_ID',
    defaultValue: 'shk-connect-cb6d2',
  );
  static const senderId = String.fromEnvironment(
    'FIREBASE_MESSAGING_SENDER_ID',
  );
  static const androidAppId = String.fromEnvironment(
    'FIREBASE_ANDROID_APP_ID',
    defaultValue: '1:847570773571:android:6e6e890e6b0ce8d55b96f6',
  );
  static const iosAppId = String.fromEnvironment(
    'FIREBASE_IOS_APP_ID',
    defaultValue: '1:847570773571:ios:3369476308f3e3e05b96f6',
  );
  static const apiKey = String.fromEnvironment(
    'FIREBASE_API_KEY',
    defaultValue: 'AIzaSyDTu7RxnqbUW3glmQ8IHJKHOlqtjuB9aJk',
  );
  static const iosApiKey = String.fromEnvironment('FIREBASE_IOS_API_KEY');
  static bool get mobile =>
      !kIsWeb &&
      {
        TargetPlatform.android,
        TargetPlatform.iOS,
      }.contains(defaultTargetPlatform);
  static FirebaseOptions? get options {
    if (!mobile || senderId.isEmpty) return null;
    final ios = defaultTargetPlatform == TargetPlatform.iOS;
    final appId = ios ? iosAppId : androidAppId;
    final key = ios && iosApiKey.isNotEmpty ? iosApiKey : apiKey;
    if (appId.isEmpty || key.isEmpty) return null;
    return FirebaseOptions(
      apiKey: key,
      appId: appId,
      messagingSenderId: senderId,
      projectId: projectId,
      iosBundleId: ios ? 'com.shkconnect.shkConnect' : null,
    );
  }
}
