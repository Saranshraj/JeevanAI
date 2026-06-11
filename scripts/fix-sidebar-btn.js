#!/usr/bin/env node
/**
 * fix-sidebar-btn.js
 * The contrast fix added ".article-sidebar * { color:#6b7280 }" to dim all
 * sidebar text. But that universal selector also greys out the text inside
 * the sidebar's gradient ".btn-primary" CTA ("Get Early Access"), making it
 * dark-on-gradient and unreadable.
 *
 * Fix: add a higher-specificity rule forcing white text on sidebar primary
 * buttons (and keep the small outline link readable as indigo, since it sits
 * on the white sidebar card).
 *
 * Idempotent. Run: node scripts/fix-sidebar-btn.js
 */

const fs   = require("fs");
const path = require("path");

const SITE_ROOT = path.resolve(__dirname, "..");
const SCAN_DIRS = [
  SITE_ROOT,
  path.join(SITE_ROOT, "blog"),
  path.join(SITE_ROOT, "compare"),
  path.join(SITE_ROOT, "glossary"),
  path.join(SITE_ROOT, "markets"),
  path.join(SITE_ROOT, "use-cases"),
];

function collectHtml(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith(".html"))
    .map(f => path.join(dir, f));
}

const OVERRIDE =
  "\n/* Sidebar CTA buttons must stay readable, not dimmed by .article-sidebar * */" +
  "\n.article-sidebar .btn-primary { color: #ffffff !important; }" +
  "\n.article-sidebar .btn-outline-sm { color: #4f46e5 !important; }";

const allFiles = SCAN_DIRS.flatMap(collectHtml);
let changed = 0;

for (const file of allFiles) {
  let html = fs.readFileSync(file, "utf8");
  if (html.includes(".article-sidebar .btn-primary")) continue; // already fixed

  // Insert the override right after the sidebar/meta dim rule.
  const out = html.replace(
    /(\.article-sidebar \*,\s*\.article-meta \*\s*\{\s*color:\s*#6b7280;\s*\})/,
    "$1" + OVERRIDE
  );

  if (out !== html) {
    fs.writeFileSync(file, out, "utf8");
    console.log(`  ✓  ${path.relative(SITE_ROOT, file)}`);
    changed++;
  }
}

console.log(`\nDone — ${changed} file(s) updated.`);
