const commentParams = new URLSearchParams(window.location.search);
const commentStoryId = commentParams.get("id");
const commentChapterOrder = commentParams.get("chapter");
const commentTargetType = commentChapterOrder ? "chapter" : "story";

function escapeComment(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatCommentTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("vi-VN");
}

async function loadComments() {
  const list = document.getElementById("commentList");
  if (!list || !commentStoryId) return;

  list.innerHTML = '<p class="meta">Đang tải bình luận...</p>';

  let query = db
    .from("comments")
    .select("id,name,content,created_at,story_id,target_type,chapter_order")
    .eq("story_id", commentStoryId)
    .eq("target_type", commentTargetType)
    .order("created_at", { ascending: false })
    .limit(100);

  if (commentTargetType === "chapter") {
    query = query.eq("chapter_order", Number(commentChapterOrder));
  } else {
    query = query.is("chapter_order", null);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Lỗi tải bình luận:", error);
    list.innerHTML = `<p class="comment-message error">Không tải được bình luận: ${escapeComment(error.message)}</p>`;
    return;
  }

  if (!data?.length) {
    list.innerHTML = '<p class="meta">Chưa có bình luận nào.</p>';
    return;
  }

  list.innerHTML = data.map(comment => `
    <article class="comment-item">
      <div class="comment-head">
        <b>${escapeComment(comment.name || "Ẩn danh")}</b>
        <span>${escapeComment(formatCommentTime(comment.created_at))}</span>
      </div>
      <p>${escapeComment(comment.content).replace(/\n/g, "<br>")}</p>
    </article>
  `).join("");
}

async function addComment() {
  const nameInput = document.getElementById("commentName");
  const contentInput = document.getElementById("commentContent");
  const button = document.getElementById("sendComment");

  if (!nameInput || !contentInput || !button || !commentStoryId) return;

  const name = nameInput.value.trim();
  const content = contentInput.value.trim();

  if (!name || !content) {
    alert("Bạn hãy nhập tên và nội dung bình luận.");
    return;
  }
  if (name.length > 80) {
    alert("Tên không được dài quá 80 ký tự.");
    return;
  }
  if (content.length > 2000) {
    alert("Bình luận không được dài quá 2.000 ký tự.");
    return;
  }

  button.disabled = true;
  button.textContent = "Đang gửi...";

  const payload = {
    story_id: commentStoryId,
    target_type: commentTargetType,
    chapter_order: commentChapterOrder ? Number(commentChapterOrder) : null,
    name,
    content
  };

  const { error } = await db.from("comments").insert([payload]);

  button.disabled = false;
  button.textContent = "Gửi bình luận";

  if (error) {
    console.error("Lỗi gửi bình luận:", error);
    alert("Không gửi được bình luận: " + error.message);
    return;
  }

  nameInput.value = "";
  contentInput.value = "";
  await loadComments();
}

function initComments() {
  const button = document.getElementById("sendComment");
  const contentInput = document.getElementById("commentContent");
  if (!button || !commentStoryId) return;

  button.addEventListener("click", addComment);
  contentInput?.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      addComment();
    }
  });
  loadComments();
}

document.readyState === "loading"
  ? document.addEventListener("DOMContentLoaded", initComments)
  : initComments();
