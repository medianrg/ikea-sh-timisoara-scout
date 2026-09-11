import assert from "node:assert/strict";
import test from "node:test";
import { buildFirecrawlRequest, validateCatalogue } from "../firecrawl-request.js";
import { CITY_URL } from "../config.js";

const catalogue = ({ store = "IKEA Timișoara", cards = 2, shown = 2, total = 2, busy = false } = {}) => `
  <ul id="selected-filters"><li><button>${store}</button></li></ul>
  <ul aria-label="Lista de produse" aria-busy="${busy}">${"<li>product</li>".repeat(cards)}</ul>
  <div role="status">Se afișează ${shown} din ${total}</div>`;

test("targets the exact Timișoara URL and requests fresh rendered HTML", () => {
  const request = buildFirecrawlRequest();
  assert.equal(request.url, CITY_URL);
  assert.equal(request.url, "https://www.ikea.com/ro/ro/second-hand/buy-from-ikea/#/timi%C8%99oara");
  assert.deepEqual(request.formats, ["rawHtml"]);
  assert.equal(request.maxAge, 0);
});

test("accepts only a fully rendered, nonempty Timișoara catalogue", () => {
  assert.equal(validateCatalogue(catalogue()), 2);
  for (const options of [
    { store: "IKEA Pallady" }, { cards: 0, shown: 0, total: 0 },
    { cards: 32, shown: 32, total: 94 }, { shown: 1 }, { busy: true }
  ]) assert.throws(() => validateCatalogue(catalogue(options)));
});

test("rejects a page shell or mixed store filters before item persistence", () => {
  assert.throws(() => validateCatalogue("<html><h1>Atelierul de Circularitate</h1></html>"));
  assert.throws(() => validateCatalogue(catalogue().replace("</button>", "</button><button>IKEA Pallady</button>")));
});
