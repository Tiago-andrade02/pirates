import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { requiresTurso, assertDatabaseConfig } from "../src/lib/db-guard.ts";

// Pruebas puras del guard de configuración de la base. No abren conexiones ni
// leen la base real: solo evalúan la decisión a partir del entorno recibido.

function readSource(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

describe("requiresTurso — fail-closed en producción", () => {
  test("en Vercel exige Turso aunque NEXT_PHASE sea la fase de build", () => {
    assert.equal(
      requiresTurso({
        VERCEL: "1",
        NODE_ENV: "production",
        NEXT_PHASE: "phase-production-build",
      }),
      true
    );
  });

  test("en Vercel exige Turso también sin NEXT_PHASE", () => {
    assert.equal(requiresTurso({ VERCEL: "1", NODE_ENV: "production" }), true);
  });

  test("un NEXT_PHASE inesperado no habilita SQLite en Vercel", () => {
    assert.equal(
      requiresTurso({ VERCEL: "1", NODE_ENV: "production", NEXT_PHASE: "algo-raro" }),
      true
    );
  });

  test("runtime de producción sin Vercel y sin fase exige Turso", () => {
    assert.equal(requiresTurso({ NODE_ENV: "production" }), true);
  });

  test("build local offline (sin Vercel) permite SQLite", () => {
    assert.equal(
      requiresTurso({ NODE_ENV: "production", NEXT_PHASE: "phase-production-build" }),
      false
    );
  });

  test("desarrollo local permite SQLite", () => {
    assert.equal(requiresTurso({ NODE_ENV: "development" }), false);
    assert.equal(requiresTurso({}), false);
  });
});

describe("assertDatabaseConfig", () => {
  test("lanza si exige Turso y faltan credenciales", () => {
    assert.throws(
      () => assertDatabaseConfig({ VERCEL: "1", NODE_ENV: "production" }),
      /TURSO_DATABASE_URL y TURSO_AUTH_TOKEN son obligatorios/
    );
  });

  test("no lanza si exige Turso y las credenciales están", () => {
    assert.doesNotThrow(() =>
      assertDatabaseConfig({
        VERCEL: "1",
        NODE_ENV: "production",
        TURSO_DATABASE_URL: "libsql://example",
        TURSO_AUTH_TOKEN: "token",
      })
    );
  });

  test("no lanza en build local sin credenciales", () => {
    assert.doesNotThrow(() =>
      assertDatabaseConfig({
        NODE_ENV: "production",
        NEXT_PHASE: "phase-production-build",
      })
    );
  });

  test("el error nunca filtra valores de entorno", () => {
    try {
      assertDatabaseConfig({
        VERCEL: "1",
        NODE_ENV: "production",
        TURSO_DATABASE_URL: "libsql://secreto-no-debe-filtrarse",
      });
      assert.fail("debía lanzar");
    } catch (error) {
      assert.doesNotMatch(
        (error as Error).message,
        /libsql:\/\/secreto-no-debe-filtrarse/
      );
    }
  });
});

describe("db.ts usa el guard compartido", () => {
  const dbSource = readSource("../src/lib/db.ts");

  test("llama a assertDatabaseConfig antes de crear el cliente", () => {
    assert.match(dbSource, /assertDatabaseConfig\(\)/);
  });

  test("no reintroduce un guard inline gobernado por NEXT_PHASE", () => {
    assert.doesNotMatch(dbSource, /isBuildPhase/);
  });
});
