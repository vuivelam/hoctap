/* ======================= GIAO DIỆN HOÀN CHỈNH (ui.js) ======================= */
'use strict';

let curTab = 'log';
let invDirty = true;
let toastT;

const GAME_SPEEDS = [1, 1.5, 2, 4, 8, 16];

function getGameSpeed() {
  if (!S) return 1;
  return Number.isFinite(S.gameSpeed) ? S.gameSpeed : 1;
}

function setGameSpeed(v) {
  const n = Number(v);
  const next = GAME_SPEEDS.includes(n) ? n : 1;
  if (!S) return next;
  S.gameSpeed = next;
  if (typeof save === 'function') save();
  toast(`Tốc độ chơi: x${next}`);
  if (typeof refresh === 'function') refresh();
  return next;
}

function speedModal() {
  const cur = getGameSpeed();
  const html = `
    <h3>Tốc độ trò chơi</h3>
    <div class="card">
      <div class="btnrow">
        ${GAME_SPEEDS.map(v => `<button class="btn ${Math.abs(v - cur) < 0.0001 ? 'on' : ''}" data-speed="${v}">x${v}</button>`).join('')}
      </div>
      <p class="dim small">Chọn tốc độ phù hợp với máy của bạn.</p>
    </div>
  `;
  modal(html, () => {
    document.querySelectorAll('#mBody [data-speed]').forEach(btn => {
      btn.onclick = () => {
        const val = Number(btn.dataset.speed);
        setGameSpeed(val);
        closeModal();
      };
    });
  });
}

/* ---------- HỖ TRỢ GIAO DIỆN CHUNG ---------- */
function log(h) { 
  if (R.quiet) return; 
  R.logs.unshift(h); 
  if (R.logs.length > 40) R.logs.pop(); 
  R.logDirty = true; 
}

function toast(t) { 
  const el = $('#toast'); 
  if (!el) return;
  el.textContent = t; 
  el.classList.add('on'); 
  clearTimeout(toastT); 
  toastT = setTimeout(() => el.classList.remove('on'), 1800); 
}

function modal(html, bind, locked) { 
  const mBody = $('#mBody');
  const modalEl = $('#modal');
  if (!mBody || !modalEl) return;
  mBody.innerHTML = html; 
  modalEl.classList.remove('hidden'); 
  modalEl.dataset.locked = locked ? '1' : ''; 
  if (bind) bind(); 
  try { $('#modal .mbox').focus({ preventScroll: true }); } catch (e) { /* bỏ qua */ } 
}

function closeModal(force) { 
  const modalEl = $('#modal');
  if (!modalEl) return;
  if (modalEl.dataset.locked && !force) return; 
  modalEl.classList.add('hidden'); 
}

/* ---------- QUẢN LÝ TÚI ĐỒ & TRANG BỊ ---------- */
const FUSE_KEEP = 6;

function isJunk(it) {
  if (!sexOk(it)) return true;
  const f = FAC[S.fac];
  if (DETAIL_SLOT[it.d] === 'weapon' && f && f.wcode >= 0 && weaponCode({ weapon: it }) !== f.wcode) return true;
  const eq = S.eq[slotFor(it)]; 
  if (!eq || betterThanEquipped(it) || itemPower(it) > itemPower(eq) * 0.85) return false;
  if (FUSE_SLOTS.includes(it.d) && S.inv.filter(x => FUSE_SLOTS.includes(x.d)).length < FUSE_KEEP) return false;
  return true;
}

function sweepJunk() {
  if (S.autoJunk === false) return 0;
  let n = 0;
  for (let guard = 0; guard < INV_MAX; guard++) {
    const j = S.inv.filter(isJunk).sort((a, b) => itemPower(a) - itemPower(b))[0]; 
    if (!j) break;
    S.inv.splice(S.inv.indexOf(j), 1); 
    S.gold += itemValue(j); 
    n++;
  }
  if (n) invDirty = true; 
  return n;
}

function addItem(it, quiet, picked, keep) {
  if (!picked && !lootMatch(it)) { S.gold += itemValue(it); return false; }
  if (S.inv.length >= INV_MAX && (it.set || it.vio || it.plv)) makeRoom(it, true);   
  if (S.inv.length >= INV_MAX) { 
    S.gold += itemValue(it); 
    if (!quiet) log('<span class="dim">Túi đầy, tự bán ' + esc(it.n) + '</span>'); 
    return false; 
  }
  if (!keep && S.autoJunk !== false && isJunk(it)) { S.gold += itemValue(it); return false; }
  S.inv.unshift(it); 
  invDirty = true;
  if (!quiet && it.r >= 2) log(`Nhặt được <span style="color:${RAR_COL[it.r]}">${esc(it.n)}</span>`);
  if (S.autoEquip && betterThanEquipped(it)) equip(it, true);
  return true;
}

function equipGain(it) {
  if (!reqOk(it)) return -1;
  const eq = Object.assign({}, S.eq); 
  eq[slotFor(it)] = it;
  return power(calc(eq)) / Math.max(1, power(calc(S.eq))) - 1;
}

function betterThanEquipped(it) {
  const f = FAC[S.fac];
  if (DETAIL_SLOT[it.d] === 'weapon' && f && f.wcode >= 0 && weaponCode({ weapon: it }) !== f.wcode) return false;
  return equipGain(it) > 0.01;
}

function equip(it, quiet) {
  if (!reqOk(it)) { if (!quiet) toast('Chưa mặc được: ' + reqProblems(it).join('; ')); return; }
  const slot = slotFor(it), old = S.eq[slot];
  S.inv = S.inv.filter(x => x !== it); 
  if (old) S.inv.unshift(old);
  S.eq[slot] = it; 
  R.dirty = true; 
  invDirty = true; 
  if (!quiet) uiSfx(it.d <= 1 ? 'equipWeapon' : 'equipCloth');
  if (!quiet) { closeModal(); refresh(); }
}

function unequip(slot) { 
  const it = S.eq[slot]; 
  if (!it) return; 
  if (S.inv.length >= INV_MAX) { toast('Túi đầy'); return; } 
  delete S.eq[slot]; 
  S.inv.unshift(it); 
  R.dirty = true; 
  invDirty = true; 
  closeModal(); 
  refresh(); 
}

const sellProtected = it => false;

function sellUnmatched() {
  const w = S.inv.filter(i => !lootMatch(i) && !sellProtected(i)); 
  let g = 0;
  for (const i of w) g += itemValue(i);
  S.gold += g; 
  S.inv = S.inv.filter(i => !w.includes(i)); 
  invDirty = true;
  return { n: w.length, gold: g, kept: 0 };
}

function sell(it) { 
  if (!S.inv.includes(it)) { closeModal(); return; } 
  S.inv = S.inv.filter(x => x !== it); 
  S.gold += itemValue(it); 
  invDirty = true; 
  closeModal(); 
  refresh(); 
}

function findItem(uid) { 
  uid = +uid; 
  return S.inv.find(i => i.uid === uid) || Object.values(S.eq).find(i => i && i.uid === uid) || (R.ground.find(d => d.it.uid === uid) || {}).it; 
}

function itemCell(it) {
  if (!it) return '';
  return `<button class="it r${it.r}${reqOk(it) ? '' : ' bad'}" data-uid="${it.uid}"${reqOk(it) ? '' : ` title="${esc('Chưa mặc được: ' + reqProblems(it).join('; '))}"`}>${it.ic ? `<img src="${esc(it.ic)}" alt="">` : ''}</button>`;
}

function itemHTML(it) {
  return `<div class="idet"><div class="pic r${it.r}">${it.ic ? `<img src="${esc(it.ic)}" alt="">` : ''}</div><div><h4 style="color:${RAR_COL[it.r]}">${esc(it.n)}${it.enh ? ` <span class="enh">+$${it.enh}</span>` : ''}</h4><small class="dim">${esc(J.items[it.d].n)} · cấp ${it.lvl}${it.s >= 0 ? ` · <span style="color:${SERIES_COL[it.s]}">hệ ${SERIES[it.s]}</span>` : ''}</small></div></div>
  <div class="sl">${itemLines(it).map(([k, t]) => `<div class="${k}">${esc(t)}</div>`).join('')}</div>`;
}

function fixReqPoints(it) {
  const d = reqDeficit(it), need = Object.values(d).reduce((a, b) => a + b, 0);
  if (!need) return false; 
  if (S.attrPts < need) { toast(`Cần ${need} điểm tiềm năng, đang có ${S.attrPts}`); return false; }
  for (const k in d) { S.attr[k] += d[k]; S.attrPts -= d[k]; }
  R.dirty = true; 
  recalc(); 
  toast('Đã cộng điểm để đủ điều kiện'); 
  return true;
}

function cmpLines(it, slot) {
  if (slot) return '';
  const ok = reqOk(it), c = equipCompare(it, !ok), col = v => v > 0.0005 ? 'cp' : v < -0.0005 ? 'cn' : 'dim';
  const row = (n, v, t) => `<span class="${col(v)}">${n} ${t}</span>`;
  const head = ok ? 'So với đang mặc' : 'Nếu đủ điều kiện, so với đang mặc';
  const probs = ok ? [] : reqProblems(it);
  const wrong = DETAIL_SLOT[it.d] === 'weapon' && FAC[S.fac] && FAC[S.fac].wcode >= 0 && weaponCode({ weapon: it }) !== FAC[S.fac].wcode;
  const need = Object.values(reqDeficit(it)).reduce((a, b) => a + b, 0), onlyAttr = probs.length > 0 && probs.length === Object.keys(reqDeficit(it)).length;
  return `<div class="cmp2"><small class="dim">${head}:</small><div class="cmpv">${row('Sức mạnh', c.gain, pctTxt(c.gain))} ${row('DPS', c.dps, pctTxt(c.dps))} ${row('Sinh lực', c.life, pctTxt(c.life))}</div>${probs.length ? `<div class="reqbad"><b>Chưa mặc được, thiếu:</b><br>${probs.map(esc).join('<br>')}${onlyAttr ? `<br><small>Cần ${need} điểm tiềm năng${S.attrPts >= need ? ' [đủ]' : ''}</small>` : ''}</div>` : ''}${wrong ? '<div class="reqnote">Sai loại vũ khí của môn phái: tự mặc sẽ bỏ qua, bạn vẫn mặc tay được.</div>' : ''}</div>`;
}

function autoEquipAll() {
  if (!S.autoEquip) return 0; 
  let n = 0;
  for (let g = 0; g < 14; g++) {
    let best = null, bg = 0.01;
    for (const it of S.inv) {
      if (!reqOk(it)) continue;
      const f = FAC[S.fac]; 
      if (DETAIL_SLOT[it.d] === 'weapon' && f && f.wcode >= 0 && weaponCode({ weapon: it }) !== FAC[S.fac].wcode) continue;
      const gn = equipGain(it); 
      if (gn > bg) { bg = gn; best = it; }
    }
    if (!best) break; 
    equip(best, true); 
    n++;
  }
  if (n) { invDirty = true; R.dirty = true; } 
  return n;
}

function itemModal(it, slot) {
  const cur = !slot && S.eq[slotFor(it)];
  modal(`${itemHTML(it)}${cmpLines(it, slot)}${cur ? `<div class="cmp"><small class="dim">Đang mặc:</small>${itemHTML(cur)}</div>` : ''}
    <div class="btnrow">${slot ? `<button class="btn" id="bUn">Tháo</button>` : `<button class="btn" id="bEq" ${reqOk(it) ? '' : 'disabled'}>Trang bị</button>${!reqOk(it) && Object.keys(reqDeficit(it)).length ? `<button class="btn" id="bReqPts">Cộng điểm</button>` : ''}${!slot ? `<button class="btn" id="bSell">Bán</button>` : ''}`.trim()}
    ${slot ? '' : `<button class="btn" id="bForge">Rèn</button>`}
    ${slot ? '' : `<button class="btn" id="bStashIt">Gửi kho</button>`}
  </div>`, () => { 
    const b1 = $('#bEq'), b2 = $('#bSell'), b3 = $('#bUn'), b4 = $('#bForge'), bs = $('#bStashIt'), bp = $('#bReqPts');
    if (bs) bs.onclick = () => { const r = stashDeposit(it); toast(r.msg); if (r.ok) { closeModal(); refresh(); } }; 
    if (bp) bp.onclick = () => { if (fixReqPoints(it)) { if (reqOk(it)) equip(it); else itemModal(it, slot); } };
    if (b1) b1.onclick = () => equip(it); 
    if (b2) b2.onclick = () => sell(it); 
    if (b3) b3.onclick = () => unequip(slot); 
    if (b4) b4.onclick = () => forgeModal(it); 
  });
}

/* ---------- THẺ CHIẾN TRƯỜNG ---------- */
function renderLog() {
  const z = zoneOf(Math.min(S.stage, STAGES));
  const speedBtn = `<button class="btn sm" id="bGameSpeed">Tốc độ: x${getGameSpeed()}</button>`;
  const zl = ZONES.map((q, i) => {
    const first = i * ZONE_STAGES + 1, open = S.maxStage >= first, cur = zoneIdx(Math.min(S.stage, STAGES)) === i;
    return `<button class="zrow${cur ? ' cur' : ''}${open ? '' : ' lock'}" data-z="${i}" ${open ? '' : 'disabled'}><b>${esc(q.n)}</b><span>Cấp ${q.lo}–${q.hi}</span></button>`;
  }).join('');
  $('#t-log').innerHTML = `${typeof todoHTML === 'function' ? todoHTML() : ''}<div class="card stagectl"><div><b>${esc(z.n)}</b> · Ải ${inZone(S.stage)}/${ZONE_STAGES}${isBossStage(S.stage) ? ' · Boss' : ''}</div>
    <div class="row"><button class="btn sm" id="bPrev">◀</button><button class="btn sm ${S.push ? 'on' : ''}" id="bPush">${S.push ? 'Vượt ải' : 'Luyện công'}</button><button class="btn sm" id="bNext">▶</button>${speedBtn}</div>
    <div class="log" id="logBox">${R.logs.map(l => `<div>${l}</div>`).join('')}</div>
    <h3>Bản đồ luyện công</h3><div class="zlist">${zl}</div>`;
  if (typeof bindTodo === 'function') bindTodo();
  $('#bPrev').onclick = () => gotoStage(S.stage - 1);
  $('#bNext').onclick = () => gotoStage(S.stage + 1);
  $('#bPush').onclick = () => { S.push = !S.push; renderLog(); };
  $('#bGameSpeed').onclick = () => speedModal();
  document.querySelectorAll('.zrow').forEach(b => b.onclick = () => gotoStage(+b.dataset.z * ZONE_STAGES + 1));
}

function renderLogOnly() { 
  const b = $('#logBox'); 
  if (b) b.innerHTML = R.logs.map(l => `<div>${l}</div>`).join(''); 
}

function gotoStage(st) { 
  st = clamp(st, 1, S.maxStage); 
  if (st === S.stage) return; 
  S.stage = st; 
  S.wave = 1; 
  S.push = false; 
  R.enemies = []; 
  R.spawnT = 0.3; 
  refresh(); 
}

/* ---------- THẺ NHÂN VẬT ---------- */
const ATTR_VI = { str: 'Sức mạnh', dex: 'Thân pháp', vit: 'Sinh khí', eng: 'Nội công' };

/* ---------- HÀM TẨY ĐIỂM TIỀM NĂNG ---------- */
function resetAttrs() {
  let totalSpent = 0;
  for (const k in S.attr) {
    totalSpent += (S.attr[k] || 0);
    S.attr[k] = 0;
  }
  if (totalSpent === 0) {
    toast('Chưa có điểm tiềm năng nào để tẩy!');
    return;
  }
  S.attrPts += totalSpent;
  R.dirty = true;
  recalc();
  renderChar();
  if (typeof updateDots === 'function') updateDots();
  if (typeof save === 'function') save();
  toast(`Đã tẩy và hoàn lại ${totalSpent} điểm tiềm năng!`);
}

function renderChar() {
  const P = R.P, f = FAC[S.fac];
  const eq = SLOTS.map(([k, vi]) => `<div class="slot" data-slot="${k}">${S.eq[k] ? itemCell(S.eq[k]) : `<span>${vi}</span>`}</div>`).join('');
  const attrs = Object.keys(ATTR_VI).map(k => `<div class="attr"><span>${ATTR_VI[k]}</span><b>${Math.round(P[k])}</b><span class="pm"><button class="plus" data-a="${k}" ${S.attrPts ? '' : 'disabled'}>+</button><button class="minus" data-a="${k}" ${S.attr[k] ? '' : 'disabled'}>-</button></span></div>`).join('');
  const res = ELEM.map(e => `<span>Kháng ${ELEM_VI[e]}</span><span>${Math.round(P.res[e])}%</span>`).join('');
  const charDisplayName = S.name || f.n;

  $('#t-char').innerHTML = `<div class="card"><b>${esc(charDisplayName)}</b> (<b style="color:${SERIES_COL[f.series]}">${esc(f.n)}</b> · hệ ${SERIES[f.series]}) · Cấp ${S.lvl}<br><small class="dim">${esc(S.name || f.n)} · ${S.sex ? 'Nữ' : 'Nam'}</small></div>
    <div class="card"><h3>Tiềm năng</h3>${attrs}<div class="row"><button class="btn sm" id="bSugAt">Gợi ý</button><button class="btn sm red" id="bResetAt">Tẩy điểm</button></div></div>
    <div class="card stats">
      <span>Sinh lực</span><span>${fmt(P.life)}</span><span>Nội lực</span><span>${fmt(P.mana)}</span>
      <span>Sát thương vũ khí</span><span>${Math.round(P.wmin)}–${Math.round(P.wmax)}</span>
      <span>Chiêu chính</span><span>${esc(P.main.n)} (${fmt(P.main.tot)})</span>
      <span>Chính xác</span><span>${Math.round(P.ar)}</span><span>Né tránh</span><span>${Math.round(P.def)}</span>
      <span>Chí mạng</span><span>${Math.round(P.main.crit)}%</span><span>Tốc độ đánh</span><span>${P.aspd.toFixed(2)}</span>${res}</div>
    <div class="card"><h3>Trang bị</h3><div class="eqgrid">${eq}</div></div>`;
  
  document.querySelectorAll('#t-char .plus').forEach(b => b.onclick = () => { if (!S.attrPts) return; S.attrPts--; S.attr[b.dataset.a]++; R.dirty = true; recalc(); renderChar(); });
  $('#bPower').onclick = powerModal; 
  $('#bSugAt').onclick = suggestModal;
  const bResetAt = $('#bResetAt');
  if (bResetAt) bResetAt.onclick = resetAttrs;
  document.querySelectorAll('#t-char .minus').forEach(b => b.onclick = () => unspendAttr(b.dataset.a));
  document.querySelectorAll('#t-char .slot .it').forEach(b => b.onclick = () => itemModal(findItem(b.dataset.uid), b.parentNode.dataset.slot));
}

/* ---------- THẺ KỸ NĂNG ---------- */
function unlearnSkill(id) {
  const L = S.sk[id] || 0; 
  if (!L) return false;
  if (L <= 1) delete S.sk[id]; else S.sk[id] = L - 1;
  S.skPts++;
  if (!S.sk[id] && S.main === id) S.mainLock = false;
  R.dirty = true; recalc(); fillSlots(); renderSkill(); renderPad(); updateDots(); save();
  toast(`Rút 1 điểm: ${SK[id].n} ${S.sk[id] || 0}/${SK[id].max}`);
  return true;
}

/* ---------- HÀM TẨY ĐIỂM KỸ NĂNG ---------- */
function resetSkills() {
  let totalSpent = 0;
  for (const id in S.sk) {
    totalSpent += (S.sk[id] || 0);
  }
  if (totalSpent === 0) {
    toast('Chưa có điểm kỹ năng nào để tẩy!');
    return;
  }
  S.sk = {};
  S.skPts += totalSpent;
  S.mainLock = false;
  R.dirty = true;
  recalc();
  renderSkill();
  if (typeof updateDots === 'function') updateDots();
  if (typeof save === 'function') save();
  toast(`Đã tẩy hoàn lại ${totalSpent} điểm kỹ năng!`);
}

function unspendAttr(k) {
  if (!(S.attr[k] > 0)) return false;
  S.attr[k]--; S.attrPts++; R.dirty = true; recalc(); renderChar(); updateDots(); save(); return true;
}

function renderSkill() {
  const f = FAC[S.fac];
  $('#t-skill').innerHTML = `<h3>${esc(f.n)} <small>${S.skPts} điểm kỹ năng</small> <button class="btn sm" id="bSugSk">Gợi ý</button> <button class="btn sm red" id="bResetSk">Tẩy điểm</button></h3>`;
  const bResetSk = $('#bResetSk');
  if (bResetSk) bResetSk.onclick = resetSkills;
  $('#bSugSk').onclick = suggestModal;
}

/* ---------- THẺ TÚI ĐỒ ---------- */
function renderInv() {
  invDirty = false;
  const f = lootFilter();
  const rar = RAR_VI.map((n, i) => `<option value="${i}" ${f.minRar === i ? 'selected' : ''}>${n}</option>`).join('');
  const lv = Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}" ${f.minLvl === i + 1 ? 'selected' : ''}>${i + 1}</option>`).join('');
  const grp = LOOT_ATTR_GROUPS.map(([n], i) => `<label class="chip2"><input type="checkbox" data-g="${i}" ${f.groups.includes(i) ? 'checked' : ''}>${n}</label>`).join('');
  const ser = SERIES.map((n, i) => `<label class="chip2" style="color:${SERIES_COL[i]}"><input type="checkbox" data-s="${i}" ${f.series.includes(i) ? 'checked' : ''}>${n}</label>`).join('');
  const onGround = R.ground.length, match = R.ground.filter(d => lootMatch(d.it)).length;
  $('#t-inv').innerHTML = `<div class="invbar"><span>${S.inv.length}/${INV_MAX}</span><span class="sp"></span>
    <button class="btn sm" id="bStash">Kho chung</button><button class="btn sm" id="bBest">Mặc đồ tốt</button><button class="btn sm" id="bSortColor">Sắp xếp màu</button><button class="btn sm red" id="bSellAll">Bán không khớp</button></div>
    <div class="invgrid">${S.inv.map(itemCell).join('')}</div>
    <h3>Đồ rơi trên đất <small>${onGround} món · ${match} khớp bộ lọc</small></h3>
    <div class="card lootf">
      <label><input type="checkbox" id="fAuto" ${f.auto ? 'checked' : ''}> Tự đi nhặt đồ khớp bộ lọc khi hết quái</label>
      <div class="row">Độ hiếm từ <select id="fRar">${rar}</select> · cấp đồ từ <select id="fLvl">${lv}</select></div>
      <div class="dim small">Có ít nhất một thuộc tính (bỏ trống = mọi thuộc tính):</div><div class="chips">${grp}</div>
      <div class="dim small">Hệ của món đồ (bỏ trống = mọi hệ):</div><div class="chips">${ser}</div>
    </div>`;
  const upd = () => { save(); renderInv(); };
  $('#fAuto').onchange = e => { f.auto = e.target.checked; upd(); };
  $('#fRar').onchange = e => { f.minRar = +e.target.value; upd(); };
  $('#fLvl').onchange = e => { f.minLvl = +e.target.value; upd(); };
  document.querySelectorAll('#t-inv [data-g]').forEach(b => b.onchange = () => { const g = +b.dataset.g; f.groups = b.checked ? [...new Set(f.groups.concat(g))] : f.groups.filter(x => x !== g); upd(); });
  document.querySelectorAll('#t-inv [data-s]').forEach(b => b.onchange = () => { const v = +b.dataset.s; f.series = b.checked ? [...new Set(f.series.concat(v))] : f.series.filter(x => x !== v); upd(); });
  $('#bStash').onclick = () => stashModal();
  $('#bBest').onclick = () => { for (const it of S.inv.slice()) if (betterThanEquipped(it)) equip(it, true); refresh(); };
  $('#bSortColor').onclick = () => sortInventoryByColor();
  $('#bSellAll').onclick = () => { const r = sellUnmatched(); toast(`Đã bán ${r.n} món (nhận ${fmt(r.gold)} lượng)`); refresh(); };
  document.querySelectorAll('#t-inv .it').forEach(b => b.onclick = () => itemModal(findItem(b.dataset.uid)));
}

/* ---------- THẺ CÀI ĐẶT & KHÁC ---------- */
function renderMore() {
  $('#t-more').innerHTML = `<h3>Lưu game</h3><div class="card"><p class="dim small">Nhân vật lưu trong trình duyệt của từng thiết bị (3 slot).</p><div class="btnrow"><button class="btn" id="bDl">Tải file lưu (.jxsave)</button><button class="btn" id="bFile">Nạp từ file</button></div><p class="dim small">Hoặc dùng mã văn bản:</p><div class="btnrow"><button class="btn" id="bExp">Xuất mã</button><button class="btn" id="bImp">Nhập mã</button></div><textarea id="saveTxt" rows="6" style="width:100%;box-sizing:border-box;"></textarea></div><h3>Khác</h3><div class="card"><label><input type="checkbox" id="cAuto" ${S.autoEquip ? 'checked' : ''}> Tự mặc đồ tốt hơn khi nhặt</label><br><label><input type="checkbox" id="cJunk" ${S.autoJunk === false ? '' : 'checked'}> Tự bán đồ thừa</label><br><label><input type="checkbox" id="cPts" ${S.autoPts === true ? 'checked' : ''}> Tự cộng điểm tiềm năng và võ công</label><br><label><input type="checkbox" id="cForge" ${S.autoForge ? 'checked' : ''}> Tự động rèn đồ</label><br><label><input type="checkbox" id="cBuy" ${S.autoBuy === false ? '' : 'checked'}> Tự mua vũ khí đúng loại</label></div>`;

  $('#bDl').onclick = () => { if (downloadSaveFile()) toast('Đã tải file lưu: ' + saveFileName()); };
  $('#bFile').onclick = () => pickSaveFile(null);
  $('#bExp').onclick = () => { $('#saveTxt').value = exportSave(); toast('Đã xuất mã'); };
  $('#bImp').onclick = () => importFlow($('#saveTxt').value, null);
  $('#cAuto').onchange = e => { S.autoEquip = e.target.checked; save(); };
  $('#cJunk').onchange = e => { S.autoJunk = e.target.checked; save(); };
  $('#cPts').onchange = e => { S.autoPts = e.target.checked; if (S.autoPts) { autoSpendAttrs(); autoSpendSkills(); recalc(); } save(); };
  $('#cForge').onchange = e => { S.autoForge = e.target.checked; if (S.autoForge) autoForge(); save(); };
  $('#cBuy').onchange = e => { S.autoBuy = e.target.checked; save(); };
}

/* ---------- MODALS & HÀM BỔ SUNG ---------- */
function stashModal() {
  if (!S.stash) S.stash = { inv: [], gold: 0 };
  const items = S.stash.inv.map(itemCell).join('');
  modal(`
    <h3>Kho dùng chung</h3>
    <div class="card row">
      <span>Ngân lượng trong kho: <b>${fmt(S.stash.gold || 0)}</b></span>
      <button class="btn sm" id="bStashGoldIn">Gửi tiền</button>
      <button class="btn sm" id="bStashGoldOut">Rút tiền</button>
    </div>
    <div class="invgrid">${items || '<div class="dim">Kho trống</div>'}</div>
    <p class="dim small">Chạm vào món đồ trong kho để rút về túi đồ nhân vật.</p>
  `, () => {
    const bin = $('#bStashGoldIn'); 
    if (bin) bin.onclick = () => {
      const amt = prompt('Nhập số lượng tiền muốn gửi:', S.gold);
      const val = parseInt(amt, 10);
      if (val > 0 && val <= S.gold) { S.gold -= val; S.stash.gold = (S.stash.gold || 0) + val; refresh(); stashModal(); }
    };
    const bout = $('#bStashGoldOut'); 
    if (bout) bout.onclick = () => {
      const amt = prompt('Nhập số lượng tiền muốn rút:', S.stash.gold || 0);
      const val = parseInt(amt, 10);
      if (val > 0 && val <= (S.stash.gold || 0)) { S.stash.gold -= val; S.gold += val; refresh(); stashModal(); }
    };
    document.querySelectorAll('#mBody .invgrid .it').forEach(b => {
      b.onclick = () => {
        const uid = +b.dataset.uid;
        const idx = S.stash.inv.findIndex(i => i.uid === uid);
        if (idx >= 0) {
          if (S.inv.length >= INV_MAX) { toast('Túi đồ đã đầy'); return; }
          const [it] = S.stash.inv.splice(idx, 1);
          S.inv.unshift(it); invDirty = true; refresh(); stashModal();
        }
      };
    });
  });
}

function stashDeposit(it) {
  if (!S.stash) S.stash = { inv: [], gold: 0 };
  if (S.stash.inv.length >= 40) return { ok: false, msg: 'Kho dùng chung đã đầy (tối đa 40 món)' };
  const idx = S.inv.indexOf(it);
  if (idx >= 0) S.inv.splice(idx, 1);
  S.stash.inv.unshift(it);
  invDirty = true;
  return { ok: true, msg: 'Đã gửi ' + it.n + ' vào kho chung' };
}

function forgeModal(it) {
  modal(`
    <h3>Rèn trang bị</h3>
    ${itemHTML(it)}
    <div class="card">
      <p class="dim small">Cường hóa trang bị <b>${esc(it.n)}</b> bằng Ngân lượng.</p>
      <div class="row">
        <span>Cường hóa hiện tại: <b>+${it.enh || 0}</b></span>
        <button class="btn" id="bDoEnh">Cường hóa (+1)</button>
      </div>
    </div>
  `, () => {
    const b = $('#bDoEnh');
    if (b) b.onclick = () => {
      const cost = Math.pow((it.enh || 0) + 1, 2) * 1000;
      if (S.gold < cost) { toast(`Không đủ ngân lượng (cần ${fmt(cost)})`); return; }
      S.gold -= cost;
      it.enh = (it.enh || 0) + 1;
      R.dirty = true;
      recalc();
      toast(`Cường hóa thành công +${it.enh}!`);
      forgeModal(it);
    };
  });
}

function autoForge() {
  if (!S || !S.fac || !S.autoForge) return null;
  return { ok: true, note: 'Tự động rèn đồ đang được kích hoạt' };
}

function powerModal() {
  const P = R.P;
  if (!P) return;
  modal(`
    <h3>Chi tiết lực chiến</h3>
    <div class="card stats">
      <span>Tổng Lực Chiến</span><span><b>${fmt(R.power)}</b></span>
      <span>Cấp độ</span><span>${S.lvl}</span>
      <span>Môn phái</span><span>${FAC[S.fac] ? FAC[S.fac].n : '—'}</span>
      <span>Sát thương kỹ năng</span><span>${fmt(P.main.tot)}</span>
      <span>Tốc độ đánh</span><span>${P.aspd.toFixed(2)}</span>
      <span>Tỉ lệ chí mạng</span><span>${Math.round(P.main.crit)}%</span>
      <span>Chính xác</span><span>${Math.round(P.ar)}</span>
      <span>Né tránh</span><span>${Math.round(P.def)}</span>
      <span>Sinh lực tối đa</span><span>${fmt(P.life)}</span>
      <span>Nội lực tối đa</span><span>${fmt(P.mana)}</span>
    </div>
  `);
}

function suggestModal() {
  const f = FAC[S.fac];
  if (!f) return;
  modal(`
    <h3>Gợi ý phát triển môn phái ${esc(f.n)}</h3>
    <div class="card">
      <p><b>Tiềm năng:</b> Tăng tối đa thông số phù hợp với đặc tính môn phái (Sức mạnh/Sinh khí cho ngoại công, Nội công/Sinh khí cho nội công).</p>
      <p><b>Võ công:</b> Ưu tiên điểm cho chiêu tấn công chủ lực và các kỹ năng nội tại gia tăng sát thương/kháng.</p>
    </div>
    <div class="btnrow">
      <button class="btn" id="bAutoApply">Tự động cộng điểm mẫu</button>
    </div>
  `, () => {
    const b = $('#bAutoApply');
    if (b) b.onclick = () => {
      if (typeof autoSpendAttrs === 'function') autoSpendAttrs();
      if (typeof autoSpendSkills === 'function') autoSpendSkills();
      R.dirty = true;
      recalc();
      refresh();
      closeModal();
      toast('Đã cộng điểm theo gợi ý mẫu!');
    };
  });
}

function codexModal() {
  modal(`
    <h3>Bách khoa toàn thư</h3>
    <div class="card">
      <b>Tương sinh Ngũ hành:</b>
      <p class="dim small">Kim → Thủy → Mộc → Hỏa → Thổ → Kim</p>
      <b>Tương khắc Ngũ hành:</b>
      <p class="dim small">Kim khắc Mộc, Mộc khắc Thổ, Thổ khắc Thủy, Thủy khắc Hỏa, Hỏa khắc Kim.</p>
      <b>Phẩm chất trang bị:</b>
      <p class="dim small">Trắng (Thường) → Xanh lá (Tốt) → Lam (Hiếm) → Tím (Cực phẩm) → Cam (Hoàng Kim).</p>
    </div>
  `);
}

function tutorialModal(step = 0) {
  const tuts = [
    { title: 'Chào mừng đến với JxOffline', desc: 'Chọn ải vượt trận, luyện công đánh quái để thu thập trang bị và kinh nghiệm.' },
    { title: 'Nâng cấp Nhân vật', desc: 'Cộng điểm Tiềm năng và Võ công để tăng cường sức mạnh chiến đấu.' },
    { title: 'Bộ lọc trang bị & Tự động', desc: 'Sử dụng bộ lọc nhặt đồ thông minh để tự động bán đồ thừa và giữ lại trang bị quý.' }
  ];
  const t = tuts[step] || tuts[0];
  modal(`
    <h3>${esc(t.title)}</h3>
    <p class="desc">${esc(t.desc)}</p>
    <div class="btnrow">
      ${step > 0 ? `<button class="btn" id="bTutPrev">Trước</button>` : ''}
      ${step < tuts.length - 1 ? `<button class="btn" id="bTutNext">Tiếp tục</button>` : `<button class="btn" id="bTutEnd">Hoàn tất</button>`}
    </div>
  `, () => {
    const bp = $('#bTutPrev'); if (bp) bp.onclick = () => tutorialModal(step - 1);
    const bn = $('#bTutNext'); if (bn) bn.onclick = () => tutorialModal(step + 1);
    const be = $('#bTutEnd'); if (be) be.onclick = () => closeModal();
  });
}

/* ---------- KHUNG CHUNG & ĐIỀU HÀNH KỊCH BẢN ---------- */
function showTab(t) {
  curTab = t;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  document.querySelectorAll('.tab').forEach(el => el.classList.toggle('hidden', el.id !== 't-' + t));
  refresh();
}

function refresh() {
  if (!S.fac) return;
  if (R.dirty) recalc();
  ({ log: renderLog, char: renderChar, skill: renderSkill, inv: renderInv, more: renderMore })[curTab]();
  if (typeof renderPad === 'function') renderPad();
  updateDots();
}

function updateDots() { 
  const dc = $('#dotChar'); if (dc) dc.classList.toggle('on', S.attrPts > 0); 
  const ds = $('#dotSkill'); if (ds) ds.classList.toggle('on', S.skPts > 0 && FAC[S.fac] && FAC[S.fac].skills.some(id => canLearn(SK[id]))); 
}

function updateTop() {
  const P = R.P; if (!P) return;
  { const hw = W.hero[S.fac], lb = $('.lvbox'); if (hw && lb) lb.style.setProperty('--pl', `url('${hw.img}')`); }
  $('#lv').textContent = S.lvl; 
  $('#gold').textContent = fmt(S.gold); 
  $('#heroName').textContent = S.name || (FAC[S.fac] ? FAC[S.fac].n : ''); 
  $('#stageLbl').textContent = `Ải ${S.stage} · đợt ${S.wave}/${WAVES}`;
  const need = J.exp[S.lvl - 1] || 1;
  $('#xpBar').style.width = (S.xp / need * 100) + '%'; $('#xpTxt').textContent = `${(S.xp / need * 100).toFixed(1)}%`;
  $('#hpBar').style.width = (R.life / P.life * 100) + '%'; $('#hpTxt').textContent = `${fmt(R.life)} / ${fmt(P.life)}`;
  $('#mpBar').style.width = (R.mana / P.mana * 100) + '%'; $('#mpTxt').textContent = `${fmt(R.mana)} / ${fmt(P.mana)}`;
  $('#mainSk').textContent = P.main.n;
}

function pickSaveFile(after) {
  const inp = document.createElement('input'); 
  inp.type = 'file'; 
  inp.accept = '.jxsave,.json,.txt,application/json,text/plain'; 
  inp.style.display = 'none';
  inp.onchange = () => { 
    const f = inp.files && inp.files[0]; 
    inp.remove(); 
    if (!f) return; 
    const r = new FileReader(); 
    r.onload = () => importFlow(String(r.result), after); 
    r.onerror = () => toast('Không đọc được file'); 
    r.readAsText(f); 
  };
  document.body.appendChild(inp); 
  inp.click();
}

function importFlow(txt, after, slot) {
  let st; 
  try { st = parseSaveText(txt); } catch (e) { toast(e.message || 'File không hợp lệ'); return; }
  const f = FAC[st.fac], desc = `${esc(f.n)} cấp ${Math.max(1, Math.min(MAX_LEVEL, st.lvl | 0))}`;
  const rows = [...Array(SLOT_N).keys()].map(i => { 
    const o = slotInfo(i), g = o && FAC[o.fac];
    return `<div class="slotrow ${o ? '' : 'empty'}"><span><b>Slot ${i + 1}</b><small>${o && g ? esc(g.n) + ' cấp ' + o.lvl + ' (sẽ bị ghi đè)' : 'Trống'}</small></span><button class="btn" data-into="${i}">Nạp</button></div>`;
  }).join('');
  modal(`<h3>Nạp file lưu</h3><p class="desc">Nhân vật trong file: <b>${desc}</b>. Chọn slot để nạp (slot đã có nhân vật sẽ giữ một bản sao lưu).</p><div class="slotlist">${rows}</div>`, () => {
    document.querySelectorAll('#mBody [data-into]').forEach(b => b.onclick = () => { 
      try { 
        if (SLOT === +b.dataset.into) SAVE_LOCK = true; 
        writeSlot(+b.dataset.into, st); 
      } catch (e) { toast(e.message); return; } 
      location.reload(); 
    });
  }, !!after && !S.fac);
}

function slotMenu(confirmDel) {
  const rows = [...Array(SLOT_N).keys()].map(i => {
    const o = slotInfo(i), f = o && FAC[o.fac];
    if (!o || !f) return `<div class="slotrow empty"><span><b>Slot ${i + 1}</b><small>Tạo nhân vật</small></span><button class="btn" data-play="${i}">Tạo nhân vật</button></div>`;
    const ago = o.last ? new Date(o.last).toLocaleString('vi-VN') : '';
    const charName = o.name || f.n;
    if (confirmDel === i) return `<div class="slotrow del"><span><b>Xóa slot ${i + 1}?</b><small>${esc(charName)} (${esc(f.n)}) cấp ${o.lvl} sẽ mất vĩnh viễn</small></span><button class="btn red" data-del-yes="${i}">Xóa</button><button class="btn" data-del-no="${i}">Hủy</button></div>`;
    return `<div class="slotrow"><img src="${esc((W.hero[o.fac] || {}).img || '')}" alt=""><span><b style="color:${SERIES_COL[f.series]}">${esc(charName)}</b> <small>(${esc(f.n)}) · Cấp ${o.lvl} · ${ago}</small></span><button class="btn" data-play="${i}">Chơi</button><button class="btn red" data-del="${i}">Xóa</button></div>`;
  }).join('');
  modal(`<h3>Chọn nhân vật</h3><p class="desc">Mỗi slot là một nhân vật riêng, lưu độc lập.</p><div class="slotlist">${rows}</div>`, () => {
    document.querySelectorAll('#mBody [data-play]').forEach(b => b.onclick = () => { try { localStorage.setItem(SLOT_PTR, b.dataset.play); } catch (e) { /* bỏ qua */ } SAVE_LOCK = true; location.reload(); });
    document.querySelectorAll('#mBody [data-del]').forEach(b => b.onclick = () => slotMenu(+b.dataset.del));
    document.querySelectorAll('#mBody [data-del-no]').forEach(b => b.onclick = () => slotMenu());
    document.querySelectorAll('#mBody [data-del-yes]').forEach(b => b.onclick = () => deleteSlot(+b.dataset.delYes));
  }, true);
}

function pickFaction() {
  const cards = FACTIONS.map(f => `<button data-f="${f.key}" style="--c:${SERIES_COL[f.series]}"><img src="${(W.hero[f.key] || {}).img || ''}" alt=""><b>${esc(f.n)}</b><small>hệ ${SERIES[f.series]}</small></button>`).join('');
  modal(`
    <h3>Tạo nhân vật</h3>
    <div class="card" style="margin-bottom:12px;">
      <label><b>Tên nhân vật:</b> 
        <input type="text" id="cName" placeholder="Nhập tên nhân vật..." maxlength="16" style="width:100%;padding:6px;margin-top:6px;box-sizing:border-box;border:1px solid var(--border);border-radius:6px;">
      </label>
    </div>
    <p class="desc">Chọn môn phái. Mỗi phái thuộc một hệ ngũ hành. Kim khắc Mộc, Mộc khắc Thổ, Thổ khắc Thủy, Thủy khắc Hỏa, Hỏa khắc Kim.</p>
    <div class="facpick">${cards}</div>
  `, () => {
    document.querySelectorAll('.facpick button').forEach(b => b.onclick = () => {
      const nameInp = $('#cName');
      const name = nameInp ? nameInp.value.trim() : '';
      startFaction(b.dataset.f, name);
    });
  }, true);
}

const NOTICE_TXT = 'JxOffline - Phi thương mại, ưu tiên giải trí trên chính thiết bị của mình';

function noticeModal() {
  modal(`<h3>JxOffline</h3><p class="desc notice">${esc(NOTICE_TXT)}</p><div class="btnrow"><button class="btn" id="bNotice">Đã hiểu</button></div>`, () => { $('#bNotice').onclick = () => closeModal(); });
  log(`<span class="dim">${esc(NOTICE_TXT)}</span>`);
}

function startFaction(key, name) {
  const f = FAC[key]; 
  S.fac = key; 
  S.sex = ['emei', 'cuiyan'].includes(key) ? 1 : 0; 
  S.name = name || f.n;
  if (f.starter) { S.sk[f.starter] = 1; S.skPts = Math.max(0, S.skPts - 1); S.main = f.starter; }
  starterGear();
  R.dirty = true; recalc(); R.life = R.P.life; R.mana = R.P.mana;
  if (typeof loginCheck === 'function') loginCheck(); 
  if (typeof dotGift === 'function') dotGift();
  closeModal(true); save(); showTab('log');
  noticeModal();
  log(`Đại hiệp <b style="color:${SERIES_COL[f.series]}">${esc(S.name)}</b> đã gia nhập <b>${esc(f.n)}</b>. Bắt đầu hành tẩu giang hồ!`);
}

function starterGear() {
  if (S.eq.weapon) return;
  const f = FAC[S.fac];
  const wc = f.wcode >= 0 ? f.wcode : 0;
  const it = wc === 7 ? makeItem(1, 0, 1, 0) : makeItem(0, wc === 9 ? 6 : wc, 1, 0);
  if (it) S.eq.weapon = it;
  const ar = makeItem(2, sexPart(2, 0), 1, 0); 
  if (ar && sexOk(ar)) S.eq.armor = ar;
}

/* ---------- KHỜI TẠO SỰ KIỆN GIAO DIỆN ---------- */
function initUI() {
  document.querySelectorAll('#tabs button').forEach(b => {
    b.onclick = () => showTab(b.dataset.t);
  });
  refresh();
}
