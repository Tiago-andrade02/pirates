import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  FINALIZED_ORDER_STATUSES,
  ORDER_STATUSES,
  ORDER_STATUSES_WITH_STOCK_TAKEN,
  isOrderFinalized,
  type OrderStatus,
} from "../src/lib/types.ts";

describe("isOrderFinalized", () => {
  test("los estados con stock tomado están finalizados", () => {
    for (const status of ORDER_STATUSES_WITH_STOCK_TAKEN) {
      assert.equal(isOrderFinalized(status), true, `debía estar finalizado: ${status}`);
    }
  });

  test("sin_stock también está finalizado (ya se intentó y no se reintenta)", () => {
    assert.equal(isOrderFinalized("sin_stock"), true);
  });

  test("pendiente y cancelado NO están finalizados", () => {
    assert.equal(isOrderFinalized("pendiente"), false);
    assert.equal(isOrderFinalized("cancelado"), false);
  });

  test("un pedido ya avanzado no se re-procesa cuando llega el pago tarde", () => {
    // Escenario del bug: el webhook de Mercado Pago llega DESPUÉS de que el
    // admin ya cargó el seguimiento. `finalizePaidOrderByCode` debe ver el
    // pedido como finalizado y salir sin volver a descontar stock ni retroceder
    // el estado a "pagado".
    for (const status of ["pagado", "preparando", "enviado", "entregado"] as OrderStatus[]) {
      assert.equal(isOrderFinalized(status), true);
    }
  });

  test("FINALIZED_ORDER_STATUSES cubre todo estado que no sea pendiente/cancelado", () => {
    const notFinalized = ORDER_STATUSES.filter((s) => !isOrderFinalized(s));
    assert.deepEqual(notFinalized, ["pendiente", "cancelado"]);
  });

  test("FINALIZED_ORDER_STATUSES no repite estados", () => {
    assert.equal(new Set(FINALIZED_ORDER_STATUSES).size, FINALIZED_ORDER_STATUSES.length);
  });
});
