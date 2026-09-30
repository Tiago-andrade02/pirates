import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  interpretSmtpResponse,
  interpretSmtpNetworkError,
} from "../src/lib/smtp-diagnostic-client.ts";

// Estos tests cubren lo que el panel muestra segun lo que devuelve el endpoint,
// mas los casos de error de red y de respuesta inesperada. La idea central: el
// texto en pantalla NUNCA es el cuerpo crudo de la respuesta.

describe("interpretSmtpResponse — resultados del endpoint", () => {
  test("status ok muestra exito", () => {
    const r = interpretSmtpResponse(200, { status: "ok", message: "..." });
    assert.equal(r.tone, "ok");
    assert.match(r.message, /correcta/i);
  });

  test("missing_config muestra que falta configuracion", () => {
    const r = interpretSmtpResponse(503, { status: "missing_config" });
    assert.equal(r.tone, "error");
    assert.match(r.message, /SMTP_HOST|SMTP_USER|SMTP_PASS/);
  });

  test("auth_failed orienta sobre la SMTP key de Brevo", () => {
    const r = interpretSmtpResponse(502, { status: "auth_failed" });
    assert.equal(r.tone, "error");
    assert.match(r.message, /SMTP key/i);
  });

  test("connection_failed orienta sobre puerto y SMTP_SECURE", () => {
    const r = interpretSmtpResponse(502, { status: "connection_failed" });
    assert.equal(r.tone, "error");
    assert.match(r.message, /587/);
    assert.match(r.message, /SMTP_SECURE/);
  });

  test("usa el status del body, no el codigo HTTP", () => {
    // El endpoint puede responder 200 solo para ok: si el body dice
    // connection_failed, el panel tiene que mostrar el error.
    const r = interpretSmtpResponse(200, { status: "connection_failed" });
    assert.equal(r.tone, "error");
  });
});

describe("interpretSmtpResponse — nunca muestra el cuerpo crudo", () => {
  test("descarta un message con datos sensibles del body", () => {
    // Aunque el body traiga el texto del proveedor, no se muestra: las cadenas
    // permitidas son las del modulo.
    const r = interpretSmtpResponse(502, {
      status: "auth_failed",
      message: "535 rejected: user comprador@example.com, host smtp-relay.brevo.com",
    });
    assert.equal(r.message.includes("comprador@example.com"), false);
    assert.equal(r.message.includes("smtp-relay.brevo.com"), false);
    assert.equal(r.message.includes("535"), false);
  });

  test("ignora un status desconocido en el body", () => {
    const r = interpretSmtpResponse(500, { status: "inventado", message: "secreto" });
    assert.match(r.message, /inesperada/i);
    assert.equal(r.message.includes("secreto"), false);
  });

  test("un HTML de proxy no se muestra", () => {
    const r = interpretSmtpResponse(502, "<html>Error 502 Bad Gateway</html>");
    assert.match(r.message, /inesperada/i);
    assert.equal(r.message.includes("<html>"), false);
  });

  test("body vacio o null da respuesta inesperada", () => {
    for (const body of [null, undefined, "", 0, [], true]) {
      const r = interpretSmtpResponse(500, body);
      assert.match(r.message, /inesperada/i);
    }
  });
});

describe("interpretSmtpResponse — sesion y HTTP", () => {
  test("401 pide volver a iniciar sesion", () => {
    const r = interpretSmtpResponse(401, { error: "No autorizado" });
    assert.equal(r.tone, "error");
    assert.match(r.message, /sesión|iniciar sesión/i);
  });

  test("405 (metodo incorrecto) cae en inesperado", () => {
    const r = interpretSmtpResponse(405, { error: "Usar POST" });
    assert.match(r.message, /inesperada/i);
  });

  test("ningun codigo HTTP inesperado filtra el body", () => {
    for (const status of [400, 403, 404, 418, 500, 503, 504]) {
      const r = interpretSmtpResponse(status, { message: "token=abc123" });
      assert.equal(r.message.includes("abc123"), false, `status ${status}`);
    }
  });
});

describe("interpretSmtpNetworkError", () => {
  test("error de red sin status HTTP", () => {
    const r = interpretSmtpNetworkError();
    assert.equal(r.tone, "error");
    assert.match(r.message, /conexión a internet|intentá de nuevo/i);
  });
});
