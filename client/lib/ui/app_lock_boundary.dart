import 'package:flutter/material.dart';
import '../state/app_controller.dart';
import 'theme.dart';
import 'notifications_page.dart';

class AppLockBoundary extends StatefulWidget {
  final AppController app;
  final Widget child;
  const AppLockBoundary({super.key, required this.app, required this.child});
  @override
  State<AppLockBoundary> createState() => _AppLockBoundaryState();
}

class _AppLockBoundaryState extends State<AppLockBoundary>
    with WidgetsBindingObserver {
  bool prompted = false;
  bool foreground = true, pendingInbox = false;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    widget.app.notifications?.onOpenInbox = () {
      pendingInbox = true;
      if (mounted) setState(() {});
    };
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    foreground = state == AppLifecycleState.resumed;
    widget.app.lock?.lifecycle(state);
    widget.app.notifications?.visibility(
      foreground: foreground,
      covered:
          widget.app.lock?.locked == true || widget.app.lock?.covered == true,
    );
  }

  void openInbox() {
    widget.app.notifications?.dismissBanner();
    if (widget.app.account == null || widget.app.lock?.locked == true) {
      pendingInbox = true;
      return;
    }
    widget.app.navigatorKey.currentState?.push(
      MaterialPageRoute<void>(
        builder: (_) => NotificationsPage(app: widget.app),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final lock = widget.app.lock;
    return ListenableBuilder(
      listenable: Listenable.merge([
        ?lock,
        if (widget.app.notifications != null) widget.app.notifications!,
      ]),
      builder: (context, _) {
        widget.app.notifications?.visibility(
          foreground: foreground,
          covered: lock?.locked == true || lock?.covered == true,
        );
        if (pendingInbox &&
            widget.app.account != null &&
            lock?.locked != true) {
          pendingInbox = false;
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) openInbox();
          });
        }
        if (lock?.locked == true && !prompted && !lock!.authenticating) {
          prompted = true;
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) lock.unlock();
          });
        }
        if (lock?.locked != true) prompted = false;
        return Stack(
          children: [
            ExcludeSemantics(
              excluding: lock?.locked == true || lock?.covered == true,
              child: Offstage(
                offstage: lock?.locked == true || lock?.covered == true,
                child: widget.child,
              ),
            ),
            if (widget.app.notifications?.banner != null &&
                lock?.locked != true &&
                lock?.covered != true)
              Positioned(
                top: MediaQuery.paddingOf(context).top + 8,
                left: 12,
                right: 12,
                child: Material(
                  elevation: 8,
                  color: paper,
                  borderRadius: BorderRadius.circular(18),
                  child: ListTile(
                    onTap: openInbox,
                    leading: const Icon(
                      Icons.notifications_active_outlined,
                      color: blue,
                    ),
                    title: Text(
                      widget.app.notifications!.banner!['title'] as String,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    subtitle: Text(
                      widget.app.notifications!.banner!['body'] as String,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    trailing: IconButton(
                      tooltip: 'Dismiss notification',
                      onPressed: widget.app.notifications!.dismissBanner,
                      icon: const Icon(Icons.close),
                    ),
                  ),
                ),
              ),
            if (lock != null && (lock.covered || lock.locked))
              Positioned.fill(
                child: GlassBackground(
                  child: Material(
                    color: Colors.transparent,
                    child: SafeArea(
                      child: Center(
                        child: SingleChildScrollView(
                          padding: const EdgeInsets.all(28),
                          child: ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 400),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const AppLogo(size: 68),
                                const SizedBox(height: 24),
                                const Text(
                                  'SHK Connect is locked',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    fontSize: 25,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                const SizedBox(height: 12),
                                const Text(
                                  'Use fingerprint, face authentication or your device PIN, pattern or passcode.',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    color: mutedInk,
                                    height: 1.5,
                                  ),
                                ),
                                if (lock.error != null)
                                  Padding(
                                    padding: const EdgeInsets.only(top: 20),
                                    child: Text(
                                      lock.error!,
                                      textAlign: TextAlign.center,
                                    ),
                                  ),
                                const SizedBox(height: 28),
                                if (!lock.covered)
                                  FilledButton.icon(
                                    onPressed: lock.authenticating
                                        ? null
                                        : lock.unlock,
                                    icon: const Icon(Icons.fingerprint),
                                    label: Text(
                                      lock.authenticating
                                          ? 'Verifying…'
                                          : 'Unlock',
                                    ),
                                  ),
                                if (!lock.covered)
                                  TextButton(
                                    onPressed: lock.authenticating
                                        ? null
                                        : () async {
                                            try {
                                              await widget.app.logout();
                                            } catch (_) {}
                                          },
                                    child: const Text('Use account password'),
                                  ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}
