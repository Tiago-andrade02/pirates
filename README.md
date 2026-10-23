This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

---

## Configuración del sitio (variables de entorno)

Toda la configuración sensible/operativa vive en variables de entorno, nunca
hardcodeada en código. Para arrancar un entorno nuevo:

1. Copiá `.env.example` → `.env.local` y completá los valores reales.
2. Reiniciá el server (`npm run dev` / restart del proceso).

### Requeridas en producción (el arranque/checkout falla a propósito si faltan)

| Variable | Por qué |
| --- | --- |
| `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` | Base de datos remota (Turso). Sin SQLite local en producción. |
| `MERCADO_PAGO_ACCESS_TOKEN` | Token LIVE de Mercado Pago (empieza con `APP_USR-`). |
| `MERCADO_PAGO_PUBLIC_KEY` | Clave pública de Mercado Pago (lado servidor). El Payment Brick la recibe en la respuesta de `POST /api/checkout`; **no** se usa ninguna `NEXT_PUBLIC_*`. |
| `MERCADO_PAGO_WEBHOOK_SECRET` | Firma para validar webhooks de Mercado Pago. |
| `ADMIN_PASSWORD` | Panel de administración. |
| `SITE_URL` | URL pública del sitio, **sin barra final**. Debe ser exactamente `https://piratesarg.com`: se usa en los enlaces de los correos (admin y cliente), la metadata/robots/sitemap y las `backUrls`/`notificationUrl` que se le pasan a Mercado Pago. Si falta, los correos salen sin enlace y MP usa el host de la request. |

### Diagnóstico de pagos — solo local

`ENABLE_PAYMENT_DIAGNOSTICS` activa un log detallado en `stdout` de cada intento
de pago. Está pensado **exclusivamente para desarrollo local**.

Cuando vale `true` se registra un resumen **estructurado**: monto, método de
pago, tipo, cuotas, si se envió token de tarjeta y los **códigos** de error de
Mercado Pago. Por diseño **no** se registra:

- el `MERCADO_PAGO_ACCESS_TOKEN` (ni total, ni fragmentos, ni fingerprint)
- el token de tarjeta ni datos del pagador (email, DNI, nombre)
- el cuerpo crudo de la respuesta de Mercado Pago
- ningún texto libre: el detalle de errores se guarda en Turso solo como código
  genérico (`http_400`, `http_500`, …) en `payment_diagnostics.mp_error`

El código además exige `NODE_ENV !== "production"`, así que en Vercel el flag
queda anulado. Aun así, **no lo actives en Vercel** (ni en producción ni en
preview): dejarlo en `false` es la garantía explícita. Para diagnóstico puntual
en un entorno remoto, usá el endpoint protegido `GET /api/mercadopago/diagnostics`
(header `x-diagnostic-key`) en lugar de activar el flag.

### "Envío gratis" — una sola fuente

El envío es **gratis siempre, sin mínimo**. No existen variables de entorno para
configurarlo (`NEXT_PUBLIC_SHIPPING_FREE_MIN` / `SHIPPING_FREE_MIN` están
ignoradas: si las tenías, borralas). El costo que se le cobra al cliente está
fijado en el código como `CUSTOMER_SHIPPING_COST` en
`src/lib/shipping/free-shipping.ts` (re-exportado por `src/lib/shipping/index.ts`),
de modo que el server y el cliente usan siempre el mismo valor.

Hay **dos modalidades, ambas gratuitas**: envío a domicilio o envío a sucursal de
Correo Argentino. La política vive en `src/lib/shipping/pickup.ts`, con un
interruptor maestro (`PICKUP_ENABLED`) que, puesto en `false`, deja solamente
domicilio sin tocar ningún otro archivo.

La modalidad de sucursal **no tiene selector ni catálogo**. No existe un padrón
de sucursales contra el cual validar, así que no se consulta la API de agencias
(`/api/shipping/agencies` responde `410`) y `agency_code` se deja siempre vacío.
Lo que hace el cliente es escribir en texto libre, opcional, qué sucursal prefiere
(`orders.preferred_branch`, hasta 120 caracteres); si no escribe nada, el negocio
lo coordina por WhatsApp. En esta modalidad no se pide ni se guarda dirección.

Para el cliente, "sucursal" es una modalidad real pero **manual**: apenas
confirma el pedido se escribe al WhatsApp del negocio y ahí se acuerda la sucursal
con el cliente. Por eso `createShipment()` corta los pedidos a sucursal con el error
`sucursal-manual`: sin código de agencia no se puede generar el envío en la API del
courier, así que el admin carga el tracking a mano. La provincia, el CP y la
localidad siguen siendo obligatorios en las dos modalidades: son los que definen
si hay servicio para esa zona.

### Aviso de pedido nuevo por WhatsApp

Cuando el pedido se finaliza (o sea, con el pago confirmado), se envía al
WhatsApp del negocio (`WHATSAPP_TO`) el detalle completo: cliente, teléfono y
email, código de pedido, productos con cantidades y precios, total, envío,
modalidad, destino (dirección o sucursal preferida), observaciones del cliente y
el enlace al pedido en el panel.

El aviso es best-effort: si WhatsApp falla, el pedido **igual queda guardado y
cobrado** (solo se pierde el aviso). En el detalle del pedido hay un botón
**"Reenviar aviso por WhatsApp"** para recuperarlo; muestra éxito únicamente si la
API de Meta confirmó el envío. No se manda para pedidos pendientes, cancelados o
sin stock: el texto anuncia una venta cobrada.

El contenido y el orden de las variables viven en `src/lib/order-message.ts` y la
plantilla `WHATSAPP_TEMPLATE_NAME` debe estar aprobada con **5 variables
agrupadas** en ese orden:

| # | Contenido |
|---|-----------|
| `{{1}}` | cliente |
| `{{2}}` | teléfono y email de contacto |
| `{{3}}` | pedido: código, productos, cantidades, precios, total y envío |
| `{{4}}` | envío: modalidad, CP, localidad, provincia, dirección o sucursal |
| `{{5}}` | observaciones del cliente y enlace al pedido |

Los datos van agrupados y no uno por variable a propósito: las plantillas usan
variables posicionales y con muchas variables un `{{n}}` corrido manda el teléfono
donde debería ir el total. Si Meta ya tiene aprobada una versión de 7 variables,
hay que reemplazarla.

### Alerta urgente: pedido cobrado sin stock

Si al finalizar el pago el stock no alcanza, el pedido queda `sin_stock` y se
manda al número del negocio (`WHATSAPP_TO`) una **alerta urgente** por la
plantilla `WHATSAPP_STOCK_ALERT_TEMPLATE_NAME` (7 variables, ver `.env.example`).
Si esa variable está vacía se reutiliza `WHATSAPP_TEMPLATE_NAME`, que **no** es lo
mismo: esa anuncia una venta; la alerta anuncia plata cobrada que no se puede
cumplir. Si no hay ninguna de las dos, el canal de WhatsApp se omite (el pedido
queda igual y el aviso se recupera desde el panel con el botón de reenvío de la
alerta).

### Despacho y aviso al cliente

El seguimiento se carga a mano en el panel (`src/components/admin/ShippingCard.tsx`,
acción `updateTrackingNumber` en `src/lib/shipping/actions.ts`). Al guardar un
número nuevo, el pedido queda `enviado` y se avisa al cliente **por email**
(siempre) y **por WhatsApp** (si el canal está configurado). El aviso por WhatsApp
es best-effort: si falla, el seguimiento ya quedó guardado.

El botón **"Avisar por WhatsApp"** del panel abre `wa.me` con el mensaje ya escrito
(código + enlace). Funciona sin ninguna credencial, así que sirve aunque el canal
automático esté apagado.

Para el aviso automático hacen falta las credenciales de WhatsApp Business
(`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TO`) **y** una
plantilla aprobada `WHATSAPP_DISPATCH_TEMPLATE_NAME` con estas 4 variables en este
orden: `{{1}}` nombre, `{{2}}` pedido, `{{3}}` seguimiento, `{{4}}` enlace. Sin
esa plantilla no se envía nada (nunca se manda el aviso con la plantilla de "nueva
orden", que es un mensaje distinto). El texto y el orden de las variables viven en
`src/lib/shipping/dispatch-message.ts`.

### Confirmación de compra al cliente por WhatsApp

Cuando el pago se aprueba (estado `pagado`), además del email al cliente se le
puede mandar un WhatsApp de confirmación al **teléfono del comprador**.

El email y el WhatsApp son **dos intentos independientes**: una falla del email
no impide el WhatsApp ni al revés. El WhatsApp solo necesita el **teléfono** del
comprador (no depende de que haya un email válido); el email solo necesita el
**email**. Cada canal tiene su **propio reclamo de deduplicación**
(`customer_email_notified_at` / `customer_whatsapp_notified_at`), así que un
**éxito parcial** (salió el email pero falló el WhatsApp, o al revés) marca solo
el canal que de verdad salió y el otro se puede reintentar. Cada marca se escribe
**recién después** de que el proveedor confirma SU envío, nunca antes. Los pedidos
históricos que todavía tienen la columna legada `customer_notified_at` se tratan
como si **ambos** canales ya estuvieran reclamados, para no reenviarles nada.

Es best-effort y opcional: se dispara solo si la plantilla
`WHATSAPP_ORDER_CONFIRM_TEMPLATE_NAME` está definida y aprobada. Sin plantilla no
se manda nada (y el email al cliente igual sale). Si el envío falla, el pedido
**no se modifica**: el pago ya está confirmado y el stock descontado; el panel
tiene el botón **"Reenviar confirmación por WhatsApp"** para recuperarlo.

Solo aplica a pedidos **pagados**: el texto confirma que el pago fue recibido y
nunca se envía antes de la aprobación, ni para pedidos cancelados o sin stock
(esos obedecen a la alerta urgente, otro mensaje).

La plantilla debe estar aprobada en Meta con **4 variables en este orden**:

| # | Contenido |
|---|-----------|
| `{{1}}` | nombre del cliente |
| `{{2}}` | código del pedido |
| `{{3}}` | total |
| `{{4}}` | enlace de seguimiento |

El contenido y el orden viven en `src/lib/order-confirmation-message.ts`.

### Webhook entrante (recibir mensajes de los clientes)

Hasta ahora todo lo de WhatsApp era **salida**. Con el webhook en
`src/app/api/whatsapp/webhook/route.ts` también se **guarda** lo que escriben los
clientes, para los dos números de la cuenta.

Es solo recepción: **no contesta ni reenvía nada**. Nadie recibe una respuesta
automática y no hay riesgo de bucle con Meta. Los mensajes quedan en la tabla
`whatsapp_messages` (columna `body`, `from_number`, `status`, `wamid`, etc.).

Variables nuevas (se documentan también en `.env.example`, sección 6):

| Variable | Para qué |
| --- | --- |
| `WHATSAPP_VERIFY_TOKEN` | Token de suscripción. Lo inventás vos: es el mismo string que ponés en Meta y en esta variable. |
| `WHATSAPP_APP_SECRET` | App Secret de la app de Meta (WhatsApp Manager → Configuration → Webhooks → Developer). Valida la firma de cada POST. **Distinto** de `WHATSAPP_ACCESS_TOKEN` y más sensible. |
| `WHATSAPP_PHONE_NUMBER_ID_2` | ID del segundo número, para distinguir a cuál llegó cada mensaje. Opcional: si la cuenta tiene uno solo, vacía. |

La salida **sigue yendo por el primario** (`WHATSAPP_PHONE_NUMBER_ID`); el segundo
número por ahora solo recibe.

#### Configuración en Meta (una sola vez)

En WhatsApp Manager → Configuration → Webhooks:

1. **Callback URL**: `https://piratesarg.com/api/whatsapp/webhook`
2. **Verify token**: el mismo valor que `WHATSAPP_VERIFY_TOKEN`.
3. Suscribirse al campo **`messages`** (ahí llegan los mensajes y también los
   cambios de estado de los enviados).
4. Guardar. Meta hace un `GET` de prueba con el desafío: si el token coincide, el
   panel marca la suscripción como verificada.

El callback se registra **una sola vez por app/WABA**, no por número: si los dos
números están en la misma WABA, los dos llegan al mismo endpoint. Si el panel
queda en "pendiente de verificar", el problema casi siempre es que
`WHATSAPP_VERIFY_TOKEN` no coincide con lo puesto en Meta.

#### Qué hace el endpoint

- **`GET` (verificación de Meta)**: compara `hub.verify_token` con
  `WHATSAPP_VERIFY_TOKEN` en tiempo constante y devuelve `hub.challenge`. Token
  incorrecto → `403`.
- **`POST` (eventos)**: valida `X-Hub-Signature-256` (HMAC SHA-256) contra el
  cuerpo **crudo** antes de parsear. Firma inválida → `401`.

Falla cerrado en ambos: sin `WHATSAPP_VERIFY_TOKEN` el `GET` devuelve `503` y sin
`WHATSAPP_APP_SECRET` el `POST` devuelve `503`, así que un despliegue a medio
configurar no acepta nada en silencio.

Cuando un evento es válido, la ruta espera a escribirlo en Turso antes de responder
`200`. Si la base falla, responde `500` para que Meta reintente: es preferible un
mensaje duplicado a perder uno. Los reintentos de Meta no duplican filas porque
cada evento tiene clave única:

| Tipo de evento | `dedupe_key` |
| --- | --- |
| Mensaje de un cliente | su `wamid` (`wamid.XXX`) |
| Cambio de estado de un mensaje enviado | `wamid:estado` (`wamid.XXX:delivered`) |

El estado va en la clave a propósito: un mismo `wamid` pasa por `sent` →
`delivered` → `read` y esas transiciones se conservan, mientras que un reenvío
exacto del mismo estado se ignora. Un `phone_number_id` que no figure en las
variables se guarda igual, marcado `numero-desconocido`, y la ruta avisa por log:
así no se pierde un mensaje si Meta agrega un número a la cuenta.

### Modo de prueba del checkout (solo Preview)

Con `CHECKOUT_TEST_MODE=true` en una Preview de Vercel, el checkout crea un
pedido **real pero no pago** (estado `pendiente`) sin llamar a Mercado Pago, para
verificar el formulario y el envío gratis. En producción (`VERCEL_ENV=production`)
nunca se activa. Ver la advertencia sobre la base de datos en `.env.example`
(sección 8): el pedido de prueba se escribe en la base que apunte
`TURSO_DATABASE_URL`.

### Base de datos separada para Preview

En producción la app usa Turso vía `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`.
En Vercel esas dos variables están cargadas con scope **"Production, Preview"**:
la Preview **comparte la misma base** que producción. Eso significa que cualquier
prueba en una Preview (incluido `CHECKOUT_TEST_MODE`) escribe en la base real.

Para que la Preview no toque producción hay que darle una base propia:

1. Crear una base separada solo para Preview, por ejemplo:
   `turso db create pirates-preview`
2. Pedir el token de acceso de esa base:
   `turso db tokens create pirates-preview`
3. En Vercel, cargar **solo para el entorno "Preview"** las dos variables
   apuntando a la base nueva:
   - `vercel env add TURSO_DATABASE_URL Preview`
   - `vercel env add TURSO_AUTH_TOKEN Preview`
4. Dejar **sin cambios** los valores de Production: el objetivo es que queden dos
   filas por variable (una por entorno) en vez de una compartida.
5. La app crea el esquema y la semilla sola al primer arranque de la Preview
   (migraciones automáticas), así que la base nueva arranca vacía sin pasos
   extra.

Mientras `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` sigan con scope combinado
("Production, Preview"), las pruebas sobre una Preview se aplican a producción.

### Costos por presentación (pendiente de migración)

Hoy el costo del catálogo vive en **una sola columna**: `perfumes.cost`. No
distingue 30/50/100 ml, y el valor que tiene cargado es un número por perfume
(cuando está vacío, la migración lo autogenera como 45% de un precio). Por eso no
se puede calcular la rentabilidad real de cada presentación: el mismo `cost` se
usaría para las tres tallas aunque su costo de compra sea distinto.

Sí existen costos reales **por presentación** en `supplier_purchase_items`
(`unit_cost` + `size`), pero solo para las compras registradas.

**Cambio de modelo propuesto (aditivo, no destructivo, sin ejecutar todavía):**

1. Agregar tres columnas anulables a `perfumes`: `cost_30`, `cost_50`,
   `cost_100`. La migración sigue el patrón ya usado en `db.ts` (chequear
   `tableColumns` y hacer `ALTER TABLE ... ADD COLUMN`), así que **no toca ni
   reescribe** el `cost` existente.
2. Dejar las columnas nuevas en `NULL`. **No** autocompletarlas desde `cost`:
   cada talla se carga a mano con su costo real.
3. En el formulario de admin (`ProductForm.tsx`) agregar los tres campos y, en
   `admin-data.ts`, valorizar el inventario por talla con
   `COALESCE(cost_<size>, cost)`: los productos viejos siguen valuándose con el
   `cost` actual y los nuevos usan su costo por talla.
4. Mantener `supplier_purchase_items` como fuente histórica del costo real de
   compra; la última compra de cada `(perfume, size)` puede precargar la columna
   correspondiente cuando el admin lo confirme (nunca automático).

Preservación de datos: ninguna operación borra ni sobrescribe `cost` ni los
precios/stock. Todo es agregado de columnas anulables con lectura de respaldo
(`COALESCE`), así que una base a medio migrar sigue funcionando igual.

### Idempotencia de avisos por canal

La confirmación al comprador dejó de usar una única columna compartida
(`orders.customer_notified_at`) y ahora registra **cada canal por separado** en
`orders.customer_email_notified_at` y `orders.customer_whatsapp_notified_at`.

Ambas columnas son `TEXT` nullable y se crean de forma **aditiva**: no borran ni
reescriben datos y dejan la columna legada intacta (los pedidos históricos no se
renotifican). Hay **dos vías**, y son equivalentes e idempotentes entre sí:

1. **Automática (cableada en el código):** `src/lib/db.ts` las agrega en su
   `migrate()` con el mismo patrón que el resto del esquema (`PRAGMA table_info`
   + `ALTER TABLE ... ADD COLUMN`, cada columna chequeada por separado). Se aplica
   sola la primera vez que un proceso llama a `getDb()` contra la base.
2. **Manual (`migrations/001_customer_channel_notifications.sql`):** el mismo
   `ALTER TABLE` como script de una sola corrida, para quien prefiera dejar las
   columnas migradas antes de desplegar. SQLite/libSQL no soporta
   `ADD COLUMN IF NOT EXISTS`: si una columna ya existe, el motor devuelve
   `duplicate column name` (señal de que ya se aplicó; no hay nada más que hacer).

**Qué ocurre en cada caso:**

| Base | `createSchema` (base nueva) | `migrate()` (base existente) |
| --- | --- | --- |
| SQLite local nueva (`file:./data/pirates.db`) | Crea `orders` ya con las dos columnas | Nada (ya están) |
| SQLite local existente | `CREATE TABLE IF NOT EXISTS` = no-op | Detecta que faltan y las agrega |
| Turso nueva | Crea `orders` con las dos columnas | Nada (ya están) |
| Turso existente (producción) | No-op | Las agrega **cuando corra este código** |

La columna legada `customer_notified_at` no se elimina ni se migra: se sigue
leyendo como reclamo de los pedidos históricos (equivale a "ambos canales ya
avisados", ver `src/lib/notification-plan.ts`).

> **Importante:** modificar `db.ts` **no** cambia una base por sí solo. Las
> columnas se agregan recién cuando **este código** se ejecuta contra esa base
> (un deploy nuevo, o `npm run dev` contra la base local). La base de producción
> actual no tiene las columnas hasta que se despliegue esta versión o se corra el
> script manual. Orden seguro recomendado: **columnas primero, código después**
> (el script manual antes del deploy); con `db.ts` cableado el propio código
> también las crea al inicializar, así que el script pasa a ser opcional.

