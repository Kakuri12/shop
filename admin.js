const tokenInput = document.querySelector("#adminToken");
const saveTokenButton = document.querySelector("#saveToken");
const refreshButton = document.querySelector("#refreshAdmin");
const adminStatus = document.querySelector("#adminStatus");
const metricGrid = document.querySelector("#metricGrid");
const keysTable = document.querySelector("#keysTable");
const scriptKeysTable = document.querySelector("#scriptKeysTable");
const productForm = document.querySelector("#productForm");
const productCategory = document.querySelector("#productCategory");
const productsTable = document.querySelector("#productsTable");
const ordersTable = document.querySelector("#ordersTable");
const productCount = document.querySelector("#productCount");
const keyCount = document.querySelector("#keyCount");
const orderCount = document.querySelector("#orderCount");
const scriptKeyCount = document.querySelector("#scriptKeyCount");
const createKeyForm = document.querySelector("#createKeyForm");
const scriptKeyForm = document.querySelector("#scriptKeyForm");
const scriptLoaderPreview = document.querySelector("#scriptLoaderPreview");
const scriptLoaderCode = document.querySelector("#scriptLoaderCode");
const copyScriptLoaderButton = document.querySelector("#copyScriptLoader");
const scriptSourceForm = document.querySelector("#scriptSourceForm");
const scriptSourceEditor = document.querySelector("#scriptSourceEditor");
const scriptSourceMeta = document.querySelector("#scriptSourceMeta");
const reloadScriptSourceButton = document.querySelector("#reloadScriptSource");
const toast = document.querySelector("#toast");
let latestLoaderSnippet = "";

const savedToken = localStorage.getItem("shorakey_admin_token") || localStorage.getItem("xenonkey_admin_token");
if (savedToken) tokenInput.value = savedToken;

function setAdminTab(tabName) {
  const target = tabName || "overview";
  document.querySelectorAll("[data-admin-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.adminTab === target);
  });
  document.querySelectorAll("[data-admin-panel]").forEach((panel) => {
    const active = panel.dataset.adminPanel === target;
    panel.classList.toggle("active", active);
    panel.hidden = !active;
  });
  localStorage.setItem("shorakey_admin_tab", target);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2600);
}

function formatDate(value) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatMoney(value) {
  return `฿${Number(value || 0).toLocaleString("th-TH")}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function adminFetch(url, options = {}) {
  const token = tokenInput.value.trim();
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": token,
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

function renderMetrics(summary) {
  const metrics = [
    ["Total keys", summary.totalKeys],
    ["Active", summary.activeKeys],
    ["Expired", summary.expiredKeys],
    ["Revenue", `฿${Number(summary.revenue || 0).toLocaleString("th-TH")}`],
    ["Topups", summary.totalTopups || 0],
    ["Wallet in", `฿${Number(summary.topupRevenue || 0).toLocaleString("th-TH")}`],
  ];

  metricGrid.innerHTML = metrics
    .map(
      ([label, value]) => `
        <div class="metric-card">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </div>
      `,
    )
    .join("");
}

function renderProductCategoryOptions(categories) {
  if (!productCategory) return;
  productCategory.innerHTML = categories
    .map((category) => `<option value="${escapeHtml(category.slug)}">${escapeHtml(category.name)}</option>`)
    .join("");
}

function productUrl(product) {
  return `${location.origin}/category/${encodeURIComponent(product.categorySlug)}/${encodeURIComponent(product.id)}`;
}

function renderProducts(products, categories = []) {
  if (!productsTable) return;
  const categoryNames = new Map(categories.map((category) => [category.slug, category.name]));
  if (productCount) productCount.textContent = String(products.length);

  if (!products.length) {
    productsTable.innerHTML = '<tr><td colspan="6" class="empty-state">ยังไม่มีสินค้า</td></tr>';
    return;
  }

  productsTable.innerHTML = products
    .map((product) => {
      const statusText = product.deleted ? "Deleted" : product.hidden ? "Hidden" : "Active";
      const statusClass = product.deleted ? "revoked" : product.hidden ? "expired" : "active";
      const sourceText = product.source === "default" ? "Default" : "Custom";
      const actionButtons = product.deleted
        ? `<button class="button button-small button-secondary" type="button" data-restore-product="${escapeHtml(product.id)}">Restore</button>`
        : `
          <button class="button button-small button-secondary" type="button" data-copy="${escapeHtml(productUrl(product))}">Copy link</button>
          <button class="button button-small button-danger" type="button" data-delete-product="${escapeHtml(product.id)}">Delete</button>
        `;

      return `
        <tr>
          <td>
            <strong>${escapeHtml(product.name)}</strong><br />
            <code>${escapeHtml(product.id)}</code>
            <span class="tag ${product.source === "default" ? "revoked" : "active"}">${sourceText}</span>
          </td>
          <td>${escapeHtml(categoryNames.get(product.categorySlug) || product.categorySlug)}</td>
          <td>${escapeHtml(formatMoney(product.price))}</td>
          <td><strong>${Number(product.stock || 0).toLocaleString("th-TH")}</strong></td>
          <td><span class="tag ${statusClass}">${statusText}</span></td>
          <td>
            <div class="table-actions">
              ${actionButtons}
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

async function loadProducts() {
  if (!productsTable) return;
  try {
    const data = await adminFetch("/api/admin/products");
    renderProductCategoryOptions(data.categories || []);
    renderProducts(data.products || [], data.categories || []);
  } catch (error) {
    productsTable.innerHTML = `<tr><td colspan="6" class="empty-state">${escapeHtml(error.message)}</td></tr>`;
  }
}

function renderOrders(orders) {
  if (!ordersTable) return;
  if (orderCount) orderCount.textContent = String(orders.length);

  if (!orders.length) {
    ordersTable.innerHTML = '<tr><td colspan="6" class="empty-state">ยังไม่มีออเดอร์</td></tr>';
    return;
  }

  ordersTable.innerHTML = orders
    .slice(0, 80)
    .map((order) => {
      const customer = order.displayName || order.customerName || order.username || order.contact || "-";
      return `
        <tr>
          <td><code>${escapeHtml(order.id || "-")}</code></td>
          <td>${escapeHtml(order.planName || order.productName || order.productId || "-")}</td>
          <td>${escapeHtml(customer)}</td>
          <td>${escapeHtml(formatMoney(order.amount))}</td>
          <td><code>${escapeHtml(order.licenseKey || "-")}</code></td>
          <td>${escapeHtml(formatDate(order.createdAt))}</td>
        </tr>
      `;
    })
    .join("");
}

async function loadOrders() {
  if (!ordersTable) return;
  try {
    const data = await adminFetch("/api/admin/orders");
    renderOrders(data.orders || []);
  } catch (error) {
    ordersTable.innerHTML = `<tr><td colspan="6" class="empty-state">${escapeHtml(error.message)}</td></tr>`;
  }
}

function renderKeys(keys) {
  if (keyCount) keyCount.textContent = String(keys.length);
  if (!keys.length) {
    keysTable.innerHTML = '<tr><td colspan="6" class="empty-state">No keys yet.</td></tr>';
    return;
  }

  keysTable.innerHTML = keys
    .map((license) => {
      const statusClass = license.status === "active" ? "active" : license.status === "revoked" ? "revoked" : "expired";
      const nextStatus = license.status === "revoked" ? "active" : "revoked";
      const actionClass = nextStatus === "revoked" ? "button-danger" : "button-secondary";
      const actionText = nextStatus === "revoked" ? "Revoke" : "Activate";

      return `
        <tr>
          <td><code>${escapeHtml(license.key)}</code></td>
          <td>${escapeHtml(license.planName)}</td>
          <td><span class="tag ${statusClass}">${escapeHtml(license.status)}</span></td>
          <td>${escapeHtml(license.customerName || "-")}</td>
          <td>${escapeHtml(formatDate(license.expiresAt))}</td>
          <td>
            <div class="table-actions">
              <button class="button button-small button-secondary" type="button" data-copy="${escapeHtml(license.key)}">Copy</button>
              <button class="button button-small ${actionClass}" type="button" data-status="${nextStatus}" data-key="${escapeHtml(license.key)}">${actionText}</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderScriptKeys(keys) {
  if (!scriptKeysTable) return;
  if (scriptKeyCount) scriptKeyCount.textContent = String(keys.length);
  if (!keys.length) {
    scriptKeysTable.innerHTML = '<tr><td colspan="6" class="empty-state">No script keys yet.</td></tr>';
    return;
  }

  scriptKeysTable.innerHTML = keys
    .map((license) => {
      const statusClass = license.status === "active" ? "active" : license.status === "revoked" ? "revoked" : "expired";
      const nextStatus = license.status === "revoked" ? "active" : "revoked";
      const actionClass = nextStatus === "revoked" ? "button-danger" : "button-secondary";
      const actionText = nextStatus === "revoked" ? "Revoke" : "Activate";
      const hwidText = license.hwidBound ? "Bound" : "Empty";
      const hwidClass = license.hwidBound ? "active" : "expired";

      return `
        <tr>
          <td><code>${escapeHtml(license.key)}</code></td>
          <td>${escapeHtml(license.discordId)}</td>
          <td><span class="tag ${statusClass}">${escapeHtml(license.status)}</span></td>
          <td><span class="tag ${hwidClass}">${escapeHtml(hwidText)}</span></td>
          <td>${escapeHtml(formatDate(license.expiresAt))}</td>
          <td>
            <div class="table-actions">
              <button class="button button-small button-secondary" type="button" data-copy="${escapeHtml(license.key)}">Copy</button>
              <button class="button button-small button-secondary" type="button" data-reset-hwid="${escapeHtml(license.key)}">Reset HWID</button>
              <button class="button button-small ${actionClass}" type="button" data-script-status="${nextStatus}" data-script-key="${escapeHtml(license.key)}">${actionText}</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

async function loadScriptKeys() {
  if (!scriptKeysTable) return;
  try {
    const data = await adminFetch("/api/admin/script-keys");
    renderScriptKeys(data.keys);
  } catch (error) {
    scriptKeysTable.innerHTML = `<tr><td colspan="6" class="empty-state">${escapeHtml(error.message)}</td></tr>`;
  }
}

async function loadScriptSource() {
  if (!scriptSourceEditor) return;
  try {
    const data = await adminFetch("/api/admin/script-source");
    scriptSourceEditor.value = data.source || "";
    if (scriptSourceMeta) {
      scriptSourceMeta.textContent = `Serving from ${data.path} (${data.kind}).`;
    }
  } catch (error) {
    if (scriptSourceMeta) scriptSourceMeta.textContent = error.message;
  }
}

async function loadAdmin() {
  const token = tokenInput.value.trim();
  if (!token) {
    adminStatus.textContent = "Enter admin token first.";
    return;
  }

  localStorage.setItem("shorakey_admin_token", token);
  adminStatus.textContent = "Loading dashboard...";

  try {
    const [summaryData, keyData, productData, orderData] = await Promise.all([
      adminFetch("/api/admin/summary"),
      adminFetch("/api/admin/keys"),
      adminFetch("/api/admin/products"),
      adminFetch("/api/admin/orders"),
    ]);
    renderMetrics(summaryData.summary);
    renderKeys(keyData.keys);
    renderProductCategoryOptions(productData.categories || []);
    renderProducts(productData.products || [], productData.categories || []);
    renderOrders(orderData.orders || []);
    adminStatus.textContent = `Loaded ${keyData.keys.length} keys, ${orderData.orders.length} orders, and ${productData.products.length} custom products.`;
    await loadScriptKeys();
    await loadScriptSource();
  } catch (error) {
    adminStatus.textContent = error.message;
    showToast(error.message);
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

saveTokenButton.addEventListener("click", loadAdmin);
refreshButton.addEventListener("click", loadAdmin);

document.querySelectorAll("[data-admin-tab]").forEach((button) => {
  button.addEventListener("click", () => setAdminTab(button.dataset.adminTab));
});

document.querySelectorAll("[data-jump-tab]").forEach((button) => {
  button.addEventListener("click", () => setAdminTab(button.dataset.jumpTab));
});

if (productForm) {
  productForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(productForm).entries());
    const submitButton = productForm.querySelector("button[type='submit']");

    submitButton.disabled = true;
    try {
      const data = await adminFetch("/api/admin/products", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      showToast(`Added ${data.product.name}`);
      productForm.reset();
      const stockInput = productForm.querySelector("[name='stock']");
      if (stockInput) stockInput.value = "35";
      await loadProducts();
    } catch (error) {
      showToast(error.message);
    } finally {
      submitButton.disabled = false;
    }
  });
}

createKeyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(createKeyForm).entries());
  const submitButton = createKeyForm.querySelector("button[type='submit']");

  submitButton.disabled = true;
  try {
    const data = await adminFetch("/api/admin/keys", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    showToast(`Generated ${data.license.key}`);
    createKeyForm.reset();
    await loadAdmin();
  } catch (error) {
    showToast(error.message);
  } finally {
    submitButton.disabled = false;
  }
});

if (productsTable) {
  productsTable.addEventListener("click", async (event) => {
    const button = event.target.closest("button");
    if (!button) return;

    if (button.dataset.copy) {
      copyText(button.dataset.copy);
      return;
    }

    if (button.dataset.restoreProduct) {
      try {
        await adminFetch(`/api/admin/products/${encodeURIComponent(button.dataset.restoreProduct)}`, {
          method: "PATCH",
          body: JSON.stringify({ restore: true }),
        });
        showToast(`Restored ${button.dataset.restoreProduct}`);
        await loadProducts();
      } catch (error) {
        showToast(error.message);
      }
      return;
    }

    if (button.dataset.deleteProduct) {
      if (!confirm(`ลบสินค้า ${button.dataset.deleteProduct} ออกจากหน้าร้าน?`)) return;
      try {
        await adminFetch(`/api/admin/products/${encodeURIComponent(button.dataset.deleteProduct)}`, {
          method: "DELETE",
        });
        showToast(`Deleted ${button.dataset.deleteProduct}`);
        await loadProducts();
      } catch (error) {
        showToast(error.message);
      }
    }
  });
}

if (scriptKeyForm) {
  scriptKeyForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(scriptKeyForm).entries());
    const submitButton = scriptKeyForm.querySelector("button[type='submit']");

    submitButton.disabled = true;
    try {
      const data = await adminFetch("/api/admin/script-keys", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      latestLoaderSnippet = data.loader || "";
      if (scriptLoaderPreview && scriptLoaderCode) {
        scriptLoaderCode.textContent = latestLoaderSnippet;
        scriptLoaderPreview.hidden = false;
      }
      showToast(`Generated ${data.license.key}`);
      await loadScriptKeys();
    } catch (error) {
      showToast(error.message);
    } finally {
      submitButton.disabled = false;
    }
  });
}

if (copyScriptLoaderButton) {
  copyScriptLoaderButton.addEventListener("click", () => copyText(latestLoaderSnippet));
}

if (reloadScriptSourceButton) {
  reloadScriptSourceButton.addEventListener("click", loadScriptSource);
}

if (scriptSourceForm) {
  scriptSourceForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = scriptSourceForm.querySelector("button[type='submit']");
    submitButton.disabled = true;
    try {
      const data = await adminFetch("/api/admin/script-source", {
        method: "PUT",
        body: JSON.stringify({ source: scriptSourceEditor.value }),
      });
      if (scriptSourceMeta) {
        scriptSourceMeta.textContent = `Saved ${Number(data.bytes || 0).toLocaleString("th-TH")} bytes to ${data.path}.`;
      }
      showToast("Saved script source");
    } catch (error) {
      showToast(error.message);
    } finally {
      submitButton.disabled = false;
    }
  });
}

keysTable.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  if (button.dataset.copy) {
    copyText(button.dataset.copy);
    return;
  }

  if (button.dataset.key && button.dataset.status) {
    try {
      await adminFetch(`/api/admin/keys/${encodeURIComponent(button.dataset.key)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: button.dataset.status }),
      });
      showToast(`Updated ${button.dataset.key}`);
      await loadAdmin();
    } catch (error) {
      showToast(error.message);
    }
  }
});

if (scriptKeysTable) {
  scriptKeysTable.addEventListener("click", async (event) => {
    const button = event.target.closest("button");
    if (!button) return;

    if (button.dataset.copy) {
      copyText(button.dataset.copy);
      return;
    }

    if (button.dataset.resetHwid) {
      try {
        await adminFetch(`/api/admin/script-keys/${encodeURIComponent(button.dataset.resetHwid)}`, {
          method: "PATCH",
          body: JSON.stringify({ resetHwid: true }),
        });
        showToast(`Reset HWID ${button.dataset.resetHwid}`);
        await loadScriptKeys();
      } catch (error) {
        showToast(error.message);
      }
      return;
    }

    if (button.dataset.scriptKey && button.dataset.scriptStatus) {
      try {
        await adminFetch(`/api/admin/script-keys/${encodeURIComponent(button.dataset.scriptKey)}`, {
          method: "PATCH",
          body: JSON.stringify({ status: button.dataset.scriptStatus }),
        });
        showToast(`Updated ${button.dataset.scriptKey}`);
        await loadScriptKeys();
      } catch (error) {
        showToast(error.message);
      }
    }
  });
}

setAdminTab(localStorage.getItem("shorakey_admin_tab") || "overview");

if (savedToken) loadAdmin();
