import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { planNotifications, type NotificationClaims } from "../src/lib/notification-plan.ts";
import { isValidEmail, normalizeEmail, MAX_EMAIL_LENGTH } from "../src/lib/email-validation.ts";
import type { OrderStatus } from "../src/lib/types.ts";

const TS = "2026-09-28T12:00:00.000Z";

const claims = (over: Partial<NotificationClaims> = {}): NotificationClaims => ({
  orderStatus: "pagado" as OrderStatus,
  stockShortage: false,
  adminOrderNotifiedAt: null,
  stockAlertedAt: null,
  customerNotifiedAt: null,
  hasCustomerEmail: true,
  ...over,
});

describe("planNotifications — pedido pagado", () => {
  test("avisa al admin y al cliente", () => {
    assert.deepEqual(planNotifications(claims()), {
      adminNewOrder: true,
      adminStockAlert: false,
      customerConfirmation: true,
    });
  });

  test("sin email de cliente, solo se avisa al admin", () => {
    const plan = planNotifications(claims({ hasCustomerEmail: false }));
    assert.equal(plan.adminNewOrder, true);
    assert.equal(plan.customerConfirmation, false);
  });
});

describe("planNotifications — pedido cobrado sin stock", () => {
  const sinStock = claims({ stockShortage: true, orderStatus: "sin_stock" });

  test("dispara la alerta urgente", () => {
    assert.equal(planNotifications(sinStock).adminStockAlert, true);
  });

  test("NO manda aviso de nueva orden ni confirmación al cliente", () => {
    // El pago se cobró pero la compra no se puede cumplir: anunciarle al admin
    // una "nueva orden" o confirmarle al cliente una compra que no se prepara
    // sería mentir sobre el estado real.
    const plan = planNotifications(sinStock);
    assert.equal(plan.adminNewOrder, false);
    assert.equal(plan.customerConfirmation, false);
  });
});

describe("planNotifications — duplicados", () => {
  test("segunda llamada tras el webhook NO repite ningún aviso", () => {
    // El webhook reclama los avisos. Cuando llega la confirmacion, ve las
    // columnas ya puestas y no vuelve a enviar nada.
    const primera = planNotifications(claims());
    assert.equal(primera.adminNewOrder, true);
    assert.equal(primera.customerConfirmation, true);

    const segunda = planNotifications(
      claims({
        adminOrderNotifiedAt: TS,
        customerNotifiedAt: TS,
      })
    );
    assert.equal(segunda.adminNewOrder, false);
    assert.equal(segunda.customerConfirmation, false);
  });

  test("alerta sin stock repetida NO se reenvía", () => {
    const primera = planNotifications(
      claims({ stockShortage: true, orderStatus: "sin_stock" })
    );
    assert.equal(primera.adminStockAlert, true);

    const segunda = planNotifications(
      claims({ stockShortage: true, orderStatus: "sin_stock", stockAlertedAt: TS })
    );
    assert.equal(segunda.adminStockAlert, false);
  });

  test("un reclamo previo de otro canal no bloquea los demás", () => {
    // Si el aviso al admin ya salió pero el del cliente no (p. ej. el email del
    // cliente llegó vacío en ese momento), el del cliente debe seguir pudiendo
    // salir: los reclamos son independientes.
    const plan = planNotifications(claims({ adminOrderNotifiedAt: TS }));
    assert.equal(plan.adminNewOrder, false);
    assert.equal(plan.customerConfirmation, true);
  });

  test("el estado del pedido no cambia el plan si no hay falta de stock", () => {
    // El plan se guía por stockShortage, no por el texto del estado.
    for (const status of ["pagado", "preparando", "enviado"] as OrderStatus[]) {
      const plan = planNotifications(claims({ orderStatus: status }));
      assert.equal(plan.adminStockAlert, false, `${status} no debe generar alerta`);
    }
  });
});

describe("isValidEmail", () => {
  test("acepta direcciones reales comunes", () => {
    for (const email of [
      "juan@correo.com",
      "juan.perez+pedido@gmail.com",
      "pirates_arg@yahoo.com.ar",
      "a@b.co",
    ]) {
      assert.equal(isValidEmail(email), true, `debía aceptar ${email}`);
    }
  });

  test("rechaza lo que no se puede deliverar", () => {
    for (const email of [
      "",
      "   ",
      "juan",
      "juan@",
      "@correo.com",
      "juan@correo",
      "juan@@correo.com",
      "juan@correo..com",
      "juan perez@correo.com",
      "juan@correo.com,otro@correo.com",
      "juan<@correo.com",
    ]) {
      assert.equal(isValidEmail(email), false, `debía rechazar ${JSON.stringify(email)}`);
    }
  });

  test("rechaza tipos que no son string", () => {
    for (const value of [null, undefined, 42, {}, []]) {
      assert.equal(isValidEmail(value), false);
    }
  });

  test("aplica el largo máximo", () => {
    const largo = `${"a".repeat(MAX_EMAIL_LENGTH)}@correo.com`;
    assert.equal(isValidEmail(largo), false);
  });

  test("el mismo email con espacios alrededor se acepta (se normaliza)", () => {
    // El navegador y la API pueden mandar espacios; no deben ser motivo de
    // rechazar una compra.
    assert.equal(isValidEmail("  juan@correo.com  "), true);
    assert.equal(normalizeEmail("  juan@correo.com  "), "juan@correo.com");
  });
});
