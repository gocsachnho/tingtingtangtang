async function loadComments(storyId){

  const { data } = await db
    .from("comments")
    .select("*")
    .eq("story_id", storyId)
    .eq("target_type","story")
    .order("created_at",{ascending:false});

  const box = document.getElementById("commentList");

  if(!data || !data.length){
    box.innerHTML = "<p>Chưa có bình luận nào.</p>";
    return;
  }

  box.innerHTML = data.map(item=>`
    <div class="comment-item">
      <div class="comment-name">${item.name}</div>
      <div class="comment-time">
        ${new Date(item.created_at).toLocaleString("vi-VN")}
      </div>
      <div class="comment-content">
        ${item.content}
      </div>
    </div>
  `).join("");
}

async function submitComment(storyId){

  const name =
    document.getElementById("commentName").value.trim();

  const content =
    document.getElementById("commentContent").value.trim();

  if(!name || !content){
    alert("Nhập đủ tên và nội dung");
    return;
  }

  const { error } = await db
    .from("comments")
    .insert([{
      story_id: storyId,
      target_type:"story",
      name,
      content
    }]);

  if(error){
    alert(error.message);
    return;
  }

  document.getElementById("commentContent").value="";

  loadComments(storyId);
}