import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Prueba de fuente: el checkout sólo puede ofrecer envío a domicilio. No se
// renderiza el componente (node --test no procesa JSX), así que se inspecciona
// el código real que llega a la Preview para garantizar que no vuelva un
// selector de sucursales/agencias ni un campo obligatorio que lo exija.

function readSource(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

// Saca comentarios de línea y de bloque: el código (no la prosa) es lo que se
// evalúa, así un comentario que aclara "no hay sucursal" no dispara el test.
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

const shippingForm = stripComments(
  readSource("../src/components/checkout/ShippingForm.tsx")
);
const checkoutPage = stripComments(
  readSource("../src/app/(store)/checkout/page.tsx")
);
const checkoutRoute = stripComments(
  readSource("../src/app/api/checkout/route.ts")
);

describe("checkout — sin selector de sucursal", () => {
  test("ShippingForm no muestra ninguna sucursal ni agencia", () => {
    assert.doesNotMatch(shippingForm, /sucursal/i);
    assert.doesNotMatch(shippingForm, /agenci/i);
  });

  test("ShippingForm no consulta la API de agencias ni maneja agencyCode", () => {
    assert.doesNotMatch(shippingForm, /\/api\/shipping\/agencies/);
    assert.doesNotMatch(shippingForm, /setAgencyCode|handleAgencyChange/);
    assert.doesNotMatch(shippingForm, /agencies/);
  });

  test("ShippingForm sólo emite envío a domicilio", () => {
    assert.match(shippingForm, /deliveryType:\s*"D"/);
    assert.doesNotMatch(shippingForm, /deliveryType:\s*"S"/);
  });

  test("agencyCode sólo viaja vacío (nunca un código de sucursal)", () => {
    assert.match(shippingForm, /agencyCode:\s*""/);
    // Ningún literal no vacío asignado a agencyCode.
    assert.doesNotMatch(shippingForm, /agencyCode:\s*"(?!")/);
  });

  test("la página de checkout no ofrece retiro ni sucursal", () => {
    assert.doesNotMatch(checkoutPage, /sucursal|retiro|agenci/i);
    assert.match(checkoutPage, /deliveryType:\s*"D"/);
  });
});

describe("API de checkout — no exige agencyCode", () => {
  test("nunca lee agencyCode del pedido entrante", () => {
    assert.doesNotMatch(checkoutRoute, /(body|shipping)\.agencyCode/);
  });

  test("persiste agency_code vacío", () => {
    assert.match(checkoutRoute, /const agencyCode = ""/);
  });
});
