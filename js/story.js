const params = new URLSearchParams(location.search);
const id = params.get("id");

const CHAPTERS_PER_PAGE = 50;

let allChapters = [];
let currentPage = 1;
let currentStory = null;

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatDescription(text) {
  return String(text || "")
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
  const name = chapter.title && chapter.title.trim();

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

  document.getElementById("chapterList").innerHTML = pageChapters.map(chapter => `
    <a class="chapter-row" href="${chapterUrl(chapter)}">
      <span>${chapterLabel(chapter)}</span>
      <span>${chapter.shortlink ? "Qua link →" : "Đọc →"}</span>
    </a>
  `).join("");

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

    const showDotsBefore =
      i === currentPage - 3 &&
      currentPage > 4;

    const showDotsAfter =
      i === currentPage + 3 &&
      currentPage < totalPages - 3;

    if (showDotsBefore || showDotsAfter) {
      html += `<span>...</span>`;
    }

    if (showButton) {
      html += `
        <button
          class="${i === currentPage ? "active" : ""}"
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

async function loadRecommendations() {
  const box = document.getElementById("recommendList");

  if (!currentStory) {
    box.innerHTML = "";
    return;
  }

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

  box.innerHTML = list.map(story => `
    <a class="recommend-card" href="story.html?id=${story.id}">
      ${
        story.cover
          ? `<img src="${story.cover}" alt="${escapeHtml(story.title)}">`
          : `<div class="recommend-cover">${escapeHtml(story.title)}</div>`
      }
      <h3>${escapeHtml(story.title)}</h3>
      <p>${escapeHtml(story.genre || "")}</p>
    </a>
  `).join("");
}

async function loadStory() {
  const { data: story, error: storyError } = await db
    .from("stories")
    .select("*")
    .eq("id", id)
    .single();

  if (storyError || !story) {
    document.getElementById("storyDetail").innerHTML = "<p>Không tìm thấy truyện.</p>";
    return;
  }

  currentStory = story;

  const { data: chapters } = await db
    .from("chapters")
    .select("*")
    .eq("story_id", story.id)
    .order("chapter_order", { ascending: true });

  allChapters = chapters || [];

  document.title = story.title;

  document.getElementById("storyDetail").innerHTML = `
    <div class="story-box">
      <div class="story-header-layout">
        <div class="story-left">
          ${
            story.cover
              ? `<img src="${story.cover}" alt="${escapeHtml(story.title)}">`
              : ""
          }

          <h1>${escapeHtml(story.title)}</h1>

          <p class="meta">
            Tác giả: ${escapeHtml(story.author || "")}<br>
            Thể loại: ${escapeHtml(story.genre || "")}
          </p>
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
}

loadStory();