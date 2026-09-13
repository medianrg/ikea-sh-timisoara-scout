import axios from "axios";
import { buildFirecrawlRequest, validateCatalogue } from "../firecrawl-request.js";
import { parseItemsFromHtml } from "../parse.js";
import { inferCategory } from "../categories.js";
import { sendEmail } from "../email.js";

// Explicit manual preview only: current catalogue examples, no Supabase writes.
try {
  for (const name of ["FIRECRAWL_API_KEY", "RESEND_API_KEY", "NOTIFY_EMAIL"]) {
    if (!process.env[name]) throw new Error(`Missing env: ${name}`);
  }
  const response = await axios.post("https://api.firecrawl.dev/v1/scrape", buildFirecrawlRequest(), {
    headers: { Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}` }, timeout: 90_000
  });
  const html = response.data?.data?.rawHtml;
  if (!html) throw new Error("Firecrawl returned no HTML");
  const cards = validateCatalogue(html);
  const parsed = parseItemsFromHtml(html);
  if (!parsed.length) throw new Error("IKEA parser returned no products");
  console.log(`Preview: ${cards} catalogue cards, ${parsed.filter(item => item.original_price_text).length} with original prices`);
  await sendEmail({
    to: process.env.NOTIFY_EMAIL,
    subject: "[IKEA SH TM] Previzualizare format email",
    items: parsed.slice(0, 4).map(item => ({ ...item, category: inferCategory(item.title) })),
    modeLabel: "Previzualizare · exemple din catalog, fără modificarea notificărilor"
  });
} catch (error) {
  console.error(`Email preview failed: ${error.message}`);
  process.exitCode = 1;
}
