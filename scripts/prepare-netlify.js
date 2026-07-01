const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const outDir = path.join(rootDir, "dist");

const publicFiles = [
  "index.html",
  "category.html",
  "products.html",
  "tools.html",
  "topup.html",
  "history.html",
  "terms.html",
  "guide.html",
  "contact.html",
  "admin.html",
  "styles.css",
  "script.js",
  "admin.js",
];

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

for (const file of publicFiles) {
  const source = path.join(rootDir, file);
  if (!fs.existsSync(source)) continue;
  fs.copyFileSync(source, path.join(outDir, file));
}

const assetsDir = path.join(rootDir, "assets");
if (fs.existsSync(assetsDir)) {
  fs.cpSync(assetsDir, path.join(outDir, "assets"), { recursive: true });
}

console.log(`Prepared Netlify static files in ${path.relative(rootDir, outDir)}`);
