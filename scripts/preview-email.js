import { mkdirSync, writeFileSync } from "node:fs";
import { renderProductEmail } from "../email-template.js";
import { CITY_URL } from "../config.js";

// Representative public catalogue examples for visual checks; no API or email.
const items = [
  { title: "VECKLARFLY jaluzele veneţiene, 60x155 cm, bambus", price_text: "139,60 lei", original_price_text: "349 lei", category: "Other", image_url: "https://www.ikea.com/ro/ro/images/products/vecklarfly-jaluzele-venetiene-bambus__1431241_pe982291_s4.jpg", item_url: `${CITY_URL}/878247186` },
  { title: "VECKLARFLY jaluzele veneţiene, 80x155 cm, bambus", price_text: "199,50 - 239,40 lei", original_price_text: "399 lei", category: "Other", image_url: "https://www.ikea.com/ro/ro/images/products/vecklarfly-jaluzele-venetiene-bambus__1431241_pe982291_s4.jpg", item_url: CITY_URL }
];
mkdirSync(".preview", { recursive: true });
const { html } = renderProductEmail({ items, modeLabel: "Previzualizare · produse de exemplu" });
writeFileSync(".preview/email.html", html);
console.log("Preview written to .preview/email.html");
