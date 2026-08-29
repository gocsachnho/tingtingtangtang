let stories = [];
let chapters = [];

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
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function storyCard(story) {
  const title = cleanVietnameseText(story.title || "");
  const author = cleanVietnameseText(story.author || "Đang cập nhật");
  const genre = cleanVietnameseText(story.genre || "Khác");

  return `
    <a class="card" href="story.html?id=${encodeURIComponent(story.id)}">
      <div class="cover">
        ${
          story.cover
            ? `<img src="${escapeHtml(story.cover)}" alt="${escapeHtml(title)}">`
            : escapeHtml(title)
        }
      </div>

      <div class="info">
        <h3>${escapeHtml(title)}</h3>
        <p class="meta">
          Tác giả: ${escapeHtml(author)}<br>
          Thể loại: ${escapeHtml(genre)}<br>
          Lượt xem: ${(story.views || 0).toLocaleString("vi-VN")}
        </p>
      </div>
    </a>
  `;
}

function chapterLabel(chapter) {
  const name = cleanVietnameseText(chapter.title || "").trim();

  return name
    ? `Chương ${chapter.chapter_order}: ${name}`
    : `Chương ${chapter.chapter_order}`;
}

function renderGrid(id, list) {
  const box = document.getElementById(id);
  if (!box) return;

  if (!list.length) {
    box.innerHTML = `<p class="meta">Chưa có truyện.</p>`;
    return;
  }

  box.innerHTML = list.slice(0, 4).map(storyCard).join("");
}

function renderLatestChapters() {
  const latest = [...chapters]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 12);

  const box = document.getElementById("latestChapters");
  if (!box) return;

  box.innerHTML = latest.map(chapter => {
    const story = stories.find(s => s.id === chapter.story_id);
    if (!story) return "";

    return `
      <li>
        <a href="${chapterUrl(chapter)}">
          <b>${escapeHtml(cleanVietnameseText(story.title || ""))}</b><br>
          ${escapeHtml(chapterLabel(chapter))}
        </a>
      </li>
    `;
  }).join("");
}

function renderHeroSlider() {
  const box = document.getElementById("heroSlider");
  if (!box) return;

  const latestChapters = [...chapters]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const usedStoryIds = new Set();
  const slides = [];

  for (const chapter of latestChapters) {
    const story = stories.find(s => s.id === chapter.story_id);
    if (!story) continue;
    if (usedStoryIds.has(story.id)) continue;

    usedStoryIds.add(story.id);
    slides.push({ story, chapter });

    if (slides.length >= 3) break;
  }

  if (!slides.length) {
    box.innerHTML = "";
    return;
  }

  box.innerHTML = `
    <div class="hero-track">
      ${slides.map(item => {
        const title = cleanVietnameseText(item.story.title || "");
        return `
        <a class="hero-slide" href="${chapterUrl(item.chapter)}">
          ${
            item.story.cover
              ? `
              <img class="hero-bg" src="${escapeHtml(item.story.cover)}" alt="${escapeHtml(title)}">
              <img class="hero-poster" src="${escapeHtml(item.story.cover)}" alt="${escapeHtml(title)}">
              `
              : ""
          }
          <div class="hero-slide-info">
            <span>Vừa cập nhật</span>
            <h2>${escapeHtml(title)}</h2>
            <p>${escapeHtml(chapterLabel(item.chapter))}</p>
          </div>
        </a>`;
      }).join("")}
    </div>

    <div class="hero-dots">
      ${slides.map((_, i) => `<span class="${i === 0 ? "active" : ""}"></span>`).join("")}
    </div>
  `;

  let index = 0;
  const track = box.querySelector(".hero-track");
  const dots = box.querySelectorAll(".hero-dots span");

  if (slides.length > 1) {
    setInterval(() => {
      index = (index + 1) % slides.length;
      track.style.transform = `translateX(-${index * 100}%)`;

      dots.forEach(dot => dot.classList.remove("active"));
      dots[index].classList.add("active");
    }, 3500);
  }
}

async function loadHome() {
  const storyResult = await db
    .from("stories")
    .select("*")
    .order("created_at", { ascending: false });

  let latestChapters = [];
  try {
    latestChapters = await ttttRpc("tttt_list_latest_chapters", { p_limit: 200 });
  } catch (err) {
    console.error("Chưa cài RPC thu phí:", err);
  }

  stories = storyResult.data || [];
  chapters = Array.isArray(latestChapters) ? latestChapters : [];

  const newest = [...stories].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const hot = [...stories].sort((a, b) => (b.views || 0) - (a.views || 0));

  const horror = hot.filter(s => (s.genre || "").toLowerCase().includes("linh"));
  const romance = hot.filter(s => (s.genre || "").toLowerCase().includes("ngôn"));
  const other = hot.filter(s => {
    const genre = (s.genre || "").toLowerCase();
    return !genre.includes("linh") && !genre.includes("ngôn");
  });

  renderHeroSlider();
  renderGrid("newStories", newest);
  renderGrid("hotStories", hot);
  renderGrid("horrorStories", horror);
  renderGrid("romanceStories", romance);
  renderGrid("otherStories", other);
  renderLatestChapters();
}

const searchInput = document.getElementById("searchInput");
if (searchInput) {
  searchInput.addEventListener("input", function () {
    const q = cleanVietnameseText(this.value).toLowerCase().trim();

    if (!q) {
      renderGrid("newStories", [...stories].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
      return;
    }

    const result = stories.filter(story =>
      cleanVietnameseText(story.title || "").toLowerCase().includes(q) ||
      cleanVietnameseText(story.author || "").toLowerCase().includes(q) ||
      cleanVietnameseText(story.genre || "").toLowerCase().includes(q)
    );

    renderGrid("newStories", result);
  });
}

loadHome();
