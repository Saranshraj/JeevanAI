#!/usr/bin/env node
/**
 * apply-light-theme.js
 * Converts the entire site from dark theme to a clean light theme.
 * Rewrites all HTML files in-place — run once.
 *
 * Run: node scripts/apply-light-theme.js
 */

const fs   = require("fs");
const path = require("path");

const SITE_ROOT = path.resolve(__dirname, "..");

// ── Directories to scan (recursive) ──────────────────────────────────────────
const SCAN_DIRS = [
  SITE_ROOT,
  path.join(SITE_ROOT, "blog"),
  path.join(SITE_ROOT, "compare"),
  path.join(SITE_ROOT, "glossary"),
  path.join(SITE_ROOT, "markets"),
  path.join(SITE_ROOT, "use-cases"),
];

// ── Replacements ──────────────────────────────────────────────────────────────
// Each entry: [searchRegex, replacement]
// Order matters — more specific first.

const REPLACEMENTS = [
  // ── CSS variable values (handle both minified and spaced formats) ──
  // --bg
  [/--bg:\s*#0d0d14/g,           "--bg: #f6f6fb"],
  // --bg-card
  [/--bg-card:\s*#13131f/g,      "--bg-card: #ffffff"],
  // --bg-card-hover
  [/--bg-card-hover:\s*#17172a/g,"--bg-card-hover: #ededf6"],
  // --border (rgba white → rgba black)
  [/--border:\s*rgba\(255,255,255,0\.07\)/g, "--border: rgba(0,0,0,0.08)"],
  // --text
  [/--text:\s*#e8e8f0/g,         "--text: #1a1a2e"],
  // --text-dim
  [/--text-dim:\s*#8888aa/g,     "--text-dim: #4a4a6a"],
  // --text-muted
  [/--text-muted:\s*#555577/g,   "--text-muted: #7a7a9a"],
  // --tag-text (bright blue → darker blue, readable on white)
  [/--tag-text:\s*#7aabff/g,     "--tag-text: #2060d0"],
  // --white (renamed to "heading color" — dark in light theme)
  [/--white:\s*#ffffff/g,        "--white: #1a1a2e"],

  // ── Hardcoded dark nav background ──
  [/background:\s*rgba\(13,13,20,0\.92\)/g,
   "background: rgba(246,246,251,0.95)"],

  // ── Factors section dark gradient end-stop ──
  [/rgba\(13,13,25,1\)/g,        "rgba(232,232,244,1)"],

  // ── Progress bar track & scan bar (dark translucent → light translucent) ──
  [/background:\s*rgba\(255,255,255,0\.06\)/g,
   "background: rgba(0,0,0,0.06)"],

  // ── Nav link hover background ──
  [/background:\s*rgba\(255,255,255,0\.05\)/g,
   "background: rgba(0,0,0,0.05)"],

  // ── Green "Live" badge (too faint / low-contrast on white) ──
  [/background:rgba\(79,247,158,0\.12\);color:#4ff79e/g,
   "background:rgba(0,120,60,0.1);color:#006b35"],
  // spaced variant
  [/background:\s*rgba\(79,247,158,0\.12\);\s*color:\s*#4ff79e/g,
   "background: rgba(0,120,60,0.1); color: #006b35"],

  // ── Any remaining literal dark hex colours used for backgrounds ──
  // (Only target as background-color / background: values to avoid text content)
  [/background:\s*#0d0d14/g,     "background: #f6f6fb"],
  [/background:\s*#13131f/g,     "background: #ffffff"],
  [/background:\s*#17172a/g,     "background: #ededf6"],
  [/background-color:\s*#0d0d14/g, "background-color: #f6f6fb"],
  [/background-color:\s*#13131f/g, "background-color: #ffffff"],
];

// ── Collect all HTML files ────────────────────────────────────────────────────
function collectHtml(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith(".html"))
    .map(f => path.join(dir, f));
}

const allFiles = SCAN_DIRS.flatMap(collectHtml);

if (allFiles.length === 0) {
  console.error("No HTML files found.");
  process.exit(1);
}

// ── Apply replacements ────────────────────────────────────────────────────────
let changed = 0;

for (const file of allFiles) {
  let html = fs.readFileSync(file, "utf8");
  let modified = html;

  for (const [pattern, replacement] of REPLACEMENTS) {
    modified = modified.replace(pattern, replacement);
  }

  if (modified !== html) {
    fs.writeFileSync(file, modified, "utf8");
    console.log(`  ✓  ${path.relative(SITE_ROOT, file)}`);
    changed++;
  } else {
    console.log(`  –  ${path.relative(SITE_ROOT, file)}  (no match)`);
  }
}

console.log(`\nDone — ${changed} of ${allFiles.length} files updated.`);
