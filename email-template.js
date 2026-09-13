import { CITY_URL } from "./config.js";

const categories = new Map([
  ["Seating", "Canapele și scaune"], ["Tables", "Mese"],
  ["Storage", "Depozitare"], ["Beds", "Paturi"], ["Office", "Birou"],
  ["Lighting", "Iluminat"], ["Other", "Altele"], ["Altele", "Altele"]
]);

export function renderProductEmail({ items, modeLabel = "Produse noi și relistate" }) {
  const groups = new Map();
  for (const item of items) {
    const category = String(item.category || "Other").trim() || "Other";
    const label = categories.get(category) || category;
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(item);
  }
  const order = [...new Set(categories.values())];
  const labels = [...groups.keys()].sort((a, b) => {
    const rank = value => order.includes(value) ? order.indexOf(value) : order.length;
    return rank(a) - rank(b) || a.localeCompare(b, "ro");
  });
  const sections = labels.map(label => `<tr><td style="padding:22px 0 8px;font-size:17px;font-weight:bold;border-bottom:2px solid #e5e7eb">${escapeHtml(label)} <span style="font-size:13px;font-weight:normal;color:#666">(${groups.get(label).length})</span></td></tr><tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;border-collapse:collapse">${groups.get(label).map(renderProduct).join("")}</table></td></tr>`).join("");
  const html = `<!doctype html><html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>IKEA Scout · Timișoara</title><style>@media screen and (max-width:480px){.email-padding{padding:18px 12px!important}.product-image{width:84px!important}.product-photo{width:72px!important}}</style></head><body style="margin:0;padding:0;background:#f3f4f6"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr><td align="center"><!--[if mso]><table role="presentation" width="600"><tr><td><![endif]--><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-collapse:collapse"><tr><td class="email-padding" style="padding:26px 24px;font-family:Arial,Helvetica,sans-serif;color:#1f2937;line-height:1.4"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr><td style="font-size:12px;font-weight:bold;letter-spacing:1px;color:#0058a3">IKEA SCOUT · TIMIȘOARA</td></tr><tr><td style="padding-top:8px;font-size:25px;font-weight:bold">${items.length} ${items.length === 1 ? "produs de descoperit" : "produse de descoperit"}</td></tr><tr><td style="padding-top:6px;font-size:13px;color:#666">${escapeHtml(modeLabel)}</td></tr>${sections}<tr><td style="padding-top:24px;font-size:12px;line-height:1.6;color:#666">Prețurile și disponibilitatea se pot schimba.<br><a href="${escapeHtml(CITY_URL)}" style="color:#0058a3">Vezi toate produsele din Timișoara</a></td></tr></table></td></tr></table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>`;
  const text = [`IKEA Scout · Timișoara`, modeLabel, "", ...labels.flatMap(label => [
    `${label} (${groups.get(label).length})`, ...groups.get(label).map(item => [
      item.title, item.original_price_text ? `Preț original: ${item.original_price_text}` : null,
      `Preț actual: ${item.price_text}`, safeUrl(item.item_url) || CITY_URL, ""
    ].filter(value => value !== null).join("\n"))
  ])].join("\n");
  return { html, text };
}

function renderProduct(item) {
  const imageUrl = safeUrl(item.image_url);
  const itemUrl = safeUrl(item.item_url) || CITY_URL;
  const original = item.original_price_text && item.original_price_text !== item.price_text
    ? `<s style="font-size:13px;color:#707070;text-decoration:line-through">${escapeHtml(item.original_price_text)}</s><br>` : "";
  const image = imageUrl ? `<img class="product-photo" src="${escapeHtml(imageUrl)}" alt="" width="96" style="display:block;width:96px;max-width:100%;height:auto;border:0;border-radius:4px">` : "";
  return `<tr><td class="product-image" width="112" valign="top" style="width:112px;padding:16px 0;border-bottom:1px solid #e5e7eb">${image}</td><td valign="top" style="padding:16px 0;border-bottom:1px solid #e5e7eb;word-wrap:break-word"><b style="font-size:15px;line-height:21px">${escapeHtml(item.title || "")}</b><br>${original}<strong style="font-size:20px;line-height:28px;color:#111">${escapeHtml(item.price_text || "")}</strong><br><a href="${escapeHtml(itemUrl)}" style="font-size:13px;line-height:26px;color:#0058a3;text-decoration:underline">Vezi pe IKEA</a></td></tr>`;
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
