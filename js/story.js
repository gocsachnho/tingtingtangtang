const params = new URLSearchParams(location.search);
const id = params.get("id");

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatDescription(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/\\n/g, "\n")
    .replace(/([.!?…])\s+/g, "$1\n\n")
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => `<p>${escapeHtml(line)}</p>`)
    .join("");
}

async function loadStory() {
  const { data: story, error: storyError } = await db
    .from("stories")
    .select("*")
    .eq("id", id)
    .single();

  if (storyError || !story) {
    document.getElementById("storyDetail").innerHTML = "<p>Không tìm thấy truyện.</p>";
    return;
  }

  const { data: chapters } = await db
    .from("chapters")
    .select("*")
    .eq("story_id", story.id)
    .order("chapter_order", { ascending: true });

  document.title = story.title;

  document.getElementById("storyDetail").innerHTML = `
    <div class="story-box">
      ${story.cover ? `
        <img 
          src="${story.cover}" 
          style="max-width:320px;width:100%;border-radius:12px;margin-bottom:28px;display:block;"
        >
      ` : ""}

      <h1>${story.title}</h1>

      <p class="meta">
        Tác giả: ${story.author || ""} |
        Thể loại: ${story.genre || ""}
      </p>

      <div class="story-description" style="font-size:19px;line-height:1.9;margin-top:24px;">
        ${formatDescription(story.description || "")}
      </div>

      ${
        chapters && chapters.length
          ? `<a class="chapter-nav" href="${chapterUrl(chapters[0])}">Đọc từ đầu</a>`
          : ""
      }
    </div>
  `;

  document.getElementById("chapterList").innerHTML = (chapters || []).map(chapter => `
    <a class="chapter-row" href="${chapterUrl(chapter)}">
      <span>Chương ${chapter.chapter_order}: ${chapter.title}</span>
      <span>${chapter.shortlink ? "Qua link →" : "Đọc →"}</span>
    </a>
  `).join("");
}

loadStory();