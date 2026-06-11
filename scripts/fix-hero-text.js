#!/usr/bin/env node
/**
 * fix-hero-text.js
 * Fixes text that is invisible on the dark/purple gradient heroes.
 *
 * 1. HOMEPAGE hero:
 *    a. The "Run Free Scan" CTA had no button class, so it inherited the
 *       default dark link colour and vanished on the gradient. Give it
 *       .btn-primary so the hero's white-on-gradient button style applies.
 *    b. The <em>ChatGPT.</em> accent in the H1 used var(--accent) (#6366f1),
 *       too dark on the purple gradient. Override to light indigo.
 *
 * 2. BLOG article heroes (all 33 posts):
 *    The gradient injection styled ".article-hero__subtitle", but the real
 *    markup class is ".article-hero__sub". So every blog subtitle rendered
 *    dark (var(--text-dim)) on the gradient and was unreadable. Add the
 *    correct selector to the existing light-colour rule.
 *
 * Idempotent. Run: node scripts/fix-hero-text.js
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

const allFiles = SCAN_DIRS.flatMap(collectHtml);
let changed = 0;

for (const file of allFiles) {
  let html = fs.readFileSync(file, "utf8");
  let out  = html;

  // 1a. Homepage hero CTA → btn-primary (only the anchor inside .hero__actions)
  out = out.replace(
    /(class="hero__actions">\s*<a href="https:\/\/dashboard\.jeevanai\.co\.in\/auth\/login")>/,
    '$1 class="btn-primary">'
  );

  // 1b. Homepage hero <em> accent → light indigo (insert once after the
  //     ".hero h1 { color:#ffffff !important }" override)
  if (!out.includes(".hero h1 em { color: #c7d2fe")) {
    out = out.replace(
      /(\.hero h1\s*\{\s*color:\s*#ffffff\s*!important;\s*\})/,
      '$1\n.hero h1 em { color: #c7d2fe !important; }'
    );
  }

  // 2. Blog subtitle: add the real ".article-hero__sub" selector to the
  //    existing light-colour rule.
  if (!out.includes(".article-hero__sub {") && !out.includes(".article-hero__sub,")) {
    out = out.replace(
      /\.article-hero__subtitle(\s*)\{\s*color:\s*rgba\(255,255,255,0\.84\)\s*!important;\s*\}/,
      '.article-hero__subtitle,\n.article-hero__sub { color: rgba(255,255,255,0.84) !important; }'
    );
  }

  if (out !== html) {
    fs.writeFileSync(file, out, "utf8");
    console.log(`  ✓  ${path.relative(SITE_ROOT, file)}`);
    changed++;
  }
}

console.log(`\nDone — ${changed} file(s) updated.`);
