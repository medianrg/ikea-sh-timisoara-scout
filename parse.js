import * as cheerio from "cheerio";

export function parseItemsFromHtml(html) {
  const $ = cheerio.load(html);
  const results = [];

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

  return deduped.slice(0, 200); // safety
}
