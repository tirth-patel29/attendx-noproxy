// src/components/MoireQRDisplay.tsx
// The "photonic anchor" display for the classroom projector.
//
// Implements the SRS Gate 3 + Gate 4 visual anti-relay mechanism:
//  - A static high-frequency Moiré pattern sits behind the token.
//    When a phone re-photographs an LCD/LED panel (or a video-call relay
//    re-encodes the stream), the fine grid aliases into rainbow Moiré bands,
//    which breaks Google ML Kit's binarizer and forces the camera to hunt
//    for focus (SRS §6: "+100ms delay").
//  - The actual QR token FLASHES on top of the pattern, alternating visible /
//    hidden at a fast cadence. A real phone scanning at ~30fps only needs ONE
//    frame to freeze the code (SRS Phase 3 "Frame Catch"), so flashing is fine
//    in the room. A live-stream relay, however, also carries ~150-300ms H.264
//    encode/decode latency on top of the flash gap — the remote camera can't
//    lock onto a frame in time, so the 250ms TTL rejects it.
//  - The static human-readable token is always shown so the professor can
//    verify/read it independently of the camera flow.
import { useEffect, useState, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Box, Typography } from '@mui/material';

interface MoireQRDisplayProps {
  token: string;
  courseCode: string;
  // Flash cadence in ms: how long the QR is shown vs hidden each cycle.
  showMs?: number;
  hideMs?: number;
  size?: number;
}

// Build an inline SVG data-URL for a fine concentric-ring Moiré pattern.
// Concentric rings alias into radial rainbow bands when re-sampled by a camera.
function moireBackgroundData(): string {
  const size = 360;
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="rings" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#000"/>
      <stop offset="18%" stop-color="#fff"/>
      <stop offset="36%" stop-color="#000"/>
      <stop offset="54%" stop-color="#fff"/>
      <stop offset="72%" stop-color="#000"/>
      <stop offset="90%" stop-color="#fff"/>
      <stop offset="100%" stop-color="#000"/>
    </radialGradient>
    <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
      <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#1e3a8a" stroke-width="1" opacity="0.55"/>
    </pattern>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#rings)"/>
  <rect width="${size}" height="${size}" fill="url(#grid)"/>
</svg>`;
  // URL-encode the SVG for use as a CSS background
  const encoded = encodeURIComponent(svg)
    .replace(/'/g, '%27')
    .replace(/"/g, "'");
  return `url("data:image/svg+xml,${encoded}")`;
}

export default function MoireQRDisplay({
  token,
  courseCode,
  showMs = 900,
  hideMs = 350,
  size = 280,
}: MoireQRDisplayProps) {
  const [visible, setVisible] = useState(true);
  const [bg] = useState<string>(moireBackgroundData);

  // The flash loop: alternate QR visibility at the configured cadence.
  // Uses a self-rescheduling setTimeout so the show/hide durations can differ.
  useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setTimeout>;

    const cycle = (nextVisible: boolean) => {
      if (!mounted) return;
      setVisible(nextVisible);
      // If we just showed it, keep it on for `showMs`; then hide for `hideMs`.
      const delay = nextVisible ? showMs : hideMs;
      timer = setTimeout(() => cycle(!nextVisible), delay);
    };

    timer = setTimeout(() => cycle(visible), visible ? showMs : hideMs);
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, []); // run once; phase resets handled below on token change

  // Reset to visible (fresh flash phase) whenever the token rotates (every 3s)
  useEffect(() => {
    setVisible(true);
  }, [token]);

  const flashStyle = useCallback(
    (isVisible: boolean): React.CSSProperties => ({
      opacity: isVisible ? 1 : 0.04,
      transform: isVisible ? 'scale(1)' : 'scale(0.985)',
      transition: 'opacity 60ms linear, transform 60ms linear',
    }),
    []
  );

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        maxWidth: 560,
        aspectRatio: '1 / 1',
        borderRadius: 4,
        overflow: 'hidden',
        border: '4px solid rgba(0,0,0,0.85)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
        // The Moiré photonic background
        background: bg,
        backgroundSize: 'cover',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Flashing QR overlay */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...flashStyle(visible),
        }}
      >
        <Box
          sx={{
            p: 2.5,
            bgcolor: '#ffffff',
            borderRadius: 2.5,
            boxShadow: visible ? '0 0 60px rgba(255,255,255,0.55)' : 'none',
          }}
        >
          <QRCodeSVG
            value={token}
            size={size}
            bgColor="#ffffff"
            fgColor="#000000"
            level="M"
            marginSize={0}
          />
        </Box>
      </Box>

      {/* Static human-readable token (always visible, not flashed) */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          bgcolor: 'rgba(0,0,0,0.78)',
          px: 2.5,
          py: 1,
          borderRadius: 2,
          border: '1px solid rgba(255,255,255,0.35)',
        }}
      >
        <Typography
          display="block"
          sx={{
            fontFamily: 'monospace',
            fontWeight: 900,
            letterSpacing: '0.35em',
            textIndent: '0.35em',
            color: '#fff',
            fontSize: 26,
            lineHeight: 1.2,
          }}
        >
          {token}
        </Typography>
      </Box>

      {/* Course badge */}
      <Box
        sx={{
          position: 'absolute',
          top: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          bgcolor: 'rgba(30, 58, 138, 0.92)',
          px: 2.5,
          py: 0.75,
          borderRadius: 3,
        }}
      >
        <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: 15, letterSpacing: '0.12em' }}>
          {courseCode} • LIVE
        </Typography>
      </Box>
    </Box>
  );
}