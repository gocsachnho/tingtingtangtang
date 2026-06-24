const commentParams = new URLSearchParams(location.search);
const commentStoryId = commentParams.get("id");
const commentChapterOrder = commentParams.get("chapter");

const commentTargetType = commentChapterOrder ? "chapter" : "story";

function escapeComment(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderCommentBox() {
  const box = document.getElementById("commentBox");
  if (!box || !commentStoryId) return;

  box.innerHTML = `
    <section class="comment-section">
      <h2>Bình luận</h2>

      <div class="comment-form">
        <input id="commentName" placeholder="Tên của bạn">
        <textarea id="commentContent" placeholder="Viết bình luận..."></textarea>
        <button id="sendComment">Gửi bình luận</button>
      </div>

      <div id="commentList"></div>
    </section>
  `;

  document.getElementById("sendComment").addEventListener("click", addComment);
  loadComments();
}

async function loadComments() {
  const list = document.getElementById("commentList");
  if (!list) return;

  let query = db
    .from("comments")
    .select("*")
    .eq("story_id", commentStoryId)
    .eq("target_type", commentTargetType)
    .order("created_at", { ascending: false });

  if (commentTargetType === "chapter") {
    query = query.eq("chapter_order", Number(commentChapterOrder));
  }

  const { data, error } = await query;

  if (error) {
    list.innerHTML = `<p class="meta">Không tải được bình luận.</p>`;
    return;
  }

  if (!data || !data.length) {
    list.innerHTML = `<p class="meta">Chưa có bình luận nào.</p>`;
    return;
  }

  list.innerHTML = data.map(c => `
    <div class="comment-item">
      <div class="comment-head">
        <b>${escapeComment(c.name)}</b>
        <span>${new Date(c.created_at).toLocaleString("vi-VN")}</span>
      </div>

      <p>${escapeComment(c.content)}</p>

      <button class="comment-delete" onclick="deleteComment('${c.id}')">Xóa</button>
    </div>
  `).join("");
}

async function addComment() {
  const name = document.getElementById("commentName").value.trim();
  const content = document.getElementById("commentContent").value.trim();

  if (!name || !content) {
    alert("Nhập tên và nội dung bình luận nha.");
    return;
  }

  const payload = {
    story_id: commentStoryId,
    target_type: commentTargetType,
    chapter_order: commentChapterOrder ? Number(commentChapterOrder) : null,
    name,
    content
  };

  const { error } = await db.from("comments").insert(payload);

  if (error) {
    alert("Gửi bình luận lỗi: " + error.message);
    return;
  }

  document.getElementById("commentName").value = "";
  document.getElementById("commentContent").value = "";
  loadComments();
}

async function deleteComment(id) {
  if (!confirm("Xóa bình luận này?")) return;

  const { error } = await db
    .from("comments")
    .delete()
    .eq("id", id);

  if (error) {
    alert("Xóa bình luận lỗi.");
    return;
  }

  loadComments();
}

renderCommentBox();
