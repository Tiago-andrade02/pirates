import { test, describe, beforeEach, after } from "node:test";
import assert from "node:assert/strict";

import { diagnoseSmtp, classifySmtpError } from "../src/lib/smtp-diagnostics.ts";
import { resolveSmtpSecure } from "../src/lib/notify.ts";

// El diagnostico se testea con `verify` inyectado: los tres casos pedidos
// (exito, credenciales faltantes, error de conexion) se cubren sin abrir un
// socket real ni depender de la red.
const ALWAYS_OK = async () => true;

const ENV_KEYS = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "SMTP_PORT", "SMTP_SECURE"] as const;
let saved: Record<string, string | undefined> = {};

function setEnv(vars: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
  for (const key of ENV_KEYS) {
    if (vars[key] !== undefined) process.env[key] = vars[key];
    else delete process.env[key];
  }
}

beforeEach(() => {
  saved = {};
  for (const key of ENV_KEYS) saved[key] = process.env[key];
});

after(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("diagnoseSmtp — configuracion completa", () => {
  beforeEach(() => {
    setEnv({
      SMTP_HOST: "smtp-relay.brevo.com",
      SMTP_USER: "comprador@example.com",
      SMTP_PASS: "xSmtpKey",
      SMTP_PORT: "587",
      SMTP_SECURE: "false",
    });
  });

  test("conexion correcta devuelve ok y el mensaje de exito", async () => {
    const result = await diagnoseSmtp(ALWAYS_OK);
    assert.equal(result.status, "ok");
    assert.equal(result.missing.length, 0);
    assert.match(result.message, /correcta/i);
    assert.equal(result.checks.configured, true);
  });

  test("NO filtra usuario, contraseña ni host en la respuesta", async () => {
    const result = await diagnoseSmtp(ALWAYS_OK);
    const serializado = JSON.stringify(result);
    // El diagnostico puede decir QUE variable falta, nunca su valor.
    assert.equal(serializado.includes("comprador@example.com"), false);
    assert.equal(serializado.includes("xSmtpKey"), false);
    assert.equal(serializado.includes("smtp-relay.brevo.com"), false);
  });

  test("expone puerto y modo de cifrado para diagnosticar", async () => {
    const result = await diagnoseSmtp(ALWAYS_OK);
    assert.equal(result.checks.port, 587);
    assert.equal(result.checks.secure, false);
  });
});

describe("diagnoseSmtp — credenciales faltantes", () => {
  test("sin ninguna variable SMTP informa missing_config", async () => {
    setEnv({});
    const result = await diagnoseSmtp(ALWAYS_OK);
    assert.equal(result.status, "missing_config");
    assert.deepEqual(result.missing.sort(), ["SMTP_HOST", "SMTP_PASS", "SMTP_USER"]);
  });

  test("solo SMTP_PASS faltante se reporta a secas", async () => {
    setEnv({ SMTP_HOST: "smtp-relay.brevo.com", SMTP_USER: "comprador@example.com" });
    const result = await diagnoseSmtp(ALWAYS_OK);
    assert.equal(result.status, "missing_config");
    assert.deepEqual(result.missing, ["SMTP_PASS"]);
  });

  test("NO intenta conectar si falta configuracion", async () => {
    setEnv({});
    let llamado = false;
    await diagnoseSmtp(async () => {
      llamado = true;
      return true;
    });
    // Con la config incompleta el error seria confuso: mejor no tocar la red.
    assert.equal(llamado, false);
  });

  test("el mensaje de faltantes no incluye ningun valor", async () => {
    setEnv({ SMTP_HOST: "smtp-relay.brevo.com" });
    const result = await diagnoseSmtp(ALWAYS_OK);
    assert.equal(JSON.stringify(result).includes("smtp-relay.brevo.com"), false);
  });
});

describe("diagnoseSmtp — error de conexion", () => {
  beforeEach(() => {
    setEnv({
      SMTP_HOST: "smtp-relay.brevo.com",
      SMTP_USER: "comprador@example.com",
      SMTP_PASS: "xSmtpKey",
      SMTP_PORT: "587",
      SMTP_SECURE: "false",
    });
  });

  test("credenciales rechazadas se distinguen de un fallo de red", async () => {
    const result = await diagnoseSmtp(async () => {
      throw Object.assign(new Error("535 5.7.8 Authentication credentials invalid"), {
        code: "EAUTH",
      });
    });
    assert.equal(result.status, "auth_failed");
    // El mensaje original puede traer usuario/host: se reemplaza por uno fijo.
    assert.equal(result.message.includes("535"), false);
    assert.match(result.message, /credenciales/i);
  });

  test("host inalcanzable se reporta como fallo de conexion", async () => {
    const result = await diagnoseSmtp(async () => {
      throw Object.assign(new Error("getaddrinfo ENOTFOUND smtp-relay.brevo.com"), {
        code: "EDNS",
      });
    });
    assert.equal(result.status, "connection_failed");
    assert.equal(result.message.includes("ENOTFOUND"), false);
    assert.equal(result.message.includes("smtp-relay.brevo.com"), false);
  });

  test("TLS incompatible (587 con secure=true) da un mensaje que orienta", async () => {
    // Sintoma tipico: implicit TLS contra un puerto que solo habla STARTTLS.
    const result = await diagnoseSmtp(async () => {
      throw Object.assign(new Error("wrong version number"), { code: "ETLS" });
    });
    assert.equal(result.status, "connection_failed");
    assert.match(result.message, /SMTP_SECURE/);
    assert.match(result.message, /587/);
  });

  test("el fallo nunca propaga la excepcion: el chequeo la contiene", async () => {
    // Si la exception escapara, el endpoint caeria en un 500 sin diagnostico.
    const result = await diagnoseSmtp(async () => {
      throw new Error("boom");
    });
    assert.equal(result.status, "connection_failed");
    assert.equal(result.message.includes("boom"), false);
  });
});

describe("classifySmtpError", () => {
  test("distingue autenticacion de conexion por codigo", () => {
    assert.equal(classifySmtpError({ code: "EAUTH" }), "auth_failed");
    assert.equal(classifySmtpError({ code: "ECONNREFUSED" }), "connection_failed");
    assert.equal(classifySmtpError({ code: "ETIMEDOUT" }), "connection_failed");
    assert.equal(classifySmtpError({ code: "ESOCKET" }), "connection_failed");
  });

  test("reconoce credenciales invalidas por mensaje aunque no haya codigo", () => {
    assert.equal(
      classifySmtpError(new Error("Invalid credentials for user")),
      "auth_failed"
    );
    assert.equal(
      classifySmtpError(new Error("535 Incorrect authentication data")),
      "auth_failed"
    );
  });

  test("no rompe con valores raros", () => {
    assert.equal(classifySmtpError(undefined), "connection_failed");
    assert.equal(classifySmtpError(null), "connection_failed");
    assert.equal(classifySmtpError("texto plano"), "connection_failed");
    assert.equal(classifySmtpError({}), "connection_failed");
  });
});

describe("resolveSmtpSecure — modo de cifrado", () => {
  test("puerto 587 con secure=false usa STARTTLS", () => {
    assert.equal(resolveSmtpSecure(587, "false"), false);
  });

  test("puerto 465 con secure=true usa TLS implicito", () => {
    assert.equal(resolveSmtpSecure(465, "true"), true);
  });

  test("si no se define, decide por el puerto", () => {
    assert.equal(resolveSmtpSecure(587, ""), false);
    assert.equal(resolveSmtpSecure(587, undefined), false);
    assert.equal(resolveSmtpSecure(465, undefined), true);
  });

  test("acepta mayusculas y espacios", () => {
    assert.equal(resolveSmtpSecure(465, " TRUE "), true);
    assert.equal(resolveSmtpSecure(587, " False "), false);
  });
});
