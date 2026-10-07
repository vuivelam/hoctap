/* ======================= CHI SO NHAN VAT (stats_2.js) ======================= */
'use strict';

function addAttr(A, name, p, mult = 1) {
  const a = A[name] || (A[name] = [0, 0, 0]);
  for (let i = 0; i < 3; i++) a[i] += (p[i] || 0) * mult;
}
const av = (A, n, i = 0) => (A[n] ? A[n][i] : 0);

/* ---------- NGŨ HÀNH TRANG BỊ & DÒNG ẨN TƯƠNG SINH ---------- */
// Kim (0) -> Thủy (2) -> Mộc (1) -> Hỏa (3) -> Thổ (4) -> Kim (0)
const ACCRUE = { 0: 2, 2: 1, 1: 3, 3: 4, 4: 0 }; 
const accrues = (a, b) => a >= 0 && b >= 0 && ACCRUE[a] === b;

const ACTIVATED_BY = { 
  helm: ['armor', 'amulet'], 
  armor: ['ring2', 'belt'], 
  belt: ['pendant', 'cuff'], 
  weapon: ['amulet', 'armor'],
  boot: ['weapon', 'helm'], 
  cuff: ['boot', 'ring1'], 
  amulet: ['belt', 'ring2'], 
  ring1: ['weapon', 'helm'], 
  ring2: ['cuff', 'pendant'],
  pendant: ['boot', 'ring1'] 
};

function slotOfEquipped(it, eq) { for (const k in eq) if (eq[k] === it) return k; return null; }

/**
 * Tính số lượng dòng ẩn được kích hoạt (0 đến 3)
 */
function hiddenActive(it, eq = S.eq) {
  if (!it) return 0;
  if (it.leg || it.set) return 3; // Đồ Hoàng Kim / Đồ Bộ mở full 3 dòng ẩn
  if (typeof enoughToActive === 'function' && enoughToActive(eq)) return 3;
  
  const slot = slotOfEquipped(it, eq);
  if (!slot) return 0;
  if (slot === 'horse') return 3;

  let n = 0;
  // Dòng ẩn 1: Hệ Nhân Vật tương sinh với Hệ Món Đồ
  if (accrues(heroSeries(), it.s)) n++;

  // Dòng ẩn 2 & 3: Các món trang bị liên kết tương sinh với Hệ Món Đồ
  for (const k of ACTIVATED_BY[slot] || []) {
    if (eq[k] && accrues(eq[k].s, it.s)) n++;
  }
  return Math.min(3, n);
}

function heroStart() { const f = FAC[S.fac]; return J.start[f.series * 2 + (S.sex || 0)] || J.start[0]; }
function heroSeries() { return FAC[S.fac] ? FAC[S.fac].series : 0; }
function weaponCode(eq) {
  const w = eq.weapon; if (!w) return 9;
  return w.d === 1 ? 7 : w.k === 6 ? 9 : w.k;
}
function skillLv(id) { const L = S.sk[id] || 0; return L ? L + (R.P ? R.P.plusSkill : 0) : 0; }

function passiveApplies(s, name, p, wc) {
  if (!s || !s.attr) return true;
  const checkAttrs = ['addphysicsdamage_p', 'attackratingenhance_p', 'deadlystrikeenhance_p', 'addphysicsdamage_v'];
  for (const attrKey of checkAttrs) {
    if (s.attr[attrKey]) {
      const need = skVal(s, attrKey, 1)[2];
      if ([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].includes(need)) return wc === need;
    }
  }
  return true;
}
const SKIP_PASSIVE = /^(skill_|missle_|addskilldamage)/;

let IGNORE_REQ = null;
const reqPass = it => it === IGNORE_REQ || reqOk(it);

/* ---------- HÀM TÍNH TOÁN TỔNG CHỈ SỐ PLAYER ---------- */
function calc(eq) {
  eq = eq || S.eq;
  const A = {}, lv = S.lvl, ser = heroSeries(), add = J.levelAdd[ser], st = heroStart();
  const skAdd = {};

  const addItemAttr = (m) => {
    if (!m) return;
    const name = attrName(m.a || m[0]), p = (m.p || m.slice(1)).map(v => v === -1 ? 0 : v);
    if (name === 'allskill_v' && p[2] > 0) { skAdd[p[2]] = (skAdd[p[2]] || 0) + p[0]; return; }
    addAttr(A, name, p);
  };

  // 1. CỘNG TẤT CẢ CHỈ SỐ HIỆN & DÒNG ẨN ĐƯỢC KÍCH HOẠT TỪ TRANG BỊ
  for (const k in eq) {
    const it = eq[k]; if (!it || !reqPass(it)) continue;
    const em = enhMul(it);
    
    // Chỉ số cơ bản của trang bị (Sát thương/Phòng thủ cơ bản)
    for (const [id, mn, mx] of it.base || []) {
      addAttr(A, attrName(id), [(id === 28 || id === 29 ? mn : (mn + mx) / 2) * em, 0, 0]);
    }

    // Tính số dòng ẩn mở được
    const act = hiddenActive(it, eq);
    
    // Lặp qua danh sách ma thuật (Dòng hiện: index 0, 2, 4 | Dòng ẩn: index 1, 3, 5)
    (it.mag || []).forEach((m, i) => { 
      const isHiddenLine = (i % 2 !== 0);
      const hiddenIndex = Math.floor(i / 2);
      if (!isHiddenLine || hiddenIndex < act) {
        addItemAttr(m); 
      }
    });

    // Dòng ẩn từ trang bị Hoàng Kim / Đồ Bộ
    if (it.set) { 
      const ex = goldEnhance(it, eq); 
      (it.ext || []).slice(0, ex).forEach(addItemAttr); 
    }
  }

  const wc = weaponCode(eq);

  // 2. LẶP QUA CÁC KỸ NĂNG NỘI TẠI (PASSIVES)
  for (const id in S.sk) {
    const s = SK[id]; if (!s || !S.sk[id] || isAttack(s)) continue;
    const curL = S.sk[id];
    for (const name in s.attr) {
      if (SKIP_PASSIVE.test(name)) continue;
      const p = skVal(s, name, curL);
      if (p && passiveApplies(s, name, p, wc)) addAttr(A, name, p);
    }
  }

  // 3. TÍNH TỔNG CỘNG CẤP KỸ NĂNG (TRANG BỊ + NỘI TẠI + NGŨ HÀNH)
  const plus = av(A, 'allskill_v');
  const seriesSkillName = ['metalskill_v', 'woodskill_v', 'waterskill_v', 'fireskill_v', 'earthskill_v'][ser];
  const seriesPlus = av(A, seriesSkillName);

  const P = { A, plusSkill: plus, skAdd };

  const lvOf = id => {
    if (!S.sk[id]) return 0;
    const s = SK[id];
    const isSeries = s && s.series === ser;
    return S.sk[id] + plus + (skAdd[id] || 0) + (isSeries ? seriesPlus : 0);
  };

  // 4. CHỈ SỐ HỖ TRỢ TĂNG SÁT THƯƠNG KỸ NĂNG KHÁC (addskilldamage)
  P.skillBonus = {};
  for (const id in S.sk) {
    const s = SK[id]; if (!s || !S.sk[id]) continue;
    for (const name in s.attr) if (name.startsWith('addskilldamage')) {
      const p = skVal(s, name, lvOf(id)); if (p && p[0]) P.skillBonus[p[0]] = (P.skillBonus[p[0]] || 0) + p[2];
    }
  }

  if (typeof titleAttr === 'function') titleAttr(A);
  P.rebDmg = 1 + rebornBonus().dmg;
  P.dmgMul = P.rebDmg * facNorm(S.fac, lv);

  // 5. CỘNG THUỘC TÍNH CƠ BẢN (CÓ NHÂN THÊM % THUỘC TÍNH)
  P.str = Math.round((st.str + S.attr.str + av(A, 'strength_v')) * (1 + av(A, 'strength_p') / 100));
  P.dex = Math.round((st.dex + S.attr.dex + av(A, 'dexterity_v')) * (1 + av(A, 'dexterity_p') / 100));
  P.vit = Math.round((st.vit + S.attr.vit + av(A, 'vitality_v')) * (1 + av(A, 'vitality_p') / 100));
  P.eng = Math.round((st.eng + S.attr.eng + av(A, 'energy_v')) * (1 + av(A, 'energy_p') / 100));
  P.series = ser;

  // SINH LỰC & NỘI LỰC
  P.life = Math.round((st.life + (lv - 1) * (add.LifePerLevel + IDLE_LIFE_PER_LEVEL) + (P.vit - st.vit) * add.LifePerVitality + av(A, 'lifemax_v')) * (1 + av(A, 'lifemax_p') / 100));
  P.mana = Math.round((st.mana + (lv - 1) * add.ManaPerLevel + (P.eng - st.eng) * add.ManaPerEnergy + av(A, 'manamax_v')) * (1 + av(A, 'manamax_p') / 100));
  P.life = Math.max(50, P.life); P.mana = Math.max(20, P.mana);

  // HỒI PHÚC HP/MP CHUẨN XÁC
  P.regen = 1 + lv * 0.08 + av(A, 'lifereplenish_v') + P.life * (av(A, 'lifereplenish_p') / 100);
  P.manaRegen = 1 + lv * 0.05 + av(A, 'manareplenish_v') + P.eng * 0.02 + P.mana * (av(A, 'manareplenish_p') / 100);

  // CHÍNH XÁC & NÉ TRÁNH
  const baseAr = Math.max(0, P.dex * 4 - 28);
  P.ar = Math.max(10, Math.round((baseAr + av(A, 'attackrating_v') + av(A, 'attackratingenhance_v')) * (1 + (av(A, 'attackratingenhance_p') + av(A, 'attackrating_p')) / 100)));
  P.def = Math.max(0, Math.round((P.dex / 4 + av(A, 'adddefense_v') + av(A, 'armordefense_v') * 0.25) * (1 + av(A, 'armordefenseenhance_p') / 100)));

  // KHÁNG NGŨ HÀNH
  const baseRes = { phys: add.physicres, poison: add.poisonres, cold: add.coldres, fire: add.fireres, light: add.lightingres };
  P.res = {};
  for (const e of ELEM) P.res[e] = clamp(baseRes[e] + av(A, ELEM_RES[e]) + av(A, 'allres_p'), -100, PLAYER_RES_MAX + av(A, 'allresmax_p'));

  // SÁT THƯƠNG VẬT LÝ VŨ KHÍ (SỬA LỖI WMAX)
  const w = eq.weapon && reqPass(eq.weapon) ? eq.weapon : null;
  const ranged = !!(w && w.d === 1);
  const wmin = av(A, 'weapondamagemin_v') || 1, wmax = av(A, 'weapondamagemax_v') || 2;
  const bonus = ranged ? P.dex / DEX_PER_DMG : P.str / STR_PER_DMG;
  
  const physAddMin = av(A, 'addphysicsdamage_v', 0);
  const physAddMax = av(A, 'addphysicsdamage_v', 1) || physAddMin; // Đã sửa: Lấy đúng giá trị Max

  P.wmin = Math.round(wmin + bonus + physAddMin);
  P.wmax = Math.round(wmax + bonus + physAddMax);
  P.physPct = av(A, 'addphysicsdamage_p') + av(A, 'weapondamageenhance_p');

  P.spellW = weaponTierMul(eq.weapon);
  P.physStat = 1 + (ranged ? P.dex * DEX_PCT_RANGED : P.str) / STR_PER_PCT / 100;
  
  // SÁT THƯƠNG NGŨ HÀNH CỘNG THÊM TỪ ĐỒ
  P.add = {}; for (const e of ELEM) if (e !== 'phys') P.add[e] = av(A, ELEM_ADD[e], 0);
  P.enh = {}; for (const e in ELEM_ENH) P.enh[e] = av(A, ELEM_ENH[e]);
  
  P.crit = clamp(av(A, 'deadlystrikeenhance_p') + av(A, 'deadlystrike_p'), 0, 75);
  P.aspd = clamp(1 + (av(A, 'attackspeed_v') + av(A, 'castspeed_v')) / 100, 0.5, 3);
  P.leech = av(A, 'steallife_p') + av(A, 'steallifeenhance_p');
  P.manaLeech = av(A, 'stealmana_p') + av(A, 'stealmanaenhance_p');
  P.ignoreDef = av(A, 'ignoredefense_p');
  P.retMelee = av(A, 'meleedamagereturn_v'); P.retMeleeP = av(A, 'meleedamagereturn_p');
  P.series5 = av(A, 'five_elements_enhance_v'); P.res5 = av(A, 'five_elements_resist_v');
  P.seriesSkill = seriesPlus;
  P.lucky = av(A, 'lucky_v');
  P.speed = 1 + av(A, 'fastwalkrun_p') / 100;
  P.ranged = ranged;

  // 6. TÍNH TOÁN DỮ LIỆU CÁC KỸ NĂNG TẤN CÔNG (ACTIVE)
  P.actives = [];
  for (const id in S.sk) { const s = SK[id]; if (S.sk[id] && isAttack(s)) P.actives.push(activeInfo(P, s, lvOf(id))); }
  P.basic = basicAttack(P);

  const income = P.manaRegen + manaPotRate(lv);
  for (const a of P.actives) { 
    const spend = a.cost * a.rate; 
    a.sustain = spend > 0 ? Math.min(1, income / spend) : 1; 
    a.dps = a.dps * a.sustain + P.basic.dps * (1 - a.sustain); 
  }
  const byDps = P.actives.concat([P.basic]).filter(a => a.id !== 0).sort((a, b) => b.dps - a.dps);
  P.main = (S.mainLock && P.actives.find(a => a.id === S.main)) || byDps[0] || P.actives[0] || P.basic;
  return P;
}

/* ---------- BẢO VỆ & ĐỐI CHIẾU CẤP ĐỘ (CHỐNG HACK) ---------- */
function validateLevel() {
  if (!S || !J || !J.exp) return;
  const totalXp = S.totalXp || 0;
  
  let minRequiredXp = 0;
  for (let i = 0; i < S.lvl - 1; i++) {
    minRequiredXp += (J.exp[i] || 0);
  }

  if (S.lvl > MAX_LEVEL || S.lvl < 1 || (totalXp < minRequiredXp && S.lvl > 1)) {
    if (typeof toast === 'function') toast('Phát hiện dữ liệu cấp độ không hợp lệ!');
    S.lvl = recalculateCorrectLevel(totalXp);
    if (typeof save === 'function') save();
  }
}

function recalculateCorrectLevel(totalXp) {
  let curLvl = 1;
  let accumulated = 0;
  while (curLvl < MAX_LEVEL) {
    let req = J.exp[curLvl - 1] || 9999999;
    if (accumulated + req > totalXp) break;
    accumulated += req;
    curLvl++;
  }
  return curLvl;
}

function skillTargets(s) {
  const n = Math.max(1, s.childN || 1);
  switch (s.form) {
    case 0: return n > 1 ? 3 : 2;
    case 1: return 2;
    case 2: return Math.min(3, 1 + Math.ceil(n / 3));
    case 3: case 4: case 5: case 6: case 7: return 3;
    default: return 1;
  }
}

function activeInfo(P, s, L) {
  const norm = s.norm || 1;
  const pe = skVal(s, 'physicsenhance_p', L);
  const skillPct = (1 + ((P.skillBonus[s.id] || 0) + P.seriesSkill) / 100) * (P.dmgMul || 1);
  const parts = {};

  if (pe) {
    parts.phys = (P.wmin + P.wmax) / 2 * (1 + pe[0] / 100) * norm * (1 + P.physPct / 100) * P.physStat;
    for (const e in P.add) if (P.add[e]) parts[e] = (parts[e] || 0) + P.add[e];
  }

  for (const e of ELEM) {
    const v = skVal(s, ELEM_ATTR[e], L); if (!v) continue;
    const avg = e === 'poison' ? v[0] * (v[1] || 1) / Math.max(1, v[2] || 1) : v[2] ? (v[0] + v[2]) / 2 : v[0];
    parts[e] = (parts[e] || 0) + avg * norm * (1 + (P.enh[e] || 0) / 100) * (1 + P.eng / ENG_PER_PCT / 100);
  }

  if (!pe) { 
    let main = null, mv = -1; 
    for (const e in parts) if (parts[e] > mv) { mv = parts[e]; main = e; } 
    if (main) parts[main] += P.eng / ENG_PER_DMG;
    for (const e in parts) parts[e] *= P.spellW || 1; 
    
    // Đã bổ sung Sát thương Ngũ hành từ đồ cho cả chiêu Pháp thuật/Nội công
    for (const e in P.add) if (P.add[e]) parts[e] = (parts[e] || 0) + P.add[e];
  }

  let tot = 0; for (const e in parts) { parts[e] *= skillPct; tot += parts[e]; }
  const rad = (skVal(s, 'skill_attackradius', L) || [s.radius || 60])[0] || 60;
  const targets = skillTargets(s);
  const cost = (skVal(s, 'skill_cost_v', L) || [0])[0];
  const crit = P.crit + ((skVal(s, 'deadlystrike_p', L) || [0])[0]);
  const series5 = (skVal(s, 'seriesdamage_p', L) || [0])[0];
  const ignore = P.ignoreDef + ((skVal(s, 'ignoredefense_p', L) || [0])[0]);
  const stun = (skVal(s, 'stun_p', L) || [0])[0];
  const rate = s.phys ? P.aspd : P.aspd * 0.9;
  const info = { id: s.id, n: s.n, L, parts, tot, rad, melee: rad <= 120, targets, around: s.form === 7, cost, crit, series5, ignore, stun,
    series: s.series >= 0 ? s.series : P.series, rate, dps: 0, useAR: s.phys };
  info.dps = (tot - (parts.poison || 0) * (1 - POISON_EFF) + (parts.phys || 0) * crit / 100 * (CRIT_MULT - 1)) * expectedHits(info) * rate * (info.melee ? MELEE_UPTIME : 1);
  return info;
}

function basicAttack(P) {
  const phys = (P.wmin + P.wmax) / 2 * (1 + P.physPct / 100) * P.physStat;
  const parts = { phys }; for (const e in P.add) if (P.add[e]) parts[e] = P.add[e];
  let tot = 0; for (const e in parts) { parts[e] *= P.dmgMul || 1; tot += parts[e]; }
  return { id: 0, n: 'Đánh thường', L: 1, parts, tot, rad: P.ranged ? 260 : 60, melee: !P.ranged, targets: 1, cost: 0, crit: P.crit,
    series5: 0, ignore: P.ignoreDef, stun: 0, series: P.series, rate: P.aspd, dps: tot * P.aspd * (P.ranged ? 1 : MELEE_UPTIME), useAR: 1 };
}

function manaPotRate(lv) {
  let best = 0;
  for (const p of J.potions) if (p.kind === 'mana' && lv >= (POT_TIER_LV[p.tier] || 999)) best = Math.max(best, p.total / Math.max(1, p.dur));
  return best;
}

const W_TIER1 = {};
const weaponDmg = it => (it.base || []).reduce((t, [id, mn, mx]) => t + (id === 28 || id === 29 ? mn : 0), 0) * enhMul(it);

function weaponTierMul(it) {
  if (!it || it.d > 1) return 1;
  const key = it.d + ':' + it.k;
  if (!(key in W_TIER1)) { const b = baseRow(it.d, it.k, 1); W_TIER1[key] = b ? Math.max(1, weaponDmg(b)) : 0; }
  return W_TIER1[key] ? clamp(weaponDmg(it) / W_TIER1[key], 1, 20) : 1;
}

const sexReqOkFor = (it, sex) => { const r = (it.req || []).find(q => q[0] === 38); return !r || r[1] < 0 || r[1] === (sex || 0); };
const sexReqOk = req => sexReqOkFor({ req }, S.sex);
const sexOk = it => sexReqOk(it.req);

function reqOk(it) {
  if (!sexOk(it)) return false;
  for (const [id, v] of it.req || []) {
    if (id === 36 && S.lvl < v) return false;
    if (id === 32 && heroAttr('str') < v) return false;
    if (id === 33 && heroAttr('dex') < v) return false;
    if (id === 34 && heroAttr('vit') < v) return false;
    if (id === 35 && heroAttr('eng') < v) return false;
    if (id === 37 && v >= 0 && FAC[S.fac] && heroSeries() !== v) return false;
    if (id === 39 && v >= 0 && FAC[S.fac] && FAC[S.fac].id !== v) return false;
  }
  return true;
}

function heroAttr(k) { const st = heroStart(); return st[k] + S.attr[k]; }

const POWER_DPS_W = 0.7;
function power(P) {
  const L = S.lvl, eDef = 8 + 3.2 * L, eAr = 30 + 9 * L, a = P.main;
  const hit = a.useAR ? hitPercent(P.ar, eDef, a.ignore) / 100 : 1;
  const dodge = 1 - hitPercent(eAr, P.def) / 100;
  const avgRes = ELEM.reduce((t, e) => t + P.res[e], 0) / ELEM.length;
  const dps = a.dps * hit;
  const ehp = P.life / Math.max(0.2, 1 - avgRes / 100) / Math.max(0.3, 1 - dodge);
  return Math.pow(Math.max(1, dps), POWER_DPS_W) * Math.pow(Math.max(1, ehp), 1 - POWER_DPS_W);
}

function autoSpendSkills() {
  const f = FAC[S.fac]; if (!f) return 0;
  let spent = 0;
  while (S.skPts > 0) {
    const base = power(calc()); let best = null, bn = 0, bg = -Infinity;
    for (const id of f.skills) {
      const s = SK[id]; if (!canLearn(s)) continue;
      const cur = S.sk[id] || 0, room = Math.min(20, s.max - cur);
      for (const n of [...new Set([1, Math.min(5, room), room])]) {
        S.sk[id] = cur + n;
        const g = (power(calc()) - base) / n + (isAttack(s) ? 0 : 1e-6) + s.req * 1e-9;
        if (cur) S.sk[id] = cur; else delete S.sk[id];
        if (g > bg) { bg = g; best = id; bn = n; }
      }
    }
    if (best == null) break;
    bn = Math.min(bn, S.skPts);
    S.sk[best] = (S.sk[best] || 0) + bn; S.skPts -= bn; spent += bn;
  }
  if (spent) R.dirty = true;
  return spent;
}

const ATTR_REQ = { 32: 'str', 33: 'dex', 34: 'vit', 35: 'eng' };
const REQ_SAVE_LEVELS = 10;

function weaponTarget() {
  const f = FAC[S.fac]; if (!f) return null;
  const own = S.inv.concat(S.eq.weapon ? [S.eq.weapon] : []).filter(it => it.d <= 1 && (f.wcode < 0 || weaponCode({ weapon: it }) === f.wcode)
    && (it.req || []).every(([id, v]) => id !== 36 || S.lvl >= v) && !(it.req || []).some(([id, v]) => (id === 37 || id === 39) && v >= 0 && !reqOk(it)));
  return own.sort((a, b) => weaponDmg(b) - weaponDmg(a))[0] || null;
}

const REQ_VI = { 32: 'Sức mạnh', 33: 'Thân pháp', 34: 'Sinh khí', 35: 'Nội công' };
function reqProblems(it) {
  const out = [];
  for (const [id, v] of it.req || []) {
    if (id === 36 && S.lvl < v) out.push(`Cấp ${v} (hiện ${S.lvl}, thiếu ${v - S.lvl})`);
    else if (REQ_VI[id] && heroAttr(ATTR_REQ[id]) < v) { const cur = heroAttr(ATTR_REQ[id]); out.push(`${REQ_VI[id]} ${v} (hiện ${cur}, thiếu ${v - cur})`); }
    else if (id === 38 && v >= 0 && (S.sex || 0) !== v) out.push(`Chỉ dành cho ${v ? 'nữ' : 'nam'} (nhân vật của bạn là ${S.sex ? 'nữ' : 'nam'})`);
    else if (id === 37 && v >= 0 && FAC[S.fac] && heroSeries() !== v) out.push(`Chỉ hệ ${SERIES[v]} (bạn hệ ${SERIES[heroSeries()]})`);
    else if (id === 39 && v >= 0 && FAC[S.fac] && FAC[S.fac].id !== v) out.push(`Chỉ môn phái ${(J.factions[v] || {}).n || v}`);
  }
  return out;
}

function equipCompare(it, ignoreReq) {
  const eq = Object.assign({}, S.eq); eq[slotFor(it)] = it;
  const p0 = calc(S.eq), prev = IGNORE_REQ; IGNORE_REQ = ignoreReq ? it : null; let p1; try { p1 = calc(eq); } finally { IGNORE_REQ = prev; }
  const pw0 = power(p0), pw1 = power(p1), avg = P => ELEM.reduce((t, e) => t + P.res[e], 0) / ELEM.length;
  const why = compareWhy(it, eq, p0, p1);
  return { why, gain: pw1 / Math.max(1, pw0) - 1, dps: p1.main.dps / Math.max(1, p0.main.dps) - 1, life: p1.life - p0.life, def: p1.def - p0.def, res: avg(p1) - avg(p0), ar: p1.ar - p0.ar };
}

function compareWhy(it, eq1, p0, p1) {
  const eq0 = S.eq, slot = slotFor(it), out = [], old = eq0[slot];
  for (const k in eq0) {
    const o = eq0[k]; if (!o || k === slot || (o.mag || []).length < 2) continue;
    const h0 = hiddenActive(o, eq0), h1 = hiddenActive(o, eq1), tot = Math.floor(o.mag.length / 2);
    if (h1 !== h0) out.push(`${SLOT_VI[k]} ${h1 > h0 ? 'mở thêm' : 'đóng bớt'} ${Math.abs(h1 - h0)} dòng ẩn (${h1}/${tot}) do tương sinh hệ ${SERIES[it.s] || '—'}`);
  }
  if ((it.mag || []).length > 1) { const h = hiddenActive(it, eq1), tot = Math.floor(it.mag.length / 2), ho = old && (old.mag || []).length > 1 ? hiddenActive(old, eq0) : null;
    out.push(`Món này mở ${h}/${tot} dòng ẩn${ho !== null ? `, món đang mặc mở ${ho}/${Math.floor(old.mag.length / 2)}` : ''}`); }
  if (typeof enoughToActive === 'function' && enoughToActive(eq1) !== enoughToActive(eq0)) out.push(enoughToActive(eq1) ? 'Đủ bộ: mở hết dòng ẩn của mọi trang bị' : 'Mất đủ bộ: các dòng ẩn bị đóng lại');
  if (p0.main.id !== p1.main.id) out.push(`Chiêu chính đổi: ${p0.main.n} → ${p1.main.n}`);
  if (slot === 'weapon') out.push(`Sát thương vũ khí ${Math.round(p0.wmin)}–${Math.round(p0.wmax)} → ${Math.round(p1.wmin)}–${Math.round(p1.wmax)}`);
  if (!out.length) out.push('Chỉ thay đổi chỉ số thường (phòng thủ, sinh lực, kháng), không đụng tới dòng ẩn hay bộ.');
  return out;
}

const pctTxt = v => (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + '%', numTxt = v => (v >= 0 ? '+' : '') + Math.round(v);

function reqDeficit(it) {
  const d = {}; for (const [id, v] of it.req || []) { const k = ATTR_REQ[id]; if (k && heroAttr(k) < v) d[k] = v - heroAttr(k); }
  return d;
}

function autoSpendAttrs() {
  let spent = 0;
  const wt = weaponTarget();
  if (wt) {
    const d = reqDeficit(wt), need = Object.values(d).reduce((a, b) => a + b, 0);
    if (need > 0 && need <= S.attrPts + PTS_PER_LEVEL * REQ_SAVE_LEVELS)
      for (const k in d) { const n = Math.min(d[k], S.attrPts); S.attr[k] += n; S.attrPts -= n; spent += n; }
    if (wt !== S.eq.weapon && reqOk(wt) && typeof equip === 'function' && equipGain(wt) > 0) equip(wt, true);
  }
  while (S.attrPts > 0) {
    const base = power(calc()); let best = 'vit', bg = -Infinity;
    for (const k of ['str', 'dex', 'vit', 'eng']) { S.attr[k]++; const g = power(calc()) - base; S.attr[k]--; if (g > bg) { bg = g; best = k; } }
    S.attr[best]++; S.attrPts--; spent++;
  }
  if (spent) R.dirty = true;
  return spent;
}

function canLearn(s) { return S.skPts > 0 && S.lvl >= s.req && (S.sk[s.id] || 0) < s.max; }

const NORM_TIERS = [[1, 19], [20, 39], [40, 59], [60, 79], [80, 999]];
const MELEE_UPTIME = 0.82;

function expectedHits(a) { const n = Math.min(3, a.targets); return a.around ? 1 + (n - 1) * 0.12 : 1 + (n - 1) * 0.55; }

function masteryPct(f) {
  let best = 0;
  for (const id of f.skills) { const s = SK[id]; const a = s && !s.enemy && s.attr.addphysicsdamage_p; if (!a) continue;
    const v = a[19] || a[a.length - 1]; if (Array.isArray(v) && v[2] === f.wcode) best = Math.max(best, v[0]); }
  return best;
}

function refChar(req, f, k) {
  const w = 10 + req * 0.8, st = 60 + req;
  return { wmin: w, wmax: w * 1.3, physPct: masteryPct(f), physStat: 1 + st * k * (f.wcode === 7 ? DEX_PCT_RANGED : 1) / STR_PER_PCT / 100, add: {}, enh: {}, eng: st * (1 - k),
    seriesSkill: 0, skillBonus: {}, crit: 0, aspd: 1, ignoreDef: 0, series: 0, spellW: 1 };
}

const REF_HIT = 0.75, REF_HIT_RANGED = 0.9, POISON_EFF = 0.75;

function refDps(s) {
  let best = 0;
  for (const k of [0, 1]) {
    const a = activeInfo(refChar(Math.max(10, s.req), s.fac, k), s, 20);
    const eff = a.tot - (a.parts.poison || 0) * (1 - POISON_EFF);
    const hit = a.useAR ? (s.fac.wcode === 7 ? REF_HIT_RANGED : REF_HIT) : 1;
    best = Math.max(best, eff * expectedHits(a) * a.rate * (a.melee ? MELEE_UPTIME : 1) * hit);
  }
  return best;
}

function initSkillNorm() {
  const atk = [];
  for (const f of FACTIONS) for (const id of f.skills) { const s = SK[id]; if (isAttack(s)) { s.fac = f; atk.push(s); } }
  for (const [lo, hi] of NORM_TIERS) {
    const tier = atk.filter(s => s.req >= lo && s.req <= hi);
    const ref = tier.map(s => { s.norm = 1; return [s, refDps(s)]; });
    const vals = ref.map(r => r[1]).sort((a, b) => a - b), med = vals[Math.floor(vals.length / 2)] || 1;
    for (const [s, v] of ref) s.norm = clamp(med / Math.max(1, v), 0.35, 3);
  }
}
initSkillNorm();

const FN_LV = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 135, 150];
const FAC_DMG_NORM = {
  shaolin: [0.84, 1.05, 0.79, 0.85, 0.9, 0.59, 0.61, 0.85, 0.86, 0.67, 0.76, 0.7, 0.51, 0.47],
  tianwang: [1.1, 0.95, 1.21, 0.94, 0.61, 0.7, 1.54, 2.5, 4.44, 4.88, 5.4, 6, 4.13, 3.32],
  tangmen: [1.03, 1.31, 1.23, 1.34, 1.11, 1.65, 2.91, 3.42, 6, 2.96, 3.39, 3.33, 3.19, 2.69],
  wudu: [0.77, 0.69, 0.82, 0.88, 0.6, 0.91, 0.85, 1.03, 1.04, 1.13, 1.46, 1.47, 1.48, 1.5],
  emei: [0.74, 0.62, 0.7, 0.81, 0.53, 0.74, 0.85, 0.76, 0.78, 0.85, 0.87, 0.73, 0.63, 0.64],
  cuiyan: [1.22, 2.24, 2.28, 1.69, 1.21, 1.51, 1.15, 0.97, 0.96, 0.92, 0.9, 0.76, 0.67, 0.55],
  gaibang: [1.04, 2.2, 2.12, 1.65, 1.63, 1.1, 1.28, 1.43, 1.43, 1.09, 1.11, 1.24, 1.31, 1.3],
  tianren: [0.97, 1.1, 1.42, 0.97, 1.15, 1.26, 1.49, 1.54, 2, 2.13, 2.09, 1.71, 1.44, 1.37],
  wudang: [0.89, 0.65, 0.71, 1.13, 1.15, 1.14, 0.84, 0.95, 0.75, 0.39, 0.38, 0.3, 0.25, 0.26],
  kunlun: [1.4, 0.95, 0.67, 1.03, 0.6, 0.81, 0.87, 0.92, 0.9, 0.74, 0.86, 0.81, 0.76, 0.77],
};

function facNorm(key, L) {
  const t = FAC_DMG_NORM[key]; if (!t || window.NO_FAC_NORM) return 1;
  if (L <= FN_LV[0]) return t[0];
  for (let i = 1; i < FN_LV.length; i++) if (L <= FN_LV[i]) { const k = (L - FN_LV[i - 1]) / (FN_LV[i] - FN_LV[i - 1]); return t[i - 1] + (t[i] - t[i - 1]) * k; }
  return t[t.length - 1];
}