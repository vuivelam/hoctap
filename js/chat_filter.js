/* ======================= BỘ LỌC CHAT NÓI BẬY ======================= */
'use strict';

// 1. Danh sách từ cấm (Từ đơn và cụm từ)
const BAD_WORDS = [
  'dm', 'dma', 'dmm', 'dcm', 'vcl', 'cl', 'cc', 'vl', 'loz', 'lozz',
  'lon', 'cac', 'buoi', 'đm', 'đmá', 'đcl', 'đcm', 'đãm', 'đái', 'địt'
  // Bổ sung danh sách từ cấm tùy thuộc vào ứng dụng của bạn
];

// Bảng ánh xạ ký tự teencode / leetspeak thay thế số thành chữ
const LEET_MAP = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's'
};

/**
 * Bước 1: Chuẩn hóa chuỗi văn bản (Bỏ dấu tiếng Việt, chuyển teencode về chữ thường)
 */
function normalizeText(text) {
  return text
    .toLowerCase()
    // Chuyển tiếng Việt có dấu thành không dấu (ví dụ: đ -> d, á -> a)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    // Chuyển ký tự Leetspeak/Teencode về chữ thường (ví dụ: d4m4 -> dama)
    .replace(/[0134578@$]/g, m => LEET_MAP[m] || m);
}

/**
 * Bước 2: Kiểm tra xem đoạn chat có chứa từ bậy hay không
 */
function hasProfanity(text) {
  // Loại bỏ toàn bộ khoảng trắng và ký tự đặc biệt để check lách luật (d.m.a, d_m_a, d m a)
  const cleanStr = normalizeText(text).replace(/[\W_]/g, '');
  
  return BAD_WORDS.some(word => {
    const normWord = normalizeText(word);
    return cleanStr.includes(normWord);
  });
}

/**
 * Bước 3: Thay thế các từ cấm thành ký tự ẩn '***'
 */
function filterProfanity(text) {
  let filteredText = text;

  BAD_WORDS.forEach(word => {
    // Tạo Regex hỗ trợ bắt từ bất chấp người dùng chèn dấu chấm/khoảng trắng giữa các chữ
    // Ví dụ: từ "dm" sẽ bắt được cả "d.m", "d_m", "d m", "d...m"
    const pattern = word
      .split('')
      .map(char => {
        // Tương thích cả ký tự có dấu và không dấu
        if (char === 'd' || char === 'đ') return '[dđ4]';
        if (char === 'a' || char === 'á' || char === 'à') return '[aáà4@]';
        if (char === 'o' || char === 'ò' || char === 'ó') return '[oóò0]';
        if (char === 'i' || char === 'í') return '[ií1]';
        if (char === 'e' || char === 'é') return '[eé3]';
        return char;
      })
      .join('[\\s\\._\\-\\*\+\\=]*'); // Cho phép các ký tự phân cách ở giữa

    const regex = new RegExp(pattern, 'gi');
    filteredText = filteredText.replace(regex, '***');
  });

  return filteredText;
}