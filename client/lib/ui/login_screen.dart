import 'package:flutter/material.dart';
import '../state/app_controller.dart';
import 'theme.dart';

class LoginScreen extends StatefulWidget {
  final AppController app;
  const LoginScreen({super.key, required this.app});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final identifier = TextEditingController(),
      password = TextEditingController();
  final form = GlobalKey<FormState>();
  bool busy = false, visible = false;
  String? error;
  @override
  void dispose() {
    identifier.dispose();
    password.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    if (!form.currentState!.validate()) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await widget.app.login(identifier.text.trim(), password.text);
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => GlassBackground(
    child: Scaffold(
      backgroundColor: Colors.transparent,
      body: LayoutBuilder(
        builder: (context, size) => Row(
          children: [
            if (size.maxWidth >= 1000)
              Expanded(
                child: Container(
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        Color(0x40C2E3FC),
                        Color(0x30FFFFFF),
                        Color(0x60E2F1FD),
                      ],
                    ),
                  ),
                  padding: const EdgeInsets.all(64),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const _Brand(light: true),
                      const Spacer(),
                      const Text(
                        'Good work starts\nwith connection.',
                        style: TextStyle(
                          fontSize: 54,
                          height: 1.15,
                          fontWeight: FontWeight.w700,
                          color: ink,
                        ),
                      ),
                      const SizedBox(height: 24),
                      const Text(
                        'One place for your conversations, your team,\nand everything you’re moving forward.',
                        style: TextStyle(
                          color: mutedInk,
                          fontSize: 18,
                          height: 1.6,
                        ),
                      ),
                      const SizedBox(height: 48),
                      Container(
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          color: const Color(0xA6FFFFFF),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: Colors.white.withValues(alpha: .85),
                          ),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.devices_rounded, color: blue, size: 36),
                            SizedBox(width: 20),
                            Expanded(
                              child: Text(
                                'Your workspace. Wherever you are.\nOn your phone, tablet, and desktop.',
                                style: TextStyle(color: ink, height: 1.6),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Spacer(),
                      const Text(
                        'SHK CONNECT  /  A MORE CONNECTED WORKDAY',
                        style: TextStyle(
                          color: mutedInk,
                          letterSpacing: 1.6,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            Expanded(
              child: SafeArea(
                child: Center(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(28),
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 460),
                      child: GlassPanel(
                        radius: 28,
                        child: Padding(
                          padding: EdgeInsets.all(
                            size.maxWidth < 400 ? 22 : 32,
                          ),
                          child: Form(
                            key: form,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                if (size.maxWidth < 1000) ...[
                                  const _Brand(),
                                  const SizedBox(height: 36),
                                ],
                                const Text(
                                  'Welcome back',
                                  style: TextStyle(
                                    fontSize: 34,
                                    fontWeight: FontWeight.w700,
                                    color: ink,
                                  ),
                                ),
                                const SizedBox(height: 12),
                                const Text(
                                  'Sign in to your team workspace.',
                                  style: TextStyle(
                                    color: mutedInk,
                                    fontSize: 16,
                                  ),
                                ),
                                const SizedBox(height: 36),
                                TextFormField(
                                  controller: identifier,
                                  enabled: !busy,
                                  autofillHints: const [AutofillHints.username],
                                  decoration: const InputDecoration(
                                    labelText: 'Email or username',
                                    prefixIcon: Icon(Icons.person_outline),
                                  ),
                                  textInputAction: TextInputAction.next,
                                  validator: (v) => v!.trim().isEmpty
                                      ? 'Enter your email or username'
                                      : null,
                                ),
                                const SizedBox(height: 20),
                                TextFormField(
                                  controller: password,
                                  enabled: !busy,
                                  obscureText: !visible,
                                  autofillHints: const [AutofillHints.password],
                                  decoration: InputDecoration(
                                    labelText: 'Password',
                                    prefixIcon: const Icon(Icons.lock_outline),
                                    suffixIcon: IconButton(
                                      tooltip: visible
                                          ? 'Hide password'
                                          : 'Show password',
                                      onPressed: () =>
                                          setState(() => visible = !visible),
                                      icon: Icon(
                                        visible
                                            ? Icons.visibility_off_outlined
                                            : Icons.visibility_outlined,
                                      ),
                                    ),
                                  ),
                                  onFieldSubmitted: (_) =>
                                      busy ? null : submit(),
                                  validator: (v) =>
                                      v!.isEmpty ? 'Enter your password' : null,
                                ),
                                if (error ?? widget.app.error
                                    case final String message)
                                  Padding(
                                    padding: const EdgeInsets.only(top: 18),
                                    child: Text(
                                      message,
                                      style: TextStyle(
                                        color: Theme.of(
                                          context,
                                        ).colorScheme.error,
                                      ),
                                    ),
                                  ),
                                const SizedBox(height: 28),
                                SizedBox(
                                  width: double.infinity,
                                  child: FilledButton(
                                    onPressed: busy ? null : submit,
                                    child: busy
                                        ? const SizedBox(
                                            height: 20,
                                            width: 20,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2,
                                            ),
                                          )
                                        : const Text('Sign in to workspace  →'),
                                  ),
                                ),
                                const SizedBox(height: 28),
                                const Text(
                                  'Need access? Contact your workspace administrator.',
                                  style: TextStyle(
                                    color: mutedInk,
                                    height: 1.5,
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
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class _Brand extends StatelessWidget {
  final bool light;
  const _Brand({this.light = false});
  @override
  Widget build(BuildContext context) => Row(
    children: [
      const AppLogo(size: 64),
      const SizedBox(width: 12),
      Flexible(
        child: Text(
          'SHK Connect',
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: ink,
            fontSize: 23,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    ],
  );
}
