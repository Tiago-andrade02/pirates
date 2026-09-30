import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  resolvePaymentState,
  verifyOrderPayment,
  isAlreadyFinalized,
  EXPECTED_CURRENCY,
  type VerifyDeps,
  type PaymentSnapshot,
  type OrderSnapshot,
} from "../src/lib/payment-verify.ts";
import type { OrderStatus } from "../src/lib/types.ts";

const CODE = "PIR-3D9AD13CD672EF3";
const TOTAL = 45_000;

const order = (over: Partial<OrderSnapshot> = {}): OrderSnapshot => ({
  status: "pendiente" as OrderStatus,
  total: TOTAL,
  ...over,
});

const payment = (over: Partial<PaymentSnapshot> = {}): PaymentSnapshot => ({
  id: 123456789,
  status: "approved",
  external_reference: CODE,
  currency_id: "ARS",
  transaction_amount: TOTAL,
  ...over,
});

// Deps falsas que registran qué se llamó, para poder afirmar que NO se escribe
// nada cuando la validación falla.
function harness(options: {
  found?: PaymentSnapshot | null;
  order?: OrderSnapshot | null;
} = {}) {
  const calls: string[] = [];
  const deps: VerifyDeps = {
    fetchPayment: async (id) => {
      calls.push(`fetchPayment:${id}`);
      return options.found === undefined ? payment() : options.found;
    },
    loadOrder: async (code) => {
      calls.push(`loadOrder:${code}`);
      return options.order === undefined ? order() : options.order;
    },
    finalizeOrder: async (code) => {
      calls.push(`finalizeOrder:${code}`);
    },
    attachPayment: async (code, id) => {
      calls.push(`attachPayment:${code}:${id}`);
    },
  };
  return { deps, calls };
}

// Estados en los que el pedido ya no admite una nueva finalización. Se tipa
// explícitamente para que TypeScript no lo infiera como string[].
const FINALIZED: OrderStatus[] = [
  "pagado",
  "preparando",
  "enviado",
  "entregado",
  "sin_stock",
];

describe("resolvePaymentState — matriz de decisiones", () => {
  const base = {
    orderCode: CODE,
    orderStatus: "pendiente" as OrderStatus,
    orderTotal: TOTAL,
    mpAmount: TOTAL,
    mpCurrency: EXPECTED_CURRENCY,
    mpReference: CODE,
  };

  test("pago aprobado y validado → finaliza", () => {
    const r = resolvePaymentState({ ...base, mpStatus: "approved" });
    assert.equal(r.state, "approved");
    assert.equal(r.reason, "approved");
    assert.equal(r.shouldFinalize, true);
  });

  test("pago pendiente → NO finaliza, sin importar nada más", () => {
    for (const status of ["pending", "in_process", "authorized"]) {
      const r = resolvePaymentState({ ...base, mpStatus: status });
      assert.equal(r.state, "pending");
      assert.equal(r.shouldFinalize, false);
    }
  });

  test("pago rechazado/cancelado → NO finaliza", () => {
    for (const status of ["rejected", "cancelled", "failed"]) {
      const r = resolvePaymentState({ ...base, mpStatus: status });
      assert.equal(r.state, "rejected");
      assert.equal(r.shouldFinalize, false);
    }
  });

  test("estado ausente o desconocido → 'unknown' y NO finaliza", () => {
    for (const status of [null, "", "raro"]) {
      const r = resolvePaymentState({ ...base, mpStatus: status });
      assert.equal(r.state, "unknown");
      assert.equal(r.reason, "no_payment_info");
      assert.equal(r.shouldFinalize, false);
    }
  });

  test("importe incorrecto → NO finaliza", () => {
    const r = resolvePaymentState({ ...base, mpStatus: "approved", mpAmount: 1 });
    assert.equal(r.shouldFinalize, false);
    assert.equal(r.reason, "amount_mismatch");
  });

  test("diferencia de 1 centavo se tolera (ruido de float)", () => {
    const r = resolvePaymentState({ ...base, mpStatus: "approved", mpAmount: TOTAL - 0.01 });
    assert.equal(r.reason, "approved");
    assert.equal(r.shouldFinalize, true);
  });

  test("la tolerancia no se rompe con importes grandes y float representation", () => {
    // Regresión: comparar en floats con tolerancia 0.01 rechazaba de más,
    // porque `45000 - 0.01` vale 44999.990000000005 (difiere 0.0100000000058).
    // La comparación se hace en centavos justamente para esto.
    for (const total of [45000, 999999.99, 1234.56, 100000000]) {
      for (const delta of [0, 0.01, -0.01]) {
        const r = resolvePaymentState({
          ...base,
          mpStatus: "approved",
          orderTotal: total,
          mpAmount: total + delta,
        });
        assert.equal(
          r.reason,
          "approved",
          `total=${total} delta=${delta} debía tolerarse (dif=${Math.abs(total + delta - total)})`
        );
      }
    }
  });

  test("2 centavos de diferencia sí se rechazan", () => {
    const r = resolvePaymentState({ ...base, mpStatus: "approved", mpAmount: TOTAL - 0.02 });
    assert.equal(r.reason, "amount_mismatch");
    assert.equal(r.shouldFinalize, false);
  });

  test("importe no numérico → NO finaliza", () => {
    const r = resolvePaymentState({
      ...base,
      mpStatus: "approved",
      mpAmount: Number.NaN,
    });
    assert.equal(r.reason, "amount_invalid");
    assert.equal(r.shouldFinalize, false);
  });

  test("moneda distinta de ARS → NO finaliza", () => {
    for (const currency of ["USD", "BRL", "MXN"]) {
      const r = resolvePaymentState({ ...base, mpStatus: "approved", mpCurrency: currency });
      assert.equal(r.shouldFinalize, false, `no debería finalizar con ${currency}`);
      assert.equal(r.reason, "currency_mismatch");
    }
  });

  test("moneda ausente → NO finaliza", () => {
    const r = resolvePaymentState({ ...base, mpStatus: "approved", mpCurrency: null });
    assert.equal(r.shouldFinalize, false);
    assert.equal(r.reason, "currency_mismatch");
  });

  test("pedido inexistente → NO finaliza", () => {
    const r = resolvePaymentState({
      ...base,
      mpStatus: "approved",
      orderStatus: null,
      orderTotal: null,
    });
    assert.equal(r.shouldFinalize, false);
    assert.equal(r.reason, "order_not_found");
  });

  test("external_reference que no coincide → NO finaliza", () => {
    for (const reference of [null, "", "PIR-OTRO", " pir-otro"]) {
      const r = resolvePaymentState({ ...base, mpStatus: "approved", mpReference: reference });
      assert.equal(r.shouldFinalize, false);
      assert.equal(r.reason, "reference_mismatch");
    }
  });

  test("pedido ya pagado NO vuelve a finalizar (pago duplicado)", () => {
    for (const status of FINALIZED) {
      const r = resolvePaymentState({ ...base, mpStatus: "approved", orderStatus: status });
      assert.equal(r.shouldFinalize, false, `no debería finalizar de nuevo: ${status}`);
      assert.equal(r.reason, "approved");
    }
  });

  test("el orden de las validaciones corta en la primera falla", () => {
    // Importe y moneda mal Y referencia mal: manda la primera.
    const r = resolvePaymentState({
      ...base,
      mpStatus: "approved",
      mpAmount: 1,
      mpCurrency: "USD",
      mpReference: "PIR-OTRO",
    });
    assert.equal(r.reason, "reference_mismatch");
  });
});

describe("isAlreadyFinalized", () => {
  test("reconoce los estados finales del ciclo de vida del pedido", () => {
    for (const status of FINALIZED) {
      assert.equal(isAlreadyFinalized(status), true);
    }
  });

  test("un pedido pendiente o cancelado no está finalizado", () => {
    for (const status of ["pendiente", "cancelado"] as OrderStatus[]) {
      assert.equal(isAlreadyFinalized(status), false);
    }
    assert.equal(isAlreadyFinalized(null), false);
  });
});

describe("verifyOrderPayment — orquestación", () => {
  test("pago aprobado válido: consulta MP, finaliza y vincula", async () => {
    const { deps, calls } = harness();
    const r = await verifyOrderPayment(CODE, "123456789", deps);

    assert.equal(r.state, "approved");
    assert.equal(r.reason, "approved");
    assert.equal(r.finalized, true);
    assert.deepEqual(calls, [
      `loadOrder:${CODE}`,
      "fetchPayment:123456789",
      `finalizeOrder:${CODE}`,
      `attachPayment:${CODE}:123456789`,
    ]);
  });

  test("pago pendiente: NO escribe nada en la base", async () => {
    const { deps, calls } = harness({ found: payment({ status: "pending" }) });
    const r = await verifyOrderPayment(CODE, "123456789", deps);

    assert.equal(r.state, "pending");
    assert.equal(r.finalized, false);
    assert.ok(
      !calls.some((c) => c.startsWith("finalizeOrder")),
      "no debe finalizar un pago pendiente"
    );
    assert.ok(!calls.some((c) => c.startsWith("attachPayment")));
  });

  test("importe incorrecto: NO escribe nada", async () => {
    const { deps, calls } = harness({ found: payment({ transaction_amount: 1 }) });
    const r = await verifyOrderPayment(CODE, "123456789", deps);

    assert.equal(r.reason, "amount_mismatch");
    assert.equal(r.finalized, false);
    assert.ok(!calls.some((c) => c.startsWith("finalizeOrder")));
  });

  test("pedido inexistente: NO escribe nada", async () => {
    const { deps, calls } = harness({ order: null });
    const r = await verifyOrderPayment(CODE, "123456789", deps);

    assert.equal(r.reason, "order_not_found");
    assert.equal(r.finalized, false);
    assert.ok(!calls.some((c) => c.startsWith("finalizeOrder")));
  });

  test("pago duplicado: no vuelve a finalizar pero sí asegura el vínculo", async () => {
    const { deps, calls } = harness({ order: order({ status: "pagado" }) });
    const r = await verifyOrderPayment(CODE, "123456789", deps);

    assert.equal(r.finalized, false);
    assert.ok(
      !calls.some((c) => c.startsWith("finalizeOrder")),
      "no debe volver a finalizar un pedido ya pagado"
    );
    assert.ok(
      calls.includes(`attachPayment:${CODE}:123456789`),
      "el vínculo con el pago debe asegurarse igual"
    );
  });

  test("sin payment_id no se consulta MP", async () => {
    const { deps, calls } = harness();
    const r = await verifyOrderPayment(CODE, "", deps);

    assert.equal(r.reason, "no_payment_info");
    assert.equal(r.paymentId, null);
    assert.ok(!calls.some((c) => c.startsWith("fetchPayment")));
  });

  test("sin payment_id y pedido ya pagado, la base alcanza como verdad", async () => {
    const { deps } = harness({ order: order({ status: "pagado" }) });
    const r = await verifyOrderPayment(CODE, null, deps);
    assert.equal(r.state, "approved");
    assert.equal(r.finalized, false);
  });

  test("pago inexistente en MP lanza PaymentNotFoundError", async () => {
    const { deps } = harness({ found: null });
    await assert.rejects(
      () => verifyOrderPayment(CODE, "999", deps),
      (error: Error) => error.name === "PaymentNotFoundError"
    );
  });

  test("la referencia del pago debe ser la del pedido, no la de la URL", async () => {
    // La URL puede traer un external_reference distinto al que MP tiene
    // associated al pago. Gana el de MP, y si no coinciden no se finaliza.
    const { deps, calls } = harness({
      found: payment({ external_reference: "PIR-REAL" }),
    });
    const r = await verifyOrderPayment("PIR-DE-LA-URL", "123456789", deps);

    assert.equal(r.reason, "reference_mismatch");
    assert.equal(r.finalized, false);
    assert.ok(!calls.some((c) => c.startsWith("finalizeOrder")));
  });
});
