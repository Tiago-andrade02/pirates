import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  ADMIN_ORDER_WHATSAPP_TEMPLATE_VARS,
  adminOrderMessageParams,
  adminOrderMessageText,
  orderAddressLine,
} from "../src/lib/order-message.ts";
import type { Order } from "../src/lib/types.ts";

function makeOrder(over: Partial<Order> = {}): Order {
  return {
    id: 42,
    code: "PIR-A1B2C3",
    status: "pagado",
    paymentMethod: "mercadopago",
    customerName: "Juan Perez",
    customerEmail: "juan@correo.com",
    customerPhone: "+54 9 11 7291-9482",
    province: "Buenos Aires",
    locality: "Monte Grande",
    postalCode: "1704",
    addressStreet: "Av. Corrientes",
    addressNumber: "1234",
    addressFloor: "",
    addressApartment: "",
    deliveryType: "D",
    agencyCode: "",
    preferredBranch: "",
    customerNotes: "",
    items: [
      {
        perfumeId: 1,
        name: "Marea Sauvage",
        size: "100",
        slug: "marea-sauvage",
        qty: 2,
        price: 15000,
      },
    ],
    subtotal: 30000,
    shipping: 0,
    total: 30000,
    createdAt: "2026-10-01T12:00:00.000Z",
    trackingNumber: "",
    trackingUrl: "",
    shippedAt: null,
    ...over,
  } as Order;
}

describe("aviso de nuevo pedido — cantidad de variables", () => {
  test("la plantilla usa 5 variables posicionales, no una por dato", () => {
    assert.equal(ADMIN_ORDER_WHATSAPP_TEMPLATE_VARS, 5);
  });

  test("los parámetros salen en el mismo orden que las variables", () => {
    const p = adminOrderMessageParams(makeOrder());
    assert.deepEqual(Object.keys(p), [
      "customer",
      "contact",
      "order",
      "shipping",
      "notes",
    ]);
  });
});

describe("aviso de nuevo pedido — contenido", () => {
  test("lleva todos los datos que pidió el negocio", () => {
    const text = adminOrderMessageText(
      makeOrder({ customerNotes: "Entregar por la tarde" })
    );
    // Cliente y contacto
    assert.match(text, /Juan Perez/);
    assert.match(text, /\+54 9 11 7291-9482/);
    assert.match(text, /juan@correo\.com/);
    // Pedido
    assert.match(text, /PIR-A1B2C3/);
    assert.match(text, /Marea Sauvage/);
    assert.match(text, /x2/);
    assert.match(text, /\$30\.000/);
    // Envío
    assert.match(text, /Envío a domicilio/);
    assert.match(text, /1704/);
    assert.match(text, /Monte Grande/);
    assert.match(text, /Av\. Corrientes 1234/);
    // Observaciones
    assert.match(text, /Entregar por la tarde/);
  });

  test("el precio unitario y el subtotal por línea van juntos", () => {
    const p = adminOrderMessageParams(makeOrder());
    assert.match(p.order, /\$30\.000 \(\$15\.000 c\/u\)/);
  });

  test("incluye el envío como 0 cuando es gratis", () => {
    const p = adminOrderMessageParams(makeOrder());
    assert.match(p.order, /envio \$0/);
  });

  test("un campo vacío nunca queda en blanco: va un guion", () => {
    // WhatsApp rechaza el envío entero si un parámetro viene vacío.
    const p = adminOrderMessageParams(
      makeOrder({ customerEmail: "", addressStreet: "", addressNumber: "" })
    );
    for (const value of Object.values(p)) {
      assert.doesNotMatch(value, /:\s*$/m);
      assert.notEqual(value.trim(), "");
    }
    assert.match(p.contact, /Email: -/);
  });

  test("sin productos no rompe el bloque", () => {
    const p = adminOrderMessageParams(makeOrder({ items: [] }));
    assert.match(p.order, /sin productos/);
  });
});

describe("aviso de nuevo pedido — modalidad sucursal", () => {
  const branchOrder = makeOrder({
    deliveryType: "S",
    addressStreet: "",
    addressNumber: "",
    preferredBranch: "Sucursal Monte Grande",
  });

  test("muestra la modalidad y la sucursal preferida", () => {
    const p = adminOrderMessageParams(branchOrder);
    assert.match(p.shipping, /sucursal de Correo Argentino/i);
    assert.match(p.shipping, /Sucursal preferida: Sucursal Monte Grande/);
  });

  test("no inventa una dirección cuando el cliente no escribió ninguna", () => {
    const p = adminOrderMessageParams(branchOrder);
    assert.doesNotMatch(p.shipping, /Dirección/);
    // Igual conserva el destino: sin CP/localidad no hay sucursal posible.
    assert.match(p.shipping, /CP: 1704/);
    assert.match(p.shipping, /Monte Grande/);
  });

  test("distingue 'no escribió' de 'no la conocemos'", () => {
    const p = adminOrderMessageParams(makeOrder({ deliveryType: "S" }));
    assert.match(p.shipping, /no escribió ninguna/);
  });
});

describe("aviso de nuevo pedido — dirección", () => {
  test("incluye piso y departamento cuando están", () => {
    assert.equal(
      orderAddressLine(makeOrder({ addressFloor: "3", addressApartment: "D" })),
      "Av. Corrientes 1234, Piso 3, Dpto D"
    );
  });

  test("omite los que no están", () => {
    assert.equal(orderAddressLine(makeOrder()), "Av. Corrientes 1234");
  });
});

describe("aviso de nuevo pedido — límites", () => {
  test("un bloque largo se recorta en vez de romper el envío", () => {
    const p = adminOrderMessageParams(
      makeOrder({ customerNotes: "x".repeat(2000) })
    );
    assert.ok(p.notes.length <= 900, `notes quedó en ${p.notes.length}`);
    assert.match(p.notes, /\.\.\.$/);
  });
});