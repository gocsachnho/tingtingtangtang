/* Ting Ting Tang Tang - helpers cho chương trả phí, không cần tài khoản */

function ttttFormatVND(value) {
  const n = Number(value || 0);
  return n.toLocaleString("vi-VN") + "đ";
}


function ttttNormalizeAccessCode(code) {
  return String(code || "")
    .trim()
    .toUpperCase()
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/\s+/g, "");
}

function ttttUnlockKey(storyId) {
  return `tttt_unlock_${storyId}`;
}

function ttttPaymentKey(storyId) {
  return `tttt_payment_${storyId}`;
}

function ttttGetUnlockCode(storyId) {
  return ttttNormalizeAccessCode(localStorage.getItem(ttttUnlockKey(storyId)) || "");
}

function ttttSaveUnlockCode(storyId, code) {
  const clean = ttttNormalizeAccessCode(code);
  if (clean) localStorage.setItem(ttttUnlockKey(storyId), clean);
  return clean;
}

function ttttGetPaymentDraft(storyId) {
  try {
    const raw = localStorage.getItem(ttttPaymentKey(storyId));
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function ttttSavePaymentDraft(storyId, value) {
  localStorage.setItem(ttttPaymentKey(storyId), JSON.stringify(value));
}

function ttttClearPaymentDraft(storyId) {
  localStorage.removeItem(ttttPaymentKey(storyId));
}

async function ttttRpc(name, args = {}) {
  const { data, error } = await db.rpc(name, args);
  if (error) throw error;
  return data;
}

async function ttttCopy(text, button) {
  try {
    await navigator.clipboard.writeText(String(text || ""));
    if (button) {
      const old = button.textContent;
      button.textContent = "Đã sao chép";
      setTimeout(() => button.textContent = old, 1200);
    }
  } catch (_) {
    window.prompt("Sao chép nội dung này:", String(text || ""));
  }
}
