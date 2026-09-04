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



/* =========================================================
   NGHE TRUYỆN - WEB SPEECH API
   Dùng giọng TTS có sẵn trên máy/điện thoại, không tạo file audio.
========================================================= */

const ttsReader = {
  supported: "speechSynthesis" in window && "SpeechSynthesisUtterance" in window,
  text: "",
  chunks: [],
  index: 0,
  speaking: false,
  paused: false,
  stopped: true,
  voices: [],
  utterance: null
};

function ttsEls() {
  return {
    player: document.getElementById("ttsPlayer"),
    play: document.getElementById("ttsPlayBtn"),
    pause: document.getElementById("ttsPauseBtn"),
    stop: document.getElementById("ttsStopBtn"),
    rate: document.getElementById("ttsRate"),
    gender: document.getElementById("ttsGender"),
    voice: document.getElementById("ttsVoice"),
    status: document.getElementById("ttsStatus")
  };
}

function setTtsStatus(message) {
  const el = document.getElementById("ttsStatus");
  if (el) el.textContent = message;
}

function splitTextForSpeech(text, maxLength = 190) {
  const clean = cleanVietnameseText(text || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean) return [];

  // Ưu tiên ngắt ở cuối câu để giọng đọc tự nhiên hơn.
  const sentences = clean.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g) || [clean];
  const chunks = [];
  let buffer = "";

  function pushBuffer() {
    const value = buffer.trim();
    if (value) chunks.push(value);
    buffer = "";
  }

  sentences.forEach(sentence => {
    const part = sentence.trim();
    if (!part) return;

    if ((buffer + " " + part).trim().length <= maxLength) {
      buffer = (buffer + " " + part).trim();
      return;
    }

    pushBuffer();

    if (part.length <= maxLength) {
      buffer = part;
      return;
    }

    // Câu quá dài: ngắt tiếp theo dấu phẩy/chấm phẩy rồi cuối cùng theo từ.
    const pieces = part.split(/(?<=[,;:])\s+/);

    pieces.forEach(piece => {
      if (piece.length <= maxLength) {
        if ((buffer + " " + piece).trim().length <= maxLength) {
          buffer = (buffer + " " + piece).trim();
        } else {
          pushBuffer();
          buffer = piece;
        }
        return;
      }

      const words = piece.split(/\s+/);
      words.forEach(word => {
        if ((buffer + " " + word).trim().length <= maxLength) {
          buffer = (buffer + " " + word).trim();
        } else {
          pushBuffer();
          buffer = word;
        }
      });
    });
  });

  pushBuffer();
  return chunks;
}

function normalizeVoiceName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function detectVietnameseVoiceGender(voice) {
  const name = normalizeVoiceName(`${voice?.name || ""} ${voice?.voiceURI || ""}`);

  const femaleHints = [
    "hoaimy", "hoai my", "female", "woman", "girl",
    "thao", "linh", "mai", "vy"
  ];

  const maleHints = [
    "namminh", "nam minh", "male", "man", "boy",
    "minh quan", "quang", "huy"
  ];

  if (femaleHints.some(hint => name.includes(hint))) return "female";
  if (maleHints.some(hint => name.includes(hint))) return "male";

  return "unknown";
}

function getVietnameseVoices() {
  return ttsReader.voices.filter(v =>
    /^vi[-_]/i.test(v.lang || "") ||
    /vietnam|viet nam|tiếng việt|tieng viet/i.test(`${v.name} ${v.lang}`)
  );
}

function getPreferredVietnameseVoice() {
  const els = ttsEls();
  const selectedName = els.voice?.value || "";

  if (selectedName) {
    const chosen = ttsReader.voices.find(v => v.name === selectedName);
    if (chosen) return chosen;
  }

  const vietnamese = getVietnameseVoices();
  const gender = els.gender?.value || "auto";

  if (gender === "female") {
    const femaleVoice = vietnamese.find(v => detectVietnameseVoiceGender(v) === "female");
    if (femaleVoice) return femaleVoice;
  }

  if (gender === "male") {
    const maleVoice = vietnamese.find(v => detectVietnameseVoiceGender(v) === "male");
    if (maleVoice) return maleVoice;
  }

  return vietnamese[0] || null;
}

function updateVoiceListForGender() {
  const els = ttsEls();
  if (!els.voice) return;

  const previous = els.voice.value;
  const vietnamese = getVietnameseVoices();
  const gender = els.gender?.value || "auto";

  let visibleVoices = vietnamese;

  if (gender === "female") {
    const femaleVoices = vietnamese.filter(v => detectVietnameseVoiceGender(v) === "female");
    if (femaleVoices.length) visibleVoices = femaleVoices;
  } else if (gender === "male") {
    const maleVoices = vietnamese.filter(v => detectVietnameseVoiceGender(v) === "male");
    if (maleVoices.length) visibleVoices = maleVoices;
  }

  els.voice.innerHTML = `<option value="">Tự động theo kiểu giọng</option>`;

  visibleVoices.forEach(voice => {
    const detected = detectVietnameseVoiceGender(voice);
    const label =
      detected === "female" ? "Nữ" :
      detected === "male" ? "Nam" :
      "Không xác định";

    const option = document.createElement("option");
    option.value = voice.name;
    option.textContent = `${voice.name} — ${label}`;
    els.voice.appendChild(option);
  });

  if (previous && [...els.voice.options].some(o => o.value === previous)) {
    els.voice.value = previous;
  } else {
    els.voice.value = "";
  }

  if (!vietnamese.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Thiết bị chưa có giọng tiếng Việt";
    option.disabled = true;
    els.voice.appendChild(option);
    return;
  }

  if (gender === "female" && !vietnamese.some(v => detectVietnameseVoiceGender(v) === "female")) {
    setTtsStatus("Thiết bị chưa cung cấp giọng nữ Việt riêng; sẽ dùng giọng Việt khả dụng.");
  }

  if (gender === "male" && !vietnamese.some(v => detectVietnameseVoiceGender(v) === "male")) {
    setTtsStatus("Thiết bị chưa cung cấp giọng nam Việt riêng; sẽ dùng giọng Việt khả dụng.");
  }
}

function loadTtsVoices() {
  if (!ttsReader.supported) return;

  ttsReader.voices = window.speechSynthesis.getVoices() || [];
  updateVoiceListForGender();
}

function updateTtsButtons() {
  const els = ttsEls();
  if (!els.player) return;

  els.play.disabled = !ttsReader.supported || !ttsReader.text;
  els.pause.disabled = !ttsReader.speaking;
  els.stop.disabled = !ttsReader.speaking;

  if (ttsReader.paused) {
    els.pause.textContent = "▶ Tiếp tục";
  } else {
    els.pause.textContent = "⏸ Tạm dừng";
  }

  if (ttsReader.speaking && !ttsReader.paused) {
    els.play.textContent = "🔊 Đang đọc";
  } else {
    els.play.textContent = "🔊 Nghe";
  }
}

function prepareTtsChapter(text) {
  const els = ttsEls();
  if (!els.player) return;

  stopTtsReader(false);

  ttsReader.text = cleanVietnameseText(text || "").trim();
  ttsReader.chunks = splitTextForSpeech(ttsReader.text);
  ttsReader.index = 0;

  if (!ttsReader.supported) {
    els.player.hidden = false;
    setTtsStatus("Trình duyệt này chưa hỗ trợ đọc văn bản.");
    updateTtsButtons();
    return;
  }

  els.player.hidden = !ttsReader.text;

  if (ttsReader.text) {
    setTtsStatus(`Sẵn sàng đọc • ${ttsReader.chunks.length} đoạn giọng`);
  }

  updateTtsButtons();
}

function hideTtsPlayer() {
  stopTtsReader(false);
  const player = document.getElementById("ttsPlayer");
  if (player) player.hidden = true;
}

function speakTtsChunk() {
  if (!ttsReader.supported || !ttsReader.speaking || ttsReader.paused) return;

  if (ttsReader.index >= ttsReader.chunks.length) {
    ttsReader.speaking = false;
    ttsReader.paused = false;
    ttsReader.stopped = true;
    ttsReader.utterance = null;
    setTtsStatus("Đã đọc xong chương.");
    updateTtsButtons();
    return;
  }

  const els = ttsEls();
  const utterance = new SpeechSynthesisUtterance(ttsReader.chunks[ttsReader.index]);
  const voice = getPreferredVietnameseVoice();

  utterance.lang = voice?.lang || "vi-VN";
  if (voice) utterance.voice = voice;

  utterance.rate = Number(els.rate?.value || 1);
  utterance.pitch = 1;
  utterance.volume = 1;

  utterance.onstart = () => {
    const progress = Math.min(ttsReader.index + 1, ttsReader.chunks.length);
    setTtsStatus(`Đang đọc • đoạn ${progress}/${ttsReader.chunks.length}`);
    updateTtsButtons();
  };

  utterance.onend = () => {
    if (!ttsReader.speaking || ttsReader.paused) return;
    ttsReader.index += 1;

    // Khoảng nghỉ rất ngắn giữa các đoạn giúp mobile đọc ổn định hơn.
    setTimeout(speakTtsChunk, 50);
  };

  utterance.onerror = event => {
    // "canceled" xảy ra bình thường khi người dùng bấm Dừng/đổi tốc độ.
    if (event.error === "canceled" || event.error === "interrupted") return;

    console.error("TTS error:", event.error);
    ttsReader.speaking = false;
    ttsReader.paused = false;
    setTtsStatus("Không đọc được trên thiết bị này. Hãy thử đổi giọng hoặc tải lại trang.");
    updateTtsButtons();
  };

  ttsReader.utterance = utterance;
  window.speechSynthesis.speak(utterance);
}

function startTtsReader() {
  if (!ttsReader.supported || !ttsReader.text) return;

  // Nếu đang tạm dừng thì nút Nghe cũng có thể tiếp tục.
  if (ttsReader.speaking && ttsReader.paused) {
    resumeTtsReader();
    return;
  }

  window.speechSynthesis.cancel();

  ttsReader.chunks = splitTextForSpeech(ttsReader.text);
  ttsReader.index = 0;
  ttsReader.speaking = true;
  ttsReader.paused = false;
  ttsReader.stopped = false;

  setTtsStatus("Đang chuẩn bị giọng đọc...");
  updateTtsButtons();

  setTimeout(speakTtsChunk, 80);
}

function pauseTtsReader() {
  if (!ttsReader.supported || !ttsReader.speaking || ttsReader.paused) return;

  window.speechSynthesis.pause();
  ttsReader.paused = true;
  setTtsStatus(`Đã tạm dừng • đoạn ${ttsReader.index + 1}/${ttsReader.chunks.length}`);
  updateTtsButtons();
}

function resumeTtsReader() {
  if (!ttsReader.supported || !ttsReader.speaking || !ttsReader.paused) return;

  ttsReader.paused = false;
  window.speechSynthesis.resume();
  setTtsStatus(`Đang đọc • đoạn ${ttsReader.index + 1}/${ttsReader.chunks.length}`);
  updateTtsButtons();
}

function toggleTtsPause() {
  if (!ttsReader.speaking) {
    startTtsReader();
    return;
  }

  if (ttsReader.paused) {
    resumeTtsReader();
  } else {
    pauseTtsReader();
  }
}

function stopTtsReader(showStatus = true) {
  if (ttsReader.supported) {
    window.speechSynthesis.cancel();
  }

  ttsReader.speaking = false;
  ttsReader.paused = false;
  ttsReader.stopped = true;
  ttsReader.index = 0;
  ttsReader.utterance = null;

  if (showStatus && ttsReader.text) {
    setTtsStatus("Đã dừng. Bấm Nghe để đọc lại từ đầu.");
  }

  updateTtsButtons();
}

function restartTtsAtCurrentChunk() {
  if (!ttsReader.speaking) return;

  const current = ttsReader.index;
  window.speechSynthesis.cancel();

  ttsReader.index = current;
  ttsReader.paused = false;

  setTimeout(speakTtsChunk, 80);
}

function initTtsControls() {
  const els = ttsEls();
  if (!els.player) return;

  if (!ttsReader.supported) {
    setTtsStatus("Trình duyệt này chưa hỗ trợ chức năng nghe truyện.");
    updateTtsButtons();
    return;
  }

  loadTtsVoices();

  if ("onvoiceschanged" in window.speechSynthesis) {
    window.speechSynthesis.addEventListener("voiceschanged", loadTtsVoices);
  }

  try {
    const savedRate = localStorage.getItem("tttt_tts_rate");
    if (savedRate && [...els.rate.options].some(o => o.value === savedRate)) {
      els.rate.value = savedRate;
    }

    const savedGender = localStorage.getItem("tttt_tts_gender");
    if (savedGender && ["auto", "female", "male"].includes(savedGender)) {
      els.gender.value = savedGender;
    }

    updateVoiceListForGender();

    const savedVoice = localStorage.getItem("tttt_tts_voice");
    if (savedVoice) {
      // Chọn lại sau khi voices tải xong.
      setTimeout(() => {
        updateVoiceListForGender();
        if ([...els.voice.options].some(o => o.value === savedVoice)) {
          els.voice.value = savedVoice;
        }
      }, 500);
    }
  } catch (_) {}

  els.play.addEventListener("click", startTtsReader);
  els.pause.addEventListener("click", toggleTtsPause);
  els.stop.addEventListener("click", () => stopTtsReader(true));

  els.rate.addEventListener("change", () => {
    try {
      localStorage.setItem("tttt_tts_rate", els.rate.value);
    } catch (_) {}

    // Đang đọc thì áp dụng tốc độ mới từ đoạn hiện tại.
    restartTtsAtCurrentChunk();
  });

  els.gender.addEventListener("change", () => {
    try {
      localStorage.setItem("tttt_tts_gender", els.gender.value);
      localStorage.removeItem("tttt_tts_voice");
    } catch (_) {}

    updateVoiceListForGender();
    restartTtsAtCurrentChunk();
  });

  els.voice.addEventListener("change", () => {
    try {
      localStorage.setItem("tttt_tts_voice", els.voice.value);
    } catch (_) {}

    restartTtsAtCurrentChunk();
  });

  window.addEventListener("beforeunload", () => {
    if (ttsReader.supported) window.speechSynthesis.cancel();
  });

  updateTtsButtons();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initTtsControls);
} else {
  initTtsControls();
}

function renderReaderContent(text, options = {}) {
  const content = document.getElementById("chapterContent");

  content.innerHTML = splitParagraphs(text)
    .map(p => `<p>${escapeHtml(p)}</p>`)
    .join("");

  protectReaderContent();
  applyReaderWatermark(!!options.isPaidChapter, options.unlockCode || "");

  // Máy đọc chỉ nhận nội dung sau khi quyền đọc chương đã được xác nhận.
  prepareTtsChapter(text);
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
  hideTtsPlayer();
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
