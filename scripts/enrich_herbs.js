#!/usr/bin/env node
// Enriches chioma_products.json with metadata pulled from sources.json:
//   - Shopify tags (from /products.json)
//   - Scientific Name, Plant Part, Origin, Form (from product HTML)
//   - Energetics (from product HTML; falls back to flavor/temperature tokens in Shopify tags)
//
// Curated fields (name, description, how_to_use, category) are never overwritten.
// Source-derived fields ARE refreshed on every run so upstream edits propagate.
// Safe to re-run.

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { load } from "cheerio";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCES = JSON.parse(readFileSync(join(__dirname, "sources.json"), "utf8"));
const HERBS_PATH = join(__dirname, "../chioma_products.json");
const herbs = JSON.parse(readFileSync(HERBS_PATH, "utf8"));

const UA = "Mozilla/5.0 (compatible; HerbCrawler/1.0)";
const HTML_DELAY_MS = 250;

// Flavor/temperature/quality tokens that should live in `energetics`, not `tags`.
const ENERGETIC_TOKENS = new Set([
  "cool", "warm", "cold", "hot", "neutral",
  "moist", "dry",
  "bitter", "sweet", "sour", "salty", "pungent",
  "astringent", "aromatic", "earthy",
]);

// Collection/campaign labels with no semantic value — drop on ingest.
const TAG_NOISE = new Set(["bulk herbs", "correct", "nourish", "thrive", "detox"]);

function normalize(name) {
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

function toApiUrl(pageUrl) {
  const u = new URL(pageUrl);
  return `${u.origin}${u.pathname}/products.json?limit=250&page=1`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function canonicalizeTag(raw) {
  const t = raw.trim();
  if (!t) return null;
  if (TAG_NOISE.has(t.toLowerCase())) return null;
  // Title-case so "NOURISH"/"Nourish" dedupe to one display form.
  return t
    .split(/\s+/)
    .map((w) => (w.length <= 2 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
}

function partitionTags(rawTags) {
  const tagSet = new Set();
  const energeticSet = new Set();
  for (const r of rawTags) {
    const canonical = canonicalizeTag(r);
    if (!canonical) continue;
    if (ENERGETIC_TOKENS.has(canonical.toLowerCase())) {
      energeticSet.add(canonical.toLowerCase());
    } else {
      tagSet.add(canonical);
    }
  }
  return { tags: [...tagSet].sort(), energeticsFromTags: [...energeticSet].sort() };
}

function extractHtmlMetadata(html) {
  const $ = load(html);
  const out = {};

  // <li><strong>{Label}</strong>: {Value}   OR   <li><strong>{Label}:</strong> {Value}
  $("li").each((_, el) => {
    const $el = $(el);
    const $strong = $el.find("strong").first();
    if (!$strong.length) return;
    const label = $strong.text().trim().replace(/:$/, "");
    const value = $el.text().slice($strong.text().length).replace(/^[\s:]+/, "").trim();
    if (!value) return;
    switch (label) {
      case "Origin":          out.origin = value; break;
      case "Scientific Name": out.botanical_name = value; break;
      case "Plant Part":      out.plant_part = value; break;
      case "Form":            out.form = value; break;
    }
  });

  // <p>...<strong>Energetics</strong>: {Value}   OR   <strong>Energetics:</strong>
  $("p").each((_, el) => {
    const $el = $(el);
    const $strong = $el.find("strong").first();
    if (!$strong.length) return;
    const strongText = $strong.text().trim().replace(/:$/, "");
    if (strongText !== "Energetics") return;
    const value = $el.text().replace(/^.*Energetics\s*:?\s*/i, "").trim();
    if (!value) return;
    out.energeticsFromHtml = [...new Set(value
      .split(/,| and /i)
      .map((s) => s.trim().toLowerCase().replace(/[.,;:]+$/, ""))
      .filter(Boolean))]
      .sort();
  });

  return out;
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function fetchHtml(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (res.status >= 500) throw new Error(`HTTP ${res.status} for ${url}`);
  if (!res.ok) return null;
  return res.text();
}

function setField(herb, key, value) {
  if (value === undefined || value === null) return;
  if (Array.isArray(value) && value.length === 0) return;
  if (typeof value === "string" && value === "") return;
  herb[key] = value;
}

async function main() {
  // Step 1: Build source map from all sources.
  const sourceMap = new Map();
  for (const source of SOURCES.sources) {
    for (const url of source.urls) {
      const apiUrl = toApiUrl(url);
      console.log(`Fetching ${apiUrl}`);
      const json = await fetchJson(apiUrl);
      const origin = new URL(url).origin;
      for (const p of json.products ?? []) {
        const rawTags = Array.isArray(p.tags)
          ? p.tags
          : typeof p.tags === "string"
          ? p.tags.split(",").map((t) => t.trim()).filter(Boolean)
          : [];
        sourceMap.set(normalize(p.title), { tags: rawTags, handle: p.handle, origin });
      }
    }
  }
  console.log(`Source map: ${sourceMap.size} products\n`);

  // Step 2: Enrich each local herb.
  const cov = { tags: 0, energetics: 0, botanical_name: 0, plant_part: 0, origin: 0, form: 0 };
  const total = herbs.length;
  let enriched = 0;
  let missing = 0;
  const unmatched = [];

  for (const herb of herbs) {
    const src = sourceMap.get(normalize(herb.name));
    if (!src) {
      missing++;
      unmatched.push(herb.name);
      continue;
    }

    const { tags: cleanedTags, energeticsFromTags } = partitionTags(src.tags);

    let html = null;
    try {
      html = await fetchHtml(`${src.origin}/products/${src.handle}`);
    } catch (err) {
      console.log(`  [warn] ${herb.name} HTML fetch — ${err.message}`);
    }
    await sleep(HTML_DELAY_MS);

    const meta = html ? extractHtmlMetadata(html) : {};
    const energetics = meta.energeticsFromHtml?.length
      ? meta.energeticsFromHtml
      : energeticsFromTags;

    // Refresh source-derived fields (curated fields are not in this list).
    setField(herb, "tags", cleanedTags);
    setField(herb, "energetics", energetics);
    setField(herb, "botanical_name", meta.botanical_name);
    setField(herb, "plant_part", meta.plant_part);
    setField(herb, "origin", meta.origin);
    setField(herb, "form", meta.form);

    if (herb.tags?.length) cov.tags++;
    if (herb.energetics?.length) cov.energetics++;
    if (herb.botanical_name) cov.botanical_name++;
    if (herb.plant_part) cov.plant_part++;
    if (herb.origin) cov.origin++;
    if (herb.form) cov.form++;

    enriched++;
    process.stdout.write(`  [${enriched}/${total}] ${herb.name}                                \r`);
  }

  // Step 3: Write back.
  console.log(`\n\nWriting ${HERBS_PATH} ...`);
  writeFileSync(HERBS_PATH, JSON.stringify(herbs, null, 2) + "\n", "utf8");

  // Step 4: Report.
  console.log(`\nEnriched: ${enriched}    Missing from source: ${missing}`);
  if (unmatched.length) {
    console.log("Unmatched (not in any source — left untouched):");
    unmatched.forEach((n) => console.log(`  - ${n}`));
  }
  console.log(`\nCoverage out of ${total}:`);
  for (const [k, v] of Object.entries(cov)) {
    const pct = ((v / total) * 100).toFixed(1);
    console.log(`  ${k.padEnd(16)} ${v.toString().padStart(3)}/${total} (${pct}%)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
