import { Resend } from "resend";

export async function sendEmail({ to, subject, items, modeLabel }) {
  const resend = new Resend(process.env.RESEND_API_KEY);

  const cards = items.map(it => `
    <div style="border:1px solid #eee;border-radius:10px;padding:12px;margin:12px 0;">
      ${it.image_url ? `<img src="${it.image_url}" alt="" style="width:100%;max-height:320px;object-fit:cover;border-radius:8px;" />` : ""}
      <div style="margin-top:10px;font-size:18px;font-weight:700;">${escapeHtml(it.title || "")}</div>
      <div style="margin-top:6px;font-size:16px;font-weight:700;">${escapeHtml(it.price_text || "")}</div>
      ${it.item_url ? `<a href="${it.item_url}" style="display:inline-block;margin-top:10px;color:#0058a3;text-decoration:none;font-weight:600;">Vezi pe IKEA</a>` : ""}
    </div>
  `).join("");

  const html = `
  <div style="font-family: Arial, sans-serif; background:#ffffff; padding:16px; max-width:640px; margin:0 auto; color:#111;">
    <div style="font-size:13px;color:#666;">${modeLabel}</div>
    ${cards}
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
