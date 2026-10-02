import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Pruebas de fuente para las correcciones criticas de produccion. No se ejecuta
// la ruta ni la server action (dependen de la DB/red), asi que se inspecciona el
// codigo real que llega al deploy para que las reglas no se pierdan en un refactor.

function readSource(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

const paymentRoute = stripComments(
  readSource("../src/app/api/mercadopago/payment/route.ts")
);
const adminActions = stripComments(
  readSource("../src/app/admin/actions.ts")
);
const assistantRoute = stripComments(
  readSource("../src/app/api/assistant/route.ts")
);
const envExample = readSource("../.env.example");

describe("payment route — guarda anti-doble-cobro", () => {
  test("corta si el pedido ya esta finalizado, antes de crear el pago", () => {
    assert.match(paymentRoute, /isOrderFinalized\(order\.status\)/);
  });

  test("responde 409 y no crea un pago nuevo", () => {
    const guardIndex = paymentRoute.indexOf("isOrderFinalized(order.status)");
    assert.notEqual(guardIndex, -1);
    assert.match(paymentRoute, /status:\s*409/);
    // El guard debe aparecer ANTES de createPayment.
    const createIndex = paymentRoute.indexOf("await createPayment(");
    assert.notEqual(createIndex, -1);
    assert.ok(
      guardIndex < createIndex,
      "el guard de pedido finalizado debe ir antes de createPayment"
    );
  });

  test("lee el status del pedido junto con el total", () => {
    assert.match(paymentRoute, /SELECT total, status FROM orders WHERE code = \?/);
  });
});

describe("admin actions — transacciones seguras en Turso remoto", () => {
  test("no usa executeMultiple(BEGIN/COMMIT/ROLLBACK)", () => {
    assert.doesNotMatch(adminActions, /executeMultiple\(/);
  });

  test("las tres operaciones abren db.transaction(\"write\")", () => {
    const matches = adminActions.match(/db\.transaction\("write"\)/g) ?? [];
    assert.equal(matches.length, 3);
  });

  test("cada transaccion cierra con commit y protege con rollback", () => {
    const commits = adminActions.match(/await tx\.commit\(\)/g) ?? [];
    const rollbacks = adminActions.match(/await tx\.rollback\(\)/g) ?? [];
    assert.equal(commits.length, 3);
    assert.equal(rollbacks.length, 3);
  });
});

describe("assistant route — body robusto", () => {
  test("valida aromas y occasions con Array.isArray", () => {
    assert.match(assistantRoute, /Array\.isArray\(body\.aromas\)/);
    assert.match(assistantRoute, /Array\.isArray\(body\.occasions\)/);
  });

  test("intensity y budget degradan a string vacio", () => {
    assert.match(assistantRoute, /typeof body\.intensity === "string" \? body\.intensity : ""/);
    assert.match(assistantRoute, /typeof body\.budget === "string" \? body\.budget : ""/);
  });

  test("JSON invalido responde 400, no 500", () => {
    assert.match(assistantRoute, /await request\.json\(\)/);
    assert.match(assistantRoute, /status:\s*400/);
  });
});

describe(".env.example — nombres de variables correctos", () => {
  test("PAQ.AR usa PAQAR_API_KEY / PAQAR_AGREEMENT y no PAQAR_TOKEN", () => {
    assert.match(envExample, /^PAQAR_API_KEY=/m);
    assert.match(envExample, /^PAQAR_AGREEMENT=/m);
    assert.doesNotMatch(envExample, /^PAQAR_TOKEN=/m);
  });

  test("documenta el modo de prueba del checkout", () => {
    assert.match(envExample, /^CHECKOUT_TEST_MODE=/m);
  });
});
