import { ARCHETYPES, ARCHETYPE_BY_KEY, type ArchetypeKey, type QuizResult } from "./quiz";

/**
 * Renders the quiz result to a branded, share-ready PNG on a canvas and hands
 * back a data URL. No dependency and no DOM scraping — the chart is redrawn in
 * canvas coordinates so the export is crisp at 2x. Laid out as an asymmetric
 * stat card (chart left, standing + rankings right) with a quiet promo strip,
 * so a shared result reads like a game card rather than a template.
 */

// Palette pinned to hex (the page's CSS vars aren't readable from a bare
// canvas), matching globals.css so the export looks like the site.
const COLORS = {
  bg0: "#05070f",
  bg1: "#0c1020",
  gridFaint: "#1c2740",
  slate400: "#94a3b8",
  slate300: "#cbd5e1",
  slate500: "#64748b",
  slate600: "#475569",
  gold200: "#f0dfa8",
  gold300: "#e6cc74",
  gold400: "#d4af37",
  gold500: "#b8962e",
  ink: "#0b0f1a",
};

const AXES = ARCHETYPES.map((a, i) => {
  const angle = (-90 + (360 / ARCHETYPES.length) * i) * (Math.PI / 180);
  return { key: a.key, label: a.label, cos: Math.cos(angle), sin: Math.sin(angle) };
});

/** The site's public origin, if configured — used for the promo strip. */
function siteHost(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  try {
    return raw ? new URL(raw).host : "";
  } catch {
    return "";
  }
}

const display = (size: number, weight = "700") =>
  `${weight} ${size}px Cinzel, Georgia, serif`;
const sans = (size: number, weight = "500") =>
  `${weight} ${size}px Geist, "Segoe UI", system-ui, sans-serif`;

/** Draw text with letter-spacing and return the width it occupied. */
function tracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number
): number {
  let cursor = x;
  for (const ch of text) {
    ctx.fillText(ch, cursor, y);
    cursor += ctx.measureText(ch).width + spacing;
  }
  return cursor - spacing - x;
}

export function buildResultImage(result: QuizResult, topKey: ArchetypeKey): string {
  const { scores, ranked } = result;
  const S = 2;
  const W = 760;
  const H = 620;
  const canvas = document.createElement("canvas");
  canvas.width = W * S;
  canvas.height = H * S;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(S, S);

  // Background: deep slate with a single off-centre gold glow (top-left, over
  // the chart) — asymmetric on purpose, not a centred halo.
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, COLORS.bg1);
  bg.addColorStop(1, COLORS.bg0);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(250, 300, 30, 250, 300, 380);
  glow.addColorStop(0, "rgba(212,175,55,0.10)");
  glow.addColorStop(1, "rgba(212,175,55,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Hairline gold frame just inside the edge — a printed-card touch.
  ctx.strokeStyle = "rgba(212,175,55,0.22)";
  ctx.lineWidth = 1;
  ctx.strokeRect(18.5, 18.5, W - 37, H - 37);

  // ── Left: the radar chart, sized as the hero ──────────────────────────────
  const cx = 250;
  const cy = 330;
  const radius = 170;
  const rings = 4;

  const at = (v: number, cos: number, sin: number) => ({
    x: cx + radius * Math.max(0, Math.min(1, v)) * cos,
    y: cy + radius * Math.max(0, Math.min(1, v)) * sin,
  });

  for (let i = 1; i <= rings; i++) {
    ctx.beginPath();
    AXES.forEach((axis, j) => {
      const r = (radius * i) / rings;
      const x = cx + r * axis.cos;
      const y = cy + r * axis.sin;
      if (j === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.strokeStyle = COLORS.gridFaint;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Spokes + labels
  ctx.font = display(13, "700");
  ctx.fillStyle = COLORS.slate400;
  AXES.forEach((axis) => {
    const end = at(1, axis.cos, axis.sin);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(end.x, end.y);
    ctx.strokeStyle = COLORS.gridFaint;
    ctx.lineWidth = 1;
    ctx.stroke();

    const lbl = at(1.17, axis.cos, axis.sin);
    ctx.textAlign =
      Math.abs(axis.cos) < 0.3 ? "center" : axis.cos > 0 ? "left" : "right";
    ctx.textBaseline = "middle";
    ctx.fillText(axis.label, lbl.x, lbl.y);
  });
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  // The player's shape — no "nation average" ghost polygon (that was clutter).
  ctx.beginPath();
  AXES.forEach((axis, j) => {
    const p = at(scores[axis.key] ?? 0, axis.cos, axis.sin);
    if (j === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
  const fill = ctx.createRadialGradient(cx, cy, 10, cx, cy, radius);
  fill.addColorStop(0, "rgba(212,175,55,0.30)");
  fill.addColorStop(1, "rgba(212,175,55,0.12)");
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = COLORS.gold400;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";
  ctx.stroke();

  AXES.forEach((axis) => {
    const p = at(scores[axis.key] ?? 0, axis.cos, axis.sin);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.gold300;
    ctx.fill();
  });

  // ── Right column: standing + rankings (left-aligned, real content) ─────────
  const rx = 470; // right column left edge
  const topLabel = ARCHETYPE_BY_KEY[topKey].label;

  // Kicker
  ctx.fillStyle = COLORS.gold500;
  ctx.font = display(12, "600");
  tracked(ctx, "KÖNIGSBURG", rx, 84, 4);

  // "YOUR CALLING"
  ctx.fillStyle = COLORS.slate500;
  ctx.font = display(11, "600");
  tracked(ctx, "YOUR CALLING", rx, 124, 3);

  // The role — big, gold, the focal point
  ctx.font = display(46, "700");
  const roleGrad = ctx.createLinearGradient(rx, 140, rx, 180);
  roleGrad.addColorStop(0, COLORS.gold200);
  roleGrad.addColorStop(1, COLORS.gold500);
  ctx.fillStyle = roleGrad;
  ctx.fillText(topLabel, rx, 168);

  // One-line descriptor (first clause of the blurb), wrapped to the column.
  const blurb = ARCHETYPE_BY_KEY[topKey].blurb.split(".")[0] + ".";
  ctx.fillStyle = COLORS.slate400;
  ctx.font = sans(14, "400");
  wrapText(ctx, blurb, rx, 200, W - rx - 44, 20);

  // Gold rule under the intro
  ctx.strokeStyle = "rgba(212,175,55,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(rx, 262);
  ctx.lineTo(W - 44, 262);
  ctx.stroke();

  // Ranked breakdown — the three strongest axes, as labelled bars.
  ctx.fillStyle = COLORS.slate500;
  ctx.font = display(11, "600");
  tracked(ctx, "STRONGEST TRAITS", rx, 292, 3);

  const barX = rx;
  const barW = W - rx - 44;
  let by = 314;
  ranked.slice(0, 3).forEach((key) => {
    const v = Math.max(0, Math.min(1, scores[key] ?? 0));
    const label = ARCHETYPE_BY_KEY[key].label;

    ctx.fillStyle = COLORS.slate300;
    ctx.font = sans(13, "600");
    ctx.textAlign = "left";
    ctx.fillText(label, barX, by);
    ctx.fillStyle = COLORS.slate500;
    ctx.textAlign = "right";
    ctx.fillText(`${Math.round(v * 100)}%`, barX + barW, by);
    ctx.textAlign = "left";

    // track + fill
    const trackY = by + 8;
    ctx.fillStyle = "rgba(148,163,184,0.15)";
    fillRoundRect(ctx, barX, trackY, barW, 6, 3);
    const fg = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    fg.addColorStop(0, COLORS.gold500);
    fg.addColorStop(1, COLORS.gold300);
    ctx.fillStyle = fg;
    fillRoundRect(ctx, barX, trackY, Math.max(6, barW * v), 6, 3);

    by += 46;
  });

  // ── Bottom promo strip: a thin gold rule, wordmark left, URL right ─────────
  const host = siteHost();
  const stripY = H - 62;
  ctx.strokeStyle = "rgba(212,175,55,0.30)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(44, stripY);
  ctx.lineTo(W - 44, stripY);
  ctx.stroke();

  // Left: the invitation
  ctx.fillStyle = COLORS.slate400;
  ctx.font = sans(14, "500");
  ctx.textAlign = "left";
  ctx.fillText("Find your role in the realm", 44, stripY + 30);

  // Right: the address in gold. Plain (untracked) sans so dots and the umlaut
  // render cleanly — a URL letter-spaced in a display serif came out garbled.
  ctx.font = sans(15, "600");
  ctx.fillStyle = COLORS.gold300;
  ctx.textAlign = "right";
  ctx.fillText(host || "take the alignment quiz", W - 44, stripY + 30);
  ctx.textAlign = "left";

  return canvas.toDataURL("image/png");
}

/** Word-wrap helper for the sans descriptor line. */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const words = text.split(" ");
  let line = "";
  let cursorY = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cursorY);
      line = word;
      cursorY += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cursorY);
}

function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.min(r, h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
  ctx.fill();
}

/** Renders and downloads the result card. Waits for the display font first so
 *  the export uses Cinzel rather than the fallback serif. */
export async function downloadResultImage(result: QuizResult, topKey: ArchetypeKey) {
  try {
    // Nudge the browser to load Cinzel at the sizes we draw, then wait.
    if (document.fonts) {
      await Promise.all([
        document.fonts.load("700 46px Cinzel"),
        document.fonts.load("600 12px Cinzel"),
      ]).catch(() => {});
      await document.fonts.ready;
    }
  } catch {
    // Fall back to the serif — still on-brand.
  }

  const url = buildResultImage(result, topKey);
  const a = document.createElement("a");
  a.href = url;
  a.download = `koenigsburg-${topKey}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
