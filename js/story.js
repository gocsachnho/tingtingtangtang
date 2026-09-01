const params = new URLSearchParams(location.search);
const id = params.get("id");

const CHAPTERS_PER_PAGE = 50;

let allChapters = [];
let currentPage = 1;
let currentStory = null;

function cleanVietnameseText(text) {
  const value = String(text == null ? "" : text);
  return typeof window.normalizeVietnameseText === "function"
    ? window.normalizeVietnameseText(value)
    : value.normalize("NFC");
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatDescription(text) {
  return cleanVietnameseText(text)
    .replace(/\r/g, "")
    .replace(/\\n/g, "\n")
    .replace(/([.!?…])\s+/g, "$1\n\n")
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => `<p>${escapeHtml(line)}</p>`)
    .join("");
}

function chapterLabel(chapter) {
  const name = cleanVietnameseText(chapter.title || "").trim();
  return name
    ? `Chương ${chapter.chapter_order}: ${name}`
    : `Chương ${chapter.chapter_order}`;
}

function renderChapterPage(page) {
  currentPage = page;

  const totalPages = Math.ceil(allChapters.length / CHAPTERS_PER_PAGE);
  const start = (page - 1) * CHAPTERS_PER_PAGE;
  const end = start + CHAPTERS_PER_PAGE;
  const pageChapters = allChapters.slice(start, end);

  document.getElementById("chapterList").innerHTML = pageChapters.map(chapter => {
    const locked = !!chapter.is_locked;
    const rightText = locked
      ? `🔒 ${ttttFormatVND(chapter.price_vnd || 0)}`
      : "Đọc →";

    return `
      <a class="chapter-row ${locked ? "paid-chapter-row" : ""}" href="${chapterUrl(chapter)}">
        <span>${locked ? "🔒 " : ""}${escapeHtml(chapterLabel(chapter))}</span>
        <span>${rightText}</span>
      </a>
    `;
  }).join("");

  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const pagination = document.getElementById("pagination");

  if (totalPages <= 1) {
    pagination.innerHTML = "";
    return;
  }

  let html = `<div class="pagination">`;

  if (currentPage > 1) {
    html += `<button onclick="renderChapterPage(${currentPage - 1})">← Trước</button>`;
  }

  for (let i = 1; i <= totalPages; i++) {
    const showButton =
      i === 1 ||
      i === totalPages ||
      Math.abs(i - currentPage) <= 2;

    const showDotsBefore = i === currentPage - 3 && currentPage > 4;
    const showDotsAfter = i === currentPage + 3 && currentPage < totalPages - 3;

    if (showDotsBefore || showDotsAfter) html += `<span>...</span>`;

    if (showButton) {
      html += `
        <button class="${i === currentPage ? "active" : ""}"
          onclick="renderChapterPage(${i})">
          ${i}
        </button>
      `;
    }
  }

  if (currentPage < totalPages) {
    html += `<button onclick="renderChapterPage(${currentPage + 1})">Sau →</button>`;
  }

  html += `</div>`;
  pagination.innerHTML = html;
}

async function increaseView(story) {
  if (!story?.id) return Number(story?.views || 0);

  try {
    const { data, error } = await db.rpc("increment_story_views", {
      p_story_id: story.id
    });

    if (error) throw error;

    const newViews = Number(data);
    if (Number.isFinite(newViews)) {
      story.views = newViews;
      return newViews;
    }
  } catch (err) {
    console.error("Không tăng được lượt xem:", err);
  }

  return Number(story.views || 0);
}

async function loadRecommendations() {
  const box = document.getElementById("recommendList");
  if (!currentStory) return;

  const { data } = await db
    .from("stories")
    .select("*")
    .eq("genre", currentStory.genre)
    .neq("id", currentStory.id)
    .limit(12);

  const list = data || [];

  if (!list.length) {
    box.innerHTML = `<p class="meta">Chưa có truyện liên quan.</p>`;
    return;
  }

  box.innerHTML = list.map(story => {
    const title = cleanVietnameseText(story.title || "");
    const genre = cleanVietnameseText(story.genre || "");

    return `
      <a class="recommend-card" href="story.html?id=${encodeURIComponent(story.id)}">
        ${story.cover ? `<img src="${escapeHtml(story.cover)}" alt="${escapeHtml(title)}">` : ""}
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(genre)}</p>
      </a>
    `;
  }).join("");
}

async function loadStory() {
  try {
    const { data: story } = await db
      .from("stories")
      .select("*")
      .eq("id", id)
      .single();

    if (!story) {
      document.getElementById("storyDetail").innerHTML = "<p>Không tìm thấy truyện.</p>";
      return;
    }

    currentStory = story;
    const updatedViews = await increaseView(story);

    const unlockCode = ttttGetUnlockCode(story.id);
    const chapters = await ttttRpc("tttt_list_chapters", {
      p_story_id: story.id,
      p_unlock_code: unlockCode || null
    });

    allChapters = Array.isArray(chapters) ? chapters : [];

    const title = cleanVietnameseText(story.title || "");
    const author = cleanVietnameseText(story.author || "");
    const genre = cleanVietnameseText(story.genre || "");

    document.title = title;

    const hasPaid = allChapters.some(c => c.is_locked);
    const payInfo = hasPaid
      ? `<div class="story-pay-badge">🔒 Có chương trả phí</div>`
      : "";

    document.getElementById("storyDetail").innerHTML = `
      <div class="story-box">
        <div class="story-header-layout">
          <div class="story-left">
            ${story.cover ? `<img src="${escapeHtml(story.cover)}" alt="${escapeHtml(title)}">` : ""}
            <h1>${escapeHtml(title)}</h1>
            <p class="meta">
              Tác giả: ${escapeHtml(author)}<br>
              Thể loại: ${escapeHtml(genre)}<br>
              Lượt xem: ${Number(updatedViews || 0).toLocaleString("vi-VN")}
            </p>
            ${payInfo}
          </div>

          <div class="story-right">
            <div class="story-description">
              ${formatDescription(story.description || "")}
            </div>

            ${
              allChapters.length
                ? `<a class="read-first-btn" href="${chapterUrl(allChapters[0])}">Đọc từ đầu</a>`
                : ""
            }
          </div>
        </div>
      </div>
    `;

    renderChapterPage(1);
    loadRecommendations();
  } catch (err) {
    console.error(err);
    document.getElementById("storyDetail").innerHTML =
      `<p>Chưa cài hệ thống thu phí trong Supabase hoặc kết nối đang lỗi.</p>`;
  }
}

loadStory();
