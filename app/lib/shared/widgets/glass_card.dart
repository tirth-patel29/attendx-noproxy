// lib/shared/widgets/glass_card.dart
// Reusable "glassmorphism" surface: translucent fill, hairline border,
// soft elevation — the shared card language of the app.
import 'package:flutter/material.dart';

class GlassCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final Color? tint;
  final BorderRadius? radius;
  final VoidCallback? onTap;

  const GlassCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.tint,
    this.radius,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final borderRadius = radius ?? BorderRadius.circular(20);
    final card = AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      padding: padding,
      decoration: BoxDecoration(
        color: tint ?? Colors.white.withValues(alpha: 0.045),
        borderRadius: borderRadius,
        border: Border.all(color: Colors.white.withValues(alpha: 0.09)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.35),
            blurRadius: 24,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: child,
    );
    if (onTap == null) return card;
    return InkWell(
      onTap: onTap,
      borderRadius: borderRadius,
      child: card,
    );
  }
}