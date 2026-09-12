// src/components/ClassroomProjector.tsx
// AttendX Classroom Projector — Minimalist High-Fidelity Projector Screen
//
// QR Rotation Protocol:
// - Total Period: 3.0 seconds (3000 ms).
// - Anchor Phase (2.9s / 2900ms): Statically displays `ATTN:${sessionId}`.
//   Student phone cameras lock focus, exposure, and alignment on this anchor.
// - Flash Phase (0.1s / 100ms): Briefly displays `ATTN:${sessionId}:${activeToken}`.
//   Mobile camera captures the 100ms token visual seal.
// - Appearance: Clean, pure, high-contrast black on white (#000000 on #FFFFFF) vector QR.
//   Completely distraction-free: no architecture jargon, no countdowns, no security disclosures.

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Monitor,
  Users,
  CheckCircle2,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Smartphone,
} from 'lucide-react';

interface ClassroomProjectorProps {
  sessionId: string;
  courseCode?: string;
  socketUrl?: string;
  size?: number;
}

interface EpochPayload {
  session_uuid: string;
  epoch: number;
  current_token: string;
  current_start: number;
  next_token: string;
  next_start: number;
  interval_ms: number;
  flash_duration_ms: number;
  server_time_ms: number;
}

interface LegacyTokenPayload {
  token_val?: string;
  created_at_epoch?: number;
  expires_at_epoch?: number;
}

interface AttendanceEntry {
  student_name: string;
  student_enrollment: string;
  timestamp: number;
}

export default function ClassroomProjector({
  sessionId,
  courseCode,
  socketUrl,
  size = 440,
}: ClassroomProjectorProps) {
  // State
  const [connected, setConnected] = useState(false);
  const [splitScreen, setSplitScreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [attendanceEntries, setAttendanceEntries] = useState<AttendanceEntry[]>([]);

  // Timing state
  const [isFlashing, setIsFlashing] = useState(false);
  const [activeToken, setActiveToken] = useState<string | null>(null);

  // Synchronous refs
  const socketRef = useRef<Socket | null>(null);
  const epochDataRef = useRef<EpochPayload | null>(null);
  const activeTokenRef = useRef<string | null>(null);
  const isFlashingRef = useRef<boolean>(false);
  const serverOffsetRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastFlashedEpochRef = useRef<number>(-1);
  const rafIdRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Optional subtle audio tick on flash for professor
  const playMetronomeClick = useCallback(() => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtxRef.current = new AudioContextClass();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.01);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.01);
    } catch {
      // Audio context may be restricted before interaction
    }
  }, [soundEnabled]);

  // Fullscreen toggle handler
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // High-precision RAF loop
  // Protocol: 3000ms period
  // - 0 <= cycleMs < 100 (0.1s): Flash phase (`ATTN:${sessionId}:${activeToken}`)
  // - 100 <= cycleMs < 3000 (2.9s): Static Anchor phase (`ATTN:${sessionId}`)
  useEffect(() => {
    let running = true;

    const tick = () => {
      if (!running) return;

      const now = Date.now() + serverOffsetRef.current;
      const interval = 3000;
      const flashDuration = 100; // exactly 100ms (0.1s)

      // Calculate position in the 3-second cycle
      const cycleMs = ((now % interval) + interval) % interval;
      const epochNumber = Math.floor(now / interval);

      // Flashing is strictly active for the first 100ms of each 3000ms window
      const flashing = cycleMs < flashDuration && Boolean(activeTokenRef.current);

      // Update active token according to epoch schedule
      if (epochDataRef.current) {
        let tokenToSet: string | null = null;
        if (epochDataRef.current.epoch === epochNumber) {
          tokenToSet = epochDataRef.current.current_token;
        } else if (epochDataRef.current.epoch + 1 === epochNumber) {
          tokenToSet = epochDataRef.current.next_token;
        }
        if (tokenToSet && tokenToSet !== activeTokenRef.current) {
          activeTokenRef.current = tokenToSet;
          setActiveToken(tokenToSet);
        }
      }

      // ONLY trigger React state update on transition edges (prevents re-renders during 2.9s static anchor)
      if (flashing !== isFlashingRef.current) {
        isFlashingRef.current = flashing;
        setIsFlashing(flashing);
      }

      // Trigger audio click once on flash start
      if (flashing && lastFlashedEpochRef.current !== epochNumber) {
        lastFlashedEpochRef.current = epochNumber;
        playMetronomeClick();
      }

      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);

    return () => {
      running = false;
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [playMetronomeClick]);

  // Socket.io Connection
  useEffect(() => {
    const url = socketUrl ?? window.location.origin;

    const socket = io(url, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 4000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      if (sessionId) {
        socket.emit('join:session', sessionId);
      }
    });

    // Lookahead epoch broadcast
    socket.on('token:epoch', (payload: EpochPayload) => {
      const clientArrival = Date.now();
      serverOffsetRef.current = payload.server_time_ms - clientArrival;
      epochDataRef.current = payload;
      activeTokenRef.current = payload.current_token;
      setActiveToken(payload.current_token);
    });

    // Legacy fallback
    socket.on('token:new', (payload: LegacyTokenPayload) => {
      if (!payload?.token_val) return;
      activeTokenRef.current = payload.token_val;
      setActiveToken(payload.token_val);
    });

    // Real-time attendance check-in feed
    socket.on('attendance:new', (entry: AttendanceEntry) => {
      setAttendanceEntries((prev) => [entry, ...prev].slice(0, 50));
    });

    socket.on('disconnect', () => setConnected(false));

    return () => {
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
      }
      socketRef.current = null;
    };
  }, [sessionId, socketUrl]);

  // QR Code Value:
  // - For 2.9 seconds: strictly `ATTN:${sessionId}` (100% static anchor throughout the session)
  // - For 0.1 second:  `ATTN:${sessionId}:${activeToken}`
  const qrValue =
    isFlashing && activeToken
      ? `ATTN:${sessionId}:${activeToken}`
      : `ATTN:${sessionId}`;

  const qrPixelSize = splitScreen ? 350 : Math.min(size, 460);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 flex flex-col bg-[#0A0D14] text-slate-100 font-sans select-none overflow-hidden"
    >
      {/* ========================================================================= */}
      {/* 1. CLEAN TOP HEADER                                                       */}
      {/* ========================================================================= */}
      <header className="h-16 px-6 lg:px-10 flex items-center justify-between bg-[#10141D]/90 backdrop-blur-md border-b border-slate-800/80 z-20">
        {/* Course Name & Live Indicator */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h1 className="text-lg lg:text-xl font-bold tracking-tight text-white">
              {courseCode || 'Live Attendance'}
            </h1>
          </div>

          <span className="hidden sm:inline-block text-xs text-slate-400 font-medium px-2.5 py-0.5 rounded-full bg-slate-800/70 border border-slate-700/50">
            {connected ? 'Live Session' : 'Connecting…'}
          </span>
        </div>

        {/* Professor Utility Controls */}
        <div className="flex items-center gap-2.5">
          {/* Subtle Sound Tick Toggle */}
          <Button
            onClick={() => setSoundEnabled(!soundEnabled)}
            variant="ghost"
            size="sm"
            className={cn(
              'h-9 px-3 rounded-lg border text-xs gap-2 transition-all',
              soundEnabled
                ? 'bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20'
                : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:bg-slate-800'
            )}
            title={soundEnabled ? 'Metronome sound tick active' : 'Metronome sound muted'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-blue-400" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden md:inline">{soundEnabled ? 'Sound On' : 'Mute'}</span>
          </Button>

          {/* Split Screen Roster Toggle */}
          <Button
            onClick={() => setSplitScreen(!splitScreen)}
            variant="ghost"
            size="sm"
            className={cn(
              'h-9 px-3 rounded-lg border text-xs gap-2 transition-all',
              splitScreen
                ? 'bg-blue-600/20 text-blue-400 border-blue-500/40 hover:bg-blue-600/30'
                : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:bg-slate-800'
            )}
          >
            <Monitor className="w-4 h-4" />
            <span className="hidden sm:inline">{splitScreen ? 'QR Only' : 'Live Roster'}</span>
          </Button>

          {/* Fullscreen Toggle */}
          <Button
            onClick={toggleFullscreen}
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 rounded-lg border border-slate-800 bg-slate-900/60 text-slate-300 hover:bg-slate-800"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. MAIN VIEWPORT: MASSIVE CRISP QR CODE & OPTIONAL ROSTER                 */}
      {/* ========================================================================= */}
      <main className="flex-1 flex overflow-hidden">
        {/* Central Clean QR Stage */}
        <motion.section
          animate={{ width: splitScreen ? '52%' : '100%' }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="flex flex-col items-center justify-center p-8 lg:p-12 relative border-r border-slate-800/40"
        >
          {/* Subtle ambient back-glow */}
          <div className="absolute w-[500px] h-[500px] rounded-full bg-blue-600/[0.04] blur-3xl pointer-events-none" />

          {/* Massive, Crisp White QR Card */}
          <div className="relative flex flex-col items-center">
            <div className="p-7 lg:p-8 rounded-3xl bg-white shadow-[0_24px_80px_rgba(0,0,0,0.6)] flex items-center justify-center">
              <QRCodeSVG
                value={qrValue}
                size={qrPixelSize}
                bgColor="#FFFFFF"
                fgColor="#000000"
                level="M"
                marginSize={2}
              />
            </div>

            {/* Simple, Clear Student Scanning Instruction */}
            <div className="mt-8 flex flex-col items-center text-center">
              <div className="flex items-center gap-2.5 text-white">
                <Smartphone className="w-5 h-5 text-blue-400" />
                <h2 className="text-2xl lg:text-3xl font-bold tracking-tight">
                  Scan to Mark Attendance
                </h2>
              </div>
              <p className="text-sm text-slate-400 mt-2 max-w-sm">
                Point your camera at the QR code to check in
              </p>
            </div>
          </div>
        </motion.section>

        {/* Optional Split-Screen Live Attendance Roster */}
        {splitScreen && (
          <motion.aside
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="w-[48%] flex flex-col bg-[#0E121A] border-l border-slate-800/80"
          >
            <Card className="m-6 flex-1 flex flex-col bg-slate-900/50 border-slate-800/70 shadow-xl overflow-hidden">
              <CardHeader className="py-4 px-6 border-b border-slate-800/70 bg-slate-900/80">
                <CardTitle className="flex items-center justify-between text-base font-semibold text-white">
                  <div className="flex items-center gap-2.5">
                    <Users className="h-5 w-5 text-emerald-400" />
                    <span>Live Attendance</span>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-mono text-xs font-semibold border border-emerald-500/20">
                    {attendanceEntries.length} Present
                  </span>
                </CardTitle>
              </CardHeader>

              <CardContent className="flex-1 p-4 overflow-y-auto max-h-[calc(100vh-180px)] space-y-2">
                {attendanceEntries.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center py-24 text-slate-500">
                    <Users className="h-10 w-10 mb-3 opacity-30 animate-pulse" />
                    <p className="text-sm font-medium">Waiting for students to scan…</p>
                    <p className="text-xs text-slate-600 mt-1">Verified check-ins will appear here</p>
                  </div>
                ) : (
                  attendanceEntries.map((entry, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-colors shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-mono text-xs font-semibold">
                          {entry.student_name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-white">{entry.student_name}</p>
                          <p className="text-xs text-slate-400 font-mono">{entry.student_enrollment}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Present</span>
                        </div>
                        <span className="text-xs font-mono text-slate-500">
                          {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                    </motion.div>
                  ))
                )}
              </CardContent>
            </Card>
          </motion.aside>
        )}
      </main>

      {/* ========================================================================= */}
      {/* 3. MINIMAL FOOTER                                                         */}
      {/* ========================================================================= */}
      <footer className="h-10 px-8 flex items-center justify-between bg-[#0B0E14] border-t border-slate-800/60 text-xs text-slate-500 z-10">
        <span>
          {attendanceEntries.length} {attendanceEntries.length === 1 ? 'student' : 'students'} marked present
        </span>
        <span className="font-mono text-slate-600">
          {connected ? 'Sync Active' : 'Connecting…'}
        </span>
      </footer>
    </div>
  );
}

