/* ==========================================================================
   HE THONG TINH TOAN & HIEN THI ALL OPTION TRANG BI (TICH HOP STATS.JS & S.eq)
   ========================================================================== */
'use strict';

/**
 * Lấy toàn bộ thuộc tính trang bị đã tính toán từ stats.js hoặc quét trực tiếp S.eq
 */
function getEquippedAllStats() {
  const totalStats = {};

  // 1. Ưu tiên: Sử dụng hàm calc() có sẵn của stats.js (đã tính đủ cường hóa, dòng ẩn, kích bộ)
  if (typeof calc === 'function' && typeof S !== 'undefined' && S.eq) {
    try {
      const P = calc(S.eq);
      if (P && P.A) {
        for (const key in P.A) {
          const valArr = P.A[key];
          if (Array.isArray(valArr) && valArr[0]) {
            totalStats[key] = valArr[0]; // Lấy giá trị tổng cộng dồn v1
          }
        }
        console.log('[CustomStats] Lấy dữ liệu thành công từ calc(S.eq):', totalStats);
        return totalStats;
      }
    } catch (e) {
      console.warn('[CustomStats] Lỗi khi gọi calc():', e);
    }
  }

  // 2. Dự phòng: Quét trực tiếp mảng S.eq nếu calc() chưa sẵn sàng
  const eq = (typeof S !== 'undefined' && S.eq) ? S.eq : {};
  console.log('[CustomStats] Quét trực tiếp S.eq:', eq);

  for (const slot in eq) {
    const item = eq[slot];
    if (!item || !Array.isArray(item.mag)) continue;

    const act = (typeof hiddenActive === 'function') ? hiddenActive(item, eq) : 3;

    item.mag.forEach((m, idx) => {
      if (!m) return;
      // Kiểm tra mở dòng ẩn (mở theo cặp 2 dòng)
      if (idx % 2 !== 0 && Math.floor(idx / 2) >= act) return;

      // Đổi ID thuộc tính m.a thành chuỗi key qua attrName
      let key = '';
      if (m.a !== undefined && typeof attrName === 'function') {
        key = attrName(m.a);
      } else {
        key = m.key || m.k || (Array.isArray(m) ? m[0] : '');
      }

      // Lấy giá trị chỉ số từ m.p[0]
      let val = 0;
      if (Array.isArray(m.p)) {
        val = Number(m.p[0] || 0);
      } else if (typeof m === 'object') {
        val = Number(m.v || m.v1 || m.value1 || (Array.isArray(m) ? m[1] : 0));
      }

      if (key && !isNaN(val) && val !== 0) {
        totalStats[key] = (totalStats[key] || 0) + val;
      }
    });
  }

  return totalStats;
}

/**
 * Render Modal hiển thị bảng thuộc tính
 */
window.renderNewPowerModal = function() {
  const stats = getEquippedAllStats();
  let optHtml = '';
  let hasOpt = false;

  for (const key in stats) {
    const val = stats[key];
    if (!val) continue;

    let desc = '';
    
    // Đọc mô tả từ JX.attrDesc trong data.js
    if (window.JX && window.JX.attrDesc && window.JX.attrDesc[key]) {
      desc = window.JX.attrDesc[key]
        .replace(/#d1\+/g, val > 0 ? `+${val}` : val)
        .replace(/#d1\-/g, val)
        .replace(/#d1/g, val)
        .replace(/#f1\-/g, (val / 18).toFixed(1))
        .replace(/<color=orange>/g, '<span style="color:#ff9900;">')
        .replace(/<color=blue>/g, '<span style="color:#00ccff;">')
        .replace(/<color>/g, '</span>')
        .replace(/<enter>/g, '<br/>');
    } else {
      desc = `<span>${key}</span>: <b style="color:#6ef76e;">+${val}</b>`;
    }

    optHtml += `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.08);">
        <span style="color:#e0e0e0; text-align:left;">${desc}</span>
      </div>
    `;
    hasOpt = true;
  }

  if (!hasOpt) {
    optHtml = `
      <div style="text-align:center; color:#aaa; padding:20px 10px; line-height:1.6;">
        <p style="color:#ffcc00; font-weight:bold; margin-bottom:8px;">⚠️ Chưa có thuộc tính trang bị!</p>
        <p style="font-size:12px;">Hãy chắc chắn bạn đã mặc trang bị lên nhân vật.</p>
      </div>
    `;
  }

  const html = `
    <h3 style="color:var(--gold); text-align:center; margin-bottom:10px;">📊 TỔNG THUỘC TÍNH TRANG BỊ</h3>
    <div class="card stats" style="max-height: 55vh; overflow-y: auto; font-size: 13px; padding: 10px; background: rgba(0,0,0,0.3);">
      ${optHtml}
    </div>
    <div class="btnrow" style="margin-top:10px;">
      <button class="btn" onclick="closeModal()">Đóng</button>
    </div>
  `;

  if (typeof modal === 'function') {
    modal(html, null);
  }
};

/**
 * Lắng nghe sự kiện click nút #bPower
 */
document.addEventListener('click', function(e) {
  const btn = e.target.closest('#bPower');
  if (btn) {
    e.preventDefault();
    e.stopPropagation();
    window.renderNewPowerModal();
  }
}, true);