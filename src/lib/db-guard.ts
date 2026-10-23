// Guard de configuración de la base de datos (Etapa 1, endurecido).
//
// FAIL-CLOSED: en producción no se admite el SQLite local. La decisión vive acá,
// en funciones puras y testeables, sin abrir conexiones ni leer secretos.
//
// Por qué NO alcanza con NODE_ENV: `next build` corre con NODE_ENV=production
// pero no es un runtime de producción; sin una excepción acotada, una compilación
// local sin Turso fallaría. La excepción se acota a la fase de build, pero NUNCA
// se apoya en una variable de fase sola: en una plataforma de deploy (Vercel) se
// exige Turso en build y en runtime aunque NEXT_PHASE traiga un valor inesperado.
export interface DbEnv {
  NODE_ENV?: string;
  VERCEL?: string;
  NEXT_PHASE?: string;
  TURSO_DATABASE_URL?: string;
  TURSO_AUTH_TOKEN?: string;
}

// ¿Se debe exigir Turso (y por lo tanto prohibir el archivo SQLite local)?
export function requiresTurso(env: DbEnv = process.env): boolean {
  // Plataforma de deploy: nunca SQLite local, ni en build ni en runtime, sin
  // importar la fase reportada por NEXT_PHASE.
  if (env.VERCEL) return true;
  if (env.NODE_ENV === "production") {
    // Única excepción: compilación local offline (`next build` sin Turso), que
    // no es un runtime de producción. Fuera de la fase de build, producción
    // exige Turso.
    return env.NEXT_PHASE !== "phase-production-build";
  }
  // Desarrollo local.
  return false;
}

// Lanza un error claro si falta la configuración exigida en este entorno. El
// mensaje nunca incluye el token ni valores de env.
export function assertDatabaseConfig(env: DbEnv = process.env): void {
  if (!requiresTurso(env)) return;
  if (!env.TURSO_DATABASE_URL || !env.TURSO_AUTH_TOKEN) {
    throw new Error(
      "TURSO_DATABASE_URL y TURSO_AUTH_TOKEN son obligatorios en producción. " +
        "Configuralos en el entorno (ver .env.example). " +
        "No se puede usar una base local en producción."
    );
  }
}
