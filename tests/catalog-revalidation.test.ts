import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Pruebas de fuente: las rutas de invalidación y su uso dependen de la DB/red,
// así que se inspecciona el código real para que la cobertura no se pierda en un
// refactor.

function readSource(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

const catalog = stripComments(readSource("../src/lib/catalog-revalidation.ts"));
const adminActions = stripComments(readSource("../src/app/admin/actions.ts"));
const finalize = stripComments(readSource("../src/lib/checkout-finalize.ts"));
const sitemap = stripComments(readSource("../src/app/sitemap.ts"));

describe("catálogo público — rutas de invalidación", () => {
  test("revalida home, catálogo, marcas y sitemap", () => {
    assert.match(catalog, /"\/"/);
    assert.match(catalog, /"\/perfumes"/);
    assert.match(catalog, /"\/marcas"/);
    assert.match(catalog, /"\/sitemap\.xml"/);
  });

  test("revalida la ficha cuando recibe slug", () => {
    assert.match(catalog, /\/perfumes\/\$\{slug\}/);
  });
});

describe("admin actions — cubre las operaciones que cambian el catálogo", () => {
  test("alta, edición, baja, stock, reposición y compras purgan el catálogo", () => {
    const calls = adminActions.match(/revalidatePublicCatalog\(/g) ?? [];
    assert.ok(calls.length >= 8, `esperaba >= 8 llamadas, hubo ${calls.length}`);
  });

  test("alta/stock y edición pasan el slug del producto", () => {
    assert.match(adminActions, /revalidatePublicCatalog\(slug\)/);
    assert.match(adminActions, /revalidatePublicCatalog\(row\.slug\)/);
  });

  test("no quedó una definición local duplicada del helper", () => {
    assert.doesNotMatch(adminActions, /function revalidatePublicCatalog/);
  });
});

describe("cierre de pago — invalida sin romper la idempotencia", () => {
  test("purga el catálogo solo dentro de la rama que descontó stock", () => {
    assert.match(
      finalize,
      /if \(!stockShortage\) \{\s*try \{\s*revalidatePublicCatalog\(\);/
    );
  });

  test("purga después del commit (nunca antes de confirmar el descuento)", () => {
    const commitIndex = finalize.indexOf("await tx.commit()");
    const revalidateIndex = finalize.indexOf("revalidatePublicCatalog()");
    assert.notEqual(commitIndex, -1);
    assert.notEqual(revalidateIndex, -1);
    assert.ok(
      commitIndex < revalidateIndex,
      "la purga debe ir después del commit"
    );
  });

  test("una falla al purgar no tumba la finalización del pago", () => {
    assert.match(finalize, /try \{\s*revalidatePublicCatalog\(\);\s*\} catch/);
  });
});

describe("sitemap — un error de la base no se cachea como válido", () => {
  test("no traga el error devolviendo un sitemap sin productos", () => {
    assert.doesNotMatch(sitemap, /catch\s*\{\s*return staticPages/);
  });

  test("lee las URLs de producto desde la capa de datos compartida", () => {
    assert.match(sitemap, /getPerfumeSlugs\(\)/);
  });
});
