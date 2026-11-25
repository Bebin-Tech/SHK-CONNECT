import 'dart:ui' show ImageFilter;
import 'package:flutter/material.dart';

const ink = Color(0xFF193450);
const mutedInk = Color(0xFF5D7690);
const blue = Color(0xFF2875C7);
const sidebar = Color(0xFFEAF4FC);
const rail = Color(0xFFE2EFFB);
const selection = Color(0x663F9CEB);
const paper = Color(0xFFF8FBFE);
const blueBorder = Color(0x333E83B8);
const glassSurface = Color(0x80FFFFFF);

class GlassBackground extends StatelessWidget {
  final Widget child;
  const GlassBackground({super.key, required this.child});
  @override
  Widget build(BuildContext context) => Stack(
    fit: StackFit.expand,
    children: [
      const DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFFEEF7FF), Color(0xFFFCFDFE), Color(0xFFEAF4FD)],
          ),
        ),
      ),
      const Positioned(
        top: -140,
        right: -120,
        child: _GlassGlow(color: Color(0x663FA9F5), size: 640),
      ),
      const Positioned(
        bottom: -180,
        left: -160,
        child: _GlassGlow(color: Color(0x5377C7F4), size: 700),
      ),
      const Positioned(
        top: 220,
        left: 80,
        child: _GlassGlow(color: Color(0x66FFFFFF), size: 480),
      ),
      child,
    ],
  );
}

class _GlassGlow extends StatelessWidget {
  final Color color;
  final double size;
  const _GlassGlow({required this.color, required this.size});
  @override
  Widget build(BuildContext context) => IgnorePointer(
    child: SizedBox.square(
      dimension: size,
      child: DecoratedBox(
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(colors: [color, color.withValues(alpha: 0)]),
        ),
      ),
    ),
  );
}

class GlassPanel extends StatelessWidget {
  final Widget child;
  final Color color;
  final double radius;
  const GlassPanel({
    super.key,
    required this.child,
    this.color = sidebar,
    this.radius = 0,
  });
  @override
  Widget build(BuildContext context) => ClipRRect(
    borderRadius: BorderRadius.circular(radius),
    child: BackdropFilter(
      filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Colors.white.withValues(alpha: .56),
              color.withValues(alpha: .28),
            ],
          ),
          border: Border.all(color: Colors.white.withValues(alpha: .85)),
          borderRadius: BorderRadius.circular(radius),
        ),
        child: child,
      ),
    ),
  );
}

class AppLogo extends StatelessWidget {
  final double size;
  const AppLogo({super.key, this.size = 40});
  @override
  Widget build(BuildContext context) => ClipRRect(
    borderRadius: BorderRadius.circular(size / 6),
    child: Image.asset(
      'assets/branding/shk_logo_new.png',
      width: size,
      height: size,
      fit: BoxFit.contain,
      semanticLabel: 'SHK Connect logo',
    ),
  );
}

ThemeData connectTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: blue,
    brightness: Brightness.light,
  );
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme.copyWith(
      primary: blue,
      onPrimary: Colors.white,
      surface: paper,
      onSurface: ink,
    ),
    scaffoldBackgroundColor: paper,
    fontFamily: 'Roboto',
    appBarTheme: const AppBarTheme(
      backgroundColor: glassSurface,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      foregroundColor: ink,
      centerTitle: false,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: const Color(0x99FFFFFF),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: blueBorder),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: blueBorder),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: blue, width: 1.5),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 18),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
    ),
    dividerTheme: const DividerThemeData(color: blueBorder, thickness: 1),
    cardTheme: CardThemeData(
      elevation: 0,
      color: const Color(0xB3FFFFFF),
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: const BorderSide(color: blueBorder),
      ),
    ),
  );
}

class Avatar extends StatelessWidget {
  final String name;
  final double radius;
  const Avatar(this.name, {super.key, this.radius = 20});
  @override
  Widget build(BuildContext context) => CircleAvatar(
    radius: radius,
    backgroundColor: const Color(0xFFD5E9FC),
    foregroundColor: blue,
    child: Text(
      name.isEmpty ? '?' : name.substring(0, 1).toUpperCase(),
      style: const TextStyle(fontWeight: FontWeight.w700),
    ),
  );
}

void showError(BuildContext context, Object error) {
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: Text(error.toString()),
      behavior: SnackBarBehavior.floating,
    ),
  );
}

class EmptyState extends StatelessWidget {
  final IconData icon;
  final String title, subtitle;
  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
  });
  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) => SingleChildScrollView(
      child: ConstrainedBox(
        constraints: BoxConstraints(minHeight: constraints.maxHeight),
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 44, color: blue),
                const SizedBox(height: 20),
                Text(
                  title,
                  style: Theme.of(context).textTheme.titleLarge,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  subtitle,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.black54),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}
