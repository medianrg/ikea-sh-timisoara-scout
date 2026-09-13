import { Resend } from "resend";
import { renderProductEmail } from "./email-template.js";

export async function sendEmail({ to, subject, items, modeLabel }) {
  const resend = new Resend(process.env.RESEND_API_KEY);

  const { html, text } = renderProductEmail({ items, modeLabel });

  const result = await resend.emails.send({
    from: "IKEA Watcher <onboarding@resend.dev>",
    to,
    subject,
    html,
    text
  });
  if (result.error) throw new Error(`Resend: ${result.error.message}`);
  if (!result.data?.id) throw new Error("Resend returned no email ID");
  console.log(`Email accepted by Resend: ${result.data.id} (${items.length} products)`);
  return result.data;
}


export async function sendStatusEmail({ to, subject, message }) {
  const resend = new Resend(process.env.RESEND_API_KEY);

  const html = `
  <div style="font-family: Arial, sans-serif; background:#ffffff; padding:16px; color:#111; width:100%; box-sizing:border-box;">
    <div style="max-width:600px;width:100%;margin:0 auto;box-sizing:border-box;">
      <div style="font-size:16px;line-height:1.4;font-weight:700;">${escapeHtml(subject)}</div>
      <div style="margin-top:10px;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(message)}</div>
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

