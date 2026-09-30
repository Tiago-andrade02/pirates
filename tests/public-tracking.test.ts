import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { buildPublicTrackingResponse } from "../src/lib/shipping/public-tracking.ts";
import type { TrackingEvent } from "../src/lib/types.ts";

const EVENTS: TrackingEvent[] = [
  {
    event: "Despachado",
    date: "2026-10-01T15:30:00.000Z",
    branch: null,
    status: "enviado",
    sign: "+",
  },
];

function source(over: Record<string, unknown> = {}) {
  return {
    code: "PIR-ABC123",
    status: "enviado",
    createdAt: "2026-09-28T12:00:00.000Z",
    shippedAt: "2026-10-01T15:30:00.000Z",
    deliveryType: "D",
    shippingProvider: "manual",
    shippingService: "correo-argentino",
    trackingNumber: "123456789AR",
    trackingUrl: "",
    ...over,
  };
}

describe("respuesta pública de tracking", () => {
  test("incluye los datos de seguimiento del pedido", () => {
    const body = buildPublicTrackingResponse(source(), EVENTS);
    assert.equal(body.code, "PIR-ABC123");
    assert.equal(body.status, "enviado");
    assert.equal(body.shippedAt, "2026-10-01T15:30:00.000Z");
    assert.equal(body.trackingNumber, "123456789AR");
    assert.equal(body.trackingUrl, "");
    assert.deepEqual(body.events, EVENTS);
  });

  test("NUNCA expone el código postal ni la localidad", () => {
    const body = buildPublicTrackingResponse(source(), EVENTS);
    assert.equal("postalCode" in body, false);
    assert.equal("locality" in body, false);
  });

  test("tampoco filtra esos datos aunque vengan en el origen", () => {
    // Aunque quien arme el objeto pase la fila completa de la base, el builder
    // sólo copia la lista blanca de campos.
    const body = buildPublicTrackingResponse(
      source({ postalCode: "1414", locality: "CABA", addressStreet: "Av. Corrientes" }),
      EVENTS
    );
    const leaked = Object.keys(body).filter((k) =>
      ["postalCode", "locality", "addressStreet", "customerEmail"].includes(k)
    );
    assert.deepEqual(leaked, []);
  });

  test("una lista de eventos vacía se devuelve como []", () => {
    const body = buildPublicTrackingResponse(source(), []);
    assert.deepEqual(body.events, []);
  });
});
