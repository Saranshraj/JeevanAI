#!/usr/bin/env node
/**
 * fix-dark-files.js
 * Four blog posts were created by the daily scheduler AFTER the light/gradient
 * theme conversion ran. They still carry the ORIGINAL DARK base CSS variables
 * (--bg:#0d0d14 etc.), yet they already received the "GRADIENT THEME INJECTION"
 * and "CONTRAST FIX" CSS blocks layered on top — producing dark backgrounds with
 * invisible / barely-visible text.
 *
 * This script converts ONLY the dark base variables + hardcoded dark colours to
 * the light/gradient palette. It does NOT re-inject any CSS (those blocks are
 * already present). Idempotent: only touches files still containing #0d0d14.
 *
 * Run: node scripts/fix-dark-files.js
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

// ── Dark base → light/gradient palette ────────────────────────────────────────
const REPLACEMENTS = [
  // Core surfaces
  [/--bg:\s*#0d0d14/g,            "--bg: #ffffff"],
  [/--bg-card:\s*#13131f/g,       "--bg-card: #ffffff"],
  [/--bg-card-hover:\s*#17172a/g, "--bg-card-hover: #f9fafb"],

  // Borders (white translucent → light grey)
  [/--border:\s*rgba\(255,255,255,0\.07\)/g, "--border: #e5e7eb"],

  // Text colours
  [/--text:\s*#e8e8f0/g,          "--text: #111827"],
  [/--text-dim:\s*#8888aa/g,      "--text-dim: #4b5563"],
  [/--text-muted:\s*#555577/g,    "--text-muted: #9ca3af"],

  // Accent → indigo (gradient theme)
  [/--accent:\s*#4f8ef7/g,        "--accent: #6366f1"],

  // Tag text → readable indigo on white
  [/--tag-text:\s*#7aabff/g,      "--tag-text: #4f46e5"],

  // KEEP --white: #ffffff (already correct — gradient headings rely on it)

  // Hardcoded dark nav background → light
  [/background:\s*rgba\(13,13,20,0\.92\)/g, "background: rgba(255,255,255,0.95)"],

  // Factors section dark gradient end-stop
  [/rgba\(13,13,25,1\)/g,         "rgba(249,250,251,1)"],

  // Translucent white overlays (only readable on dark) → translucent black
  [/background:\s*rgba\(255,255,255,0\.06\)/g, "background: rgba(0,0,0,0.06)"],
  [/background:\s*rgba\(255,255,255,0\.05\)/g, "background: rgba(0,0,0,0.05)"],

  // Old accent RGB triplet → indigo triplet (used in rgba() shadows/glows)
  [/79,142,247/g,                 "99,102,241"],

  // Any remaining literal dark hex backgrounds
  [/background:\s*#0d0d14/g,       "background: #ffffff"],
  [/background:\s*#13131f/g,       "background: #ffffff"],
  [/background:\s*#17172a/g,       "background: #f9fafb"],
  [/background-color:\s*#0d0d14/g, "background-color: #ffffff"],
  [/background-color:\s*#13131f/g, "background-color: #ffffff"],
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

  // Only convert files that still carry the dark base
  if (!html.includes("#0d0d14")) continue;

  let modified = html;
  for (const [pattern, replacement] of REPLACEMENTS) {
    modified = modified.replace(pattern, replacement);
  }

  if (modified !== html) {
    fs.writeFileSync(file, modified, "utf8");
    console.log(`  ✓  ${path.relative(SITE_ROOT, file)}`);
    changed++;
  }
}

console.log(`\nDone — ${changed} dark file(s) normalized.`);
