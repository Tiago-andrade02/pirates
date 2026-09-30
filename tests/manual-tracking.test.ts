import { test, describe, beforeEach, after } from "node:test";
import assert from "node:assert/strict";

import {
  OFFICIAL_CORREO_ARGENTINO_TRACKING_URL,
  MANUAL_SHIPPING_PROVIDER,
  MANUAL_SHIPPING_SERVICE,
  MANUAL_DISPATCH_EVENT_LABEL,
  normalizeTrackingNumber,
  isValidTrackingNumber,
  maxTrackingNumberLength,
  normalizeTrackingUrl,
  resolveTrackingUrlInput,
  officialTrackingUrl,
  effectiveTrackingUrl,
  safeTrackingHref,
  appendDispatchEvent,
  applyManualTracking,
  canManualTrack,
  canNotifyDispatch,
  manualTrackingBlockedReason,
  MANUAL_TRACKING_ALLOWED_STATUSES,
  MANUAL_TRACKING_BLOCKED_MESSAGE,
  type ManualTrackingInput,
} from "../src/lib/shipping/manual-tracking.ts";
import type { TrackingEvent } from "../src/lib/types.ts";

const NOW = "2026-10-01T15:30:00.000Z";

function input(over: Partial<ManualTrackingInput> = {}): ManualTrackingInput {
  return {
    trackingNumber: "123456789AR",
    trackingUrl: "",
    currentNumber: "",
    currentUrl: "",
    currentShippedAt: null,
    currentEvents: [],
    currentStatus: "pagado",
    now: NOW,
    ...over,
  };
}

// applyManualTracking devuelve una unión: `{ ok: false }` para estados que no
// admiten despacho, `{ ok: true, ... }` para el resto. Este helper afirma que
// salió bien y estrecha el tipo.
function applied(result: ReturnType<typeof applyManualTracking>) {
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("se esperaba un resultado ok");
  return result;
}

describe("normalizar el código de seguimiento", () => {
  test("quita espacios y pasa a mayúsculas", () => {
    assert.equal(normalizeTrackingNumber("  1234 5678 ab "), "12345678AB");
  });

  test("no acepta tipos que no son string", () => {
    assert.equal(normalizeTrackingNumber(null), "");
    assert.equal(normalizeTrackingNumber(undefined), "");
    assert.equal(normalizeTrackingNumber(42), "");
  });

  test("valida el formato y el largo", () => {
    assert.equal(isValidTrackingNumber("123456789AR"), true);
    assert.equal(isValidTrackingNumber("AB-123"), true);
    assert.equal(isValidTrackingNumber(""), false);
    assert.equal(isValidTrackingNumber("1234 5678"), false);
    assert.equal(isValidTrackingNumber("1234567890!@#"), false);
    assert.equal(
      isValidTrackingNumber("A".repeat(maxTrackingNumberLength() + 1)),
      false
    );
  });

  test("el mismo código con distinto formato se reconoce igual", () => {
    assert.equal(
      normalizeTrackingNumber("123456789ar"),
      normalizeTrackingNumber(" 1234 5678 9AR ")
    );
  });
});

describe("URL de seguimiento", () => {
  test("vacía es válida (se usa la oficial)", () => {
    const result = resolveTrackingUrlInput("");
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.value, "");
  });

  test("una URL http/https se acepta y se normaliza", () => {
    const result = resolveTrackingUrlInput("https://ejemplo.com/track?id=1");
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.value, "https://ejemplo.com/track?id=1");
  });

  test("una URL inválida da error en vez de guardarse rota", () => {
    for (const raw of ["no-es-url", "ftp://x.com", "javascript:alert(1)", "https://"]) {
      const result = resolveTrackingUrlInput(raw);
      assert.equal(result.ok, false, `debía rechazar ${raw}`);
    }
  });

  test("normalizeTrackingUrl ignora valores no usables", () => {
    assert.equal(normalizeTrackingUrl(""), "");
    assert.equal(normalizeTrackingUrl("   "), "");
    assert.equal(normalizeTrackingUrl("javascript:alert(1)"), "");
    assert.equal(normalizeTrackingUrl({}), "");
  });
});

describe("enlace oficial", () => {
  const saved = process.env.CORREO_ARGENTINO_TRACKING_URL;

  beforeEach(() => {
    delete process.env.CORREO_ARGENTINO_TRACKING_URL;
  });

  after(() => {
    if (saved === undefined) delete process.env.CORREO_ARGENTINO_TRACKING_URL;
    else process.env.CORREO_ARGENTINO_TRACKING_URL = saved;
  });

  test("sin override devuelve el oficial de Correo Argentino", () => {
    assert.equal(officialTrackingUrl(), OFFICIAL_CORREO_ARGENTINO_TRACKING_URL);
  });

  test("un override inválido se ignora", () => {
    process.env.CORREO_ARGENTINO_TRACKING_URL = "no-es-url";
    assert.equal(officialTrackingUrl(), OFFICIAL_CORREO_ARGENTINO_TRACKING_URL);
  });

  test("un override válido se respeta", () => {
    process.env.CORREO_ARGENTINO_TRACKING_URL = "https://seguimiento.pirates.test/x";
    assert.equal(officialTrackingUrl(), "https://seguimiento.pirates.test/x");
  });

  test("prioridad: cargada > guardada > oficial", () => {
    assert.equal(
      effectiveTrackingUrl("https://guardada.test/a", "https://cargada.test/b"),
      "https://cargada.test/b"
    );
    assert.equal(
      effectiveTrackingUrl("https://guardada.test/a", ""),
      "https://guardada.test/a"
    );
    assert.equal(effectiveTrackingUrl("", ""), OFFICIAL_CORREO_ARGENTINO_TRACKING_URL);
  });

  test("safeTrackingHref sólo enlaza http/https; una histórica inválida da null", () => {
    assert.equal(safeTrackingHref(""), OFFICIAL_CORREO_ARGENTINO_TRACKING_URL);
    assert.equal(safeTrackingHref("   "), OFFICIAL_CORREO_ARGENTINO_TRACKING_URL);
    assert.equal(
      safeTrackingHref("https://ejemplo.com/track?id=1"),
      "https://ejemplo.com/track?id=1"
    );
    assert.equal(safeTrackingHref("javascript:alert(1)"), null);
    assert.equal(safeTrackingHref("ftp://x.com"), null);
    assert.equal(safeTrackingHref("no-es-url"), null);
  });
});

describe("applyManualTracking — primera carga", () => {
  test("marca despachado, guarda fecha, estado y evento", () => {
    const result = applied(applyManualTracking(input()));

    assert.equal(result.changed, true);
    assert.equal(result.numberChanged, true);
    assert.equal(result.notifyCustomer, true);
    assert.equal(result.trackingNumber, "123456789AR");
    assert.equal(result.shippedAt, NOW);
    assert.equal(result.status, "enviado");
    assert.equal(result.provider, MANUAL_SHIPPING_PROVIDER);
    assert.equal(result.service, MANUAL_SHIPPING_SERVICE);
    assert.equal(result.trackingUrl, OFFICIAL_CORREO_ARGENTINO_TRACKING_URL);
    assert.equal(result.events.length, 1);
    assert.equal(result.events[0].event, MANUAL_DISPATCH_EVENT_LABEL);
    assert.equal(result.events[0].date, NOW);
  });

  test("respeta la URL cargada a mano", () => {
    const result = applied(
      applyManualTracking(input({ trackingUrl: "https://mi-seguimiento.test/abc" }))
    );
    assert.equal(result.trackingUrl, "https://mi-seguimiento.test/abc");
  });

  test("preparando también permite despachar y avisar", () => {
    const result = applied(
      applyManualTracking(input({ currentStatus: "preparando" }))
    );
    assert.equal(result.status, "enviado");
    assert.equal(result.notifyCustomer, true);
  });

  test("pagado también permite despachar y avisar", () => {
    const result = applied(applyManualTracking(input({ currentStatus: "pagado" })));
    assert.equal(result.status, "enviado");
    assert.equal(result.notifyCustomer, true);
  });
});

describe("applyManualTracking — sin cambios (sin duplicados)", () => {
  const already: TrackingEvent[] = [
    {
      event: MANUAL_DISPATCH_EVENT_LABEL,
      date: NOW,
      branch: null,
      status: "enviado",
      sign: "+",
    },
  ];

  test("guardar el mismo código dos veces no cambia nada ni notifica", () => {
    const result = applied(
      applyManualTracking(
        input({
          currentNumber: "123456789AR",
          currentUrl: OFFICIAL_CORREO_ARGENTINO_TRACKING_URL,
          currentShippedAt: NOW,
          currentEvents: already,
          currentStatus: "enviado",
        })
      )
    );
    assert.equal(result.changed, false);
    assert.equal(result.numberChanged, false);
    assert.equal(result.notifyCustomer, false);
    assert.deepEqual(result.events, already);
  });

  test("mismo código con distinto formato tampoco notifica", () => {
    const result = applied(
      applyManualTracking(
        input({
          trackingNumber: " 1234 5678 9ar ",
          currentNumber: "123456789AR",
          currentUrl: OFFICIAL_CORREO_ARGENTINO_TRACKING_URL,
          currentShippedAt: NOW,
          currentEvents: already,
          currentStatus: "enviado",
        })
      )
    );
    assert.equal(result.numberChanged, false);
    assert.equal(result.notifyCustomer, false);
  });

  test("un reintento con el mismo código no agrega otro evento", () => {
    const result = applied(
      applyManualTracking(
        input({
          currentNumber: "123456789AR",
          currentUrl: OFFICIAL_CORREO_ARGENTINO_TRACKING_URL,
          currentShippedAt: NOW,
          currentEvents: already,
          currentStatus: "enviado",
        })
      )
    );
    assert.equal(result.events.length, 1);
  });
});

describe("applyManualTracking — sólo cambia la URL", () => {
  const already: TrackingEvent[] = [
    {
      event: MANUAL_DISPATCH_EVENT_LABEL,
      date: NOW,
      branch: null,
      status: "enviado",
      sign: "+",
    },
  ];

  test("cambia el enlace pero no reenvía el aviso", () => {
    const result = applied(
      applyManualTracking(
        input({
          trackingNumber: "123456789AR",
          trackingUrl: "https://otro.test/x",
          currentNumber: "123456789AR",
          currentUrl: OFFICIAL_CORREO_ARGENTINO_TRACKING_URL,
          currentShippedAt: NOW,
          currentEvents: already,
          currentStatus: "enviado",
        })
      )
    );
    assert.equal(result.changed, true);
    assert.equal(result.numberChanged, false);
    assert.equal(result.notifyCustomer, false);
    assert.equal(result.urlChanged, true);
    assert.equal(result.events.length, 1);
  });
});

describe("applyManualTracking — pedidos que no pueden salir", () => {
  test("pendiente: rechaza la carga y no calcula ningún dato", () => {
    const result = applyManualTracking(
      input({ currentStatus: "pendiente", currentNumber: "" })
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, MANUAL_TRACKING_BLOCKED_MESSAGE);
    }
  });

  test("sin stock: rechaza la carga (no guarda ni avisa)", () => {
    const result = applyManualTracking(
      input({ currentStatus: "sin_stock", currentNumber: "" })
    );
    assert.equal(result.ok, false);
  });

  test("cancelado: rechaza la carga", () => {
    const result = applyManualTracking(
      input({ currentStatus: "cancelado", currentNumber: "VIEJO123" })
    );
    assert.equal(result.ok, false);
  });

  test("el motivo de bloqueo distingue el estado", () => {
    assert.equal(manualTrackingBlockedReason("pendiente"), "tracking-no-pagado");
    assert.equal(manualTrackingBlockedReason("cancelado"), "tracking-cancelado");
    assert.equal(manualTrackingBlockedReason("sin_stock"), "tracking-sin-stock");
    assert.equal(
      manualTrackingBlockedReason("entregado"),
      "tracking-estado-invalido"
    );
  });
});

describe("applyManualTracking — estados que no retroceden", () => {
  test("entregado no se degrada a enviado", () => {
    const result = applied(
      applyManualTracking(
        input({ currentStatus: "entregado", currentNumber: "VIEJO123" })
      )
    );
    assert.equal(result.status, "entregado");
  });

  test("la fecha de despacho original no se sobrescribe", () => {
    const result = applied(
      applyManualTracking(
        input({
          currentNumber: "VIEJO123",
          currentShippedAt: "2026-09-01T00:00:00.000Z",
          currentStatus: "enviado",
        })
      )
    );
    assert.equal(result.shippedAt, "2026-09-01T00:00:00.000Z");
  });
});

describe("reglas de despacho", () => {
  test("canManualTrack sólo admite pedidos que pueden salir", () => {
    for (const status of MANUAL_TRACKING_ALLOWED_STATUSES) {
      assert.equal(canManualTrack(status), true, `debía permitir ${status}`);
    }
    assert.equal(canManualTrack("pendiente"), false);
    assert.equal(canManualTrack("cancelado"), false);
    assert.equal(canManualTrack("sin_stock"), false);
  });

  test("canNotifyDispatch no avisa a entregados, cancelados ni sin stock", () => {
    assert.equal(canNotifyDispatch("pagado"), true);
    assert.equal(canNotifyDispatch("preparando"), true);
    assert.equal(canNotifyDispatch("enviado"), true);
    assert.equal(canNotifyDispatch("entregado"), false);
    assert.equal(canNotifyDispatch("pendiente"), false);
    assert.equal(canNotifyDispatch("cancelado"), false);
    assert.equal(canNotifyDispatch("sin_stock"), false);
  });
});

describe("appendDispatchEvent", () => {
  test("no duplica un evento con la misma etiqueta y fecha", () => {
    const first = appendDispatchEvent([], NOW);
    const second = appendDispatchEvent(first, NOW);
    assert.equal(second.length, 1);
  });

  test("agrega un evento para una fecha distinta", () => {
    const first = appendDispatchEvent([], NOW);
    const second = appendDispatchEvent(first, "2026-10-02T00:00:00.000Z");
    assert.equal(second.length, 2);
  });
});
