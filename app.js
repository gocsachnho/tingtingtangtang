/* =========================================================================
   HỆ THỐNG HIỂN THỊ DỮ LIỆU TRANG CHỦ - COMPAT SDK
   Tự động đồng bộ và hiển thị truyện mới nhất từ Firebase Firestore lên UI
   ========================================================================= */

/* CẤU HÌNH DỰ ÁN DỮ LIỆU (Trùng khớp 100% với trang Admin) */
const firebaseConfig = {
  apiKey: "AIzaSyD-PH509CDqlF6MpfBb6xBFXMFCUul4JWw",
  authDomain: "tingtingtangtang-68022.firebaseapp.com",
  projectId: "tingtingtangtang-68022",
  storageBucket: "tingtingtangtang-68022.firebasestorage.app",
  messagingSenderId: "1054700518128",
  appId: "1:1054700518128:web:c501a1899f1e30962da035",
  measurementId: "G-X8XLJZRBXD"
};

// Khởi tạo Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

/* HÀM LẤY VÀ HIỂN THỊ DANH SÁCH TRUYỆN */
async function displayStories() {
  const container = document.getElementById("storiesContainer");
  if (!container) return;

  try {
    // Lấy toàn bộ danh sách truyện chữ từ Firebase, xếp truyện mới tạo lên đầu
    const snap = await db.collection("stories").orderBy("createdAt", "desc").get();
    
    // Nếu trong Database chưa có truyện nào
    if (snap.empty) {
      container.innerHTML = '<div class="loading-placeholder">📭 Hệ thống đang trống. Vui lòng vào trang Admin để đăng tác phẩm đầu tiên!</div>';
      return;
    }

    container.innerHTML = ""; // Xóa dòng chữ "Đang tải..."

    // Duyệt qua từng bộ truyện để dựng thẻ giao diện
    snap.forEach(doc => {
      const storyId = doc.id;
      const data = doc.data();

      // Sử dụng ảnh bìa mặc định nếu ô nhập link ảnh ở Admin bị bỏ trống
      const coverUrl = data.cover || "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?q=80&w=300&auto=format&fit=crop";
      const totalChapters = data.chaptersCount || 0;
      const genreName = data.genre || "Truyện Chữ";

      // Tạo phần tử thẻ truyện bằng HTML chuỗi
      const cardHtml = `
        <a href="./story.html?id=${storyId}" class="story-card">
          <div class="story-cover-wrapper">
            <img class="story-cover" src="${coverUrl}" alt="${data.title}" loading="lazy">
          </div>
          <div class="story-info">
            <div class="story-title">${data.title}</div>
            <div class="story-meta">
              <span class="story-genre">${genreName}</span>
              <span>📝 ${totalChapters} chương</span>
            </div>
          </div>
        </a>
      `;

      // Dán thẻ truyện vào lưới hiển thị của trang chủ
      container.innerHTML += cardHtml;
    });

  } catch (err) {
    console.error("Lỗi lấy danh sách truyện trang chủ:", err);
    container.innerHTML = '<div class="loading-placeholder">❌ Lỗi đồng bộ dữ liệu đám mây. Vui lòng kiểm tra lại cấu hình kết nối!</div>';
  }
}

/* KÍCH HOẠT KHI TRANG TẢI XONG */
document.addEventListener("DOMContentLoaded", () => {
  displayStories();
});