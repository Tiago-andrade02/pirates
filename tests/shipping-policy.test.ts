import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  PICKUP_ENABLED,
  pickupEnabled,
  resolveDeliveryType,
  allowedDeliveryTypes,
  filterAllowedOptions,
  deliveryModalityLabel,
} from "../src/lib/shipping/pickup.ts";
import {
  CUSTOMER_SHIPPING_COST,
  isFreeShipping,
  shippingCostFor,
} from "../src/lib/shipping/free-shipping.ts";

describe("modalidades de envío — domicilio y sucursal", () => {
  test("el interruptor maestro está encendido", () => {
    assert.equal(PICKUP_ENABLED, true);
    assert.equal(pickupEnabled(), true);
  });

  test("las dos modalidades están permitidas", () => {
    assert.deepEqual(allowedDeliveryTypes(), ["D", "S"]);
  });

  test("el checkout acepta la modalidad de sucursal, con espacios o minúsculas", () => {
    for (const raw of ["S", "s", " S ", "s "]) {
      const result = resolveDeliveryType(raw);
      assert.equal(result.ok, true, `debía aceptar ${JSON.stringify(raw)}`);
      if (result.ok) assert.equal(result.deliveryType, "S");
    }
  });

  test("ausente, vacío o 'D' se resuelve como envío a domicilio", () => {
    for (const raw of [undefined, null, "", "D", "d", " D "]) {
      const result = resolveDeliveryType(raw);
      assert.equal(result.ok, true, `debía aceptar ${JSON.stringify(raw)}`);
      if (result.ok) assert.equal(result.deliveryType, "D");
    }
  });

  test("un valor basura se normaliza a domicilio, nunca a sucursal", () => {
    for (const raw of ["domicilio", "sucursal", "retiro"]) {
      const result = resolveDeliveryType(raw);
      assert.equal(result.ok, true);
      if (result.ok) assert.equal(result.deliveryType, "D");
    }
  });

  test("filterAllowedOptions deja pasar las dos modalidades", () => {
    const filtered = filterAllowedOptions([
      { deliveryType: "D" as const, price: 0 },
      { deliveryType: "S" as const, price: 0 },
    ]);
    assert.deepEqual(
      filtered.map((o) => o.deliveryType),
      ["D", "S"]
    );
  });

  test("la etiqueta de modalidad nunca expone un código interno", () => {
    assert.equal(deliveryModalityLabel("D"), "Envío a domicilio");
    assert.equal(
      deliveryModalityLabel("S"),
      "Envío a sucursal de Correo Argentino"
    );
    // Un código de sucursal (ej. "SCBA1") no debe aparecer como punto de retiro.
    assert.equal(deliveryModalityLabel("S").includes("SCBA"), false);
  });
});

describe("envío gratis — siempre $0", () => {
  test("el costo que se cobra es 0", () => {
    assert.equal(CUSTOMER_SHIPPING_COST, 0);
    assert.equal(shippingCostFor(), 0);
  });

  test("isFreeShipping lo confirma", () => {
    assert.equal(isFreeShipping(), true);
  });
});