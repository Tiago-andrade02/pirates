// Runner seguro de la migración 002 (catálogo PIRATES).
//
// Usa el cliente de Turso ya instalado (@libsql/client) y abre UNA transacción
// real y persistente (client.transaction) para:
//   - leer las 7 filas dentro de la transacción,
//   - comprobar el invariante y TODAS las precondiciones (precio y stock),
//   - exigir exactamente 1 fila afectada por cada UPDATE,
//   - verificar el estado final,
//   - COMMIT solo si todo pasó; si algo falla, ROLLBACK y código != 0.
// No usa `SELECT changes()` y NO simula transacciones con peticiones sueltas.
//
// Modos:
//   (por defecto) DRY-RUN: valida y hace ROLLBACK. No persiste nada.
//   --apply       APLICA de verdad (COMMIT) si todo pasa.
//
// Configuración (variables de entorno; nunca pegar secretos en el repo):
//   TURSO_DATABASE_URL   URL de la base
//   TURSO_AUTH_TOKEN     token con permiso de ESCRITURA (solo para --apply)
//   TURSO_APPLY_CONFIRM="SI"  confirmación extra para --apply
//
// Uso:
//   node scripts/apply-catalog-migration.mjs
//   node scripts/apply-catalog-migration.mjs --apply
//
// Códigos de salida:
//   0 = aplicado (o dry-run OK)
//   1 = falló (error / filas != 1 / verificación) -> ROLLBACK
//   2 = precondición o estado inesperado -> ROLLBACK
//   3 = ya estaba aplicada -> no se escribió nada
//   4 = falta configuración
//   5 = BLOQUEADA por precondición estricta sin verificar (jpg-le-beau.stock_30)

import { createClient } from "@libsql/client";
import { runCatalogMigration, RUN_CODES } from "../src/lib/catalog-migration.ts";

const apply = process.argv.includes("--apply");

function fail(message, code) {
  console.error(message);
  process.exit(code);
}

if (apply && process.env.TURSO_APPLY_CONFIRM !== "SI") {
  fail(
    "Para aplicar con --apply definí TURSO_APPLY_CONFIRM=SI (guardas contra corridas accidentales).",
    4
  );
}

const url = process.env.TURSO_DATABASE_URL;
const token = process.env.TURSO_AUTH_TOKEN;
if (!url || !token) {
  fail(
    "Falta configuración.\n" +
      "Definí TURSO_DATABASE_URL y TURSO_AUTH_TOKEN en el entorno.\n" +
      "No se ejecutó ninguna consulta.",
    4
  );
}

const client = createClient({ url, authToken: token });

try {
  console.log(apply ? "Modo: APLICAR (hará COMMIT si todo pasa)." : "Modo: DRY-RUN (hará ROLLBACK, no persiste).");
  const result = await runCatalogMigration(client, {
    apply,
    log: (msg) => console.log(msg),
  });

  if (result.problems.length > 0) {
    console.error("\nProblemas:\n- " + result.problems.join("\n- "));
  }
  console.log(`\nEstado: ${result.status} (código ${result.code}).`);
  process.exit(result.code);
} catch {
  // No se imprime el mensaje crudo (puede contener la URL de conexión).
  console.error("Error inesperado durante la aplicación (detalle omitido por seguridad). ROLLBACK.");
  process.exit(RUN_CODES.FAILED);
} finally {
  try {
    client.close();
  } catch {
    // ignorar
  }
}
