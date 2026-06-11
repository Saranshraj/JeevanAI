#!/usr/bin/env node
/**
 * fix-ctrl.js
 * Two fixes:
 *
 * 1. Strip stray C0 control characters (U+0001 etc., keeping tab/CR/LF).
 *    96 of these crept in after the dashboard "auth/login" href in CTA
 *    links across 24 files — invalid HTML that, among other things, broke
 *    the regex/Edit attempts to class the hero CTA button.
 *
 * 2. Homepage hero "Run Free Scan" CTA → .btn-primary so it inherits the
 *    white-on-gradient hero button style (was an unstyled dark link,
 *    invisible on the purple gradient). Now matchable once the control
 *    char before ">" is removed.
 *
 * Idempotent. Run: node scripts/fix-ctrl.js
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

const CTRL = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g;
const allFiles = SCAN_DIRS.flatMap(collectHtml);
let changed = 0;

for (const file of allFiles) {
  let html = fs.readFileSync(file, "utf8");
  let out  = html.replace(CTRL, "");

  // Homepage hero CTA → btn-primary (only the anchor inside .hero__actions)
  out = out.replace(
    /(class="hero__actions">\s*<a href="https:\/\/dashboard\.jeevanai\.co\.in\/auth\/login")>/,
    '$1 class="btn-primary">'
  );

  if (out !== html) {
    fs.writeFileSync(file, out, "utf8");
    console.log(`  ✓  ${path.relative(SITE_ROOT, file)}`);
    changed++;
  }
}

console.log(`\nDone — ${changed} file(s) cleaned.`);
