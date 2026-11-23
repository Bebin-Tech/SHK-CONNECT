import 'dart:ui' show ImageFilter;
import 'package:flutter/material.dart';

const ink = Color(0xFF193450);
const mutedInk = Color(0xFF5D7690);
const blue = Color(0xFF2875C7);
const sidebar = Color(0xFFDCECFB);
const rail = Color(0xFFCCE3F8);
const selection = Color(0xFFC6E2FF);
const paper = Color(0xFFF8FAFD);
const blueBorder = Color(0xFFC6DCEE);

class GlassBackground extends StatelessWidget {
  final Widget child;
  const GlassBackground({super.key, required this.child});
  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: const BoxDecoration(
      gradient: LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [Color(0xFFD2E8FC), Color(0xFFF8FAFD), Color(0xFFE1EDFA)],
      ),
    ),
    child: child,
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
      filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Colors.white.withValues(alpha: .76),
              color.withValues(alpha: .62),
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
      backgroundColor: paper,
      foregroundColor: ink,
      centerTitle: false,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: const Color(0xFFEDF4FC),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: blueBorder),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 18),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    ),
    dividerTheme: const DividerThemeData(color: blueBorder, thickness: 1),
    cardTheme: CardThemeData(
      elevation: 0,
      color: const Color(0xFFFDFEFF),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
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
