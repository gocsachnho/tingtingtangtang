const DATA_URL = "./data/stories.json";

const STORAGE_KEYS = {
  bookmarks: "tttt_bookmarks",
  history: "tttt_history",
  comments: "tttt_comments",
  views: "tttt_views"
};

document.addEventListener("DOMContentLoaded", async () => {
  const page = document.body.dataset.page;
  const data = await loadStories();

  if (page === "home") renderHome(data);
  if (page === "story") renderStoryPage(data);
  if (page === "chapter") renderChapterPage(data);
});

async function loadStories(){
  try{
    const res = await fetch(DATA_URL);
    if(!res.ok) throw new Error("Không đọc được stories.json");
    return await res.json();
  }catch(error){
    console.error(error);
    alert("Lỗi: Không tìm thấy ./data/stories.json");
    return { stories: [] };
  }
}

function getParam(name){
  return new URLSearchParams(window.location.search).get(name);
}

function getStorage(key, fallback){
  try{
    return JSON.parse(localStorage.getItem(key)) || fallback;
  }catch{
    return fallback;
  }
}

function setStorage(key, value){
  localStorage.setItem(key, JSON.stringify(value));
}

function getStoryViews(storyId, originalViews){
  const views = getStorage(STORAGE_KEYS.views, {});
  return views[storyId] ?? originalViews ?? 0;
}

function increaseStoryViews(storyId){
  const views = getStorage(STORAGE_KEYS.views, {});
  views[storyId] = (views[storyId] || 0) + 1;
  setStorage(STORAGE_KEYS.views, views);
}

function formatViews(num){
  if(num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if(num >= 1000) return (num / 1000).toFixed(1) + "K";
  return String(num);
}

function findStory(data, storyId){
  return data.stories.find(story => story.id === storyId);
}

function findChapter(story, chapterId){
  return story.chapters.find(chapter => String(chapter.id) === String(chapterId));
}

function renderHome(data){
  const stories = data.stories;
  const featured = stories[0];

  if(featured){
    document.getElementById("heroTitle").innerHTML = featured.title.split(" ").join("<br>");
    document.getElementById("heroQuote").innerHTML = featured.quote || "“Có những bí mật chỉ được chôn cùng người chết.”";
    document.getElementById("heroReadBtn").href = `./chapter.html?id=${featured.id}&chapter=${featured.chapters[0].id}`;
    document.getElementById("heroDetailBtn").href = `./story.html?id=${featured.id}`;
    document.getElementById("heroSection").style.backgroundImage =
      `linear-gradient(90deg,rgba(0,0,0,.85),rgba(0,0,0,.35),rgba(0,0,0,.75)), url('${featured.hero_image}')`;
  }

  renderLatestChapters(stories);
  renderAbout(featured);
  renderStoryCards(stories, "storyList");
  renderBookmarks(data);
  renderHistory(data);
  setupSearch(stories);
}

function renderLatestChapters(stories){
  const box = document.getElementById("latestChapters");
  if(!box) return;

  const chapters = [];

  stories.forEach(story => {
    story.chapters.slice(0, 3).forEach(chapter => {
      chapters.push({ story, chapter });
    });
  });

  chapters.slice(0, 5).forEach(item => {
    const row = document.createElement("div");
    row.className = "chapter-row";
    row.innerHTML = `
      <span>Chương ${item.chapter.number}</span>
      <strong>${item.chapter.title}</strong>
      <time>${item.chapter.date}</time>
      <em>👁 ${formatViews(getStoryViews(item.story.id, item.story.views))}</em>
    `;
    row.addEventListener("click", () => {
      window.location.href = `./chapter.html?id=${item.story.id}&chapter=${item.chapter.id}`;
    });
    box.appendChild(row);
  });
}

function renderAbout(story){
  const box = document.getElementById("aboutStory");
  if(!box || !story) return;

  box.innerHTML = `
    <p>${story.description}</p>
    <p><b>Tác giả:</b> ${story.author}</p>
    <p><b>Thể loại:</b> ${story.genres.join(" - ")}</p>
    <p><b>Tình trạng:</b> ${story.status}</p>
    <p><b>Lượt xem:</b> ${formatViews(getStoryViews(story.id, story.views))}</p>
  `;
}

function renderStoryCards(stories, targetId){
  const box = document.getElementById(targetId);
  if(!box) return;

  box.innerHTML = "";

  stories.forEach(story => {
    const card = document.createElement("article");
    card.className = "story-card";
    card.innerHTML = `
      <img src="${story.cover_image}" alt="${story.title}">
      <div class="story-card-body">
        <h3>${story.title}</h3>
        <div class="genre">${story.genres.join(" • ")}</div>
        <div class="meta">
          <span>👁 ${formatViews(getStoryViews(story.id, story.views))}</span>
          <span>⭐ ${story.rating || "4.9"}</span>
        </div>
        <p>${story.short_description}</p>
      </div>
    `;
    card.addEventListener("click", () => {
      increaseStoryViews(story.id);
      window.location.href = `./story.html?id=${story.id}`;
    });
    box.appendChild(card);
  });
}

function setupSearch(stories){
  const input = document.getElementById("searchInput");
  const btn = document.getElementById("searchBtn");

  if(!input || !btn) return;

  function search(){
    const keyword = input.value.trim().toLowerCase();
    const filtered = stories.filter(story =>
      story.title.toLowerCase().includes(keyword) ||
      story.author.toLowerCase().includes(keyword) ||
      story.genres.join(" ").toLowerCase().includes(keyword)
    );
    renderStoryCards(filtered, "storyList");
  }

  btn.addEventListener("click", search);
  input.addEventListener("input", search);
}

function renderBookmarks(data){
  const box = document.getElementById("bookmarkList");
  if(!box) return;

  const ids = getStorage(STORAGE_KEYS.bookmarks, []);

  if(ids.length === 0){
    box.innerHTML = `<p class="empty-text">Chưa có truyện nào được bookmark.</p>`;
    return;
  }

  const stories = data.stories.filter(story => ids.includes(story.id));
  renderStoryCards(stories, "bookmarkList");
}

function renderHistory(data){
  const box = document.getElementById("historyList");
  if(!box) return;

  const history = getStorage(STORAGE_KEYS.history, []);

  if(history.length === 0){
    box.innerHTML = `<p class="empty-text">Chưa có lịch sử đọc.</p>`;
    return;
  }

  box.innerHTML = "";

  history.forEach(item => {
    const story = findStory(data, item.storyId);
    if(!story) return;

    const div = document.createElement("div");
    div.className = "history-item";
    div.innerHTML = `
      <strong>${story.title}</strong><br>
      Đã đọc đến chương ${item.chapterNumber} - ${item.chapterTitle}<br>
      <small>${item.date}</small>
    `;
    div.addEventListener("click", () => {
      window.location.href = `./chapter.html?id=${item.storyId}&chapter=${item.chapterId}`;
    });
    box.appendChild(div);
  });
}

function renderStoryPage(data){
  const storyId = getParam("id");
  const story = findStory(data, storyId);

  if(!story){
    document.getElementById("storyDetail").innerHTML = "<h1>Không tìm thấy truyện.</h1>";
    return;
  }

  increaseStoryViews(story.id);

  const detail = document.getElementById("storyDetail");
  detail.innerHTML = `
    <img src="${story.cover_image}" alt="${story.title}">
    <div class="story-info">
      <h1>${story.title}</h1>
      <p><b>Tác giả:</b> ${story.author}</p>
      <p><b>Thể loại:</b> ${story.genres.join(" - ")}</p>
      <p><b>Tình trạng:</b> ${story.status}</p>
      <p><b>Lượt xem:</b> ${formatViews(getStoryViews(story.id, story.views))}</p>
      <p>${story.description}</p>

      <div class="action-row">
        <a class="btn red" href="./chapter.html?id=${story.id}&chapter=${story.chapters[0].id}">📖 Đọc ngay</a>
        <button class="btn dark" id="bookmarkBtn">🔖 Bookmark</button>
        <a class="btn dark" target="_blank" href="${story.affiliate_book_link}">🛒 Mua sách</a>
      </div>
    </div>
  `;

  document.getElementById("bookmarkBtn").addEventListener("click", () => {
    toggleBookmark(story.id);
  });

  renderChapterList(story);
  renderComments(`story_${story.id}`);
}

function toggleBookmark(storyId){
  const bookmarks = getStorage(STORAGE_KEYS.bookmarks, []);
  const index = bookmarks.indexOf(storyId);

  if(index >= 0){
    bookmarks.splice(index, 1);
    alert("Đã bỏ bookmark.");
  }else{
    bookmarks.push(storyId);
    alert("Đã lưu bookmark.");
  }

  setStorage(STORAGE_KEYS.bookmarks, bookmarks);
}

function renderChapterList(story){
  const box = document.getElementById("chapterList");
  box.innerHTML = "";

  story.chapters.forEach(chapter => {
    const row = document.createElement("div");
    row.className = "chapter-row";
    row.innerHTML = `
      <span>Chương ${chapter.number}</span>
      <strong>${chapter.title}</strong>
      <time>${chapter.date}</time>
      <em>Đọc</em>
    `;
    row.addEventListener("click", () => {
      window.location.href = `./chapter.html?id=${story.id}&chapter=${chapter.id}`;
    });
    box.appendChild(row);
  });
}

function renderChapterPage(data){
  const storyId = getParam("id");
  const chapterId = getParam("chapter");

  const story = findStory(data, storyId);
  if(!story){
    document.getElementById("chapterContent").innerHTML = "<h1>Không tìm thấy truyện.</h1>";
    return;
  }

  const chapter = findChapter(story, chapterId);
  if(!chapter){
    document.getElementById("chapterContent").innerHTML = "<h1>Không tìm thấy chương.</h1>";
    return;
  }

  increaseStoryViews(story.id);
  saveHistory(story, chapter);

  const back = document.getElementById("backToStory");
  if(back) back.href = `./story.html?id=${story.id}`;

  const currentIndex = story.chapters.findIndex(c => String(c.id) === String(chapter.id));
  const prev = story.chapters[currentIndex - 1];
  const next = story.chapters[currentIndex + 1];

  const reader = document.getElementById("chapterContent");
  reader.innerHTML = `
    <h1>${story.title}</h1>
    <h2>Chương ${chapter.number}: ${chapter.title}</h2>
    <div class="reader-meta">Ngày đăng: ${chapter.date} • Lượt xem truyện: ${formatViews(getStoryViews(story.id, story.views))}</div>
    <div>${chapter.content.map(p => `<p>${p}</p>`).join("")}</div>

    <div class="reader-nav">
      ${prev ? `<a class="btn dark" href="./chapter.html?id=${story.id}&chapter=${prev.id}">← Chương trước</a>` : ""}
      <a class="btn dark" href="./story.html?id=${story.id}">Danh sách chương</a>
      ${next ? `<a class="btn red" href="${chapter.next_chapter_shortlink}" target="_blank">Mở link chương tiếp theo</a>` : ""}
    </div>
  `;

  renderComments(`chapter_${story.id}_${chapter.id}`);
}

function saveHistory(story, chapter){
  const history = getStorage(STORAGE_KEYS.history, []);
  const filtered = history.filter(item => item.storyId !== story.id);

  filtered.unshift({
    storyId: story.id,
    chapterId: chapter.id,
    chapterNumber: chapter.number,
    chapterTitle: chapter.title,
    date: new Date().toLocaleString("vi-VN")
  });

  setStorage(STORAGE_KEYS.history, filtered.slice(0, 10));
}

function renderComments(commentKey){
  const box = document.getElementById("commentBox");
  if(!box) return;

  box.innerHTML = `
    <form class="comment-form" id="commentForm">
      <input id="commentName" placeholder="Tên của bạn" required>
      <textarea id="commentText" placeholder="Nhập bình luận..." required></textarea>
      <button type="submit">Gửi bình luận</button>
    </form>
    <div class="comment-list" id="commentList"></div>
  `;

  const form = document.getElementById("commentForm");
  form.addEventListener("submit", e => {
    e.preventDefault();

    const name = document.getElementById("commentName").value.trim();
    const text = document.getElementById("commentText").value.trim();

    if(!name || !text) return;

    const comments = getStorage(STORAGE_KEYS.comments, {});
    if(!comments[commentKey]) comments[commentKey] = [];

    comments[commentKey].unshift({
      name,
      text,
      date: new Date().toLocaleString("vi-VN")
    });

    setStorage(STORAGE_KEYS.comments, comments);
    form.reset();
    displayComments(commentKey);
  });

  displayComments(commentKey);
}

function displayComments(commentKey){
  const list = document.getElementById("commentList");
  if(!list) return;

  const comments = getStorage(STORAGE_KEYS.comments, {});
  const current = comments[commentKey] || [];

  if(current.length === 0){
    list.innerHTML = `<p class="empty-text">Chưa có bình luận nào.</p>`;
    return;
  }

  list.innerHTML = current.map(comment => `
    <div class="comment">
      <strong>${comment.name}</strong>
      <small>${comment.date}</small>
      <p>${comment.text}</p>
    </div>
  `).join("");
}