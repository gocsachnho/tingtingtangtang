const params = new URLSearchParams(location.search);
const storyId = params.get("id");
const chapterOrder = Number(params.get("chapter") || 1);

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

function chapterLabel(chapter) {
  const name = cleanVietnameseText(chapter.title || "").trim();
  return name
    ? `Chương ${chapter.chapter_order}: ${name}`
    : `Chương ${chapter.chapter_order}`;
}

function splitParagraphs(text) {
  return cleanVietnameseText(text)
    .replace(/\r/g, "")
    .replace(/\\n/g, "\n")
    .split(/\n{2,}|\n/)
    .map(line => line.trim())
    .filter(Boolean);
}

function setNav(elId, chapter) {
  const el = document.getElementById(elId);

  if (!chapter) {
    el.href = "#";
    el.classList.add("disabled");
    return;
  }

  el.href = chapterUrl(chapter);
  el.classList.remove("disabled");
}

async function loadChapter() {
  const { data: story, error: storyError } = await db
    .from("stories")
    .select("*")
    .eq("id", storyId)
    .single();

  const { data: chapters, error: chaptersError } = await db
    .from("chapters")
    .select("*")
    .eq("story_id", storyId)
    .order("chapter_order", { ascending: true });

  if (storyError || chaptersError) {
    console.error("Lỗi tải dữ liệu chương:", storyError || chaptersError);
  }

  const chapterList = chapters || [];
  const chapter = chapterList.find(c => Number(c.chapter_order) === chapterOrder);

  if (!story || !chapter) {
    document.getElementById("chapterTitle").textContent = "Không tìm thấy chương";
    return;
  }

  const index = chapterList.findIndex(c => c.id === chapter.id);
  const prevChapter = chapterList[index - 1];
  const nextChapter = chapterList[index + 1];
  const cleanStoryTitle = cleanVietnameseText(story.title || "");

  document.title = `${chapterLabel(chapter)} - ${cleanStoryTitle}`;
  document.getElementById("chapterTitle").textContent = chapterLabel(chapter);
  document.getElementById("storyName").textContent = cleanStoryTitle;
  document.getElementById("backStory").href = `story.html?id=${encodeURIComponent(story.id)}`;

  document.getElementById("chapterContent").innerHTML = splitParagraphs(chapter.content)
    .map(p => `<p>${escapeHtml(p)}</p>`)
    .join("");

  setNav("prevTop", prevChapter);
  setNav("prevBottom", prevChapter);
  setNav("nextTop", nextChapter);
  setNav("nextBottom", nextChapter);
}

loadChapter();
