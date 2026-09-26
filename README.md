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
| `MERCADO_PAGO_PUBLIC_KEY` + `NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY` | Misma clave pública, servidor y Payment Brick. |
| `MERCADO_PAGO_WEBHOOK_SECRET` | Firma para validar webhooks de Mercado Pago. |
| `ADMIN_PASSWORD` | Panel de administración. |

### "Envío gratis" — una sola fuente

El mínimo para envío gratis NO está hardcodeado en el frontend. La fuente
única es `NEXT_PUBLIC_SHIPPING_FREE_MIN` (con alias `SHIPPING_FREE_MIN`, ambos
default `80000`). Se recomienda definir `NEXT_PUBLIC_SHIPPING_FREE_MIN` una vez:
el server (`src/lib/shipping/index.ts`) y el cliente (`AddToCart`, `CartView`,
checkout) leen el mismo valor, así el banner de "te faltan X" coincide siempre
con lo que cobra el backend, incluso si el operador lo cambia en producción.
