#!/usr/bin/env node
// Fetches herb product pages from sources.json and compares against chioma_products.json.
// Add new URLs to sources.json to expand coverage.

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const sources = JSON.parse(readFileSync(join(__dirname, "sources.json"), "utf8"));
const existing = JSON.parse(readFileSync(join(__dirname, "../chioma_products.json"), "utf8"));

const existingNames = new Set(existing.map((h) => normalize(h.name)));

function normalize(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Converts a collection page URL to Shopify's products.json API URL with pagination.
function toApiUrl(pageUrl) {
  const u = new URL(pageUrl);
  const page = u.searchParams.get("page") ?? "1";
  return `${u.origin}${u.pathname}/products.json?limit=250&page=${page}`;
}

async function fetchHerbNames(url) {
  const apiUrl = toApiUrl(url);
  const res = await fetch(apiUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; HerbCrawler/1.0)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${apiUrl}`);
  const json = await res.json();
  return (json.products ?? []).map((p) => p.title.trim());
}

async function main() {
  const allSiteHerbs = new Set();

  for (const source of sources.sources) {
    console.log(`\nSource: ${source.name}`);
    for (const url of source.urls) {
      process.stdout.write(`  Fetching ${url} ... `);
      try {
        const names = await fetchHerbNames(url);
        names.forEach((n) => allSiteHerbs.add(n));
        console.log(`${names.length} products found`);
      } catch (err) {
        console.log(`FAILED — ${err.message}`);
      }
    }
  }

  const missing = [...allSiteHerbs]
    .filter((name) => !existingNames.has(normalize(name)))
    .sort();

  const matched = [...allSiteHerbs]
    .filter((name) => existingNames.has(normalize(name)))
    .sort();

  console.log("\n─────────────────────────────────────────");
  console.log(`Site total:   ${allSiteHerbs.size}`);
  console.log(`In DB:        ${matched.length}`);
  console.log(`Missing:      ${missing.length}`);
  console.log("─────────────────────────────────────────");

  console.log("\n✓ IN DATABASE:");
  matched.forEach((n) => console.log(`  ${n}`));

  console.log("\n✗ MISSING FROM DATABASE:");
  missing.forEach((n) => console.log(`  ${n}`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
