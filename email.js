import { Resend } from "resend";

export async function sendEmail({ to, subject, items, modeLabel }) {
  const resend = new Resend(process.env.RESEND_API_KEY);

  const preferredOrder = ["Seating", "Tables", "Storage", "Beds", "Office", "Lighting", "Other", "Altele"];
  const grouped = new Map();

  for (const it of items) {
    const category = String(it.category || "").trim() || "Altele";
    if (!grouped.has(category)) grouped.set(category, []);
    grouped.get(category).push(it);
  }

  const existingCategories = [...grouped.keys()];
  const orderedCategories = [
    ...preferredOrder.filter((c) => grouped.has(c)),
    ...existingCategories
      .filter((c) => !preferredOrder.includes(c))
      .sort((a, b) => a.localeCompare(b, "ro"))
  ];

  const sections = orderedCategories
    .map((category) => {
      const categoryItems = grouped.get(category) || [];
      if (categoryItems.length === 0) return "";

      const cards = categoryItems
        .map(
          (it) => `
      <div style="border:1px solid #eee;border-radius:10px;padding:12px;margin:12px 0;width:100%;box-sizing:border-box;">
        ${it.image_url ? `<div style="background:#f5f5f5;border-radius:8px;height:210px;line-height:210px;text-align:center;overflow:hidden;">
          <img src="${it.image_url}" alt="" style="width:100%;height:210px;object-fit:contain;vertical-align:middle;" />
        </div>` : ""}
        <div style="margin-top:10px;font-size:16px;line-height:1.4;font-weight:700;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(it.title || "")}</div>
        <div style="margin-top:6px;font-size:15px;line-height:1.4;font-weight:700;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(it.price_text || "")}</div>
        ${it.item_url ? `<a href="${it.item_url}" style="display:inline-block;margin-top:10px;color:#0058a3;text-decoration:none;font-weight:600;font-size:14px;line-height:1.4;">Vezi pe IKEA</a>` : ""}
      </div>
    `
        )
        .join("");

      return `
    <div style="margin-top:20px;">
      <div style="font-size:16px;line-height:1.4;font-weight:700;color:#111;padding-bottom:8px;border-bottom:1px solid #e9e9e9;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(category)} (${categoryItems.length})</div>
      ${cards}
    </div>`;
    })
    .join("");

  const html = `
  <div style="font-family: Arial, sans-serif; background:#ffffff; padding:16px; color:#111; width:100%; box-sizing:border-box;">
    <div style="max-width:600px;width:100%;margin:0 auto;box-sizing:border-box;">
      <div style="font-size:13px;line-height:1.4;color:#666;word-break:break-word;overflow-wrap:anywhere;">${modeLabel}</div>
      ${sections}
    </div>
  </div>`;

  await resend.emails.send({
    from: "IKEA Watcher <onboarding@resend.dev>",
    to,
    subject,
    html
  });
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
