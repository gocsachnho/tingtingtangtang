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
   NGHE TRUYỆN KIỂU AUDIOBOOK - WEB SPEECH API
   - Thanh tiến trình kéo được
   - Hiển thị % + thời gian ước tính
   - Lùi / tua khoảng 15 giây
   - Phát / tạm dừng / dừng
   - Giữ lựa chọn tốc độ, giọng nam/nữ, giọng cụ thể
   - Tự nhớ vị trí nghe của từng chương trên thiết bị
   Lưu ý: Web Speech API không trả thời lượng audio thật, vì vậy thời gian
   và tua 15 giây là ước tính. Tiến trình bám theo vị trí văn bản đang đọc.
========================================================= */

const ttsReader = {
  supported: "speechSynthesis" in window && "SpeechSynthesisUtterance" in window,
  text: "",
  chunks: [],
  chunkStarts: [],
  totalChars: 0,
  index: 0,
  offset: 0,
  globalPosition: 0,
  speaking: false,
  paused: false,
  stopped: true,
  voices: [],
  utterance: null,
  serial: 0,
  dragging: false,
  dragWasPlaying: false,
  dragWasPaused: false,
  lastSavedAt: 0
};

function ttsEls() {
  return {
    player: document.getElementById("ttsPlayer"),
    play: document.getElementById("ttsPlayBtn"),
    stop: document.getElementById("ttsStopBtn"),
    back15: document.getElementById("ttsBack15Btn"),
    forward15: document.getElementById("ttsForward15Btn"),
    rate: document.getElementById("ttsRate"),
    gender: document.getElementById("ttsGender"),
    voice: document.getElementById("ttsVoice"),
    status: document.getElementById("ttsStatus"),
    progress: document.getElementById("ttsProgress"),
    percent: document.getElementById("ttsPercent"),
    currentTime: document.getElementById("ttsCurrentTime"),
    remainingTime: document.getElementById("ttsRemainingTime")
  };
}

function setTtsStatus(message) {
  const el = document.getElementById("ttsStatus");
  if (el) el.textContent = message;
}

function ttsPositionStorageKey() {
  return `tttt_tts_position_${storyId || "story"}_${Number.isFinite(chapterOrder) ? chapterOrder : 1}`;
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

function rebuildTtsChunkMap() {
  ttsReader.chunkStarts = [];
  let total = 0;

  ttsReader.chunks.forEach(chunk => {
    ttsReader.chunkStarts.push(total);
    total += chunk.length;
  });

  ttsReader.totalChars = total;
}

function ttsPositionToChunk(position) {
  if (!ttsReader.chunks.length) return { index: 0, offset: 0 };

  const safe = Math.max(0, Math.min(ttsReader.totalChars, Number(position) || 0));

  if (safe >= ttsReader.totalChars) {
    const last = ttsReader.chunks.length - 1;
    return { index: last, offset: ttsReader.chunks[last].length };
  }

  let low = 0;
  let high = ttsReader.chunkStarts.length - 1;
  let found = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (ttsReader.chunkStarts[mid] <= safe) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return {
    index: found,
    offset: Math.max(0, Math.min(ttsReader.chunks[found].length, safe - ttsReader.chunkStarts[found]))
  };
}

function setTtsGlobalPosition(position, refresh = true) {
  const safe = Math.max(0, Math.min(ttsReader.totalChars, Number(position) || 0));
  const mapped = ttsPositionToChunk(safe);

  ttsReader.globalPosition = safe;
  ttsReader.index = mapped.index;
  ttsReader.offset = mapped.offset;

  if (refresh) updateTtsProgressUI();
}

function formatTtsTime(seconds) {
  let value = Number(seconds);
  if (!Number.isFinite(value) || value < 0) value = 0;
  value = Math.round(value);

  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const secs = value % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function getTtsEstimatedTotalSeconds() {
  const els = ttsEls();
  const words = String(ttsReader.text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  const rate = Math.max(0.1, Number(els.rate?.value || 1));
  const wordsPerMinute = 160 * rate;
  return words ? (words / wordsPerMinute) * 60 : 0;
}

function saveTtsPosition(force = false) {
  if (!ttsReader.text || !ttsReader.totalChars) return;

  const now = Date.now();
  if (!force && now - ttsReader.lastSavedAt < 700) return;
  ttsReader.lastSavedAt = now;

  try {
    if (ttsReader.globalPosition > 0 && ttsReader.globalPosition < ttsReader.totalChars) {
      localStorage.setItem(ttsPositionStorageKey(), String(Math.floor(ttsReader.globalPosition)));
    } else if (ttsReader.globalPosition <= 0) {
      localStorage.removeItem(ttsPositionStorageKey());
    }
  } catch (_) {}
}

function updateTtsProgressUI(save = true) {
  const els = ttsEls();
  if (!els.player) return;

  const ratio = ttsReader.totalChars > 0
    ? Math.max(0, Math.min(1, ttsReader.globalPosition / ttsReader.totalChars))
    : 0;

  const percent = ratio * 100;

  if (els.progress) {
    els.progress.value = String(Math.round(percent * 10));
    els.progress.style.setProperty("--tts-progress", `${percent}%`);
  }

  if (els.percent) els.percent.textContent = `${Math.round(percent)}%`;

  const totalSeconds = getTtsEstimatedTotalSeconds();
  const elapsed = totalSeconds * ratio;
  const remaining = Math.max(0, totalSeconds - elapsed);

  if (els.currentTime) els.currentTime.textContent = formatTtsTime(elapsed);
  if (els.remainingTime) {
    els.remainingTime.textContent = ratio >= 1
      ? "Đã hoàn thành"
      : `Còn ~${formatTtsTime(remaining)}`;
  }

  if (save) saveTtsPosition(false);
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
    "thao", "linh", "mai", "vy", "my", "ngoc", "thu"
  ];

  const maleHints = [
    "namminh", "nam minh", "male", "man", "boy",
    "minh quan", "quang", "huy", "son", "tuan"
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

function updateVoiceListForGender(showAvailabilityMessage = false) {
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
    const label = detected === "female" ? "Nữ" : detected === "male" ? "Nam" : "Không xác định";
    const option = document.createElement("option");
    option.value = voice.name;
    option.textContent = `${voice.name} (${voice.lang || ""}) — ${label}`;
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

  if (!showAvailabilityMessage) return;

  if (gender === "female" && !vietnamese.some(v => detectVietnameseVoiceGender(v) === "female")) {
    setTtsStatus("Thiết bị này chưa có giọng nữ Việt riêng; sẽ dùng giọng Việt khả dụng.");
  }

  if (gender === "male" && !vietnamese.some(v => detectVietnameseVoiceGender(v) === "male")) {
    setTtsStatus("Thiết bị này chưa có giọng nam Việt riêng; sẽ dùng giọng Việt khả dụng.");
  }
}

function restoreSavedTtsVoice() {
  const els = ttsEls();
  if (!els.voice) return;

  try {
    const savedVoice = localStorage.getItem("tttt_tts_voice");
    if (savedVoice && [...els.voice.options].some(o => o.value === savedVoice)) {
      els.voice.value = savedVoice;
    }
  } catch (_) {}
}

function loadTtsVoices() {
  if (!ttsReader.supported) return;
  ttsReader.voices = window.speechSynthesis.getVoices() || [];
  updateVoiceListForGender(false);
  restoreSavedTtsVoice();
}

function updateTtsButtons() {
  const els = ttsEls();
  if (!els.player) return;

  const ready = ttsReader.supported && !!ttsReader.text;

  if (els.play) {
    els.play.disabled = !ready;
    els.play.textContent = ttsReader.speaking && !ttsReader.paused ? "Ⅱ" : "▶";
    els.play.title = ttsReader.speaking && !ttsReader.paused ? "Tạm dừng" : (ttsReader.paused ? "Tiếp tục" : "Nghe");
    els.play.setAttribute("aria-label", els.play.title);
  }

  if (els.stop) els.stop.disabled = !ready || (!ttsReader.speaking && ttsReader.globalPosition <= 0);
  if (els.back15) els.back15.disabled = !ready || ttsReader.globalPosition <= 0;
  if (els.forward15) els.forward15.disabled = !ready || ttsReader.globalPosition >= ttsReader.totalChars;
  if (els.progress) els.progress.disabled = !ready;
}

function cancelCurrentTtsSpeech() {
  ttsReader.serial += 1;
  ttsReader.utterance = null;

  if (ttsReader.supported) {
    try {
      window.speechSynthesis.cancel();
    } catch (_) {}
  }
}

function prepareTtsChapter(text) {
  const els = ttsEls();
  if (!els.player) return;

  cancelCurrentTtsSpeech();

  ttsReader.text = cleanVietnameseText(text || "").trim();
  ttsReader.chunks = splitTextForSpeech(ttsReader.text);
  rebuildTtsChunkMap();
  ttsReader.index = 0;
  ttsReader.offset = 0;
  ttsReader.globalPosition = 0;
  ttsReader.speaking = false;
  ttsReader.paused = false;
  ttsReader.stopped = true;

  if (!ttsReader.supported) {
    els.player.hidden = false;
    setTtsStatus("Trình duyệt này chưa hỗ trợ chức năng nghe truyện.");
    updateTtsProgressUI(false);
    updateTtsButtons();
    return;
  }

  els.player.hidden = !ttsReader.text;

  if (!ttsReader.text) {
    updateTtsButtons();
    return;
  }

  let restored = 0;
  try {
    restored = Number(localStorage.getItem(ttsPositionStorageKey()) || 0);
  } catch (_) {}

  if (restored > 0 && restored < ttsReader.totalChars) {
    setTtsGlobalPosition(restored, false);
    const percent = Math.round((restored / ttsReader.totalChars) * 100);
    setTtsStatus(`Tiếp tục vị trí đã nghe • ${percent}% • ${ttsReader.chunks.length} đoạn`);
  } else {
    setTtsGlobalPosition(0, false);
    const minutes = Math.max(1, Math.round(getTtsEstimatedTotalSeconds() / 60));
    setTtsStatus(`Sẵn sàng đọc • ${ttsReader.chunks.length} đoạn • khoảng ${minutes} phút`);
  }

  updateTtsProgressUI(false);
  updateTtsButtons();
}

function hideTtsPlayer() {
  cancelCurrentTtsSpeech();
  ttsReader.speaking = false;
  ttsReader.paused = false;
  const player = document.getElementById("ttsPlayer");
  if (player) player.hidden = true;
}

function finishTtsChapter() {
  cancelCurrentTtsSpeech();
  ttsReader.speaking = false;
  ttsReader.paused = false;
  ttsReader.stopped = true;
  setTtsGlobalPosition(ttsReader.totalChars, false);

  try {
    localStorage.removeItem(ttsPositionStorageKey());
  } catch (_) {}

  setTtsStatus("✓ Đã nghe hết chương");
  updateTtsProgressUI(false);
  updateTtsButtons();
}

function speakTtsChunk() {
  if (!ttsReader.supported || !ttsReader.speaking || ttsReader.paused) return;

  if (ttsReader.globalPosition >= ttsReader.totalChars || ttsReader.index >= ttsReader.chunks.length) {
    finishTtsChapter();
    return;
  }

  const original = ttsReader.chunks[ttsReader.index];
  const startOffset = Math.max(0, Math.min(original.length, ttsReader.offset || 0));
  const speechText = original.slice(startOffset);

  if (!speechText.trim()) {
    ttsReader.globalPosition = ttsReader.chunkStarts[ttsReader.index] + original.length;
    ttsReader.index += 1;
    ttsReader.offset = 0;
    updateTtsProgressUI();
    setTimeout(speakTtsChunk, 40);
    return;
  }

  const els = ttsEls();
  const utterance = new SpeechSynthesisUtterance(speechText);
  const voice = getPreferredVietnameseVoice();
  const serial = ++ttsReader.serial;

  utterance.lang = voice?.lang || "vi-VN";
  if (voice) utterance.voice = voice;
  utterance.rate = Number(els.rate?.value || 1);
  utterance.pitch = 1;
  utterance.volume = 1;

  utterance.onstart = () => {
    if (serial !== ttsReader.serial) return;
    const progress = Math.min(ttsReader.index + 1, ttsReader.chunks.length);
    setTtsStatus(`Đang nghe • đoạn ${progress}/${ttsReader.chunks.length}`);
    updateTtsButtons();
  };

  // Chrome/Edge thường phát sự kiện boundary theo từng từ. Trên thiết bị không hỗ trợ,
  // thanh vẫn cập nhật chính xác theo từng đoạn khi onend chạy.
  utterance.onboundary = event => {
    if (serial !== ttsReader.serial || ttsReader.dragging) return;
    if (typeof event.charIndex !== "number") return;

    ttsReader.offset = Math.max(0, Math.min(original.length, startOffset + event.charIndex));
    ttsReader.globalPosition = Math.max(
      0,
      Math.min(ttsReader.totalChars, ttsReader.chunkStarts[ttsReader.index] + ttsReader.offset)
    );
    updateTtsProgressUI();
    updateTtsButtons();
  };

  utterance.onend = () => {
    if (serial !== ttsReader.serial || !ttsReader.speaking || ttsReader.paused) return;

    ttsReader.globalPosition = ttsReader.chunkStarts[ttsReader.index] + original.length;
    ttsReader.index += 1;
    ttsReader.offset = 0;
    updateTtsProgressUI();
    updateTtsButtons();

    setTimeout(speakTtsChunk, 70);
  };

  utterance.onerror = event => {
    if (serial !== ttsReader.serial) return;
    if (["canceled", "interrupted"].includes(event.error)) return;

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

  if (ttsReader.globalPosition >= ttsReader.totalChars) {
    setTtsGlobalPosition(0, false);
  }

  if (ttsReader.speaking && ttsReader.paused) {
    resumeTtsReader();
    return;
  }

  if (ttsReader.speaking && !ttsReader.paused) return;

  cancelCurrentTtsSpeech();
  ttsReader.speaking = true;
  ttsReader.paused = false;
  ttsReader.stopped = false;

  setTtsStatus("Đang chuẩn bị giọng đọc...");
  updateTtsButtons();
  setTimeout(speakTtsChunk, 80);
}

function pauseTtsReader() {
  if (!ttsReader.supported || !ttsReader.speaking || ttsReader.paused) return;

  try {
    window.speechSynthesis.pause();
  } catch (_) {}

  ttsReader.paused = true;
  setTtsStatus(`Đã tạm dừng • đoạn ${Math.min(ttsReader.index + 1, ttsReader.chunks.length)}/${ttsReader.chunks.length}`);
  saveTtsPosition(true);
  updateTtsButtons();
}

function resumeTtsReader() {
  if (!ttsReader.supported || !ttsReader.paused) return;

  ttsReader.paused = false;
  ttsReader.speaking = true;
  ttsReader.stopped = false;

  // Nếu utterance vẫn đang được browser giữ khi pause, resume tại đúng từ.
  if (ttsReader.utterance && window.speechSynthesis.paused) {
    try {
      window.speechSynthesis.resume();
      setTtsStatus(`Đang nghe • đoạn ${Math.min(ttsReader.index + 1, ttsReader.chunks.length)}/${ttsReader.chunks.length}`);
      updateTtsButtons();
      return;
    } catch (_) {}
  }

  // Nếu trước đó kéo thanh/đổi giọng khiến utterance đã bị hủy thì đọc lại từ vị trí đã lưu.
  cancelCurrentTtsSpeech();
  ttsReader.speaking = true;
  ttsReader.paused = false;
  setTimeout(speakTtsChunk, 80);
  updateTtsButtons();
}

function toggleTtsPlayPause() {
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
  cancelCurrentTtsSpeech();
  ttsReader.speaking = false;
  ttsReader.paused = false;
  ttsReader.stopped = true;
  ttsReader.index = 0;
  ttsReader.offset = 0;
  ttsReader.globalPosition = 0;

  try {
    localStorage.removeItem(ttsPositionStorageKey());
  } catch (_) {}

  updateTtsProgressUI(false);

  if (showStatus && ttsReader.text) {
    setTtsStatus("Đã dừng • bấm ▶ để nghe lại từ đầu");
  }

  updateTtsButtons();
}

function restartTtsAtCurrentPosition() {
  if (!ttsReader.speaking) {
    updateTtsProgressUI(false);
    return;
  }

  const wasPaused = ttsReader.paused;
  cancelCurrentTtsSpeech();
  ttsReader.speaking = true;
  ttsReader.paused = wasPaused;

  if (wasPaused) {
    setTtsStatus(`Đã tạm dừng • đoạn ${Math.min(ttsReader.index + 1, ttsReader.chunks.length)}/${ttsReader.chunks.length}`);
    updateTtsButtons();
    return;
  }

  setTimeout(speakTtsChunk, 80);
}

function seekTtsSeconds(seconds) {
  if (!ttsReader.text || !ttsReader.totalChars) return;

  const totalSeconds = getTtsEstimatedTotalSeconds();
  if (!totalSeconds) return;

  const charDelta = (ttsReader.totalChars / totalSeconds) * Number(seconds || 0);
  const wasSpeaking = ttsReader.speaking;
  const wasPaused = ttsReader.paused;

  cancelCurrentTtsSpeech();
  setTtsGlobalPosition(ttsReader.globalPosition + charDelta, false);

  ttsReader.speaking = wasSpeaking;
  ttsReader.paused = wasPaused;

  updateTtsProgressUI();
  updateTtsButtons();

  if (wasSpeaking && !wasPaused) {
    ttsReader.speaking = true;
    ttsReader.paused = false;
    setTimeout(speakTtsChunk, 80);
  } else if (wasPaused) {
    setTtsStatus(`Đã tạm dừng • đoạn ${Math.min(ttsReader.index + 1, ttsReader.chunks.length)}/${ttsReader.chunks.length}`);
  }
}

function beginTtsProgressDrag() {
  if (ttsReader.dragging) return;

  ttsReader.dragging = true;
  ttsReader.dragWasPlaying = ttsReader.speaking && !ttsReader.paused;
  ttsReader.dragWasPaused = ttsReader.speaking && ttsReader.paused;

  if (ttsReader.speaking) cancelCurrentTtsSpeech();
}

function previewTtsProgressFromSlider() {
  const els = ttsEls();
  if (!els.progress || !ttsReader.totalChars) return;

  beginTtsProgressDrag();

  const ratio = Math.max(0, Math.min(1, Number(els.progress.value || 0) / 1000));
  setTtsGlobalPosition(ratio * ttsReader.totalChars, false);
  updateTtsProgressUI(false);
  updateTtsButtons();
}

function commitTtsProgressDrag() {
  if (!ttsReader.dragging) return;

  const wasPlaying = ttsReader.dragWasPlaying;
  const wasPaused = ttsReader.dragWasPaused;

  ttsReader.dragging = false;
  ttsReader.dragWasPlaying = false;
  ttsReader.dragWasPaused = false;
  saveTtsPosition(true);

  if (wasPlaying) {
    ttsReader.speaking = true;
    ttsReader.paused = false;
    ttsReader.stopped = false;
    setTimeout(speakTtsChunk, 80);
  } else if (wasPaused) {
    ttsReader.speaking = true;
    ttsReader.paused = true;
    ttsReader.stopped = false;
    setTtsStatus(`Đã tạm dừng • đoạn ${Math.min(ttsReader.index + 1, ttsReader.chunks.length)}/${ttsReader.chunks.length}`);
  } else {
    ttsReader.speaking = false;
    ttsReader.paused = false;
  }

  updateTtsButtons();
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

    updateVoiceListForGender(false);
    restoreSavedTtsVoice();
  } catch (_) {}

  els.play?.addEventListener("click", toggleTtsPlayPause);
  els.stop?.addEventListener("click", () => stopTtsReader(true));
  els.back15?.addEventListener("click", () => seekTtsSeconds(-15));
  els.forward15?.addEventListener("click", () => seekTtsSeconds(15));

  els.progress?.addEventListener("input", previewTtsProgressFromSlider);
  els.progress?.addEventListener("change", commitTtsProgressDrag);
  els.progress?.addEventListener("pointerup", commitTtsProgressDrag);
  els.progress?.addEventListener("touchend", commitTtsProgressDrag, { passive: true });

  els.rate?.addEventListener("change", () => {
    try {
      localStorage.setItem("tttt_tts_rate", els.rate.value);
    } catch (_) {}

    updateTtsProgressUI(false);
    restartTtsAtCurrentPosition();
  });

  els.gender?.addEventListener("change", () => {
    try {
      localStorage.setItem("tttt_tts_gender", els.gender.value);
      localStorage.removeItem("tttt_tts_voice");
    } catch (_) {}

    updateVoiceListForGender(true);
    restartTtsAtCurrentPosition();
  });

  els.voice?.addEventListener("change", () => {
    try {
      localStorage.setItem("tttt_tts_voice", els.voice.value);
    } catch (_) {}

    restartTtsAtCurrentPosition();
  });

  window.addEventListener("beforeunload", () => {
    saveTtsPosition(true);
    cancelCurrentTtsSpeech();
  });

  updateTtsProgressUI(false);
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
