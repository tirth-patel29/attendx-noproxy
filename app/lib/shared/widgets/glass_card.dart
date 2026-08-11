// lib/shared/widgets/glass_card.dart
// Light-mode card surface: white fill, hairline gray border, soft shadow.
import 'package:flutter/material.dart';
import 'package:attendance_gateway/main.dart';

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
    final borderRadius = radius ?? BorderRadius.circular(18);
    final card = AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      padding: padding,
      decoration: BoxDecoration(
        color: tint ?? Colors.white,
        borderRadius: borderRadius,
        border: Border.all(color: const Color(0xFFE7E9F0)),
        boxShadow: [
          BoxShadow(
            color: kPrimary.withValues(alpha: 0.04),
            blurRadius: 18,
            offset: const Offset(0, 8),
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