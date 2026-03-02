// CanvasRenderer.js — Pure HTML5 Canvas rendering for the race

// ── Color map ──────────────────────────────────────────────────────────────
export const COLOR_CSS = {
  Red:'#ef4444',    Blue:'#3b82f6',   Green:'#22c55e',  Yellow:'#eab308',
  Orange:'#f97316', Purple:'#a855f7', Pink:'#ec4899',   Teal:'#14b8a6',
  Cyan:'#06b6d4',   Lime:'#84cc16',  Maroon:'#9b2226',  Navy:'#1e40af',
  Gold:'#d97706',   Black:'#4b5563',
};

// ── Path computation ───────────────────────────────────────────────────────
const PATH_POINTS  = 1200;
const CANVAS_W     = 800;
const CANVAS_H     = 480;
const CX           = 400;
const CY           = 235;
const RX           = 215;   // horizontal half-span (home→1st distance)
const RY           = 175;   // vertical half-span (home→2nd distance)
// Base positions: Home=bottom, 1st=right, 2nd=top, 3rd=left

// The four diamond corners, in running order starting at Home
const CORNERS = [
  { x: CX,      y: CY + RY },  // Home  (t = 0.00)
  { x: CX + RX, y: CY      },  // 1st   (t = 0.25)
  { x: CX,      y: CY - RY },  // 2nd   (t = 0.50)
  { x: CX - RX, y: CY      },  // 3rd   (t = 0.75)
];

const PTS_PER_SEGMENT = PATH_POINTS / CORNERS.length; // 300

let _path = null; // [{x,y, nx,ny}] – precomputed path + normals

export function buildPath() {
  if (_path) return _path;

  _path = [];

  // Build 4 straight-line segments: Home→1B, 1B→2B, 2B→3B, 3B→Home
  for (let seg = 0; seg < CORNERS.length; seg++) {
    const from = CORNERS[seg];
    const to   = CORNERS[(seg + 1) % CORNERS.length];

    for (let j = 0; j < PTS_PER_SEGMENT; j++) {
      const t = j / PTS_PER_SEGMENT;
      _path.push({
        x:  from.x + (to.x - from.x) * t,
        y:  from.y + (to.y - from.y) * t,
        nx: 0,
        ny: 0,
      });
    }
  }

  // Compute normals (perpendicular to direction of travel) for lane offsets
  for (let i = 0; i < PATH_POINTS; i++) {
    const next = _path[(i + 1) % PATH_POINTS];
    const prev = _path[(i - 1 + PATH_POINTS) % PATH_POINTS];
    const dx   = next.x - prev.x;
    const dy   = next.y - prev.y;
    const len  = Math.hypot(dx, dy) || 1;
    _path[i].nx = -dy / len;
    _path[i].ny =  dx / len;
  }

  return _path;
}

// ── Get (x,y) for a marble given position (0–1) + laneOffset (pixels) ──────
export function getMarbleCoord(position, laneOffset = 0) {
  const path  = buildPath();
  const idx   = Math.floor(position * PATH_POINTS) % PATH_POINTS;
  const pt    = path[idx];
  return {
    x: pt.x + pt.nx * laneOffset,
    y: pt.y + pt.ny * laneOffset,
  };
}

// ── Draw the baseball field + track ──────────────────────────────────────────
function drawField(ctx) {
  // Dark background
  ctx.fillStyle = '#0d1117';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Grass field — fill the full diamond interior
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(CORNERS[0].x, CORNERS[0].y);
  CORNERS.forEach(c => ctx.lineTo(c.x, c.y));
  ctx.closePath();
  const grd = ctx.createRadialGradient(CX, CY, 30, CX, CY, Math.max(RX, RY));
  grd.addColorStop(0, '#1a4d1a');
  grd.addColorStop(1, '#0f2d0f');
  ctx.fillStyle = grd;
  ctx.fill();
  ctx.restore();

  // Infield dirt diamond (scaled inward from the track corners)
  const DR = 0.55; // infield is 55% of the track radius
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(CX,          CY + RY * DR);  // home
  ctx.lineTo(CX + RX * DR, CY);           // 1st
  ctx.lineTo(CX,          CY - RY * DR);  // 2nd
  ctx.lineTo(CX - RX * DR, CY);           // 3rd
  ctx.closePath();
  ctx.fillStyle = '#6b3e1e';
  ctx.fill();
  ctx.restore();

  // Track oval (outer glow)
  const path = buildPath();
  ctx.save();
  ctx.beginPath();
  path.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y));
  ctx.closePath();
  ctx.strokeStyle = 'rgba(245,158,11,0.15)';
  ctx.lineWidth   = 28;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(245,158,11,0.35)';
  ctx.lineWidth   = 2;
  ctx.stroke();
  ctx.restore();

  // Base markers
  const basePositions = CORNERS; // corners are exactly the base positions

  const baseLabels = ['H','1B','2B','3B'];

  basePositions.forEach((pos, i) => {
    ctx.save();
    ctx.fillStyle    = i === 0 ? '#e5e7eb' : '#d4a373';
    ctx.strokeStyle  = '#000';
    ctx.lineWidth    = 1.5;
    ctx.beginPath();
    const sz = i === 0 ? 10 : 8;
    ctx.rect(pos.x - sz/2, pos.y - sz/2, sz, sz);
    ctx.fill();
    ctx.stroke();

    // Label
    ctx.fillStyle  = '#7d8590';
    ctx.font       = 'bold 11px "JetBrains Mono", monospace';
    ctx.textAlign  = 'center';
    ctx.fillText(baseLabels[i], pos.x, pos.y - 14);
    ctx.restore();
  });

  // Pitcher's mound
  ctx.save();
  ctx.beginPath();
  ctx.arc(CX, CY, 12, 0, Math.PI * 2);
  ctx.fillStyle = '#7d5a3c';
  ctx.fill();
  ctx.restore();
}

// ── Draw a single marble ──────────────────────────────────────────────────────
function drawMarble(ctx, x, y, color, name, effects = [], isFinished = false) {
  const radius = 10;
  const css    = COLOR_CSS[color] || '#888';

  ctx.save();

  // Effect aura
  if (effects.includes('boost')) {
    ctx.beginPath();
    ctx.arc(x, y, radius + 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(251,191,36,0.3)';
    ctx.fill();
  }
  if (effects.includes('stun')) {
    ctx.beginPath();
    ctx.arc(x, y, radius + 6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(239,68,68,0.25)';
    ctx.fill();
  }
  if (effects.includes('reverse')) {
    ctx.beginPath();
    ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(168,85,247,0.3)';
    ctx.fill();
  }

  // Marble body with radial gradient (shiny sphere look)
  const grad = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, radius);
  grad.addColorStop(0, 'white');
  grad.addColorStop(0.3, css);
  grad.addColorStop(1, adjustBrightness(css, -60));

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle   = grad;
  ctx.shadowColor = css;
  ctx.shadowBlur  = 8;
  ctx.fill();

  // Marble outline
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth   = 1.5;
  ctx.stroke();

  // Finished crown
  if (isFinished) {
    ctx.fillStyle = '#f59e0b';
    ctx.font      = '10px serif';
    ctx.textAlign = 'center';
    ctx.fillText('👑', x, y - 14);
  }

  // Name label
  ctx.shadowBlur  = 0;
  ctx.fillStyle   = '#fff';
  ctx.font        = '600 9px "DM Sans", sans-serif';
  ctx.textAlign   = 'center';
  ctx.fillText(name.length > 8 ? name.slice(0, 7) + '…' : name, x, y + radius + 11);

  ctx.restore();
}

// ── Darken/lighten a hex color ─────────────────────────────────────────────
function adjustBrightness(hex, amount) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r   = Math.max(0, Math.min(255, (num >> 16) + amount));
  const g   = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amount));
  const b   = Math.max(0, Math.min(255, (num & 0xff) + amount));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

// ── Dynamic lane offset computation ───────────────────────────────────────────
// Marbles hug the baseline when alone; only spread when close to neighbours.
const CLUSTER_THRESHOLD = 0.018; // position units — ~2/3 of a base-length
const LANE_STEP         = 11;    // px between lanes (10px radius + 1px gap)

function computeLaneOffsets(marbles) {
  const offsets = {}; // marble id → perpendicular pixel offset

  // Sort by position so cluster membership is always contiguous
  const sorted = [...marbles].sort((a, b) => a.position - b.position);

  let i = 0;
  while (i < sorted.length) {
    // Grow cluster while next marble is within threshold of cluster start
    let j = i + 1;
    while (j < sorted.length && sorted[j].position - sorted[i].position <= CLUSTER_THRESHOLD) {
      j++;
    }

    const cluster = sorted.slice(i, j);

    // Stable sort by id within cluster so lane assignments don't flicker
    cluster.sort((a, b) => (a.id < b.id ? -1 : 1));

    const n = cluster.length;
    cluster.forEach((m, rank) => {
      offsets[m.id] = (rank - (n - 1) / 2) * LANE_STEP;
    });

    i = j;
  }

  return offsets;
}

// ── Main render function ──────────────────────────────────────────────────────
export function renderFrame(canvas, marbles) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  buildPath();

  // Scale the canvas backing buffer by devicePixelRatio for sharp HiDPI rendering.
  // Assigning canvas.width resets the context transform, so we re-apply the scale
  // each time we resize. The check avoids resizing every frame.
  if (canvas.width !== CANVAS_W * dpr || canvas.height !== CANVAS_H * dpr) {
    canvas.width  = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    ctx.scale(dpr, dpr);
  }

  // All draw calls use logical pixel coordinates (CANVAS_W × CANVAS_H).
  // The ctx.scale(dpr, dpr) applied above maps them to physical pixels.
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  drawField(ctx);

  if (!marbles || marbles.length === 0) return;

  // Compute dynamic lane offsets: lone marbles hug the path; clustered marbles fan out
  const offsets = computeLaneOffsets(marbles);

  // Sort by Y for pseudo-3D depth (higher Y = drawn later = in front)
  const sorted = [...marbles].sort((a, b) => {
    const aCoord = getMarbleCoord(a.position, offsets[a.id] ?? 0);
    const bCoord = getMarbleCoord(b.position, offsets[b.id] ?? 0);
    return aCoord.y - bCoord.y;
  });

  sorted.forEach(m => {
    const coord = getMarbleCoord(m.position, offsets[m.id] ?? 0);
    drawMarble(ctx, coord.x, coord.y, m.color, m.name, m.activeEffects ?? [], m.finished);
  });
}

export const CANVAS_WIDTH  = CANVAS_W;
export const CANVAS_HEIGHT = CANVAS_H;
