import axios from "axios";
import { buildFirecrawlRequest, validateCatalogue } from "../firecrawl-request.js";
import { parseItemsFromHtml } from "../parse.js";

// A live Firecrawl check without Supabase writes or email delivery.
try {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error("Missing env: FIRECRAWL_API_KEY");
  const response = await axios.post("https://api.firecrawl.dev/v1/scrape", buildFirecrawlRequest(), {
    headers: { Authorization: `Bearer ${apiKey}` }, timeout: 90_000
  });
  const html = response.data?.data?.rawHtml;
  if (!html) throw new Error("Firecrawl returned no HTML");
  const cards = validateCatalogue(html);
  const items = parseItemsFromHtml(html);
  if (!items.length) throw new Error("IKEA parser returned no products");
  console.log(JSON.stringify({ cards, parsed: items.length, sample: items.slice(0, 3) }, null, 2));
} catch (error) {
  // Avoid printing Axios request headers, which contain the API key.
  console.error(`Scrape check failed: ${error.message}`);
  process.exitCode = 1;
}
