import 'package:flutter/material.dart';
import '../notifications/notification_controller.dart';
import '../state/app_controller.dart';
import 'theme.dart';

class SettingsPage extends StatefulWidget {
  final AppController app;
  const SettingsPage({super.key, required this.app});
  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  bool busy = false;
  Future<void> act(Future<void> Function() action) async {
    if (busy) return;
    setState(() => busy = true);
    try {
      await action();
    } catch (error) {
      if (mounted) showError(context, error);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final lock = widget.app.lock, notifications = widget.app.notifications;
    return GlassBackground(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(title: const Text('Settings')),
        body: ListenableBuilder(
          listenable: Listenable.merge([?lock, ?notifications]),
          builder: (context, _) => ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (lock?.supportedPlatform == true)
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(8),
                    child: Column(
                      children: [
                        const ListTile(
                          leading: Icon(Icons.fingerprint, color: blue),
                          title: Text('App lock'),
                          subtitle: Text(
                            'Use the device’s fingerprint, face, PIN, pattern or passcode.',
                          ),
                        ),
                        SwitchListTile(
                          title: const Text('Lock this device'),
                          subtitle: const Text(
                            'Enabled automatically after sign-in.',
                          ),
                          value: lock!.enabled,
                          onChanged: busy
                              ? null
                              : (v) => act(() => lock.setEnabled(v)),
                        ),
                        ListTile(
                          title: const Text('Lock after leaving the app'),
                          subtitle: DropdownButton<int>(
                            value: lock.timeoutSeconds,
                            isExpanded: true,
                            items: const [
                              DropdownMenuItem(
                                value: 0,
                                child: Text('Immediately'),
                              ),
                              DropdownMenuItem(
                                value: 30,
                                child: Text('30 seconds'),
                              ),
                              DropdownMenuItem(
                                value: 60,
                                child: Text('1 minute'),
                              ),
                              DropdownMenuItem(
                                value: 300,
                                child: Text('5 minutes'),
                              ),
                            ],
                            onChanged: !lock.enabled || busy
                                ? null
                                : (v) => act(() => lock.setTimeout(v!)),
                          ),
                        ),
                        const Padding(
                          padding: EdgeInsets.all(16),
                          child: Text(
                            'Reopening the app always requires verification when app lock is on. Biometric data and your device PIN stay with the operating system.',
                            style: TextStyle(color: mutedInk, height: 1.5),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              if (notifications != null)
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(8),
                    child: Column(
                      children: [
                        const ListTile(
                          leading: Icon(
                            Icons.notifications_outlined,
                            color: blue,
                          ),
                          title: Text('Notifications'),
                        ),
                        SwitchListTile(
                          title: const Text('Allow alerts'),
                          value: notifications.preferences['enabled'] == true,
                          onChanged: busy
                              ? null
                              : (v) => act(
                                  () => notifications.savePreferences({
                                    ...notifications.preferences,
                                    'enabled': v,
                                  }),
                                ),
                        ),
                        SwitchListTile(
                          title: const Text('Notification sound'),
                          value: notifications.preferences['sound'] == true,
                          onChanged: busy
                              ? null
                              : (v) => act(
                                  () => notifications.savePreferences({
                                    ...notifications.preferences,
                                    'sound': v,
                                  }),
                                ),
                        ),
                        SwitchListTile(
                          title: const Text(
                            'Show previews in system notifications',
                          ),
                          subtitle: const Text(
                            'Off keeps notification text private on the lock screen.',
                          ),
                          value:
                              notifications.preferences['show_preview'] == true,
                          onChanged: busy
                              ? null
                              : (v) => act(
                                  () => notifications.savePreferences({
                                    ...notifications.preferences,
                                    'show_preview': v,
                                  }),
                                ),
                        ),
                        const Divider(),
                        for (final entry in notificationCategories.entries)
                          SwitchListTile(
                            title: Text(entry.value),
                            value:
                                (notifications.preferences['categories']
                                        as Map? ??
                                    {})[entry.key] !=
                                false,
                            onChanged: busy
                                ? null
                                : (v) => act(
                                    () => notifications.savePreferences({
                                      ...notifications.preferences,
                                      'categories': {
                                        ...notifications
                                                    .preferences['categories']
                                                as Map? ??
                                            {},
                                        entry.key: v,
                                      },
                                    }),
                                  ),
                          ),
                        ListTile(
                          title: Text(
                            notifications.permissionGranted
                                ? 'System notifications allowed'
                                : 'Enable system notifications',
                          ),
                          subtitle: Text(
                            notifications.pushReady
                                ? 'Background notifications are connected.'
                                : 'Background notifications are not connected on this device yet. In-app updates remain available.',
                          ),
                          trailing: TextButton(
                            onPressed: busy
                                ? null
                                : () => act(notifications.requestPermission),
                            child: const Text('Allow'),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
