# Projector Isoluminance — Anti-Streaming Chroma Crush (4:2:0)

> Target: `ClassroomProjector.tsx` (the React "dumb terminal" that renders
> `ATTN:<session>` anchors and the 100 ms token flash).
>
> Physics: Discord / Meet / WhatsApp encode **H.264/H.265 4:2:0** — chrominance (Cb/Cr) is
> subsampled 2×2 and heavily quantized, while luminance (Y) survives. If the QR's two states
> are **isoluminant** (identical linear luminance, different hue), the boundary exists ONLY
> in chroma. The physical camera in the room captures raw chroma → decodes. The remote
> stream crushes the two hues together → boundaries smear → remote scanner blinds.

---

## 1. Palette: an exact isoluminant pair

Use saturated, **complementary hues** at **equal linear luminance** for maximum Cb/Cr
separation. Reference pair (compute exact values in code, don't eyeball hex):

| role | sRGB | hue | notes |
|---|---|---|---|
| foreground (QR modules) | `#FF0000` | 0° (red) | Y ≈ 0.2126 |
| background (quiet zone) | `#009400` | 120° (green) | Y ≈ 0.2126 (computed, see §2) |

Any pair with equal Y and hue separation ≥ ~100° works; red↔green is the canonical choice.
**Never** use a pair whose difference is also visible in Y (e.g. black/white or navy/yellow
— those survive 4:2:0 and the whole trick fails).

## 2. The luminance-equalization helper (run at render time)

Relative luminance (W3C): `Y = 0.2126·R + 0.7152·G + 0.0722·B` over **linearized** sRGB.

```ts
// classroom/projector/isoluminant.ts
const lin = (c: number) => {
  const u = c / 255;
  return u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4);
};
const Y = (r: number, g: number, b: number) =>
  0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);

// Pick a hue (e.g. red), then solve green's channel so Y(bg) === Y(fg).
export function isoluminantPair(/* fg */ fg: [number, number, number]) {
  const target = Y(...fg);
  // Binary search a pure-green bg to match the target luminance.
  let lo = 0, hi = 255;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (Y(0, mid, 0) < target) lo = mid; else hi = mid - 1;
  }
  return { fg, bg: [0, lo, 0] as [number, number, number] };
}
```

Use the computed values in CSS custom properties:

```css
/* rendered on the token flash frame only */
.qr-flash-isoluminant {
  --qr-fg: rgb(255 0 0);
  --qr-bg: rgb(0 148 0);   /* exact value from the solver */
}
```

## 3. Rendering the flash (Canvas)

Draw the token QR with `fillStyle = bg` for the quiet zone and `fillStyle = fg` for modules,
**both** from the isoluminant pair — no anti-aliasing between them:

```ts
// ClassroomProjector.tsx (token flash frame, ~100 ms)
const { fg, bg } = isoluminantPair([255, 0, 0]);
ctx.fillStyle = `rgb(${bg.join(' ')})`; ctx.fillRect(0, 0, size, size);
ctx.fillStyle = `rgb(${fg.join(' ')})`;
// ... qrcode.toCanvas(ctx, token, { margin: 2 })  — draw modules in fg
```

Rendering rules:
- **Luma must be flat across the whole canvas**: equal Y for both colors; no gradients,
  shadows, glow, or borders on the flash frame (any Y variation gives the encoder a luma
  edge to lock onto).
- Keep the **anchor frame** (`ATTN:<session>`) normal **black-on-white** — it carries no
  secret, and keeping it B/W preserves easy local scanning and session identification.
- Only the **token flash** frame switches to isoluminant mode.
- Module size: render the QR so modules are ~2–4 px at the share resolution. 4:2:0 smears
  chroma across 2×2 blocks — larger modules give the encoder more chroma to preserve;
  smaller modules blur into noise. Tune with a real stream test.

## 4. Blink discipline (don't give the stream a second chance)

- Flash duration: ~100 ms once per 3 s metronome cycle (matches the client's full-window
  hunt). A short flash also reduces the chance the remote encoder dedicates keyframe bits to
  it.
- No fade transitions — a fade is a gradient of Y values (luma edge). Hard on/off only.
- Force the frame as a **keyframe** locally is impossible from CSS; keep the canvas small and
  the page otherwise static so the encoder keeps the scene cheap between flashes (less
  chroma bitrate budget → harder for the remote to resolve the flash).

## 5. Honest limits (read before deploying)

- This **degrades** remote decode; it is not a mathematical guarantee. A generous-bitrate
  4:2:0 encode of a static flash can still carry the chroma difference; multiple
  re-encodes (relay → re-share) crush it far harder than a single hop.
- **Your own local scanning can break** if luma drifts: monitor gamma, projector color
  temperature, and the phone camera's white balance can make the "equal" pair unequal in Y.
  Test the flash (a) in the room and (b) after a real Discord/Meet re-encode, and keep the
  anchor B/W so even a total flash failure still identifies the session.
- If local decode becomes flaky on specific projectors/cameras, ship a **fallback pair** or
  an admin toggle (isoluminant on/off per room) rather than silently breaking attendance.
- The remote attacker can still counter with: raw/high-bitrate capture, chroma enhancement,
  or a second device photographing the LCD. Isoluminance is a strong **opportunity cost** for
  them — not a cryptographically unbreakable property.

## 6. Acceptance test

1. In-room: a phone camera decodes the flash and submits PRESENT (luma tolerance verified).
2. Remote: share the same screen over Discord/Meet/WhatsApp; run the client's scanner on the
   receiving device → it must **not** decode the flash (finder squares unreadable) for ≥ 10
   consecutive cycles.
3. If (2) sometimes decodes, reduce module size and/or lower the stream's bitrate until the
   failure rate is acceptable for your threat model.