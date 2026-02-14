import axios from "axios";
import { createClient } from "@supabase/supabase-js";
import { DateTime } from "luxon";
import { inferCategory } from "./categories.js";
import { parseItemsFromHtml } from "./parse.js";
import { sendEmail } from "./email.js";
import crypto from "crypto";

const MODE = (process.argv[2] || "instant").toLowerCase(); // "instant" or "daily"
const NOTIFY_MODE = (process.env.NOTIFY_MODE || "instant").toLowerCase();

const CITY_URL = "https://www.ikea.com/ro/ro/circular/second-hand/#/timi%C8%99oara";
const RELIST_AFTER_HOURS = 24;

function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const supabase = createClient(
  mustEnv("SUPABASE_URL"),
  mustEnv("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false } }
);

async function main() {
  // hard stop if workflow doesn't match chosen mode
  if (MODE !== NOTIFY_MODE) {
    console.log(`Skipping: MODE=${MODE} but NOTIFY_MODE=${NOTIFY_MODE}`);
    return;
  }

  // Daily mode: send ONLY at 09:00 Europe/Bucharest
  if (MODE === "daily") {
    const nowRO = DateTime.now().setZone("Europe/Bucharest");
    if (nowRO.hour !== 9) {
      console.log(`Daily: not 09:00 RO (now ${nowRO.toFormat("HH:mm")}), skipping`);
      return;
    }
    // calendar day key (RO)
    const todayRO = nowRO.toISODate(); // YYYY-MM-DD
    const already = await supabase.from("digests").select("digest_date_ro").eq("digest_date_ro", todayRO).maybeSingle();
    if (already.data) {
      console.log(`Daily: digest already sent for ${todayRO}, skipping`);
      return;
    }
  }

  // Baseline: first run never emails (for both modes)
  const baselineDone = await getSetting("baseline_done");
  if (baselineDone !== "true") {
    console.log("Baseline not done. Running scrape + storing state silently...");
    const items = await scrapeItems();
    await upsertSeenItems(items, { silent: true });
    await setSetting("baseline_done", "true");
    await logRun("baseline", items.length);
    return;
  }

  const items = await scrapeItems();
  const { newOnes, relisted } = await upsertSeenItems(items, { silent: false });

  await logRun("ok", items.length);

  if (MODE === "instant") {
    const toSend = [...newOnes.map(i => ({...i, kind:"NEW"})), ...relisted.map(i => ({...i, kind:"RELISTED"}))];
    if (toSend.length === 0) {
      console.log("Instant: no NEW/RELISTED");
      return;
    }
    await sendInstantEmail(toSend);
    return;
  }

  if (MODE === "daily") {
    // calendar day “azi” RO: select items first_seen_at in todayRO or relisted in todayRO
    const nowRO = DateTime.now().setZone("Europe/Bucharest");
    const startRO = nowRO.startOf("day");
    const endRO = nowRO.endOf("day");
    const startUTC = startRO.toUTC().toISO();
    const endUTC = endRO.toUTC().toISO();

    const q = await supabase
      .from("items")
      .select("hash,title,price_text,category,image_url,first_seen_at,last_seen_at,disappeared_at")
      .gte("first_seen_at", startUTC)
      .lte("first_seen_at", endUTC);

    const todaysNew = q.data || [];

    // “relisted azi” = items care au disappeared_at < startUTC și last_seen_at in today range
    const r = await supabase
      .from("items")
      .select("hash,title,price_text,category,image_url,first_seen_at,last_seen_at,disappeared_at")
      .lt("disappeared_at", startUTC)
      .gte("last_seen_at", startUTC)
      .lte("last_seen_at", endUTC);

    const todaysRelisted = r.data || [];

    const merged = dedupeByHash([...todaysNew, ...todaysRelisted]);
    if (merged.length === 0) {
      console.log("Daily: nothing for today (calendar day RO). Marking digest as sent with 0 items.");
      await markDigestSent(nowRO.toISODate(), 0);
      return;
    }

    await sendDailyEmail(nowRO.toISODate(), merged);
    await markDigestSent(nowRO.toISODate(), merged.length);
  }
}

async function scrapeItems() {
  const apiKey = mustEnv("FIRECRAWL_API_KEY");

  // Firecrawl scrape
  const resp = await axios.post(
    "https://api.firecrawl.dev/v1/scrape",
    { url: CITY_URL, formats: ["html"] },
    { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 60_000 }
  );

  const html = resp?.data?.data?.html;
  if (!html) throw new Error("Firecrawl returned no HTML");

  const rawItems = parseItemsFromHtml(html).map(it => ({
    ...it,
    category: inferCategory(it.title),
    hash: makeHash(it.title, it.price_text, it.image_url)
  }));

  console.log(`Parsed items: ${rawItems.length}`);
  return rawItems;
}

function makeHash(title, price, image) {
  const s = `${title || ""}|${price || ""}|${image || ""}`.toLowerCase().trim();
  return crypto.createHash("sha1").update(s).digest("hex");
}

async function upsertSeenItems(items, { silent }) {
  const now = new Date().toISOString();
  const newOnes = [];
  const relisted = [];

  // Mark disappeared: items previously seen but not in current scrape => disappeared_at = now (if not already)
  // To keep it simple and cheap: we only mark disappeared for items seen in last 7 days.
  const since = DateTime.now().minus({ days: 7 }).toUTC().toISO();

  const prev = await supabase.from("items").select("hash,last_seen_at,disappeared_at").gte("last_seen_at", since);
  const prevMap = new Map((prev.data || []).map(x => [x.hash, x]));

  const currentHashes = new Set(items.map(i => i.hash));
  for (const [hash, p] of prevMap.entries()) {
    if (!currentHashes.has(hash) && !p.disappeared_at) {
      await supabase.from("items").update({ disappeared_at: now }).eq("hash", hash);
    }
  }

  for (const it of items) {
    const existing = await supabase.from("items").select("*").eq("hash", it.hash).maybeSingle();

    if (!existing.data) {
      // NEW
      await supabase.from("items").insert({
        hash: it.hash,
        title: it.title,
        price_text: it.price_text,
        category: it.category,
        image_url: it.image_url,
        first_seen_at: now,
        last_seen_at: now,
        disappeared_at: null
      });
      if (!silent) newOnes.push(it);
      continue;
    }

    // Seen before
    const row = existing.data;
    let isRelisted = false;

    if (row.disappeared_at) {
      const disappearedAt = DateTime.fromISO(row.disappeared_at);
      const hoursGone = DateTime.fromISO(now).diff(disappearedAt, "hours").hours;
      if (hoursGone >= RELIST_AFTER_HOURS) isRelisted = true;
    }

    await supabase.from("items").update({
      title: it.title,
      price_text: it.price_text,   // we store it, but price change alone doesn't trigger emails
      category: it.category,
      image_url: it.image_url,
      last_seen_at: now,
      disappeared_at: null
    }).eq("hash", it.hash);

    if (!silent && isRelisted) relisted.push(it);
  }

  return { newOnes, relisted };
}

async function sendInstantEmail(items) {
  // batch: one email per run
  const subject = `[IKEA SH TM] ${items.length} produse noi/relistate`;
  await sendEmail({
    to: mustEnv("NOTIFY_EMAIL"),
    subject,
    items,
    modeLabel: "Instant (30 min)"
  });
}

async function sendDailyEmail(dateRO, items) {
  const subject = `[IKEA SH TM] Lista azi (${dateRO}) – ${items.length} produse`;
  await sendEmail({
    to: mustEnv("NOTIFY_EMAIL"),
    subject,
    items,
    modeLabel: `Daily 09:00 (RO) • ${dateRO}`
  });
}

async function logRun(status, parsedCount) {
  await supabase.from("runs").insert({ status, parsed_count: parsedCount });
}

async function getSetting(key) {
  const r = await supabase.from("settings").select("value").eq("key", key).maybeSingle();
  return r.data?.value ?? null;
}
async function setSetting(key, value) {
  await supabase.from("settings").upsert({ key, value });
}

function dedupeByHash(arr) {
  const m = new Map();
  for (const x of arr) m.set(x.hash, x);
  return [...m.values()];
}

async function markDigestSent(dateRO, count) {
  await supabase.from("digests").upsert({ digest_date_ro: dateRO, item_count: count, sent_at: new Date().toISOString() });
}

main().catch(async (e) => {
  console.error(e);
  try { await logRun("error", 0); } catch {}
  process.exit(1);
});
