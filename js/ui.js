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
        ${GAME_SPEEDS.map(v => `
          <button class="btn ${Math.abs(v - cur) < 0.0001 ? 'on' : ''}" data-speed="${v}">x${v}</button>
        `).join('')}
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
