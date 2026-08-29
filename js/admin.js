let stories = [];
let chapters = [];
let currentStoryId = "";

function cleanVietnameseText(text) {
  const value = String(text == null ? "" : text);
  return typeof window.normalizeVietnameseText === "function"
    ? window.normalizeVietnameseText(value)
    : value.normalize("NFC");
}

function setupTabs() {
  document.querySelectorAll(".admin-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".admin-tab").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".admin-page").forEach(p => p.classList.remove("active"));

      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");
    });
  });
}

async function checkLogin() {
  const { data } = await db.auth.getSession();

  if (data.session) {
    document.getElementById("loginBox").style.display = "none";
    document.getElementById("adminPanel").style.display = "block";
    setupTabs();
    await loadAdminData();
  } else {
    document.getElementById("loginBox").style.display = "block";
    document.getElementById("adminPanel").style.display = "none";
  }
}

document.getElementById("loginForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const fd = new FormData(this);

  const { error } = await db.auth.signInWithPassword({
    email: fd.get("email"),
    password: fd.get("password")
  });

  if (error) {
    alert("Đăng nhập lỗi: " + error.message);
    return;
  }

  await checkLogin();
});

document.getElementById("logoutBtn").addEventListener("click", async function () {
  await db.auth.signOut();
  location.reload();
});

async function uploadCover(file) {
  if (!file || file.size === 0) return "";

  const fileName = Date.now() + "-" + file.name.replace(/\s+/g, "-");

  const { error } = await db.storage
    .from(COVER_BUCKET)
    .upload(fileName, file);

  if (error) {
    alert("Upload ảnh lỗi: " + error.message);
    return "";
  }

  const { data } = db.storage
    .from(COVER_BUCKET)
    .getPublicUrl(fileName);

  return data.publicUrl;
}

async function loadAdminData() {
  const storyResult = await db
    .from("stories")
    .select("*")
    .order("created_at", { ascending: false });

  const chapterResult = await db
    .from("chapters")
    .select("*")
    .order("story_id", { ascending: true })
    .order("chapter_order", { ascending: true });

  stories = storyResult.data || [];
  chapters = chapterResult.data || [];

  if (!currentStoryId && stories.length) {
    currentStoryId = stories[0].id;
  }

  renderStorySelect();
  renderStories();
  renderChapters();
}

function chapterLabel(chapter) {
  const name = cleanVietnameseText(chapter.title || "").trim();
  return name
    ? `Chương ${chapter.chapter_order}: ${name}`
    : `Chương ${chapter.chapter_order}`;
}

function renderStorySelect() {
  const select = document.getElementById("storySelect");

  select.innerHTML = stories.map(story => `
    <option value="${story.id}" ${story.id === currentStoryId ? "selected" : ""}>
      ${cleanVietnameseText(story.title)}
    </option>
  `).join("");

  select.onchange = function () {
    currentStoryId = this.value;
    renderChapters();
  };
}

function renderStories() {
  document.getElementById("adminStoryList").innerHTML = stories.map(story => {
    const count = chapters.filter(c => c.story_id === story.id).length;

    return `
      <div class="admin-item">
        <div>
          <b>${cleanVietnameseText(story.title)}</b>
          <p class="meta">${cleanVietnameseText(story.author || "")} | ${cleanVietnameseText(story.genre || "")} | ${count} chương</p>
        </div>
        <div>
          <button type="button" onclick="editStory('${story.id}')">Sửa</button>
          <button type="button" class="delete-btn" onclick="deleteStory('${story.id}')">Xóa</button>
        </div>
      </div>
    `;
  }).join("");
}

function renderChapters() {
  const selectedStory = stories.find(s => s.id === currentStoryId);
  const filteredChapters = chapters
    .filter(c => c.story_id === currentStoryId)
    .sort((a, b) => Number(a.chapter_order) - Number(b.chapter_order));

  const box = document.getElementById("adminChapterList");

  if (!selectedStory) {
    box.innerHTML = `<p class="meta">Chưa có truyện nào.</p>`;
    return;
  }

  if (!filteredChapters.length) {
    box.innerHTML = `
      <h3 style="color:#ffd369;margin-bottom:15px;">Danh sách chương của: ${selectedStory.title}</h3>
      <p class="meta">Truyện này chưa có chương.</p>
    `;
    return;
  }

  box.innerHTML = `
    <h3 style="color:#ffd369;margin-bottom:15px;">Danh sách chương của: ${selectedStory.title}</h3>
    ${filteredChapters.map(chapter => `
      <div class="admin-item">
        <div>
          <b>${chapterLabel(chapter)}</b>
          <p class="meta">${chapter.shortlink ? "Có link rút gọn" : "Không có link rút gọn"}</p>
        </div>
        <div>
          <button type="button" onclick="editChapter(${chapter.id})">Sửa</button>
          <button type="button" class="delete-btn" onclick="deleteChapter(${chapter.id})">Xóa</button>
        </div>
      </div>
    `).join("")}
  `;
}

document.getElementById("storyForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const fd = new FormData(this);
  const oldId = fd.get("id");
  let cover = fd.get("cover");

  const uploadedCover = await uploadCover(fd.get("coverFile"));
  if (uploadedCover) cover = uploadedCover;

  const storyId = oldId || makeSlug(fd.get("title"));

  const storyData = {
    id: storyId,
    title: cleanVietnameseText(fd.get("title")),
    author: cleanVietnameseText(fd.get("author")),
    genre: cleanVietnameseText(fd.get("genre")),
    cover: cover,
    description: cleanVietnameseText(fd.get("description"))
  };

  const { error } = await db
    .from("stories")
    .upsert(storyData);

  if (error) {
    alert("Lỗi lưu truyện: " + error.message);
    return;
  }

  currentStoryId = storyId;
  this.reset();
  this.elements.id.value = "";

  await loadAdminData();
  alert("Đã lưu truyện.");
});

function editStory(id) {
  const story = stories.find(s => s.id === id);
  const form = document.getElementById("storyForm");

  currentStoryId = id;

  form.elements.id.value = story.id;
  form.elements.title.value = cleanVietnameseText(story.title || "");
  form.elements.author.value = cleanVietnameseText(story.author || "");
  form.elements.genre.value = cleanVietnameseText(story.genre || "Khác");
  form.elements.cover.value = story.cover || "";
  form.elements.description.value = cleanVietnameseText(story.description || "");

  renderStorySelect();
  renderChapters();

  document.querySelector('[data-tab="storyFormPage"]').click();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deleteStory(id) {
  if (!confirm("Xóa truyện này? Toàn bộ chương cũng sẽ bị xóa.")) return;

  const { error } = await db
    .from("stories")
    .delete()
    .eq("id", id);

  if (error) {
    alert("Lỗi xóa truyện: " + error.message);
    return;
  }

  if (currentStoryId === id) currentStoryId = "";
  await loadAdminData();
}

document.getElementById("chapterForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const form = this;
  const fd = new FormData(form);
  const chapterId = fd.get("id");
  const selectedStoryId = fd.get("story_id");
  const chapterOrder = Number(fd.get("chapter_order"));

  currentStoryId = selectedStoryId;

  const duplicate = chapters.find(chapter =>
    chapter.story_id === selectedStoryId &&
    Number(chapter.chapter_order) === chapterOrder &&
    String(chapter.id) !== String(chapterId || "")
  );

  if (duplicate) {
    alert("Truyện này đã có chương số " + chapterOrder + ". Nếu muốn sửa thì bấm nút Sửa chương đó.");
    return;
  }

  const chapterData = {
    story_id: selectedStoryId,
    chapter_order: chapterOrder,
    title: cleanVietnameseText(fd.get("title") || ""),
    content: cleanVietnameseText(fd.get("content")),
    shortlink: fd.get("shortlink") || ""
  };

  let error;

  if (chapterId) {
    const result = await db
      .from("chapters")
      .update(chapterData)
      .eq("id", chapterId);

    error = result.error;
  } else {
    const result = await db
      .from("chapters")
      .insert([chapterData]);

    error = result.error;
  }

  if (error) {
    alert("Lỗi lưu chương: " + error.message);
    return;
  }

  form.elements.id.value = "";
  form.elements.chapter_order.value = "";
  form.elements.title.value = "";
  form.elements.content.value = "";
  form.elements.shortlink.value = "";
  form.elements.story_id.value = selectedStoryId;

  await loadAdminData();
  alert("Đã lưu chương.");
});

function editChapter(id) {
  const chapter = chapters.find(c => c.id === id);
  const form = document.getElementById("chapterForm");

  currentStoryId = chapter.story_id;

  form.elements.id.value = chapter.id;
  form.elements.story_id.value = chapter.story_id;
  form.elements.chapter_order.value = chapter.chapter_order;
  form.elements.title.value = cleanVietnameseText(chapter.title || "");
  form.elements.content.value = cleanVietnameseText(chapter.content || "");
  form.elements.shortlink.value = chapter.shortlink || "";

  renderStorySelect();
  renderChapters();

  document.querySelector('[data-tab="chaptersPage"]').click();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deleteChapter(id) {
  if (!confirm("Xóa chương này?")) return;

  const { error } = await db
    .from("chapters")
    .delete()
    .eq("id", id);

  if (error) {
    alert("Lỗi xóa chương: " + error.message);
    return;
  }

  await loadAdminData();
}

async function runInBatches(items, worker, size = 20) {
  for (let i = 0; i < items.length; i += size) {
    const batch = items.slice(i, i + size);
    const results = await Promise.all(batch.map(worker));
    const failed = results.find(result => result && result.error);
    if (failed) throw failed.error;
  }
}

async function normalizeAllDatabaseText() {
  const button = document.getElementById("normalizeAllBtn");
  const status = document.getElementById("normalizeStatus");

  if (!button || !status) return;
  if (!confirm("Chuẩn hóa lỗi chữ tiếng Việt cho toàn bộ truyện và chương hiện có?")) return;

  button.disabled = true;
  status.textContent = "Đang kiểm tra và chuẩn hóa dữ liệu...";

  try {
    const storyChanges = stories
      .map(story => {
        const patch = {
          title: cleanVietnameseText(story.title || ""),
          author: cleanVietnameseText(story.author || ""),
          genre: cleanVietnameseText(story.genre || ""),
          description: cleanVietnameseText(story.description || "")
        };
        const changed = Object.keys(patch).some(key => String(story[key] || "") !== patch[key]);
        return changed ? { id: story.id, patch } : null;
      })
      .filter(Boolean);

    const chapterChanges = chapters
      .map(chapter => {
        const patch = {
          title: cleanVietnameseText(chapter.title || ""),
          content: cleanVietnameseText(chapter.content || "")
        };
        const changed = Object.keys(patch).some(key => String(chapter[key] || "") !== patch[key]);
        return changed ? { id: chapter.id, patch } : null;
      })
      .filter(Boolean);

    await runInBatches(storyChanges, item =>
      db.from("stories").update(item.patch).eq("id", item.id)
    );

    await runInBatches(chapterChanges, item =>
      db.from("chapters").update(item.patch).eq("id", item.id)
    );

    await loadAdminData();
    status.textContent = `Hoàn tất: đã chuẩn hóa ${storyChanges.length} truyện và ${chapterChanges.length} chương.`;
    alert("Đã chuẩn hóa dữ liệu chữ tiếng Việt.");
  } catch (error) {
    console.error(error);
    status.textContent = "Có lỗi khi cập nhật. Dữ liệu chưa sửa hết.";
    alert("Lỗi chuẩn hóa dữ liệu: " + (error?.message || error));
  } finally {
    button.disabled = false;
  }
}

const normalizeAllBtn = document.getElementById("normalizeAllBtn");
if (normalizeAllBtn) {
  normalizeAllBtn.addEventListener("click", normalizeAllDatabaseText);
}

checkLogin();
