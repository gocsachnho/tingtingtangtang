const DEFAULT_STORIES = [
  {
    id: "dan-gian-di-van-luc",
    title: "Dân Gian Dị Văn Lục",
    author: "La Tiểu Kỳ",
    category: "linh-di",
    views: 98210,
    createdAt: "2026-06-22",
    description: "Một câu chuyện linh dị dân gian xoay quanh những cấm kỵ, âm trạch và bí mật truyền đời.",
    chapters: [
      {
        title: "Chương 1: Đêm Mưa Gõ Cửa",
        content: "Đêm đó mưa rơi không ngừng.\nTôi nghe thấy tiếng gõ cửa vang lên từ ngoài sân.\nNhưng căn nhà này vốn đã bỏ hoang hơn mười năm."
      },
      {
        title: "Chương 2: Bóng Người Sau Miếu",
        content: "Tôi men theo con đường đất sau miếu.\nÁnh trăng bị mây che khuất.\nMột bóng người đứng im ở cuối đường, không nhúc nhích."
      }
    ]
  },
  {
    id: "am-hon-tro-ve",
    title: "Âm Hồn Trở Về",
    author: "Mộc Hạ",
    category: "linh-di",
    views: 76100,
    createdAt: "2026-06-21",
    description: "Một lời nguyền cũ thức tỉnh sau đám tang kỳ lạ trong làng.",
    chapters: [
      {
        title: "Chương 1: Đám Tang Không Khóc",
        content: "Trong đám tang ấy, không ai dám khóc.\nNgười trong làng đều cúi đầu, sắc mặt tái nhợt."
      }
    ]
  },
  {
    id: "co-dau-quy",
    title: "Cô Dâu Quỷ",
    author: "Hàn Vũ",
    category: "linh-di",
    views: 68900,
    createdAt: "2026-06-20",
    description: "Chiếc kiệu đỏ xuất hiện giữa đêm, mang theo một cô dâu không có bóng.",
    chapters: [
      {
        title: "Chương 1: Kiệu Hoa Trong Sương",
        content: "Sương trắng phủ kín con đường làng.\nTừ xa, tiếng kèn đám cưới vang lên réo rắt."
      }
    ]
  },
  {
    id: "nha-co-ben-song",
    title: "Nhà Cổ Bên Sông",
    author: "Bạch Miên",
    category: "linh-di",
    views: 61200,
    createdAt: "2026-06-19",
    description: "Ngôi nhà cổ bên bờ sông luôn sáng đèn vào đúng nửa đêm.",
    chapters: [
      {
        title: "Chương 1: Ánh Đèn Nửa Đêm",
        content: "Nửa đêm, căn nhà bên sông bỗng sáng đèn.\nTôi biết, người trong nhà ấy đã chết từ lâu."
      }
    ]
  },
  {
    id: "yeu-em-mua-ha",
    title: "Yêu Em Mùa Hạ",
    author: "Lam Chi",
    category: "ngon-tinh",
    views: 89500,
    createdAt: "2026-06-18",
    description: "Một chuyện tình dịu dàng giữa mùa hè, thanh xuân và những lời chưa kịp nói.",
    chapters: [
      {
        title: "Chương 1: Gặp Lại",
        content: "Tôi gặp lại anh vào một chiều mưa.\nMùa hè năm ấy, mọi thứ như quay trở về điểm bắt đầu."
      }
    ]
  },
  {
    id: "hon-uoc-mua-dong",
    title: "Hôn Ước Mùa Đông",
    author: "An Nhiên",
    category: "ngon-tinh",
    views: 83400,
    createdAt: "2026-06-17",
    description: "Một bản hôn ước bất ngờ kéo hai con người xa lạ lại gần nhau.",
    chapters: [
      {
        title: "Chương 1: Tờ Giấy Hôn Ước",
        content: "Tờ giấy đặt trên bàn khiến tôi sững người.\nTên của tôi và anh nằm cạnh nhau thật rõ ràng."
      }
    ]
  },
  {
    id: "sau-con-mua",
    title: "Sau Cơn Mưa",
    author: "Tịch Lam",
    category: "ngon-tinh",
    views: 72100,
    createdAt: "2026-06-16",
    description: "Sau những hiểu lầm, liệu tình yêu có thể bắt đầu lại?",
    chapters: [
      {
        title: "Chương 1: Mưa Rơi",
        content: "Mưa rơi suốt cả buổi chiều.\nTôi đứng trước cổng trường, nhìn bóng anh dần khuất xa."
      }
    ]
  },
  {
    id: "gui-anh-ngay-cu",
    title: "Gửi Anh Ngày Cũ",
    author: "Diệp Trà",
    category: "ngon-tinh",
    views: 69800,
    createdAt: "2026-06-15",
    description: "Những lá thư cũ mở ra một mối tình tưởng đã ngủ quên.",
    chapters: [
      {
        title: "Chương 1: Lá Thư Đầu Tiên",
        content: "Tôi tìm thấy lá thư ấy trong chiếc hộp gỗ cũ.\nNét chữ quen thuộc khiến tim tôi chợt thắt lại."
      }
    ]
  }
];

function getStories() {
  const data = localStorage.getItem("tttt_stories");
  if (!data) {
    localStorage.setItem("tttt_stories", JSON.stringify(DEFAULT_STORIES));
    return DEFAULT_STORIES;
  }
  return JSON.parse(data);
}

function saveStories(stories) {
  localStorage.setItem("tttt_stories", JSON.stringify(stories));
}

function makeSlug(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") + "-" + Date.now();
}

function categoryName(cat) {
  if (cat === "linh-di") return "Linh dị";
  if (cat === "ngon-tinh") return "Ngôn tình";
  return "Khác";
}