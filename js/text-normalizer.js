/*
 * Chuẩn hóa văn bản tiếng Việt dùng chung cho trang đọc và Admin.
 * - Chuẩn Unicode về NFC để dấu tiếng Việt bám đúng ký tự.
 * - Loại bỏ ký tự zero-width/BOM thường xuất hiện khi copy từ Word/PDF.
 * - Chuẩn hóa khoảng trắng đặc biệt.
 * - Sửa thận trọng các khoảng trắng bị chèn giữa một âm tiết tiếng Việt,
 *   ví dụ: "Hiế u" -> "Hiếu", "khắ p" -> "khắp", "đế n" -> "đến".
 */
(function (global) {
  "use strict";

  const VIETNAMESE_MARKED_RE = /[ăâêôơưđĂÂÊÔƠƯĐàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/;
  const LETTER_RE = /^[A-Za-zÀ-ỹĐđ]+$/u;
  const FINAL_CONSONANTS = new Set(["c", "ch", "m", "n", "ng", "nh", "p", "t"]);
  const FINAL_VOWELS = new Set(["a", "e", "i", "o", "u", "y"]);

  function removeToneMarksKeepVowelQuality(text) {
    return String(text || "")
      .normalize("NFD")
      // Chỉ bỏ 5 dấu thanh + dấu nặng; giữ dấu cấu tạo chữ (ă, â, ê, ô, ơ, ư)
      .replace(/[\u0300\u0301\u0303\u0309\u0323]/g, "")
      .normalize("NFC")
      .toLowerCase();
  }

  function countToneMarks(text) {
    const nfd = String(text || "").normalize("NFD");
    const matches = nfd.match(/[\u0300\u0301\u0303\u0309\u0323]/g);
    return matches ? matches.length : 0;
  }

  function stripVietnamese(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d");
  }

  function looksLikeVietnameseSyllable(word) {
    if (!word || word.length < 2 || word.length > 9 || !LETTER_RE.test(word)) return false;
    if (countToneMarks(word) > 1) return false;

    const ascii = stripVietnamese(word);

    // Một âm tiết tiếng Việt phải có nguyên âm và không có cụm phụ âm lạ ở cuối.
    // Regex này cố ý tương đối rộng nhưng vẫn loại được phần lớn trường hợp nối nhầm hai từ.
    return /^(?:(?:ngh|ng|ch|gh|kh|nh|ph|th|tr)|[bcdghklmnpqrstvx])?[aeiouy]{1,4}(?:ch|ng|nh|[cmnpt])?$/.test(ascii);
  }

  function shouldJoinFragments(left, right) {
    if (!left || !right || !LETTER_RE.test(left) || !LETTER_RE.test(right)) return false;

    const r = removeToneMarksKeepVowelQuality(right);
    const rightIsFinalConsonant = FINAL_CONSONANTS.has(r);
    const rightIsFinalVowel = FINAL_VOWELS.has(r);

    if (!rightIsFinalConsonant && !rightIsFinalVowel) return false;

    // Với phần cuối là nguyên âm, chỉ nối khi vế trái có dấu tiếng Việt.
    // Điều này tránh ghép nhầm các từ bình thường đứng cạnh nhau.
    if (rightIsFinalVowel && !VIETNAMESE_MARKED_RE.test(left)) return false;

    const joined = (left + right).normalize("NFC");
    return looksLikeVietnameseSyllable(joined);
  }

  function repairBrokenVietnameseSpaces(text) {
    let value = String(text || "");

    // Trường hợp phần cuối "ng/nh/ch" cũng bị tách làm hai mảnh: "khô n g".
    value = value.replace(/([A-Za-zÀ-ỹĐđ]+)[ \t]+(n|c)[ \t]+(g|h)\b/giu, (match, left, a, b) => {
      const right = (a + b).toLowerCase();
      return shouldJoinFragments(left, right) ? left + a + b : match;
    });

    // Dùng look-ahead để kiểm tra MỌI ranh giới giữa hai mảnh chữ mà không
    // "nuốt" từ phía sau; nhờ vậy các lỗi liên tiếp đều được phát hiện.
    for (let pass = 0; pass < 4; pass++) {
      let changed = false;
      value = value.replace(/([A-Za-zÀ-ỹĐđ]+)([ \t]+)(?=([A-Za-zÀ-ỹĐđ]+))/gu, (match, left, spaces, right) => {
        if (shouldJoinFragments(left, right)) {
          changed = true;
          return left;
        }
        return match;
      });
      if (!changed) break;
    }

    return value;
  }

  function normalizeVietnameseText(input, options) {
    const opts = Object.assign({ repairSpacing: true }, options || {});

    let value = String(input == null ? "" : input)
      .replace(/\r\n?/g, "\n")
      .replace(/[\u00A0\u202F]/g, " ")
      .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
      // Nếu dấu tổ hợp bị một khoảng trắng chen vào sau chữ cái, kéo dấu về lại ký tự.
      .replace(/([A-Za-zÀ-ỹĐđ])[ \t]+([\u0300-\u036f])/gu, "$1$2")
      .normalize("NFC")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/[ \t]{2,}/g, " ");

    if (opts.repairSpacing) {
      value = repairBrokenVietnameseSpaces(value);
    }

    return value.normalize("NFC");
  }

  global.normalizeVietnameseText = normalizeVietnameseText;
  global.repairBrokenVietnameseSpaces = repairBrokenVietnameseSpaces;
})(window);
