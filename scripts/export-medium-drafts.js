#!/usr/bin/env node
/**
 * export-medium-drafts.js
 * Converts all blog HTML files to clean Medium-style text files.
 * Output: medium-drafts/ folder, one .txt file per post.
 *
 * Run: node scripts/export-medium-drafts.js
 */

const fs   = require("fs");
const path = require("path");

const SITE_ROOT = path.resolve(__dirname, "..");
const BLOG_DIR  = path.join(SITE_ROOT, "blog");
const OUT_DIR   = path.join(SITE_ROOT, "medium-drafts");
const SITE_URL  = "https://jeevanai.co.in";

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

// ── Entity + noise cleanup ─────────────────────────────────────────────────────
function decodeEntities(str) {
  return str
    .replace(/&ldquo;/g,  "“")
    .replace(/&rdquo;/g,  "”")
    .replace(/&lsquo;/g,  "‘")
    .replace(/&rsquo;/g,  "’")
    .replace(/&mdash;/g,  ", ")
    .replace(/&ndash;/g,  "-")
    .replace(/&middot;/g, " · ")
    .replace(/&rarr;/g,   "→")
    .replace(/&amp;/g,    "&")
    .replace(/&lt;/g,     "<")
    .replace(/&gt;/g,     ">")
    .replace(/&quot;/g,   '"')
    .replace(/&#39;/g,    "'")
    .replace(/&nbsp;/g,   " ")
    .replace(/&#8212;/g,  ", ")
    .replace(/&#8211;/g,  "-")
    .replace(/&#8220;/g,  "“")
    .replace(/&#8221;/g,  "”")
    .replace(/&#8216;/g,  "‘")
    .replace(/&#8217;/g,  "’");
}

function stripTags(html) {
  return decodeEntities((html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

// ── Extractors ─────────────────────────────────────────────────────────────────
function extractCanonical(html) {
  const m = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)
         || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
  return m ? m[1].trim() : null;
}

function extractTitle(html) {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
          || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  if (og) return decodeEntities(og[1].trim());
  const t = html.match(/<title>([^<]+)<\/title>/i);
  if (t) return decodeEntities(t[1].replace(/\s*\|\s*Jeevan AI\s*$/i, "").trim());
  return "";
}

function extractDescription(html) {
  const m = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
         || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  return m ? decodeEntities(m[1].trim()) : "";
}

function extractDate(html) {
  const mod = html.match(/"dateModified"\s*:\s*"(\d{4}-\d{2}-\d{2})"/);
  if (mod) return mod[1];
  const pub = html.match(/"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})"/);
  if (pub) return pub[1];
  return new Date().toISOString().slice(0, 10);
}

// ── Table → plain text ─────────────────────────────────────────────────────────
function convertTable(tableHtml) {
  const rows = [];
  const rowMatches = tableHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];

  for (const row of rowMatches) {
    const cells = [];
    const cellMatches = row.match(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi) || [];
    for (const cell of cellMatches) {
      cells.push(stripTags(cell).replace(/\s+/g, " ").trim());
    }
    rows.push(cells);
  }

  if (!rows.length) return "";

  // Calculate column widths
  const colCount = Math.max(...rows.map(r => r.length));
  const widths   = Array(colCount).fill(0);
  for (const row of rows) {
    row.forEach((cell, i) => { widths[i] = Math.max(widths[i] || 0, cell.length); });
  }

  const pad = (s, n) => s + " ".repeat(Math.max(0, n - s.length));
  const divider = widths.map(w => "-".repeat(w + 2)).join("+");

  let out = "\n";
  rows.forEach((row, ri) => {
    out += "| " + row.map((c, i) => pad(c, widths[i])).join(" | ") + " |\n";
    if (ri === 0) out += "+" + divider + "+\n";
  });
  return out + "\n";
}

// ── Core HTML → plain text converter ──────────────────────────────────────────
function toMediumText(html) {
  // Extract main article body
  let body = "";
  const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (main) body = main[1];
  if (!body) {
    const article = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    body = article ? article[1] : "";
  }
  if (!body) return "";

  // Remove unwanted sections
  body = body
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    // CTA strips
    .replace(/<div[^>]*class="[^"]*cta[^"]*"[\s\S]*?<\/div>/gi, "")
    .replace(/<section[^>]*class="[^"]*cta[^"]*"[\s\S]*?<\/section>/gi, "")
    // Related posts
    .replace(/<section[^>]*class="[^"]*related[^"]*"[\s\S]*?<\/section>/gi, "")
    .replace(/<div[^>]*class="[^"]*related[^"]*"[\s\S]*?<\/div>/gi, "")
    // Sidebar / aside
    .replace(/<aside[\s\S]*?<\/aside>/gi, "")
    // Header / footer inside main
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    // Breadcrumbs
    .replace(/<nav[^>]*class="[^"]*breadcrumb[^"]*"[\s\S]*?<\/nav>/gi, "")
    // Article meta row (date, read time badges)
    .replace(/<div[^>]*class="[^"]*article-meta[^"]*"[\s\S]*?<\/div>/gi, "")
    .replace(/<div[^>]*class="[^"]*meta[^"]*"[\s\S]*?<\/div>/gi, "")
    // Tag badges
    .replace(/<span[^>]*class="[^"]*badge[^"]*"[\s\S]*?<\/span>/gi, "")
    .replace(/<span[^>]*class="[^"]*tag[^"]*"[\s\S]*?<\/span>/gi, "");

  // Convert tables first (before tag stripping)
  body = body.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_, inner) =>
    convertTable(`<table>${inner}</table>`));

  // Headings → Medium-style (uppercase section markers)
  body = body
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, t) => `\n${stripTags(t).toUpperCase()}\n\n`)
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, t) => `\n\n${stripTags(t)}\n\n`)
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, t) => `\n${stripTags(t)}\n\n`)
    .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, (_, t) => `\n${stripTags(t)}\n`);

  // Bold / italic — keep asterisks for Medium paste
  body = body
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, (_, t) => `**${stripTags(t)}**`)
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, (_, t) => `**${stripTags(t)}**`)
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, (_, t) => `*${stripTags(t)}*`)
    .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, (_, t) => `*${stripTags(t)}*`);

  // Links → plain text (keep label, drop URL to avoid clutter in Medium paste)
  body = body.replace(/<a[^>]+href=["'][^"']*["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_, text) => stripTags(text));

  // Lists
  body = body
    .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, items) =>
      "\n" + items.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi,
        (__, t) => `• ${stripTags(t)}\n`) + "\n")
    .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, items) => {
      let n = 0;
      return "\n" + items.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi,
        (__, t) => `${++n}. ${stripTags(t)}\n`) + "\n";
    });

  // Blockquotes
  body = body.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi,
    (_, t) => "\n" + stripTags(t).split("\n").map(l => `"${l.trim()}"`).join("\n") + "\n\n");

  // Paragraphs
  body = body.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, t) => {
    const clean = stripTags(t).trim();
    return clean ? `${clean}\n\n` : "";
  });

  // Line breaks & divs
  body = body
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<div[^>]*>/gi, "");

  // Strip remaining tags
  body = body.replace(/<[^>]+>/g, "");

  // Decode entities
  body = decodeEntities(body);

  // Clean up whitespace
  body = body
    .replace(/[ \t]+/g, " ")          // multiple spaces → one
    .replace(/ \n/g,    "\n")          // trailing spaces on lines
    .replace(/\n /g,    "\n")          // leading spaces on lines
    .replace(/\n{3,}/g, "\n\n")        // max 2 blank lines
    .trim();

  return body;
}

// ── Process all blog posts ─────────────────────────────────────────────────────
const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith(".html"));
const index = [];

for (const file of files) {
  const html      = fs.readFileSync(path.join(BLOG_DIR, file), "utf8");
  const canonical = extractCanonical(html);
  const title     = extractTitle(html);
  const desc      = extractDescription(html);
  const date      = extractDate(html);

  if (!canonical || !title) continue;

  const body = toMediumText(html);
  const slug = path.basename(file, ".html");

  const draft =
`${title.toUpperCase()}

${desc}

- - -

${body}

- - -

Originally published on Jeevan AI: ${canonical}

When posting to Medium:
→ Paste everything above the dashed line
→ Set canonical URL to: ${canonical}
→ Suggested tags: AI, SaaS, GEO, SEO, Marketing
`;

  fs.writeFileSync(path.join(OUT_DIR, `${slug}.txt`), draft, "utf8");
  index.push({ slug, title, date });
  console.log(`  ✓  ${slug}.txt`);
}

// Remove old .md files if any
for (const f of fs.readdirSync(OUT_DIR)) {
  if (f.endsWith(".md") && f !== "README.md") {
    fs.unlinkSync(path.join(OUT_DIR, f));
  }
}

// Sort newest first for README
index.sort((a, b) => b.date.localeCompare(a.date));

const readme =
`# Medium Drafts — Jeevan AI Blog
${index.length} posts, ready to copy-paste into Medium.

Each .txt file contains:
• The full article in clean text
• Formatting Medium understands (bold, tables, lists)
• Canonical URL and posting instructions at the bottom

## Posting steps (takes 2-3 min per post)
1. Open the .txt file on GitHub (click Raw to see plain text)
2. Select all → Copy
3. Open medium.com/new-story → Paste
4. Click ··· (top right) → Story settings → Canonical link → paste the original URL
5. Add tags: AI, SaaS, GEO, SEO, Marketing
6. Publish

## Posts (newest first)
${index.map((p, i) => `${i + 1}. [${p.title}](${p.slug}.txt) — ${p.date}`).join("\n")}
`;

fs.writeFileSync(path.join(OUT_DIR, "README.md"), readme, "utf8");
console.log(`\nDone — ${index.length} drafts in medium-drafts/`);
