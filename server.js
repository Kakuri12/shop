const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT_DIR = __dirname;
loadEnvFile(path.join(ROOT_DIR, ".env"));
const SERVERLESS_RUNTIME = Boolean(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);
const DATA_DIR = process.env.DATA_DIR || (SERVERLESS_RUNTIME ? path.join(os.tmpdir(), "shora-store-data") : path.join(ROOT_DIR, "data"));
const STORE_PATH = path.join(DATA_DIR, "store.json");
const PORT = Number(process.env.PORT || 3000);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || (SERVERLESS_RUNTIME ? "" : "local-admin-token");
const AUTO_ISSUE_KEYS = process.env.AUTO_ISSUE_KEYS !== "false";
const TRUEMONEY_RECEIVER_PHONE = process.env.TRUEMONEY_RECEIVER_PHONE || "";
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || "";
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || "";
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || `http://localhost:${PORT}/auth/discord/callback`;
const SESSION_COOKIE = "shora_session";
const OAUTH_STATE_COOKIE = "shora_discord_state";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const SESSION_SECRET = process.env.SESSION_SECRET || ADMIN_TOKEN || DISCORD_CLIENT_SECRET || "local-session-secret";
const COOKIE_SECURE = process.env.COOKIE_SECURE === "true";
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || process.env.SCRIPT_API_BASE_URL || "").replace(/\/+$/, "");
const SCRIPT_SOURCE_URL = process.env.SCRIPT_SOURCE_URL || "";
const SCRIPT_SOURCE_FILE = process.env.SCRIPT_SOURCE_FILE || "scripts/source.lua";
const SCRIPT_KEY_PREFIX = (process.env.SCRIPT_KEY_PREFIX || "SHORA").toUpperCase().replace(/[^A-Z0-9]/g, "") || "SHORA";
const sessions = new Map();
const topupLocks = new Set();

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  let previousKey = "";
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) {
      if (previousKey && process.env[previousKey] !== undefined) {
        process.env[previousKey] += trimmed;
      }
      continue;
    }
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (!key || process.env[key] !== undefined) continue;
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
    previousKey = key;
  }
}

const plans = [
  {
    id: "daily",
    name: "Daily",
    price: 99,
    currency: "THB",
    durationDays: 1,
    devicesLimit: 1,
  },
  {
    id: "monthly",
    name: "Monthly Pro",
    price: 499,
    currency: "THB",
    durationDays: 30,
    devicesLimit: 3,
  },
  {
    id: "lifetime",
    name: "Lifetime",
    price: 1990,
    currency: "THB",
    durationDays: null,
    devicesLimit: 3,
  },
];

const categories = [
  {
    slug: "xenon-hub-v1",
    name: "Shora Hub V1",
    description: "Premium scripts access package with daily, monthly, and lifetime keys.",
    image: "/assets/xenon-hub-v1.png",
    itemCount: 5,
  },
  {
    slug: "storm-launcher-pc",
    name: "Storm Launcher (PC)",
    description: "PC launcher access, farming tools, and priority updates.",
    image: "/assets/storm-launcher-pc.png",
    itemCount: 3,
  },
  {
    slug: "premium-scripts",
    name: "Premium Scripts",
    description: "Curated premium script bundles and private release keys.",
    image: "/assets/premium-scripts.png",
    itemCount: 5,
  },
];

const catalogProducts = [
  {
    id: "xenon-daily",
    categorySlug: "xenon-hub-v1",
    name: "Shora Hub V1 - Daily",
    badge: "24H",
    price: 99,
    currency: "THB",
    durationDays: 1,
    devicesLimit: 1,
    features: ["ใช้งาน 24 ชั่วโมง", "รับคีย์ทันที", "เหมาะสำหรับทดลอง"],
  },
  {
    id: "shora-test-free",
    categorySlug: "xenon-hub-v1",
    name: "Shora Test Key - Free",
    badge: "TEST",
    price: 0,
    currency: "THB",
    durationDays: 1,
    devicesLimit: 1,
    features: ["ทดสอบระบบสั่งซื้อ", "ไม่ต้องใช้เครดิต", "ออกคีย์ทดสอบจริง"],
  },
  {
    id: "xenon-weekly",
    categorySlug: "xenon-hub-v1",
    name: "Shora Hub V1 - Weekly",
    badge: "7D",
    price: 249,
    currency: "THB",
    durationDays: 7,
    devicesLimit: 1,
    features: ["ใช้งาน 7 วัน", "อัปเดตอัตโนมัติ", "Basic support"],
  },
  {
    id: "xenon-monthly",
    categorySlug: "xenon-hub-v1",
    name: "Shora Hub V1 - Monthly",
    badge: "HOT",
    price: 499,
    currency: "THB",
    durationDays: 30,
    devicesLimit: 3,
    features: ["ใช้งาน 30 วัน", "Priority updates", "ย้ายเครื่องได้ตามเงื่อนไข"],
  },
  {
    id: "xenon-lifetime",
    categorySlug: "xenon-hub-v1",
    name: "Shora Hub V1 - Lifetime",
    badge: "VIP",
    price: 1990,
    currency: "THB",
    durationDays: null,
    devicesLimit: 3,
    features: ["ใช้งานถาวร", "Lifetime updates", "VIP support"],
  },
  {
    id: "storm-daily",
    categorySlug: "storm-launcher-pc",
    name: "Storm Launcher - Daily",
    badge: "24H",
    price: 89,
    currency: "THB",
    durationDays: 1,
    devicesLimit: 1,
    features: ["ใช้งาน 24 ชั่วโมง", "PC launcher access", "รับคีย์ทันที"],
  },
  {
    id: "storm-monthly",
    categorySlug: "storm-launcher-pc",
    name: "Storm Launcher - Monthly",
    badge: "PRO",
    price: 399,
    currency: "THB",
    durationDays: 30,
    devicesLimit: 2,
    features: ["ใช้งาน 30 วัน", "Priority updates", "Support channel"],
  },
  {
    id: "storm-lifetime",
    categorySlug: "storm-launcher-pc",
    name: "Storm Launcher - Lifetime",
    badge: "VIP",
    price: 1590,
    currency: "THB",
    durationDays: null,
    devicesLimit: 2,
    features: ["ใช้งานถาวร", "Lifetime updates", "VIP support"],
  },
  {
    id: "scripts-monthly",
    categorySlug: "premium-scripts",
    name: "Premium Scripts - Monthly",
    badge: "PRO",
    price: 349,
    currency: "THB",
    durationDays: 30,
    devicesLimit: 1,
    features: ["ใช้งาน 30 วัน", "Private scripts", "อัปเดตรายสัปดาห์"],
  },
  {
    id: "scripts-bundle",
    categorySlug: "premium-scripts",
    name: "Premium Scripts - Bundle",
    badge: "BUNDLE",
    price: 799,
    currency: "THB",
    durationDays: 60,
    devicesLimit: 2,
    features: ["ใช้งาน 60 วัน", "รวม 5 สคริปต์", "Priority support"],
  },
  {
    id: "scripts-lifetime",
    categorySlug: "premium-scripts",
    name: "Premium Scripts - Lifetime",
    badge: "VIP",
    price: 1290,
    currency: "THB",
    durationDays: null,
    devicesLimit: 2,
    features: ["ใช้งานถาวร", "Private release access", "VIP support"],
  },
];

const defaultProductStocks = {
  "xenon-daily": 35,
  "shora-test-free": 50,
  "xenon-weekly": 28,
  "xenon-monthly": 18,
  "xenon-lifetime": 8,
  "storm-daily": 43,
  "storm-monthly": 25,
  "storm-lifetime": 9,
  "scripts-monthly": 36,
  "scripts-bundle": 21,
  "scripts-lifetime": 7,
};

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
};

function nowIso() {
  return new Date().toISOString();
}

function addDays(days) {
  if (days === null || days === undefined) return null;
  const expires = new Date();
  expires.setDate(expires.getDate() + days);
  return expires.toISOString();
}

function ensureStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  if (fs.existsSync(STORE_PATH)) return;

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const seed = {
    keys: [
      {
        key: "XK-DEMO-2026",
        planId: "lifetime",
        planName: "Lifetime",
        price: 1990,
        currency: "THB",
        status: "active",
        customerName: "Demo Customer",
        contact: "demo@example.com",
        orderId: "seed_lifetime",
        devicesLimit: 3,
        activations: [{ deviceId: "demo-device", activatedAt: now.toISOString() }],
        createdAt: now.toISOString(),
        expiresAt: null,
        note: "Seed lifetime key",
      },
      {
        key: "XK-TRIAL-24H",
        planId: "daily",
        planName: "Daily",
        price: 99,
        currency: "THB",
        status: "active",
        customerName: "Trial Customer",
        contact: "trial@example.com",
        orderId: "seed_daily",
        devicesLimit: 1,
        activations: [{ deviceId: "trial-device", activatedAt: now.toISOString() }],
        createdAt: now.toISOString(),
        expiresAt: tomorrow.toISOString(),
        note: "Seed 24 hour key",
      },
      {
        key: "XK-EXPIRED-00",
        planId: "monthly",
        planName: "Monthly Pro",
        price: 499,
        currency: "THB",
        status: "active",
        customerName: "Expired Customer",
        contact: "expired@example.com",
        orderId: "seed_expired",
        devicesLimit: 1,
        activations: [],
        createdAt: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000).toISOString(),
        expiresAt: yesterday.toISOString(),
        note: "Seed expired key",
      },
    ],
    orders: [
      {
        id: "seed_lifetime",
        planId: "lifetime",
        planName: "Lifetime",
        amount: 1990,
        currency: "THB",
        status: "paid_seed",
        customerName: "Demo Customer",
        contact: "demo@example.com",
        paymentMethod: "seed",
        licenseKey: "XK-DEMO-2026",
        createdAt: now.toISOString(),
      },
      {
        id: "seed_daily",
        planId: "daily",
        planName: "Daily",
        amount: 99,
        currency: "THB",
        status: "paid_seed",
        customerName: "Trial Customer",
        contact: "trial@example.com",
        paymentMethod: "seed",
        licenseKey: "XK-TRIAL-24H",
        createdAt: now.toISOString(),
      },
      {
        id: "seed_expired",
        planId: "monthly",
        planName: "Monthly Pro",
        amount: 499,
        currency: "THB",
        status: "paid_seed",
        customerName: "Expired Customer",
        contact: "expired@example.com",
        paymentMethod: "seed",
        licenseKey: "XK-EXPIRED-00",
        createdAt: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
  };

  saveStore(seed);
}

function readStore() {
  ensureStore();
  return upgradeStore(JSON.parse(fs.readFileSync(STORE_PATH, "utf8").replace(/^\uFEFF/, "")));
}

function upgradeStore(store) {
  if (!store || typeof store !== "object") return { keys: [], orders: [], topups: [], wallets: {}, products: [], inventory: {}, deletedProductIds: [] };
  if (!Array.isArray(store.keys)) store.keys = [];
  if (!Array.isArray(store.orders)) store.orders = [];
  if (!Array.isArray(store.topups)) store.topups = [];
  if (!Array.isArray(store.products)) store.products = [];
  if (!store.inventory || typeof store.inventory !== "object" || Array.isArray(store.inventory)) store.inventory = {};
  if (!Array.isArray(store.deletedProductIds)) store.deletedProductIds = [];
  if (!store.wallets || typeof store.wallets !== "object" || Array.isArray(store.wallets)) store.wallets = {};
  return store;
}

function saveStore(store) {
  upgradeStore(store);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tempPath = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  fs.renameSync(tempPath, STORE_PATH);
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function sendHtml(res, status, html) {
  res.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(html);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function sendRedirect(res, location, status = 302) {
  res.writeHead(status, {
    Location: location,
    "Cache-Control": "no-store",
  });
  res.end();
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return header.split(";").reduce((cookies, part) => {
    const index = part.indexOf("=");
    if (index === -1) return cookies;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!name) return cookies;
    try {
      cookies[name] = decodeURIComponent(value);
    } catch {
      cookies[name] = value;
    }
    return cookies;
  }, {});
}

function appendSetCookie(res, cookie) {
  const existing = res.getHeader("Set-Cookie");
  if (!existing) {
    res.setHeader("Set-Cookie", cookie);
    return;
  }
  res.setHeader("Set-Cookie", Array.isArray(existing) ? [...existing, cookie] : [existing, cookie]);
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path || "/"}`);
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.httpOnly !== false) parts.push("HttpOnly");
  parts.push(`SameSite=${options.sameSite || "Lax"}`);
  if (options.secure || COOKIE_SECURE) parts.push("Secure");
  return parts.join("; ");
}

function setCookie(res, name, value, options = {}) {
  appendSetCookie(res, serializeCookie(name, value, options));
}

function clearCookie(res, name) {
  setCookie(res, name, "", { maxAge: 0 });
}

function discordConfigured() {
  return Boolean(DISCORD_CLIENT_ID && DISCORD_CLIENT_SECRET);
}

function discordAvatarUrl(user) {
  if (!user || !user.id || !user.avatar) return null;
  const extension = user.avatar.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${extension}?size=64`;
}

function publicDiscordUser(user) {
  const displayName = user.global_name || user.username || "Discord";
  return {
    id: user.id,
    username: user.username,
    globalName: user.global_name || "",
    displayName,
    avatarUrl: discordAvatarUrl(user),
  };
}

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function parseBase64UrlJson(value) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
}

function signSessionPayload(encodedPayload) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(encodedPayload).digest("base64url");
}

function safeEqualString(left, right) {
  const leftBuffer = Buffer.from(String(left || ""), "utf8");
  const rightBuffer = Buffer.from(String(right || ""), "utf8");
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function sessionUser(user) {
  return {
    id: String(user.id || ""),
    username: String(user.username || ""),
    global_name: String(user.global_name || user.globalName || ""),
    avatar: user.avatar ? String(user.avatar) : null,
  };
}

function createSignedSession(user) {
  const createdAt = Date.now();
  const payload = {
    v: 1,
    user: sessionUser(user),
    iat: createdAt,
    exp: createdAt + SESSION_MAX_AGE_SECONDS * 1000,
  };
  const encodedPayload = base64UrlJson(payload);
  return `v1.${encodedPayload}.${signSessionPayload(encodedPayload)}`;
}

function readSignedSession(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;

  const [, encodedPayload, signature] = parts;
  if (!safeEqualString(signature, signSessionPayload(encodedPayload))) return null;

  try {
    const payload = parseBase64UrlJson(encodedPayload);
    if (!payload || payload.v !== 1 || !payload.user?.id || Number(payload.exp || 0) <= Date.now()) {
      return null;
    }
    return {
      id: token,
      user: sessionUser(payload.user),
      createdAt: Number(payload.iat || 0),
      expiresAt: Number(payload.exp || 0),
    };
  } catch {
    return null;
  }
}

function createSession(user) {
  const sessionId = createSignedSession(user);
  sessions.set(sessionId, {
    user: sessionUser(user),
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  });
  return sessionId;
}

function sessionFromRequest(req) {
  const sessionId = parseCookies(req)[SESSION_COOKIE];
  if (!sessionId) return null;

  const signedSession = readSignedSession(sessionId);
  if (signedSession) return signedSession;

  const session = sessions.get(sessionId);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(sessionId);
    return null;
  }
  return { id: sessionId, ...session };
}

function discordSetupPage() {
  const redirectUri = escapeHtml(DISCORD_REDIRECT_URI);
  return `<!doctype html>
<html lang="th">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Discord Login Setup</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #070b12; color: #f5f7fb; font-family: Arial, sans-serif; }
      main { width: min(680px, calc(100% - 32px)); border: 1px solid rgba(255,255,255,.16); border-radius: 22px; padding: 28px; background: linear-gradient(145deg, rgba(255,255,255,.1), rgba(255,255,255,.04)); box-shadow: 0 24px 80px rgba(0,0,0,.45); }
      h1 { margin: 0 0 10px; font-size: 28px; }
      p { color: #b9c2d0; line-height: 1.7; }
      code, pre { color: #d9f6ff; }
      pre { overflow: auto; padding: 16px; border-radius: 14px; background: rgba(0,0,0,.38); }
      a { color: #6be6ff; }
    </style>
  </head>
  <body>
    <main>
      <h1>Discord login is not configured yet</h1>
      <p>Create an OAuth2 app in the Discord Developer Portal, add this redirect URL, then restart the server with these env values.</p>
      <pre>$env:DISCORD_CLIENT_ID="your-client-id"
$env:DISCORD_CLIENT_SECRET="your-client-secret"
$env:DISCORD_REDIRECT_URI="${redirectUri}"
npm start</pre>
      <p>Redirect URL: <code>${redirectUri}</code></p>
      <p><a href="/">Back to store</a></p>
    </main>
  </body>
</html>`;
}

async function exchangeDiscordCode(code) {
  const body = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    client_secret: DISCORD_CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: DISCORD_REDIRECT_URI,
  });

  const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const tokenData = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !tokenData.access_token) {
    throw new Error(tokenData.error_description || tokenData.error || "Discord token exchange failed");
  }

  const userResponse = await fetch("https://discord.com/api/users/@me", {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${tokenData.access_token}`,
    },
  });
  const userData = await userResponse.json().catch(() => ({}));
  if (!userResponse.ok || !userData.id) {
    throw new Error(userData.message || "Discord user lookup failed");
  }

  return userData;
}

async function handleAuth(req, res, url) {
  if (req.method === "GET" && url.pathname === "/auth/discord") {
    if (!discordConfigured()) {
      sendHtml(res, 200, discordSetupPage());
      return true;
    }

    const state = crypto.randomBytes(18).toString("hex");
    const authorizeUrl = new URL("https://discord.com/oauth2/authorize");
    authorizeUrl.searchParams.set("client_id", DISCORD_CLIENT_ID);
    authorizeUrl.searchParams.set("redirect_uri", DISCORD_REDIRECT_URI);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("scope", "identify");
    authorizeUrl.searchParams.set("state", state);

    setCookie(res, OAUTH_STATE_COOKIE, state, { maxAge: 600 });
    sendRedirect(res, authorizeUrl.toString());
    return true;
  }

  if (req.method === "GET" && url.pathname === "/auth/discord/callback") {
    if (!discordConfigured()) {
      sendHtml(res, 200, discordSetupPage());
      return true;
    }

    const cookies = parseCookies(req);
    const code = url.searchParams.get("code") || "";
    const state = url.searchParams.get("state") || "";
    if (!code || !state || state !== cookies[OAUTH_STATE_COOKIE]) {
      clearCookie(res, OAUTH_STATE_COOKIE);
      sendHtml(res, 400, "<h1>Invalid Discord login request</h1><p>Please go back and try logging in again.</p>");
      return true;
    }

    try {
      const user = await exchangeDiscordCode(code);
      const sessionId = createSession(user);
      clearCookie(res, OAUTH_STATE_COOKIE);
      setCookie(res, SESSION_COOKIE, sessionId, { maxAge: SESSION_MAX_AGE_SECONDS });
      sendRedirect(res, "/");
    } catch (error) {
      clearCookie(res, OAUTH_STATE_COOKIE);
      sendHtml(res, 502, `<h1>Discord login failed</h1><p>${escapeHtml(error.message || error)}</p><p><a href="/">Back to store</a></p>`);
    }
    return true;
  }

  if (req.method === "GET" && url.pathname === "/auth/logout") {
    const sessionId = parseCookies(req)[SESSION_COOKIE];
    if (sessionId) sessions.delete(sessionId);
    clearCookie(res, SESSION_COOKIE);
    sendRedirect(res, "/");
    return true;
  }

  return false;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2_500_000) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function findPlan(planId) {
  const normalized = String(planId || "").toLowerCase();
  return plans.find((plan) => plan.id === normalized || plan.name.toLowerCase() === normalized);
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function visibleProduct(product) {
  return product && product.hidden !== true && product.status !== "hidden";
}

function deletedProductSet(store) {
  return new Set(Array.isArray(store?.deletedProductIds) ? store.deletedProductIds : []);
}

function isProductDeleted(store, productId) {
  return deletedProductSet(store).has(String(productId || ""));
}

function baseProductStock(product) {
  const value = product?.stock ?? defaultProductStocks[product?.id] ?? 35;
  const stock = Math.round(Number(value));
  return Number.isFinite(stock) ? Math.max(0, stock) : 0;
}

function productStockForStore(store, product) {
  const inventoryValue = store?.inventory?.[product.id];
  if (inventoryValue !== undefined) {
    const stock = Math.round(Number(inventoryValue));
    return Number.isFinite(stock) ? Math.max(0, stock) : 0;
  }
  return baseProductStock(product);
}

function productWithStock(store, product) {
  return {
    ...product,
    stock: productStockForStore(store, product),
  };
}

function catalogForStore(store = readStore()) {
  const deletedIds = deletedProductSet(store);
  const defaultProducts = catalogProducts.filter((product) => !deletedIds.has(product.id));
  const customProducts = Array.isArray(store.products) ? store.products.filter((product) => visibleProduct(product) && !deletedIds.has(product.id)) : [];
  const products = [...defaultProducts, ...customProducts].map((product) => productWithStock(store, product));
  const categoryList = categories.map((category) => ({
    ...category,
    itemCount: products.filter((product) => product.categorySlug === category.slug).length,
  }));
  return { categories: categoryList, products };
}

function customProductsForAdmin(store = readStore()) {
  return Array.isArray(store.products) ? store.products : [];
}

function productsForAdmin(store = readStore()) {
  return [
    ...catalogProducts.map((product) => adminProduct(product, store, "default")),
    ...customProductsForAdmin(store).map((product) => adminProduct(product, store, "custom")),
  ];
}

function adminProduct(product, store, source = "custom") {
  const deleted = isProductDeleted(store, product.id);
  return {
    id: product.id,
    categorySlug: product.categorySlug,
    name: product.name,
    badge: product.badge || "KEY",
    price: Number(product.price || 0),
    currency: product.currency || "THB",
    durationDays: product.durationDays ?? null,
    devicesLimit: Number(product.devicesLimit || 1),
    stock: store ? productStockForStore(store, product) : baseProductStock(product),
    image: product.image || "",
    features: Array.isArray(product.features) ? product.features : [],
    source,
    hidden: deleted || product.hidden === true || product.status === "hidden",
    deleted,
    createdAt: product.createdAt || null,
    updatedAt: product.updatedAt || null,
  };
}

function normalizeProductFeatures(value) {
  const source = Array.isArray(value) ? value.join("\n") : String(value || "");
  return source
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function normalizeAdminProduct(body, existingProduct, usedIds) {
  const categorySlug = String(body.categorySlug || existingProduct?.categorySlug || "").trim();
  const category = categories.find((item) => item.slug === categorySlug);
  if (!category) throw new Error("Invalid category");

  const name = String(body.name || existingProduct?.name || "").trim();
  if (!name) throw new Error("Product name is required");

  const requestedId = slugify(body.id || existingProduct?.id || name);
  const id = existingProduct?.id || requestedId || `product-${crypto.randomBytes(4).toString("hex")}`;
  if (!existingProduct && usedIds.has(id)) throw new Error("Product ID already exists");

  const price = Math.max(0, Number(body.price ?? existingProduct?.price ?? 0));
  const durationInput = body.durationDays ?? existingProduct?.durationDays ?? "";
  const durationNumber = Number(durationInput);
  const durationDays = durationInput === "" || !Number.isFinite(durationNumber) || durationNumber <= 0 ? null : Math.round(durationNumber);
  const devicesLimit = Math.max(1, Math.min(10, Math.round(Number(body.devicesLimit ?? existingProduct?.devicesLimit ?? 1))));
  const stock = Math.max(0, Math.round(Number(body.stock ?? existingProduct?.stock ?? 35)));
  const features = normalizeProductFeatures(body.features ?? existingProduct?.features);
  const timestamp = nowIso();

  return {
    id,
    categorySlug,
    name,
    badge: String(body.badge || existingProduct?.badge || "KEY").trim().slice(0, 16) || "KEY",
    price,
    currency: "THB",
    durationDays,
    devicesLimit,
    stock,
    image: String(body.image || existingProduct?.image || category.image || "/assets/site-logo.png").trim(),
    features: features.length ? features : ["รับคีย์ทันที", "ใช้งานได้หลังซื้อสำเร็จ"],
    hidden: body.hidden === true || body.hidden === "true" || existingProduct?.hidden === true,
    source: "admin",
    createdAt: existingProduct?.createdAt || timestamp,
    updatedAt: timestamp,
  };
}

function findProduct(productId, store = readStore()) {
  const normalized = String(productId || "").toLowerCase();
  return catalogForStore(store).products.find((product) => product.id === normalized);
}

function amountToSatang(value) {
  const normalized = String(value ?? "").replace(/,/g, "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return 0;
  const [baht, satang = ""] = normalized.split(".");
  return Number(baht) * 100 + Number(satang.padEnd(2, "0").slice(0, 2));
}

function satangToBaht(value) {
  return Number((Number(value || 0) / 100).toFixed(2));
}

function normalizeThaiMobile(value) {
  const digits = String(value || "").replace(/\D/g, "");
  const local = digits.startsWith("66") && digits.length === 11 ? `0${digits.slice(2)}` : digits;
  return /^0[689]\d{8}$/.test(local) ? local : "";
}

function extractTrueMoneyVoucherHash(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    const parsed = new URL(raw);
    const fromQuery = parsed.searchParams.get("v");
    if (fromQuery) return sanitizeVoucherHash(fromQuery);
  } catch {
    // Accept a pasted voucher code without the full URL.
  }

  const queryMatch = raw.match(/[?&]v=([A-Za-z0-9]+)/);
  if (queryMatch) return sanitizeVoucherHash(queryMatch[1]);
  return sanitizeVoucherHash(raw);
}

function sanitizeVoucherHash(value) {
  const hash = String(value || "").trim();
  return /^[A-Za-z0-9]{16,80}$/.test(hash) ? hash : "";
}

function walletForUser(store, user) {
  const userId = String(user.id);
  if (!store.wallets[userId]) {
    store.wallets[userId] = {
      userId,
      balanceSatang: 0,
      currency: "THB",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
  }
  return store.wallets[userId];
}

function publicWallet(wallet) {
  return {
    balance: satangToBaht(wallet.balanceSatang),
    balanceSatang: Number(wallet.balanceSatang || 0),
    currency: wallet.currency || "THB",
    updatedAt: wallet.updatedAt || null,
  };
}

function publicTopup(topup) {
  return {
    id: topup.id,
    provider: topup.provider,
    amount: satangToBaht(topup.amountSatang),
    amountSatang: topup.amountSatang,
    currency: topup.currency,
    status: topup.status,
    createdAt: topup.createdAt,
  };
}

function publicOrder(order) {
  return {
    id: order.id,
    productId: order.productId || order.planId || "",
    productName: order.planName || order.productName || "-",
    quantity: Number(order.quantity || 1),
    amount: Number(order.amount || 0),
    amountSatang: Number(order.amountSatang || amountToSatang(order.amount || 0)),
    currency: order.currency || "THB",
    status: order.status || "",
    licenseKey: order.licenseKey || "",
    createdAt: order.createdAt || null,
  };
}

function publicOrderForUser(order, userId, req) {
  const summary = publicOrder(order);
  return {
    ...summary,
    scriptLoader: summary.licenseKey ? buildScriptLoaderSnippet(summary.licenseKey, userId, req) : "",
  };
}

function publicToolLog(log) {
  return {
    licenseKey: log.license_key || "",
    allowed: Boolean(log.allowed),
    reason: log.reason || "",
    createdAt: log.created_at || null,
  };
}

function requireSession(req, res) {
  const session = sessionFromRequest(req);
  if (session) return session;
  sendJson(res, 401, { ok: false, error: "กรุณาเข้าสู่ระบบด้วย Discord ก่อนใช้งาน" });
  return null;
}

function trueMoneyErrorMessage(code, fallback) {
  const map = {
    VOUCHER_NOT_FOUND: "ไม่พบซองอั่งเปานี้ หรือรูปแบบลิงก์ไม่ถูกต้อง",
    VOUCHER_OUT_OF_STOCK: "ซองอั่งเปานี้ถูกใช้หมดแล้ว",
    VOUCHER_EXPIRED: "ซองอั่งเปานี้หมดอายุแล้ว",
    CANNOT_GET_OWN_VOUCHER: "ไม่สามารถรับซองของตัวเองได้",
    TARGET_USER_NOT_FOUND: "ไม่พบเบอร์ TrueMoney Wallet ที่ตั้งไว้",
    INTERNAL_ERROR: "TrueMoney ขัดข้องชั่วคราว ลองใหม่อีกครั้ง",
  };
  return map[code] || fallback || "เติมเงินไม่สำเร็จ";
}

function extractTrueMoneyAmount(data) {
  const candidates = [
    data?.data?.my_ticket?.amount_baht,
    data?.data?.voucher?.redeemed_amount_baht,
    data?.data?.voucher?.amount_baht,
    data?.data?.amount_baht,
  ];

  for (const candidate of candidates) {
    const amountSatang = amountToSatang(candidate);
    if (amountSatang > 0) return amountSatang;
  }
  return 0;
}

async function redeemTrueMoneyVoucher(voucherHash) {
  const mobile = normalizeThaiMobile(TRUEMONEY_RECEIVER_PHONE);
  if (!mobile) {
    throw new Error("ยังไม่ได้ตั้งค่า TRUEMONEY_RECEIVER_PHONE เป็นเบอร์ TrueMoney Wallet ของร้าน");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`https://gift.truemoney.com/campaign/vouchers/${voucherHash}/redeem`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Origin: "https://gift.truemoney.com",
        Referer: `https://gift.truemoney.com/campaign/?v=${voucherHash}`,
        "User-Agent": "Mozilla/5.0 ShoraKey/1.0",
      },
      body: JSON.stringify({ mobile, voucher_hash: voucherHash }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    const code = String(data?.status?.code || data?.code || "");

    if (!response.ok || code !== "SUCCESS") {
      throw new Error(trueMoneyErrorMessage(code, data?.status?.message || data?.message));
    }

    const amountSatang = extractTrueMoneyAmount(data);
    if (amountSatang <= 0) throw new Error("รับซองสำเร็จแต่ไม่พบยอดเงินจาก TrueMoney");

    return {
      amountSatang,
      providerStatus: code,
      ownerName: data?.data?.owner_profile?.full_name || "",
      voucherDetail: data?.data?.voucher?.detail || "",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function categoryFor(slug, store = readStore()) {
  return catalogForStore(store).categories.find((category) => category.slug === slug);
}

function offerFromProduct(product, store) {
  const category = store ? categoryFor(product.categorySlug, store) : categories.find((item) => item.slug === product.categorySlug);
  return {
    id: product.id,
    name: product.name,
    price: product.price,
    currency: product.currency,
    durationDays: product.durationDays,
    devicesLimit: product.devicesLimit,
    productId: product.id,
    categorySlug: product.categorySlug,
    categoryName: category ? category.name : product.categorySlug,
  };
}

function normalizeKey(value) {
  return String(value || "").trim().toUpperCase();
}

function effectiveStatus(license) {
  if (!license) return "missing";
  if (license.status === "revoked") return "revoked";
  if (license.expiresAt && new Date(license.expiresAt).getTime() < Date.now()) return "expired";
  return license.status || "active";
}

function publicLicense(license) {
  const status = effectiveStatus(license);
  return {
    key: license.key,
    planId: license.planId,
    planName: license.planName,
    status,
    createdAt: license.createdAt,
    expiresAt: license.expiresAt,
    devicesLimit: license.devicesLimit,
    devicesUsed: Array.isArray(license.activations) ? license.activations.length : 0,
    productId: license.productId || null,
    categorySlug: license.categorySlug || null,
    categoryName: license.categoryName || null,
  };
}

function adminLicense(license) {
  return {
    ...publicLicense(license),
    price: license.price,
    currency: license.currency,
    customerName: license.customerName,
    contact: license.contact,
    orderId: license.orderId,
    note: license.note || "",
  };
}

function generateId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

function generateLicenseKey(existingKeys) {
  let licenseKey;
  do {
    const bytes = crypto.randomBytes(6).toString("hex").toUpperCase();
    licenseKey = `XK-${bytes.slice(0, 4)}-${bytes.slice(4, 8)}-${bytes.slice(8, 12)}`;
  } while (existingKeys.has(licenseKey));
  return licenseKey;
}

function createLicense(store, offer, order, note = "") {
  const key = generateLicenseKey(new Set(store.keys.map((license) => license.key)));
  const license = {
    key,
    planId: offer.id,
    planName: offer.name,
    productId: offer.productId || null,
    categorySlug: offer.categorySlug || null,
    categoryName: offer.categoryName || null,
    price: offer.price,
    currency: offer.currency,
    status: "active",
    customerName: order.customerName,
    contact: order.contact,
    orderId: order.id,
    devicesLimit: offer.devicesLimit,
    activations: [],
    createdAt: nowIso(),
    expiresAt: addDays(offer.durationDays),
    note,
  };

  store.keys.push(license);
  order.licenseKey = key;
  return license;
}

function supabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

function ensureSupabaseConfigured() {
  if (!supabaseConfigured()) {
    throw new Error("Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.");
  }
}

function supabaseResourceUrl(resource) {
  ensureSupabaseConfigured();
  return `${SUPABASE_URL}/rest/v1/${resource}`;
}

async function supabaseRequest(resource, options = {}) {
  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...(options.prefer ? { Prefer: options.prefer } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(supabaseResourceUrl(resource), {
    method: options.method || "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = data?.message || data?.hint || data?.error || `Supabase request failed (${response.status})`;
    throw new Error(message);
  }

  return data;
}

async function supabaseReadAll(resource) {
  const data = await supabaseRequest(resource);
  return Array.isArray(data) ? data : [];
}

function rowData(row) {
  return row?.data && typeof row.data === "object" && !Array.isArray(row.data) ? row.data : {};
}

function storeFromSupabaseRows(rows) {
  const store = upgradeStore({
    keys: rows.keys.map((row) => ({ ...rowData(row), key: row.license_key || rowData(row).key })),
    orders: rows.orders.map((row) => ({ ...rowData(row), id: row.id })),
    topups: rows.topups.map((row) => ({ ...rowData(row), id: row.id })),
    wallets: {},
    products: rows.products.map((row) => ({ ...rowData(row), id: row.id })),
    inventory: {},
    deletedProductIds: rows.deletedProducts.map((row) => row.product_id).filter(Boolean),
  });

  rows.wallets.forEach((row) => {
    const wallet = {
      ...rowData(row),
      userId: row.user_id || rowData(row).userId,
      balanceSatang: Number(row.balance_satang ?? rowData(row).balanceSatang ?? 0),
      currency: row.currency || rowData(row).currency || "THB",
    };
    if (wallet.userId) store.wallets[String(wallet.userId)] = wallet;
  });

  rows.inventory.forEach((row) => {
    if (row.product_id) store.inventory[row.product_id] = Math.max(0, Math.round(Number(row.stock || 0)));
  });

  return store;
}

async function readStoreFromSupabase() {
  const [products, inventory, deletedProducts, wallets, topups, orders, keys] = await Promise.all([
    supabaseReadAll("shora_products?select=*&order=created_at.asc"),
    supabaseReadAll("shora_inventory?select=*"),
    supabaseReadAll("shora_deleted_products?select=*"),
    supabaseReadAll("shora_wallets?select=*"),
    supabaseReadAll("shora_topups?select=*&order=created_at.desc"),
    supabaseReadAll("shora_orders?select=*&order=created_at.desc"),
    supabaseReadAll("shora_license_keys?select=*&order=created_at.desc"),
  ]);

  return storeFromSupabaseRows({ products, inventory, deletedProducts, wallets, topups, orders, keys });
}

async function readBackendStore() {
  if (!supabaseConfigured()) return readStore();

  try {
    return await readStoreFromSupabase();
  } catch (error) {
    console.warn(`Supabase store read failed, using local fallback: ${error.message}`);
    return readStore();
  }
}

async function supabaseUpsert(resource, rows) {
  if (!Array.isArray(rows) || rows.length === 0) return;
  await supabaseRequest(resource, {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    body: rows,
  });
}

async function supabaseDeleteMissing(resource, idColumn, nextIds) {
  const existing = await supabaseReadAll(`${resource}?select=${idColumn}`);
  const next = new Set(nextIds.map(String));
  const staleIds = existing.map((row) => String(row[idColumn] || "")).filter((id) => id && !next.has(id));
  await Promise.all(
    staleIds.map((id) =>
      supabaseRequest(`${resource}?${idColumn}=eq.${postgrestValue(id)}`, {
        method: "DELETE",
        prefer: "return=minimal",
      }),
    ),
  );
}

async function saveStoreToSupabase(store) {
  const current = upgradeStore(store);
  const timestamp = nowIso();

  const productRows = current.products.map((product) => ({
    id: product.id,
    data: product,
    source: product.source || "custom",
    updated_at: product.updatedAt || timestamp,
  }));
  await supabaseDeleteMissing("shora_products", "id", productRows.map((row) => row.id));
  await supabaseUpsert("shora_products?on_conflict=id", productRows);

  const inventoryRows = Object.entries(current.inventory || {}).map(([productId, stock]) => ({
    product_id: productId,
    stock: Math.max(0, Math.round(Number(stock || 0))),
    updated_at: timestamp,
  }));
  await supabaseDeleteMissing("shora_inventory", "product_id", inventoryRows.map((row) => row.product_id));
  await supabaseUpsert("shora_inventory?on_conflict=product_id", inventoryRows);

  const deletedRows = (current.deletedProductIds || []).map((productId) => ({ product_id: String(productId) }));
  await supabaseDeleteMissing("shora_deleted_products", "product_id", deletedRows.map((row) => row.product_id));
  await supabaseUpsert("shora_deleted_products?on_conflict=product_id", deletedRows);

  await supabaseUpsert(
    "shora_wallets?on_conflict=user_id",
    Object.values(current.wallets || {}).map((wallet) => ({
      user_id: String(wallet.userId),
      data: wallet,
      balance_satang: Number(wallet.balanceSatang || 0),
      currency: wallet.currency || "THB",
      created_at: wallet.createdAt || timestamp,
      updated_at: wallet.updatedAt || timestamp,
    })),
  );

  await supabaseUpsert(
    "shora_topups?on_conflict=id",
    current.topups.map((topup) => ({
      id: topup.id,
      user_id: topup.userId || null,
      voucher_hash: topup.voucherHash || null,
      status: topup.status || "",
      amount_satang: Number(topup.amountSatang || 0),
      data: topup,
      created_at: topup.createdAt || timestamp,
    })),
  );

  await supabaseUpsert(
    "shora_orders?on_conflict=id",
    current.orders.map((order) => ({
      id: order.id,
      user_id: order.userId || null,
      contact: order.contact || null,
      status: order.status || "",
      amount_satang: Number(order.amountSatang || amountToSatang(order.amount || 0)),
      license_key: order.licenseKey || null,
      data: order,
      created_at: order.createdAt || timestamp,
    })),
  );

  await supabaseUpsert(
    "shora_license_keys?on_conflict=license_key",
    current.keys.map((license) => ({
      license_key: license.key,
      contact: license.contact || null,
      status: effectiveStatus(license),
      data: license,
      created_at: license.createdAt || timestamp,
      updated_at: license.updatedAt || timestamp,
    })),
  );
}

async function saveBackendStore(store) {
  saveStore(store);
  if (!supabaseConfigured()) return;

  try {
    await saveStoreToSupabase(store);
  } catch (error) {
    console.warn(`Supabase store write failed, local backup saved: ${error.message}`);
    throw error;
  }
}

function postgrestValue(value) {
  return encodeURIComponent(String(value ?? ""));
}

function scriptLicenseSelect(key, discordId) {
  return `script_licenses?license_key=eq.${postgrestValue(key)}&discord_id=eq.${postgrestValue(discordId)}&select=*`;
}

function normalizeDiscordId(value) {
  return String(value || "").replace(/\D/g, "").trim();
}

function normalizeHwid(value) {
  return String(value || "").trim();
}

function hashHwid(value) {
  return crypto.createHash("sha256").update(normalizeHwid(value)).digest("hex");
}

function generateScriptKey() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const groups = [4, 4, 5, 4, 5, 4].map((size) => {
    let part = "";
    for (let index = 0; index < size; index += 1) {
      part += chars[crypto.randomInt(chars.length)];
    }
    return part;
  });
  return `${SCRIPT_KEY_PREFIX}-${groups.join("-")}`;
}

function publicScriptLicense(license) {
  const isExpired = license.expires_at && new Date(license.expires_at).getTime() < Date.now();
  return {
    key: license.license_key,
    discordId: license.discord_id,
    productId: license.product_id || "",
    status: isExpired && license.status === "active" ? "expired" : license.status,
    maxDevices: license.max_devices,
    hwidBound: Boolean(license.hwid_hash),
    hwidBoundAt: license.hwid_bound_at,
    createdAt: license.created_at,
    expiresAt: license.expires_at,
    note: license.note || "",
  };
}

function publicLocalScriptLicense(license) {
  const discordId = String(license.contact || "").startsWith("discord:") ? String(license.contact).slice("discord:".length) : "";
  const activation = Array.isArray(license.activations) ? license.activations[0] : null;
  const status = effectiveStatus(license);
  return {
    key: license.key,
    discordId,
    productId: license.productId || license.planId || "",
    status,
    maxDevices: Number(license.devicesLimit || 1),
    hwidBound: Boolean(activation?.hwidHash || activation?.deviceId),
    hwidBoundAt: activation?.firstSeenAt || activation?.activatedAt || null,
    createdAt: license.createdAt,
    expiresAt: license.expiresAt,
    note: license.note || "",
    backend: "local",
  };
}

function localScriptLicensesForAdmin(store) {
  return store.keys
    .filter((license) => String(license.contact || "").startsWith("discord:"))
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .map(publicLocalScriptLicense);
}

function createLocalScriptLicenseForAdmin(store, body) {
  const discordId = normalizeDiscordId(body.discordId || body.id);
  const productId = String(body.productId || "shora-hub-v1").trim();
  const durationDays = Number(body.durationDays || 30);
  const maxDevices = Math.max(1, Math.min(10, Number(body.maxDevices || 1)));

  if (!discordId) {
    throw new Error("Discord ID is required");
  }

  const product = findProduct(productId, store);
  const keySet = new Set(store.keys.map((license) => license.key));
  let key = "";
  do {
    key = generateScriptKey();
  } while (keySet.has(key));

  const license = {
    key,
    planId: productId,
    planName: product?.name || productId,
    productId: product?.id || productId,
    categorySlug: product?.categorySlug || null,
    categoryName: product?.categorySlug ? categoryFor(product.categorySlug, store)?.name || product.categorySlug : null,
    price: 0,
    currency: "THB",
    status: "active",
    customerName: `Discord ${discordId}`,
    contact: `discord:${discordId}`,
    orderId: null,
    devicesLimit: maxDevices,
    activations: [],
    createdAt: nowIso(),
    expiresAt: scriptExpiresAt(durationDays),
    note: String(body.note || "Issued by admin").trim(),
  };

  store.keys.push(license);
  return license;
}

function scriptExpiresAt(durationDays) {
  const days = Number(durationDays);
  if (!Number.isFinite(days) || days <= 0) return null;
  return addDays(days);
}

function requestIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket.remoteAddress || "";
}

async function logScriptAuthAttempt(req, payload) {
  if (!supabaseConfigured()) return;
  try {
    await supabaseRequest("script_auth_logs", {
      method: "POST",
      prefer: "return=minimal",
      body: {
        license_key: payload.key || null,
        discord_id: payload.discordId || null,
        hwid_hash: payload.hwidHash || null,
        allowed: Boolean(payload.allowed),
        reason: payload.reason || "",
        ip_text: requestIp(req),
        user_agent: String(req.headers["user-agent"] || "").slice(0, 500),
      },
    });
  } catch (error) {
    console.warn(`Script auth log failed: ${error.message}`);
  }
}

function publicBaseUrl(req) {
  if (PUBLIC_BASE_URL) return PUBLIC_BASE_URL;
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const forwardedHost = String(req.headers["x-forwarded-host"] || "").split(",")[0].trim();
  const proto = forwardedProto || (COOKIE_SECURE ? "https" : "http");
  const host = forwardedHost || req.headers.host || `localhost:${PORT}`;
  return `${proto}://${host}`;
}

function ensureInsideRoot(filePath) {
  const resolved = path.resolve(ROOT_DIR, filePath);
  if (resolved !== ROOT_DIR && !resolved.startsWith(`${ROOT_DIR}${path.sep}`)) {
    throw new Error("Script source file must stay inside the project folder.");
  }
  return resolved;
}

function scriptSourcePath() {
  return ensureInsideRoot(SCRIPT_SOURCE_FILE);
}

function ensureScriptSourceDir() {
  fs.mkdirSync(path.dirname(scriptSourcePath()), { recursive: true });
}

function readScriptSource() {
  const sourcePath = scriptSourcePath();
  if (fs.existsSync(sourcePath)) {
    const source = fs.readFileSync(sourcePath, "utf8");
    if (source.trim()) {
      return { source, path: sourcePath, kind: "file" };
    }
  }

  if (SCRIPT_SOURCE_URL) {
    return {
      source: `loadstring(game:HttpGet("${SCRIPT_SOURCE_URL.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"))()\n`,
      path: sourcePath,
      kind: "remote_fallback",
    };
  }

  return {
    source: 'warn("Shora source is empty. Paste source in Admin > Script source.")\nreturn\n',
    path: sourcePath,
    kind: "empty",
  };
}

function writeScriptSource(source) {
  ensureScriptSourceDir();
  fs.writeFileSync(scriptSourcePath(), String(source || ""), "utf8");
}

async function readBackendScriptSource() {
  if (supabaseConfigured()) {
    try {
      const rows = await supabaseRequest("shora_script_sources?id=eq.main&select=*");
      const row = Array.isArray(rows) ? rows[0] : null;
      if (row && String(row.source || "").trim()) {
        return {
          source: row.source,
          path: "supabase:shora_script_sources/main",
          kind: row.kind || "database",
        };
      }
    } catch (error) {
      console.warn(`Supabase script source read failed, using file fallback: ${error.message}`);
    }
  }

  return readScriptSource();
}

async function writeBackendScriptSource(source) {
  const normalizedSource = String(source || "");
  writeScriptSource(normalizedSource);

  if (!supabaseConfigured()) return;

  await supabaseRequest("shora_script_sources?on_conflict=id", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    body: [
      {
        id: "main",
        source: normalizedSource,
        kind: "database",
        updated_at: nowIso(),
      },
    ],
  });
}

function luaString(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/"/g, '\\"');
}

function denyLua(message) {
  return `warn("${luaString(message)}")\nreturn\n`;
}

function buildScriptLoaderSnippet(key, discordId, req) {
  return [
    `getgenv().Key = "${String(key).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`,
    `getgenv().id = "${String(discordId).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`,
    `loadstring(game:HttpGet("${publicBaseUrl(req)}/loader.lua"))()`,
  ].join("\n");
}

async function createScriptLicenseForCheckout(license, order, user) {
  if (!supabaseConfigured()) return null;

  try {
    const inserted = await supabaseRequest("script_licenses", {
      method: "POST",
      prefer: "return=representation",
      body: {
        license_key: license.key,
        discord_id: String(user.id),
        product_id: license.productId || order.productId || order.planId || "shora-hub",
        status: "active",
        max_devices: Math.max(1, Number(license.devicesLimit || 1)),
        expires_at: license.expiresAt || null,
        note: `Issued from checkout order ${order.id}`,
        created_by: "checkout",
      },
    });

    return Array.isArray(inserted) ? inserted[0] : null;
  } catch (error) {
    console.warn(`Supabase script license insert failed, using local key fallback: ${error.message}`);
    return null;
  }
}

function buildScriptLoader(req) {
  const sourceUrl = `${publicBaseUrl(req)}/api/script/source`;
  return `-- Shora Hub loader
local env = (getgenv and getgenv()) or _G
local Key = tostring(env.Key or "")
local DiscordId = tostring(env.id or env.Id or env.DiscordId or "")
local HttpService = game:GetService("HttpService")

local function getHWID()
  local ok, value = pcall(function()
    return game:GetService("RbxAnalyticsService"):GetClientId()
  end)
  if ok and value and tostring(value) ~= "" then
    return tostring(value)
  end

  local playerOk, player = pcall(function()
    return game:GetService("Players").LocalPlayer
  end)
  if playerOk and player then
    return "player-" .. tostring(player.UserId)
  end

  return "unknown"
end

local hwid = getHWID()
local requestFn = (syn and syn.request) or (http and http.request) or http_request or request
local response

if requestFn then
  response = requestFn({
    Url = "${sourceUrl}",
    Method = "POST",
    Headers = { ["Content-Type"] = "application/json" },
    Body = HttpService:JSONEncode({
      key = Key,
      discordId = DiscordId,
      id = DiscordId,
      hwid = hwid
    })
  })
else
  response = {
    Body = game:HttpGet("${sourceUrl}?key=" .. HttpService:UrlEncode(Key) .. "&id=" .. HttpService:UrlEncode(DiscordId) .. "&hwid=" .. HttpService:UrlEncode(hwid))
  }
end

local source = response.Body or ""
if source == "" then
  warn("Shora source response is empty")
  return
end

loadstring(source)()
`;
}

function sendLua(res, status, source) {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(source);
}

function requireAdmin(req, res) {
  const token = req.headers["x-admin-token"];
  if (token === ADMIN_TOKEN) return true;
  sendJson(res, 401, { ok: false, error: "Invalid admin token" });
  return false;
}

function summarize(store) {
  const counts = store.keys.reduce(
    (acc, license) => {
      acc[effectiveStatus(license)] += 1;
      return acc;
    },
    { active: 0, expired: 0, revoked: 0, missing: 0 },
  );

  const revenue = store.orders
    .filter((order) => String(order.status || "").startsWith("paid"))
    .reduce((sum, order) => sum + Number(order.amount || 0), 0);
  const topupAmountSatang = store.topups
    .filter((topup) => topup.status === "success")
    .reduce((sum, topup) => sum + Number(topup.amountSatang || 0), 0);

  return {
    totalKeys: store.keys.length,
    activeKeys: counts.active,
    expiredKeys: counts.expired,
    revokedKeys: counts.revoked,
    totalOrders: store.orders.length,
    revenue,
    totalTopups: store.topups.filter((topup) => topup.status === "success").length,
    topupRevenue: satangToBaht(topupAmountSatang),
    currency: "THB",
  };
}

async function verifyScriptAccess(req, url, body = {}) {
  if (!supabaseConfigured()) {
    return verifyLocalScriptAccess(req, url, body);
  }

  const key = normalizeKey(body.key || url.searchParams.get("key"));
  const discordId = normalizeDiscordId(body.discordId || body.id || url.searchParams.get("discordId") || url.searchParams.get("id"));
  const hwid = normalizeHwid(body.hwid || body.hwidId || url.searchParams.get("hwid"));
  const hwidHash = hwid ? hashHwid(hwid) : "";

  if (!key || key.length < 12) {
    return { allowed: false, status: 400, key, discordId, hwidHash, reason: "missing_key", message: "Missing or invalid key." };
  }

  if (!discordId) {
    return { allowed: false, status: 400, key, discordId, hwidHash, reason: "missing_discord_id", message: "Missing Discord ID." };
  }

  if (!hwid) {
    return { allowed: false, status: 400, key, discordId, hwidHash, reason: "missing_hwid", message: "Missing HWID." };
  }

  try {
    const rows = await supabaseRequest(scriptLicenseSelect(key, discordId));
    const license = Array.isArray(rows) ? rows[0] : null;

    if (!license) {
      return { allowed: false, status: 404, key, discordId, hwidHash, reason: "invalid_key", message: "Key or Discord ID is incorrect." };
    }

    if (license.status !== "active") {
      return { allowed: false, status: 403, key, discordId, hwidHash, reason: "key_not_active", message: "This key is not active." };
    }

    if (license.expires_at && new Date(license.expires_at).getTime() < Date.now()) {
      return { allowed: false, status: 403, key, discordId, hwidHash, reason: "key_expired", message: "This key has expired." };
    }

    let boundNow = false;
    let currentLicense = license;
    if (!license.hwid_hash) {
      const patched = await supabaseRequest(
        `script_licenses?license_key=eq.${postgrestValue(key)}&discord_id=eq.${postgrestValue(discordId)}&hwid_hash=is.null`,
        {
          method: "PATCH",
          prefer: "return=representation",
          body: {
            hwid_hash: hwidHash,
            hwid_bound_at: nowIso(),
            updated_at: nowIso(),
          },
        },
      );

      if (Array.isArray(patched) && patched[0]) {
        boundNow = true;
        currentLicense = patched[0];
      } else {
        const latest = await supabaseRequest(scriptLicenseSelect(key, discordId));
        currentLicense = Array.isArray(latest) ? latest[0] : license;
      }
    }

    if (currentLicense.hwid_hash !== hwidHash) {
      return { allowed: false, status: 403, key, discordId, hwidHash, reason: "hwid_mismatch", message: "This key is already linked to another device." };
    }

    return {
      allowed: true,
      status: 200,
      key,
      discordId,
      hwidHash,
      reason: boundNow ? "bound_hwid" : "ok",
      message: boundNow ? "Key linked to this device." : "Key accepted.",
      license: currentLicense,
    };
  } catch (error) {
    console.warn(`Supabase script auth failed, using local key fallback: ${error.message}`);
    return verifyLocalScriptAccess(req, url, body);
  }
}

function verifyLocalScriptAccess(req, url, body = {}) {
  const key = normalizeKey(body.key || url.searchParams.get("key"));
  const discordId = normalizeDiscordId(body.discordId || body.id || url.searchParams.get("discordId") || url.searchParams.get("id"));
  const hwid = normalizeHwid(body.hwid || body.hwidId || url.searchParams.get("hwid"));
  const hwidHash = hwid ? hashHwid(hwid) : "";

  if (!key || key.length < 12) {
    return { allowed: false, status: 400, key, discordId, hwidHash, reason: "missing_key", message: "Missing or invalid key." };
  }

  if (!discordId) {
    return { allowed: false, status: 400, key, discordId, hwidHash, reason: "missing_discord_id", message: "Missing Discord ID." };
  }

  if (!hwid) {
    return { allowed: false, status: 400, key, discordId, hwidHash, reason: "missing_hwid", message: "Missing HWID." };
  }

  const store = readStore();
  const license = store.keys.find((item) => item.key === key);
  if (!license || license.contact !== `discord:${discordId}`) {
    return { allowed: false, status: 404, key, discordId, hwidHash, reason: "invalid_key", message: "Key or Discord ID is incorrect." };
  }

  const status = effectiveStatus(license);
  if (status !== "active") {
    return { allowed: false, status: 403, key, discordId, hwidHash, reason: `key_${status}`, message: "This key is not active." };
  }

  if (!Array.isArray(license.activations)) license.activations = [];
  const existing = license.activations.find((activation) => activation.hwidHash === hwidHash);
  const maxDevices = Math.max(1, Number(license.devicesLimit || 1));

  if (existing) {
    existing.lastSeenAt = nowIso();
    saveStore(store);
    return {
      allowed: true,
      status: 200,
      key,
      discordId,
      hwidHash,
      reason: "ok_local",
      message: "Key accepted.",
      license: {
        license_key: license.key,
        discord_id: discordId,
        product_id: license.productId || "",
        status: "active",
        max_devices: maxDevices,
        hwid_hash: hwidHash,
        hwid_bound_at: existing.firstSeenAt || existing.createdAt || null,
        created_at: license.createdAt,
        expires_at: license.expiresAt,
        note: license.note || "",
      },
    };
  }

  if (license.activations.length >= maxDevices) {
    return { allowed: false, status: 403, key, discordId, hwidHash, reason: "hwid_mismatch", message: "This key is already linked to another device." };
  }

  const timestamp = nowIso();
  license.activations.push({ hwidHash, firstSeenAt: timestamp, lastSeenAt: timestamp });
  saveStore(store);

  return {
    allowed: true,
    status: 200,
    key,
    discordId,
    hwidHash,
    reason: "bound_hwid_local",
    message: "Key linked to this device.",
    license: {
      license_key: license.key,
      discord_id: discordId,
      product_id: license.productId || "",
      status: "active",
      max_devices: maxDevices,
      hwid_hash: hwidHash,
      hwid_bound_at: timestamp,
      created_at: license.createdAt,
      expires_at: license.expiresAt,
      note: license.note || "",
    },
  };
}

function localScriptLicenseForUser(store, key, discordId) {
  return store.keys.find((license) => {
    const contact = String(license.contact || "");
    return license.key === key && contact === `discord:${discordId}`;
  });
}

function scriptLicenseUnavailableMessage(license) {
  if (!license) return "ไม่พบคีย์นี้ในบัญชี Discord ของคุณ";
  if (license.status === "expired") return "คีย์นี้หมดอายุแล้ว";
  if (license.status !== "active") return "คีย์นี้ยังไม่พร้อมใช้งาน";
  return "";
}

async function findUserScriptLicense(key, discordId, store = readStore()) {
  const normalizedKey = normalizeKey(key);
  const normalizedDiscordId = normalizeDiscordId(discordId);

  if (!normalizedKey || normalizedKey.length < 12) {
    return { error: { status: 400, message: "กรุณากรอก License Key ให้ถูกต้อง" } };
  }

  if (!normalizedDiscordId) {
    return { error: { status: 400, message: "ไม่พบ Discord ID ของผู้ใช้" } };
  }

  if (supabaseConfigured()) {
    try {
      const rows = await supabaseRequest(scriptLicenseSelect(normalizedKey, normalizedDiscordId));
      const license = Array.isArray(rows) ? rows[0] : null;
      if (license) {
        return {
          backend: "supabase",
          key: normalizedKey,
          discordId: normalizedDiscordId,
          license,
          publicLicense: publicScriptLicense(license),
        };
      }
    } catch (error) {
      console.warn(`User script license Supabase lookup failed, using local fallback: ${error.message}`);
    }
  }

  const localLicense = localScriptLicenseForUser(store, normalizedKey, normalizedDiscordId);
  if (!localLicense) return null;

  return {
    backend: "local",
    key: normalizedKey,
    discordId: normalizedDiscordId,
    license: localLicense,
    publicLicense: publicLocalScriptLicense(localLicense),
  };
}

function scriptToolPayload(record, req) {
  return {
    license: record.publicLicense,
    script: {
      loader: buildScriptLoaderSnippet(record.key, record.discordId, req),
      loaderUrl: `${publicBaseUrl(req)}/loader.lua`,
      backend: record.backend,
    },
  };
}

async function handleScriptAuth(req, res, url) {
  const body = req.method === "POST" ? await readBody(req) : {};
  const access = await verifyScriptAccess(req, url, body);
  await logScriptAuthAttempt(req, access);

  if (!access.allowed) {
    sendJson(res, access.status, { ok: false, allowed: false, reason: access.reason, message: access.message, error: access.message });
    return;
  }

  sendJson(res, 200, {
    ok: true,
    allowed: true,
    reason: access.reason,
    message: access.message,
    sourceUrl: `${publicBaseUrl(req)}/api/script/source`,
    license: publicScriptLicense(access.license),
  });
}

async function handleScriptSource(req, res, url) {
  const body = req.method === "POST" ? await readBody(req) : {};
  const access = await verifyScriptAccess(req, url, body);
  await logScriptAuthAttempt(req, access);

  if (!access.allowed) {
    sendLua(res, 200, denyLua(access.message || "Shora key denied."));
    return;
  }

  const source = await readBackendScriptSource();
  sendLua(res, 200, source.source);
}

async function handleScriptLoaderTool(req, res) {
  const session = requireSession(req, res);
  if (!session) return;

  const body = await readBody(req);
  const store = await readBackendStore();
  const record = await findUserScriptLicense(body.key, session.user.id, store);

  if (record?.error) {
    sendJson(res, record.error.status, { ok: false, error: record.error.message });
    return;
  }

  if (!record) {
    sendJson(res, 404, { ok: false, error: "ไม่พบคีย์นี้ในบัญชี Discord ของคุณ" });
    return;
  }

  const unavailableMessage = scriptLicenseUnavailableMessage(record.publicLicense);
  if (unavailableMessage) {
    sendJson(res, 403, { ok: false, error: unavailableMessage, license: record.publicLicense });
    return;
  }

  sendJson(res, 200, {
    ok: true,
    ...scriptToolPayload(record, req),
  });
}

async function handleScriptResetDevice(req, res) {
  const session = requireSession(req, res);
  if (!session) return;

  const body = await readBody(req);
  const store = await readBackendStore();
  const record = await findUserScriptLicense(body.key, session.user.id, store);

  if (record?.error) {
    sendJson(res, record.error.status, { ok: false, error: record.error.message });
    return;
  }

  if (!record) {
    sendJson(res, 404, { ok: false, error: "ไม่พบคีย์นี้ในบัญชี Discord ของคุณ" });
    return;
  }

  const unavailableMessage = scriptLicenseUnavailableMessage(record.publicLicense);
  if (unavailableMessage) {
    sendJson(res, 403, { ok: false, error: unavailableMessage, license: record.publicLicense });
    return;
  }

  let updatedRecord = record;
  if (record.backend === "supabase") {
    const updated = await supabaseRequest(
      `script_licenses?license_key=eq.${postgrestValue(record.key)}&discord_id=eq.${postgrestValue(record.discordId)}`,
      {
        method: "PATCH",
        prefer: "return=representation",
        body: {
          hwid_hash: null,
          hwid_bound_at: null,
          updated_at: nowIso(),
        },
      },
    );

    const updatedLicense = Array.isArray(updated) ? updated[0] : null;
    if (!updatedLicense) {
      sendJson(res, 404, { ok: false, error: "ไม่พบคีย์สำหรับ Reset Device" });
      return;
    }

    updatedRecord = {
      ...record,
      license: updatedLicense,
      publicLicense: publicScriptLicense(updatedLicense),
    };
  } else {
    if (!Array.isArray(record.license.activations)) record.license.activations = [];
    record.license.activations = [];
    record.license.updatedAt = nowIso();
    await saveBackendStore(store);
    updatedRecord = {
      ...record,
      publicLicense: publicLocalScriptLicense(record.license),
    };
  }

  sendJson(res, 200, {
    ok: true,
    message: "Reset Device สำเร็จแล้ว รันสคริปต์อีกครั้งเพื่อผูกเครื่องใหม่",
    ...scriptToolPayload(updatedRecord, req),
  });
}

async function handleApi(req, res, url) {
  const pathname = url.pathname;
  try {
    if (req.method === "GET" && pathname === "/api/health") {
      sendJson(res, 200, { ok: true, service: "ShoraKey", time: nowIso() });
      return;
    }

    if ((req.method === "GET" || req.method === "POST") && pathname === "/api/script/auth") {
      await handleScriptAuth(req, res, url);
      return;
    }

    if ((req.method === "GET" || req.method === "POST") && pathname === "/api/script/source") {
      await handleScriptSource(req, res, url);
      return;
    }

    if (req.method === "POST" && pathname === "/api/script/loader") {
      await handleScriptLoaderTool(req, res);
      return;
    }

    if (req.method === "POST" && pathname === "/api/script/reset-device") {
      await handleScriptResetDevice(req, res);
      return;
    }

    if (req.method === "GET" && pathname === "/api/session") {
      const session = sessionFromRequest(req);
      sendJson(res, 200, {
        ok: true,
        authenticated: Boolean(session),
        user: session ? publicDiscordUser(session.user) : null,
      });
      return;
    }

    if (req.method === "GET" && pathname === "/api/wallet") {
      const session = requireSession(req, res);
      if (!session) return;
      const store = await readBackendStore();
      const wallet = walletForUser(store, session.user);
      await saveBackendStore(store);
      sendJson(res, 200, {
        ok: true,
        wallet: publicWallet(wallet),
        user: publicDiscordUser(session.user),
      });
      return;
    }

    if (req.method === "GET" && pathname === "/api/topups") {
      const session = requireSession(req, res);
      if (!session) return;
      const store = await readBackendStore();
      const topups = store.topups
        .filter((topup) => topup.userId === session.user.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 20)
        .map(publicTopup);
      sendJson(res, 200, { ok: true, topups });
      return;
    }

    if (req.method === "GET" && pathname === "/api/history") {
      const session = requireSession(req, res);
      if (!session) return;

      const store = await readBackendStore();
      const userId = String(session.user.id);
      const orders = store.orders
        .filter((order) => order.userId === userId || order.contact === `discord:${userId}`)
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, 80)
        .map((order) => publicOrderForUser(order, userId, req));
      const topups = store.topups
        .filter((topup) => topup.userId === userId)
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, 80)
        .map(publicTopup);

      let tools = [];
      if (supabaseConfigured()) {
        try {
          const logs = await supabaseRequest(
            `script_auth_logs?discord_id=eq.${postgrestValue(userId)}&select=license_key,allowed,reason,created_at&order=created_at.desc&limit=80`,
          );
          tools = Array.isArray(logs) ? logs.map(publicToolLog) : [];
        } catch (error) {
          console.warn(`History tool logs failed: ${error.message}`);
        }
      }

      sendJson(res, 200, {
        ok: true,
        user: publicDiscordUser(session.user),
        orders,
        topups,
        tools,
      });
      return;
    }

    if (req.method === "POST" && pathname === "/api/topup/truemoney") {
      const session = requireSession(req, res);
      if (!session) return;

      const body = await readBody(req);
      const voucherHash = extractTrueMoneyVoucherHash(body.voucherUrl || body.voucher || body.code);
      if (!voucherHash) {
        sendJson(res, 400, { ok: false, error: "กรุณาใส่ลิงก์ซองอั่งเปา TrueMoney ที่ถูกต้อง" });
        return;
      }

      if (topupLocks.has(voucherHash)) {
        sendJson(res, 409, { ok: false, error: "ซองนี้กำลังถูกตรวจสอบอยู่ กรุณารอสักครู่" });
        return;
      }

      let store = await readBackendStore();
      const usedTopup = store.topups.find((topup) => topup.voucherHash === voucherHash && topup.status === "success");
      if (usedTopup) {
        sendJson(res, 409, { ok: false, error: "ซองอั่งเปานี้ถูกใช้เติมเงินในระบบแล้ว" });
        return;
      }

      topupLocks.add(voucherHash);
      try {
        const redeemed = await redeemTrueMoneyVoucher(voucherHash);
        store = await readBackendStore();

        const duplicateAfterRedeem = store.topups.find((topup) => topup.voucherHash === voucherHash && topup.status === "success");
        if (duplicateAfterRedeem) {
          sendJson(res, 409, { ok: false, error: "ซองอั่งเปานี้ถูกใช้เติมเงินในระบบแล้ว" });
          return;
        }

        const wallet = walletForUser(store, session.user);
        wallet.balanceSatang = Number(wallet.balanceSatang || 0) + redeemed.amountSatang;
        wallet.currency = "THB";
        wallet.updatedAt = nowIso();

        const topup = {
          id: generateId("topup"),
          provider: "truemoney_angpao",
          voucherHash,
          amountSatang: redeemed.amountSatang,
          currency: "THB",
          status: "success",
          providerStatus: redeemed.providerStatus,
          ownerName: redeemed.ownerName,
          voucherDetail: redeemed.voucherDetail,
          userId: session.user.id,
          username: session.user.username || "",
          displayName: session.user.global_name || session.user.username || "Discord",
          createdAt: nowIso(),
        };

        store.topups.push(topup);
        await saveBackendStore(store);

        sendJson(res, 201, {
          ok: true,
          topup: publicTopup(topup),
          wallet: publicWallet(wallet),
        });
      } catch (error) {
        store = await readBackendStore();
        store.topups.push({
          id: generateId("topup_failed"),
          provider: "truemoney_angpao",
          voucherHash,
          amountSatang: 0,
          currency: "THB",
          status: "failed",
          error: error.message || "เติมเงินไม่สำเร็จ",
          userId: session.user.id,
          username: session.user.username || "",
          displayName: session.user.global_name || session.user.username || "Discord",
          createdAt: nowIso(),
        });
        await saveBackendStore(store);
        sendJson(res, 400, { ok: false, error: error.message || "เติมเงินไม่สำเร็จ" });
      } finally {
        topupLocks.delete(voucherHash);
      }
      return;
    }

    if (req.method === "GET" && pathname === "/api/plans") {
      sendJson(res, 200, { ok: true, plans });
      return;
    }

    if (req.method === "GET" && pathname === "/api/catalog") {
      const catalog = catalogForStore(await readBackendStore());
      sendJson(res, 200, { ok: true, categories: catalog.categories, products: catalog.products });
      return;
    }

    if (req.method === "GET" && pathname === "/api/categories") {
      sendJson(res, 200, { ok: true, categories: catalogForStore(await readBackendStore()).categories });
      return;
    }

    const categoryProductsMatch = pathname.match(/^\/api\/categories\/([^/]+)\/products$/);
    if (req.method === "GET" && categoryProductsMatch) {
      const slug = decodeURIComponent(categoryProductsMatch[1]);
      const catalog = catalogForStore(await readBackendStore());
      const category = catalog.categories.find((item) => item.slug === slug);
      if (!category) {
        sendJson(res, 404, { ok: false, error: "Category not found" });
        return;
      }

      const products = catalog.products.filter((product) => product.categorySlug === slug);
      sendJson(res, 200, { ok: true, category, products });
      return;
    }

    if (req.method === "POST" && pathname === "/api/keys/verify") {
      const body = await readBody(req);
      const key = normalizeKey(body.key);
      const store = await readBackendStore();
      const license = store.keys.find((item) => item.key === key);

      if (!license) {
        sendJson(res, 404, { ok: false, status: "missing", error: "License key not found" });
        return;
      }

      sendJson(res, 200, { ok: true, license: publicLicense(license) });
      return;
    }

    if (req.method === "POST" && pathname === "/api/checkout") {
      const session = requireSession(req, res);
      if (!session) return;

      const body = await readBody(req);
      const store = await readBackendStore();
      const product = findProduct(body.productId, store);
      const plan = product ? offerFromProduct(product, store) : findPlan(body.planId);

      if (!plan) {
        sendJson(res, 400, { ok: false, error: "Invalid product or plan" });
        return;
      }

      if (product && Number(product.stock || 0) <= 0) {
        sendJson(res, 409, { ok: false, error: "สินค้านี้หมดแล้ว กรุณาเลือกสินค้าอื่น", stock: 0 });
        return;
      }

      const acceptedTerms = body.acceptTerms === true || body.acceptTerms === "yes" || body.acceptTerms === "on";
      if (!acceptedTerms) {
        sendJson(res, 400, { ok: false, error: "กรุณายอมรับข้อกำหนดในการให้บริการก่อนสั่งซื้อ" });
        return;
      }

      const priceSatang = amountToSatang(plan.price);
      const wallet = walletForUser(store, session.user);

      if (Number(wallet.balanceSatang || 0) < priceSatang) {
        sendJson(res, 402, {
          ok: false,
          error: "ยอดเครดิตไม่พอ กรุณาเติมเงินก่อนซื้อ",
          wallet: publicWallet(wallet),
          required: satangToBaht(priceSatang),
          missing: satangToBaht(priceSatang - Number(wallet.balanceSatang || 0)),
        });
        return;
      }

      wallet.balanceSatang = Number(wallet.balanceSatang || 0) - priceSatang;
      wallet.currency = "THB";
      wallet.updatedAt = nowIso();

      const customerName = session.user.global_name || session.user.username || "Discord";
      const contact = `discord:${session.user.id}`;
      const order = {
        id: generateId("order"),
        planId: plan.id,
        planName: plan.name,
        productId: plan.productId || null,
        categorySlug: plan.categorySlug || null,
        categoryName: plan.categoryName || null,
        amount: plan.price,
        currency: plan.currency,
        amountSatang: priceSatang,
        status: "paid_wallet",
        customerName,
        contact,
        userId: session.user.id,
        username: session.user.username || "",
        displayName: customerName,
        paymentMethod: "wallet_credit",
        walletDebitSatang: priceSatang,
        licenseKey: null,
        createdAt: nowIso(),
      };

      store.orders.push(order);
      const license = createLicense(store, plan, order, "Issued from wallet checkout");
      if (product) {
        store.inventory[product.id] = Math.max(0, Number(product.stock || 0) - 1);
      }
      await createScriptLicenseForCheckout(license, order, session.user);
      await saveBackendStore(store);

      sendJson(res, 201, {
        ok: true,
        order,
        license: publicLicense(license),
        script: {
          loader: buildScriptLoaderSnippet(license.key, session.user.id, req),
          loaderUrl: `${publicBaseUrl(req)}/loader.lua`,
          backend: supabaseConfigured() ? "supabase" : "local",
        },
        stock: product ? { productId: product.id, remaining: store.inventory[product.id] } : null,
        wallet: publicWallet(wallet),
      });
      return;
    }

    if (pathname.startsWith("/api/admin/")) {
      if (!requireAdmin(req, res)) return;
      await handleAdminApi(req, res, pathname);
      return;
    }

    sendJson(res, 404, { ok: false, error: "API route not found" });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message || "Server error" });
  }
}

async function handleAdminApi(req, res, pathname) {
  const store = await readBackendStore();

  if (req.method === "GET" && pathname === "/api/admin/summary") {
    sendJson(res, 200, { ok: true, summary: summarize(store) });
    return;
  }

  if (req.method === "GET" && pathname === "/api/admin/products") {
    const catalog = catalogForStore(store);
    sendJson(res, 200, {
      ok: true,
      categories: catalog.categories,
      products: productsForAdmin(store),
      defaultProducts: catalogProducts.length,
    });
    return;
  }

  if (req.method === "POST" && pathname === "/api/admin/products") {
    const body = await readBody(req);
    const usedIds = new Set([...catalogProducts.map((product) => product.id), ...customProductsForAdmin(store).map((product) => product.id)]);
    const product = normalizeAdminProduct(body, null, usedIds);
    store.products.push(product);
    store.inventory[product.id] = product.stock;
    await saveBackendStore(store);
    sendJson(res, 201, { ok: true, product: adminProduct(product, store), categories: catalogForStore(store).categories });
    return;
  }

  const productMatch = pathname.match(/^\/api\/admin\/products\/([^/]+)$/);
  if (productMatch && req.method === "PATCH") {
    const productId = decodeURIComponent(productMatch[1]);
    const defaultProduct = catalogProducts.find((product) => product.id === productId);
    const index = store.products.findIndex((product) => product.id === productId);

    if (defaultProduct) {
      const body = await readBody(req);
      const deletedIds = deletedProductSet(store);

      if (body.stock !== undefined) {
        const stock = Math.max(0, Math.round(Number(body.stock || 0)));
        store.inventory[productId] = Number.isFinite(stock) ? stock : productStockForStore(store, defaultProduct);
      }

      if (body.restore === true || body.hidden === false || body.hidden === "false") {
        deletedIds.delete(productId);
      } else if (body.hidden === true || body.hidden === "true" || body.deleted === true) {
        deletedIds.add(productId);
      }

      store.deletedProductIds = [...deletedIds];
      await saveBackendStore(store);
      sendJson(res, 200, { ok: true, product: adminProduct(defaultProduct, store, "default"), categories: catalogForStore(store).categories });
      return;
    }

    if (index === -1) {
      sendJson(res, 404, { ok: false, error: "Product not found or is a default product" });
      return;
    }

    const body = await readBody(req);
    if (Object.prototype.hasOwnProperty.call(body, "hidden") && Object.keys(body).length === 1) {
      store.products[index].hidden = body.hidden === true || body.hidden === "true";
      store.products[index].updatedAt = nowIso();
    } else {
      const usedIds = new Set([...catalogProducts.map((product) => product.id), ...store.products.filter((_, itemIndex) => itemIndex !== index).map((product) => product.id)]);
      store.products[index] = normalizeAdminProduct(body, store.products[index], usedIds);
      store.inventory[store.products[index].id] = store.products[index].stock;
    }

    await saveBackendStore(store);
    sendJson(res, 200, { ok: true, product: adminProduct(store.products[index], store), categories: catalogForStore(store).categories });
    return;
  }

  if (productMatch && req.method === "DELETE") {
    const productId = decodeURIComponent(productMatch[1]);
    const defaultProduct = catalogProducts.find((product) => product.id === productId);
    if (defaultProduct) {
      const deletedIds = deletedProductSet(store);
      deletedIds.add(productId);
      store.deletedProductIds = [...deletedIds];
      await saveBackendStore(store);
      sendJson(res, 200, { ok: true, product: adminProduct(defaultProduct, store, "default"), categories: catalogForStore(store).categories });
      return;
    }

    const index = store.products.findIndex((product) => product.id === productId);
    if (index === -1) {
      sendJson(res, 404, { ok: false, error: "Product not found or is a default product" });
      return;
    }

    const [removed] = store.products.splice(index, 1);
    delete store.inventory[productId];
    await saveBackendStore(store);
    sendJson(res, 200, { ok: true, product: adminProduct(removed, store), categories: catalogForStore(store).categories });
    return;
  }

  if (req.method === "GET" && pathname === "/api/admin/keys") {
    const keys = [...store.keys]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map(adminLicense);
    sendJson(res, 200, { ok: true, keys });
    return;
  }

  if (req.method === "GET" && pathname === "/api/admin/script-keys") {
    if (supabaseConfigured()) {
      try {
        const keys = await supabaseRequest("script_licenses?select=*&order=created_at.desc&limit=100");
        sendJson(res, 200, { ok: true, keys: keys.map(publicScriptLicense), backend: "supabase" });
        return;
      } catch (error) {
        console.warn(`Admin script keys Supabase read failed, using local fallback: ${error.message}`);
      }
    }

    sendJson(res, 200, { ok: true, keys: localScriptLicensesForAdmin(store), backend: "local" });
    return;
  }

  if (req.method === "POST" && pathname === "/api/admin/script-keys") {
    const body = await readBody(req);
    const discordId = normalizeDiscordId(body.discordId || body.id);
    const productId = String(body.productId || "shora-hub-v1").trim();
    const durationDays = Number(body.durationDays || 30);
    const maxDevices = Math.max(1, Math.min(10, Number(body.maxDevices || 1)));

    if (!discordId) {
      sendJson(res, 400, { ok: false, error: "Discord ID is required" });
      return;
    }

    if (supabaseConfigured()) {
      let key = "";
      let created = null;
      try {
        for (let attempt = 0; attempt < 8; attempt += 1) {
          key = generateScriptKey();
          try {
            const inserted = await supabaseRequest("script_licenses", {
              method: "POST",
              prefer: "return=representation",
              body: {
                license_key: key,
                discord_id: discordId,
                product_id: productId,
                status: "active",
                max_devices: maxDevices,
                expires_at: scriptExpiresAt(durationDays),
                note: String(body.note || "").trim(),
                created_by: "admin",
              },
            });
            created = Array.isArray(inserted) ? inserted[0] : null;
            break;
          } catch (error) {
            if (!/duplicate|unique/i.test(error.message) || attempt === 7) throw error;
          }
        }

        if (!created) {
          throw new Error("Script key was created but Supabase did not return the row.");
        }

        sendJson(res, 201, {
          ok: true,
          license: publicScriptLicense(created),
          loader: buildScriptLoaderSnippet(key, discordId, req),
          backend: "supabase",
        });
        return;
      } catch (error) {
        console.warn(`Admin script key Supabase create failed, using local fallback: ${error.message}`);
      }
    }

    const localLicense = createLocalScriptLicenseForAdmin(store, body);
    await saveBackendStore(store);
    sendJson(res, 201, {
      ok: true,
      license: publicLocalScriptLicense(localLicense),
      loader: buildScriptLoaderSnippet(localLicense.key, discordId, req),
      backend: "local",
    });
    return;
  }

  const scriptKeyMatch = pathname.match(/^\/api\/admin\/script-keys\/([^/]+)$/);
  if (scriptKeyMatch && req.method === "PATCH") {
    const key = normalizeKey(decodeURIComponent(scriptKeyMatch[1]));
    const body = await readBody(req);
    const patch = { updated_at: nowIso() };
    const nextStatus = String(body.status || "").toLowerCase();

    if (nextStatus) {
      if (!["active", "revoked"].includes(nextStatus)) {
        sendJson(res, 400, { ok: false, error: "Status must be active or revoked" });
        return;
      }
      patch.status = nextStatus;
    }

    if (body.resetHwid === true) {
      patch.hwid_hash = null;
      patch.hwid_bound_at = null;
    }

    if (Object.keys(patch).length === 1) {
      sendJson(res, 400, { ok: false, error: "No script key changes provided" });
      return;
    }

    if (supabaseConfigured()) {
      try {
        const updated = await supabaseRequest(`script_licenses?license_key=eq.${postgrestValue(key)}`, {
          method: "PATCH",
          prefer: "return=representation",
          body: patch,
        });

        if (Array.isArray(updated) && updated[0]) {
          sendJson(res, 200, { ok: true, license: publicScriptLicense(updated[0]), backend: "supabase" });
          return;
        }
      } catch (error) {
        console.warn(`Admin script key Supabase update failed, using local fallback: ${error.message}`);
      }
    }

    const localLicense = store.keys.find((license) => license.key === key && String(license.contact || "").startsWith("discord:"));
    if (!localLicense) {
      sendJson(res, 404, { ok: false, error: "Script key not found" });
      return;
    }

    if (nextStatus) localLicense.status = nextStatus;
    if (body.resetHwid === true) localLicense.activations = [];
    localLicense.updatedAt = nowIso();
    await saveBackendStore(store);
    sendJson(res, 200, { ok: true, license: publicLocalScriptLicense(localLicense), backend: "local" });
    return;
  }

  if (req.method === "GET" && pathname === "/api/admin/script-source") {
    const source = await readBackendScriptSource();
    sendJson(res, 200, {
      ok: true,
      source: source.source,
      kind: source.kind,
      path: path.relative(ROOT_DIR, source.path),
    });
    return;
  }

  if (req.method === "PUT" && pathname === "/api/admin/script-source") {
    const body = await readBody(req);
    const source = String(body.source || "");
    if (source.length > 2_000_000) {
      sendJson(res, 400, { ok: false, error: "Source is too large." });
      return;
    }

    await writeBackendScriptSource(source);
    sendJson(res, 200, {
      ok: true,
      path: supabaseConfigured() ? "supabase:shora_script_sources/main" : path.relative(ROOT_DIR, scriptSourcePath()),
      bytes: Buffer.byteLength(source, "utf8"),
    });
    return;
  }

  if (req.method === "GET" && pathname === "/api/admin/orders") {
    const orders = [...store.orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    sendJson(res, 200, { ok: true, orders });
    return;
  }

  if (req.method === "POST" && pathname === "/api/admin/keys") {
    const body = await readBody(req);
    const plan = findPlan(body.planId);
    if (!plan) {
      sendJson(res, 400, { ok: false, error: "Invalid plan" });
      return;
    }

    const order = {
      id: generateId("manual"),
      planId: plan.id,
      planName: plan.name,
      amount: Number(body.amount || plan.price),
      currency: plan.currency,
      status: "paid_manual",
      customerName: String(body.customerName || "Manual Customer").trim(),
      contact: String(body.contact || "").trim(),
      paymentMethod: "manual_admin",
      licenseKey: null,
      createdAt: nowIso(),
    };

    store.orders.push(order);
    const license = createLicense(store, plan, order, String(body.note || "Issued by admin"));
    await saveBackendStore(store);
    sendJson(res, 201, { ok: true, license: adminLicense(license), order });
    return;
  }

  const keyMatch = pathname.match(/^\/api\/admin\/keys\/([^/]+)$/);
  if (keyMatch && req.method === "PATCH") {
    const key = normalizeKey(decodeURIComponent(keyMatch[1]));
    const body = await readBody(req);
    const license = store.keys.find((item) => item.key === key);

    if (!license) {
      sendJson(res, 404, { ok: false, error: "License key not found" });
      return;
    }

    const nextStatus = String(body.status || "").toLowerCase();
    if (!["active", "revoked"].includes(nextStatus)) {
      sendJson(res, 400, { ok: false, error: "Status must be active or revoked" });
      return;
    }

    license.status = nextStatus;
    license.note = String(body.note || license.note || "");
    license.updatedAt = nowIso();
    await saveBackendStore(store);
    sendJson(res, 200, { ok: true, license: adminLicense(license) });
    return;
  }

  sendJson(res, 404, { ok: false, error: "Admin route not found" });
}

function serveStatic(req, res, pathname) {
  const pageRoutes = {
    "/": "/index.html",
    "/category": "/category.html",
    "/tools": "/tools.html",
    "/topup": "/topup.html",
    "/history": "/history.html",
    "/terms": "/terms.html",
    "/guide": "/guide.html",
    "/contact": "/contact.html",
    "/admin": "/admin.html",
  };
  const requestPath = pathname.startsWith("/category/") ? "/products.html" : pageRoutes[pathname] || pathname;

  if (requestPath.startsWith("/data/") || requestPath.startsWith("/scripts/") || requestPath === "/server.js" || requestPath === "/package.json") {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(requestPath);
  } catch {
    res.writeHead(400);
    res.end("Bad request");
    return;
  }

  const filePath = path.resolve(ROOT_DIR, `.${decodedPath}`);
  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  if (!contentTypes[ext]) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(error.code === "ENOENT" ? 404 : 500);
      res.end(error.code === "ENOENT" ? "Not found" : "Server error");
      return;
    }

    res.writeHead(200, {
      "Content-Type": contentTypes[ext],
      "Cache-Control": [".html", ".css", ".js"].includes(ext) ? "no-store" : "public, max-age=300",
    });
    res.end(content);
  });
}

ensureStore();

function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  return handleAuth(req, res, url).then((handled) => {
    if (handled) return;

    if (url.pathname.startsWith("/api/")) {
      return handleApi(req, res, url);
    }

    if (url.pathname === "/loader.lua") {
      sendLua(res, 200, buildScriptLoader(req));
      return;
    }

    serveStatic(req, res, url.pathname);
  }).catch((error) => {
    if (res.headersSent) {
      res.end();
      return;
    }
    sendJson(res, 500, { ok: false, error: error.message || "Server error" });
  });
}

if (require.main === module) {
  const server = http.createServer(handleRequest);
  server.listen(PORT, () => {
    console.log(`ShoraKey running at http://localhost:${PORT}`);
    console.log(`Admin token: ${ADMIN_TOKEN}`);
  });
}

module.exports = { handleRequest };
