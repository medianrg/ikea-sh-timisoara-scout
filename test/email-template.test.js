import assert from "node:assert/strict";
import test from "node:test";
import * as cheerio from "cheerio";
import { renderProductEmail } from "../email-template.js";
import { sendEmail } from "../email.js";

const product = {
  title: "VECKLARFLY jaluzele venețiene, 60x155 cm, bambus",
  price_text: "139,60 lei", original_price_text: "349 lei", category: "Other",
  image_url: "https://www.ikea.com/ro/ro/images/products/vecklarfly-jaluzele-venetiene-bambus__1431241_pe982291_s4.jpg",
  item_url: "https://www.ikea.com/ro/ro/second-hand/buy-from-ikea/#/timi%C8%99oara/878247186"
};

test("email separates original and offer prices, including groups and missing originals", () => {
  const { html, text } = renderProductEmail({ items: [product,
    { ...product, title: "KALLAX", price_text: "199,50 - 239,40 lei", original_price_text: "399 lei" },
    { ...product, title: "Fără preț original", original_price_text: undefined },
    { ...product, title: "Același preț", original_price_text: "139,60 lei" }
  ] });
  const $ = cheerio.load(html);
  assert.deepEqual($("s").map((_, el) => $(el).text()).get(), ["349 lei", "399 lei"]);
  assert.match($("s").first().attr("style"), /text-decoration:line-through/);
  assert.equal($("strong").filter((_, el) => $(el).text() === "199,50 - 239,40 lei").length, 1);
  assert.equal($("img").length, 4);
  assert.ok($("img").toArray().every(el => $(el).attr("height") === undefined));
  assert.match(text, /Preț original: 349 lei\nPreț actual: 139,60 lei/);
});

test("email escapes product text and rejects active or malformed link URLs", () => {
  const { html } = renderProductEmail({ items: [{ ...product, title: '<script>alert("x")</script>',
    item_url: 'javascript:alert(1)', image_url: 'data:text/html,<script>bad</script>'
  }], modeLabel: '<img src=x onerror="bad()">' });
  const $ = cheerio.load(html);
  assert.equal($("script, img").length, 0);
  assert.equal($("b").text(), '<script>alert("x")</script>');
  assert.ok($("a").toArray().every(el => $(el).attr("href").startsWith("https://www.ikea.com/")));
});

test("a 94-product digest retains every product and stays below the email HTML budget", () => {
  const items = Array.from({ length: 94 }, (_, index) => ({ ...product, title: `${product.title} · ${index + 1}` }));
  const { html, text } = renderProductEmail({ items });
  const $ = cheerio.load(html);
  assert.equal($("b").length, 94);
  assert.equal($("s").length, 94);
  assert.ok(text.includes("· 94"));
  assert.ok(Buffer.byteLength(html) < 100_000, `HTML is ${Buffer.byteLength(html)} bytes`);
});

test("email submission includes plain text and surfaces a rejected Resend response", async t => {
  const oldKey = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = "re_test_placeholder";
  t.after(() => { if (oldKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = oldKey; });
  let payload;
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    payload = JSON.parse(options.body);
    return new Response(JSON.stringify({ name: "validation_error", message: "Sender is not verified" }),
      { status: 403, headers: { "content-type": "application/json" } });
  });
  await assert.rejects(sendEmail({ to: "test@example.com", subject: "Preview", items: [product] }), /Resend: Sender is not verified/);
  assert.match(payload.html, /<s /);
  assert.match(payload.text, /Preț original: 349 lei/);
});
