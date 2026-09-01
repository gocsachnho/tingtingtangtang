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
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function chapterLabel(chapter) {
  const name = cleanVietnameseText(chapter.title || "").trim();
  return name
    ? `Chương ${chapter.chapter_order}: ${name}`
    : `Chương ${chapter.chapter_order}`;
}


function renderChapterHeading(chapter) {
  const titleEl = document.getElementById("chapterTitle");
  if (!titleEl || !chapter) return;

  const order = Number(chapter.chapter_order || 0);
  const name = cleanVietnameseText(chapter.title || "").trim();

  titleEl.textContent = name
    ? `Chương ${order}: ${name}`
    : `Chương ${order}`;
}

function splitParagraphs(text) {
  const normalized = cleanVietnameseText(text)
    .replace(/\r\n?/g, "\n")
    .replace(/\\n/g, "\n")
    .trim();

  if (!normalized) return [];

  /*
    GIỮ ĐÚNG XUỐNG DÒNG KHI NHẬP CHƯƠNG:
    - Mỗi lần Enter trong Admin = một đoạn mới.
    - Nhiều dòng trống liên tiếp không tạo đoạn rỗng.
    - Không nối tất cả các dòng thành một khối dài nữa.
  */
  return normalized
    .split(/\n+/)
    .map(paragraph =>
      paragraph
        .replace(/[ \t]+/g, " ")
        .trim()
    )
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



let copyProtectToastTimer = null;

function showCopyProtectToast(message = "Nội dung được bảo vệ bản quyền. Vui lòng đọc trực tiếp trên website.") {
  let toast = document.getElementById("copyProtectToast");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "copyProtectToast";
    toast.className = "copy-protect-toast";
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(copyProtectToastTimer);
  copyProtectToastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 1800);
}

function maskUnlockCode(code) {
  const clean = String(code || "").trim();

  if (!clean) return "";
  if (clean.length <= 8) return clean.slice(0, 3) + "•••";

  return `${clean.slice(0, 7)}••••${clean.slice(-4)}`;
}

function svgEscapeText(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function applyReaderWatermark(isPaidChapter, unlockCode) {
  const content = document.getElementById("chapterContent");
  if (!content) return;

  const watermarkText = isPaidChapter && unlockCode
    ? `chamdoctruyen.info • ${maskUnlockCode(unlockCode)}`
    : "chamdoctruyen.info";

  const safeText = svgEscapeText(watermarkText);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="430" height="220" viewBox="0 0 430 220">
      <g transform="translate(22 130) rotate(-24)">
        <text
          x="0"
          y="0"
          fill="rgba(185,111,163,0.12)"
          font-family="Arial, sans-serif"
          font-size="18"
          font-weight="700"
          letter-spacing="0.4"
        >${safeText}</text>
      </g>
    </svg>
  `;

  content.style.setProperty(
    "--reader-watermark",
    `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
  );
}

function isTypingTarget(target) {
  if (!target) return false;
  return !!target.closest?.("input, textarea, select, [contenteditable='true']");
}

function protectReaderContent() {
  const content = document.getElementById("chapterContent");
  if (!content || content.dataset.copyProtected === "1") return;

  content.dataset.copyProtected = "1";
  content.classList.add("protected-reader");

  ["copy", "cut", "contextmenu", "dragstart", "selectstart"].forEach(eventName => {
    content.addEventListener(eventName, event => {
      event.preventDefault();
      showCopyProtectToast();
    });
  });

  document.addEventListener("keydown", event => {
    if (isTypingTarget(event.target)) return;

    const key = String(event.key || "").toLowerCase();
    const ctrlOrMeta = event.ctrlKey || event.metaKey;

    const blocked =
      event.key === "F12" ||
      (ctrlOrMeta && ["c", "x", "u", "s", "p", "a"].includes(key)) ||
      (ctrlOrMeta && event.shiftKey && ["i", "j", "c"].includes(key));

    if (!blocked) return;

    event.preventDefault();
    event.stopPropagation();
    showCopyProtectToast(
      key === "p"
        ? "Chức năng in nội dung chương đã được tắt."
        : "Nội dung được bảo vệ bản quyền. Vui lòng đọc trực tiếp trên website."
    );
  }, true);
}

function renderReaderContent(text, options = {}) {
  const content = document.getElementById("chapterContent");

  content.innerHTML = splitParagraphs(text)
    .map(p => `<p>${escapeHtml(p)}</p>`)
    .join("");

  protectReaderContent();
  applyReaderWatermark(!!options.isPaidChapter, options.unlockCode || "");
}

function paywallMessage(msg, type = "") {
  const el = document.getElementById("paymentStatus");
  if (!el) return;
  el.className = `payment-status ${type}`.trim();
  el.textContent = msg || "";
}

function renderPaymentDetails(info) {
  const box = document.getElementById("paymentDetails");
  if (!box) return;

  const qr = info.qr_url
    ? `<img class="payment-qr" src="${escapeHtml(info.qr_url)}" alt="QR thanh toán">`
    : "";

  box.innerHTML = `
    <div class="payment-details-card">
      ${qr}
      <div class="payment-bank-info">
        <p><b>Số tiền:</b> ${ttttFormatVND(info.amount_vnd)}</p>
        <p><b>Ngân hàng:</b> ${escapeHtml(info.bank_name || "Xem thông tin chuyển khoản của chủ website")}</p>
        <p><b>Số tài khoản:</b>
          <span class="copy-value">${escapeHtml(info.bank_account || "")}</span>
          ${info.bank_account ? `<button type="button" class="copy-btn" data-copy="${escapeHtml(info.bank_account)}">Sao chép</button>` : ""}
        </p>
        <p><b>Chủ tài khoản:</b> ${escapeHtml(info.account_name || "")}</p>
        <p><b>Nội dung chuyển khoản:</b>
          <span class="payment-code">${escapeHtml(info.transfer_content || info.order_code || "")}</span>
          <button type="button" class="copy-btn" data-copy="${escapeHtml(info.transfer_content || info.order_code || "")}">Sao chép</button>
        </p>
        <p class="payment-note">Chuyển đúng số tiền và ghi đúng nội dung để chủ website xác nhận nhanh.</p>
      </div>
    </div>
  `;

  box.querySelectorAll("[data-copy]").forEach(btn => {
    btn.addEventListener("click", () => ttttCopy(btn.dataset.copy, btn));
  });
}

async function createPaymentOrder() {
  const btn = document.getElementById("createPaymentBtn");
  if (btn) btn.disabled = true;
  paywallMessage("Đang tạo mã thanh toán...");

  try {
    const info = await ttttRpc("tttt_create_payment_order", { p_story_id: storyId });
    if (!info || !info.ok) throw new Error(info?.message || "Không tạo được mã thanh toán.");

    ttttSavePaymentDraft(storyId, {
      order_code: info.order_code,
      claim_token: info.claim_token
    });

    renderPaymentDetails(info);
    paywallMessage("Mã thanh toán đã tạo. Sau khi chuyển khoản, bấm “Kiểm tra thanh toán”.", "ok");
    const checkBtn = document.getElementById("checkPaymentBtn");
    if (checkBtn) checkBtn.style.display = "inline-flex";
  } catch (err) {
    console.error(err);
    paywallMessage("Không tạo được mã thanh toán. " + (err.message || ""), "error");
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function checkPayment() {
  const draft = ttttGetPaymentDraft(storyId);
  if (!draft?.order_code || !draft?.claim_token) {
    paywallMessage("Chưa có mã thanh toán trên thiết bị này.", "error");
    return;
  }

  const btn = document.getElementById("checkPaymentBtn");
  if (btn) btn.disabled = true;
  paywallMessage("Đang kiểm tra thanh toán...");

  try {
    const result = await ttttRpc("tttt_check_payment", {
      p_order_code: draft.order_code,
      p_claim_token: draft.claim_token
    });

    if (!result?.ok) throw new Error(result?.message || "Không kiểm tra được.");

    if (result.status === "paid" && result.unlock_code) {
      ttttSaveUnlockCode(storyId, result.unlock_code);
      paywallMessage(`Đã thanh toán. Mã mở khóa: ${result.unlock_code}`, "ok");
      setTimeout(() => location.reload(), 700);
      return;
    }

    if (result.status === "rejected") {
      paywallMessage("Giao dịch đã bị từ chối. Vui lòng liên hệ chủ website.", "error");
      return;
    }

    paywallMessage("Chưa ghi nhận thanh toán. Nếu bạn vừa chuyển khoản, vui lòng chờ chủ website xác nhận.", "pending");
  } catch (err) {
    console.error(err);
    paywallMessage("Không kiểm tra được thanh toán. " + (err.message || ""), "error");
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function useExistingUnlockCode() {
  const input = document.getElementById("unlockCodeInput");
  const enteredCode = ttttNormalizeAccessCode(input?.value || "");

  if (!enteredCode) {
    paywallMessage("Bạn chưa nhập mã mở khóa / mã đơn thanh toán.", "error");
    return;
  }

  const btn = document.getElementById("useUnlockBtn");
  if (btn) btn.disabled = true;
  paywallMessage("Đang kiểm tra mã...");

  try {
    const result = await ttttRpc("tttt_validate_access_code", {
      p_story_id: storyId,
      p_code: enteredCode
    });

    if (!result?.ok || !result?.valid) {
      localStorage.removeItem(ttttUnlockKey(storyId));
      paywallMessage(
        "Mã không hợp lệ, chưa được xác nhận thanh toán, hoặc mã này thuộc truyện khác.",
        "error"
      );
      return;
    }

    // Lưu mã mở khóa chuẩn do Supabase trả về.
    // Từ máy khác có thể nhập cả MÃ MỞ KHÓA hoặc MÃ ĐƠN THANH TOÁN đã thanh toán.
    ttttSaveUnlockCode(storyId, result.unlock_code || enteredCode);
    paywallMessage("Mã hợp lệ. Đang mở khóa truyện...", "ok");
    setTimeout(() => location.reload(), 450);
  } catch (err) {
    console.error(err);
    paywallMessage("Không kiểm tra được mã. " + (err.message || ""), "error");
  } finally {
    if (btn) btn.disabled = false;
  }
}

function renderLockedBox(chapterData) {
  const content = document.getElementById("chapterContent");
  content.classList.remove("protected-reader");
  content.removeAttribute("data-copy-protected");
  content.style.removeProperty("--reader-watermark");
  const price = Number(chapterData.price_vnd || 0);
  const savedDraft = ttttGetPaymentDraft(storyId);

  content.innerHTML = `
    <section class="paywall-box">
      <div class="paywall-icon">🔒</div>
      <h2>Chương trả phí</h2>
      <p>
        Bạn đã đọc hết phần miễn phí. Mở khóa toàn bộ các chương trả phí còn lại của truyện này với giá
        <strong>${ttttFormatVND(price)}</strong>.
      </p>

      <div class="paywall-actions">
        <button type="button" id="createPaymentBtn">Tạo mã thanh toán</button>
        <button type="button" id="checkPaymentBtn" class="secondary-pay-btn" ${savedDraft ? "" : 'style="display:none"'}>Kiểm tra thanh toán</button>
      </div>

      <div id="paymentDetails"></div>
      <p id="paymentStatus" class="payment-status"></p>

      <div class="unlock-existing">
        <h3>Đã mua trước đó?</h3>
        <p>Nhập <b>mã mở khóa</b> hoặc <b>mã đơn thanh toán đã được xác nhận</b>. Không cần đăng ký tài khoản.</p>
        <div class="unlock-row">
          <input id="unlockCodeInput" autocomplete="off" placeholder="Nhập mã TTTT-...">
          <button type="button" id="useUnlockBtn">Mở khóa</button>
        </div>
      </div>
    </section>
  `;

  document.getElementById("createPaymentBtn").addEventListener("click", createPaymentOrder);
  document.getElementById("checkPaymentBtn").addEventListener("click", checkPayment);
  document.getElementById("useUnlockBtn").addEventListener("click", useExistingUnlockCode);

  if (savedDraft) {
    paywallMessage(`Bạn đã có đơn ${savedDraft.order_code}. Bấm “Kiểm tra thanh toán” sau khi chuyển khoản.`, "pending");
  }
}

async function loadChapter() {
  if (!storyId || !Number.isFinite(chapterOrder)) {
    document.getElementById("chapterTitle").textContent = "Không tìm thấy chương";
    return;
  }

  try {
    const { data: story, error: storyError } = await db
      .from("stories")
      .select("*")
      .eq("id", storyId)
      .single();

    if (storyError || !story) throw storyError || new Error("Không tìm thấy truyện.");

    const unlockCode = ttttGetUnlockCode(storyId);

    const chapterList = await ttttRpc("tttt_list_chapters", {
      p_story_id: storyId,
      p_unlock_code: unlockCode || null
    });

    const list = Array.isArray(chapterList) ? chapterList : [];
    const chapterMeta = list.find(c => Number(c.chapter_order) === chapterOrder);

    const chapterData = await ttttRpc("tttt_get_chapter", {
      p_story_id: storyId,
      p_chapter_order: chapterOrder,
      p_unlock_code: unlockCode || null
    });

    if (!chapterMeta || !chapterData?.ok) {
      document.getElementById("chapterTitle").textContent = "Không tìm thấy chương";
      return;
    }

    const index = list.findIndex(c => Number(c.chapter_order) === chapterOrder);
    const prevChapter = list[index - 1];
    const nextChapter = list[index + 1];
    const cleanStoryTitle = cleanVietnameseText(story.title || "");

    document.title = `${chapterLabel(chapterMeta)} - ${cleanStoryTitle}`;
    renderChapterHeading(chapterMeta);
    document.getElementById("storyName").textContent = cleanStoryTitle;
    document.getElementById("backStory").href = `story.html?id=${encodeURIComponent(story.id)}`;

    if (chapterData.access_granted) {
      renderReaderContent(chapterData.content || "", {
        isPaidChapter: Number(chapterOrder) > Number(chapterData.free_until || 0),
        unlockCode
      });
    } else {
      renderLockedBox(chapterData);
    }

    setNav("prevTop", prevChapter);
    setNav("prevBottom", prevChapter);
    setNav("nextTop", nextChapter);
    setNav("nextBottom", nextChapter);
  } catch (err) {
    console.error("Lỗi tải chương:", err);
    document.getElementById("chapterTitle").textContent = "Chưa cài hệ thống thu phí";
    document.getElementById("chapterContent").innerHTML = `
      <div class="paywall-system-error">
        Website chưa chạy file SQL thiết lập thu phí trong Supabase, hoặc kết nối đang lỗi.
      </div>
    `;
  }
}

loadChapter();
