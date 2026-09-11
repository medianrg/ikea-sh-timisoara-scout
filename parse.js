import * as cheerio from "cheerio";
import { CITY_URL } from "./config.js";

export function parseItemsFromHtml(html, baseUrl = CITY_URL) {
  const $ = cheerio.load(html);
  const productLists = $('ul[aria-label="Lista de produse"]');
  if (productLists.length > 0) {
    return parseProductCards($, productLists, baseUrl);
  }

  // Keep support for HTML returned by the original Firecrawl integration.
  return parseLegacyItems($);
}

function parseProductCards($, productLists, baseUrl) {
  const items = [];
  productLists.children("li").each((index, element) => {
    const card = $(element);
    const heading = card.find(".typography-heading-xs").first();
    const name = normalizeText(heading.text());
    const description = normalizeText(heading.nextAll(".typography-body-m").first().text());
    const fail = (reason) => {
      throw new Error(`Invalid IKEA product card ${index + 1}${name ? ` (${name})` : ""}: ${reason}`);
    };

    if (!name || /^[\d\s.,]+$/.test(name)) fail("missing product title");

    // Read the visible price parts once; .sr-text repeats the full price.
    // Comparison prices are the original prices, not the second-hand offers.
    const prices = card.find(".price:not(.price--comparison)").filter((_, price) =>
      $(price).parents(".price--comparison").length === 0
    );
    if (prices.length < 1 || prices.length > 2) fail("missing or ambiguous current price");

    const amounts = prices.toArray().map((element) => {
      const price = $(element);
      const integer = normalizeText(price.find(".price__integer").first().text());
      const decimal = normalizeText(price.find(".price__decimal").first().text());
      const currency = normalizeText(price.find(".price__currency").first().text());
      if (!/^(?:\d+|\d{1,3}(?:[. ]\d{3})+)$/.test(integer) ||
          !/^(?:[,.]\d{1,2})?$/.test(decimal) || currency.toLowerCase() !== "lei") {
        fail("unrecognized current price");
      }
      return integer + decimal.replace(".", ",");
    });

    const image = card.find("img").first();
    const imageSrc = image.attr("src") || image.attr("data-src");
    if (!imageSrc) fail("missing product image");

    const href = card.find("a[href]").first().attr("href");
    if (!href && card.find("button").length === 0) fail("missing product link or group button");

    let image_url;
    let item_url;
    try {
      image_url = new URL(imageSrc, baseUrl).href;
      // Groups open in place; their only real navigable URL is the city list.
      item_url = new URL(href || baseUrl, baseUrl).href;
    } catch {
      fail("invalid product URL");
    }

    items.push({
      title: [name, description].filter(Boolean).join(" "),
      price_text: `${amounts.join(" - ")} lei`,
      image_url,
      item_url
    });
  });

  const deduped = dedupeItems(items);
  console.log(`Parser summary: product cards=${items.length}, valid=${deduped.length}`);
  return deduped;
}

function normalizeText(value) {
  return value.replace(/\s+/g, " ").trim();
}

function dedupeItems(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = (item.title + "|" + item.price_text + "|" + (item.image_url || "")).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseLegacyItems($) {
  const results = [];
  let totalParsed = 0;
  let skippedNumericTitle = 0;
  let skippedMissingMedia = 0;

  // Heuristic: caută carduri cu imagine + preț (lei)
  // Dacă trebuie ajustat, aici umbli.
  $("a, div").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (!text) return;

    const hasLei = /lei/i.test(text);
    if (!hasLei) return;

    // încearcă să ia un titlu scurt
    let title = text.split("lei")[0].trim();
    if (title.length < 3 || title.length > 120) return;

    const priceMatch = text.match(/(\d[\d\s.]*)\s*lei/i);
    const price_text = priceMatch ? `${priceMatch[1].replace(/\s+/g, " ").trim()} lei` : "";

    const img = $(el).find("img").first();
    const image_url = img.attr("src") || img.attr("data-src") || null;

    const a = $(el).is("a") ? $(el) : $(el).find("a").first();
    let item_url = a && a.attr ? a.attr("href") : null;
    if (item_url && item_url.startsWith("/")) item_url = "https://www.ikea.com" + item_url;

    if (!price_text) return;

    totalParsed += 1;

    if (/^[0-9.,]+$/.test(title)) {
      skippedNumericTitle += 1;
      return;
    }

    if (!item_url && !image_url) {
      skippedMissingMedia += 1;
      return;
    }

    results.push({ title, price_text, image_url, item_url });
  });

  // dedupe rough
  const seen = new Set();
  const deduped = [];
  for (const r of results) {
    const key = (r.title + "|" + r.price_text + "|" + (r.image_url || "")).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(r);
  }

  console.log(
    `Parser summary: total parsed=${totalParsed}, valid=${deduped.length}, skipped (numeric-title=${skippedNumericTitle}, missing-media=${skippedMissingMedia})`
  );

  return deduped.slice(0, 200); // safety
}
