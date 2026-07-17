import { ARCHETYPES, ARCHETYPE_BY_KEY, type ArchetypeKey } from "./quiz";

/**
 * Renders the quiz result to a branded, share-ready PNG on a canvas and hands
 * back a blob URL. No dependency and no DOM scraping — the chart is redrawn in
 * canvas coordinates so the export looks crisp at 2x and always carries the
 * Königsburg wordmark + a subtle "take the quiz" footer wherever it's shared.
 */

// Palette pinned to hex (the page's CSS vars aren't readable from a bare
// canvas), matching globals.css so the export looks like the site.
const COLORS = {
  bg0: "#070a14",
  bg1: "#0d1120",
  panel: "#0f1526",
  grid: "#334155",
  gridFaint: "#1e293b",
  slate400: "#94a3b8",
  slate300: "#cbd5e1",
  slate500: "#64748b",
  gold200: "#f0dfa8",
  gold300: "#e6cc74",
  gold400: "#d4af37",
  gold500: "#b8962e",
  ink: "#0b0f1a",
};

const NATION_AVERAGE: Record<ArchetypeKey, number> = {
  builder: 0.55,
  fighter: 0.5,
  gatherer: 0.55,
  roleplayer: 0.45,
  explorer: 0.45,
  statesman: 0.5,
};

const AXES = ARCHETYPES.map((a, i) => {
  const angle = (-90 + (360 / ARCHETYPES.length) * i) * (Math.PI / 180);
  return { key: a.key, label: a.label, cos: Math.cos(angle), sin: Math.sin(angle) };
});

/** The site's public origin, if configured — used for the footer promo line. */
function siteHost(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  try {
    return raw ? new URL(raw).host : "";
  } catch {
    return "";
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function buildResultImage(scores: Record<ArchetypeKey, number>, topKey: ArchetypeKey): string {
  const S = 2; // 2x for crisp export
  const W = 720;
  const H = 900;
  const canvas = document.createElement("canvas");
  canvas.width = W * S;
  canvas.height = H * S;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(S, S);

  // Background: slate gradient + a soft gold glow up top, like the site.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, COLORS.bg1);
  bg.addColorStop(1, COLORS.bg0);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W / 2, -60, 40, W / 2, -60, 460);
  glow.addColorStop(0, "rgba(212,175,55,0.10)");
  glow.addColorStop(1, "rgba(212,175,55,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, 360);

  const font = (size: number, weight = "700") =>
    `${weight} ${size}px Cinzel, Georgia, serif`;

  ctx.textAlign = "center";

  // Wordmark
  ctx.fillStyle = COLORS.slate300;
  ctx.font = font(18, "600");
  ctx.save();
  ctx.letterSpacing = "6px";
  ctx.fillText("KÖNIGSBURG", W / 2, 62);
  ctx.restore();

  // Eyebrow + headline
  ctx.fillStyle = COLORS.gold500;
  ctx.font = font(12, "600");
  ctx.save();
  ctx.letterSpacing = "5px";
  ctx.fillText("THE COUNCIL HAS WEIGHED YOU", W / 2, 108);
  ctx.restore();

  const topLabel = ARCHETYPE_BY_KEY[topKey].label;
  ctx.font = font(40, "700");
  const grad = ctx.createLinearGradient(0, 130, 0, 175);
  grad.addColorStop(0, COLORS.gold200);
  grad.addColorStop(1, COLORS.gold500);
  // "You are a" in slate, the role in gold.
  ctx.save();
  ctx.letterSpacing = "1px";
  const prefix = "You are a ";
  ctx.font = font(34, "700");
  const prefixW = ctx.measureText(prefix).width;
  const roleW = ctx.measureText(topLabel).width;
  const totalW = prefixW + roleW;
  const startX = (W - totalW) / 2;
  ctx.textAlign = "left";
  ctx.fillStyle = COLORS.slate300;
  ctx.fillText(prefix, startX, 168);
  ctx.fillStyle = grad;
  ctx.fillText(topLabel, startX + prefixW, 168);
  ctx.restore();
  ctx.textAlign = "center";

  // ── Radar chart ──────────────────────────────────────────────────────────
  const cx = W / 2;
  const cy = 470;
  const radius = 190;
  const rings = 4;

  const at = (v: number, cos: number, sin: number) => ({
    x: cx + radius * Math.max(0, Math.min(1, v)) * cos,
    y: cy + radius * Math.max(0, Math.min(1, v)) * sin,
  });

  // Concentric rings
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
  ctx.font = font(15, "700");
  ctx.fillStyle = COLORS.slate400;
  AXES.forEach((axis) => {
    const end = at(1, axis.cos, axis.sin);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(end.x, end.y);
    ctx.strokeStyle = COLORS.gridFaint;
    ctx.lineWidth = 1;
    ctx.stroke();

    const lbl = at(1.16, axis.cos, axis.sin);
    ctx.textAlign =
      Math.abs(axis.cos) < 0.3 ? "center" : axis.cos > 0 ? "left" : "right";
    ctx.textBaseline = "middle";
    ctx.fillText(axis.label, lbl.x, lbl.y);
  });
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  const drawPoly = (
    data: Record<ArchetypeKey, number>,
    fill: string,
    stroke: string,
    lineW: number
  ) => {
    ctx.beginPath();
    AXES.forEach((axis, j) => {
      const p = at(data[axis.key] ?? 0, axis.cos, axis.sin);
      if (j === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineW;
    ctx.lineJoin = "round";
    ctx.stroke();
  };

  // Nation average behind, player gold in front.
  drawPoly(NATION_AVERAGE, "rgba(100,116,139,0.12)", "rgba(100,116,139,0.4)", 1.5);
  drawPoly(scores, "rgba(212,175,55,0.22)", COLORS.gold400, 3);

  // Gold vertices
  AXES.forEach((axis) => {
    const p = at(scores[axis.key] ?? 0, axis.cos, axis.sin);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.gold300;
    ctx.fill();
  });

  // ── Footer: the advertising banner ────────────────────────────────────────
  // A gold-outlined call-to-action panel — the whole point of a shareable image
  // is that whoever sees it knows where to take the quiz.
  const host = siteHost();
  ctx.textAlign = "center";

  const bx = 44;
  const bw = W - bx * 2;
  const by = 722;
  const bh = 138;

  // Panel: faint gold wash + gold border, so it reads as a distinct banner.
  roundRect(ctx, bx, by, bw, bh, 18);
  ctx.fillStyle = "rgba(212,175,55,0.08)";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(212,175,55,0.55)";
  ctx.stroke();

  // Headline
  const headGrad = ctx.createLinearGradient(0, by + 30, 0, by + 68);
  headGrad.addColorStop(0, COLORS.gold200);
  headGrad.addColorStop(1, COLORS.gold400);
  ctx.fillStyle = headGrad;
  ctx.font = font(30, "700");
  ctx.save();
  ctx.letterSpacing = "1px";
  ctx.fillText("WHICH ROLE ARE YOU?", W / 2, by + 52);
  ctx.restore();

  // Sub-line
  ctx.fillStyle = COLORS.slate300;
  ctx.font = font(15, "600");
  ctx.save();
  ctx.letterSpacing = "2px";
  ctx.fillText("TAKE THE NATION ROLE ALIGNMENT QUIZ", W / 2, by + 82);
  ctx.restore();

  // The address, in a bright gold pill — the clear call to action.
  const addr = host || "join Königsburg";
  ctx.font = font(17, "700");
  const addrW = ctx.measureText(addr).width;
  const pillW = addrW + 44;
  const pillH = 34;
  const pillX = (W - pillW) / 2;
  const pillY = by + bh - 46;
  roundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
  const pillGrad = ctx.createLinearGradient(0, pillY, 0, pillY + pillH);
  pillGrad.addColorStop(0, COLORS.gold300);
  pillGrad.addColorStop(1, COLORS.gold500);
  ctx.fillStyle = pillGrad;
  ctx.fill();
  ctx.fillStyle = COLORS.ink;
  ctx.textBaseline = "middle";
  ctx.fillText(addr, W / 2, pillY + pillH / 2 + 1);
  ctx.textBaseline = "alphabetic";

  return canvas.toDataURL("image/png");
}

/** Renders and downloads the result card. Waits for the display font first so
 *  the export uses Cinzel rather than the fallback serif. */
export async function downloadResultImage(
  scores: Record<ArchetypeKey, number>,
  topKey: ArchetypeKey
) {
  try {
    // Nudge the browser to load Cinzel at the sizes we draw, then wait.
    if (document.fonts) {
      await Promise.all([
        document.fonts.load('700 40px Cinzel'),
        document.fonts.load('600 18px Cinzel'),
      ]).catch(() => {});
      await document.fonts.ready;
    }
  } catch {
    // Fall back to the serif — still on-brand.
  }

  const url = buildResultImage(scores, topKey);
  const a = document.createElement("a");
  a.href = url;
  a.download = `koenigsburg-${topKey}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
