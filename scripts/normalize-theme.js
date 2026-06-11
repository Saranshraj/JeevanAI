#!/usr/bin/env node
/**
 * normalize-theme.js
 * ONE idempotent pass that repairs every theme regression we have hit, so a
 * newly created page (however it was generated) renders correctly once pushed.
 *
 * It consolidates the individual fix-*.js scripts:
 *   - strip stray C0 control characters (U+0001 etc.)
 *   - convert any leftover DARK base variables/colours to the light palette
 *   - make the homepage hero "Run Free Scan" CTA a .btn-primary
 *   - lighten the homepage hero <em> accent
 *   - add the correct .article-hero__sub selector to the white-text rule
 *   - keep sidebar CTA buttons readable (not dimmed by .article-sidebar *)
 *
 * It only rewrites a file when something actually changed, so it is safe to
 * run on every push. It also warns (non-fatally) if a page is missing the
 * gradient/contrast theme blocks entirely.
 *
 * Run on everything:        node scripts/normalize-theme.js
 * Run on specific files:    node scripts/normalize-theme.js blog/foo.html ...
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

// ── Dark base palette → light/gradient palette ──────────────────────────────
const DARK_TO_LIGHT = [
  [/--bg:\s*#0d0d14/g,            "--bg: #ffffff"],
  [/--bg-card:\s*#13131f/g,       "--bg-card: #ffffff"],
  [/--bg-card-hover:\s*#17172a/g, "--bg-card-hover: #f9fafb"],
  [/--border:\s*rgba\(255,255,255,0\.07\)/g, "--border: #e5e7eb"],
  [/--text:\s*#e8e8f0/g,          "--text: #111827"],
  [/--text-dim:\s*#8888aa/g,      "--text-dim: #4b5563"],
  [/--text-muted:\s*#555577/g,    "--text-muted: #9ca3af"],
  [/--accent:\s*#4f8ef7/g,        "--accent: #6366f1"],
  [/--tag-text:\s*#7aabff/g,      "--tag-text: #4f46e5"],
  [/background:\s*rgba\(13,13,20,0\.92\)/g, "background: rgba(255,255,255,0.95)"],
  [/rgba\(13,13,25,1\)/g,         "rgba(249,250,251,1)"],
  [/79,142,247/g,                 "99,102,241"],
  [/background:\s*#0d0d14/g,       "background: #ffffff"],
  [/background:\s*#13131f/g,       "background: #ffffff"],
  [/background:\s*#17172a/g,       "background: #f9fafb"],
  [/background-color:\s*#0d0d14/g, "background-color: #ffffff"],
  [/background-color:\s*#13131f/g, "background-color: #ffffff"],
];

const CTRL = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g;

function normalize(html, relPath) {
  let out = html;

  // 1. Strip stray control characters
  out = out.replace(CTRL, "");

  // 2. Dark base → light (only matters for files still on the old dark base)
  if (out.includes("#0d0d14")) {
    for (const [re, rep] of DARK_TO_LIGHT) out = out.replace(re, rep);
  }

  // 3. Homepage hero CTA → .btn-primary
  out = out.replace(
    /(class="hero__actions">\s*<a href="https:\/\/dashboard\.jeevanai\.co\.in\/auth\/login")>/,
    '$1 class="btn-primary">'
  );

  // 4. Homepage hero <em> accent → light indigo
  if (!out.includes(".hero h1 em { color: #c7d2fe")) {
    out = out.replace(
      /(\.hero h1\s*\{\s*color:\s*#ffffff\s*!important;\s*\})/,
      '$1\n.hero h1 em { color: #c7d2fe !important; }'
    );
  }

  // 5. Blog hero subtitle: add the real .article-hero__sub selector
  if (!out.includes(".article-hero__sub {") && !out.includes(".article-hero__sub,")) {
    out = out.replace(
      /\.article-hero__subtitle(\s*)\{\s*color:\s*rgba\(255,255,255,0\.84\)\s*!important;\s*\}/,
      '.article-hero__subtitle,\n.article-hero__sub { color: rgba(255,255,255,0.84) !important; }'
    );
  }

  // 6. Sidebar CTA buttons stay readable
  if (!out.includes(".article-sidebar .btn-primary")) {
    out = out.replace(
      /(\.article-sidebar \*,\s*\.article-meta \*\s*\{\s*color:\s*#6b7280;\s*\})/,
      "$1\n.article-sidebar .btn-primary { color: #ffffff !important; }" +
      "\n.article-sidebar .btn-outline-sm { color: #4f46e5 !important; }"
    );
  }

  return out;
}

function collectHtml(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith(".html") && !f.startsWith("_")) // skip _template.html
    .map(f => path.join(dir, f));
}

// Accept explicit file args, else scan all dirs
const argFiles = process.argv.slice(2).map(f => path.resolve(SITE_ROOT, f));
const allFiles = argFiles.length ? argFiles : SCAN_DIRS.flatMap(collectHtml);

let changed = 0;
for (const file of allFiles) {
  if (!fs.existsSync(file)) { console.warn(`  !  missing: ${file}`); continue; }
  const html = fs.readFileSync(file, "utf8");
  const rel  = path.relative(SITE_ROOT, file);
  const out  = normalize(html, rel);

  // Warn if a blog page is missing the theme blocks entirely
  if (rel.startsWith("blog" + path.sep) && !out.includes("GRADIENT THEME INJECTION")) {
    console.warn(`  ⚠  ${rel} is missing the GRADIENT THEME INJECTION block — base it on blog/_template.html`);
  }

  if (out !== html) {
    fs.writeFileSync(file, out, "utf8");
    console.log(`  ✓  ${rel}`);
    changed++;
  }
}

console.log(`\nnormalize-theme: ${changed} file(s) changed of ${allFiles.length} scanned.`);
