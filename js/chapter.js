const params = new URLSearchParams(location.search);
const storyId = params.get("id");
const chapterOrder = Number(params.get("chapter") || 1);

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function chapterLabel(chapter) {
  const name = chapter?.title?.trim();
  return name ? `Chương ${chapter.chapter_order}: ${name}` : `Chương ${chapter.chapter_order}`;
}

function splitParagraphs(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/\\n/g, "\n")
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean);
}

function setNav(elId, chapter) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (!chapter) {
    el.href = "#";
    el.classList.add("disabled");
    el.setAttribute("aria-disabled", "true");
    return;
  }
  el.href = chapterUrl(chapter);
  el.classList.remove("disabled");
  el.removeAttribute("aria-disabled");
}

async function loadChapter() {
  if (!storyId || !Number.isFinite(chapterOrder)) {
    document.getElementById("chapterTitle").textContent = "Đường dẫn chương không hợp lệ";
    return;
  }

  const [storyResult, chapterResult, prevResult, nextResult] = await Promise.all([
    db.from("stories").select("id,title").eq("id", storyId).maybeSingle(),
    db.from("chapters").select("id,story_id,chapter_order,title,content,shortlink").eq("story_id", storyId).eq("chapter_order", chapterOrder).maybeSingle(),
    db.from("chapters").select("id,story_id,chapter_order,title,shortlink").eq("story_id", storyId).lt("chapter_order", chapterOrder).order("chapter_order", { ascending: false }).limit(1).maybeSingle(),
    db.from("chapters").select("id,story_id,chapter_order,title,shortlink").eq("story_id", storyId).gt("chapter_order", chapterOrder).order("chapter_order", { ascending: true }).limit(1).maybeSingle()
  ]);

  const story = storyResult.data;
  const chapter = chapterResult.data;
  if (!story || !chapter) {
    document.getElementById("chapterTitle").textContent = "Không tìm thấy chương";
    return;
  }

  document.title = `${chapterLabel(chapter)} - ${story.title}`;
  document.getElementById("chapterTitle").textContent = chapterLabel(chapter);
  document.getElementById("storyName").textContent = story.title;
  document.getElementById("backStory").href = `story.html?id=${encodeURIComponent(story.id)}`;
  document.getElementById("chapterContent").innerHTML = splitParagraphs(chapter.content)
    .map(paragraph => `<p>${escapeHtml(paragraph)}</p>`)
    .join("");

  setNav("prevTop", prevResult.data);
  setNav("prevBottom", prevResult.data);
  setNav("nextTop", nextResult.data);
  setNav("nextBottom", nextResult.data);
}

loadChapter().catch(error => {
  console.error("Lỗi tải chương:", error);
  document.getElementById("chapterTitle").textContent = "Không tải được chương";
});
