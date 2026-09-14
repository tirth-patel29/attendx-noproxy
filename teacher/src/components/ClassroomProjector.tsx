// src/components/ClassroomProjector.tsx
// Enhanced Classroom Projector with split-screen mode

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Monitor, Users, CheckCircle2, User } from 'lucide-react';

interface ClassroomProjectorProps {
  sessionId: string;
  courseCode?: string;
  socketUrl?: string;
  size?: number;
  onClose?: () => void;
}

interface TokenEvent {
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
  size = 512,
  onClose,
}: ClassroomProjectorProps) {
  const [token, setToken] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [flashing, setFlashing] = useState(false);
  const [splitScreen, setSplitScreen] = useState(false);
  const [attendanceEntries, setAttendanceEntries] = useState<AttendanceEntry[]>([]);
  const [bubbles, setBubbles] = useState<
    {
      id: string;
      name: string;
      roll: string;
      key: number;
      x: number;
      y: number;
    }[]
  >([]);

  const socketRef = useRef<Socket | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const url = socketUrl ?? window.location.origin;

    const socket = io(url, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);

      if (sessionId) {
        socket.emit('join:session', sessionId);
      }
    });

    socket.on('token:new', (payload: TokenEvent) => {
      if (!payload?.token_val) return;

      setToken(payload.token_val);
      setFlashing(true);

      if (flashTimer.current) {
        clearTimeout(flashTimer.current);
      }

      flashTimer.current = setTimeout(() => {
        setFlashing(false);
      }, 100);
    });

    // Listen for attendance updates
    socket.on('attendance:new', (entry: AttendanceEntry) => {
      setAttendanceEntries((prev) => [entry, ...prev].slice(0, 20));

      // Add floating bubble
      const key = Date.now() + Math.random();

      // Calculate random position outside the QR safe zone
      const side = Math.floor(Math.random() * 4);
      const spread = 80;

      let x = 50;
      let y = 50;

      if (side === 0) {
        y = 10;
        x = 10 + Math.random() * spread;
      } else if (side === 1) {
        x = 90;
        y = 10 + Math.random() * spread;
      } else if (side === 2) {
        y = 90;
        x = 10 + Math.random() * spread;
      } else {
        x = 10;
        y = 10 + Math.random() * spread;
      }

      setBubbles((prev) => [
        ...prev,
        {
          id: entry.student_enrollment || String(key),
          name: entry.student_name,
          roll: entry.student_enrollment,
          key,
          x,
          y,
        },
      ]);

      // Remove bubble after 4 seconds
      setTimeout(() => {
        setBubbles((prev) => prev.filter((b) => b.key !== key));
      }, 4000);
    });

    socket.on('disconnect', () => setConnected(false));

    return () => {
      if (flashTimer.current) {
        clearTimeout(flashTimer.current);
      }

      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
      }

      socketRef.current = null;
    };
  }, [sessionId, socketUrl]);

  const qrValue =
    flashing && token
      ? `ATTN:${sessionId}:${token}`
      : `ATTN:${sessionId}`;

  return (
    <div className="fixed inset-0 flex flex-col bg-gradient-to-br from-slate-950 to-slate-900">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-8 py-4 bg-slate-900/50 backdrop-blur-sm border-b border-slate-700/20">
        <div className="flex items-center gap-3">
          {courseCode && (
            <h1 className="text-2xl font-bold text-slate-100 tracking-wide">
              {courseCode}
            </h1>
          )}

          <div
            className={cn(
              'flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium',
              connected
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-slate-700/20 text-slate-400 border border-slate-600/30'
            )}
          >
            <div
              className={cn(
                'w-2 h-2 rounded-full',
                connected ? 'bg-green-500 animate-pulse' : 'bg-slate-500'
              )}
            />

            {connected ? 'Live' : 'Disconnected'}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onClose && (
            <Button
              onClick={onClose}
              variant="outline"
              className="gap-2"
            >
              Close
            </Button>
          )}

          <Button
            onClick={() => setSplitScreen(!splitScreen)}
            variant={splitScreen ? 'default' : 'outline'}
            className="gap-2"
          >
            <Monitor className="h-4 w-4" />
            {splitScreen ? 'Full Screen QR' : 'Split Screen'}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* QR Code Panel */}
        <motion.div
          animate={{ width: splitScreen ? '50%' : '100%' }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950 border-r border-slate-700/20"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center gap-8"
          >
            {/* QR Code */}
            <div className="relative">
              {/* Floating Bubbles Layer */}
              <div className="absolute inset-[-400px] pointer-events-none overflow-hidden z-0">
                <AnimatePresence>
                  {bubbles.map((bubble) => (
                    <motion.div
                      key={bubble.key}
                      initial={{
                        opacity: 0,
                        scale: 0,
                        y: 50,
                        x: 0,
                      }}
                      animate={{
                        opacity: 1,
                        scale: 1,
                        y: 0,
                        x: (Math.random() - 0.5) * 40,
                      }}
                      exit={{
                        opacity: 0,
                        scale: 0.8,
                        y: -50,
                      }}
                      transition={{
                        type: 'spring',
                        damping: 12,
                        stiffness: 100,
                      }}
                      className="absolute flex items-center gap-3 bg-slate-900/80 backdrop-blur-md border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.2)] px-4 py-2 rounded-full"
                      style={{
                        left: `${bubble.x}%`,
                        top: `${bubble.y}%`,
                        transform: 'translate(-50%, -50%)',
                      }}
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-400 shrink-0">
                        <User className="h-4 w-4" />
                      </div>

                      <div className="flex flex-col whitespace-nowrap">
                        <span className="text-sm font-bold text-white">
                          {bubble.name}
                        </span>

                        <span className="text-xs text-cyan-400">
                          {bubble.roll}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              <motion.div
                className="flex justify-center items-center p-8 rounded-2xl shadow-2xl"
                style={{
                  background: 'rgba(255, 255, 255, 0.98)',
                  boxShadow: connected
                    ? '0 24px 80px rgba(59, 130, 246, 0.3), 0 0 60px rgba(59, 130, 246, 0.2)'
                    : '0 24px 80px rgba(0, 0, 0, 0.3)',
                }}
              >
                <QRCodeSVG
                  value={qrValue}
                  size={splitScreen ? 400 : size}
                  bgColor="#ffffff"
                  fgColor="#000000"
                  level="M"
                  marginSize={2}
                />
              </motion.div>

              {/* Animated Corner Borders */}
              {connected && (
                <>
                  <motion.div
                    className="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 border-blue-500 rounded-tl-2xl"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />

                  <motion.div
                    className="absolute top-0 right-0 w-16 h-16 border-t-4 border-r-4 border-blue-500 rounded-tr-2xl"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      delay: 0.5,
                    }}
                  />

                  <motion.div
                    className="absolute bottom-0 left-0 w-16 h-16 border-b-4 border-l-4 border-blue-500 rounded-bl-2xl"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      delay: 1,
                    }}
                  />

                  <motion.div
                    className="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 border-blue-500 rounded-br-2xl"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      delay: 1.5,
                    }}
                  />
                </>
              )}
            </div>

            {/* Instructions */}
            <motion.div
              animate={{ opacity: [1, 0.7, 1] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="text-center"
            >
              <p className="text-3xl font-bold text-slate-100 flex items-center gap-3">
                <span>📱</span>
                Scan to mark your attendance
              </p>

              <p className="text-lg text-slate-400 mt-2">
                Open the attendance app and scan this QR code
              </p>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Live Feed Panel */}
        {splitScreen && (
          <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="w-1/2 flex flex-col bg-slate-950"
          >
            <Card className="m-6 flex-1 bg-slate-900/50 border-slate-700/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-100">
                  <Users className="h-5 w-5 text-green-500" />
                  Live Attendance Feed

                  <span className="text-sm text-slate-400 font-normal ml-auto">
                    {attendanceEntries.length} students marked present
                  </span>
                </CardTitle>
              </CardHeader>

              <CardContent className="flex-1 overflow-auto max-h-[calc(100vh-200px)]">
                <div className="space-y-2">
                  {attendanceEntries.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                      <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>Waiting for students to mark attendance...</p>
                    </div>
                  ) : (
                    attendanceEntries.map((entry, index) => (
                      <motion.div
                        key={index}
                        initial={{
                          opacity: 0,
                          x: -20,
                          backgroundColor: 'rgba(34, 197, 94, 0.2)',
                        }}
                        animate={{
                          opacity: 1,
                          x: 0,
                          backgroundColor: 'rgba(15, 23, 42, 0.5)',
                        }}
                        transition={{ duration: 0.3 }}
                        className="flex items-center justify-between p-3 rounded-lg border border-slate-700/30"
                      >
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="h-5 w-5 text-green-500" />

                          <div>
                            <p className="font-semibold text-slate-100">
                              {entry.student_name}
                            </p>

                            <p className="text-xs text-slate-400">
                              {entry.student_enrollment}
                            </p>
                          </div>
                        </div>

                        <p className="text-xs text-slate-500">
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </p>
                      </motion.div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="flex items-center justify-center px-8 py-3 bg-slate-900/50 backdrop-blur-sm border-t border-slate-700/20">
        <p className="text-sm text-slate-400">
          {connected
            ? `Token rotates every 3 seconds • ${attendanceEntries.length} ${attendanceEntries.length === 1 ? 'student' : 'students'
            } present`
            : 'Reconnecting to server...'}
        </p>
      </div>
    </div>
  );
}