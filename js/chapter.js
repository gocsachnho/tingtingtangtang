const params = new URLSearchParams(location.search);
const storyId = params.get("id");
const chapterOrder = Number(params.get("chapter") || 1);

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function splitParagraphs(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/\\n/g, "\n")
    .replace(/。/g, "。\n")
    .replace(/！/g, "！\n")
    .replace(/？/g, "？\n")
    .replace(/([.!?…])\s*,\s*/g, "$1\n")
    .replace(/,\s*(?=[A-ZÀ-ỸĐ])/g, "\n")
    .split(/\n+/)
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
  const { data: story } = await db
    .from("stories")
    .select("*")
    .eq("id", storyId)
    .single();

  const { data: chapters } = await db
    .from("chapters")
    .select("*")
    .eq("story_id", storyId)
    .order("chapter_order", { ascending: true });

  const chapter = chapters.find(c => Number(c.chapter_order) === chapterOrder);

  if (!story || !chapter) {
    document.getElementById("chapterTitle").textContent = "Không tìm thấy chương";
    return;
  }

  const index = chapters.findIndex(c => c.id === chapter.id);
  const prevChapter = chapters[index - 1];
  const nextChapter = chapters[index + 1];

  document.title = `${chapter.title} - ${story.title}`;
  document.getElementById("chapterTitle").textContent = `Chương ${chapter.chapter_order}: ${chapter.title}`;
  document.getElementById("storyName").textContent = story.title;
  document.getElementById("backStory").href = `story.html?id=${story.id}`;

  document.getElementById("chapterContent").innerHTML = splitParagraphs(chapter.content)
    .map(p => `<p>${escapeHtml(p)}</p>`)
    .join("");

  setNav("prevTop", prevChapter);
  setNav("prevBottom", prevChapter);
  setNav("nextTop", nextChapter);
  setNav("nextBottom", nextChapter);
}

loadChapter();