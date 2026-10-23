import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  availableSizes,
  buyableSizes,
  defaultSize,
  hasAnyBuyable,
  isAvailable,
  isBuyable,
  sizeLabel,
  type PerfumeSize,
} from "../src/lib/variants.ts";
import type { Prices, Stocks } from "../src/lib/types.ts";

function prices(over: Partial<Prices> = {}): Prices {
  return { "30": null, "50": null, "100": null, ...over };
}

function stocks(over: Partial<Stocks> = {}): Stocks {
  return { "30": 0, "50": 0, "100": 0, ...over };
}

describe("variants — disponibilidad", () => {
  test("una presentación existe solo si tiene precio", () => {
    const p = prices({ "30": 30000 });
    assert.equal(isAvailable(p, "30"), true);
    assert.equal(isAvailable(p, "50"), false);
    assert.equal(isAvailable(p, "100"), false);
  });

  test("una presentación se puede comprar solo con precio y stock", () => {
    const p = prices({ "30": 30000, "100": 70000 });
    const s = stocks({ "30": 0, "100": 2 });
    assert.equal(isBuyable(p, s, "30"), false); // precio pero sin stock
    assert.equal(isBuyable(p, s, "100"), true);
    assert.equal(isBuyable(p, s, "50"), false);
  });

  test("availableSizes devuelve los tamaños con precio, en orden 30/50/100", () => {
    assert.deepEqual(availableSizes(prices({ "30": 1, "100": 1 })), ["30", "100"]);
    assert.deepEqual(availableSizes(prices()), []);
  });

  test("buyableSizes exige stock > 0 en la talla exacta", () => {
    const p = prices({ "30": 1, "50": 1, "100": 1 });
    const s = stocks({ "30": 1, "100": 3 });
    assert.deepEqual(buyableSizes(p, s), ["30", "100"]);
  });

  test("hasAnyBuyable es false si el stock está en una talla sin precio", () => {
    // Caso real del catálogo: solo 30ml con precio, pero el stock quedó en 100.
    const p = prices({ "30": 33000 });
    const s = stocks({ "100": 13 });
    assert.equal(hasAnyBuyable(p, s), false);
  });
});

describe("variants — presentación por defecto", () => {
  test("prefiere 50, después 100 y por último 30", () => {
    const all = stocks({ "30": 1, "50": 1, "100": 1 });
    assert.equal(defaultSize(prices({ "30": 1, "50": 1, "100": 1 }), all), "50");
    assert.equal(defaultSize(prices({ "30": 1, "100": 1 }), all), "100");
    assert.equal(defaultSize(prices({ "30": 1 }), all), "30");
  });

  test("salta presentaciones con precio pero sin stock", () => {
    const p = prices({ "50": 40000, "100": 70000 });
    assert.equal(defaultSize(p, stocks({ "100": 2 })), "100");
  });

  test("si ninguna se puede comprar, devuelve una disponible para mostrar el precio", () => {
    const p = prices({ "30": 33000, "100": 70000 });
    // 30 tiene stock, 100 no; ninguna comprable => cae a disponible preferida (100).
    const size = defaultSize(p, stocks({ "30": 0 }));
    assert.equal(size, ("100" satisfies PerfumeSize));
  });

  test("sin precios devuelve null", () => {
    assert.equal(defaultSize(prices(), stocks()), null);
  });
});

describe("variants — etiquetas", () => {
  test("sizeLabel agrega el sufijo ml", () => {
    assert.equal(sizeLabel("30"), "30 ml");
    assert.equal(sizeLabel("50"), "50 ml");
    assert.equal(sizeLabel("100"), "100 ml");
  });
});
