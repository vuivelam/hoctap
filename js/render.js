/* ======================= VE SAN DAU (render_4.js) ======================= */
'use strict';
let CV, CX, DPR = 1;
const MON_SCALE = 1.4, HERO_SCALE = 1.35;
const IMG = {};
function img(src) { if (!src) return null; let i = IMG[src]; if (!i) { i = new Image(); i.src = src; IMG[src] = i; } return i; }

/* ================= BẢNG DANH HIỆU TU VI TIÊN HIỆP ================= */
function getTuViTitle(lvl) {
  if (lvl < 100)   return { title: 'Phàm Nhân',       color: '#b0b0b0' };
  if (lvl < 150)   return { title: 'Luyện Khí Kỳ',   color: '#73d13d' };
  if (lvl < 1000)  return { title: 'Trúc Cơ Kỳ',     color: '#40a9ff' };
  if (lvl < 2000)  return { title: 'Kết Đan Kỳ',     color: '#9254de' };
  if (lvl < 3000)  return { title: 'Hóa Thần Kỳ',    color: '#ff7a45' };
  if (lvl < 4000)  return { title: 'Nguyên Anh Kỳ',  color: '#ff4d4f' };
  if (lvl < 6000)  return { title: 'Độ Kiếp Kỳ',     color: '#ffec3d' };
  if (lvl < 8000)  return { title: 'Tiên Nhân',      color: '#ff85c0' };
  return                  { title: 'Chí Tôn Tiên Đế', color: '#00f5ff' };
}

/* ---------- HỆ THỐNG NHẢY ĐIỂM SÁT THƯƠNG TỐI ƯU ---------- */
function addText(x, y, t, color, size = 12, type = 'normal') {
  if (typeof type === 'boolean') {
    type = type ? 'crit' : 'normal';
  }
  
  const max = (typeof S !== 'undefined' && S.lowFx) ? 15 : 35;
  if (R.quiet || R.txt.length > max) return;

  const offsetX = (Math.random() - 0.5) * 26;
  const offsetY = (Math.random() - 0.5) * 10;

  let life = 0.85;
  if (type === 'miss') life = 0.5;
  else if (type === 'crit') life = 1.0;
  else if (type === 'mega') life = 1.25;

  R.txt.push({
    x: x + offsetX,
    y: y + offsetY,
    t,
    color,
    size,
    type,
    life,
    maxLife: life
  });
}

function burst(x, y, color) {
  if (R.quiet) return;
  R.fx.push({ k: 'ring', x, y, color, life: 0.5, max: 0.5 });
  R.sparks = R.sparks || [];
  if (R.sparks.length < 90) {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + rnd(-0.2, 0.2), spd = rnd(60, 160);
      R.sparks.push({ x, y: y - 10, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, color: color || '#ffd24a', life: rnd(0.25, 0.5), max: 0.5, sz: rnd(2, 4) });
    }
  }
}

function fxLine(a, b, atk) {
  if (R.quiet || R.fx.length > 80) return;
  let el = 'phys', v = 0; for (const e in atk.parts) if (atk.parts[e] > v) { v = atk.parts[e]; el = e; }
  R.fx.push({ k: 'line', x1: a.x, y1: a.y - 20, x2: b.x, y2: b.y - 14, color: ELEM_COL[el], life: 0.22, max: 0.22 });
  burst(b.x, b.y, ELEM_COL[el]);
}

const JFX = window.JFX || { m: {}, s: {}, c: {}, f: {} }, FX_SCALE = 1.75, FX_MAX = 70;
const dir16 = (vx, vy) => (((Math.round(Math.atan2(-vx, vy) / (Math.PI / 8)) % 16) + 16) % 16);

/* Đã cập nhật: Nhận vị trí caster (Người tung chiêu - Hero hoặc Quái) */
function castFx(atk, caster) {
  const source = caster || H;
  const f = atk && atk.id && JFX.f && JFX.f[atk.id], c = f && f.pre && JFX.c && JFX.c[f.pre];
  if (!c || R.quiet || R.fx.length > FX_MAX) return;
  R.fx.push({ k: 'boom', s: c, x: source.x, y: source.y - 6, t: 0, life: animDur(c), dir: 0 });
}

function skillFx(a, b, atk) {
  const f = (atk.id && JFX.f && JFX.f[atk.id]) || {}, m = atk.id && JFX.m[f.c || JFX.s[atk.id]];
  castFx(atk, a); // Truyền đối tượng xuất chiêu
  if (!m || R.quiet) { fxLine(a, b, atk); return; }
  if (R.fx.length > FX_MAX) return;
  const x1 = a.x, y1 = a.y - 20, x2 = b.x, y2 = b.y - 14, dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy) || 1;
  const form = f.form === undefined ? 1 : f.form, n = clamp(f.num || 1, 1, 8), ang = Math.atan2(dy, dx);
  const boom = (s, x, y, delay = 0) => R.fx.push({ k: 'boom', s, x, y, t: -delay, life: animDur(s), dir: dir16(dx, dy) });
  const mis = (tx, ty, delay = 0) => R.fx.push({ k: 'mis', s: m.fly, hit: m.hit, x1, y1, x2: tx, y2: ty, t: -delay, life: Math.min(0.6, Math.hypot(tx - x1, ty - y1) / m.spd), dir: dir16(tx - x1, ty - y1) });
  const s1 = m.hit || m.fly;
  if (atk.melee || form >= 8) { boom(s1, x2, y2); return; }
  if (form === 7) { boom(s1, x1, y1 + 8); return; }
  if (form === 6) { for (let i = 0; i < n; i++) boom(s1, x2 + (n > 1 ? rnd(-36, 36) : 0), y2 + (n > 1 ? rnd(-24, 24) : 0), i * 0.07); return; }
  if (!m.fly) { boom(s1, x2, y2); return; }
  if (form === 3) { for (let i = 0; i < n; i++) { const g = ang + i / n * Math.PI * 2; mis(x1 + Math.cos(g) * 130, y1 + Math.sin(g) * 130); } return; }
  if (form === 2) { for (let i = 0; i < n; i++) { const g = ang + (i - (n - 1) / 2) * 0.26; mis(x1 + Math.cos(g) * d, y1 + Math.sin(g) * d); } return; }
  if (form === 1) { for (let i = 0; i < n; i++) mis(x2, y2, i * 0.09); return; }
  if (form === 0) { const px = -dy / d, py = dx / d; for (let i = 0; i < n; i++) { const o = (i - (n - 1) / 2) * 34; mis(x2 + px * o, y2 + py * o); } return; }
  for (let i = 0; i < n; i++) mis(x2 + rnd(-60, 60), y2 + rnd(-40, 40), i * 0.05);
}

const animDur = s => Math.min(1.2, s.n * s.ms / 1000);

function drawFxSprite(s, dir, t, x, y, loop) {
  const im = img(s.f); if (!im || !im.complete || !im.naturalWidth) return false;
  const fr = loop ? Math.floor(t * 1000 / s.ms) % s.n : Math.min(s.n - 1, Math.floor(t * 1000 / s.ms));
  const row = s.d > 1 ? Math.round(dir * s.d / 16) % s.d : 0;
  CX.save();
  CX.globalCompositeOperation = 'lighter';
  CX.drawImage(im, fr * s.w, row * s.h, s.w, s.h, x - s.ax * FX_SCALE, y - s.ay * FX_SCALE, s.w * FX_SCALE, s.h * FX_SCALE);
  CX.globalAlpha = 0.35;
  const sc2 = FX_SCALE * 1.15;
  CX.drawImage(im, fr * s.w, row * s.h, s.w, s.h, x - s.ax * sc2, y - s.ay * sc2, s.w * sc2, s.h * sc2);
  CX.restore();
  return true;
}

function stepFx(f, dt) {
  f.t += dt; if (f.t < 0) return true;
  if (f.k === 'mis') {
    if (Math.random() < 0.4) {
      const k = clamp(f.t / f.life, 0, 1), mx = f.x1 + (f.x2 - f.x1) * k, my = f.y1 + (f.y2 - f.y1) * k;
      R.sparks = R.sparks || [];
      if (R.sparks.length < 80) R.sparks.push({ x: mx + rnd(-4, 4), y: my + rnd(-4, 4), vx: rnd(-15, 15), vy: rnd(-15, 15), color: '#ffd24a', life: 0.3, max: 0.3, sz: rnd(2, 3) });
    }
    if (f.t >= f.life) {
      burst(f.x2, f.y2, '#ffae42');
      if (f.hit) { Object.assign(f, { k: 'boom', s: f.hit, x: f.x2, y: f.y2, t: 0, life: animDur(f.hit) }); return true; }
      return false;
    }
  }
  return f.t < f.life;
}

function drawFx(f) {
  if (f.t < 0) return false;
  if (f.k === 'mis') { const k = clamp(f.t / f.life, 0, 1); return drawFxSprite(f.s, f.dir, f.t, f.x1 + (f.x2 - f.x1) * k, f.y1 + (f.y2 - f.y1) * k, true); }
  return drawFxSprite(f.s, f.dir, f.t, f.x, f.y, false);
}

const UI_SCALE_MOBILE = 0.8;
const isMobileUI = () => !(typeof isDesktopLandscape === 'function' && isDesktopLandscape()) && !!(window.matchMedia && (window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 700));
const uiScale = () => document.body.classList.contains('mob') ? UI_SCALE_MOBILE : 1;

function resizeArena() {
  const b = $('#battle'), box = { width: b.offsetWidth, height: b.offsetHeight };
  DPR = Math.min(2, window.devicePixelRatio || 1) * uiScale();
  CV.width = Math.round(box.width * DPR); CV.height = Math.round(box.height * DPR);
  AR.w = box.width; AR.h = box.height; AR.top = 58; AR.bot = box.height - 12;
  snapCamera();
}

const CAM = { x: 0, y: 0 };
const camTarget = () => [clamp(H.x - AR.w / 2, 0, Math.max(0, WORLD.w - AR.w)), clamp(H.y - AR.h * 0.55, 0, Math.max(0, WORLD.h - AR.h))];
function snapCamera() { [CAM.x, CAM.y] = camTarget(); }
function updateCamera(dt) { const [tx, ty] = camTarget(), k = Math.min(1, dt * 6); CAM.x += (tx - CAM.x) * k; CAM.y += (ty - CAM.y) * k; }

const BG_TILE = 1536;
function drawTiledBg(c, bg) {
  if (!(bg && bg.complete && bg.naturalWidth)) { c.fillStyle = '#26301f'; c.fillRect(CAM.x - 2, CAM.y - 2, AR.w + 4, AR.h + 4); return; }
  if (OBS.g) { c.drawImage(bg, 0, 0, WORLD.w, WORLD.h); return; }
  const T = BG_TILE, i0 = Math.floor(CAM.x / T), i1 = Math.floor((CAM.x + AR.w) / T), j0 = Math.floor(CAM.y / T), j1 = Math.floor((CAM.y + AR.h) / T);
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
    const fx = i & 1, fy = j & 1;
    if (!fx && !fy) { c.drawImage(bg, i * T, j * T, T, T); continue; }
    c.save(); c.translate(i * T + (fx ? T : 0), j * T + (fy ? T : 0)); c.scale(fx ? -1 : 1, fy ? -1 : 1); c.drawImage(bg, 0, 0, T, T); c.restore();
  }
}

const MINI = { s: 92, m: 8, top: 62 };
function drawMinimap(c) {
  if (R.town || S.miniMap === false) return;
  const s = MINI.s, x0 = AR.w - s - MINI.m, y0 = MINI.top, k = s / WORLD.w;
  c.save(); c.globalAlpha = 0.9; c.fillStyle = '#000c'; c.fillRect(x0 - 2, y0 - 2, s + 4, s + 4);
  const bg = R.bgImg;
  if (bg && bg.complete && bg.naturalWidth) {
    if (OBS.g) c.drawImage(bg, x0, y0, s, s);
    else { 
      const n = Math.round(WORLD.w / BG_TILE), h = s / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { c.save(); c.translate(x0 + i * h + (i & 1 ? h : 0), y0 + j * h + (j & 1 ? h : 0)); c.scale(i & 1 ? -1 : 1, j & 1 ? -1 : 1); c.drawImage(bg, 0, 0, h, h); c.restore(); } 
    }
  } else { c.fillStyle = '#26301f'; c.fillRect(x0, y0, s, s); }
  c.globalAlpha = 1;
  c.strokeStyle = '#fff6'; c.lineWidth = 1; c.strokeRect(x0 + CAM.x * k, y0 + CAM.y * k, Math.min(s, AR.w * k), Math.min(s, AR.h * k));
  for (const d of R.ground) if (lootMatch(d.it)) { c.fillStyle = RAR_COL[d.it.r]; c.fillRect(x0 + d.x * k - 1, y0 + d.y * k - 1, 2, 2); }
  for (const e of R.enemies) {
    if (e.dead) continue;
    const r = e.cls === 'boss' ? 3.2 : e.cls === 'elite' ? 2.4 : 1.8;
    c.fillStyle = e.goldBoss ? '#ffd24a' : e.cls === 'boss' ? '#ff4a3a' : SERIES_COL[e.series];
    c.beginPath(); c.arc(x0 + e.x * k, y0 + e.y * k, r, 0, 7); c.fill();
  }
  if (R.petPos) { c.fillStyle = '#9fe36a'; c.fillRect(x0 + R.petPos.x * k - 1.5, y0 + R.petPos.y * k - 1.5, 3, 3); }
  const hx = x0 + H.x * k, hy = y0 + H.y * k, a = Math.PI / 2 + (H.dir || 0) * Math.PI / 4;
  c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.beginPath();
  c.moveTo(hx + Math.cos(a) * 5, hy + Math.sin(a) * 5); c.lineTo(hx + Math.cos(a + 2.5) * 4, hy + Math.sin(a + 2.5) * 4); c.lineTo(hx + Math.cos(a - 2.5) * 4, hy + Math.sin(a - 2.5) * 4);
  c.closePath(); c.fill(); c.stroke();
  c.strokeStyle = '#c8a45a'; c.strokeRect(x0 - 2, y0 - 2, s + 4, s + 4);
  c.font = '9px "IBM Plex Mono", monospace'; c.textAlign = 'center'; c.fillStyle = '#f3d88a';
  c.fillText(R.tower ? `Tháp · tầng ${R.tower.floor}` : zoneOf(Math.min(S.stage, STAGES)).n, x0 + s / 2, y0 + s + 11);
  c.restore();
}

const onScreen = (x, y, m = 120) => x > CAM.x - m && x < CAM.x + AR.w + m && y > CAM.y - m && y < CAM.y + AR.h + m;

function drawSprite(im, sz, x, y, scale, flip, alpha = 1) {
  if (!im || !im.complete || !im.naturalWidth) return false;
  const w = im.naturalWidth * scale, h = im.naturalHeight * scale;
  const okFoot = sz && sz[2] >= 0 && sz[2] <= im.naturalWidth && sz[3] >= im.naturalHeight * 0.5 && sz[3] <= im.naturalHeight * 1.2;
  const fx = okFoot ? sz[2] * scale : w / 2, fy = okFoot ? sz[3] * scale : h * 0.95;
  CX.save(); CX.globalAlpha = alpha; CX.translate(x, y); if (flip) CX.scale(-1, 1);
  CX.drawImage(im, -fx, -fy, w, h); CX.restore();
  return true;
}

const dirOf = (vx, vy) => (((Math.round(Math.atan2(-vx, vy) / (Math.PI / 4)) % 8) + 8) % 8);
const ONCE = { at: 1, hurt: 1, die: 1 };
function animLen(key, act) { const m = W.anim && W.anim[key] && W.anim[key][act]; return m ? m.n * m.ms / 1000 : 0; }

function drawAnim(key, act, dir, t, x, y, sc, alpha = 1) {
  const set = W.anim && W.anim[key]; if (!set) return false;
  const m = set[act] || set.st; if (!m) return false;
  const im = img('img/a/' + m.f); if (!im.complete || !im.naturalWidth) return false;
  let fr = Math.floor(t * 1000 / m.ms); fr = ONCE[act] ? Math.min(fr, m.n - 1) : fr % m.n;
  const d = m.d >= 8 ? dir : Math.floor(dir * m.d / 8);
  CX.globalAlpha = alpha;
  CX.drawImage(im, fr * m.w, d * m.h, m.w, m.h, x - m.ax * sc, y - m.ay * sc, m.w * sc, m.h * sc);
  CX.globalAlpha = 1;
  return m.h * sc;
}

function setAct(o, act) { if (o.act !== act) { o.act = act; o.actT = 0; } }
function stepAct(o, dt, idle) {
  o.actT = (o.actT || 0) + dt;
  if ((o.act === 'at' || o.act === 'hurt') && o.actT >= Math.max(0.25, animLen(o.animKey, o.act))) setAct(o, idle);
}

const NAME_COL = { boss: '#ffb070', elite: '#8fc6ff', normal: '#e8dcc8', hero: '#fff3c0', pet: '#9fe36a', gold: '#ffd24a' };
const LABELS = [];
function label(x, y, text, col, size, hp, barCol) { LABELS.push({ x, y, text, col, size, hp, barCol }); }

function flushLabels() {
  if (!LABELS.length) return;
  CX.textAlign = 'center'; CX.lineJoin = 'round';
  const placed = [];
  for (const L of LABELS.sort((a, b) => b.y - a.y)) {
    CX.font = `bold ${L.size}px "IBM Plex Mono", monospace`; L.w = Math.max(CX.measureText(L.text).width, 46); L.h = L.size + 4 + (L.hp >= 0 ? 8 : 0);
    let y = L.y;
    for (let k = 0; k < 8; k++) { const hit = placed.find(p => Math.abs(p.x - L.x) < (p.w + L.w) / 2 && y > p.top && y - L.h < p.y); if (!hit) break; y = hit.top - 1; }
    L.py = y; L.top = y - L.h; placed.push({ x: L.x, w: L.w, y, top: L.top });
  }
  for (const L of LABELS) {
    const y = L.py, bw = Math.min(L.w, 60);
    if (L.hp >= 0) {
      CX.fillStyle = '#080d0bcc'; CX.fillRect(L.x - bw / 2 - 1, y - 7, bw + 2, 7);
      CX.strokeStyle = '#3d4d42'; CX.lineWidth = 1; CX.strokeRect(L.x - bw / 2 - 1, y - 7, bw + 2, 7);
      const hGrad = CX.createLinearGradient(0, y - 6, 0, y - 1);
      hGrad.addColorStop(0, '#fff8'); hGrad.addColorStop(0.35, L.barCol); hGrad.addColorStop(1, L.barCol);
      CX.fillStyle = hGrad; CX.fillRect(L.x - bw / 2, y - 6, bw * clamp(L.hp, 0, 1), 5);
    }
    CX.font = `bold ${L.size}px "IBM Plex Mono", monospace`; CX.lineWidth = 3.5; CX.strokeStyle = '#000f';
    const ty = y - (L.hp >= 0 ? 9 : 1); CX.strokeText(L.text, L.x, ty); CX.fillStyle = L.col; CX.fillText(L.text, L.x, ty);
  }
  LABELS.length = 0;
}

function nameTag(x, y, text, col, size = 11) {
  CX.font = `bold ${size}px "IBM Plex Mono", monospace`; CX.textAlign = 'center'; CX.lineJoin = 'round'; CX.lineWidth = 3.5; CX.strokeStyle = '#000f';
  CX.strokeText(text, x, y); CX.fillStyle = col; CX.fillText(text, x, y);
}

const enemyName = e => (e.goldBoss ? `👑 [Hoàng Kim] ${e.n} · Lv${e.L}` : e.cls === 'boss' ? `💀 [Thủ Lĩnh] ${e.n} · Lv${e.L}` : e.cls === 'elite' ? `⭐ [Tinh Anh] ${e.n} · Lv${e.L}` : `${e.n} · Lv${e.L}`);
function bar(x, y, w, h, f, col) { CX.fillStyle = '#000a'; CX.fillRect(x, y, w, h); CX.fillStyle = col; CX.fillRect(x, y, w * clamp(f, 0, 1), h); }

function draw(dt) {
  const c = CX; c.setTransform(DPR, 0, 0, DPR, 0, 0); c.clearRect(0, 0, AR.w, AR.h);
  updateCamera(dt);
  let shakeX = 0, shakeY = 0;
  if (R.shake > 0) {
    R.shake = Math.max(0, R.shake - dt);
    const mag = R.shake * 16;
    shakeX = (Math.random() - 0.5) * mag;
    shakeY = (Math.random() - 0.5) * mag;
  }
  c.setTransform(DPR, 0, 0, DPR, (-Math.round(CAM.x) + shakeX) * DPR, (-Math.round(CAM.y) + shakeY) * DPR);
  const bg = R.bgImg;
  drawTiledBg(c, bg);

  c.textAlign = 'center';
  for (const d of R.town ? [] : R.ground) {
    const im = d.it.ic ? img(d.it.ic) : null, match = lootMatch(d.it), sel = R.pickTarget === d;
    const bob = Math.sin((d.age + d.x) * 3) * 1.5;

    if (d.it.r >= 2) {
      let beamColor = null;
      if (d.it.r === 5 || (d.it.set && d.it.set.kind === 'platina')) {
        beamColor = '#ffffff';
      } else if (d.it.r === 4 || (d.it.set && d.it.set.kind === 'gold')) {
        beamColor = '#ff7700';
      } else if (d.it.r === 3 || d.it.vio) {
        beamColor = '#c77bff';
      } else if (d.it.r === 2) {
        beamColor = '#ffd24a';
      }

      if (beamColor) {
        c.save(); 
        c.globalCompositeOperation = 'lighter';
        const bGrad = c.createLinearGradient(0, d.y, 0, d.y - 90);
        bGrad.addColorStop(0, beamColor + 'aa');
        bGrad.addColorStop(0.5, beamColor + '44');
        bGrad.addColorStop(1, 'transparent');
        c.fillStyle = bGrad; 
        c.fillRect(d.x - 7, d.y - 90, 14, 90);

        c.fillStyle = beamColor + '55';
        c.beginPath(); 
        c.ellipse(d.x, d.y + 2, 18, 7, 0, 0, 7); 
        c.fill();
        c.restore();
      }
    }
    c.fillStyle = '#0008'; c.beginPath(); c.ellipse(d.x, d.y + 2, 11, 4, 0, 0, 7); c.fill();
    c.strokeStyle = RAR_COL[d.it.r]; c.lineWidth = sel ? 2.5 : match ? 1.6 : 0.8; c.globalAlpha = match || sel ? 1 : 0.55;
    c.beginPath(); c.ellipse(d.x, d.y + 2, 12, 5, 0, 0, 7); c.stroke();
    if (im && im.complete && im.naturalWidth) { const k = Math.min(26 / im.naturalWidth, 26 / im.naturalHeight); c.drawImage(im, d.x - im.naturalWidth * k / 2, d.y - im.naturalHeight * k + bob, im.naturalWidth * k, im.naturalHeight * k); }
    if (match || sel || d.it.r >= 2) { c.font = 'bold 10px "IBM Plex Mono", monospace'; c.fillStyle = '#000'; c.fillText(d.it.n, d.x + 1, d.y - 27); c.fillStyle = RAR_COL[d.it.r]; c.fillText(d.it.n, d.x, d.y - 28); }
    c.globalAlpha = 1;
  }

  for (const e of R.corpses) {
    e.actT += dt; const a = clamp(1.6 - e.actT, 0, 1);
    const sc = e.cls === 'boss' ? 1.25 : e.cls === 'elite' ? 1.05 : 0.85;
    if (!(e.animKey && drawAnim(e.animKey, 'die', e.dir || 0, e.actT, e.x, e.y, sc * MON_SCALE, a))) { c.globalAlpha = a * 0.5; drawSprite(e.img, e.sz, e.x, e.y, sc, e.face < 0); c.globalAlpha = 1; }
  }
  R.corpses = R.corpses.filter(e => e.actT < 1.6);
  if (typeof drawPet === 'function') drawPet(c, dt);

  const ents = R.enemies.filter(e => !e.dead).concat([{ hero: true, y: H.y }]).sort((a, b) => a.y - b.y);
  for (const e of ents) {
    if (e.hero) {
      const shGrad = c.createRadialGradient(H.x, H.y, 2, H.x, H.y, 20);
      shGrad.addColorStop(0, '#000c'); shGrad.addColorStop(0.6, '#0006'); shGrad.addColorStop(1, 'transparent');
      c.fillStyle = shGrad; c.beginPath(); c.ellipse(H.x, H.y, 20, 8, 0, 0, 7); c.fill();

      c.save(); c.globalCompositeOperation = 'lighter';
      const tNow = performance.now() / 1000;
      const hCol = (typeof heroSeries === 'function' && SERIES_COL[heroSeries()]) || '#ffd24a';
      c.strokeStyle = hCol; c.lineWidth = 2.2; c.globalAlpha = 0.8 + Math.sin(tNow * 4) * 0.2;
      c.beginPath(); c.ellipse(H.x, H.y + 1, 24, 10, (tNow * 1.5) % 6.28, 0, 7); c.stroke();
      c.strokeStyle = '#fff'; c.lineWidth = 1.2; c.globalAlpha = 0.65;
      c.beginPath(); c.ellipse(H.x, H.y + 1, 16, 7, (-tNow * 2) % 6.28, 0, 7); c.stroke();
      if (S.lvl >= 30) {
        c.strokeStyle = '#ffd700'; c.lineWidth = 1.5; c.globalAlpha = 0.6 + Math.sin(tNow * 3) * 0.2;
        c.beginPath(); c.ellipse(H.x, H.y + 1, 30, 12, (tNow * 0.8) % 6.28, 0, 7); c.stroke();
      }
      const moteY = H.y - 10 - Math.abs(Math.sin(tNow * 5 + H.x)) * 35;
      c.fillStyle = hCol; c.globalAlpha = 0.7; c.beginPath(); c.arc(H.x + Math.sin(tNow * 7) * 12, moteY, 2.5, 0, 7); c.fill();
      c.restore();

      const hw = W.hero[S.fac];
      H.animKey = hw && hw.anim;
      const mvx = H.x - (H.px ?? H.x), mvy = H.y - (H.py ?? H.y); H.px = H.x; H.py = H.y;
      H.moving = Math.hypot(mvx, mvy) > 0.4; if (H.moving && H.act !== 'at') H.dir = dirOf(mvx, mvy);
      stepAct(H, dt, H.moving ? 'run' : 'st');
      if (R.deadT > 0) setAct(H, 'die'); else if (H.act !== 'at' && H.act !== 'hurt') setAct(H, H.moving ? 'run' : 'st');
      const drawn = hw && hw.anim && drawAnim(hw.anim, H.act || 'st', H.dir || 0, H.actT || 0, H.x, H.y, HERO_SCALE);
      
      // ---------- VẼ DANH HIỆU TU VI VÀ TÊN NHÂN VẬT ----------
      const heroYBase = H.y - (drawn ? Math.min(drawn, 90) * 0.9 : 52) - 6;
      const tuVi = getTuViTitle(S.lvl || 1);

      // Dòng Danh Hiệu Tu Vi (Phía trên)
      label(H.x, heroYBase - 13, `« ${tuVi.title} »`, tuVi.color, 11, -1);

      // Dòng Tên Nhân Vật + Thanh Máu (Phía dưới)
      label(H.x, heroYBase, `⚔ ${S.name || (FAC[S.fac] && FAC[S.fac].n) || ''} · Lv${S.lvl}`, NAME_COL.hero, 12, R.life / Math.max(1, R.P ? R.P.life : 1), '#4fd04f');

      if (!drawn && !(hw && drawSprite(img(hw.img), hw.sz, H.x, H.y, 0.9, H.face < 0, R.deadT > 0 ? 0.35 : 1))) { c.fillStyle = hCol; c.beginPath(); c.arc(H.x, H.y - 20, 14, 0, 7); c.fill(); }
      if (R.hurtT > 0) { c.fillStyle = '#f004'; c.beginPath(); c.arc(H.x, H.y - 24, 20, 0, 7); c.fill(); }
      continue;
    }

    const sc = e.cls === 'boss' ? 1.3 : e.cls === 'elite' ? 1.05 : 0.85;
    c.fillStyle = '#0008'; c.beginPath(); c.ellipse(e.x, e.y, e.r, e.r * 0.38, 0, 0, 7); c.fill();

    if (e.cls === 'boss' || e.goldBoss) {
      c.save(); c.globalCompositeOperation = 'lighter';
      const t = performance.now() / 1000;
      c.strokeStyle = e.goldBoss ? '#ffd24a' : '#ff4500'; c.lineWidth = 3.5;
      c.globalAlpha = 0.85 + Math.sin(t * 5) * 0.15;
      c.beginPath(); c.ellipse(e.x, e.y, e.r * 1.45, e.r * 0.58, t * 2, 0, 7); c.stroke();
      c.strokeStyle = '#ff9900'; c.lineWidth = 1.8;
      c.beginPath(); c.ellipse(e.x, e.y, e.r * 1.85, e.r * 0.72, -t * 1.5, 0, 7); c.stroke();
      c.fillStyle = '#ff3700aa';
      const fY = e.y - Math.abs(Math.sin(t * 6 + e.x)) * 30;
      c.beginPath(); c.arc(e.x + Math.sin(t * 8) * 16, fY, 4, 0, 7); c.fill();
      c.restore();
    } else if (e.cls === 'elite') {
      c.save(); c.globalCompositeOperation = 'lighter';
      const t = performance.now() / 1000;
      c.strokeStyle = '#60a5fa'; c.lineWidth = 2.4; c.globalAlpha = 0.8 + Math.sin(t * 4) * 0.2;
      c.beginPath(); c.ellipse(e.x, e.y, e.r * 1.3, e.r * 0.5, t * 2, 0, 7); c.stroke();
      c.restore();
    } else {
      c.strokeStyle = SERIES_COL[e.series]; c.lineWidth = 1.4; c.beginPath(); c.ellipse(e.x, e.y, e.r, e.r * 0.38, 0, 0, 7); c.stroke();
    }

    e.animKey = MON[e.tid].anim; stepAct(e, dt, e.moving ? 'run' : 'st');
    const ah = e.animKey && drawAnim(e.animKey, e.act || 'st', e.dir || 0, e.actT || 0, e.x, e.y, sc * MON_SCALE, e.hitT > 0 ? 0.75 : 1);
    if (!ah && !drawSprite(e.img, e.sz, e.x, e.y, sc, e.face < 0, e.hitT > 0 ? 0.6 : 1)) { c.fillStyle = SERIES_COL[e.series]; c.beginPath(); c.arc(e.x, e.y - e.r, e.r, 0, 7); c.fill(); }
    if (e.hitT > 0) e.hitT -= dt;
    const top = e.y - (ah ? Math.min(ah, 90) * 0.85 : e.img && e.img.naturalHeight ? e.img.naturalHeight * sc : e.r * 2) - 8;
    label(e.x, top, enemyName(e), e.goldBoss ? NAME_COL.gold : NAME_COL[e.cls] || NAME_COL.normal, e.cls === 'boss' ? 12 : 11, e.hp / e.max, e.cls === 'boss' ? '#ff5030' : '#e03a2a');
    if (e.poison > 0) { c.fillStyle = '#8fe34a'; c.fillRect(e.x - 22, top + 5, 44 * e.poison / 3, 2); }
  }

  R.fx = R.fx.filter(f => { if (f.k !== 'mis' && f.k !== 'boom') return true; const ok = stepFx(f, dt); if (ok) drawFx(f); return ok; });
  for (const f of R.fx) {
    if (f.k === 'mis' || f.k === 'boom') continue;
    f.life -= dt; const a = clamp(f.life / f.max, 0, 1);
    c.save(); c.globalCompositeOperation = 'lighter';
    c.globalAlpha = a; c.strokeStyle = f.color;
    if (f.k === 'line') { c.lineWidth = 3.5; c.beginPath(); c.moveTo(f.x1, f.y1); c.lineTo(f.x2, f.y2); c.stroke(); }
    else { c.lineWidth = 2.5; c.beginPath(); c.arc(f.x, f.y - 10, 8 + (1 - a) * 36, 0, 7); c.stroke(); }
    c.restore();
  }
  R.fx = R.fx.filter(f => f.life > 0);

  if (R.sparks && R.sparks.length) {
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const p of R.sparks) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 35 * dt;
      const a = clamp(p.life / p.max, 0, 1);
      c.globalAlpha = a; c.fillStyle = p.color;
      c.beginPath(); c.arc(p.x, p.y, (p.sz || 2.5) * a, 0, 7); c.fill();
    }
    c.restore();
    R.sparks = R.sparks.filter(p => p.life > 0);
  }

  c.textAlign = 'center';
  flushLabels();

  for (const t of R.txt) {
    const maxLife = t.maxLife || t.max || 0.85;
    t.life -= dt;

    const type = t.type || (t.crit ? 'crit' : 'normal');
    const spd = type === 'miss' ? 22 : (type === 'mega' ? 40 : 30);
    t.y -= spd * dt;

    const prog = 1 - Math.max(0, t.life) / maxLife;

    let scale = 1;
    if (type === 'crit') {
      scale = prog < 0.2 ? 1 + (0.2 - prog) * 2.2 : 1;
    } else if (type === 'mega') {
      scale = prog < 0.25 ? 1 + (0.25 - prog) * 3.2 : 1;
    } else if (type === 'miss') {
      scale = 0.9;
    } else {
      scale = prog < 0.15 ? 1 + (0.15 - prog) * 1.4 : 1;
    }

    const a = clamp(t.life / 0.25, 0, 1);

    c.save();
    c.globalAlpha = a;
    c.font = `bold ${Math.round((t.size || 12) * scale)}px "IBM Plex Mono", "Courier New", monospace`;
    c.textAlign = 'center';

    c.lineWidth = type === 'mega' ? 4.5 : (type === 'crit' ? 3.5 : 2.5);
    c.strokeStyle = type === 'mega' ? '#4a0000' : '#000000';
    c.strokeText(t.t, t.x, t.y);

    c.fillStyle = t.color || '#ffffff';
    c.fillText(t.t, t.x, t.y);
    c.restore();
  }
  R.txt = R.txt.filter(t => t.life > 0);

  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (typeof drawJoystick === 'function') drawJoystick(c);
  drawMinimap(c);

  if (R.banner && R.banner.t > 0) {
    R.banner.t -= dt; c.globalAlpha = clamp(R.banner.t, 0, 1);
    c.fillStyle = '#000a'; c.fillRect(0, AR.h * 0.36, AR.w, 54);
    c.font = '20px "IBM Plex Mono", monospace'; c.fillStyle = '#f3d88a'; c.fillText(R.banner.text, AR.w / 2, AR.h * 0.36 + 26);
    c.font = '12px "IBM Plex Mono", monospace'; c.fillStyle = '#d8ccb4'; c.fillText(R.banner.sub, AR.w / 2, AR.h * 0.36 + 44);
    c.globalAlpha = 1;
  }
}