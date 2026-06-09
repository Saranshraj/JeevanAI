#!/usr/bin/env node
/**
 * post-to-devto.js
 * Posts medium-drafts .txt files to Dev.to via API.
 * Tracks posted articles in devto-posted.json to avoid duplicates.
 *
 * Usage:
 *   DEVTO_API_KEY=xxx node scripts/post-to-devto.js              # post next 1 unposted
 *   DEVTO_API_KEY=xxx node scripts/post-to-devto.js --count 3    # post next 3 unposted
 *   DEVTO_API_KEY=xxx node scripts/post-to-devto.js --slug why-chatgpt-recommends-competitor
 *   DEVTO_API_KEY=xxx node scripts/post-to-devto.js --all        # post all unposted
 */

const fs    = require("fs");
const path  = require("path");
const https = require("https");

const SITE_ROOT   = path.resolve(__dirname, "..");
const DRAFTS_DIR  = path.join(SITE_ROOT, "medium-drafts");
const POSTED_FILE = path.join(SITE_ROOT, "devto-posted.json");
const API_KEY     = process.env.DEVTO_API_KEY;

if (!API_KEY) {
  console.error("Error: DEVTO_API_KEY environment variable is not set.");
  console.error("Run: DEVTO_API_KEY=your_key node scripts/post-to-devto.js");
  process.exit(1);
}

// ── CLI args ───────────────────────────────────────────────────────────────────
const args    = process.argv.slice(2);
const postAll = args.includes("--all");
const slugArg = args.includes("--slug")  ? args[args.indexOf("--slug")  + 1] : null;
const countArg= args.includes("--count") ? parseInt(args[args.indexOf("--count") + 1], 10) : 1;

// ── Posted tracker ─────────────────────────────────────────────────────────────
function loadPosted() {
  if (fs.existsSync(POSTED_FILE)) {
    return JSON.parse(fs.readFileSync(POSTED_FILE, "utf8"));
  }
  return { posted: [] };
}

function savePosted(data) {
  fs.writeFileSync(POSTED_FILE, JSON.stringify(data, null, 2) + "\n", "utf8");
}

// ── Title case converter ───────────────────────────────────────────────────────
function toTitleCase(str) {
  const skip = new Set(["a","an","the","and","but","or","for","nor","on","at","to","by","in","of","up","as","vs","via","with"]);
  return str.toLowerCase().split(" ").map((w, i, arr) => {
    if (i === 0 || i === arr.length - 1 || !skip.has(w)) {
      return w.charAt(0).toUpperCase() + w.slice(1);
    }
    return w;
  }).join(" ");
}

// ── Parse a .txt draft ─────────────────────────────────────────────────────────
function parseDraft(content, slug) {
  const lines = content.split("\n");

  // Title: first non-empty line
  let title = "";
  for (const line of lines) {
    if (line.trim()) {
      // If still all-caps (legacy format), convert. Otherwise use as-is.
      const t = line.trim();
      title = t === t.toUpperCase() && t.length > 5 ? toTitleCase(t) : t;
      break;
    }
  }

  // Find "- - -" separator indices
  const seps = [];
  lines.forEach((line, i) => {
    if (line.trim() === "- - -") seps.push(i);
  });

  if (seps.length < 2) {
    console.warn(`  Warning: ${slug} is missing "- - -" structure — skipping.`);
    return null;
  }

  // Subtitle: text between title line and first separator (non-empty block)
  const subtitleLines = lines.slice(1, seps[0]).filter(l => l.trim());
  const subtitle = subtitleLines.join(" ").trim();

  // Body: content between first and second separator
  const bodyLines = lines.slice(seps[0] + 1, seps[1]);
  const body = bodyLines.join("\n").trim();

  // Footer: after second separator
  const footer = lines.slice(seps[1] + 1).join("\n");

  // Canonical URL
  const canonicalMatch = footer.match(/Originally published on Jeevan AI:\s*(https?:\/\/[^\s\n]+)/);
  const canonicalUrl = canonicalMatch ? canonicalMatch[1].trim() : null;

  // Tags (Dev.to: lowercase, no spaces, max 4)
  const tagsMatch = footer.match(/Suggested tags:\s*(.+)/);
  let tags = ["ai", "seo", "geo", "marketing"];
  if (tagsMatch) {
    tags = tagsMatch[1]
      .split(",")
      .map(t => t.trim().toLowerCase().replace(/[^a-z0-9]/g, ""))
      .filter(t => t.length > 0 && t.length <= 20)
      .slice(0, 4);
  }

  // Dev.to body: prepend subtitle as italic lead if present
  const fullBody = subtitle
    ? `*${subtitle}*\n\n${body}`
    : body;

  return { title, body: fullBody, canonicalUrl, tags };
}

// ── Dev.to API call ────────────────────────────────────────────────────────────
function postToDevto(article) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      article: {
        title:         article.title,
        body_markdown: article.body,
        published:     true,
        tags:          article.tags,
        canonical_url: article.canonicalUrl
      }
    });

    const options = {
      hostname: "dev.to",
      path:     "/api/articles",
      method:   "POST",
      headers: {
        "Content-Type":   "application/json",
        "api-key":        API_KEY,
        "Content-Length": Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", chunk => { data += chunk; });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode === 201) {
            resolve(parsed);
          } else {
            reject(new Error(`Dev.to API ${res.statusCode}: ${data}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    });

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const tracker     = loadPosted();
  const postedSlugs = new Set(tracker.posted.map(p => p.slug));

  // All available draft slugs
  const allSlugs = fs.readdirSync(DRAFTS_DIR)
    .filter(f => f.endsWith(".txt") && f !== "README.txt")
    .map(f => path.basename(f, ".txt"))
    .sort();

  // Which to post this run
  let toPost = [];
  if (slugArg) {
    if (!allSlugs.includes(slugArg)) {
      console.error(`Slug not found: ${slugArg}`);
      process.exit(1);
    }
    toPost = [slugArg];
  } else {
    const unposted = allSlugs.filter(s => !postedSlugs.has(s));
    if (unposted.length === 0) {
      console.log("All articles already posted to Dev.to.");
      return;
    }
    toPost = postAll ? unposted : unposted.slice(0, countArg);
  }

  console.log(`Posting ${toPost.length} article(s) to Dev.to...`);

  for (let i = 0; i < toPost.length; i++) {
    const slug     = toPost[i];
    const filePath = path.join(DRAFTS_DIR, `${slug}.txt`);
    const content  = fs.readFileSync(filePath, "utf8");
    const parsed   = parseDraft(content, slug);

    if (!parsed) continue;

    console.log(`\n  [${i + 1}/${toPost.length}] "${parsed.title}"`);
    console.log(`  Tags: ${parsed.tags.join(", ")}`);
    console.log(`  Canonical: ${parsed.canonicalUrl}`);

    try {
      const result = await postToDevto(parsed);
      tracker.posted.push({
        slug,
        devto_id:  result.id,
        devto_url: result.url,
        posted_at: new Date().toISOString(),
        title:     parsed.title
      });
      savePosted(tracker);
      console.log(`  Posted: ${result.url}`);
    } catch (err) {
      console.error(`  Failed: ${err.message}`);
    }

    // Rate-limit: wait 3s between posts
    if (i < toPost.length - 1) await sleep(3000);
  }

  console.log(`\nDone. ${tracker.posted.length} total posted to Dev.to.`);
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
