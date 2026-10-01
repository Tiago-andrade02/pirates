import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { isCheckoutTestModeEnabled } from "../src/lib/checkout-test-mode.ts";

// El modo de prueba del checkout permite crear un pedido 'pendiente' sin
// Mercado Pago desde una Preview de Vercel. Es una puerta de seguridad: debe
// estar apagada salvo en Preview (o desarrollo local) y NUNCA en produccion,
// sin importar el valor de CHECKOUT_TEST_MODE.

// --- Gate puro ------------------------------------------------------------

describe("checkout test mode - gate", () => {
  test("sin CHECKOUT_TEST_MODE queda desactivado", () => {
    assert.equal(isCheckoutTestModeEnabled({}), false);
    assert.equal(isCheckoutTestModeEnabled({ VERCEL_ENV: "preview" }), false);
    assert.equal(
      isCheckoutTestModeEnabled({ VERCEL_ENV: "preview", NODE_ENV: "development" }),
      false
    );
  });

  test("solo el literal exacto true habilita", () => {
    assert.equal(
      isCheckoutTestModeEnabled({
        CHECKOUT_TEST_MODE: "false",
        VERCEL_ENV: "preview",
      }),
      false
    );
    assert.equal(
      isCheckoutTestModeEnabled({
        CHECKOUT_TEST_MODE: "TRUE",
        VERCEL_ENV: "preview",
      }),
      false
    );
    assert.equal(
      isCheckoutTestModeEnabled({
        CHECKOUT_TEST_MODE: "1",
        VERCEL_ENV: "preview",
      }),
      false
    );
    assert.equal(
      isCheckoutTestModeEnabled({
        CHECKOUT_TEST_MODE: "",
        VERCEL_ENV: "preview",
      }),
      false
    );
  });

  test("Preview de Vercel habilita", () => {
    assert.equal(
      isCheckoutTestModeEnabled({
        CHECKOUT_TEST_MODE: "true",
        VERCEL_ENV: "preview",
        NODE_ENV: "production",
      }),
      true
    );
  });

  test("produccion de Vercel nunca habilita", () => {
    assert.equal(
      isCheckoutTestModeEnabled({
        CHECKOUT_TEST_MODE: "true",
        VERCEL_ENV: "production",
        NODE_ENV: "production",
      }),
      false
    );
    // Proteccion explicita e independiente: aunque NODE_ENV no sea produccion.
    assert.equal(
      isCheckoutTestModeEnabled({
        CHECKOUT_TEST_MODE: "true",
        VERCEL_ENV: "production",
        NODE_ENV: "development",
      }),
      false
    );
  });

  test("en Vercel, cualquier VERCEL_ENV que no sea preview desactiva", () => {
    for (const value of ["development", "", "unknown", "Preview", "preview "]) {
      assert.equal(
        isCheckoutTestModeEnabled({
          CHECKOUT_TEST_MODE: "true",
          VERCEL_ENV: value,
        }),
        false,
        `VERCEL_ENV=${JSON.stringify(value)} deberia desactivar`
      );
    }
  });

  test("fuera de Vercel solo habilita fuera de produccion", () => {
    assert.equal(
      isCheckoutTestModeEnabled({
        CHECKOUT_TEST_MODE: "true",
        NODE_ENV: "development",
      }),
      true
    );
    assert.equal(isCheckoutTestModeEnabled({ CHECKOUT_TEST_MODE: "true" }), true);
    assert.equal(
      isCheckoutTestModeEnabled({
        CHECKOUT_TEST_MODE: "true",
        NODE_ENV: "production",
      }),
      false
    );
  });
});

// --- Integracion en la API ------------------------------------------------

function readSource(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

const checkoutRoute = stripComments(
  readSource("../src/app/api/checkout/route.ts")
);
const checkoutPage = stripComments(
  readSource("../src/app/(store)/checkout/page.tsx")
);

describe("API de checkout - modo de prueba", () => {
  test("usa el gate server-side", () => {
    assert.match(
      checkoutRoute,
      /import \{ isCheckoutTestModeEnabled \} from "@\/lib\/checkout-test-mode"/
    );
    assert.match(checkoutRoute, /const testMode = isCheckoutTestModeEnabled\(\)/);
  });

  test("sin credenciales solo falla cuando NO esta en modo de prueba", () => {
    assert.match(checkoutRoute, /if \(!testMode && !hasCredentials\(\)\)/);
  });

  test("no llama a Mercado Pago cuando el modo de prueba esta activo", () => {
    assert.match(checkoutRoute, /if \(!testMode\) \{[\s\S]*?createPreference\(/);
  });

  test("devuelve testMode sin preferencia ni initPoint", () => {
    assert.match(checkoutRoute, /testMode: true/);
  });

  test("crea el pedido en estado pendiente", () => {
    assert.match(checkoutRoute, /"pendiente",/);
  });

  test("el pedido de prueba no persiste ni dispara pagos", () => {
    assert.doesNotMatch(checkoutRoute, /mp_payment_id/);
    assert.doesNotMatch(checkoutRoute, /paid_at/);
    assert.doesNotMatch(
      checkoutRoute,
      /finalizePaidOrderByCode|attachPaymentToOrder|planNotifications/
    );
  });

  test("el envio sale de CUSTOMER_SHIPPING_COST y el codigo de agencia va vacio", () => {
    assert.match(checkoutRoute, /const shippingCost = CUSTOMER_SHIPPING_COST/);
    assert.match(checkoutRoute, /const agencyCode = ""/);
  });
});

describe("UI de checkout - modo de prueba", () => {
  test("maneja la respuesta testMode sin montar el Payment Brick", () => {
    assert.match(checkoutPage, /data\.testMode/);
    assert.match(checkoutPage, /testOrder/);
  });

  test("avisa que no hubo cobro y muestra el codigo del pedido", () => {
    assert.match(checkoutPage, /No est. pagado y no se proces. ning.n cobro\./);
    assert.match(
      checkoutPage,
      /\/pedido\/\$\{encodeURIComponent\(testOrder\.code\)\}/
    );
  });
});
