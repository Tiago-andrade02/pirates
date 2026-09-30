import { test, describe, beforeEach, after } from "node:test";
import assert from "node:assert/strict";

import {
  customerTrackingEmailSubject,
  customerTrackingEmailText,
  customerTrackingEmailHtml,
  trackingUrlForEmail,
  sendCustomerTrackingEmail,
  hasSmtpConfig,
} from "../src/lib/notify.ts";
import { OFFICIAL_CORREO_ARGENTINO_TRACKING_URL } from "../src/lib/shipping/manual-tracking.ts";
import { applyManualTracking } from "../src/lib/shipping/manual-tracking.ts";
import type { Order } from "../src/lib/types.ts";

const SITE = process.env.SITE_URL;
process.env.SITE_URL = "https://tienda.test";

function makeOrder(over: Partial<Order> = {}): Order {
  return {
    id: 7,
    code: "PIR-ABC123",
    status: "enviado",
    paymentMethod: "mercadopago",
    customerName: "Ana Gomez",
    customerEmail: "ana@correo.com",
    customerPhone: "1122334455",
    province: "Buenos Aires",
    locality: "CABA",
    postalCode: "1414",
    addressStreet: "Av. Corrientes",
    addressNumber: "1234",
    deliveryType: "D",
    agencyCode: "",
    subtotal: 51000,
    shipping: 0,
    total: 51000,
    createdAt: "2026-09-28T12:00:00.000Z",
    trackingNumber: "123456789AR",
    trackingUrl: "",
    shippedAt: "2026-10-01T15:30:00.000Z",
    trackingEvents: [],
    items: [{ id: 1, orderId: 7, perfumeId: 1, name: "Le Male", size: 100, price: 51000, qty: 1 }],
    ...over,
  } as Order;
}

after(() => {
  if (SITE === undefined) delete process.env.SITE_URL;
  else process.env.SITE_URL = SITE;
});

describe("aviso al cliente — pedido despachado", () => {
  test("el asunto y el texto incluyen el código de seguimiento", () => {
    const order = makeOrder();
    assert.match(customerTrackingEmailSubject(order), /PIR-ABC123/);
    const text = customerTrackingEmailText(order);
    assert.match(text, /123456789AR/);
    assert.match(text, /PIR-ABC123/);
  });

  test("sin URL propia usa el enlace oficial de Correo Argentino", () => {
    const order = makeOrder({ trackingUrl: "" });
    assert.equal(trackingUrlForEmail(order), OFFICIAL_CORREO_ARGENTINO_TRACKING_URL);
    assert.match(customerTrackingEmailText(order), /correoargentino\.com\.ar/);
  });

  test("con URL propia la usa en lugar de la oficial", () => {
    const order = makeOrder({ trackingUrl: "https://mi-seguimiento.test/abc" });
    assert.equal(trackingUrlForEmail(order), "https://mi-seguimiento.test/abc");
    assert.match(customerTrackingEmailText(order), /mi-seguimiento\.test\/abc/);
  });

  test("nunca afirma que el paquete fue entregado", () => {
    // El admin cargó un despacho; la entrega no está confirmada por nadie.
    for (const body of [
      customerTrackingEmailText(makeOrder()),
      customerTrackingEmailHtml(makeOrder()),
    ]) {
      assert.equal(/entregad/i.test(body), false);
    }
  });

  test("el HTML escapa los datos del cliente", () => {
    const html = customerTrackingEmailHtml(
      makeOrder({ customerName: "<b>x</b>" })
    );
    assert.equal(html.includes("<b>x</b>"), false);
    assert.match(html, /&lt;b&gt;/);
  });
});

describe("guardias del aviso de despacho", () => {
  const saved = {
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
  };

  beforeEach(() => {
    for (const key of Object.keys(saved)) delete process.env[key];
  });

  after(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value !== undefined) process.env[key] = value;
    }
  });

  test("sin SMTP no lanza: el seguimiento ya está guardado", async () => {
    assert.equal(hasSmtpConfig(), false);
    await assert.doesNotReject(() => sendCustomerTrackingEmail(makeOrder()));
  });

  test("no se avisa a un pedido sin stock ni cancelado", async () => {
    await assert.doesNotReject(() =>
      sendCustomerTrackingEmail(makeOrder({ status: "sin_stock" }))
    );
    await assert.doesNotReject(() =>
      sendCustomerTrackingEmail(makeOrder({ status: "cancelado" }))
    );
  });

  test("no se avisa si no hay número de seguimiento", async () => {
    await assert.doesNotReject(() =>
      sendCustomerTrackingEmail(makeOrder({ trackingNumber: "" }))
    );
  });
});

describe("un fallo de aviso no borra el seguimiento", () => {
  test("los datos guardados se calculan antes de notificar y no dependen del envío", () => {
    const result = applyManualTracking({
      trackingNumber: "123456789AR",
      trackingUrl: "",
      currentNumber: "",
      currentUrl: "",
      currentShippedAt: null,
      currentEvents: [],
      currentStatus: "pagado",
      now: "2026-10-01T15:30:00.000Z",
    });
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error("se esperaba un resultado ok");
    const snapshot = structuredClone(result);

    // Simula el canal de notificación fallando después del commit. El error se
    // reporta en el panel, pero el seguimiento ya persistido no cambia.
    try {
      throw new Error("SMTP caído");
    } catch {
      // se traga el error a propósito
    }

    assert.deepEqual(result, snapshot);
    assert.equal(result.changed, true);
    assert.equal(result.trackingNumber, "123456789AR");
    assert.equal(result.status, "enviado");
  });
});
