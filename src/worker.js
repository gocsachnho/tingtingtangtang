const SUPABASE_URL = "https://mxapwgnjelysysnzgbyn.supabase.co";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function secureEqual(a, b) {
  a = String(a || "");
  b = String(b || "");
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFC")
    .toUpperCase()
    .replace(/[‐‑‒–—―]/g, "-");
}

function extractOrderCodes(payload) {
  const joined = [
    payload?.code,
    payload?.content,
    payload?.description
  ].filter(Boolean).join(" ");

  const text = normalizeText(joined);

  // Hỗ trợ tiền tố tùy chỉnh (TTTT, PAY, TRUYEN...) + mã 8-24 ký tự.
  const matches = text.match(/\b[A-Z0-9]{2,24}-[A-Z0-9]{8,24}\b/g) || [];
  return [...new Set(matches)];
}

function makeUnlockCode() {
  return "TTTT-" + crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase();
}

function supabaseHeaders(env, extra = {}) {
  const key = env.SUPABASE_SECRET_KEY;
  const headers = {
    "apikey": key,
    "content-type": "application/json",
    ...extra
  };

  // Hỗ trợ cả legacy service_role JWT nếu người dùng chưa chuyển sang sb_secret_...
  if (String(key || "").startsWith("eyJ")) {
    headers["authorization"] = `Bearer ${key}`;
  }

  return headers;
}

async function sbFetch(path, env, options = {}) {
  if (!env.SUPABASE_SECRET_KEY) {
    throw new Error("Missing SUPABASE_SECRET_KEY");
  }

  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: supabaseHeaders(env, options.headers || {})
  });

  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!response.ok) {
    throw new Error(`Supabase ${response.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
  }

  return body;
}

async function findOrderByCode(orderCode, env) {
  const q = encodeURIComponent(orderCode);
  const rows = await sbFetch(
    `/rest/v1/payment_orders?order_code=eq.${q}&select=id,story_id,order_code,amount_vnd,status,unlock_code`,
    env,
    { method: "GET" }
  );
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function getPaywall(storyId, env) {
  const q = encodeURIComponent(storyId);
  const rows = await sbFetch(
    `/rest/v1/story_paywalls?story_id=eq.${q}&select=story_id,bank_account,enabled`,
    env,
    { method: "GET" }
  );
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function markOrderPaid(order, payload, env) {
  if (order.status === "paid") {
    return { alreadyPaid: true, unlockCode: order.unlock_code };
  }

  if (order.status !== "pending") {
    return { ignored: true };
  }

  const receivedAmount = Number(payload?.transferAmount || 0);
  const expectedAmount = Number(order.amount_vnd || 0);

  if (!Number.isFinite(receivedAmount) || receivedAmount !== expectedAmount) {
    return { amountMismatch: true };
  }

  const paywall = await getPaywall(order.story_id, env);
  const configuredAccount = String(paywall?.bank_account || "").replace(/\s+/g, "");
  const incomingAccount = String(payload?.accountNumber || "").replace(/\s+/g, "");

  // Nếu Admin đã khai báo số tài khoản thì webhook phải về đúng tài khoản đó.
  if (configuredAccount && incomingAccount && configuredAccount !== incomingAccount) {
    return { accountMismatch: true };
  }

  const unlockCode = order.unlock_code || makeUnlockCode();
  const txId = payload?.id != null ? String(payload.id) : null;
  const reference = String(payload?.referenceCode || "").trim() || null;

  const patchBody = {
    status: "paid",
    unlock_code: unlockCode,
    paid_at: new Date().toISOString(),
    payment_provider: "sepay",
    provider_transaction_id: txId,
    payment_reference: reference,
    payment_received_amount: receivedAmount
  };

  // Chỉ update khi vẫn pending để webhook retry không tạo trạng thái trùng.
  const q = encodeURIComponent(order.id);
  const updated = await sbFetch(
    `/rest/v1/payment_orders?id=eq.${q}&status=eq.pending`,
    env,
    {
      method: "PATCH",
      headers: { "prefer": "return=representation" },
      body: JSON.stringify(patchBody)
    }
  );

  if (Array.isArray(updated) && updated.length) {
    return { paid: true, unlockCode };
  }

  // Có thể webhook khác vừa xử lý xong.
  return { alreadyProcessed: true };
}

async function handleSePayWebhook(request, env) {
  if (request.method !== "POST") {
    return json({ success: false, message: "Method not allowed" }, 405);
  }

  if (!env.SEPAY_API_KEY) {
    return json({ success: false, message: "Webhook secret is not configured" }, 500);
  }

  const auth = request.headers.get("authorization") || "";
  const expected = `Apikey ${env.SEPAY_API_KEY}`;

  if (!secureEqual(auth, expected)) {
    return json({ success: false, message: "Unauthorized" }, 401);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ success: false, message: "Invalid JSON" }, 400);
  }

  // Chỉ xử lý tiền vào.
  if (String(payload?.transferType || "").toLowerCase() !== "in") {
    return json({ success: true });
  }

  const candidates = extractOrderCodes(payload);
  if (!candidates.length) {
    // Giao dịch không liên quan website: xác nhận nhận webhook nhưng không làm gì.
    return json({ success: true });
  }

  try {
    for (const code of candidates) {
      const order = await findOrderByCode(code, env);
      if (!order) continue;

      await markOrderPaid(order, payload, env);

      // Một giao dịch chỉ cần khớp một đơn.
      break;
    }

    // SePay yêu cầu HTTP 200/201 và JSON success=true.
    return json({ success: true });
  } catch (error) {
    console.error("SePay webhook error:", error);
    // Trả 500 để SePay tự retry.
    return json({ success: false }, 500);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/sepay-webhook") {
      return handleSePayWebhook(request, env);
    }

    if (url.pathname === "/api/payment-health") {
      return json({
        ok: true,
        sepayConfigured: Boolean(env.SEPAY_API_KEY),
        supabaseConfigured: Boolean(env.SUPABASE_SECRET_KEY)
      });
    }

    return env.ASSETS.fetch(request);
  }
};
