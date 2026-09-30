import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  PICKUP_ENABLED,
  PICKUP_DISABLED_MESSAGE,
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

describe("retiro en persona — desactivado", () => {
  test("el interruptor maestro está apagado", () => {
    assert.equal(PICKUP_ENABLED, false);
    assert.equal(pickupEnabled(), false);
  });

  test("la única modalidad permitida es a domicilio", () => {
    const allowed = allowedDeliveryTypes();
    assert.deepEqual(allowed, ["D"]);
    assert.equal(allowed.includes("S"), false);
  });

  test("el checkout no ofrece ni acepta retiro", () => {
    // Un cliente guardado o un pedido manipulado puede mandar "S".
    for (const raw of ["S", "s", " S ", "s "]) {
      const result = resolveDeliveryType(raw);
      assert.equal(result.ok, false, `debía rechazar ${JSON.stringify(raw)}`);
      assert.match(result.error, /retiro/i);
      assert.equal(result.error, PICKUP_DISABLED_MESSAGE);
    }
  });

  test("ausente, vacío o 'D' se resuelve como envío a domicilio", () => {
    for (const raw of [undefined, null, "", "D", "d", " D "]) {
      const result = resolveDeliveryType(raw);
      assert.equal(result.ok, true, `debía aceptar ${JSON.stringify(raw)}`);
      if (result.ok) assert.equal(result.deliveryType, "D");
    }
  });

  test("un valor basura no habilita el retiro", () => {
    assert.equal(resolveDeliveryType("domicilio").ok, true);
    assert.equal(resolveDeliveryType("retiro").ok, true);
    // Aunque no sea una modalidad reconocida, se normaliza a "D", nunca a "S".
    const result = resolveDeliveryType("retiro");
    if (result.ok) assert.equal(result.deliveryType, "D");
  });

  test("filterAllowedOptions descarta la modalidad de retiro", () => {
    const options = [
      { deliveryType: "D" as const, price: 0 },
      { deliveryType: "S" as const, price: 0 },
    ];
    const filtered = filterAllowedOptions(options);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].deliveryType, "D");
  });

  test("si un provider solo ofrece retiro, la cotización queda vacía", () => {
    // El checkout no puede quedar sin ninguna opción válida: la ruta responde
    // 404 en vez de ofrecer un retiro desactivado.
    const filtered = filterAllowedOptions([{ deliveryType: "S" as const }]);
    assert.deepEqual(filtered, []);
  });

  test("la etiqueta de modalidad nunca expone un código interno", () => {
    assert.equal(deliveryModalityLabel("D"), "Envío a domicilio");
    assert.equal(deliveryModalityLabel("S"), "Retirada en persona");
    // Un código de sucursal (ej. "SCBA1") no debe aparecer como punto de retiro.
    assert.equal(deliveryModalityLabel("S").includes("Suc"), false);
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
