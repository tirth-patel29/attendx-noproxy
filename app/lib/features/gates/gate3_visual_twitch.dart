// lib/features/gates/gate3_visual_twitch.dart
/// Gate 3: Visual Micro-Twitch
/// 3-second rotating QR token via WebSocket/polling
/// Defeats static photos (WhatsApp photo attack)

import 'package:flutter/material.dart';
import 'package:attendance_gateway/core/constants/app_constants.dart';
import 'package:attendance_gateway/core/services/api_service.dart';

enum Gate3Status {
  waitingForToken,
  tokenReceived,
  expired,
  error,
}

class Gate3VisualTwitch {
  /// Stream of active tokens from the metronome (polling or WebSocket)
  /// The metronome mints a new base62 token every 3 seconds
  static Stream<String> tokenStream(String sessionUuid) async* {
    // Initial fetch
    String? lastToken;
    
    while (true) {
      try {
        final tokens = await ApiService.getSessionTokens(sessionUuid);
        final tokensList = tokens['tokens'] as List? ?? [];
        
        if (tokensList.isNotEmpty) {
          final latestToken = tokensList.last['token_val'] as String;
          if (latestToken != lastToken) {
            lastToken = latestToken;
            yield latestToken;
          }
        }
      } catch (e) {
        // Silently retry
      }
      
      await Future.delayed(Duration(milliseconds: AppConstants.metronomeIntervalMs ~/ 2));
    }
  }

  /// Get the current active token for a session
  static Future<String?> getCurrentToken(String sessionUuid) async {
    try {
      final tokens = await ApiService.getSessionTokens(sessionUuid);
      final tokensList = tokens['tokens'] as List? ?? [];
      if (tokensList.isNotEmpty) {
        return tokensList.last['token_val'] as String;
      }
    } catch (e) {
      // Ignore
    }
    return null;
  }

  /// Token validation
  /// Checks if token is within validity window (5 seconds by default)
  static bool isTokenValid(String tokenVal, String sessionUuid, int createdAtEpoch) {
    final now = DateTime.now().millisecondsSinceEpoch;
    final ageMs = now - createdAtEpoch;
    return ageMs <= AppConstants.tokenValidityWindowMs;
  }

  /// Get display info for Gate 3 UI
  static Future<Map<String, dynamic>> getGate3Info(String sessionUuid) async {
    String? token = await getCurrentToken(sessionUuid);
    
    if (token != null) {
      return {
        'title': AppConstants.gate3Title,
        'description': AppConstants.gate3Description,
        'message': 'Token ready. Point camera at QR code.',
        'icon': '📱',
        'isPassed': true,
        'token': token,
        'status': Gate3Status.tokenReceived.name,
      };
    } else {
      return {
        'title': AppConstants.gate3Title,
        'description': AppConstants.gate3Description,
        'message': 'Waiting for token from metronome...',
        'icon': '⏳',
        'isPassed': false,
        'token': null,
        'status': Gate3Status.waitingForToken.name,
      };
    }
  }
}

/// Widget for displaying the rotating QR token
class TokenDisplayWidget extends StatefulWidget {
  final String sessionUuid;
  final Function(String)? onTokenChanged;
  
  const TokenDisplayWidget({
    super.key,
    required this.sessionUuid,
    this.onTokenChanged,
  });

  @override
  State<TokenDisplayWidget> createState() => _TokenDisplayWidgetState();
}

class _TokenDisplayWidgetState extends State<TokenDisplayWidget> {
  String? _currentToken;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _startPolling();
  }

  void _startPolling() {
    _timer = Timer.periodic(
      Duration(milliseconds: AppConstants.metronomeIntervalMs ~/ 2),
      (_) => _fetchToken(),
    );
    _fetchToken();
  }

  Future<void> _fetchToken() async {
    try {
      final token = await Gate3VisualTwitch.getCurrentToken(widget.sessionUuid);
      if (token != null && token != _currentToken) {
        setState(() => _currentToken = token);
        widget.onTokenChanged?.call(token);
      }
    } catch (e) {
      // Ignore
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_currentToken == null) {
      return const Center(child: CircularProgressIndicator());
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          'Scan this QR code',
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.1),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Text(
            _currentToken!,
            style: const TextStyle(
              fontSize: 48,
              fontWeight: FontWeight.bold,
              letterSpacing: 8,
              fontFamily: 'monospace',
            ),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Refreshes every 3 seconds',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: Colors.grey[600],
          ),
        ),
      ],
    );
  }
}