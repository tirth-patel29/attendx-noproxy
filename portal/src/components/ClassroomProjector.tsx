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
import { Box, Typography } from '@mui/material';

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
  size = 280,
}: ClassroomProjectorProps) {
  const [token, setToken] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

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
      // Subscribe to the session's metronome room so we receive token:new broadcasts.
      if (sessionId) socket.emit('join:session', sessionId);
    });

    socket.on('token:new', (payload: TokenEvent) => {
      if (payload?.token_val) setToken(payload.token_val);
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

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1.5,
        px: 4,
        py: 2.5,
        borderRadius: 3,
        // Plain flat white card — deliberately NO CSS background patterns.
        bgcolor: '#ffffff',
        border: connected ? '3px solid #1976d2' : '3px solid #e0e0e0',
        boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
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

      {token ? (
        // Static, constantly-visible QR. Re-rendered only when the payload (token) rotates.
        <Box sx={{ bgcolor: '#ffffff', p: 1, borderRadius: 2 }}>
          <QRCodeSVG
            value={token}
            size={size}
            bgColor="#ffffff"
            fgColor="#000000"
            level="M"
            marginSize={2}
          />
        </Box>
      ) : (
        <Box
          sx={{
            width: size,
            height: size,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'text.secondary',
          }}
        >
          {connected ? 'Waiting for next token…' : 'Connecting…'}
        </Box>
      )}

      {/* Human-readable current token — always visible so the professor can verify it. */}
      <Typography
        display="block"
        sx={{
          fontFamily: 'monospace',
          fontWeight: 900,
          letterSpacing: '0.35em',
          textIndent: '0.35em',
          fontSize: 28,
          lineHeight: 1.2,
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
