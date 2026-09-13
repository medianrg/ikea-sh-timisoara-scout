IKEA SH Timișoara Scout

Firecrawl monitors the Timișoara catalogue at:
https://www.ikea.com/ro/ro/second-hand/buy-from-ikea/#/timi%C8%99oara

The scraper waits for rendered product cards and requests up to eight additional
pages using “Afișează mai mult”. It rejects missing, empty, wrong-store or partial
catalogues before updating item state. Current prices (including decimals and
group price ranges) are read separately from the old comparison prices. Groups
link to the city catalogue because their cards open in place without a detail URL.

Run `npm install` with Node.js 24, then `npm test` for the offline regression tests.
With `FIRECRAWL_API_KEY` set in the environment, `npm run check:scrape` validates a
live scrape without accessing Supabase or sending email. This consumes Firecrawl
credits. Run it before enabling the updated scraper in production.

To run that same check with the existing GitHub secret, open Actions → IKEA SH TM
→ Run workflow, select the desired branch, and enable `check_scrape_only`.
That mode runs only the extraction check; the normal scout step is skipped.

`node scout.js` runs the existing persistence and notification flow. The first
baseline is silent; later runs email only NEW/RELISTED items. Changing extraction
of titles/prices can cause existing products to receive new hashes on the first
updated run, since the existing deduplication keys include those fields.

Product emails show the original IKEA comparison price crossed out when available,
followed by the current second-hand price. Compact table rows keep images beside
the details, with smaller images on phones and a plain-text alternative.
Original prices do not change hashes or the database schema: instant notifications
use the current scrape, and daily digests attach them by hash when the product is
still present in that scrape. Missing comparison prices are simply omitted.

Run `node scripts/preview-email.js` to generate `.preview/email.html` with public
example products for local visual inspection. For an actual email, manually run
the workflow with `preview_email` enabled and `check_scrape_only` disabled. It
scrapes the live catalogue and sends four examples to the existing `NOTIFY_EMAIL`,
without reading or writing Supabase or changing which items are NEW/RELISTED.
Normal scheduled runs do not send previews.
