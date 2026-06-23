let stories = [];
let chapters = [];

function storyCard(story) {
  return `
    <a class="card" href="story.html?id=${story.id}">
      <div class="cover">
        ${
          story.cover
            ? `<img src="${story.cover}" alt="${story.title}">`
            : story.title
        }
      </div>

      <div class="info">
        <h3>${story.title}</h3>
        <p class="meta">
          Tác giả: ${story.author || "Đang cập nhật"}<br>
          Thể loại: ${story.genre || "Khác"}<br>
          Lượt xem: ${(story.views || 0).toLocaleString("vi-VN")}
        </p>
      </div>
    </a>
  `;
}

function chapterLabel(chapter) {
  const name = chapter.title && chapter.title.trim();

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
          <b>${story.title}</b><br>
          ${chapterLabel(chapter)}
        </a>
      </li>
    `;
  }).join("");
}

function renderHeroSlider() {
  const box = document.getElementById("heroSlider");
  if (!box) return;

  const newestStories = [...stories]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);

  if (!newestStories.length) {
    box.innerHTML = "";
    return;
  }

  box.innerHTML = `
    <div class="hero-track">
      ${newestStories.map(story => {
        const storyChapters = chapters
          .filter(chapter => chapter.story_id === story.id)
          .sort((a, b) => Number(b.chapter_order) - Number(a.chapter_order));

        const latestChapter = storyChapters[0];

        return `
          <a class="hero-slide" href="story.html?id=${story.id}">
            ${
              story.cover
                ? `
                  <img class="hero-bg" src="${story.cover}" alt="${story.title}">
                  <img class="hero-poster" src="${story.cover}" alt="${story.title}">
                `
                : ""
            }

            <div class="hero-slide-info">
              <span>Truyện mới</span>
              <h2>${story.title}</h2>
              <p>
                ${
                  latestChapter
                    ? chapterLabel(latestChapter)
                    : "Chưa có chương"
                }
              </p>
            </div>
          </a>
        `;
      }).join("")}
    </div>

    <div class="hero-dots">
      ${newestStories.map((_, i) =>
        `<span class="${i === 0 ? "active" : ""}"></span>`
      ).join("")}
    </div>
  `;

  let index = 0;
  const track = box.querySelector(".hero-track");
  const dots = box.querySelectorAll(".hero-dots span");

  if (newestStories.length <= 1) return;

  setInterval(() => {
    index = (index + 1) % newestStories.length;
    track.style.transform = `translateX(-${index * 100}%)`;

    dots.forEach(dot => dot.classList.remove("active"));
    dots[index].classList.add("active");
  }, 3500);
}

async function loadHome() {
  const storyResult = await db
    .from("stories")
    .select("*")
    .order("created_at", { ascending: false });

  const chapterResult = await db
    .from("chapters")
    .select("*")
    .order("created_at", { ascending: false });

  stories = storyResult.data || [];
  chapters = chapterResult.data || [];

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

document.getElementById("searchInput").addEventListener("input", function () {
  const q = this.value.toLowerCase().trim();

  if (!q) {
    loadHome();
    return;
  }

  const result = stories.filter(story =>
    story.title.toLowerCase().includes(q) ||
    (story.author || "").toLowerCase().includes(q) ||
    (story.genre || "").toLowerCase().includes(q)
  );

  renderGrid("newStories", result);
});

loadHome();