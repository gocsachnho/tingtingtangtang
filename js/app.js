let stories = [];
let chapters = [];
let heroTimer = null;
let activeSearchIndex = -1;
let visibleSearchResults = [];

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeText(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function storyCard(story) {
  const title = escapeHtml(story.title);
  const cover = story.cover
    ? `<img src="${escapeHtml(story.cover)}" alt="${title}" loading="lazy" decoding="async">`
    : `<span class="cover-placeholder">${title}</span>`;

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
  const horror = hot.filter(s => normalizeText(s.genre).includes("linh"));
  const romance = hot.filter(s => normalizeText(s.genre).includes("ngon"));
  const other = hot.filter(s => {
    const genre = normalizeText(s.genre);
    return !genre.includes("linh") && !genre.includes("ngon");
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

function scoreStory(story, query) {
  const title = normalizeText(story.title);
  const author = normalizeText(story.author);
  const genre = normalizeText(story.genre);
  let score = 0;

  if (title === query) score += 100;
  else if (title.startsWith(query)) score += 70;
  else if (title.includes(query)) score += 50;

  if (author === query) score += 40;
  else if (author.startsWith(query)) score += 25;
  else if (author.includes(query)) score += 15;

  if (genre === query) score += 20;
  else if (genre.includes(query)) score += 10;

  return score;
}

function findStories(query) {
  const q = normalizeText(query);
  if (!q) return [];

  return stories
    .map(story => ({ story, score: scoreStory(story, q) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || Number(b.story.views || 0) - Number(a.story.views || 0))
    .slice(0, 8)
    .map(item => item.story);
}

function closeSearchResults() {
  const input = document.getElementById("searchInput");
  const resultsBox = document.getElementById("searchResults");
  if (!input || !resultsBox) return;

  resultsBox.hidden = true;
  resultsBox.innerHTML = "";
  input.setAttribute("aria-expanded", "false");
  input.removeAttribute("aria-activedescendant");
  activeSearchIndex = -1;
  visibleSearchResults = [];
}

function setActiveSearchResult(index) {
  const input = document.getElementById("searchInput");
  const resultsBox = document.getElementById("searchResults");
  if (!input || !resultsBox || !visibleSearchResults.length) return;

  activeSearchIndex = (index + visibleSearchResults.length) % visibleSearchResults.length;
  const items = resultsBox.querySelectorAll(".search-result-item");
  items.forEach((item, i) => item.classList.toggle("is-active", i === activeSearchIndex));

  const activeItem = items[activeSearchIndex];
  if (activeItem) {
    input.setAttribute("aria-activedescendant", activeItem.id);
    activeItem.scrollIntoView({ block: "nearest" });
  }
}

function renderSearchResults(query) {
  const input = document.getElementById("searchInput");
  const resultsBox = document.getElementById("searchResults");
  if (!input || !resultsBox) return;

  const q = normalizeText(query);
  if (!q) {
    closeSearchResults();
    return;
  }

  visibleSearchResults = findStories(q);
  activeSearchIndex = -1;
  input.setAttribute("aria-expanded", "true");
  resultsBox.hidden = false;

  if (!visibleSearchResults.length) {
    resultsBox.innerHTML = `<div class="search-empty">Không tìm thấy truyện phù hợp.</div>`;
    return;
  }

  resultsBox.innerHTML = visibleSearchResults.map((story, index) => {
    const title = escapeHtml(story.title || "Không có tên");
    const author = escapeHtml(story.author || "Đang cập nhật");
    const genre = escapeHtml(story.genre || "Khác");
    const cover = story.cover
      ? `<img src="${escapeHtml(story.cover)}" alt="" loading="lazy" decoding="async">`
      : `<span class="search-cover-placeholder">TT</span>`;

    return `
      <a
        id="search-result-${index}"
        class="search-result-item"
        href="story.html?id=${encodeURIComponent(story.id)}"
        role="option"
        aria-selected="false"
      >
        <span class="search-result-cover">${cover}</span>
        <span class="search-result-text">
          <strong>${title}</strong>
          <small>Tác giả: ${author}</small>
          <small>Thể loại: ${genre}</small>
        </span>
      </a>`;
  }).join("");
}

function setupSearch() {
  const input = document.getElementById("searchInput");
  const wrap = document.getElementById("searchWrap");
  if (!input || !wrap) return;

  input.addEventListener("input", () => renderSearchResults(input.value));
  input.addEventListener("focus", () => {
    if (input.value.trim()) renderSearchResults(input.value);
  });

  input.addEventListener("keydown", event => {
    if (event.key === "ArrowDown") {
      if (!visibleSearchResults.length) return;
      event.preventDefault();
      setActiveSearchResult(activeSearchIndex + 1);
    } else if (event.key === "ArrowUp") {
      if (!visibleSearchResults.length) return;
      event.preventDefault();
      setActiveSearchResult(activeSearchIndex - 1);
    } else if (event.key === "Enter") {
      if (!visibleSearchResults.length) return;
      event.preventDefault();
      const target = visibleSearchResults[activeSearchIndex >= 0 ? activeSearchIndex : 0];
      window.location.href = `story.html?id=${encodeURIComponent(target.id)}`;
    } else if (event.key === "Escape") {
      closeSearchResults();
      input.blur();
    }
  });

  document.addEventListener("click", event => {
    if (!wrap.contains(event.target)) closeSearchResults();
  });
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

setupSearch();
loadHome();
