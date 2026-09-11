import * as cheerio from "cheerio";
import { CITY_URL } from "./config.js";

// Firecrawl executes these clicks in its rendered browser before capturing HTML.
// Bound the work; validation below rejects a catalogue that still has more pages.
const LOAD_MORE_SCRIPT = `(() => {
  const app = document.getElementById('__next');
  if (!app) throw new Error('IKEA catalogue did not render');
  const button = Array.from(app.querySelectorAll('button')).find(
    element => element.textContent.trim() === 'Afișează mai mult'
  );
  if (button && !button.disabled) button.click();
})()`;

export function buildFirecrawlRequest() {
  return {
    url: CITY_URL,
    formats: ["rawHtml"],
    onlyMainContent: false,
    maxAge: 0,
    timeout: 60000,
    actions: [
      { type: "wait", selector: 'ul[aria-label="Lista de produse"] > li' },
      ...Array.from({ length: 8 }, () => [
        { type: "executeJavascript", script: LOAD_MORE_SCRIPT },
        { type: "wait", milliseconds: 1000 }
      ]).flat()
    ]
  };
}

export function validateCatalogue(html) {
  const $ = cheerio.load(html);
  const lists = $('ul[aria-label="Lista de produse"]');
  if (lists.length !== 1 || lists.attr("aria-busy") === "true") {
    throw new Error("IKEA product list is missing or still loading");
  }
  const stores = $('#selected-filters button').map((_, el) =>
    $(el).text().replace(/\s+/g, " ").trim()
  ).get();
  if (stores.length !== 1 || stores[0] !== "IKEA Timișoara") {
    throw new Error("IKEA catalogue is not filtered to Timișoara only");
  }
  const status = $('[role="status"]').toArray().map(el =>
    $(el).text().replace(/\s+/g, " ").trim()
  ).find(text => /^Se afișează \d+ din \d+$/.test(text));
  const match = status?.match(/^Se afișează (\d+) din (\d+)$/);
  const cards = lists.children("li").length;
  if (!match || cards === 0 || cards !== Number(match[1]) || cards !== Number(match[2])) {
    throw new Error(`IKEA catalogue is empty or incomplete (${status || "missing page count"}; ${cards} cards). Item state was not updated.`);
  }
  return cards;
}
