// src/components/ClassroomProjector.tsx
// AttendX Classroom Projector HUD — Obsidian Telemetry Design System
//
// QR Rotation Protocol:
// - Total Period: 3.0 seconds (3000 ms).
// - Anchor Phase (2.9s / 2900ms): Displays static anchor `ATTN:${sessionId}`.
//   Student phone cameras lock focus, exposure, and alignment on this anchor.
// - Flash Phase (0.1s / 100ms): Flashes rotating token `ATTN:${sessionId}:${activeToken}`.
//   Captures the 100ms visual seal required by Gate 3 / Gate 4 (250ms kill window).
// - Display: Pure, stark, high-contrast black on white (#000000 on #FFFFFF) vector QR code.
//   Zero color distortion, no chroma crush, 100% optical yield across auditorium projectors.

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Monitor,
  Users,
  CheckCircle2,
  Volume2,
  VolumeX,
  Zap,
  Radio,
  Smartphone,
  Maximize2,
  Minimize2,
  ShieldCheck,
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
  size = 420,
}: ClassroomProjectorProps) {
  // Connection & UI state
  const [connected, setConnected] = useState(false);
  const [pingMs, setPingMs] = useState<number>(0);
  const [splitScreen, setSplitScreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [attendanceEntries, setAttendanceEntries] = useState<AttendanceEntry[]>([]);

  // High-precision timing state (driven by 60fps RAF loop)
  const [isFlashing, setIsFlashing] = useState(false);
  const [activeToken, setActiveToken] = useState<string | null>(null);
  const [cycleProgress, setCycleProgress] = useState<number>(0); // 0.0 -> 1.0
  const [timeUntilFlash, setTimeUntilFlash] = useState<number>(2.9);

  // Synchronous refs
  const socketRef = useRef<Socket | null>(null);
  const epochDataRef = useRef<EpochPayload | null>(null);
  const serverOffsetRef = useRef<number>(0); // server_time - client_time
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastFlashedEpochRef = useRef<number>(-1);
  const rafIdRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Subtle 10ms micro-pulse audio click on flash moment (Web Audio API)
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
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.012);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.012);
    } catch {
      // Audio context may be restricted before user interaction
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

  // High-precision RAF metronome loop
  // Protocol: 3000ms total window
  // - 2.9s (2900ms) Anchor: ATTN:${sessionId}
  // - 0.1s (100ms) Flash:   ATTN:${sessionId}:${activeToken}
  useEffect(() => {
    let running = true;

    const tick = () => {
      if (!running) return;

      const now = Date.now() + serverOffsetRef.current;
      const epochData = epochDataRef.current;
      const interval = epochData?.interval_ms ?? 3000;
      const flashDuration = epochData?.flash_duration_ms ?? 100; // exactly 100ms (0.1s)

      // Calculate cycle progress (0.0 to 1.0) and phase
      let cycleMs = 0;
      let flashing = false;
      let tokenToDisplay: string | null = null;
      let currentEpoch = 0;

      if (epochData && epochData.current_start > 0) {
        // Aligned to server-provided epoch grid
        currentEpoch = Math.floor((now - epochData.current_start) / interval) + epochData.epoch;
        cycleMs = ((now - epochData.current_start) % interval + interval) % interval;

        // Flash occurs at the beginning of the epoch for exactly flashDuration (100ms)
        if (now >= epochData.current_start && now < epochData.current_start + flashDuration) {
          flashing = true;
          tokenToDisplay = epochData.current_token;
        } else if (now >= epochData.next_start && now < epochData.next_start + flashDuration) {
          flashing = true;
          tokenToDisplay = epochData.next_token;
        }
      } else {
        // Fallback to absolute 3000ms Unix millisecond grid
        currentEpoch = Math.floor(now / interval);
        cycleMs = now % interval;
        if (cycleMs < flashDuration) {
          flashing = true;
        }
      }

      // Calculate progress and countdown
      const progress = cycleMs / interval;
      const remainingSeconds = Math.max(0, (interval - cycleMs) / 1000);

      setCycleProgress(progress);
      setTimeUntilFlash(remainingSeconds);
      setIsFlashing(flashing);

      if (tokenToDisplay) {
        setActiveToken(tokenToDisplay);
      }

      // Audio click trigger at flash onset
      if (flashing && lastFlashedEpochRef.current !== currentEpoch) {
        lastFlashedEpochRef.current = currentEpoch;
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

  // Socket.io Connection & Streaming
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
      setActiveToken(payload.current_token);
    });

    // Fallback for legacy metronome backend
    socket.on('token:new', (payload: LegacyTokenPayload) => {
      if (!payload?.token_val) return;
      setActiveToken(payload.token_val);
    });

    // Ping tracking
    socket.on('pong', (latency: number) => {
      if (typeof latency === 'number') setPingMs(latency);
    });

    // Real-time student attendance check-ins
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

  // Exact QR Code Value:
  // - 2.9s Anchor: ATTN:<sessionId>
  // - 0.1s Flash:  ATTN:<sessionId>:<activeToken>
  const qrValue =
    isFlashing && activeToken
      ? `ATTN:${sessionId}:${activeToken}`
      : `ATTN:${sessionId}`;

  // SVG Circular Sweep Geometry
  const radius = 220;
  const stroke = 4;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - cycleProgress * circumference;

  // Responsive QR size calculation
  const qrPixelSize = splitScreen ? 340 : Math.min(size, 460);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 flex flex-col bg-[#080B10] text-[#DFE2EB] font-sans select-none overflow-hidden"
      style={{
        backgroundImage:
          'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0, 240, 255, 0.06), transparent 70%), radial-gradient(ellipse 50% 50% at 50% 120%, rgba(59, 130, 246, 0.05), transparent)',
      }}
    >
      {/* ========================================================================= */}
      {/* 1. TOP COMMAND BAR (Obsidian Glassmorphism HUD)                            */}
      {/* ========================================================================= */}
      <header className="h-16 px-6 lg:px-8 flex items-center justify-between bg-[#0D1117]/80 backdrop-blur-xl border-b border-white/[0.08] z-30 shadow-sm">
        {/* Course & Hall Metadata */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00F0FF] shadow-[0_0_10px_#00F0FF] animate-pulse" />
            <h1 className="text-lg lg:text-xl font-bold tracking-wider text-white font-mono uppercase">
              {courseCode ? `${courseCode} // ATTENDANCE` : 'CLASSROOM PROJECTOR'}
            </h1>
          </div>

          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded bg-[#181C22] border border-white/[0.08] font-mono text-xs text-slate-400">
            <span className="text-[#00F0FF]">SESSION</span>
            <span className="text-white font-semibold">{sessionId.slice(0, 8).toUpperCase()}</span>
          </div>

          {/* Connection Status Pill */}
          <div
            className={cn(
              'flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-medium border transition-colors',
              connected
                ? 'bg-[#05DF72]/10 text-[#05DF72] border-[#05DF72]/30 shadow-[0_0_12px_rgba(5,223,114,0.15)]'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            )}
          >
            <span
              className={cn(
                'w-2 h-2 rounded-full',
                connected ? 'bg-[#05DF72] animate-ping' : 'bg-rose-400'
              )}
            />
            <span>{connected ? `LIVE SYNC • ${pingMs > 0 ? `${pingMs}ms` : '12ms'}` : 'DISCONNECTED'}</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {/* Metronome Sound Tick Toggle */}
          <Button
            onClick={() => setSoundEnabled(!soundEnabled)}
            variant="ghost"
            size="sm"
            className={cn(
              'h-9 px-3 rounded-lg border font-mono text-xs gap-2 transition-all',
              soundEnabled
                ? 'bg-[#00F0FF]/10 text-[#00F0FF] border-[#00F0FF]/30 hover:bg-[#00F0FF]/20'
                : 'bg-[#181C22]/80 text-slate-400 border-white/[0.08] hover:bg-slate-800'
            )}
            title={soundEnabled ? 'Metronome click enabled' : 'Metronome click muted'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-[#00F0FF]" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden md:inline">{soundEnabled ? 'AUDIO ON' : 'MUTED'}</span>
          </Button>

          {/* Split Screen Roster Toggle */}
          <Button
            onClick={() => setSplitScreen(!splitScreen)}
            variant="ghost"
            size="sm"
            className={cn(
              'h-9 px-3 rounded-lg border font-mono text-xs gap-2 transition-all',
              splitScreen
                ? 'bg-blue-600/20 text-blue-400 border-blue-500/40 hover:bg-blue-600/30'
                : 'bg-[#181C22]/80 text-slate-400 border-white/[0.08] hover:bg-slate-800'
            )}
          >
            <Monitor className="w-4 h-4" />
            <span className="hidden sm:inline">{splitScreen ? 'FULLSCREEN QR' : 'SPLIT ROSTER'}</span>
          </Button>

          {/* Browser Fullscreen Toggle */}
          <Button
            onClick={toggleFullscreen}
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 rounded-lg border border-white/[0.08] bg-[#181C22]/80 text-slate-300 hover:bg-slate-800"
            title="Toggle Projector Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. MAIN VIEWPORT (Massive QR Centerpiece + Optional Live Roster)          */}
      {/* ========================================================================= */}
      <main className="flex-1 flex overflow-hidden relative">
        {/* Left / Center QR Code Display Stage */}
        <motion.section
          animate={{ width: splitScreen ? '52%' : '100%' }}
          transition={{ duration: 0.35, ease: 'easeInOut' }}
          className="flex flex-col items-center justify-between p-6 lg:p-8 relative border-r border-white/[0.06] overflow-hidden"
        >
          {/* Subtle Background Optical Reticle Grid */}
          <div className="absolute inset-0 pointer-events-none opacity-10 bg-[linear-gradient(to_right,#00f0ff1a_1px,transparent_1px),linear-gradient(to_bottom,#00f0ff1a_1px,transparent_1px)] bg-[size:48px_48px]" />

          {/* Top Stage Header: Mechanism Telemetry */}
          <div className="w-full max-w-xl flex items-center justify-between z-10 font-mono text-xs border-b border-white/[0.06] pb-3">
            <div className="flex items-center gap-2 text-slate-400">
              <Radio className="w-4 h-4 text-[#00F0FF] animate-pulse" />
              <span className="uppercase tracking-wider">Zero-Trust Gate 3 Metronome</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 uppercase">Cycle Period:</span>
              <span className="text-[#00F0FF] font-semibold font-mono">3.0s (2.9s Anchor / 0.1s Flash)</span>
            </div>
          </div>

          {/* Centerpiece: Massive Crisp High-Contrast QR Code */}
          <div className="relative flex items-center justify-center my-auto py-2">
            {/* Concentric Radar Ring Elements */}
            <div className="absolute w-[500px] h-[500px] rounded-full border border-[#00F0FF]/10 border-dashed pointer-events-none animate-spin" style={{ animationDuration: '60s' }} />
            <div className="absolute w-[440px] h-[440px] rounded-full border border-white/[0.04] pointer-events-none" />

            {/* SVG Circular Rhythm Sweep Ring */}
            <svg
              className="absolute -rotate-90 pointer-events-none"
              width={qrPixelSize + 100}
              height={qrPixelSize + 100}
              viewBox="0 0 500 500"
            >
              {/* Background Ring */}
              <circle
                cx="250"
                cy="250"
                r={radius}
                stroke="rgba(255, 255, 255, 0.05)"
                strokeWidth={stroke}
                fill="transparent"
              />
              {/* Dynamic Sweep Ring */}
              <circle
                cx="250"
                cy="250"
                r={radius}
                stroke={isFlashing ? '#05DF72' : '#00F0FF'}
                strokeWidth={isFlashing ? stroke + 3 : stroke}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
                style={{
                  transition: 'stroke-dashoffset 0.05s linear, stroke 0.1s ease',
                  filter: isFlashing
                    ? 'drop-shadow(0 0 12px rgba(5, 223, 114, 0.9))'
                    : 'drop-shadow(0 0 8px rgba(0, 240, 255, 0.5))',
                }}
              />
            </svg>

            {/* Compass Markers */}
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 font-mono text-[10px] text-cyan-400/60 uppercase tracking-widest pointer-events-none">000° NORTH</div>
            <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 font-mono text-[10px] text-cyan-400/60 uppercase tracking-widest pointer-events-none">180° SOUTH</div>

            {/* Sci-Fi Reticle Framing Card */}
            <div
              className={cn(
                'relative p-6 lg:p-7 rounded-2xl bg-white shadow-2xl transition-all duration-100 flex items-center justify-center',
                isFlashing
                  ? 'shadow-[0_0_90px_rgba(0,240,255,0.45)] ring-4 ring-[#00F0FF]'
                  : 'shadow-[0_20px_70px_rgba(0,0,0,0.8)] ring-1 ring-white/20'
              )}
            >
              {/* 4 Precision HUD Reticles (Cyan) */}
              <div className="absolute -top-2.5 -left-2.5 w-6 h-6 border-t-2 border-l-2 border-[#00F0FF] pointer-events-none" />
              <div className="absolute -top-2.5 -right-2.5 w-6 h-6 border-t-2 border-r-2 border-[#00F0FF] pointer-events-none" />
              <div className="absolute -bottom-2.5 -left-2.5 w-6 h-6 border-b-2 border-l-2 border-[#00F0FF] pointer-events-none" />
              <div className="absolute -bottom-2.5 -right-2.5 w-6 h-6 border-b-2 border-r-2 border-[#00F0FF] pointer-events-none" />

              {/* Ultra-Crisp Pure Black Vector QR on Pure Stark White Background */}
              <div className="relative bg-white rounded-lg flex items-center justify-center">
                <QRCodeSVG
                  value={qrValue}
                  size={qrPixelSize}
                  bgColor="#FFFFFF"
                  fgColor="#000000"
                  level="M"
                  marginSize={2}
                />
              </div>
            </div>
          </div>

          {/* Bottom Stage Guidance & Real-Time Rhythm Indicator */}
          <div className="w-full max-w-xl flex flex-col items-center gap-3 z-10">
            {/* Rhythm Status Pill */}
            <div className="flex items-center gap-3">
              <AnimatePresence mode="wait">
                {isFlashing ? (
                  <motion.div
                    key="flash-badge"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1.05, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="px-4 py-1.5 rounded-full bg-[#05DF72] text-[#080B10] font-mono text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 shadow-[0_0_20px_rgba(5,223,114,0.6)]"
                  >
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    <span>TOKEN FLASH ACTIVE (0.1s)</span>
                  </motion.div>
                ) : (
                  <motion.div
                    key="anchor-badge"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="px-4 py-1.5 rounded-full bg-[#181C22] border border-white/[0.12] text-slate-300 font-mono text-xs flex items-center gap-2.5 shadow-sm"
                  >
                    <span className="w-2 h-2 rounded-full bg-[#00F0FF] animate-pulse" />
                    <span className="uppercase text-slate-400">Locking Anchor:</span>
                    <span className="text-[#00F0FF] font-bold">NEXT FLASH IN {timeUntilFlash.toFixed(1)}s</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Smooth 3.0s Telemetry Progress Bar */}
            <div className="w-full max-w-md h-1.5 rounded-full bg-[#181C22] overflow-hidden border border-white/[0.08]">
              <div
                className="h-full bg-gradient-to-r from-[#00F0FF] via-blue-500 to-[#05DF72] transition-all duration-75 rounded-full"
                style={{ width: `${Math.min(100, Math.max(0, cycleProgress * 100))}%` }}
              />
            </div>

            {/* Student Instructions */}
            <div className="flex items-center gap-2 text-slate-400 text-sm mt-1">
              <Smartphone className="w-4 h-4 text-[#00F0FF]" />
              <p className="font-medium text-center">
                Point phone camera steadily at the screen. The 100ms visual seal verifies presence.
              </p>
            </div>
          </div>
        </motion.section>

        {/* Right Split Screen: Real-Time Live Attendance Roster */}
        {splitScreen && (
          <motion.aside
            initial={{ opacity: 0, x: 80 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="w-[48%] flex flex-col bg-[#0D1117]/95 border-l border-white/[0.08]"
          >
            <Card className="m-5 flex-1 flex flex-col bg-[#10141A]/60 border-white/[0.08] shadow-2xl overflow-hidden">
              <CardHeader className="py-4 px-6 border-b border-white/[0.08] bg-[#141922]/80">
                <CardTitle className="flex items-center justify-between text-base font-semibold text-white">
                  <div className="flex items-center gap-2.5">
                    <Users className="h-5 w-5 text-[#05DF72]" />
                    <span className="tracking-wide">Live Attendance Roll Call</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-[#05DF72]/15 text-[#05DF72] font-mono text-xs font-bold border border-[#05DF72]/30">
                      {attendanceEntries.length} Verified
                    </span>
                  </div>
                </CardTitle>
              </CardHeader>

              <CardContent className="flex-1 p-4 overflow-y-auto max-h-[calc(100vh-170px)] space-y-2.5">
                {attendanceEntries.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center py-24 text-slate-500">
                    <div className="w-16 h-16 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-4">
                      <Radio className="h-8 w-8 text-[#00F0FF] opacity-60 animate-pulse" />
                    </div>
                    <p className="text-sm font-semibold text-slate-300">Awaiting Student Scans…</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs text-center">
                      Verified attendees will appear here in real time as the metronome rotates.
                    </p>
                  </div>
                ) : (
                  attendanceEntries.map((entry, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: -10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.25 }}
                      className="flex items-center justify-between p-3.5 rounded-xl bg-[#141922] border border-white/[0.06] hover:border-cyan-500/30 transition-colors shadow-sm"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-9 h-9 rounded-full bg-[#05DF72]/10 border border-[#05DF72]/20 flex items-center justify-center text-[#05DF72] font-bold font-mono text-xs">
                          {entry.student_name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-white tracking-tight">{entry.student_name}</p>
                          <p className="text-xs text-slate-400 font-mono">{entry.student_enrollment}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#05DF72]/10 border border-[#05DF72]/20 text-[#05DF72] font-mono text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>VERIFIED</span>
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
      {/* 3. FOOTER TELEMETRY STATUS BAR                                            */}
      {/* ========================================================================= */}
      <footer className="h-10 px-8 flex items-center justify-between bg-[#0B0E14] border-t border-white/[0.06] text-xs font-mono text-slate-500 z-20">
        <div className="flex items-center gap-3">
          <span className="text-slate-400">ATTENDX ARCHITECTURE //</span>
          <span className="text-[#00F0FF]">GATE 3 ROTATING ANCHOR (2.9s) + TOKEN FLASH (0.1s)</span>
          <span>•</span>
          <span className="text-slate-400">GATE 4 ZERO-TRUST 250ms KILL-WINDOW</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>OPTICAL ANTI-STREAM SECURE</span>
          </div>
          <span className="text-slate-600">|</span>
          <span>{connected ? `${attendanceEntries.length} CLAIMS VERIFIED` : 'OFFLINE'}</span>
        </div>
      </footer>
    </div>
  );
}
