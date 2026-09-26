const SUPABASE_URL = "https://mxapwgnjelysysnzgbyn.supabase.co";
const SUPABASE_KEY = "sb_publishable_I9XNHdeTuO9Pw9mOgPS3rA_JYFqvP-v";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const COVER_BUCKET = "covers";

function makeSlug(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") + "-" + Date.now();
}

function chapterUrl(chapter) {
  // QUAN TRỌNG:
  // shortlink chỉ là link affiliate (Shopee/TikTok), KHÔNG phải URL của chương.
  // Mọi liên kết chương luôn phải trỏ về chapter.html của website.
  if (!chapter) return "#";

  return `chapter.html?id=${encodeURIComponent(chapter.story_id)}&chapter=${encodeURIComponent(chapter.chapter_order)}`;
}