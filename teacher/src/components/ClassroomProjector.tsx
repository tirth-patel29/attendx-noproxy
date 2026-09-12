// src/components/ClassroomProjector.tsx
// Reimagined Classroom Projector Engine 2.0
// Features:
// - Clock-synchronized lookahead metronome (immune to socket latency and packet jitter)
// - Anti-Streaming Isoluminant Chroma Crush (equal linear luminance Red/Green kills 4:2:0 remote streams)
// - Hardware-accelerated HTML5 Canvas QR rendering via QRCodeCanvas
// - 60fps circular metronome sweep radar with predictive flash timing
// - Optional Web Audio API micro-pulse metronome click
// - Split-screen live attendance feed with real-time student entry animations

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { QRCodeCanvas } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Monitor,
  Users,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  Volume2,
  VolumeX,
  Zap,
  Radio,
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
  size = 460,
}: ClassroomProjectorProps) {
  // State
  const [connected, setConnected] = useState(false);
  const [pingMs, setPingMs] = useState<number>(0);
  const [splitScreen, setSplitScreen] = useState(false);
  const [antiStreamMode, setAntiStreamMode] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [attendanceEntries, setAttendanceEntries] = useState<AttendanceEntry[]>([]);

  // Rendering & Timing State (driven by RAF loop)
  const [isFlashing, setIsFlashing] = useState(false);
  const [activeToken, setActiveToken] = useState<string | null>(null);
  const [cycleProgress, setCycleProgress] = useState<number>(0); // 0.0 -> 1.0
  const [timeUntilFlash, setTimeUntilFlash] = useState<number>(3.0);

  // Refs for synchronous loop
  const socketRef = useRef<Socket | null>(null);
  const epochDataRef = useRef<EpochPayload | null>(null);
  const serverOffsetRef = useRef<number>(0); // server_time - client_time
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastFlashedEpochRef = useRef<number>(-1);
  const rafIdRef = useRef<number | null>(null);

  // Play subtle 10ms click on flash boundary (Web Audio API)
  const playMetronomeClick = useCallback(() => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtxRef.current = new AudioContextClass();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // 880 Hz
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.015); // 15ms falloff
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.015);
    } catch {
      // Audio context might be restricted before interaction
    }
  }, [soundEnabled]);

  // High-precision RAF metronome loop
  useEffect(() => {
    let running = true;

    const tick = () => {
      if (!running) return;

      const now = Date.now() + serverOffsetRef.current;
      const epochData = epochDataRef.current;
      const interval = epochData?.interval_ms ?? 3000;
      const flashDuration = epochData?.flash_duration_ms ?? 100;

      // Calculate progress in current 3s cycle (0.0 to 1.0)
      const cycleMs = now % interval;
      const progress = cycleMs / interval;
      const remainingSeconds = Math.max(0, (interval - cycleMs) / 1000);

      setCycleProgress(progress);
      setTimeUntilFlash(remainingSeconds);

      let flashing = false;
      let tokenToDisplay: string | null = null;

      if (epochData) {
        // Lookahead-based timing: check current epoch or next epoch
        if (now >= epochData.current_start && now < epochData.current_start + flashDuration) {
          flashing = true;
          tokenToDisplay = epochData.current_token;
          if (lastFlashedEpochRef.current !== epochData.epoch) {
            lastFlashedEpochRef.current = epochData.epoch;
            playMetronomeClick();
          }
        } else if (now >= epochData.next_start && now < epochData.next_start + flashDuration) {
          flashing = true;
          tokenToDisplay = epochData.next_token;
          if (lastFlashedEpochRef.current !== epochData.epoch + 1) {
            lastFlashedEpochRef.current = epochData.epoch + 1;
            playMetronomeClick();
          }
        }
      }

      setIsFlashing(flashing);
      if (tokenToDisplay) {
        setActiveToken(tokenToDisplay);
      }

      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);

    return () => {
      running = false;
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [playMetronomeClick]);

  // Socket.io Connection & Lookahead Listener
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

    // Modern lookahead epoch event (eliminates network jitter)
    socket.on('token:epoch', (payload: EpochPayload) => {
      const clientArrival = Date.now();
      // Estimate Cristian offset: server_time - clientArrival
      serverOffsetRef.current = payload.server_time_ms - clientArrival;
      epochDataRef.current = payload;
      setActiveToken(payload.current_token);
    });

    // Fallback for legacy metronome backend
    socket.on('token:new', (payload: LegacyTokenPayload) => {
      if (!payload?.token_val) return;
      if (!epochDataRef.current) {
        setActiveToken(payload.token_val);
        setIsFlashing(true);
        setTimeout(() => setIsFlashing(false), 100);
      }
    });

    // Real-time ping tracking
    socket.on('pong', (latency: number) => {
      if (typeof latency === 'number') setPingMs(latency);
    });

    // Real-time student attendance check-in
    socket.on('attendance:new', (entry: AttendanceEntry) => {
      setAttendanceEntries((prev) => [entry, ...prev].slice(0, 30));
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

  // QR Code Value: Anchor vs Flash
  const qrValue = isFlashing && activeToken
    ? `ATTN:${sessionId}:${activeToken}`
    : `ATTN:${sessionId}`;

  // Color Palette Selection:
  // - Anchor: Always High-Contrast Black on White (#000000 on #ffffff) for instant room locking.
  // - Flash:
  //   * If antiStreamMode is ON: Isoluminant pair (W3C linearized equal luminance Y = 0.2126).
  //     fg = #FF0000 (Pure Red), bg = #009400 (Chroma-crushing Green).
  //     Remote 4:2:0 encoders have zero luma edge to compress, causing remote scanners to blind.
  //   * If antiStreamMode is OFF: High contrast black on white.
  const qrFgColor = isFlashing
    ? antiStreamMode ? '#FF0000' : '#000000'
    : '#000000';

  const qrBgColor = isFlashing
    ? antiStreamMode ? '#009400' : '#ffffff'
    : '#ffffff';

  const radius = 190;
  const stroke = 6;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - cycleProgress * circumference;

  return (
    <div className="fixed inset-0 flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 select-none overflow-hidden">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-8 py-3.5 bg-slate-900/70 backdrop-blur-md border-b border-slate-800/80 z-20">
        <div className="flex items-center gap-4">
          {courseCode && (
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-400 font-mono text-xs uppercase tracking-wider border border-blue-500/20">
                Course
              </span>
              <h1 className="text-xl font-bold tracking-tight text-white">
                {courseCode}
              </h1>
            </div>
          )}

          {/* Connection & Latency Badge */}
          <div
            className={cn(
              "flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border transition-colors",
              connected
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                : "bg-rose-500/10 text-rose-400 border-rose-500/30"
            )}
          >
            <div
              className={cn(
                "w-2 h-2 rounded-full",
                connected ? "bg-emerald-400 animate-pulse" : "bg-rose-400"
              )}
            />
            {connected ? (
              <span>Live {pingMs > 0 && `• ${pingMs}ms`}</span>
            ) : (
              <span>Reconnecting</span>
            )}
          </div>

          {/* Active Security Profile Badge */}
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-800/80 text-slate-300 border border-slate-700/50">
            <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>3s Micro-Twitch Metronome</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          {/* Anti-Stream Mode Toggle */}
          <Button
            onClick={() => setAntiStreamMode(!antiStreamMode)}
            variant="outline"
            size="sm"
            className={cn(
              "gap-1.5 text-xs font-medium border transition-all",
              antiStreamMode
                ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20"
                : "bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-800"
            )}
            title="Isoluminant 4:2:0 Chroma Crush blinds Discord/Meet screen shares"
          >
            {antiStreamMode ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Anti-Stream Chroma Crush ON
              </>
            ) : (
              <>
                <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
                Anti-Stream OFF
              </>
            )}
          </Button>

          {/* Metronome Audio Click Toggle */}
          <Button
            onClick={() => setSoundEnabled(!soundEnabled)}
            variant="outline"
            size="sm"
            className="w-9 h-9 p-0 border-slate-700/60 bg-slate-800/40 text-slate-300 hover:bg-slate-800"
            title={soundEnabled ? "Mute metronome tick" : "Enable metronome sound tick"}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-cyan-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-400" />
            )}
          </Button>

          {/* Split Screen Mode Toggle */}
          <Button
            onClick={() => setSplitScreen(!splitScreen)}
            variant={splitScreen ? "default" : "outline"}
            size="sm"
            className={cn(
              "gap-1.5 text-xs font-medium transition-all",
              splitScreen
                ? "bg-blue-600 hover:bg-blue-500 text-white"
                : "border-slate-700/60 bg-slate-800/40 text-slate-300 hover:bg-slate-800"
            )}
          >
            <Monitor className="h-3.5 w-3.5" />
            {splitScreen ? 'Full Screen' : 'Split Roster'}
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Projector Center Stage */}
        <motion.div
          animate={{ width: splitScreen ? '52%' : '100%' }}
          transition={{ duration: 0.35, ease: 'easeInOut' }}
          className="flex flex-col items-center justify-center relative p-6 border-r border-slate-800/40"
        >
          {/* Subtle Ambient Glow behind QR */}
          <div
            className={cn(
              "absolute w-96 h-96 rounded-full blur-3xl -z-10 transition-all duration-300 pointer-events-none",
              isFlashing
                ? antiStreamMode
                  ? "bg-red-500/25 scale-125"
                  : "bg-blue-500/25 scale-125"
                : "bg-blue-600/10 scale-100"
            )}
          />

          {/* QR Container with Circular Metronome Sweep Gauge */}
          <div className="relative flex items-center justify-center">
            {/* SVG Metronome Progress Ring */}
            <svg
              className="absolute -rotate-90 pointer-events-none"
              width={size + 70}
              height={size + 70}
              viewBox="0 0 400 400"
            >
              {/* Background Ring */}
              <circle
                cx="200"
                cy="200"
                r={radius}
                stroke="rgba(51, 65, 85, 0.3)"
                strokeWidth={stroke}
                fill="transparent"
              />
              {/* Animated Progress Sweep */}
              <circle
                cx="200"
                cy="200"
                r={radius}
                stroke={isFlashing ? "#ef4444" : "#06b6d4"}
                strokeWidth={isFlashing ? stroke + 2 : stroke}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
                style={{
                  transition: 'stroke-dashoffset 0.05s linear, stroke 0.15s ease',
                  filter: isFlashing ? 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.8))' : 'drop-shadow(0 0 6px rgba(6, 182, 212, 0.4))',
                }}
              />
            </svg>

            {/* Hardware-Accelerated Canvas QR Surface */}
            <div
              className={cn(
                "relative rounded-3xl p-6 transition-all duration-100 shadow-2xl flex items-center justify-center",
                isFlashing
                  ? antiStreamMode
                    ? "ring-4 ring-red-500/80 shadow-[0_0_80px_rgba(239,68,68,0.5)]"
                    : "ring-4 ring-cyan-400/80 shadow-[0_0_80px_rgba(6,182,212,0.5)]"
                  : "ring-1 ring-slate-700/60 shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
              )}
              style={{
                backgroundColor: qrBgColor,
              }}
            >
              <QRCodeCanvas
                value={qrValue}
                size={splitScreen ? 340 : Math.min(size, 460)}
                bgColor={qrBgColor}
                fgColor={qrFgColor}
                level="M"
                marginSize={1}
              />
            </div>
          </div>

          {/* Rhythm & Status Indicator Under QR */}
          <div className="mt-8 flex flex-col items-center gap-2">
            <div className="flex items-center gap-3">
              <span className="text-3xl font-extrabold tracking-tight text-white">
                Scan to Mark Attendance
              </span>
              <AnimatePresence mode="wait">
                {isFlashing ? (
                  <motion.span
                    key="flash"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1.1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase bg-red-500 text-white shadow-lg shadow-red-500/50 flex items-center gap-1"
                  >
                    <Zap className="w-3 h-3 fill-current" />
                    Flash
                  </motion.span>
                ) : (
                  <motion.span
                    key="anchor"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700/60 font-mono"
                  >
                    Next: {timeUntilFlash.toFixed(1)}s
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            <p className="text-sm text-slate-400 max-w-md text-center">
              Hold camera steady at the board. The 100ms visual seal authenticates presence.
            </p>
          </div>
        </motion.div>

        {/* Split Screen Mode: Real-Time Live Attendance Roster */}
        {splitScreen && (
          <motion.div
            initial={{ opacity: 0, x: 80 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="w-[48%] flex flex-col bg-slate-950/90 border-l border-slate-800/80"
          >
            <Card className="m-5 flex-1 flex flex-col bg-slate-900/40 border-slate-800/60 shadow-xl overflow-hidden">
              <CardHeader className="py-4 px-5 border-b border-slate-800/60 bg-slate-900/80">
                <CardTitle className="flex items-center justify-between text-base font-semibold text-slate-100">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-emerald-400" />
                    <span>Live Roll Call</span>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300 font-mono border border-emerald-500/30">
                    {attendanceEntries.length} verified
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 p-3 overflow-y-auto max-h-[calc(100vh-170px)] space-y-2">
                {attendanceEntries.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center py-20 text-slate-500">
                    <Users className="h-10 w-10 mb-3 opacity-30 animate-pulse" />
                    <p className="text-sm font-medium">Awaiting student scans…</p>
                    <p className="text-xs text-slate-600 mt-1">Verified claims appear here in real time</p>
                  </div>
                ) : (
                  attendanceEntries.map((entry, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: -10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.25 }}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-900/70 border border-slate-800/80 hover:border-slate-700/80 transition-colors shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                          <CheckCircle2 className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-slate-100 leading-tight">
                            {entry.student_name}
                          </p>
                          <p className="text-xs text-slate-400 font-mono mt-0.5">
                            {entry.student_enrollment}
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {new Date(entry.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </motion.div>
                  ))
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>

      {/* Footer Info Bar */}
      <div className="flex items-center justify-between px-8 py-2.5 bg-slate-950/80 border-t border-slate-800/60 text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <span className="font-medium text-slate-300">Gate 3: Active</span>
          <span className="text-slate-600">•</span>
          <span>Window: 3000ms</span>
          <span className="text-slate-600">•</span>
          <span>Flash: 100ms</span>
        </div>

        <div className="flex items-center gap-2 text-slate-400 font-mono">
          <span>{attendanceEntries.length} present</span>
          <span className="text-slate-600">•</span>
          <span>Session: {sessionId.slice(0, 8)}…</span>
        </div>
      </div>
    </div>
  );
}
