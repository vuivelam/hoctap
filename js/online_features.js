/* ==========================================================================
   HE THONG TINH NANG ONLINE (CHAT, BXH, CHO TROI, TRUM THE GIOI)
   ========================================================================== */
'use strict';

// --------------------------------------------------------------------------
// ⚙️ CAU HINH THONG SO DE HIEU CHINH (CÓ THỂ SỬA THEO Ý BẠN)
// --------------------------------------------------------------------------
const ONLINE_CONFIG = {
  CHAT_MAX_MSGS: 30,          // So tin nhan toi da hien thi trong khung chat
  LEADERBOARD_LIMIT: 20,       // So cao thu hien thi tren Bang Xep Hang
  MARKET_FEE_PCT: 0.05,        // Phi giao dich cho troi (5% = 0.05)
  WORLD_BOSS_NAME: "Độc Cô Cầu Bại (Siêu Trùm)", // Ten Trum The Gioi
  WORLD_BOSS_BASE_HP: 50000000,// Mau goc cua Trum The Gioi (50 Trieu HP)
};

// --------------------------------------------------------------------------
// 🛡️ BỘ LỌC TỪ CẤM & CHỐNG LÁCH LUẬT CHAT
// --------------------------------------------------------------------------
const BAD_WORDS = [
  'dm', 'dma', 'dmm', 'dcm', 'vcl', 'cl', 'cc', 'vl', 'loz', 'lozz',
  'lon', 'cac', 'buoi', 'đm', 'đmá', 'đcl', 'đcm', 'đãm', 'đái', 'địt', 'vkl'
];

const LEET_MAP = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's'
};

function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[0134578@$]/g, m => LEET_MAP[m] || m);
}

function hasProfanity(text) {
  const cleanStr = normalizeText(text).replace(/[\W_]/g, '');
  return BAD_WORDS.some(word => cleanStr.includes(normalizeText(word)));
}

function filterProfanity(text) {
  let filteredText = text;
  BAD_WORDS.forEach(word => {
    const pattern = word
      .split('')
      .map(char => {
        if (char === 'd' || char === 'đ') return '[dđ4]';
        if (char === 'a' || char === 'á' || char === 'à') return '[aáà4@]';
        if (char === 'o' || char === 'ò' || char === 'ó') return '[oóò0]';
        if (char === 'i' || char === 'í') return '[ií1]';
        if (char === 'e' || char === 'é') return '[eé3]';
        return char;
      })
      .join('[\\s\\._\\-\\*\+\\=]*');

    const regex = new RegExp(pattern, 'gi');
    filteredText = filteredText.replace(regex, '***');
  });
  return filteredText;
}

// --------------------------------------------------------------------------
// 🖐️ XỬ LÝ KÉO THẢ KHUNG CHAT (DRAG & DROP)
// --------------------------------------------------------------------------
function enableDraggableChat(chatEl, handleEl) {
  if (!chatEl) return;
  const dragHandle = handleEl || chatEl;
  
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  dragHandle.style.cursor = 'move';
  dragHandle.style.userSelect = 'none';

  // Sự kiện Chuột (PC)
  dragHandle.onmousedown = (e) => {
    if (['INPUT', 'BUTTON', 'TEXTAREA'].includes(e.target.tagName)) return;
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDrag;
    document.onmousemove = mouseMove;
  };

  function mouseMove(e) {
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;

    chatEl.style.position = 'fixed';
    chatEl.style.top = (chatEl.offsetTop - pos2) + "px";
    chatEl.style.left = (chatEl.offsetLeft - pos1) + "px";
    chatEl.style.bottom = 'auto';
    chatEl.style.right = 'auto';
  }

  function closeDrag() {
    document.onmouseup = null;
    document.onmousemove = null;
  }

  // Sự kiện Cảm ứng (Điện thoại / Máy tính bảng)
  dragHandle.ontouchstart = (e) => {
    if (['INPUT', 'BUTTON', 'TEXTAREA'].includes(e.target.tagName)) return;
    const touch = e.touches[0];
    pos3 = touch.clientX;
    pos4 = touch.clientY;
    document.ontouchend = closeTouch;
    document.ontouchmove = touchMove;
  };

  function touchMove(e) {
    const touch = e.touches[0];
    pos1 = pos3 - touch.clientX;
    pos2 = pos4 - touch.clientY;
    pos3 = touch.clientX;
    pos4 = touch.clientY;

    chatEl.style.position = 'fixed';
    chatEl.style.top = (chatEl.offsetTop - pos2) + "px";
    chatEl.style.left = (chatEl.offsetLeft - pos1) + "px";
    chatEl.style.bottom = 'auto';
    chatEl.style.right = 'auto';
  }

  function closeTouch() {
    document.ontouchend = null;
    document.ontouchmove = null;
  }
}

// --------------------------------------------------------------------------
// 1. KENH CHAT THE GIOI (REALTIME WORLD CHAT WITH UNREAD BADGE)
// --------------------------------------------------------------------------
let isInitialChatLoad = true;

function initWorldChat(db) {
  const chatRef = db.ref('world_chat');

  // Tu dong tao khung chat tren giao dien neu chua co
  if (!document.getElementById('chatBoxContainer')) {
    const chatHtml = `
      <div id="chatBoxContainer" class="chat-container">
        <div id="chatBoxHeader" class="chat-header" onclick="toggleChatBox()" style="cursor:pointer;">
          <span>💬 Chat Thế Giới <span id="chatUnreadBadge" style="display:none; background:#ff4d4f; color:#ffffff; font-size:10px; font-weight:bold; padding:2px 6px; border-radius:10px; margin-left:6px; animation: pulse 1s infinite;">🔴 Mới</span></span>
          <button id="chatToggleBtn" onclick="event.stopPropagation(); toggleChatBox()">➖</button>
        </div>
        <div id="chatMessages" class="chat-messages"></div>
        <div class="chat-input-row">
          <input type="text" id="chatInput" placeholder="Nhập tin nhắn..." maxlength="100" onkeypress="if(event.key==='Enter') sendChatMessage()">
          <button onclick="sendChatMessage()">Gửi</button>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', chatHtml);
  }

  // Kích hoạt tính năng kéo thả di dời khung chat
  const chatContainer = document.getElementById('chatBoxContainer');
  const chatHeader = document.getElementById('chatBoxHeader');
  if (chatContainer) {
    enableDraggableChat(chatContainer, chatHeader || chatContainer);
  }

  // Lang nghe tin nhan moi tu Firebase
  chatRef.limitToLast(ONLINE_CONFIG.CHAT_MAX_MSGS).on('value', (snap) => {
    const msgsEl = document.getElementById('chatMessages');
    const badgeEl = document.getElementById('chatUnreadBadge');
    if (!msgsEl) return;
    
    // Nếu khung chat đang thu gọn và không phải lần tải đầu tiên -> Hiện chấm đỏ báo tin nhắn mới
    const isHidden = msgsEl.style.display === 'none';
    if (isHidden && !isInitialChatLoad && badgeEl) {
      badgeEl.style.display = 'inline-block';
    }
    isInitialChatLoad = false;

    msgsEl.innerHTML = '';
    snap.forEach((child) => {
      const msg = child.val();
      const div = document.createElement('div');
      div.className = 'chat-msg';
      div.innerHTML = `<span class="c-fac">[${msg.fac || 'Võ Lâm'}]</span> <b class="c-name">${esc(msg.sender)}</b> <small>(Lv.${msg.lvl}):</small> <span class="c-text">${esc(msg.text)}</span>`;
      msgsEl.appendChild(div);
    });
    msgsEl.scrollTop = msgsEl.scrollHeight; // Tu dong cuon xuong cuoi
  });
}

function sendChatMessage() {
  const input = document.getElementById('chatInput');
  let text = input ? input.value.trim() : '';
  if (!text || typeof S === 'undefined' || !S.fac) return;

  // 🛡️ Kiểm tra & Tự động lọc từ nói bậy trước khi gửi
  if (hasProfanity(text)) {
    text = filterProfanity(text);
    if (typeof toast === 'function') {
      toast('Nội dung đã được lọc từ ngữ không phù hợp!');
    }
  }

  const db = firebase.database();
  db.ref('world_chat').push({
    sender: S.name || (FAC[S.fac] && FAC[S.fac].n) || 'Thiếu Hiệp',
    fac: FAC[S.fac] ? FAC[S.fac].n : 'Giang Hồ',
    lvl: S.lvl || 1,
    text: text,
    time: Date.now()
  });

  input.value = '';
}

function toggleChatBox() {
  const msgs = document.getElementById('chatMessages');
  const inputRow = document.querySelector('.chat-input-row');
  const btn = document.getElementById('chatToggleBtn');
  const badgeEl = document.getElementById('chatUnreadBadge');
  const isHidden = msgs.style.display === 'none';
  
  msgs.style.display = isHidden ? 'block' : 'none';
  inputRow.style.display = isHidden ? 'flex' : 'none';
  btn.innerText = isHidden ? '➖' : '➕';

  // Khi mở khung chat ra thì ẩn chấm đỏ thông báo
  if (isHidden && badgeEl) {
    badgeEl.style.display = 'none';
  }
}

// --------------------------------------------------------------------------
// 2. BANG XEP HANG REALTIME (LEADERBOARD)
// --------------------------------------------------------------------------
function syncLeaderboard() {
  if (typeof S === 'undefined' || !S.fac || typeof R === 'undefined') return;
  const db = firebase.database();
  const uid = S.uid || (S.fac + '_' + S.lvl);

  db.ref('leaderboard/' + uid).set({
    name: S.name || FAC[S.fac].n,
    fac: FAC[S.fac] ? FAC[S.fac].n : 'Võ Lâm',
    lvl: S.lvl || 1,
    power: R.power || 0,
    stage: S.stage || 1,
    updatedAt: Date.now()
  });
}

function openLeaderboardModal() {
  const db = firebase.database();
  db.ref('leaderboard').orderByChild('power').limitToLast(ONLINE_CONFIG.LEADERBOARD_LIMIT).once('value', (snap) => {
    let list = [];
    snap.forEach(child => { list.push(child.val()); });
    list.reverse(); // Sap xep tu Cao den Thap

    let rowsHtml = list.map((p, idx) => `
      <div class="qrow">
        <span><b>Top ${idx + 1}. ${esc(p.name)}</b> <small>(${esc(p.fac)} · Cấp ${p.lvl})</small></span>
        <small class="up">Lực chiến: ${fmt(p.power)}</small>
      </div>
    `).join('') || '<div class="dim">Chưa có dữ liệu cao thủ</div>';

    modal(`<h3>🏆 Bảng Xếp Hạng Cao Thủ</h3><div class="shoplist">${rowsHtml}</div>`, null);
  });
}

// --------------------------------------------------------------------------
// 3. CHO TROI GIAO DICH (PLAYER MARKETPLACE)
// --------------------------------------------------------------------------
function openMarketModal() {
  const db = firebase.database();
  db.ref('market_items').limitToLast(40).once('value', (snap) => {
    let items = [];
    snap.forEach(child => { items.push({ id: child.key, ...child.val() }); });

    let marketHtml = items.map(m => `
      <div class="shoprow">
        <div class="it r${m.item.r}">${m.item.ic ? `<img src="${esc(m.item.ic)}">` : ''}</div>
        <div>
          <b style="color:${RAR_COL[m.item.r]}">${esc(m.item.n)}</b> <small>Cấp ${m.item.lvl}</small>
          <small class="dim">Người bán: ${esc(m.seller)}</small>
        </div>
        <div>
          <em>💰 ${fmt(m.price)} lượng</em>
          <button class="btn sm" onclick="buyMarketItem('${m.id}', ${m.price})">Mua</button>
        </div>
      </div>
    `).join('') || '<div class="dim">Chợ trời hiện chưa có vật phẩm nào bán</div>';

    modal(`
      <h3>🏪 Chợ Trời Giang Hồ 
        <button class="btn sm" onclick="openSellItemModal()">+ Đăng Bán Đồ</button>
      </h3>
      <div class="shoplist">${marketHtml}</div>
    `, null);
  });
}

function openSellItemModal() {
  if (!S || !S.inv.length) { toast('Hành trang không có đồ'); return; }
  let options = S.inv.map((it, idx) => `<option value="${idx}">${esc(it.n)} (Cấp ${it.lvl})</option>`).join('');

  modal(`
    <h3>Treo Đồ Lên Chợ Trời</h3>
    <p class="desc">Phí sàn giao dịch: ${ONLINE_CONFIG.MARKET_FEE_PCT * 100}%</p>
    <div class="row" style="margin-bottom:8px;">
      <select id="marketSellSelect">${options}</select>
    </div>
    <div class="row">
      <input type="number" id="marketPriceInput" placeholder="Nhập giá bán (lượng)" min="1000">
    </div>
    <div class="btnrow">
      <button class="btn" onclick="confirmSellMarketItem()">Đăng Bán</button>
    </div>
  `, null);
}

function confirmSellMarketItem() {
  const idx = +document.getElementById('marketSellSelect').value;
  const price = +document.getElementById('marketPriceInput').value;
  const it = S.inv[idx];

  if (!it || price <= 0) { toast('Giá bán không hợp lệ'); return; }

  const db = firebase.database();
  db.ref('market_items').push({
    seller: S.name || FAC[S.fac].n,
    price: price,
    item: it,
    createdAt: Date.now()
  }).then(() => {
    S.inv.splice(idx, 1); // Xoa khoi hanh trang
    invDirty = true;
    save();
    toast('Đã đăng bán ' + it.n);
    closeModal();
  });
}

function buyMarketItem(itemId, price) {
  if (S.gold < price) { toast('Không đủ ngân lượng'); return; }
  if (S.inv.length >= INV_MAX) { toast('Hành trang đã đầy'); return; }

  const db = firebase.database();
  const itemRef = db.ref('market_items/' + itemId);

  itemRef.once('value', (snap) => {
    const data = snap.val();
    if (!data) { toast('Vật phẩm đã bị người khác mua'); openMarketModal(); return; }

    S.gold -= price;
    S.inv.unshift(data.item);
    invDirty = true;
    save();

    itemRef.remove(); // Xoa khoi cho
    toast('Mua thành công ' + data.item.n);
    openMarketModal();
  });
}

// --------------------------------------------------------------------------
// 4. TRUM THE GIOI DANH CHUNG (REALTIME GLOBAL WORLD BOSS)
// --------------------------------------------------------------------------
function initWorldBossSync(db) {
  const bossRef = db.ref('world_boss');
  
  bossRef.once('value', (snap) => {
    if (!snap.exists()) {
      bossRef.set({
        name: ONLINE_CONFIG.WORLD_BOSS_NAME,
        hp: ONLINE_CONFIG.WORLD_BOSS_BASE_HP,
        maxHp: ONLINE_CONFIG.WORLD_BOSS_BASE_HP,
        active: true
      });
    }
  });
}

function attackWorldBoss(damage) {
  const db = firebase.database();
  const hpRef = db.ref('world_boss/hp');

  hpRef.transaction((currentHp) => {
    if (currentHp === null) return ONLINE_CONFIG.WORLD_BOSS_BASE_HP;
    return Math.max(0, currentHp - damage);
  }, (error, committed, snapshot) => {
    if (committed) {
      const newHp = snapshot.val();
      if (newHp <= 0) {
        toast('🎉 TRÙM THẾ GIỚI ĐÃ BỊ HẠ GỤC!');
        grant({ gold: 5000000, set: 1, fd: 50 }, 'Hạ Trùm Thế Giới');
        db.ref('world_boss').update({
          hp: ONLINE_CONFIG.WORLD_BOSS_BASE_HP,
          active: true
        });
      }
    }
  });
}

function openWorldBossModal() {
  const db = firebase.database();
  db.ref('world_boss').once('value', (snap) => {
    const b = snap.val() || { name: ONLINE_CONFIG.WORLD_BOSS_NAME, hp: ONLINE_CONFIG.WORLD_BOSS_BASE_HP, maxHp: ONLINE_CONFIG.WORLD_BOSS_BASE_HP };
    const pct = ((b.hp / b.maxHp) * 100).toFixed(1);

    modal(`
      <h3>💀 ${esc(b.name)}</h3>
      <p class="desc">Toàn server cùng tham gia đánh Trùm. Tất cả người chơi cùng rút máu của Boss!</p>
      <div class="card">
        <div class="bar hp" style="height:18px;"><i style="width:${pct}%"></i><span>${fmt(b.hp)} / ${fmt(b.maxHp)} (${pct}%)</span></div>
      </div>
      <div class="btnrow">
        <button class="btn red" onclick="strikeWorldBossOnce()">⚔ Khai Hỏa Tấn Công</button>
      </div>
    `, null);
  });
}

function strikeWorldBossOnce() {
  if (typeof R === 'undefined' || !R.P) return;
  const dmg = Math.round((R.P.main ? R.P.main.tot : 10000) * (1 + Math.random() * 0.5));
  attackWorldBoss(dmg);
  toast(`Gây ${fmt(dmg)} sát thương lên Trùm Thế Giới!`);
  setTimeout(openWorldBossModal, 600);
}

// Tự động gắn các nút Online vào Tab Khác (t-more) khi mở tab
document.addEventListener('DOMContentLoaded', () => {
  const checkInterval = setInterval(() => {
    const tMore = document.getElementById('t-more');
    if (tMore) {
      clearInterval(checkInterval);
      
      const onlineCard = document.createElement('div');
      onlineCard.className = 'card';
      onlineCard.style.marginTop = '8px';
      onlineCard.innerHTML = `
        <h4 style="color: var(--gold); margin-bottom: 6px;">🌐 TÍNH NĂNG ONLINE</h4>
        <div class="btnrow" style="display: flex; gap: 6px; flex-wrap: wrap;">
          <button class="btn" style="flex: 1; min-width: 80px;" onclick="openLeaderboardModal()">🏆 BXH</button>
          <button class="btn" style="flex: 1; min-width: 80px;" onclick="openMarketModal()">🏪 Chợ Trời</button>
          <button class="btn red" style="flex: 1; min-width: 80px;" onclick="openWorldBossModal()">💀 Trùm SV</button>
        </div>
      `;
      
      tMore.appendChild(onlineCard);
    }
  }, 500);
});