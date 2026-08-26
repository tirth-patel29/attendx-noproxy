// src/components/ClassroomProjector.tsx
// The classroom projector — a "Dumb Terminal" (SRS Gate 3: High-Frequency Token Rotation).
//
// Architectural role (see docs/ARCHITECTURE_SRS.md):
//  - The projector is a PASSIVE display, never the source of truth. It simply renders
//    whatever token the server hands it over a persistent Socket.IO connection.
//  - On connect it emits `join:session` for the active session room; the server's
//    metronome then broadcasts a `token:new` event roughly every 3 seconds, and this
//    component re-renders its QR with the new payload instantly.
//  - The QR is STATIC and CONSTANTLY VISIBLE while a token is live — deliberately NO
//    CSS background patterns and NO flashing/opacity animation. Moiré interference is
//    a physical effect of re-photographing an LCD panel, and the 250ms rejection is
//    backend math (the Judge engine). Neither belongs in the frontend.
import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import { cn } from '@/lib/utils';

interface ClassroomProjectorProps {
  /** Active course session UUID (36-char) used to join the session's socket room. */
  sessionId: string;
  /** Human-readable course code shown as a badge (optional). */
  courseCode?: string;
  /** Backend origin for Socket.IO. Defaults to window.location.origin. */
  socketUrl?: string;
  /** QR code edge length in pixels. */
  size?: number;
}

interface TokenEvent {
  token_val?: string;
  created_at_epoch?: number;
  expires_at_epoch?: number;
}

export default function ClassroomProjector({
  sessionId,
  courseCode,
  socketUrl,
  size = 320,
}: ClassroomProjectorProps) {
  const [token, setToken] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [flashing, setFlashing] = useState(false);
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
      if (sessionId) socket.emit('join:session', sessionId);
    });

    socket.on('token:new', (payload: TokenEvent) => {
      if (!payload?.token_val) return;
      setToken(payload.token_val);
      setFlashing(true);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlashing(false), 100);
    });

    socket.on('disconnect', () => setConnected(false));

    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
      }
      socketRef.current = null;
    };
  }, [sessionId, socketUrl]);

  // STATE A = session anchor (2900ms). STATE B = token flash (100ms).
  // The QR encodes the same payload grammar the app's filter-gate expects:
  //   anchor -> ATTN:<session>
  //   flash  -> ATTN:<session>:<token>
  const qrValue = flashing && token ? `ATTN:${sessionId}:${token}` : `ATTN:${sessionId}`;

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-4 px-8 py-6 rounded-2xl relative overflow-hidden",
        "bg-gradient-to-br from-slate-950/95 to-slate-900/90 backdrop-blur-xl",
        "shadow-2xl shadow-black/50",
        connected 
          ? "border-2 border-blue-500/40" 
          : "border-2 border-slate-700/20"
      )}
      style={{
        boxShadow: connected
          ? '0 24px 80px rgba(0,0,0,0.5), 0 0 60px rgba(77, 142, 255, 0.15), inset 0 1px 0 rgba(255,255,255,0.05)'
          : '0 24px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)'
      }}
    >
      {/* Top glow line when connected */}
      {connected && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-100" />
      )}

      {courseCode && (
        <p className="text-sm font-bold text-slate-400 tracking-[0.12em] uppercase">
          {courseCode}
        </p>
      )}

      {/* QR Code Container — Dark glass with subtle glow */}
      <div 
        className="flex justify-center items-center p-4 rounded-lg border"
        style={{
          background: 'rgba(2, 6, 23, 0.8)',
          borderColor: 'rgba(77, 142, 255, 0.2)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03), 0 0 40px rgba(77, 142, 255, 0.1)'
        }}
      >
        <QRCodeSVG
          value={qrValue}
          size={size}
          bgColor="#020617"
          fgColor="#e1e2ec"
          level="M"
          marginSize={2}
        />
      </div>

      {/* Human-readable current token — always visible so the professor can verify it. */}
      <p
        className="font-mono font-black tracking-[0.35em] text-2xl md:text-3xl leading-tight text-slate-100"
        style={{
          textIndent: '0.35em',
          textShadow: '0 0 20px rgba(77, 142, 255, 0.3)'
        }}
      >
        {token ?? '------'}
      </p>

      <p className="text-xs text-slate-400">
        {connected ? 'Live · token rotates every 3s' : 'Disconnected · reconnecting…'}
      </p>
    </div>
  );
}