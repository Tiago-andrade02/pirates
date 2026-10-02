import { test, describe, after } from "node:test";
import assert from "node:assert/strict";

import {
  DISPATCH_WHATSAPP_TEMPLATE_VARS,
  dispatchMessageParams,
  dispatchMessageText,
  normalizeWhatsAppPhone,
  waMeLink,
} from "../src/lib/shipping/dispatch-message.ts";
import {
  dispatchTemplateName,
  hasWhatsAppDispatchConfig,
  sendWhatsAppDispatchNotification,
} from "../src/lib/notify.ts";
import type { Order } from "../src/lib/types.ts";

function makeOrder(over: Partial<Order> = {}): Order {
  return {
    id: 9,
    code: "PIR-DSP001",
    status: "enviado",
    paymentMethod: "mercadopago",
    customerName: "Juan Perez",
    customerEmail: "juan@correo.com",
    customerPhone: "+54 9 11 7291-9482",
    province: "Buenos Aires",
    locality: "CABA",
    postalCode: "1414",
    addressStreet: "Av. Corrientes",
    addressNumber: "1234",
    deliveryType: "D",
    agencyCode: "",
    subtotal: 30000,
    shipping: 0,
    total: 30000,
    createdAt: "2026-09-28T12:00:00.000Z",
    trackingNumber: "123456789AR",
    trackingUrl: "",
    shippedAt: "2026-10-01T15:30:00.000Z",
    trackingEvents: [],
    items: [],
    ...over,
  } as Order;
}

describe("mensaje de despacho — texto", () => {
  test("la plantilla de WhatsApp tiene 4 variables en orden estable", () => {
    assert.equal(DISPATCH_WHATSAPP_TEMPLATE_VARS, 4);
  });

  test("incluye nombre de pila, pedido, seguimiento y enlace", () => {
    const text = dispatchMessageText({
      customerName: "Juan Perez",
      code: "PIR-DSP001",
      trackingNumber: "123456789AR",
      trackingUrl: "https://correoargentino.com.ar/seguimiento",
    });
    assert.match(text, /Juan/);
    assert.equal(text.includes("Perez"), false);
    assert.match(text, /PIR-DSP001/);
    assert.match(text, /123456789AR/);
    assert.match(text, /correoargentino\.com\.ar/);
  });

  test("sin seguimiento no inventa un código", () => {
    const text = dispatchMessageText({
      customerName: "Ana",
      code: "PIR-X",
      trackingNumber: "",
      trackingUrl: "",
    });
    assert.equal(/seguimiento/i.test(text), false);
  });

  test("params ordenados: nombre, pedido, seguimiento, enlace", () => {
    const p = dispatchMessageParams({
      customerName: "",
      code: "PIR-X",
      trackingNumber: "T1",
      trackingUrl: "U1",
    });
    assert.deepEqual(p, { name: "cliente", code: "PIR-X", tracking: "T1", link: "U1" });
  });
});

describe("teléfono WhatsApp", () => {
  test("normaliza un celular argentino con formato local", () => {
    assert.equal(normalizeWhatsAppPhone("11 7291-9482"), "5491172919482");
    assert.equal(normalizeWhatsAppPhone("011 7291 9482"), "5491172919482");
    assert.equal(normalizeWhatsAppPhone("+54 9 11 7291-9482"), "5491172919482");
  });

  test("rechaza entradas vacías o sin dígitos", () => {
    assert.equal(normalizeWhatsAppPhone(""), "");
    assert.equal(normalizeWhatsAppPhone("sin numero"), "");
    assert.equal(normalizeWhatsAppPhone(undefined), "");
    assert.equal(normalizeWhatsAppPhone("123"), "");
  });

  test("wa.me codifica el texto y exige un teléfono válido", () => {
    assert.equal(
      waMeLink("11 7291 9482", "hola mundo"),
      "https://wa.me/5491172919482?text=hola%20mundo"
    );
    assert.equal(waMeLink("", "hola"), null);
  });
});

describe("aviso de despacho por WhatsApp — guardias", () => {
  const saved = {
    WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN,
    WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
    WHATSAPP_TO: process.env.WHATSAPP_TO,
    WHATSAPP_DISPATCH_TEMPLATE_NAME: process.env.WHATSAPP_DISPATCH_TEMPLATE_NAME,
  };

  function clear() {
    for (const key of Object.keys(saved)) delete process.env[key];
  }

  after(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value !== undefined) process.env[key] = value;
    }
  });

  test("sin config no lanza y no requiere plantilla", async () => {
    clear();
    assert.equal(hasWhatsAppDispatchConfig(), false);
    assert.equal(dispatchTemplateName(), "");
    await assert.doesNotReject(() => sendWhatsAppDispatchNotification(makeOrder()));
  });

  test("con config de WhatsApp pero sin plantilla de despacho no queda listo", async () => {
    clear();
    process.env.WHATSAPP_ACCESS_TOKEN = "token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123";
    process.env.WHATSAPP_TO = "5491100000000";
    assert.equal(hasWhatsAppDispatchConfig(), false);
    // No se llama a la API (no hay plantilla): solo omite.
    await assert.doesNotReject(() => sendWhatsAppDispatchNotification(makeOrder()));
  });

  test("con plantilla de despacho el canal automático queda habilitado", () => {
    clear();
    process.env.WHATSAPP_ACCESS_TOKEN = "token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123";
    process.env.WHATSAPP_TO = "5491100000000";
    process.env.WHATSAPP_DISPATCH_TEMPLATE_NAME = "despacho_pirates";
    assert.equal(hasWhatsAppDispatchConfig(), true);
    assert.equal(dispatchTemplateName(), "despacho_pirates");
  });

  test("sin teléfono válido no se envía (no llama a la API)", async () => {
    clear();
    process.env.WHATSAPP_ACCESS_TOKEN = "token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123";
    process.env.WHATSAPP_TO = "5491100000000";
    process.env.WHATSAPP_DISPATCH_TEMPLATE_NAME = "despacho_pirates";
    await assert.doesNotReject(() =>
      sendWhatsAppDispatchNotification(makeOrder({ customerPhone: "" }))
    );
  });
});
