/* ======================= CHIEN DAU (combat_3.js) ======================= */
'use strict';
const R = { corpses: [], lootWait: 0, ground: [], pickTarget: null, enemies: [], P: null, life: 1, mana: 1, atkT: 0, deadT: 0, spawnT: 0, kills: 0, t0: Date.now(), logs: [], fx: [], txt: [], dirty: true, stall: 0, farm: 0 };
const AR = { w: 400, h: 520, top: 70, bot: 470 };
const H = { x: 768, y: 768, face: 1 };

/* ---------- DỮ LIỆU NGŨ HÀNH & SKILL QUÁI VẬT ---------- */
const ELEM_TYPES = ['phys', 'poison', 'cold', 'fire', 'light'];

const MONSTER_SERIES_SKILLS = {
  0: [14, 14, 14, 20, 21],   // Hệ Kim
  1: [54, 50, 47, 45],       // Hệ Mộc
  2: [33, 35, 42, 47, 45],   // Hệ Thủy
  3: [54, 50, 47, 45],       // Hệ Hỏa
  4: [54, 50, 47, 45, 65, 66, 71, 72], // Hệ Thổ
};

function getMonsterSkill(e) {
  if (!e || typeof SK === 'undefined') return null;

  const sIdx = (typeof e.series === 'number' && e.series >= 0 && e.series <= 4) ? e.series : 0;
  const list = MONSTER_SERIES_SKILLS[sIdx] || MONSTER_SERIES_SKILLS[0];
  const skId = list[Math.floor(Math.abs((e.id || 0) * 100)) % list.length];
  const s = SK[skId];
  if (!s) return null;

  const elemKey = ELEM_TYPES[sIdx];

  return {
    id: skId,
    n: s.n,
    rad: e.ranged ? 220 : 70,
    melee: !e.ranged,
    targets: e.cls === 'boss' ? 3 : 1,
    around: s.form === 7,
    parts: { phys: e.dmg * 0.3, [elemKey]: e.dmg * 0.9 }
  };
}

/* ---------- VÙNG / AI ---------- */
const zoneIdx = st => Math.min(ZONES.length - 1, Math.floor((st - 1) / ZONE_STAGES));
const zoneOf = st => ZONES[zoneIdx(st)];
const inZone = st => ((st - 1) % ZONE_STAGES) + 1;

function stageLevel(st) {
  if (st > STAGES) return Math.min(MAX_LEVEL, 160 + Math.floor((st - STAGES) * 2));
  const z = zoneOf(st); return Math.round(z.lo + (inZone(st) - 1) * (z.hi - z.lo) / (ZONE_STAGES - 1));
}
const isBossStage = st => inZone(st) === ZONE_STAGES;

/* ---------- QUÁI VẬT (TĂNG TIẾN MÁU ĐỘNG THEO CẤP ĐỘ) ---------- */
const POISON_TIME = 3;

// Hệ số phân loại quái
const CLS = { 
  normal: { hp: 1.0,  dmg: 1.0, xp: 1,  r: 17 },  // Quái thường
  elite:  { hp: 3.5,  dmg: 1.5, xp: 3,  r: 21 },  // Tinh anh
  boss:   { hp: 12.0, dmg: 2.5, xp: 20, r: 30 }   // Boss
};

const DIFFS = [
  { n: 'Dễ',     hp: 0.8, dmg: 0.8, rew: 0.8, d: 'Quái yếu hơn' }, 
  { n: 'Thường', hp: 1.0, dmg: 1.0, rew: 1.0, d: 'Cân bằng chuẩn' }, 
  { n: 'Khó',    hp: 1.5, dmg: 1.3, rew: 1.3, d: 'Quái trâu hơn' }
];
const diffOf = () => DIFFS[(S && [0, 1, 2].includes(S.diff)) ? S.diff : 1];

/**
 * Công thức tính chỉ số Quái vật:
 * Cấp nhỏ (L <= 15) -> Máu ít, đánh nhanh chết.
 * Cấp lớn (L > 30) -> Máu tăng theo lũy thừa cấp độ (L^1.8), càng về sau càng siêu trâu.
 */
function enemyStats(L, cls) {
  const c = CLS[cls];
  
  // Hệ số tăng trưởng lũy thừa theo Cấp độ (Level Scaling Factor)
  const levelGrowth = 1 + Math.pow(L / 14, 1.85); 
  
  // Máu cơ bản: Cấp 1 chỉ ~25 HP; Cấp 50 ~ 4.500 HP; Cấp 100 ~ 28.000 HP; Cấp 150 ~ 90.000 HP
  const baseHp = (20 + 8 * L) * levelGrowth * c.hp;
  const baseDmg = (2 + 1.1 * L + 0.008 * L * L) * c.dmg;

  return { 
    hp: Math.round(baseHp), 
    dmg: baseDmg, 
    ar: 30 + L * 9, 
    def: 8 + L * 3.5 
  };
}

const XP_SLOW_FROM = 30, XP_SLOW_K = 200, XP_SLOW_P = 1.4;

function xpSlow(L) {
  if (L <= XP_SLOW_FROM) return 1;
  if (L <= 500) return 1 + XP_SLOW_K * Math.pow((L - XP_SLOW_FROM) / 470, XP_SLOW_P);
  const base = 1 + XP_SLOW_K * Math.pow(1, XP_SLOW_P);
  return base * Math.pow((L - 499) / 100, 1.8);
}

function expFor(L) { return Math.floor(J.exp[clamp(L, 1, MAX_LEVEL) - 1] / (10 + L * 1.4)) * 2; }

function makeEnemy(tid, L, cls, x, y) {
  const m = MON[tid], z = zoneOf(S.stage), st = enemyStats(L, cls), D = diffOf(); st.hp *= D.hp; st.dmg *= D.dmg;
  
  let series = 0;
  if (m && typeof m.series === 'number' && m.series >= 0 && m.series <= 4) {
    series = m.series;
  } else if (z && z.sw) {
    series = wpick([0, 1, 2, 3, 4], i => (z.sw[i] || 0) + 1);
  } else {
    series = irnd(0, 4);
  }

  const res = {}; ELEM.forEach((e, i) => { res[e] = Math.min(m.rmax[i] || 75, L * 0.35 + (cls === 'boss' ? 10 : 0)); });
  return { id: Math.random(), tid, n: m.n, img: m.img ? img(m.img) : null, sz: m.sz, L, cls, series, res,
    hp: st.hp, max: st.hp, dmg: st.dmg, ar: st.ar, def: st.def, x, y, r: CLS[cls].r,
    spd: (30 + (m.run || 6) * 4) * (cls === 'boss' ? 0.7 : 1), atkCd: rnd(0.5, 1.5), cd: 1.2 + 18 / Math.max(8, m.spd || 18) * 0.5,
    ranged: Math.random() < 0.2 && cls !== 'boss', stun: 0, poison: 0, poisonDmg: 0, hitT: 0, face: 1 };
}

function spawnWave() {
  R.enemies = []; R.stall = 0;
  const z = zoneOf(S.stage), L = stageLevel(S.stage);
  const around = (r0, r1) => { const a = rnd(0, Math.PI * 2), r = rnd(r0, r1); return inWorld(H.x + Math.cos(a) * r, H.y + Math.sin(a) * r); };
  const sx = () => (R.sp = around(140, 240))[0], sy = () => R.sp[1];
  if (S.wave === WAVES && isBossStage(S.stage)) {
    const bp = around(220, 260); R.enemies.push(makeEnemy(z.boss, L + 1, 'boss', bp[0], bp[1]));
    R.enemies.push(makeEnemy(pick(z.m), L, 'elite', sx(), sy()));
    log(`<b class="boss">${esc(MON[z.boss].n)}</b> xuất hiện!`);
  } else {
    const n = 2 + irnd(0, 2) + (inZone(S.stage) > 5 ? 1 : 0);
    for (let i = 0; i < n; i++) R.enemies.push(makeEnemy(pick(z.m), L, S.wave === WAVES && i === 0 ? 'elite' : 'normal', sx(), sy()));
  }
  if (z.id !== R.zoneShown) { R.zoneShown = z.id; R.banner = { t: 2.4, text: z.n, sub: `Cấp ${z.lo}–${z.hi}` }; if (typeof onZoneChange === 'function') onZoneChange(z); }
}

/* ---------- CÔNG THỨC TRÚNG / SÁT THƯƠNG ---------- */
function hitPercent(ar, def, ignore = 0) {
  const d = def * (100 - Math.min(ignore, 100)) / 100;
  let p = ar + d === 0 ? 50 : ar * 100 / (ar + d);
  if (p > MAX_HIT + 4) p = MAX_HIT;
  return Math.max(MIN_HIT, p);
}

function applyPart(dmg, e, attackerSeries, targetSeries, targetRes, targetResMax, series5) {
  let res = targetRes[e];
  if (counters(attackerSeries, targetSeries)) res -= series5;
  else if (counters(targetSeries, attackerSeries)) res += series5;
  res = clamp(res, -targetResMax, Math.min(targetResMax, MAX_RESIST));
  return dmg * (100 - res) / 100;
}

/* ---------- HERO HIT (CÓ BẠO KÍCH & CHÍ MẠNG) ---------- */
function heroHit(a, e) {
  if (a.useAR && Math.random() * 100 >= hitPercent(R.P.ar, e.def, a.ignore)) { 
    addText(e.x, e.y - e.r - 8, 'Trượt', '#aaaaaa', 11, 'miss'); 
    return 0; 
  }
  
  const crit = Math.random() * 100 < a.crit;
  const mega = crit && (Math.random() < 0.25);
  
  let tot = 0, best = 'phys', bv = 0;
  for (const el in a.parts) {
    let d = a.parts[el] * rnd(0.85, 1.15);
    if (el === 'poison') {
      const left = e.poison > 0 ? e.poisonDmg * e.poison : 0;
      e.poisonDmg = (left + applyPart(d, 'poison', a.series, e.series, e.res, 75, a.series5)) / POISON_TIME; 
      e.poison = POISON_TIME; 
      continue; 
    }
    d = applyPart(d, el, a.series, e.series, e.res, 75, a.series5);
    if (crit && el === 'phys') d *= CRIT_MULT;
    tot += d; if (d > bv) { bv = d; best = el; }
  }
  
  if (counters(a.series, e.series)) tot += R.P.series5;
  tot = Math.max(1, tot);
  e.hp -= tot; 
  e.hitT = 0.12; 
  if (e.act !== 'at') { e.act = 'hurt'; e.actT = 0; npcSfx(MON[e.tid].anim, 'hurt', 0.3); }
  if (a.stun && Math.random() * 100 < a.stun) e.stun = 0.8;
  if (R.P.leech) heal(tot * R.P.leech / 100, true);
  if (R.P.manaLeech) R.mana = Math.min(R.P.mana, R.mana + tot * R.P.manaLeech / 100);
  
  const k = counters(a.series, e.series) ? ' ⚡' : '';
  
  if (mega) { 
    R.shake = 0.18; 
    burst(e.x, e.y, '#ff3300'); 
    addText(e.x, e.y - e.r - 12, '💥 BẠO KÍCH ' + fmt(tot) + k, '#ff4500', 17, 'mega'); 
  } else if (crit) { 
    R.shake = 0.1; 
    burst(e.x, e.y, '#ffd24a'); 
    addText(e.x, e.y - e.r - 8, '⚔ CHÍ MẠNG ' + fmt(tot) + k, '#ffe14a', 15, 'crit'); 
  } else { 
    addText(e.x, e.y - e.r - 6, fmt(tot) + k, ELEM_COL[best] || '#ffffff', 12, 'normal'); 
  }
  
  return tot;
}

/* ---------- QUÁI ĐÁNH TRÚNG ---------- */
function enemyHit(e) {
  if (Math.random() * 100 >= hitPercent(e.ar, R.P.def)) { 
    addText(H.x, H.y - 30, 'Né', '#9cf', 11, 'miss'); 
    return; 
  }

  const el = ELEM_TYPES[e.series] || 'phys';
  let d = e.dmg * rnd(0.8, 1.2);
  d = applyPart(d, el, e.series, R.P.series, R.P.res, PLAYER_RES_MAX, 10);

  if (R.P.res5 && !counters(e.series, R.P.series)) d = Math.max(1, d - R.P.res5);

  R.life -= d; R.hurtT = 0.25; 
  if (H.act !== 'at' && Math.random() < 0.3) { H.act = 'hurt'; H.actT = 0; }

  if (R.P.retMelee || R.P.retMeleeP) { 
    const ret = R.P.retMelee + d * R.P.retMeleeP / 100; 
    if (ret > 0) { e.hp -= ret; } 
  }

  addText(H.x + rnd(-10, 10), H.y - 36, '-' + fmt(d), '#ff6a5a', 12, 'normal');
}

function heal(v, quiet) { 
  const b = R.life; 
  R.life = Math.min(R.P.life, R.life + v); 
  if (!quiet && R.life - b > 1) addText(H.x, H.y - 44, '+' + fmt(R.life - b), '#7f7', 11, 'normal'); 
}

/* ---------- TỰ DÙNG THUỐC ---------- */
const POT_TIER_LV = [0, 1, 20, 40, 70, 100];
function bestPotion(kind) {
  let best = null;
  for (const p of J.potions) if (p.kind === kind && S.lvl >= (POT_TIER_LV[p.tier] || 999) && potPrice(p) <= S.gold && (!best || p.tier > best.tier)) best = p;
  return best;
}

const potPrice = p => Math.round(p.price * (1 + S.lvl / 25));

function autoPotion(dt) {
  R.hot = R.hot || { life: 0, mana: 0, lifeT: 0, manaT: 0 };
  const h = R.hot, P = R.P;
  for (const k of ['life', 'mana']) {
    if (h[k + 'T'] > 0) { const d = Math.min(dt, h[k + 'T']); h[k + 'T'] -= dt; if (k === 'life') R.life = Math.min(P.life, R.life + h.life * d); else R.mana = Math.min(P.mana, R.mana + P.manaRegen * d); }
  }
  if (S.potOff) return;
  const needLife = R.life < P.life * 0.5, needMana = P.main.cost > 0 && R.mana < P.main.cost * 2;
  h.cd = Math.max(0, (h.cd || 0) - dt);
  for (const [k, need] of [['life', needLife], ['mana', needMana]]) {
    const urgent = k === 'life' && R.life < P.life * 0.3 && h.cd <= 0;
    if (!need || (h[k + 'T'] > 0 && !urgent)) continue;
    const own = takeStock(k), p = own || bestPotion(k); if (!p) continue;
    usePotion(k, p, !!own);
    if (k === 'life') h.cd = 1;
  }
}

function usePotion(k, p, free) {
  R.hot = R.hot || { life: 0, mana: 0, lifeT: 0, manaT: 0 };
  const h = R.hot;
  if (!free) S.gold -= potPrice(p);
  S.potUsed = (S.potUsed || 0) + 1; questTick('pots');
  const left = h[k + 'T'] > 0 ? h[k] * h[k + 'T'] : 0;
  h[k + 'T'] = p.dur; h[k] = (left + p.total) / p.dur;
}

/* ---------- VÒNG LẶP BẮT ĐẦU VÀ CHẠY GAME ---------- */
const alive = () => R.enemies.filter(e => e.hp > 0);
function nearest(list) { let b = null, bd = 1e9; for (const e of list) { const d = Math.hypot(e.x - H.x, e.y - H.y); if (d < bd) { bd = d; b = e; } } return b; }

function rotPool(P) {
  if (S.rot === false || window.NO_ROT) return [];
  const ids = (S.slots || []).filter(Boolean), pool = P.actives.filter(a => ids.includes(a.id));
  if (pool.length < 2) return [];
  const byDps = pool.slice().sort((a, b) => b.dps - a.dps), top = byDps[0].dps, keep = new Set(byDps.filter((a, i) => i < 2 || a.dps >= top * 0.4));
  return ids.map(id => pool.find(a => a.id === id)).filter(a => a && keep.has(a));
}

function pickAttack(P, hard) {
  const pool = hard ? [] : rotPool(P);
  if (pool.length < 2) return R.mana >= P.main.cost ? P.main : P.basic;
  const n = pool.length; R.rotI = (R.rotI || 0) % n;
  for (let k = 0; k < n; k++) { const a = pool[(R.rotI + k) % n]; if (R.mana >= a.cost) { R.rotI = (R.rotI + k + 1) % n; return a; } }
  return P.basic;
}

function heroAttack() {
  const P = R.P, list = alive(); if (!list.length) return 0.3;
  const a = pickAttack(P, list.some(e => e.cls === 'boss' || e.cls === 'elite' || e.goldBoss));
  const t = nearest(list);
  const d = Math.hypot(t.x - H.x, t.y - H.y) - t.r;
  if (d > a.rad) { R.moveTo = manual() ? null : t; return 0.05; }
  R.moveTo = null;
  R.mana -= a.cost;
  const c = a.around ? H : t, splash = a.around ? a.rad + 40 : 110;
  const targets = list.filter(e => e !== t && Math.hypot(e.x - c.x, e.y - c.y) < (a.targets > 1 ? splash : 0)).slice(0, a.targets - 1);
  targets.unshift(t);
  for (const e of targets) { heroHit(a, e); skillFx(H, e, a); }
  H.face = t.x >= H.x ? 1 : -1; H.dir = dirOf(t.x - H.x, t.y - H.y); H.act = 'at'; H.actT = 0;
  if (a.id) skillSfx(a.id); else npcSfx(W.hero[S.fac] && W.hero[S.fac].anim, 'at', 0.4);
  return 1 / a.rate;
}

/* ---------- AI QUÁI VẬT ---------- */
function enemyAI(e, dt) {
  if (e.stun > 0) { e.stun -= dt; return; }
  if (e.poison > 0) { e.poison -= dt; e.hp -= e.poisonDmg * dt; }
  
  const d = Math.hypot(H.x - e.x, H.y - e.y), reach = e.ranged ? 200 : e.r + 24;
  e.face = H.x >= e.x ? 1 : -1; e.dir = dirOf(H.x - e.x, H.y - e.y);
  e.moving = d > reach;
  
  if (e.moving) obsChase(e, H.x, H.y, e.spd * dt);
  e.atkCd -= dt;
  
  if (d <= reach + 4 && e.atkCd <= 0) { 
    e.atkCd = e.cd; 
    enemyHit(e); 
    e.act = 'at'; 
    e.actT = 0; 
    npcSfx(e.animKey || MON[e.tid].anim, 'at', 0.35); 
    
    const monsterSkill = getMonsterSkill(e);
    if (monsterSkill) {
      skillFx(e, H, monsterSkill);
      if (typeof skillSfx === 'function') skillSfx(monsterSkill.id);
    } else if (e.ranged) {
      fxLine(e, H, { parts: { phys: 1 } });
    }
  }
}

function tick(dt) {
  obsFrame();
  if ((R.sweepT = (R.sweepT || 0) + dt) > 30) { R.sweepT = 0; autoEquipAll(); sweepJunk(); autoBuyWeapon(); autoForge(); checkHints(); }
  if (R.dirty) recalc();
  const P = R.P;
  if (R.deadT > 0) { R.deadT -= dt; if (R.deadT <= 0) { R.life = P.life; R.mana = P.mana; S.wave = 1; spawnWave(); } return; }
  R.life = Math.min(P.life, R.life + P.regen * dt); R.mana = Math.min(P.mana, R.mana + P.manaRegen * dt);
  autoPotion(dt);
  if (R.hurtT > 0) R.hurtT -= dt;
  if (R.tpCd > 0) R.tpCd -= dt;
  if (R.potCd) { R.potCd.life = Math.max(0, R.potCd.life - dt); R.potCd.mana = Math.max(0, R.potCd.mana - dt); }
  goldBossTick(dt); petTick(dt);
  if (R.town) { townTick(dt); return; }
  R.activeT = (R.activeT || 0) + dt;
  const looting = updateGround(dt);
  if (!R.enemies.length) {
    if (looting && R.lootWait < 8) { R.lootWait += dt; return; }
    if (R.spawnT > 0) { R.spawnT -= dt; return; }
    R.lootWait = 0;
    if (R.tower) towerSpawn(); else { spawnWave(); if (goldBossDue()) spawnGoldBoss(); }
    return;
  }
  if (manual()) moveManual(dt);
  if (!(looting && R.pickTarget)) {
    if (manual()) {}
    else if (R.moveTo && R.moveTo.hp > 0) {
      obsSteer(H, R.moveTo.x, R.moveTo.y, 150 * P.speed * dt);
    }
    R.atkT -= dt; if (R.atkT <= 0) R.atkT = heroAttack();
  }
  for (const e of alive()) enemyAI(e, dt);
  killCheck();
  R.stall += dt; if (R.stall > 45) stallOut();
  if (R.life <= 0) heroDeath();
}

function stallOut() {
  R.stall = 0;
  if (R.tower) { towerExit(false); return; }
  const boss = R.enemies.some(e => !e.dead && e.cls === 'boss');
  if (boss || S.wave === WAVES) {
    if (R.enemies.some(e => e.goldBoss && !e.dead)) RW().gbT = GB_RETRY;
    log('<span class="dim">Đánh mãi không hạ được, lui về luyện công.</span>');
    if (S.stage > 1) { S.stage--; S.push = false; R.farm = 0; }
    S.wave = 1; if (typeof onStageChange === 'function') onStageChange();
  } else log('<span class="dim">Đợt quái kéo dài quá lâu, gọi đợt mới.</span>');
  spawnWave();
}

function killCheck() {
  for (const e of R.enemies) if (e.hp <= 0 && !e.dead) { e.dead = true; onKill(e); npcSfx(MON[e.tid].anim, 'die', 0.5); if (!R.quiet) { e.act = 'die'; e.actT = 0; R.corpses.push(e); } }
  if (R.enemies.length && R.enemies.every(e => e.dead)) { R.enemies = []; waveCleared(); }
}

function onKill(e) {
  R.kills++; S.totalKills = (S.totalKills || 0) + 1;
  const lvDiff = e.L - S.lvl, mult = lvDiff < -10 ? 0.4 : lvDiff < -5 ? 0.8 : 1.2;
  gainXp(expFor(e.L) * CLS[e.cls].xp * mult * diffOf().rew * 2);
  const g = Math.round(moneyDrop(e) * diffOf().rew * 3); S.gold += g;
  burst(e.x, e.y, SERIES_COL[e.series]);
  if (e.cls === 'boss') { R.shake = 0.3; burst(e.x, e.y, '#ff4a3a'); }
  for (const it of rollDrops(e)) dropToGround(it, e);
  for (const m of allDrops(e)) log(`Nhặt được <b style="color:${RAR_COL[3]}">${esc(m)}</b>`);
  const gold = rollSetDrop(e); if (gold) { dropToGround(gold, e); log(`<b style="color:${RAR_COL[gold.r]}">${esc(gold.n)}</b> rơi ra!`); burst(e.x, e.y, '#ffd24a'); }
  if (e.cls === 'boss') log(`Hạ <b class="boss">${esc(e.n)}</b> (+${fmt(g)} lượng)`);
  rwOnKill(e);
}

function gainXp(x) {
  if (S.lvl >= MAX_LEVEL) return;
  S.totalXp = (S.totalXp || 0) + x;
  S.xp += x * (1 + rebornBonus().xp) / xpSlow(S.lvl);
  
  while (S.lvl < MAX_LEVEL && S.xp >= J.exp[S.lvl - 1]) {
    S.xp -= J.exp[S.lvl - 1]; S.lvl++;
    S.attrPts += PTS_PER_LEVEL; S.skPts += SKILL_PTS_PER_LEVEL;
    R.dirty = true; uiSfx('levelup'); log(`<b class="up">Lên cấp ${S.lvl}!</b> +${PTS_PER_LEVEL} tiềm năng, +${SKILL_PTS_PER_LEVEL} kỹ năng`);
    if (typeof onLevelUp === 'function') onLevelUp();
  }
}

function waveCleared() {
  if (R.tower) { towerCleared(); return; }
  heal(R.P.life * 0.15, true); R.mana = Math.min(R.P.mana, R.mana + R.P.mana * 0.2);
  if (S.wave < WAVES) { S.wave++; R.spawnT = 1.2; return; }
  S.wave = 1;
  if (!S.push && ++R.farm >= 3 && R.life > R.P.life * 0.6) { S.push = true; R.farm = 0; log('Đủ mạnh, thử vượt ải tiếp.'); }
  if (S.push) {
    S.stage++; S.maxStage = Math.max(S.maxStage, S.stage); questTick('stages');
    if (inZone(S.stage) === 1 && S.stage <= STAGES) log(`Tiến vào <b>${esc(zoneOf(S.stage).n)}</b>`);
  }
  if (typeof onStageChange === 'function') onStageChange();
}

function heroDeath() {
  if (R.enemies.some(e => e.goldBoss && !e.dead)) RW().gbT = GB_RETRY;
  R.deadT = 3; R.life = 0; R.enemies = [];
  log('<span class="bad">Bạn đã trọng thương.</span>');
  if (R.tower) { towerExit(true); return; }
  if (S.stage > 1) { S.stage--; S.push = false; R.farm = 0; log(`Lùi về ải ${S.stage} để luyện công.`); }
  if (typeof onStageChange === 'function') onStageChange();
}

function simulate(seconds, step = 0.05) { const q = R.quiet; R.quiet = true; for (let t = 0; t < seconds; t += step) tick(step); R.quiet = q; }