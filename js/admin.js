let stories = [];
let chapters = [];

async function checkLogin() {
  const { data } = await db.auth.getSession();

  if (data.session) {
    document.getElementById("loginBox").style.display = "none";
    document.getElementById("adminPanel").style.display = "block";
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
    .order("chapter_order", { ascending: true });

  stories = storyResult.data || [];
  chapters = chapterResult.data || [];

  renderStorySelect();
  renderStories();
  renderChapters();
}

function renderStorySelect() {
  document.getElementById("storySelect").innerHTML = stories.map(story => `
    <option value="${story.id}">${story.title}</option>
  `).join("");
}

function renderStories() {
  document.getElementById("adminStoryList").innerHTML = stories.map(story => `
    <div class="admin-item">
      <div>
        <b>${story.title}</b>
        <p class="meta">${story.author || ""} | ${story.genre || ""}</p>
      </div>
      <div>
        <button onclick="editStory('${story.id}')">Sửa</button>
        <button class="delete-btn" onclick="deleteStory('${story.id}')">Xóa</button>
      </div>
    </div>
  `).join("");
}

function renderChapters() {
  document.getElementById("adminChapterList").innerHTML = chapters.map(chapter => {
    const story = stories.find(s => s.id === chapter.story_id);

    return `
      <div class="admin-item">
        <div>
          <b>${story ? story.title : "Không rõ truyện"}</b>
          <p class="meta">Chương ${chapter.chapter_order}: ${chapter.title}</p>
          <p class="meta">${chapter.shortlink ? "Có link rút gọn" : "Không có link rút gọn"}</p>
        </div>
        <div>
          <button onclick="editChapter(${chapter.id})">Sửa</button>
          <button class="delete-btn" onclick="deleteChapter(${chapter.id})">Xóa</button>
        </div>
      </div>
    `;
  }).join("");
}

document.getElementById("storyForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const fd = new FormData(this);
  const oldId = fd.get("id");
  let cover = fd.get("cover");

  const uploadedCover = await uploadCover(fd.get("coverFile"));
  if (uploadedCover) cover = uploadedCover;

  const storyData = {
    id: oldId || makeSlug(fd.get("title")),
    title: fd.get("title"),
    author: fd.get("author"),
    genre: fd.get("genre"),
    cover: cover,
    description: fd.get("description")
  };

  const { error } = await db
    .from("stories")
    .upsert(storyData);

  if (error) {
    alert("Lỗi lưu truyện: " + error.message);
    return;
  }

  this.reset();
  await loadAdminData();
  alert("Đã lưu truyện.");
});

function editStory(id) {
  const story = stories.find(s => s.id === id);
  const form = document.getElementById("storyForm");

  form.id.value = story.id;
  form.title.value = story.title || "";
  form.author.value = story.author || "";
  form.genre.value = story.genre || "Khác";
  form.cover.value = story.cover || "";
  form.description.value = story.description || "";

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

  await loadAdminData();
}

document.getElementById("chapterForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const fd = new FormData(this);
  const chapterId = fd.get("id");

  const chapterData = {
    story_id: fd.get("story_id"),
    chapter_order: Number(fd.get("chapter_order")),
    title: fd.get("title"),
    content: fd.get("content"),
    shortlink: fd.get("shortlink")
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
      .insert(chapterData);

    error = result.error;
  }

  if (error) {
    alert("Lỗi lưu chương: " + error.message);
    return;
  }

  this.reset();
  await loadAdminData();
  alert("Đã lưu chương.");
});

function editChapter(id) {
  const chapter = chapters.find(c => c.id === id);
  const form = document.getElementById("chapterForm");

  form.id.value = chapter.id;
  form.story_id.value = chapter.story_id;
  form.chapter_order.value = chapter.chapter_order;
  form.title.value = chapter.title || "";
  form.content.value = chapter.content || "";
  form.shortlink.value = chapter.shortlink || "";

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

checkLogin();