import assert from "node:assert/strict";
import test from "node:test";
import { CITY_URL } from "../config.js";
import { parseItemsFromHtml } from "../parse.js";

const productList = (cards) => `<ul aria-label="Lista de produse">${cards}</ul>`;
const price = (integer, decimal = "", comparison = false) => `
  <span class="price${comparison ? " price--comparison" : ""}">
    <span class="price__integer">${integer}</span>
    ${decimal ? `<span class="price__decimal">${decimal}</span>` : ""}
    <span class="price__currency">lei</span>
    <span class="sr-text">${integer}${decimal} lei</span>
  </span>`;

const card = ({
  name = "VECKLARFLY",
  description = "Perdea, alb, 145x300 cm",
  prices = price("349", "", true) + price("139", ",60"),
  image = '<img src="https://www.ikea.com/ro/ro/images/products/vecklarfly.jpg">',
  group = false
} = {}) => `<li aria-label="${name}">
  ${group ? '<button type="button">' : '<a href="#/timi%C8%99oara/878247186">'}
    ${image}
    <div><span class="typography-heading-xs">${name}</span>
      <span class="typography-body-m">${description}</span></div>
    <div>${prices}</div>
    <span>Disponibil la IKEA Timișoara</span>
  ${group ? "</button>" : "</a>"}
</li>`;

test("current IKEA card preserves decimal offer price and resolves the product hash URL", () => {
  const items = parseItemsFromHtml(productList(card()));
  assert.deepEqual(items, [{
    title: "VECKLARFLY Perdea, alb, 145x300 cm",
    price_text: "139,60 lei",
    original_price_text: "349 lei",
    image_url: "https://www.ikea.com/ro/ro/images/products/vecklarfly.jpg",
    item_url: new URL("#/timi%C8%99oara/878247186", CITY_URL).href
  }]);
});

test("group cards preserve the full current price range and link to the city list", () => {
  const items = parseItemsFromHtml(productList(card({
    name: "KALLAX",
    description: "Etajeră, alb",
    group: true,
    prices: price("399", "", true) + price("199", ",50") + " - " + price("239", ",40")
  })));
  assert.equal(items[0].title, "KALLAX Etajeră, alb");
  assert.equal(items[0].price_text, "199,50 - 239,40 lei");
  assert.equal(items[0].original_price_text, "399 lei");
  assert.equal(items[0].item_url, CITY_URL);
});

test("relative image URLs and whole or thousands-separated prices are supported", () => {
  const items = parseItemsFromHtml(productList(card({
    image: '<img data-src="/ro/ro/images/products/sofa.jpg">',
    prices: price("1.249")
  })));
  assert.equal(items[0].price_text, "1.249 lei");
  assert.equal(items[0].original_price_text, undefined);
  assert.equal(items[0].image_url, "https://www.ikea.com/ro/ro/images/products/sofa.jpg");
});

test("original prices preserve decimals and ranges separately from current offers", () => {
  const [item] = parseItemsFromHtml(productList(card({
    group: true,
    prices: price("1.249", ".90", true) + " - " + price("1 499", ",50", true) + price("999", ",60")
  })));
  assert.equal(item.original_price_text, "1.249,90 - 1 499,50 lei");
  assert.equal(item.price_text, "999,60 lei");
});

test("missing or unreadable optional original prices do not reject valid offers", () => {
  for (const comparison of ["", price("349", ",broken", true), price("", "", true)]) {
    const [item] = parseItemsFromHtml(productList(card({ prices: comparison + price("139", ",60") })));
    assert.equal(item.price_text, "139,60 lei");
    assert.equal(item.original_price_text, undefined);
  }
});

test("adding or changing original prices leaves hash fields and deduplication unchanged", () => {
  const identity = ({ title, price_text, image_url }) => ({ title, price_text, image_url });
  const withoutOriginal = parseItemsFromHtml(productList(card({ prices: price("139", ",60") })))[0];
  const withOriginal = parseItemsFromHtml(productList(card()))[0];
  const changedOriginal = card({ prices: price("499", "", true) + price("139", ",60") });
  assert.deepEqual(identity(withOriginal), identity(withoutOriginal));
  assert.deepEqual(identity(parseItemsFromHtml(productList(changedOriginal))[0]), identity(withoutOriginal));
  assert.equal(parseItemsFromHtml(productList(card() + changedOriginal)).length, 1);
});

test("an incomplete modern card rejects the scrape instead of losing that item silently", () => {
  for (const [override, reason] of [
    [{ name: "" }, /missing product title/],
    [{ image: "" }, /missing product image/],
    [{ prices: price("349", "", true) }, /missing or ambiguous current price/],
    [{ prices: price("139", ",broken") }, /unrecognized current price/]
  ]) {
    assert.throws(() => parseItemsFromHtml(productList(card() + card(override))), reason);
  }
});

test("an empty modern list does not fall back to unrelated page prices", () => {
  const html = '<a href="/unrelated"><img src="/other.jpg">Unrelated offer 100 lei</a>' + productList("");
  assert.deepEqual(parseItemsFromHtml(html), []);
});

test("legacy Firecrawl HTML keeps the existing parser behavior", () => {
  const html = '<a href="/ro/ro/p/poaeng"><img src="https://www.ikea.com/poaeng.jpg">POÄNG fotoliu 100 lei</a>';
  assert.deepEqual(parseItemsFromHtml(html), [{
    title: "POÄNG fotoliu 100",
    price_text: "100 lei",
    image_url: "https://www.ikea.com/poaeng.jpg",
    item_url: "https://www.ikea.com/ro/ro/p/poaeng"
  }]);
});
