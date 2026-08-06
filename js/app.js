let stories = [];
let chapters = [];
let heroTimer = null;

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function storyCard(story) {
  const title = escapeHtml(story.title);
  const cover = story.cover
    ? `<img src="${escapeHtml(story.cover)}" alt="${title}" loading="lazy" decoding="async">`
    : title;

  return `
    <a class="card" href="story.html?id=${encodeURIComponent(story.id)}">
      <div class="cover">${cover}</div>
      <div class="info">
        <h3>${title}</h3>
        <p class="meta">
          Tác giả: ${escapeHtml(story.author || "Đang cập nhật")}<br>
          Thể loại: ${escapeHtml(story.genre || "Khác")}<br>
          Lượt xem: ${Number(story.views || 0).toLocaleString("vi-VN")}
        </p>
      </div>
    </a>`;
}

function chapterLabel(chapter) {
  const name = chapter.title?.trim();
  return name
    ? `Chương ${chapter.chapter_order}: ${escapeHtml(name)}`
    : `Chương ${chapter.chapter_order}`;
}

function renderGrid(id, list) {
  const box = document.getElementById(id);
  if (!box) return;
  box.innerHTML = list.length
    ? list.slice(0, 4).map(storyCard).join("")
    : `<p class="meta">Chưa có truyện.</p>`;
}

function renderAllSections() {
  const newest = [...stories].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const hot = [...stories].sort((a, b) => Number(b.views || 0) - Number(a.views || 0));
  const horror = hot.filter(s => (s.genre || "").toLowerCase().includes("linh"));
  const romance = hot.filter(s => (s.genre || "").toLowerCase().includes("ngôn"));
  const other = hot.filter(s => {
    const genre = (s.genre || "").toLowerCase();
    return !genre.includes("linh") && !genre.includes("ngôn");
  });

  renderGrid("newStories", newest);
  renderGrid("hotStories", hot);
  renderGrid("horrorStories", horror);
  renderGrid("romanceStories", romance);
  renderGrid("otherStories", other);
}

function renderLatestChapters() {
  const box = document.getElementById("latestChapters");
  if (!box) return;

  const storyMap = new Map(stories.map(story => [story.id, story]));
  box.innerHTML = chapters.slice(0, 12).map(chapter => {
    const story = storyMap.get(chapter.story_id);
    if (!story) return "";
    return `<li><a href="${escapeHtml(chapterUrl(chapter))}"><b>${escapeHtml(story.title)}</b><br>${chapterLabel(chapter)}</a></li>`;
  }).join("");
}

function renderHeroSlider() {
  const box = document.getElementById("heroSlider");
  if (!box) return;
  if (heroTimer) clearInterval(heroTimer);

  const storyMap = new Map(stories.map(story => [story.id, story]));
  const used = new Set();
  const slides = [];

  for (const chapter of chapters) {
    const story = storyMap.get(chapter.story_id);
    if (!story || used.has(story.id)) continue;
    used.add(story.id);
    slides.push({ story, chapter });
    if (slides.length === 3) break;
  }

  if (!slides.length) {
    box.innerHTML = "";
    return;
  }

  box.innerHTML = `
    <div class="hero-track">
      ${slides.map(({ story, chapter }, index) => {
        const title = escapeHtml(story.title);
        const images = story.cover ? `
          <img class="hero-bg" src="${escapeHtml(story.cover)}" alt="" ${index ? 'loading="lazy"' : ''} decoding="async">
          <img class="hero-poster" src="${escapeHtml(story.cover)}" alt="${title}" ${index ? 'loading="lazy"' : ''} decoding="async">` : "";
        return `<a class="hero-slide" href="${escapeHtml(chapterUrl(chapter))}">${images}<div class="hero-slide-info"><span>Vừa cập nhật</span><h2>${title}</h2><p>${chapterLabel(chapter)}</p></div></a>`;
      }).join("")}
    </div>
    <div class="hero-dots">${slides.map((_, i) => `<span class="${i === 0 ? "active" : ""}"></span>`).join("")}</div>`;

  if (slides.length < 2) return;
  let index = 0;
  const track = box.querySelector(".hero-track");
  const dots = box.querySelectorAll(".hero-dots span");
  heroTimer = setInterval(() => {
    index = (index + 1) % slides.length;
    track.style.transform = `translateX(-${index * 100}%)`;
    dots.forEach((dot, i) => dot.classList.toggle("active", i === index));
  }, 4500);
}

async function loadHome() {
  const [storyResult, chapterResult] = await Promise.all([
    db.from("stories")
      .select("id,title,author,genre,cover,views,created_at")
      .order("created_at", { ascending: false }),
    db.from("chapters")
      .select("id,story_id,chapter_order,title,shortlink,created_at")
      .order("created_at", { ascending: false })
      .limit(100)
  ]);

  if (storyResult.error || chapterResult.error) {
    console.error("Không tải được trang chủ:", storyResult.error || chapterResult.error);
  }

  stories = storyResult.data || [];
  chapters = chapterResult.data || [];
  renderHeroSlider();
  renderAllSections();
  renderLatestChapters();
}

const searchInput = document.getElementById("searchInput");
searchInput?.addEventListener("input", function () {
  const q = this.value.toLocaleLowerCase("vi").trim();
  if (!q) {
    renderAllSections();
    return;
  }

  const result = stories.filter(story =>
    [story.title, story.author, story.genre]
      .some(value => String(value || "").toLocaleLowerCase("vi").includes(q))
  );
  renderGrid("newStories", result);
});

loadHome();
