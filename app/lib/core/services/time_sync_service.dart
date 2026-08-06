// lib/core/services/time_sync_service.dart
/// Time synchronization service using Cristian's Algorithm
/// Computes drift offset between client and server clocks
import 'dart:async';
import 'package:attendance_gateway/core/constants/app_constants.dart';
import 'package:attendance_gateway/core/services/secure_storage_service.dart';

class TimeSyncService {
  static final TimeSyncService _instance = TimeSyncService._internal();
  factory TimeSyncService() => _instance;
  TimeSyncService._internal();

  int _driftOffsetMs = 0;
  DateTime? _lastSync;
  bool _isSyncing = false;

  int get driftOffsetMs => _driftOffsetMs;
  DateTime? get lastSync => _lastSync;

  /// Initialize from stored drift offset
  Future<void> initialize() async {
    _driftOffsetMs = await SecureStorageService.getDriftOffset();
  }

  /// Get current server time estimate using Cristian's Algorithm
  /// 
  /// Cristian's Algorithm:
  /// 1. Client records T0 (send time)
  /// 2. Server receives, records server time, sends response
  /// 3. Client receives at T1 (receive time)
  /// 4. RTT = T1 - T0
  /// 5. Server time at midpoint = server_time + RTT/2
  /// 5. Drift offset = (server_time + RTT/2) - T0
  Future<bool> syncTime({int retries = AppConstants.timeSyncRetries}) async {
    if (_isSyncing) return false;
    _isSyncing = true;

    for (int attempt = 0; attempt < retries; attempt++) {
      try {
        // T0 - Client send time (client epoch ms)
        final t0 = DateTime.now().millisecondsSinceEpoch;
        
        // Make HTTP request to time-sync endpoint
        // Using a simple HTTP GET since we just need server time
        final response = await _makeTimeSyncRequest();
        
        // T1 - Client receive time
        final t1 = DateTime.now().millisecondsSinceEpoch;
        
        // Parse server time from response
        final serverEpoch = response['server_epoch'] as int;
        
        // Cristian's Algorithm calculation
        final rtt = t1 - t0;
        final serverTimeAtMidpoint = serverEpoch + (rtt / 2).round();
        final driftOffset = serverTimeAtMidpoint - t0;
        
        // Store drift offset
        _driftOffsetMs = driftOffset;
        _lastSync = DateTime.now();
        await SecureStorageService.saveDriftOffset(driftOffset);
        
        _isSyncing = false;
        return true;
      } catch (e) {
        if (attempt == retries - 1) {
          _isSyncing = false;
          return false;
        }
        // Exponential backoff
        await Future.delayed(Duration(milliseconds: 200 * (attempt + 1)));
      }
    }
    
    _isSyncing = false;
    return false;
  }

  /// Make HTTP request to time-sync endpoint
  Future<Map<String, dynamic>> _makeTimeSyncRequest() async {
    // This will be implemented with dio/http in the actual API service
    // For now, return mock - actual implementation in api_service.dart
    throw UnimplementedError('Use ApiService.timeSync() instead');
  }

  /// Get current estimated server time (client time + drift offset)
  int getEstimatedServerTimeMs() {
    return DateTime.now().millisecondsSinceEpoch + _driftOffsetMs;
  }

  /// Check if time sync is fresh
  bool isTimeSyncFresh() {
    if (_lastSync == null) return false;
    final age = DateTime.now().difference(_lastSync!);
    return age < AppConstants.timeSyncInterval;
  }

  /// Force periodic time sync
  Timer? _periodicSyncTimer;
  
  void startPeriodicSync() {
    _periodicSyncTimer?.cancel();
    _periodicSyncTimer = Timer.periodic(AppConstants.timeSyncInterval, (_) {
      syncTime();
    });
  }

  void stopPeriodicSync() {
    _periodicSyncTimer?.cancel();
  }

  void dispose() {
    _periodicSyncTimer?.cancel();
  }
}