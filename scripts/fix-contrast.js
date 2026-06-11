#!/usr/bin/env node
/**
 * fix-contrast.js
 * Fixes two problems:
 *
 * 1. --white was set to #111827 (dark) so gradient-section headings
 *    (.hero h1, .article-hero__title, .cta-final h2) are invisible
 *    on the dark gradient.  Fix: restore --white to #ffffff.
 *
 * 2. All headings that live on WHITE sections (.section-title, .step h3 …)
 *    also used color:var(--white) → they become white-on-white (invisible).
 *    Fix: inject specific dark-colour overrides for those selectors.
 *
 * 3. --text-dim (#6b7280) is too light for comfortable body reading.
 *    Fix: darken to #4b5563.
 *
 * Run: node scripts/fix-contrast.js
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

// ── CSS injected at the end of every page's <style> block ─────────────────────
const FIX_CSS = `
/* ═══════════════════════════════════════════════════════════
   CONTRAST FIX — injected by fix-contrast.js
   ═══════════════════════════════════════════════════════════

   --white is now #ffffff so that gradient-section headings
   (.hero h1, .article-hero__title, .cta-final h2) render white
   on the dark gradient.

   The elements below live on WHITE backgrounds and must be
   explicitly dark — they cannot rely on --white any more.
   ─────────────────────────────────────────────────────────── */

/* Section headings on white background */
.section-title,
.section-label { color: #111827; }

/* How-it-works cards */
.step h3 { color: #111827; }
.step p   { color: #374151; }

/* Factors list */
.factor-item__name { color: #111827; }

/* Scan demo card */
.scan-card__title { color: #111827; }

/* Pricing */
.plan__price  { color: #111827; }
.plan__name   { color: #6b7280; }

/* Blog preview cards on homepage */
.preview-card h3 { color: #111827; }
.preview-card p  { color: #374151; }

/* Testimonial (now on light purple wash — dark text is correct) */
.testimonial-strip__quote  { color: #111827; }
.testimonial-strip__author { color: #6b7280; }

/* Stats */
.stat__num   { color: var(--accent); }   /* accent stays, fine on tinted bg */
.stat__label { color: #4b5563; }

/* Inline CTA blocks (mid-article, white bg) */
.inline-cta__text,
.inline-cta__text strong { color: #111827; }

/* Related posts section */
.related-posts__title { color: #111827; }

/* ── Blog-specific ── */
/* Article prose body */
.article-prose,
.article-section,
.article-intro     { color: #374151; }

.article-section h2 { color: #111827; }
.article-section h3 { color: #1f2937; }
.article-section p,
.article-intro p    { color: #374151; }

/* Sidebar / meta text */
.article-sidebar *,
.article-meta *     { color: #6b7280; }

/* ── Gradient sections: force text white ── */
/* These were failing because --white resolved to #111827.
   Now --white = #ffffff, so var(--white) already gives white.
   These rules are safety nets for any element using --text or --text-dim
   inside a gradient container. */
.hero .hero__sub,
.hero p,
.hero .section-sub  { color: rgba(255,255,255,0.88) !important; }

.cta-final p,
.cta-final .section-sub,
.cta-final small    { color: rgba(255,255,255,0.82) !important; }

.article-hero__meta,
.article-hero__meta *,
.article-hero__breadcrumb,
.article-hero__breadcrumb a,
.article-hero__breadcrumb span { color: rgba(255,255,255,0.72) !important; }
`;

// ── Value replacements ─────────────────────────────────────────────────────────
const REPLACEMENTS = [
  // CORE FIX: restore --white to actual white
  // Matches both "  --white: #111827;" (spaced) and "--white:#111827" (minified)
  [/--white:\s*#111827/g,      "--white: #ffffff"],

  // Darken --text-dim for better readability on white
  [/--text-dim:\s*#6b7280/g,   "--text-dim: #4b5563"],

  // Darken --text itself slightly (was #111827, fine — keep)
  // Update body text where hardcoded
  [/color:\s*#6b7280(?![\da-f])/gi, "color: #4b5563"],
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function collectHtml(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith(".html"))
    .map(f => path.join(dir, f));
}

const MARKER = "CONTRAST FIX";
const allFiles = SCAN_DIRS.flatMap(collectHtml);
let changed = 0;

for (const file of allFiles) {
  let html = fs.readFileSync(file, "utf8");

  if (html.includes(MARKER)) {
    console.log(`  ○  ${path.relative(SITE_ROOT, file)}  (already fixed)`);
    continue;
  }

  let modified = html;
  for (const [pattern, replacement] of REPLACEMENTS) {
    modified = modified.replace(pattern, replacement);
  }

  // Inject contrast-fix CSS before the closing </style>
  modified = modified.replace("</style>", FIX_CSS + "\n</style>");

  if (modified !== html) {
    fs.writeFileSync(file, modified, "utf8");
    console.log(`  ✓  ${path.relative(SITE_ROOT, file)}`);
    changed++;
  } else {
    console.log(`  –  ${path.relative(SITE_ROOT, file)}`);
  }
}

console.log(`\nDone — ${changed}/${allFiles.length} files fixed.`);
