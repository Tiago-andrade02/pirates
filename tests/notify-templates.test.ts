import { test, describe, beforeEach, after } from "node:test";
import assert from "node:assert/strict";

import {
  canNotifyCustomer,
  customerOrderEmailSubject,
  customerOrderEmailText,
  customerOrderEmailHtml,
  orderEmailText,
  orderEmailHtml,
  stockAlertSubject,
  stockAlertText,
  stockAlertHtml,
  customerOrderUrl,
  orderUrl,
  sendCustomerOrderEmail,
  hasSmtpConfig,
  sendOrderEmail,
  sendStockAlertEmail,
} from "../src/lib/notify.ts";
import type { Order } from "../src/lib/types.ts";

const SITE = process.env.SITE_URL;
process.env.SITE_URL = "https://tienda.test";

function makeOrder(over: Partial<Order> = {}): Order {
  return {
    id: 7,
    code: "PIR-ABC123",
    status: "pagado",
    paymentMethod: "mercadopago",
    customerName: "Ana Gomez",
    customerEmail: "ana@correo.com",
    customerPhone: "1122334455",
    province: "Buenos Aires",
    locality: "CABA",
    postalCode: "1414",
    addressStreet: "Av. Corrientes",
    addressNumber: "1234",
    deliveryType: "S",
    agencyCode: "SCBA1",
    // 2 x 25.000 + 1 x 1.000 = 51.000
    subtotal: 51000,
    shipping: 0,
    total: 51000,
    createdAt: "2026-09-28T12:00:00.000Z",
    items: [
      { name: "Le Male Elixir", size: 100, qty: 2, price: 25000 },
      { name: "Aventurier", size: 50, qty: 1, price: 1000 },
    ],
    ...over,
  } as Order;
}

after(() => {
  if (SITE === undefined) delete process.env.SITE_URL;
  else process.env.SITE_URL = SITE;
});

describe("enlaces al pedido", () => {
  test("el enlace del admin y el del cliente son distintos", () => {
    const order = makeOrder();
    // El link del cliente no puede exponer el panel de administracion.
    assert.equal(orderUrl(order), "https://tienda.test/admin/pedidos/7");
    assert.equal(customerOrderUrl(order), "https://tienda.test/pedido/PIR-ABC123");
  });

  test("sin SITE_URL no se inventa un dominio", () => {
    delete process.env.SITE_URL;
    const order = makeOrder();
    assert.equal(orderUrl(order), "");
    assert.equal(customerOrderUrl(order), "");
    // Y el cuerpo del correo no debe quedar con un link roto ni con "undefined".
    assert.equal(/undefined/.test(customerOrderEmailText(order)), false);
    assert.equal(/undefined/.test(stockAlertText(order)), false);
  });

  test("SITE_URL con barra final no duplica la barra", () => {
    process.env.SITE_URL = "https://tienda.test/";
    assert.equal(orderUrl(makeOrder()), "https://tienda.test/admin/pedidos/7");
  });
});

describe("email al admin — pedido pagado", () => {
  test("incluye estado y medio de pago, que antes faltaban", () => {
    const text = orderEmailText(makeOrder());
    assert.match(text, /Estado: Pagado/);
    assert.match(text, /Medio de pago: Mercado Pago/);
  });

  test("el HTML incluye estado y medio de pago", () => {
    const html = orderEmailHtml(makeOrder());
    assert.match(html, /Estado/);
    assert.match(html, /Medio de pago/);
    assert.match(html, /Mercado Pago/);
  });

  test("lista los productos con cantidad y total", () => {
    const text = orderEmailText(makeOrder());
    assert.match(text, /Le Male Elixir — 100 ml x2 {2}→ {2}\$50\.000/);
    // El total es la suma de las lineas, no un numero suelto.
    assert.match(text, /TOTAL: \$51\.000/);
  });

  test("escapa HTML en los datos del cliente", () => {
    // Sin escape, un nombre con etiquetas se inyecta como HTML en el correo que
    // lee el admin.
    const html = orderEmailHtml(
      makeOrder({ customerName: "<img src=x onerror=alert(1)>" })
    );
    assert.equal(html.includes("<img src=x"), false);
    assert.match(html, /&lt;img src=x/);
  });
});

describe("alerta sin stock", () => {
  const sinStock = makeOrder({ status: "sin_stock" });

  test("el asunto marca urgencia y el motivo", () => {
    assert.match(stockAlertSubject(sinStock), /URGENTE/);
    assert.match(stockAlertSubject(sinStock), /SIN STOCK/);
    assert.match(stockAlertSubject(sinStock), /PIR-ABC123/);
  });

  test("el texto aclara que el pago se cobró y que hay que resolverlo", () => {
    const text = stockAlertText(sinStock);
    assert.match(text, /Importe cobrado: \$51\.000/);
    assert.match(text, /Estado: Sin stock/);
    // El dato clave: la plata entro y hay que devolverla o canjearla.
    assert.match(text, /El pago fue cobrado y el pedido no se puede cumplir/);
  });

  test("el HTML avisa en un bloque destacado", () => {
    const html = stockAlertHtml(sinStock);
    assert.match(html, /URGENTE: pedido cobrado sin stock/);
    assert.match(html, /Importe cobrado/);
  });

  test("la alerta nunca se presenta como una orden normal", () => {
    const text = stockAlertText(sinStock);
    assert.equal(/Nueva orden/i.test(text), false);
  });
});

describe("email al cliente — solo pagado", () => {
  test("confirma el pago e incluye los datos de la compra", () => {
    const order = makeOrder();
    assert.match(customerOrderEmailSubject(order), /Confirmación de tu compra/);
    const text = customerOrderEmailText(order);
    assert.match(text, /Hola Ana Gomez/);
    assert.match(text, /Recibimos tu pago/);
    assert.match(text, /Código de pedido: PIR-ABC123/);
    assert.match(text, /TOTAL: \$51\.000/);
  });

  test("el HTML confirma el pago", () => {
    assert.match(customerOrderEmailHtml(makeOrder()), /Recibimos tu pago/);
  });

  test("canNotifyCustomer acepta un email válido", () => {
    assert.equal(canNotifyCustomer(makeOrder()), true);
  });

  test("canNotifyCustomer rechaza email ausente o inválido", () => {
    // "x@" o "@x" no son entregables: antes el unico filtro era que tuviera
    // "@", asi que un envio a esa direccion fallaba en el servidor SMTP.
    assert.equal(canNotifyCustomer(makeOrder({ customerEmail: null })), false);
    assert.equal(canNotifyCustomer(makeOrder({ customerEmail: "" })), false);
    assert.equal(canNotifyCustomer(makeOrder({ customerEmail: "x@" })), false);
    assert.equal(canNotifyCustomer(makeOrder({ customerEmail: "@x" })), false);
    assert.equal(canNotifyCustomer(makeOrder({ customerEmail: "a@b.co" })), true);
  });
});

describe("envio sin configuracion — no rompe el pedido", () => {
  const saved = {
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    ORDER_NOTIFY_TO: process.env.ORDER_NOTIFY_TO,
  };

  beforeEach(() => {
    for (const key of Object.keys(saved)) delete process.env[key];
  });

  after(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value !== undefined) process.env[key] = value;
    }
  });

  test("sin SMTP el envio no lanza (el pago ya esta confirmado)", () => {
    // Este es el caso que antes se perdia en silencio: el aviso no sale, pero la
    // compra del cliente NO puede revertirse ni quedar colgada.
    assert.equal(hasSmtpConfig(), false);
  });

  test("sin SMTP no se lanza excepcion en ningun canal de email", async () => {
    const order = makeOrder();
    await assert.doesNotReject(() => sendOrderEmail(order));
    await assert.doesNotReject(() => sendStockAlertEmail(order));
    await assert.doesNotReject(() => sendCustomerOrderEmail(order));
  });
});

describe("guardia del email al cliente", () => {
  test("no se envía a un pedido sin stock aunque se lo pidan", async () => {
    // El texto dice "Recibimos tu pago": mandarlo a un pedido sin stock seria
    // confirmarle al comprador una compra que no se puede preparar.
    const order = makeOrder({ status: "sin_stock" });
    await assert.doesNotReject(() => sendCustomerOrderEmail(order));
  });
});
