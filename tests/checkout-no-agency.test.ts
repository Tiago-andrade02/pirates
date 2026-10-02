import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Prueba de fuente: el checkout ofrece dos modalidades gratuitas —domicilio o
// sucursal de Correo Argentino— sin selector de sucursales ni consulta a la API
// de agencias. No se renderiza el componente (node --test no procesa JSX), así
// que se inspecciona el código real que llega a la Preview.
//
// Lo que se verifica acá: la modalidad es elegible, pero la sucursal es texto
// libre (no un catálogo) y nunca viaja un agencyCode real al backend.

function readSource(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

// Saca comentarios de línea y de bloque: el código (no la prosa) es lo que se
// evalúa, así un comentario que aclara "no hay catálogo de sucursales" no
// dispara el test.
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

describe("checkout — dos modalidades, sin catálogo de sucursales", () => {
  test("ShippingForm no consulta la API de agencias ni maneja agencyCode", () => {
    assert.doesNotMatch(shippingForm, /\/api\/shipping\/agencies/);
    assert.doesNotMatch(shippingForm, /setAgencyCode|handleAgencyChange/);
    assert.doesNotMatch(shippingForm, /agencies/);
  });

  test("la modalidad de envío es elegible entre las dos opciones", () => {
    // Un radio que el usuario puede cambiar: a diferencia del retiro en persona
    // deshabilitado, acá el cliente elige.
    assert.match(shippingForm, /type="radio"/);
    assert.match(shippingForm, /setDeliveryType\(m\.value\)/);
    assert.match(shippingForm, /Envío a domicilio/);
    assert.match(shippingForm, /Envío a sucursal de Correo Argentino/);
  });

  test("no hay un desplegable de sucursales: la preferencia es texto libre", () => {
    // El input de sucursal es un <input> con maxLength, no un <select> que
    // liste un catálogo.
    assert.match(shippingForm, /setPreferredBranch/);
    assert.match(shippingForm, /maxLength=\{120\}/);
    // Ningún <select> de sucursal.
    assert.doesNotMatch(shippingForm, /value=\{preferredBranch\}[\s\S]{0,80}<option/);
  });

  test("en la modalidad sucursal se explica la coordinación por WhatsApp", () => {
    assert.match(shippingForm, /sucursal/i);
    assert.match(shippingForm, /WhatsApp/i);
  });

  test("la dirección solo se pide en la modalidad a domicilio", () => {
    // Los campos de calle/número están detrás del condicional de modalidad.
    assert.match(shippingForm, /deliveryType === "D" &&/);
    assert.match(shippingForm, /street: isHome \? street : ""/);
    assert.match(shippingForm, /number: isHome \? number : ""/);
  });

  test("agencyCode no se maneja en el formulario", () => {
    assert.doesNotMatch(shippingForm, /agencyCode/);
  });
});

describe("página de checkout — envía modalidad, sucursal y observaciones", () => {
  test("envía la modalidad elegida, no una fija", () => {
    assert.match(checkoutPage, /deliveryType: shipping\.deliveryType/);
    assert.doesNotMatch(checkoutPage, /deliveryType:\s*"D"/);
    assert.doesNotMatch(checkoutPage, /\/api\/shipping\/agencies/);
  });

  test("la dirección solo se valida para envío a domicilio", () => {
    assert.match(
      checkoutPage,
      /shipping\.deliveryType === "D" && \(!shipping\.street \|\| !shipping\.number\)/
    );
  });

  test("envía la sucursal preferida y las observaciones del cliente", () => {
    assert.match(checkoutPage, /preferredBranch: shipping\.preferredBranch/);
    assert.match(checkoutPage, /notes,/);
    assert.match(checkoutPage, /setNotes/);
  });
});

describe("API de checkout — sucursal sin agencyCode", () => {
  test("acepta la modalidad S y la sucursal preferida", () => {
    // No hay un literal "S" en la ruta: la modalidad se resuelve con la misma
    // política compartida que usa el resto del backend (pickup.ts).
    assert.match(checkoutRoute, /resolveDeliveryType/);
    assert.match(checkoutRoute, /preferredBranch/);
    assert.match(checkoutRoute, /preferred_branch/);
  });

  test("nunca lee agencyCode del pedido entrante", () => {
    assert.doesNotMatch(checkoutRoute, /(body|shipping)\.agencyCode/);
  });

  test("persiste agency_code vacío", () => {
    assert.match(checkoutRoute, /const agencyCode = ""/);
  });

  test("guarda las observaciones del cliente", () => {
    assert.match(checkoutRoute, /customer_notes/);
  });
});