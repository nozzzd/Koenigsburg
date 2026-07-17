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
  const H = 560;
  const canvas = document.createElement("canvas");
  canvas.width = W * S;
  canvas.height = H * S;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(S, S);

  // Backdrop: plain deep slate. No gold wash behind the chart — gold at low
  // alpha over navy reads as muddy olive; the gold lives in linework instead.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, COLORS.bg1);
  bg.addColorStop(1, COLORS.bg0);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Certificate frame: a firm outer hairline, a whisper of an inner one, and
  // a small diamond pinned at each corner.
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(212,175,55,0.30)";
  ctx.strokeRect(18.5, 18.5, W - 37, H - 37);
  ctx.strokeStyle = "rgba(212,175,55,0.10)";
  ctx.strokeRect(24.5, 24.5, W - 49, H - 49);
  for (const [dx, dy] of [
    [18, 18],
    [W - 18, 18],
    [18, H - 18],
    [W - 18, H - 18],
  ] as const) {
    diamond(ctx, dx, dy, 3, COLORS.gold500);
  }

  // ── Left: the radar chart ─────────────────────────────────────────────────
  const cx = 250;
  const cy = 265;
  const radius = 140;
  const rings = 4;

  // Data points clamp to the ring; label anchors must NOT (a label at 1.18
  // would silently snap back onto the ring and collide with the vertices).
  const at = (v: number, cos: number, sin: number) => ({
    x: cx + radius * Math.max(0, Math.min(1, v)) * cos,
    y: cy + radius * Math.max(0, Math.min(1, v)) * sin,
  });
  const anchor = (v: number, cos: number, sin: number) => ({
    x: cx + radius * v * cos,
    y: cy + radius * v * sin,
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
    // The outermost ring gets a whisper of gold so the chart has a rim.
    ctx.strokeStyle = i === rings ? "rgba(212,175,55,0.25)" : COLORS.gridFaint;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Spokes + labels. Side labels sit closer in than the poles so the long
  // words ("Statesman", "Gatherer") stay clear of the frame and the column.
  ctx.font = display(11, "600");
  ctx.fillStyle = COLORS.slate400;
  AXES.forEach((axis) => {
    const end = at(1, axis.cos, axis.sin);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(end.x, end.y);
    ctx.strokeStyle = COLORS.gridFaint;
    ctx.lineWidth = 1;
    ctx.stroke();

    const isPole = Math.abs(axis.cos) < 0.3;
    const lbl = anchor(isPole ? 1.18 : 1.13, axis.cos, axis.sin);
    ctx.textAlign = isPole ? "center" : axis.cos > 0 ? "left" : "right";
    ctx.textBaseline = "middle";
    ctx.fillText(axis.label, lbl.x, lbl.y);
  });
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  // The player's shape: flat translucent gold, like the site's own chart.
  ctx.beginPath();
  AXES.forEach((axis, j) => {
    const p = at(scores[axis.key] ?? 0, axis.cos, axis.sin);
    if (j === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
  ctx.fillStyle = "rgba(212,175,55,0.18)";
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

  // ── Right column ──────────────────────────────────────────────────────────
  const rx = 470;
  const colRight = W - 44;
  const colW = colRight - rx;
  const topLabel = ARCHETYPE_BY_KEY[topKey].label;

  // Kicker
  ctx.fillStyle = COLORS.gold500;
  ctx.font = display(12, "600");
  tracked(ctx, "KÖNIGSBURG", rx, 112, 4);

  // "YOUR CALLING"
  ctx.fillStyle = COLORS.slate500;
  ctx.font = display(11, "600");
  tracked(ctx, "YOUR CALLING", rx, 166, 3);

  // The role name, auto-fit so long words ("Roleplayer") never overflow.
  let roleSize = 44;
  ctx.font = display(roleSize, "700");
  while (ctx.measureText(topLabel).width > colW && roleSize > 24) {
    roleSize -= 2;
    ctx.font = display(roleSize, "700");
  }
  const roleGrad = ctx.createLinearGradient(0, 212 - roleSize, 0, 212);
  roleGrad.addColorStop(0, COLORS.gold200);
  roleGrad.addColorStop(1, COLORS.gold500);
  ctx.fillStyle = roleGrad;
  ctx.fillText(topLabel, rx, 212);

  // One-sentence descriptor, wrapped to the column.
  const blurb = ARCHETYPE_BY_KEY[topKey].blurb.split(".")[0] + ".";
  ctx.fillStyle = COLORS.slate400;
  ctx.font = sans(14, "400");
  wrapText(ctx, blurb, rx, 242, colW, 20);

  // The site's signature divider: line — diamond — line.
  const midX = (rx + colRight) / 2;
  ctx.lineWidth = 1;
  const ruleL = ctx.createLinearGradient(rx, 0, midX - 10, 0);
  ruleL.addColorStop(0, "rgba(212,175,55,0)");
  ruleL.addColorStop(1, "rgba(212,175,55,0.5)");
  ctx.strokeStyle = ruleL;
  ctx.beginPath();
  ctx.moveTo(rx, 316.5);
  ctx.lineTo(midX - 10, 316.5);
  ctx.stroke();
  const ruleR = ctx.createLinearGradient(midX + 10, 0, colRight, 0);
  ruleR.addColorStop(0, "rgba(212,175,55,0.5)");
  ruleR.addColorStop(1, "rgba(212,175,55,0)");
  ctx.strokeStyle = ruleR;
  ctx.beginPath();
  ctx.moveTo(midX + 10, 316.5);
  ctx.lineTo(colRight, 316.5);
  ctx.stroke();
  diamond(ctx, midX, 316.5, 3, COLORS.gold400);

  // Ranked breakdown: numbered like a herald's roll, not fake percentages
  // (normalising against the top score made every card read "100%").
  ctx.fillStyle = COLORS.slate500;
  ctx.font = display(11, "600");
  tracked(ctx, "STRONGEST TRAITS", rx, 348, 3);

  const NUMERALS = ["I", "II", "III"];
  let rowY = 382;
  ranked.slice(0, 3).forEach((key, i) => {
    const v = Math.max(0, Math.min(1, scores[key] ?? 0));

    // Rank chip: a small gold-edged diamond with the numeral inside.
    diamond(ctx, rx + 8, rowY - 5, 8, "rgba(212,175,55,0.08)", "rgba(212,175,55,0.55)");
    ctx.fillStyle = COLORS.gold300;
    ctx.font = display(10, "700");
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(NUMERALS[i], rx + 8, rowY - 4);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    ctx.fillStyle = COLORS.slate300;
    ctx.font = sans(13, "600");
    ctx.fillText(ARCHETYPE_BY_KEY[key].label, rx + 30, rowY);

    const barX = rx + 30;
    const barW = colRight - barX;
    const trackY = rowY + 10;
    ctx.fillStyle = "rgba(148,163,184,0.14)";
    fillRoundRect(ctx, barX, trackY, barW, 5, 2.5);
    const fg = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    fg.addColorStop(0, COLORS.gold500);
    fg.addColorStop(1, COLORS.gold300);
    ctx.fillStyle = fg;
    fillRoundRect(ctx, barX, trackY, Math.max(5, barW * v), 5, 2.5);

    rowY += 48;
  });

  // ── Bottom promo strip ────────────────────────────────────────────────────
  const host = siteHost();
  const stripY = H - 54;
  ctx.strokeStyle = "rgba(212,175,55,0.30)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(44, stripY);
  ctx.lineTo(W - 44, stripY);
  ctx.stroke();

  ctx.fillStyle = COLORS.slate400;
  ctx.font = sans(13, "500");
  ctx.textAlign = "left";
  ctx.fillText("Find your role in the realm", 44, stripY + 27);

  // The address in plain gold sans; tracking a URL in a display serif garbles it.
  ctx.font = sans(14, "600");
  ctx.fillStyle = COLORS.gold300;
  ctx.textAlign = "right";
  ctx.fillText(host || "take the alignment quiz", W - 44, stripY + 27);
  ctx.textAlign = "left";

  return canvas.toDataURL("image/png");
}

/** A small rotated square — the site's diamond motif. */
function diamond(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  fill?: string,
  stroke?: string
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fillRect(-r, -r, r * 2, r * 2);
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.strokeRect(-r + 0.5, -r + 0.5, r * 2 - 1, r * 2 - 1);
  }
  ctx.restore();
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
