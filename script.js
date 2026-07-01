const fallbackCatalog = {
  categories: [
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
  ],
  products: [
    { id: "xenon-daily", categorySlug: "xenon-hub-v1", name: "Shora Hub V1 - Daily", badge: "24H", price: 99, durationDays: 1, devicesLimit: 1, features: ["ใช้งาน 24 ชั่วโมง", "รับคีย์ทันที", "เหมาะสำหรับทดลอง"] },
    { id: "shora-test-free", categorySlug: "xenon-hub-v1", name: "Shora Test Key - Free", badge: "TEST", price: 0, durationDays: 1, devicesLimit: 1, features: ["ทดสอบระบบสั่งซื้อ", "ไม่ต้องใช้เครดิต", "ออกคีย์ทดสอบจริง"] },
    { id: "xenon-weekly", categorySlug: "xenon-hub-v1", name: "Shora Hub V1 - Weekly", badge: "7D", price: 249, durationDays: 7, devicesLimit: 1, features: ["ใช้งาน 7 วัน", "อัปเดตอัตโนมัติ", "Basic support"] },
    { id: "xenon-monthly", categorySlug: "xenon-hub-v1", name: "Shora Hub V1 - Monthly", badge: "HOT", price: 499, durationDays: 30, devicesLimit: 3, features: ["ใช้งาน 30 วัน", "Priority updates", "ย้ายเครื่องได้ตามเงื่อนไข"] },
    { id: "xenon-lifetime", categorySlug: "xenon-hub-v1", name: "Shora Hub V1 - Lifetime", badge: "VIP", price: 1990, durationDays: null, devicesLimit: 3, features: ["ใช้งานถาวร", "Lifetime updates", "VIP support"] },
    { id: "storm-daily", categorySlug: "storm-launcher-pc", name: "Storm Launcher - Daily", badge: "24H", price: 89, durationDays: 1, devicesLimit: 1, features: ["ใช้งาน 24 ชั่วโมง", "PC launcher access", "รับคีย์ทันที"] },
    { id: "storm-monthly", categorySlug: "storm-launcher-pc", name: "Storm Launcher - Monthly", badge: "PRO", price: 399, durationDays: 30, devicesLimit: 2, features: ["ใช้งาน 30 วัน", "Priority updates", "Support channel"] },
    { id: "storm-lifetime", categorySlug: "storm-launcher-pc", name: "Storm Launcher - Lifetime", badge: "VIP", price: 1590, durationDays: null, devicesLimit: 2, features: ["ใช้งานถาวร", "Lifetime updates", "VIP support"] },
    { id: "scripts-monthly", categorySlug: "premium-scripts", name: "Premium Scripts - Monthly", badge: "PRO", price: 349, durationDays: 30, devicesLimit: 1, features: ["ใช้งาน 30 วัน", "Private scripts", "อัปเดตรายสัปดาห์"] },
    { id: "scripts-bundle", categorySlug: "premium-scripts", name: "Premium Scripts - Bundle", badge: "BUNDLE", price: 799, durationDays: 60, devicesLimit: 2, features: ["ใช้งาน 60 วัน", "รวม 5 สคริปต์", "Priority support"] },
    { id: "scripts-lifetime", categorySlug: "premium-scripts", name: "Premium Scripts - Lifetime", badge: "VIP", price: 1290, durationDays: null, devicesLimit: 2, features: ["ใช้งานถาวร", "Private release access", "VIP support"] },
  ],
};

const page = document.body.dataset.page || "home";
const toast = document.querySelector("#toast");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const pageTransitionMs = 2000;
const pageTransitionStorageKey = "shora_loader_until";
let revealObserver;
let catalogCache;

function money(value) {
  return `฿${Number(value || 0).toLocaleString("th-TH")}`;
}

function formatDate(value) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildLoaderSnippet(key, discordId) {
  return [
    `getgenv().Key = "${String(key || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`,
    `getgenv().id = "${String(discordId || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`,
    `loadstring(game:HttpGet("${location.origin}/loader.lua"))()`,
  ].join("\n");
}

function scriptSnippetBox(loader, title = "สคริปต์สำหรับรัน") {
  if (!loader) return "";
  return `
    <div class="script-snippet-box">
      <div>
        <strong>${escapeHtml(title)}</strong>
        <span>คัดลอกไปวางใน executor ได้เลย ระบบจะผูก HWID ตอนรันครั้งแรก</span>
      </div>
      <pre><code>${escapeHtml(loader)}</code></pre>
      <button class="button button-primary" type="button" data-copy="${escapeHtml(loader)}">Copy script</button>
    </div>
  `;
}

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2600);
}

async function apiJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

async function getCatalog() {
  if (catalogCache) return catalogCache;

  try {
    catalogCache = await apiJson("/api/catalog");
  } catch {
    catalogCache = { ok: true, ...fallbackCatalog };
  }

  return catalogCache;
}

function categoryCard(category) {
  return `
    <a class="category-card reveal" href="/category/${encodeURIComponent(category.slug)}">
      <img src="${escapeHtml(category.image)}" alt="${escapeHtml(category.name)} banner" loading="lazy" />
      <div class="category-copy">
        <h2>${escapeHtml(category.name)}</h2>
        <p>${Number(category.itemCount || 0)} สินค้า</p>
      </div>
    </a>
  `;
}

function productDetailUrl(product) {
  return `/category/${encodeURIComponent(product.categorySlug)}/${encodeURIComponent(product.id)}`;
}

function productStock(product) {
  const stockMap = {
    "xenon-daily": 35,
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
  return Math.max(0, Number(product.stock ?? stockMap[product.id] ?? 0));
}

function productCard(product, image) {
  const duration = product.durationDays ? `ใช้งาน ${product.durationDays} วัน` : "ใช้งานถาวร";
  const detailUrl = productDetailUrl(product);
  const stock = productStock(product);
  const soldOut = stock <= 0;

  return `
    <article class="product-card reveal">
      <a href="${escapeHtml(detailUrl)}">
        <img class="product-card-image" src="${escapeHtml(image || "/assets/site-logo.png")}" alt="${escapeHtml(product.name)}" />
      </a>
      <div class="product-card-body">
        <span class="product-badge">${escapeHtml(product.badge || "KEY")}</span>
        <h2><a href="${escapeHtml(detailUrl)}">${escapeHtml(product.name)}</a></h2>
        <p>${duration} • ${Number(product.devicesLimit || 1)} device • คงเหลือ ${stock}</p>
        <div class="product-buy-row">
          <strong>${money(product.price)}</strong>
          ${
            soldOut
              ? `<span class="button button-secondary is-disabled">สินค้าหมด</span>`
              : `<a class="button button-primary" href="${escapeHtml(detailUrl)}">ซื้อเลย</a>`
          }
        </div>
      </div>
    </article>
  `;
}

async function renderHome() {
  const mount = document.querySelector("#homeCategories");
  if (!mount) return;
  const catalog = await getCatalog();
  mount.innerHTML = catalog.categories.slice(0, 2).map(categoryCard).join("");
}

async function renderCategories() {
  const mount = document.querySelector("#categoryList");
  if (!mount) return;
  const catalog = await getCatalog();
  mount.innerHTML = catalog.categories.map(categoryCard).join("");
}

function currentCategorySlug() {
  const parts = location.pathname.split("/").filter(Boolean);
  return parts[0] === "category" ? parts[1] : null;
}

function currentProductId() {
  const parts = location.pathname.split("/").filter(Boolean);
  return parts[0] === "category" ? parts[2] || null : null;
}

function renderProductDetail({ hero, title, list, shell, category, product }) {
  const image = product.image || category.image || "/assets/site-logo.png";
  const stock = productStock(product);
  const canBuy = stock > 0;
  const quantityValue = canBuy ? 1 : 0;
  const duration = product.durationDays ? `ใช้งาน ${product.durationDays} วัน` : "ใช้งานถาวร";
  const features = [
    `✅ ซื้อมาแล้วใช้งานได้ ${product.durationDays || "ถาวร"} วัน หลัง Redeem แล้วเวลาเดินทันที`,
    "✅ ช่วยให้คุณโหลดขึ้นและขึ้นแรงค์ Champion ได้แบบชิลๆ",
    "❌ ตัวสคริปต์ไม่ได้มี Auto Farm นะจ๊ะ",
  ];

  document.title = `${product.name} - Shora Hub`;
  shell?.classList.add("is-detail");
  title?.closest(".product-shell-head")?.setAttribute("hidden", "");
  list.className = "product-detail";
  hero.innerHTML = `
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <a href="/category">หมวดหมู่</a>
      <span aria-hidden="true">›</span>
      <a href="/category/${escapeHtml(encodeURIComponent(category.slug))}">${escapeHtml(category.name)}</a>
      <span aria-hidden="true">›</span>
      <strong>${escapeHtml(product.name)}</strong>
    </nav>
  `;
  list.innerHTML = `
    <section class="product-detail-card">
      <div class="detail-media">
        <img src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}" />
      </div>
      <div class="detail-content">
        <h1><span class="status-dot"></span>${escapeHtml(product.name)}</h1>
        <div class="detail-price">${money(product.price)}</div>
        <div class="detail-copy">
          <span>คำอธิบายสินค้า</span>
          <p><strong>รายละเอียดสคริปต์ว่าดีแค่ไหน กรุณาอ่านด้านล่าง 👇</strong></p>
          <p>👉 <a href="/guide">https://docs.shorahub.pro/introduction</a></p>
          ${features.map((feature) => `<p>${escapeHtml(feature)}</p>`).join("")}
          <p><strong>** ทั้งนี้อยู่ที่ผู้ใช้งานด้วย หากตั้งค่าไม่เนียนมีสิทธิ์โดนจัดคดีส่ง Report Ban ได้ ทางเราไม่รับผิดชอบใดๆ ทั้งสิ้น หากใช้แล้วโดน Manual Ban จากแอดมิน **</strong></p>
          <p><strong>สำคัญ หากทางเว็บเตือนกรุณาลองใช้ไอดีที่ใช้ในการเทสก่อนสคริปต์ถูกอัปเดต เนื่องจากตัวเกมเพิ่มอัปเดตกันโปรมาให้ครับ</strong></p>
        </div>
        <div class="detail-actions">
          <div class="quantity-stepper" aria-label="จำนวนสินค้า">
            <button type="button" data-quantity-step="-1">−</button>
            <input id="detailQuantity" type="number" min="${canBuy ? 1 : 0}" max="${canBuy ? stock : 0}" value="${quantityValue}" readonly />
            <button type="button" data-quantity-step="1">+</button>
          </div>
          <span class="stock-label">คงเหลือ ${stock}</span>
          <span class="sum-label">จำนวนเงิน<br /><strong id="detailTotal" data-unit-price="${Number(product.price || 0)}">${money(product.price)}</strong></span>
        </div>
        <button class="button button-primary detail-buy" type="button" ${canBuy ? `data-buy-product="${escapeHtml(product.id)}"` : "disabled"}>${canBuy ? "ซื้อเลย" : "สินค้าหมด"}</button>
      </div>
    </section>
  `;
}

async function renderProducts() {
  const hero = document.querySelector("#categoryHero");
  const title = document.querySelector("#productShellTitle");
  const list = document.querySelector("#productList");
  if (!hero || !list) return;

  const slug = currentCategorySlug() || "xenon-hub-v1";
  const productId = currentProductId();
  const catalog = await getCatalog();
  const category = catalog.categories.find((item) => item.slug === slug);
  const products = catalog.products.filter((product) => product.categorySlug === slug);
  const shell = document.querySelector(".product-shell");

  if (!category) {
    hero.innerHTML = `<a class="back-link" href="/category">กลับไปหมวดหมู่</a>`;
    if (title) title.textContent = "ไม่พบหมวดหมู่";
    list.innerHTML = `<p class="empty-state">กลับไปเลือกหมวดหมู่ใหม่อีกครั้ง</p>`;
    return;
  }

  const titleWrap = title?.closest(".product-shell-head");
  shell?.classList.remove("is-detail");
  titleWrap?.removeAttribute("hidden");
  list.className = "product-grid";

  if (productId) {
    const product = products.find((item) => item.id === productId);
    if (!product) {
      hero.innerHTML = `
        <nav class="breadcrumb" aria-label="Breadcrumb">
          <a href="/category">หมวดหมู่</a>
          <span aria-hidden="true">›</span>
          <a href="/category/${escapeHtml(encodeURIComponent(category.slug))}">${escapeHtml(category.name)}</a>
        </nav>
      `;
      if (title) title.textContent = "ไม่พบสินค้า";
      list.innerHTML = `<p class="empty-state">กลับไปเลือกสินค้าใหม่อีกครั้ง</p>`;
      return;
    }

    renderProductDetail({ hero, title, list, shell, category, product });
    return;
  }

  document.title = `${category.name} - Shora Hub`;
  hero.innerHTML = `
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <a href="/category">หมวดหมู่</a>
      <span aria-hidden="true">›</span>
      <strong>${escapeHtml(category.name)}</strong>
    </nav>
  `;
  if (title) title.textContent = `สินค้า ${category.name}`;
  list.innerHTML = products.length
    ? products.map((product) => productCard(product, product.image || category.image)).join("")
    : `<p class="empty-state">ยังไม่มีสินค้าในหมวดนี้</p>`;
}

function ensureCheckoutModal() {
  let modal = document.querySelector("#checkoutModal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.className = "modal";
  modal.id = "checkoutModal";
  modal.hidden = true;
  modal.innerHTML = `
    <div class="modal-backdrop" data-close-checkout></div>
    <section class="checkout-dialog" role="dialog" aria-modal="true" aria-labelledby="checkoutTitle">
      <div class="modal-head">
        <div>
          <p class="eyebrow">Checkout</p>
          <h2 id="checkoutTitle">ยืนยันการซื้อ</h2>
        </div>
        <button class="modal-close" type="button" aria-label="Close checkout" data-close-checkout>×</button>
      </div>
      <form class="checkout-form" id="checkoutForm">
        <input type="hidden" name="productId" id="checkoutProductId" />
        <div class="selected-plan">
          <span>สินค้า</span>
          <strong id="checkoutProductName">-</strong>
          <em id="checkoutProductPrice">฿0</em>
        </div>
        <div class="checkout-account">
          <span>บัญชีผู้ใช้</span>
          <strong id="checkoutAccountName">-</strong>
        </div>
        <div class="checkout-wallet">
          <div>
            <span>ยอดเครดิต</span>
            <strong id="checkoutWalletBalance">฿0.00</strong>
          </div>
          <div>
            <span>หลังซื้อ</span>
            <strong id="checkoutWalletAfter">฿0.00</strong>
          </div>
        </div>
        <label class="checkout-terms">
          <input id="checkoutTerms" name="acceptTerms" type="checkbox" value="yes" />
          <span>ยอมรับ <a href="/terms" target="_blank" rel="noreferrer">ข้อกำหนดในการให้บริการ</a></span>
        </label>
        <button class="button button-primary" type="submit" id="checkoutSubmit" disabled>ยอมรับข้อกำหนดก่อนซื้อ</button>
        <div class="checkout-result" id="checkoutResult" role="status" aria-live="polite"></div>
      </form>
    </section>
  `;

  document.body.append(modal);
  modal.querySelectorAll("[data-close-checkout]").forEach((node) => node.addEventListener("click", closeCheckout));
  modal.querySelector("#checkoutForm").addEventListener("submit", submitCheckout);
  modal.querySelector("#checkoutTerms").addEventListener("change", () => syncCheckoutSubmit(modal));
  registerLiquidTargets();
  return modal;
}

function syncCheckoutSubmit(modal = document.querySelector("#checkoutModal")) {
  if (!modal) return;
  const submitButton = modal.querySelector("#checkoutSubmit");
  const terms = modal.querySelector("#checkoutTerms");
  const form = modal.querySelector("#checkoutForm");
  if (!submitButton || !terms) return;

  if (form?.dataset.completed === "true") {
    submitButton.disabled = true;
    submitButton.textContent = "ซื้อสำเร็จ";
    return;
  }

  const balanceSatang = Number(modal.dataset.walletBalanceSatang || 0);
  const priceSatang = Number(modal.dataset.productPriceSatang || 0);
  const hasCredit = balanceSatang >= priceSatang;
  const accepted = terms.checked;

  submitButton.disabled = !(hasCredit && accepted);
  submitButton.textContent = !hasCredit ? "เครดิตไม่พอ" : accepted ? "ซื้อด้วยเครดิต" : "ยอมรับข้อกำหนดก่อนซื้อ";
}

async function openCheckout(productId) {
  const catalog = await getCatalog();
  const product = catalog.products.find((item) => item.id === productId);

  if (!product) {
    showToast("ไม่พบสินค้านี้");
    return;
  }

  if (productStock(product) <= 0) {
    catalogCache = null;
    showToast("สินค้านี้หมดแล้ว");
    return;
  }

  let sessionData;
  let walletData;
  try {
    sessionData = await apiJson("/api/session");
    if (!sessionData.authenticated || !sessionData.user) {
      showToast("กรุณาเข้าสู่ระบบด้วย Discord ก่อนซื้อ");
      window.location.href = "/auth/discord";
      return;
    }
    walletData = await apiJson("/api/wallet");
  } catch (error) {
    showToast(error.message || "กรุณาเข้าสู่ระบบก่อนซื้อ");
    window.location.href = "/auth/discord";
    return;
  }

  const user = sessionData.user;
  const displayName = user.displayName || user.globalName || user.username || "Discord";
  const balanceSatang = Number(walletData.wallet?.balanceSatang || 0);
  const priceSatang = Math.round(Number(product.price || 0) * 100);
  const balanceAfterSatang = balanceSatang - priceSatang;
  const modal = ensureCheckoutModal();
  const result = modal.querySelector("#checkoutResult");
  const submitButton = modal.querySelector("#checkoutSubmit");
  const terms = modal.querySelector("#checkoutTerms");
  const form = modal.querySelector("#checkoutForm");

  modal.querySelector("#checkoutProductId").value = product.id;
  modal.querySelector("#checkoutProductName").textContent = product.name;
  modal.querySelector("#checkoutProductPrice").textContent = money(product.price);
  modal.querySelector("#checkoutAccountName").textContent = displayName;
  modal.querySelector("#checkoutWalletBalance").textContent = formatBaht(walletData.wallet?.balance || 0);
  modal.querySelector("#checkoutWalletAfter").textContent =
    balanceAfterSatang >= 0 ? formatBaht(balanceAfterSatang / 100) : `ขาด ${formatBaht(Math.abs(balanceAfterSatang) / 100)}`;
  modal.dataset.walletBalanceSatang = String(balanceSatang);
  modal.dataset.productPriceSatang = String(priceSatang);
  if (form) form.dataset.completed = "false";
  if (terms) terms.checked = false;
  result.className = "checkout-result";
  result.textContent = "";
  if (balanceAfterSatang < 0) {
    result.className = "checkout-result show error";
    result.innerHTML = `เครดิตไม่พอสำหรับสินค้านี้ <a href="/topup">ไปเติมเงิน</a>`;
  }
  syncCheckoutSubmit(modal);
  modal.hidden = false;
  modal.querySelector(".checkout-dialog")?.classList.add("is-visible");
  terms?.focus();
}

function closeCheckout() {
  const modal = document.querySelector("#checkoutModal");
  if (modal) modal.hidden = true;
}

async function submitCheckout(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector("button[type='submit']");
  const result = form.querySelector("#checkoutResult");
  const modal = form.closest(".modal");
  const terms = form.querySelector("#checkoutTerms");
  const payload = Object.fromEntries(new FormData(form).entries());

  if (!terms?.checked) {
    result.className = "checkout-result show error";
    result.textContent = "กรุณายอมรับข้อกำหนดในการให้บริการก่อนสั่งซื้อ";
    syncCheckoutSubmit(modal);
    return;
  }

  submitButton.disabled = true;
  result.className = "checkout-result show";
  result.textContent = "กำลังหักเครดิตและสร้าง key...";

  try {
    const data = await apiJson("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    result.innerHTML = `
      <div class="license-box">
        <strong>สร้าง key สำเร็จ</strong>
        <code>${escapeHtml(data.license.key)}</code>
        <p>${escapeHtml(data.order.planName)} • หมดอายุ: ${escapeHtml(formatDate(data.license.expiresAt))}</p>
        <button class="button button-glass" type="button" data-copy="${escapeHtml(data.license.key)}">Copy key</button>
        ${scriptSnippetBox(data.script?.loader || "", "สคริปต์ของคุณ")}
      </div>
    `;
    result.className = "checkout-result show success";
    form.dataset.completed = "true";
    catalogCache = null;
  } catch (error) {
    result.className = "checkout-result show error";
    result.textContent = error.message;
  } finally {
    syncCheckoutSubmit(modal);
  }
}

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    showToast("Copied to clipboard");
  } catch {
    showToast(value);
  }
}

function setKeyResult(type, title, message, icon, extraHtml = "") {
  const target = document.querySelector("#keyResult");
  if (!target) return;
  target.className = `key-result ${type}`;
  target.innerHTML = `
    <span>${escapeHtml(icon)}</span>
    <div>
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(message)}</p>
      ${extraHtml}
    </div>
  `;
}

function setupKeyForm() {
  const form = document.querySelector("#keyForm");
  const input = document.querySelector("#licenseKey");
  if (!form || !input) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const key = input.value.trim().toUpperCase();

    if (!key) {
      setKeyResult("error", "ยังไม่ได้กรอกคีย์", "กรุณากรอก key ก่อนตรวจสอบ", "!");
      return;
    }

    setKeyResult("", "กำลังตรวจสอบ", "กำลังเรียกข้อมูลจากระบบ key", "...");

    try {
      const data = await apiJson("/api/keys/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const license = data.license;
      const message = `สินค้า: ${license.planName} • สถานะ: ${license.status} • หมดอายุ: ${formatDate(license.expiresAt)} • เครื่อง: ${license.devicesUsed}/${license.devicesLimit}`;
      const isActive = license.status === "active";
      let extraHtml = "";
      if (isActive) {
        try {
          const session = await apiJson("/api/session");
          if (session.authenticated && session.user?.id) {
            extraHtml = scriptSnippetBox(buildLoaderSnippet(key, session.user.id), "สคริปต์จากคีย์นี้");
          } else {
            extraHtml = `<p><a href="/auth/discord">เข้าสู่ระบบด้วย Discord</a> เพื่อสร้างสคริปต์สำหรับรัน</p>`;
          }
        } catch {
          extraHtml = `<p><a href="/auth/discord">เข้าสู่ระบบด้วย Discord</a> เพื่อสร้างสคริปต์สำหรับรัน</p>`;
        }
      }
      setKeyResult(isActive ? "success" : "error", isActive ? "คีย์ใช้งานได้" : "คีย์ใช้งานไม่ได้", message, isActive ? "OK" : "X", extraHtml);
      if (isActive) {
        document.querySelectorAll("#scriptCopyKey, #resetDeviceKey").forEach((field) => {
          if (!field.value.trim()) field.value = key;
        });
      }
    } catch (error) {
      setKeyResult("error", "ไม่พบหรือเชื่อมต่อไม่ได้", error.message, "!");
    }
  });
}

function setToolResult(selector, type, title, message, extraHtml = "") {
  const target = document.querySelector(selector);
  if (!target) return;
  target.className = `tool-result show ${type || ""}`.trim();
  target.innerHTML = `
    <strong>${escapeHtml(title)}</strong>
    <p>${escapeHtml(message)}</p>
    ${extraHtml}
  `;
}

function loginPromptHtml() {
  return `<a class="button button-primary tool-login-link" href="/auth/discord">เข้าสู่ระบบด้วย Discord</a>`;
}

async function requestScriptTool(endpoint, key) {
  return apiJson(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  });
}

function setupScriptCopyTool() {
  const form = document.querySelector("#scriptCopyForm");
  const input = document.querySelector("#scriptCopyKey");
  if (!form || !input) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const key = input.value.trim().toUpperCase();
    if (!key) {
      setToolResult("#scriptCopyResult", "error", "ยังไม่ได้กรอกคีย์", "กรุณาวาง License Key ก่อนสร้างสคริปต์");
      return;
    }

    setToolResult("#scriptCopyResult", "", "กำลังสร้างสคริปต์", "กำลังตรวจสอบบัญชี Discord และคีย์นี้");

    try {
      const data = await requestScriptTool("/api/script/loader", key);
      setToolResult(
        "#scriptCopyResult",
        "success",
        "สร้างสคริปต์แล้ว",
        data.license?.hwidBound ? "คีย์นี้ผูกเครื่องแล้ว ถ้าย้ายเครื่องให้ใช้ Reset Device ก่อน" : "คัดลอกสคริปต์ไปรันได้เลย ระบบจะผูก HWID ตอนรันครั้งแรก",
        scriptSnippetBox(data.script?.loader || "", "สคริปต์สำหรับคีย์นี้"),
      );
    } catch (error) {
      const needsLogin = /เข้าสู่ระบบ/.test(error.message);
      setToolResult("#scriptCopyResult", "error", "สร้างสคริปต์ไม่สำเร็จ", error.message, needsLogin ? loginPromptHtml() : "");
    }
  });
}

function setupDeviceResetTool() {
  const form = document.querySelector("#resetDeviceForm");
  const input = document.querySelector("#resetDeviceKey");
  if (!form || !input) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const key = input.value.trim().toUpperCase();
    if (!key) {
      setToolResult("#resetDeviceResult", "error", "ยังไม่ได้กรอกคีย์", "กรุณาวาง License Key ก่อน Reset Device");
      return;
    }

    setToolResult("#resetDeviceResult", "", "กำลัง Reset Device", "กำลังล้าง HWID ของคีย์นี้");

    try {
      const data = await requestScriptTool("/api/script/reset-device", key);
      setToolResult(
        "#resetDeviceResult",
        "success",
        "Reset Device สำเร็จ",
        data.message || "ล้าง HWID แล้ว รันสคริปต์อีกครั้งเพื่อผูกเครื่องใหม่",
        scriptSnippetBox(data.script?.loader || "", "สคริปต์หลัง Reset Device"),
      );
    } catch (error) {
      const needsLogin = /เข้าสู่ระบบ/.test(error.message);
      setToolResult("#resetDeviceResult", "error", "Reset Device ไม่สำเร็จ", error.message, needsLogin ? loginPromptHtml() : "");
    }
  });
}

function formatBaht(value) {
  return `฿${Number(value || 0).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function setTopupResult(type, message) {
  const result = document.querySelector("#topupResult");
  if (!result) return;
  result.className = `checkout-result show ${type || ""}`.trim();
  result.innerHTML = message;
}

function historyMoney(value) {
  return `฿${Number(value || 0).toLocaleString("th-TH")}`;
}

function shortKey(value) {
  const text = String(value || "");
  if (!text) return "-";
  return text.length > 18 ? `${text.slice(0, 12)}...${text.slice(-5)}` : text;
}

function statusText(value) {
  const status = String(value || "");
  if (status === "paid_wallet") return "สำเร็จ";
  if (status === "success") return "สำเร็จ";
  if (status === "failed") return "ไม่สำเร็จ";
  if (status === "active") return "ใช้งานได้";
  return status || "-";
}

function historyCell(html, text = "") {
  return { html, text };
}

function historyCellText(cell) {
  if (cell && typeof cell === "object") return String(cell.text || "");
  return String(cell ?? "");
}

function renderHistoryCell(cell) {
  if (cell && typeof cell === "object" && cell.html !== undefined) {
    return `<td>${cell.html}</td>`;
  }
  return `<td>${escapeHtml(cell)}</td>`;
}

function historyRowsFor(tab, data) {
  if (tab === "orders") {
    return {
      headers: ["ชื่อสินค้า", "คีย์", "จำนวนเงิน", "เวลา", "สคริปต์"],
      rows: (data.orders || []).map((order) => {
        const loader = order.scriptLoader || "";
        return [
          order.productName || "-",
          historyCell(`<code>${escapeHtml(shortKey(order.licenseKey))}</code>`, order.licenseKey || ""),
          historyMoney(order.amount),
          formatDate(order.createdAt),
          loader
            ? historyCell(`<button class="history-action" type="button" data-copy="${escapeHtml(loader)}">Copy script</button>`, "copy script")
            : "-",
        ];
      }),
    };
  }

  if (tab === "topups") {
    return {
      headers: ["ช่องทาง", "สถานะ", "จำนวนเงิน", "เวลา"],
      rows: (data.topups || []).map((topup) => [
        topup.provider === "truemoney_angpao" ? "TrueMoney Angpao" : topup.provider || "-",
        statusText(topup.status),
        formatBaht(topup.amount),
        formatDate(topup.createdAt),
      ]),
    };
  }

  return {
    headers: ["License", "ผลลัพธ์", "เหตุผล", "เวลา"],
    rows: (data.tools || []).map((tool) => [
      shortKey(tool.licenseKey),
      tool.allowed ? "อนุญาต" : "ปฏิเสธ",
      tool.reason || "-",
      formatDate(tool.createdAt),
    ]),
  };
}

function renderHistoryTable(tab, data, query = "") {
  const head = document.querySelector("#historyTableHead");
  const body = document.querySelector("#historyTableBody");
  if (!head || !body) return;

  const table = historyRowsFor(tab, data);
  const normalizedQuery = query.trim().toLowerCase();
  const rows = normalizedQuery
    ? table.rows.filter((row) => row.some((cell) => historyCellText(cell).toLowerCase().includes(normalizedQuery)))
    : table.rows;

  head.innerHTML = `<tr>${table.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>`;
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="${table.headers.length}" class="empty-state">ไม่เจอข้อมูล</td></tr>`;
    return;
  }

  body.innerHTML = rows
    .map((row) => `<tr>${row.map(renderHistoryCell).join("")}</tr>`)
    .join("");
}

async function renderHistory() {
  const content = document.querySelector("#historyContent");
  const lock = document.querySelector("#historyLock");
  const search = document.querySelector("#historySearch");
  const tabButtons = document.querySelectorAll("[data-history-tab]");
  if (!content || !lock) return;

  let historyData = { orders: [], topups: [], tools: [] };
  let activeTab = "orders";

  try {
    historyData = await apiJson("/api/history");
    lock.hidden = true;
    content.hidden = false;
    renderHistoryTable(activeTab, historyData, search?.value || "");
  } catch (error) {
    content.hidden = true;
    lock.hidden = false;
    return;
  }

  const update = () => renderHistoryTable(activeTab, historyData, search?.value || "");
  search?.addEventListener("input", update);
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeTab = button.dataset.historyTab || "orders";
      tabButtons.forEach((node) => node.classList.toggle("active", node === button));
      update();
    });
  });
}

function updateWalletCard(wallet, user) {
  const balance = document.querySelector("#walletBalance");
  const owner = document.querySelector("#walletOwner");
  if (!balance) return;

  balance.textContent = formatBaht(wallet.balance);
  if (owner) owner.textContent = user?.displayName ? `บัญชี ${user.displayName}` : "ผูกกับบัญชี Discord แล้ว";
}

async function loadWallet() {
  const balance = document.querySelector("#walletBalance");
  const content = document.querySelector("#topupContent");
  const lock = document.querySelector("#topupLock");
  if (!balance) return false;

  try {
    if (content) content.hidden = false;
    if (lock) lock.hidden = true;
    const session = await apiJson("/api/session");

    if (!session.authenticated || !session.user) {
      if (content) content.hidden = true;
      if (lock) lock.hidden = false;
      return false;
    }

    updateWalletCard({ balance: 0, balanceSatang: 0 }, session.user);

    try {
      const data = await apiJson("/api/wallet");
      updateWalletCard(data.wallet, data.user || session.user);
    } catch (walletError) {
      setTopupResult("error", `โหลดเครดิตไม่สำเร็จ แต่บัญชีล็อกอินอยู่แล้ว ลองรีเฟรชอีกครั้งหากยอดเงินไม่ขึ้น`);
    }

    return true;
  } catch (error) {
    if (content) content.hidden = true;
    if (lock) lock.hidden = false;
    return false;
  }
}

function setupTopupForm() {
  const form = document.querySelector("#angpaoForm");
  const input = document.querySelector("#angpaoUrl");
  const terms = document.querySelector("#acceptTopupTerms");
  const submitButton = document.querySelector("#topupSubmit");
  if (!form || !input) return;

  loadWallet();

  const syncSubmitState = () => {
    if (!submitButton) return;
    submitButton.disabled = !(input.value.trim() && terms?.checked);
  };

  input.addEventListener("input", syncSubmitState);
  terms?.addEventListener("change", syncSubmitState);
  syncSubmitState();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const voucherUrl = input.value.trim();

    if (!voucherUrl) {
      setTopupResult("error", "กรุณาวางลิงก์ซองอั่งเปาก่อน");
      return;
    }

    if (!terms?.checked) {
      setTopupResult("error", "กรุณายอมรับข้อกำหนดในการให้บริการก่อนเติมเงิน");
      return;
    }

    submitButton.disabled = true;
    setTopupResult("", "กำลังตรวจสอบและรับซองอั่งเปา...");

    try {
      const data = await apiJson("/api/topup/truemoney", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voucherUrl }),
      });

      updateWalletCard(data.wallet);
      input.value = "";
      if (terms) terms.checked = false;
      setTopupResult(
        "success",
        `<strong>เติมเงินสำเร็จ</strong><p>ได้รับ ${escapeHtml(formatBaht(data.topup.amount))} ยอดคงเหลือ ${escapeHtml(formatBaht(data.wallet.balance))}</p>`,
      );
    } catch (error) {
      const loginLink = error.message.includes("Discord") ? ` <a href="/auth/discord">เข้าสู่ระบบ</a>` : "";
      setTopupResult("error", `${escapeHtml(error.message)}${loginLink}`);
    } finally {
      syncSubmitState();
    }
  });
}

function markActiveNav() {
  const current = page === "products" ? "category" : page;
  document.querySelectorAll(".bottom-nav a").forEach((link) => {
    link.classList.toggle("active", link.dataset.nav === current);
  });
}

function updateLiquidPosition(event) {
  const element = event.currentTarget;
  const rect = element.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;
  element.style.setProperty("--mx", `${x.toFixed(2)}%`);
  element.style.setProperty("--my", `${y.toFixed(2)}%`);
}

function resetLiquidPosition(event) {
  event.currentTarget.style.setProperty("--mx", "50%");
  event.currentTarget.style.setProperty("--my", "0%");
}

function registerLiquidTargets() {
  document
    .querySelectorAll(".category-card, .product-card, .tool-card, .payment-card, .checkout-dialog, .admin-card, .metric-card")
    .forEach((element) => {
      if (element.dataset.liquidReady) return;
      element.dataset.liquidReady = "true";
      element.addEventListener("pointermove", updateLiquidPosition);
      element.addEventListener("pointerleave", resetLiquidPosition);
    });
}

function setupReveal() {
  if (reduceMotion.matches) {
    document.querySelectorAll(".reveal").forEach((element) => element.classList.add("is-visible"));
    return;
  }

  revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      });
    },
    { threshold: 0.08, rootMargin: "0px 0px -5% 0px" },
  );
}

function refreshMotion() {
  registerLiquidTargets();
  if (!revealObserver || reduceMotion.matches) return;

  document.querySelectorAll(".reveal:not(.is-visible)").forEach((element, index) => {
    element.style.transitionDelay = `${Math.min(index * 35, 160)}ms`;
    revealObserver.observe(element);
  });
}

function ensurePageLoader() {
  let loader = document.querySelector("#pageLoader");
  if (loader) return loader;

  loader = document.createElement("div");
  loader.className = "page-loader";
  loader.id = "pageLoader";
  loader.setAttribute("aria-hidden", "true");
  loader.innerHTML = `
    <div class="page-loader-card">
      <img src="/assets/site-logo.png" alt="" />
      <span>Shora Hub</span>
      <i>กำลังโหลด</i>
    </div>
  `;
  document.body.append(loader);
  return loader;
}

function showPageLoader() {
  const loader = ensurePageLoader();
  loader.classList.add("is-active");
  document.body.classList.add("is-page-leaving");
}

function hidePageLoader() {
  const loader = ensurePageLoader();
  loader.classList.remove("is-active");
  document.body.classList.remove("is-page-leaving");
}

function rememberPageLoader() {
  try {
    sessionStorage.setItem(pageTransitionStorageKey, String(Date.now() + pageTransitionMs));
  } catch {
    // Session storage can be unavailable in strict browser modes.
  }
}

function remainingPageLoaderMs() {
  try {
    const until = Number(sessionStorage.getItem(pageTransitionStorageKey) || 0);
    return Math.max(0, until - Date.now());
  } catch {
    return 0;
  }
}

function clearPageLoaderMemory() {
  try {
    sessionStorage.removeItem(pageTransitionStorageKey);
  } catch {
    // No-op.
  }
}

function restorePageLoaderIfNeeded() {
  const remaining = remainingPageLoaderMs();
  if (remaining <= 0) {
    clearPageLoaderMemory();
    hidePageLoader();
    return;
  }

  showPageLoader();
  window.setTimeout(() => {
    clearPageLoaderMemory();
    hidePageLoader();
  }, remaining);
}

function setupPageTransitions() {
  ensurePageLoader();
  restorePageLoaderIfNeeded();
  window.addEventListener("pageshow", restorePageLoaderIfNeeded);

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const link = event.target.closest("a[href]");
    if (!link || link.target || link.hasAttribute("download") || link.dataset.noTransition !== undefined) return;

    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin) return;
    if (url.pathname.startsWith("/auth/") || url.pathname.startsWith("/api/")) return;
    if (url.pathname === location.pathname && url.search === location.search && url.hash) return;

    event.preventDefault();
    rememberPageLoader();
    showPageLoader();
    window.setTimeout(() => {
      location.href = url.href;
    }, reduceMotion.matches ? 80 : 180);
  });
}

function setupDelegatedClicks() {
  document.addEventListener("click", (event) => {
    const buyButton = event.target.closest("[data-buy-product]");
    if (buyButton) {
      openCheckout(buyButton.dataset.buyProduct);
      return;
    }

    const copyButton = event.target.closest("[data-copy]");
    if (copyButton) {
      copyText(copyButton.dataset.copy);
      return;
    }

    const toastButton = event.target.closest("[data-toast]");
    if (toastButton) {
      event.preventDefault();
      showToast(toastButton.dataset.toast);
    }

    const quantityButton = event.target.closest("[data-quantity-step]");
    if (quantityButton) {
      const input = document.querySelector("#detailQuantity");
      if (!input) return;
      const step = Number(quantityButton.dataset.quantityStep || 0);
      const min = Number(input.min || 1);
      const max = Number(input.max || 99);
      const nextQuantity = Math.max(min, Math.min(max, Number(input.value || 1) + step));
      input.value = String(nextQuantity);
      const total = document.querySelector("#detailTotal");
      if (total) total.textContent = money(Number(total.dataset.unitPrice || 0) * nextQuantity);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeCheckout();
  });
}

function ensureSiteFooter() {
  if (document.querySelector(".site-footer")) return;
  const footer = document.createElement("footer");
  footer.className = "site-footer";
  footer.innerHTML = `
    <div class="footer-inner">
      <div class="footer-brand">
        <a class="footer-logo" href="/">
          <img src="/assets/site-logo.png" alt="" />
          <span>Shora Hub</span>
        </a>
        <p>Copyright © 2021-2026 Shora Hub</p>
        <p>Developed by <strong>WexZ</strong></p>
        <p>All rights reserved</p>
      </div>
      <nav class="footer-column" aria-label="Footer pages">
        <h2>Pages</h2>
        <a href="/">Home</a>
        <a href="/category">Category</a>
        <a href="/topup">Topup</a>
        <a href="/history">History</a>
      </nav>
      <nav class="footer-column" aria-label="Footer legal">
        <h2>Legal</h2>
        <a href="/terms">Terms of Service</a>
        <a href="/terms">Privacy Policy</a>
        <a href="/terms">Refund Policy</a>
      </nav>
      <nav class="footer-column" aria-label="Footer social">
        <h2>Social</h2>
        <a href="#" data-toast="ยังไม่ได้ตั้งค่าลิงก์ YouTube">Youtube</a>
        <a href="#" data-toast="ยังไม่ได้ตั้งค่าลิงก์ Discord">Discord</a>
        <a href="#" data-toast="ยังไม่ได้ตั้งค่าลิงก์ Facebook">Facebook</a>
      </nav>
    </div>
  `;

  const bottomNav = document.querySelector(".bottom-nav");
  if (bottomNav) {
    bottomNav.insertAdjacentElement("beforebegin", footer);
  } else {
    document.body.append(footer);
  }
}

async function setupSessionButton() {
  const button = document.querySelector("#loginButton");
  if (!button) return;

  try {
    const data = await apiJson("/api/session");
    if (!data.authenticated || !data.user) return;

    const user = data.user;
    const displayName = user.displayName || user.globalName || user.username || "Discord";
    let walletBalance = "฿0.00";
    try {
      const walletData = await apiJson("/api/wallet");
      walletBalance = formatBaht(walletData.wallet?.balance || 0);
    } catch {
      walletBalance = "฿0.00";
    }

    const avatar = user.avatarUrl
      ? `<img class="login-avatar" src="${escapeHtml(user.avatarUrl)}" alt="" />`
      : `<span class="login-avatar fallback" aria-hidden="true">D</span>`;
    const menuId = "accountMenu";

    button.href = "#account";
    button.classList.add("is-logged-in");
    button.removeAttribute("data-provider");
    button.setAttribute("role", "button");
    button.setAttribute("aria-label", `เปิดเมนูบัญชี ${displayName}`);
    button.setAttribute("aria-haspopup", "menu");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", menuId);
    button.title = `บัญชี ${displayName}`;
    button.innerHTML = `${avatar}<span>${escapeHtml(displayName)}</span>`;

    let menu = document.querySelector(`#${menuId}`);
    if (!menu) {
      menu = document.createElement("div");
      menu.id = menuId;
      menu.className = "account-menu";
      menu.setAttribute("role", "menu");
      menu.hidden = true;
      button.insertAdjacentElement("afterend", menu);
    }

    menu.innerHTML = `
      <strong class="account-name">${escapeHtml(displayName)}</strong>
      <div class="account-row"><span>ยอดสะสม</span><em>0</em></div>
      <div class="account-row"><span>ยอดเงิน</span><em>${escapeHtml(walletBalance)}</em></div>
      <a class="account-row account-link" href="/history" role="menuitem"><span>ประวัติ</span><em>›</em></a>
      <a class="account-logout" href="/auth/logout" role="menuitem"><span>ออกจากระบบ</span><span aria-hidden="true">↪</span></a>
    `;

    const closeMenu = () => {
      menu.hidden = true;
      button.setAttribute("aria-expanded", "false");
      button.classList.remove("menu-open");
    };

    button.addEventListener("click", (event) => {
      event.preventDefault();
      const willOpen = menu.hidden;
      menu.hidden = !willOpen;
      button.setAttribute("aria-expanded", String(willOpen));
      button.classList.toggle("menu-open", willOpen);
    });

    document.addEventListener("click", (event) => {
      if (menu.hidden) return;
      if (button.contains(event.target) || menu.contains(event.target)) return;
      closeMenu();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu();
    });
  } catch {
    button.href = "/auth/discord";
  }
}

async function boot() {
  markActiveNav();
  ensureSiteFooter();
  setupSessionButton();
  setupPageTransitions();
  setupDelegatedClicks();
  setupKeyForm();
  setupScriptCopyTool();
  setupDeviceResetTool();
  setupTopupForm();
  setupReveal();

  if (page === "home") await renderHome();
  if (page === "category") await renderCategories();
  if (page === "products") await renderProducts();
  if (page === "history") await renderHistory();

  refreshMotion();
}

boot();
