/* ======================= KHOI DONG + VONG LAP ======================= */
'use strict';
let lastT = performance.now(), saveT = 0, uiT = 0, drawTog = false;

/* Tuy chon hien thi luu rieng cho thiet bi */
const UI_KEY = 'jxidle_ui', UI_FS = [0.9, 1, 1.15, 1.3], UI_FS_NAME = ['Nhỏ', 'Vừa', 'Lớn', 'Rất lớn'];
let UIP = null;

function uiPrefs() {
  if (!UIP) { try { UIP = JSON.parse(localStorage.getItem(UI_KEY) || '{}') || {}; } catch (e) { UIP = {}; } }
  UIP.fs = Number.isInteger(UIP.fs) && UIP.fs >= 0 && UIP.fs < UI_FS.length ? UIP.fs : 1; 
  UIP.saver = !!UIP.saver; 
  UIP.compact = !!UIP.compact;
  return UIP;
}

function applyUiPrefs() { 
  const p = uiPrefs(); 
  document.documentElement.style.setProperty('--fs', UI_FS[p.fs]); 
  document.body.classList.toggle('saver', p.saver); 
  document.body.classList.toggle('compact', p.compact); 
}

function setUiPref(o) { 
  Object.assign(uiPrefs(), o); 
  try { localStorage.setItem(UI_KEY, JSON.stringify(UIP)); } catch (e) {} 
  applyUiPrefs(); 
  fitApp(); 
}

function onZoneChange(z) { 
  obsLoad(z.id); 
  [H.x, H.y] = inWorld(H.x, H.y); 
  for (const e of R.enemies) [e.x, e.y] = inWorld(e.x, e.y); 
  for (const d of R.ground) [d.x, d.y] = inWorld(d.x, d.y); 
  snapCamera(); 
  R.bgImg = z.bg ? img(z.bg) : null; 
  playMusic(z.id); 
  preloadZoneSounds(z); 
  if (curTab === 'log') refresh(); 
}

function onStageChange() { if (curTab === 'log') refresh(); }

function onLevelUp() { 
  if (S.autoPts === true) { autoSpendAttrs(); autoSpendSkills(); } 
  autoEquipAll(); 
  recalc(); 
  R.life = R.P.life; 
  R.mana = R.P.mana; 
  if (!R.quiet) { 
    checkHints(); updateDots(); renderPad(); dotGift(); 
    if (LV_MS.some(m => m[0] === S.lvl)) toast(`Đạt mốc cấp ${S.lvl}: nhận quà ở nút 🎁`); 
  } 
  if (typeof updateTop === 'function') updateTop(); 
}

/* Mo phong buoc co dinh 60 lan / giay */
const STEP = 1 / 60, MAX_STEPS = 10, LERP_MAX = 120;
let simAcc = 0;

function movers() { return [H, R.petPos].concat(SV.on ? SV.en : R.enemies).filter(Boolean); }

function simulateFrame(dt) {
  const speed = Number.isFinite(S && S.gameSpeed) ? S.gameSpeed : 1;
  simAcc += dt * speed;
  let n = 0;
  while (simAcc >= STEP && n < MAX_STEPS) {
    for (const o of movers()) { o._px = o.x; o._py = o.y; }
    if (SV.on) svTick(STEP); else tick(STEP);
    simAcc -= STEP; n++;
  }
  if (n === MAX_STEPS) simAcc = 0;
}

function drawLerp(dt) {
  const a = simAcc / STEP, list = movers().filter(o => o._px !== undefined && Math.hypot(o.x - o._px, o.y - o._py) < LERP_MAX);
  for (const o of list) { o._cx = o.x; o._cy = o.y; o.x = o._px + (o.x - o._px) * a; o.y = o._py + (o.y - o._py) * a; }
  try { if (SV.on) svDraw(dt); else draw(dt); }
  finally { for (const o of list) { o.x = o._cx; o.y = o._cy; } }
}

let loopErr = 0, loopLast = '';
function guard(what, fn) {
  try { fn(); loopErr = Math.max(0, loopErr - 0.02); }
  catch (e) {
    loopErr++; const k = what + ': ' + (e && e.message);
    if (k !== loopLast) { loopLast = k; console.error('[loi vong lap]', what, e); }
    if (loopErr > 30) {
      loopErr = 0; R.fx = []; R.txt = []; R.enemies = []; 
      if (typeof SV !== 'undefined' && SV.on) { try { svExit(); } catch (x) { SV.on = false; } }
      R.spawnT = 0.5; R.deadT = 0; simAcc = 0; R.quiet = false; closeModal(true);
    }
  }
}

function frame(now) {
  const dt = Math.min(0.25, (now - lastT) / 1000); lastT = now;
  guard('tay cam', gamepadPoll);
  if (S.fac && !document.hidden) { 
    guard('mo phong', () => simulateFrame(dt)); 
    if (!uiPrefs().saver || (drawTog = !drawTog)) guard('ve', () => drawLerp(dt)); 
  }
  uiT += dt;
  if (uiT > 0.1 && S.fac) {
    uiT = 0;
    guard('giao dien', () => {
      updateTop(); updatePadCd();
      if (R.logDirty && curTab === 'log') { R.logDirty = false; renderLogOnly(); }
      if (invDirty && curTab === 'inv') renderInv();
    });
  }
  saveT += dt;
  if (saveT > 10 && S.fac) guard('luu', () => { 
    saveT = 0; 
    loginCheck(); achCheck(); dotGift(); 
    if (typeof validateLevel === 'function') validateLevel(); // Tự động đối chiếu chống hack cấp
    const el = R.activeT || 0; 
    if (el > 30) S.kps = R.kills / el; 
    save(); 
  });
  requestAnimationFrame(frame);
}

function showOffline(o) {
  if (!o) return;
  const h = Math.floor(o.secs / 3600), m = Math.floor(o.secs % 3600 / 60);
  modal(`<h3>Chào mừng trở lại!</h3><p class="desc">Vắng mặt ${h ? h + ' giờ ' : ''}${m} phút, nhân vật vẫn luyện công tại ${esc(zoneOf(Math.min(S.stage, STAGES)).n)}.</p>
    <div class="card stats"><span>Quái bị hạ</span><span>${fmt(o.kills)}</span><span>Kinh nghiệm</span><span>${fmt(o.xp)}</span>
    <span>Ngân lượng</span><span>${fmt(o.gold)}</span><span>Cấp</span><span>${o.lv0} → ${o.lv1}</span><span>Vật phẩm</span><span>${o.got}${o.sold ? ` (+${o.sold} bán)` : ''}</span>
    <span>Rương tu luyện</span><span>${o.chests || 0} / 3 mốc (1 · 4 · 8 giờ)</span></div>
    ${o.chests ? '<p class="desc">Quà các mốc đã vào túi — xem nhật ký Giang hồ.</p>' : ''}
    <div class="btnrow"><button class="btn" onclick="closeModal()">Nhận</button></div>`);
}

function fitApp() {
  document.body.classList.toggle('mob', isMobileUI());
  const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  if (h > 0) document.documentElement.style.setProperty('--app-h', Math.round(h) + 'px');
  if (CV) resizeArena();
}

function setCompact(on) { setUiPref({ compact: on }); if (!on && S.fac) refresh(); }

function init() {
  const pk = pickSlot(); SLOT = pk.slot;
  if (pk.menu) { S = newSave(); }
  const had = pk.menu ? false : load();
  CV = $('#arena'); CX = CV.getContext('2d');
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('button[data-t]'); if (b) showTab(b.dataset.t); });
  $('#mClose').onclick = () => closeModal();
  $('#giftBtn').onclick = () => { if (S.fac) { uiSfx('click'); giftModal(); } };
  $('#svBtn').onclick = () => { uiSfx('click'); svIntro(); };
  $('#svPauseBtn').onclick = () => svPause();
  const ultBtn = $('#svUlt'); if (ultBtn) ultBtn.onclick = () => svCastUlt();
  const bombBtn = $('#svBomb'); if (bombBtn) bombBtn.onclick = () => svUseBomb();
  const hpBtn = $('#svHpBtn'); if (hpBtn) hpBtn.onclick = () => svUseHp();
  $('#modal').onclick = e => { if (e.target.id === 'modal') closeModal(); };
  window.addEventListener('resize', fitApp); window.addEventListener('orientationchange', fitApp);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fitApp);
  $('#compactBtn').onclick = () => setCompact(!document.body.classList.contains('compact'));
  applyUiPrefs();
  fitApp();
  bindControls();
  const unlock = () => { audInit(); const z = zoneOf(Math.min(S.stage, STAGES)); preloadZoneSounds(z); if (AUD.music && sndCfg().music && AUD.music.paused) AUD.music.play().catch(() => {}); else playMusic(z.id); };
  document.addEventListener('pointerdown', unlock, true); document.addEventListener('keydown', unlock, true);
  resizeArena(); [H.x, H.y] = inWorld(WORLD.w / 2, WORLD.h / 2); snapCamera(); restoreGround();
  if (pk.menu) { slotMenu(); }
  else if (!S.fac) { pickFaction(); }
  else {
    if (had) { 
      const off = offlineGains(); 
      recalc(); 
      R.life = R.P.life; 
      R.mana = R.P.mana; 
      showOffline(off); 
    } else {
      recalc(); 
      R.life = R.P.life; 
      R.mana = R.P.mana; 
    }
    showTab('log'); log('Tiếp tục hành tẩu giang hồ…');
    if (window.__tampered) { log('<span class="dim">Dữ liệu lưu không khớp chữ ký (đã chỉnh sửa ngoài game): dùng bản sao lưu gần nhất nếu có.</span>'); toast('Phát hiện hack - dùng bản lưu trước đó'); }
    loginCheck(); dotGift();
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (S.fac) save(); if (SV.on) svPause(); }
    else if (S.fac && !SV.on && Date.now() - S.last > 60000) { R.dirty = true; recalc(); showOffline(offlineGains()); refresh(); }
    lastT = performance.now();
  });
  window.addEventListener('pagehide', () => { if (S.fac) save(); });
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').classList.contains('hidden')) closeModal(); });
  requestAnimationFrame(frame);
}

/* ---------- HÀM RECALC CHUẨN DUY NHẤT ---------- */
function recalc() {
  const oldMaxLife = R.P ? R.P.life : 0;
  const oldMaxMana = R.P ? R.P.mana : 0;

  R.P = calc(S.eq);
  R.power = power(R.P);
  R.dirty = false;

  if (oldMaxLife > 0 && R.P.life > oldMaxLife) {
    R.life = (R.life || 0) + (R.P.life - oldMaxLife);
  }
  if (oldMaxMana > 0 && R.P.mana > oldMaxMana) {
    R.mana = (R.mana || 0) + (R.P.mana - oldMaxMana);
  }

  R.life = Math.min(R.life || R.P.life, R.P.life);
  R.mana = Math.min(R.mana || R.P.mana, R.P.mana);

  if (typeof updateTop === 'function') updateTop();
}

init();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
