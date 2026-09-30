import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  classifyPaymentStatus,
  normalizeStatus,
  isApproved,
} from "../src/lib/payment-status.ts";

// Vocabulario real de Mercado Pago (docs oficiales) más el alias interno
// "success" que usa la redirección del Payment Brick.
describe("classifyPaymentStatus", () => {
  test("approved es el único estado aprobado de MP", () => {
    assert.equal(classifyPaymentStatus("approved"), "approved");
  });

  test("'authorized' NO cuenta como aprobado: el dinero aún no se acreditó", () => {
    assert.equal(classifyPaymentStatus("authorized"), "pending");
    assert.equal(isApproved("authorized"), false);
  });

  test("'success' se acepta como alias interno del Payment Brick", () => {
    assert.equal(classifyPaymentStatus("success"), "approved");
  });

  for (const status of ["pending", "in_process", "authorized"]) {
    test(`'${status}' queda pendiente`, () => {
      assert.equal(classifyPaymentStatus(status), "pending");
      assert.equal(isApproved(status), false);
    });
  }

  for (const status of ["rejected", "cancelled", "canceled", "failed"]) {
    test(`'${status}' queda fallido`, () => {
      assert.equal(classifyPaymentStatus(status), "rejected");
    });
  }

  test("estado ausente NO se clasifica como fallo, sino como desconocido", () => {
    // Es el bug original invertido: si un estado que no se conoce se tratara
    // como rechazo, la página afirmaría que el pago falló sin saberlo.
    for (const value of [null, undefined, "", "   "]) {
      assert.equal(classifyPaymentStatus(value), "unknown");
    }
  });

  test("un estado desconocido de MP tampoco se fuerza a rechazo", () => {
    assert.equal(classifyPaymentStatus("algo_inventado"), "unknown");
  });

  test("normaliza mayúsculas y espacios", () => {
    assert.equal(normalizeStatus("  APPROVED "), "approved");
    assert.equal(classifyPaymentStatus(" APPROVED "), "approved");
    assert.equal(classifyPaymentStatus("CANCELLED"), "rejected");
  });

  test("tolera la variante con y sin guion bajo de in_process", () => {
    // MP manda "in_process"; algunos payloads vienen como "inprocess".
    assert.equal(normalizeStatus("In_Process"), "in_process");
    assert.equal(classifyPaymentStatus("In_Process"), "pending");
    assert.equal(classifyPaymentStatus("inprocess"), "pending");
  });

  test("es idempotente: clasificar dos veces da lo mismo", () => {
    const once = classifyPaymentStatus("in_process");
    assert.equal(classifyPaymentStatus(once), once);
  });
});
