import { test, describe, after } from "node:test";
import assert from "node:assert/strict";

import {
  ORDER_CONFIRM_WHATSAPP_TEMPLATE_VARS,
  orderConfirmationMessageParams,
  orderConfirmationMessageText,
} from "../src/lib/order-confirmation-message.ts";
import {
  orderConfirmTemplateName,
  hasWhatsAppOrderConfirmConfig,
  sendWhatsAppOrderConfirmation,
  customerEmailDelivered,
  customerWhatsappDelivered,
  notifyNewOrder,
} from "../src/lib/notify.ts";
import type { Order } from "../src/lib/types.ts";

const SITE = process.env.SITE_URL;
process.env.SITE_URL = "https://tienda.test";

function makeOrder(over: Partial<Order> = {}): Order {
  return {
    id: 12,
    code: "PIR-CONF1",
    status: "pagado",
    paymentMethod: "mercadopago",
    customerName: "Ana Gomez",
    customerEmail: "ana@correo.com",
    customerPhone: "+54 9 11 7291-9482",
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
    trackingNumber: "",
    trackingUrl: "",
    shippedAt: null,
    trackingEvents: [],
    items: [
      { name: "Le Male Elixir", size: 100, qty: 2, price: 25000 },
      { name: "Aventurier", size: 50, qty: 1, price: 1000 },
    ],
    ...over,
  } as Order;
}

interface GraphTemplateParameter {
  type: string;
  text: string;
}

interface GraphMessageBody {
  to: string;
  messaging_product: string;
  template: {
    name: string;
    components: Array<{ parameters: GraphTemplateParameter[] }>;
  };
}

interface CapturedRequest {
  url: string;
  body: GraphMessageBody;
}

// Reemplaza globalThis.fetch por un mock que captura cada request y NO llama a
// Meta: devuelve 200 siempre. Los tests de este archivo NUNCA tocan la red.
async function withFetchedCalls(
  fn: (requests: CapturedRequest[]) => Promise<void> | void
): Promise<void> {
  const original = globalThis.fetch;
  const requests: CapturedRequest[] = [];
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    requests.push({
      url: String(input),
      body: (init?.body ? JSON.parse(String(init.body)) : {}) as GraphMessageBody,
    });
    return new Response("ok", { status: 200 });
  }) as typeof fetch;
  try {
    await fn(requests);
  } finally {
    globalThis.fetch = original;
  }
}

after(() => {
  if (SITE === undefined) delete process.env.SITE_URL;
  else process.env.SITE_URL = SITE;
});

describe("mensaje de confirmación de compra — texto", () => {
  test("la plantilla de WhatsApp tiene 4 variables en orden estable", () => {
    assert.equal(ORDER_CONFIRM_WHATSAPP_TEMPLATE_VARS, 4);
  });

  test("params ordenados: nombre, pedido, total, enlace", () => {
    assert.deepEqual(
      orderConfirmationMessageParams({
        customerName: "Ana Gomez",
        code: "PIR-CONF1",
        total: 51000,
        link: "https://tienda.test/pedido/PIR-CONF1",
      }),
      {
        name: "Ana Gomez",
        code: "PIR-CONF1",
        amount: "$51.000",
        link: "https://tienda.test/pedido/PIR-CONF1",
      }
    );
  });

  test("sin nombre usa un saludo genérico y sin enlace no inventa URL", () => {
    const info = { customerName: "", code: "PIR-X", total: 5000, link: "" };
    assert.deepEqual(orderConfirmationMessageParams(info), {
      name: "cliente",
      code: "PIR-X",
      amount: "$5.000",
      link: "",
    });
    assert.equal(/undefined/.test(orderConfirmationMessageText(info)), false);
  });

  test("el texto usa el nombre de pila y confirma el pago", () => {
    const text = orderConfirmationMessageText({
      customerName: "Ana Gomez",
      code: "PIR-CONF1",
      total: 51000,
      link: "https://tienda.test/pedido/PIR-CONF1",
    });
    assert.match(text, /Ana/);
    assert.equal(text.includes("Gomez"), false);
    assert.match(text, /PIR-CONF1/);
    assert.match(text, /\$51\.000/);
    assert.match(text, /tienda\.test/);
  });
});

describe("confirmación por WhatsApp — guardias", () => {
  const saved = {
    WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN,
    WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
    WHATSAPP_TO: process.env.WHATSAPP_TO,
    WHATSAPP_ORDER_CONFIRM_TEMPLATE_NAME: process.env.WHATSAPP_ORDER_CONFIRM_TEMPLATE_NAME,
  };

  function clear() {
    for (const key of Object.keys(saved)) delete process.env[key];
  }

  function setConfig() {
    process.env.WHATSAPP_ACCESS_TOKEN = "token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123";
    process.env.WHATSAPP_TO = "5491100000000";
    process.env.WHATSAPP_ORDER_CONFIRM_TEMPLATE_NAME = "confirmacion_compra_pirates";
  }

  after(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value !== undefined) process.env[key] = value;
    }
  });

  test("sin config no lanza y no queda listo el canal", async () => {
    clear();
    assert.equal(hasWhatsAppOrderConfirmConfig(), false);
    assert.equal(orderConfirmTemplateName(), "");
    await assert.doesNotReject(() => sendWhatsAppOrderConfirmation(makeOrder()));
  });

  test("con config de WhatsApp pero sin la plantilla de confirmación no queda listo", async () => {
    clear();
    process.env.WHATSAPP_ACCESS_TOKEN = "token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123";
    process.env.WHATSAPP_TO = "5491100000000";
    assert.equal(hasWhatsAppOrderConfirmConfig(), false);
    // No se llama a la API (no hay plantilla): solo omite.
    await assert.doesNotReject(() => sendWhatsAppOrderConfirmation(makeOrder()));
  });

  test("con la plantilla de confirmación el canal automático queda habilitado", () => {
    clear();
    setConfig();
    assert.equal(hasWhatsAppOrderConfirmConfig(), true);
    assert.equal(orderConfirmTemplateName(), "confirmacion_compra_pirates");
  });

  test("sin teléfono válido no se envía (no llama a la API)", async () => {
    clear();
    setConfig();
    await withFetchedCalls(async (requests) => {
      await sendWhatsAppOrderConfirmation(makeOrder({ customerPhone: "" }));
      assert.equal(requests.length, 0);
    });
  });

  test("un pedido NO pagado nunca recibe la confirmación (no llama a la API)", async () => {
    clear();
    setConfig();
    for (const status of ["pendiente", "cancelado", "sin_stock"] as const) {
      await withFetchedCalls(async (requests) => {
        await sendWhatsAppOrderConfirmation(makeOrder({ status }));
        assert.equal(requests.length, 0, `status ${status} no debía enviar`);
      });
    }
  });
});

describe("confirmación por WhatsApp — request a Graph API", () => {
  function setConfig() {
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.WHATSAPP_TO;
    delete process.env.WHATSAPP_ORDER_CONFIRM_TEMPLATE_NAME;
    process.env.WHATSAPP_ACCESS_TOKEN = "token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123";
    process.env.WHATSAPP_TO = "5491100000000";
    process.env.WHATSAPP_ORDER_CONFIRM_TEMPLATE_NAME = "confirmacion_compra_pirates";
  }

  after(() => {
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.WHATSAPP_TO;
    delete process.env.WHATSAPP_ORDER_CONFIRM_TEMPLATE_NAME;
  });

  test("arma el POST con la plantilla, el teléfono del cliente y las 4 variables", async () => {
    setConfig();
    await withFetchedCalls(async (requests) => {
      await sendWhatsAppOrderConfirmation(makeOrder());
      assert.equal(requests.length, 1);
      const { url, body } = requests[0];
      assert.equal(url, "https://graph.facebook.com/v22.0/123/messages");
      assert.equal(body.to, "5491172919482");
      assert.equal(body.template.name, "confirmacion_compra_pirates");
      const params = body.template.components[0].parameters;
      assert.equal(params.length, 4);
      assert.deepEqual(
        params.map((p: GraphTemplateParameter) => p.text),
        ["Ana Gomez", "PIR-CONF1", "$51.000", "https://tienda.test/pedido/PIR-CONF1"]
      );
    });
  });
});

describe("notifyNewOrder — la confirmación por WhatsApp viaja con el plan", () => {
  function setConfig() {
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.WHATSAPP_TO;
    delete process.env.WHATSAPP_ORDER_CONFIRM_TEMPLATE_NAME;
    process.env.WHATSAPP_ACCESS_TOKEN = "token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123";
    process.env.WHATSAPP_TO = "5491100000000";
    process.env.WHATSAPP_ORDER_CONFIRM_TEMPLATE_NAME = "confirmacion_compra_pirates";
  }

  after(() => {
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.WHATSAPP_TO;
    delete process.env.WHATSAPP_ORDER_CONFIRM_TEMPLATE_NAME;
  });

  test("pedido pagado con customerWhatsapp: envía la plantilla de confirmación", async () => {
    setConfig();
    await withFetchedCalls(async (requests) => {
      await notifyNewOrder(makeOrder(), {
        adminNewOrder: false,
        adminStockAlert: false,
        customerEmail: false,
        customerWhatsapp: true,
      });
      const wa = requests.filter((r) => r.url.includes("graph.facebook.com"));
      assert.equal(wa.length, 1);
      const body = wa[0].body;
      assert.equal(body.to, "5491172919482");
      assert.equal(body.template.name, "confirmacion_compra_pirates");
      const params = body.template.components[0].parameters;
      assert.equal(params.length, 4);
      assert.deepEqual(
        params.map((p: GraphTemplateParameter) => p.text),
        ["Ana Gomez", "PIR-CONF1", "$51.000", "https://tienda.test/pedido/PIR-CONF1"]
      );
    });
  });

  test("sin canales al cliente (fase ya reclamada) NO se envía nada", async () => {
    setConfig();
    await withFetchedCalls(async (requests) => {
      await notifyNewOrder(makeOrder(), {
        adminNewOrder: false,
        adminStockAlert: false,
        customerEmail: false,
        customerWhatsapp: false,
      });
      assert.equal(requests.length, 0);
    });
  });
});

describe("notifyNewOrder — email y WhatsApp al cliente son intentos independientes", () => {
  // Los envios del comprador se inyectan: NO se toca SMTP ni la red. `attempts:
  // 1` evita los backoff de reintento para que el test sea rapido.
  function plan() {
    return {
      adminNewOrder: false,
      adminStockAlert: false,
      customerEmail: true,
      customerWhatsapp: true,
    };
  }

  test("si el email falla, el WhatsApp se intenta igual", async () => {
    let whatsappSent = 0;
    const results = await notifyNewOrder(makeOrder(), plan(), {
      attempts: 1,
      senders: {
        customerEmail: async () => {
          throw new Error("SMTP caído");
        },
        customerWhatsapp: async () => {
          whatsappSent++;
          return true;
        },
      },
    });
    assert.equal(whatsappSent, 1, "el WhatsApp debía intentarse aunque el email falle");
    assert.deepEqual(
      results.map((r) => `${r.channel}:${r.ok}`).sort(),
      ["cliente-email:false", "cliente-whatsapp:true"]
    );
  });

  test("si el WhatsApp falla, el email se intenta y el pedido sigue pagado", async () => {
    let emailSent = 0;
    const order = makeOrder();
    const results = await notifyNewOrder(order, plan(), {
      attempts: 1,
      senders: {
        customerEmail: async () => {
          emailSent++;
          return true;
        },
        customerWhatsapp: async () => {
          throw new Error("Graph API 500");
        },
      },
    });
    assert.equal(emailSent, 1, "el email debía intentarse aunque el WhatsApp falle");
    assert.equal(order.status, "pagado", "una falla de WhatsApp no revierte el pago");
    assert.deepEqual(
      results.map((r) => `${r.channel}:${r.ok}`).sort(),
      ["cliente-email:true", "cliente-whatsapp:false"]
    );
  });

  test("si ambos funcionan, cada uno se intenta una vez", async () => {
    let email = 0;
    let whatsapp = 0;
    const results = await notifyNewOrder(makeOrder(), plan(), {
      attempts: 1,
      senders: {
        customerEmail: async () => {
          email++;
          return true;
        },
        customerWhatsapp: async () => {
          whatsapp++;
          return true;
        },
      },
    });
    assert.equal(email, 1);
    assert.equal(whatsapp, 1);
    assert.equal(results.every((r) => r.ok), true);
  });

  test("un pedido no pagado no dispara ninguno de los dos canales", async () => {
    let called = 0;
    await notifyNewOrder(makeOrder({ status: "pendiente" }), plan(), {
      attempts: 1,
      senders: {
        customerEmail: async () => {
          called++;
          return true;
        },
        customerWhatsapp: async () => {
          called++;
          return true;
        },
      },
    });
    assert.equal(called, 0);
  });

  test("un canal omitido (skip) NO se reintenta y queda ok pero no sent", async () => {
    // El sender devuelve false = omitido (sin config / sin contacto). Reintentar
    // una omisión no cambia nada: debe llamarse una sola vez y no ser un fallo.
    let emailCalls = 0;
    const results = await notifyNewOrder(makeOrder(), plan(), {
      attempts: 3,
      senders: {
        customerEmail: async () => {
          emailCalls++;
          return false;
        },
        customerWhatsapp: async () => true,
      },
    });
    assert.equal(emailCalls, 1, "un skip no debe reintentarse");
    const email = results.find((r) => r.channel === "cliente-email");
    assert.equal(email?.ok, true, "un skip no es un fallo");
    assert.equal(email?.sent, false, "un skip no marca el canal como enviado");
  });

  test("una falla temporal se reintenta y termina enviando", async () => {
    let emailCalls = 0;
    const results = await notifyNewOrder(makeOrder(), plan(), {
      attempts: 2,
      senders: {
        customerEmail: async () => {
          emailCalls++;
          if (emailCalls === 1) throw new Error("SMTP transitorio");
          return true;
        },
        customerWhatsapp: async () => true,
      },
    });
    assert.equal(emailCalls, 2, "debía reintentar tras la falla transitoria");
    const email = results.find((r) => r.channel === "cliente-email");
    assert.equal(email?.ok, true);
    assert.equal(email?.sent, true);
  });
});

describe("customerEmailDelivered — solo marca el email si el proveedor lo confirmó", () => {
  test("un skip o un fallo NO cuentan como entregado", () => {
    assert.equal(
      customerEmailDelivered([{ channel: "cliente-email", ok: true, sent: false }]),
      false,
      "un skip (ok pero no sent) no marca el canal"
    );
    assert.equal(
      customerEmailDelivered([{ channel: "cliente-email", ok: false, sent: false }]),
      false
    );
  });

  test("el email confirmado queda entregado", () => {
    assert.equal(
      customerEmailDelivered([{ channel: "cliente-email", ok: true, sent: true }]),
      true
    );
  });

  test("no se confunde con el WhatsApp ni con un canal del admin", () => {
    assert.equal(
      customerEmailDelivered([
        { channel: "cliente-whatsapp", ok: true, sent: true },
        { channel: "email", ok: true, sent: true },
      ]),
      false
    );
  });
});

describe("customerWhatsappDelivered — independiente del email", () => {
  test("un exito parcial marca solo el WhatsApp", () => {
    const results = [
      { channel: "cliente-email", ok: true, sent: false },
      { channel: "cliente-whatsapp", ok: true, sent: true },
    ];
    assert.equal(customerEmailDelivered(results), false);
    assert.equal(customerWhatsappDelivered(results), true);
  });

  test("un fallo del WhatsApp no queda entregado", () => {
    assert.equal(
      customerWhatsappDelivered([{ channel: "cliente-whatsapp", ok: false, sent: false }]),
      false
    );
  });
});

describe("confirmación por WhatsApp — el proveedor no confirmó el envío", () => {
  test("si Graph API responde non-2xx, el envío lanza y no se reporta éxito", async () => {
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.WHATSAPP_TO;
    delete process.env.WHATSAPP_ORDER_CONFIRM_TEMPLATE_NAME;
    process.env.WHATSAPP_ACCESS_TOKEN = "token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123";
    process.env.WHATSAPP_TO = "5491100000000";
    process.env.WHATSAPP_ORDER_CONFIRM_TEMPLATE_NAME = "confirmacion_compra_pirates";

    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response("no", { status: 500 })) as typeof fetch;
    try {
      await assert.rejects(
        () => sendWhatsAppOrderConfirmation(makeOrder()),
        /order confirm error/
      );
    } finally {
      globalThis.fetch = original;
      delete process.env.WHATSAPP_ACCESS_TOKEN;
      delete process.env.WHATSAPP_PHONE_NUMBER_ID;
      delete process.env.WHATSAPP_TO;
      delete process.env.WHATSAPP_ORDER_CONFIRM_TEMPLATE_NAME;
    }
  });
});