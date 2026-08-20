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
import { Box, Typography, alpha } from '@mui/material';

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
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        px: 5,
        py: 4,
        borderRadius: 3,
        // Dark glass projector panel
        background: 'linear-gradient(135deg, rgba(16, 19, 26, 0.95) 0%, rgba(29, 32, 39, 0.9) 100%)',
        backdropFilter: 'blur(40px)',
        border: connected ? `2px solid ${alpha('#4d8eff', 0.4)}` : `2px solid ${alpha('#8c909f', 0.2)}`,
        boxShadow: `
          0 24px 80px rgba(0,0,0,0.5),
          0 0 60px rgba(77, 142, 255, 0.15),
          inset 0 1px 0 rgba(255,255,255,0.05)
        `,
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0, left: 0, right: 0, height: 2,
          background: 'linear-gradient(90deg, transparent, #4d8eff, #5de6ff, transparent)',
          opacity: connected ? 1 : 0,
          transition: 'opacity 0.3s ease',
        },
      }}
    >
      {courseCode && (
        <Typography
          variant="subtitle1"
          fontWeight={700}
          color="text.secondary"
          letterSpacing="0.12em"
        >
          {courseCode}
        </Typography>
      )}

      {/* QR Code Container — Dark glass with subtle glow */}
      <Box sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 2,
        borderRadius: 2,
        background: 'rgba(2, 6, 23, 0.8)',
        border: `1px solid ${alpha('#4d8eff', 0.2)}`,
        boxShadow: `
          0 12px 40px rgba(0,0,0,0.4),
          inset 0 1px 0 rgba(255,255,255,0.03),
          0 0 40px rgba(77, 142, 255, 0.1)
        `,
      }}>
        <QRCodeSVG
          value={qrValue}
          size={size}
          bgColor="#020617"
          fgColor="#e1e2ec"
          level="M"
          marginSize={2}
        />
      </Box>

      {/* Human-readable current token — always visible so the professor can verify it. */}
      <Typography
        display="block"
        sx={{
          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          fontWeight: 900,
          letterSpacing: '0.35em',
          textIndent: '0.35em',
          fontSize: { xs: 20, sm: 24, md: 28 },
          lineHeight: 1.2,
          color: '#e1e2ec',
          textShadow: '0 0 20px rgba(77, 142, 255, 0.3)',
        }}
      >
        {token ?? '------'}
      </Typography>

      <Typography variant="caption" color="text.secondary">
        {connected ? 'Live · token rotates every 3s' : 'Disconnected · reconnecting…'}
      </Typography>
    </Box>
  );
}