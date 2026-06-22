const stories = getStories();

function storyCard(story) {
  return `
    <a class="card" href="story.html?id=${story.id}">
      <div class="cover">${story.title}</div>
      <div class="info">
        <h3>${story.title}</h3>
        <p class="meta">
          Tác giả: ${story.author}<br>
          Thể loại: ${categoryName(story.category)}<br>
          Lượt xem: ${story.views.toLocaleString("vi-VN")}
        </p>
      </div>
    </a>
  `;
}

function render(id, list) {
  document.getElementById(id).innerHTML = list.slice(0, 4).map(storyCard).join("");
}

const newest = [...stories].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
const hottest = [...stories].sort((a, b) => b.views - a.views);

render("newStories", newest);
render("hotStories", hottest);
render("horrorStories", hottest.filter(s => s.category === "linh-di"));
render("romanceStories", hottest.filter(s => s.category === "ngon-tinh"));

const latest = [];

stories.forEach(story => {
  story.chapters.forEach((chapter, index) => {
    latest.push({ story, chapter, index });
  });
});

document.getElementById("latestChapters").innerHTML = latest.reverse().slice(0, 12).map(item => `
  <li>
    <a href="chapter.html?id=${item.story.id}&chapter=${item.index}">
      <b>${item.story.title}</b><br>
      ${item.chapter.title}
    </a>
  </li>
`).join("");

document.getElementById("searchInput").addEventListener("input", function () {
  const q = this.value.toLowerCase().trim();

  if (!q) {
    render("newStories", newest);
    return;
  }

  const result = stories.filter(s =>
    s.title.toLowerCase().includes(q) ||
    s.author.toLowerCase().includes(q)
  );

  render("newStories", result);
});