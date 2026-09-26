import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    authInterrupts: true,
  },
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
      // CSP global (Etapa C). Directivas acotadas al código real:
      //  - script-src: 'self' (Next) + 'unsafe-inline' (hidratación RSC de
      //    Next.js genera scripts inline en prod; ver deuda técnica nonce) +
      //    https://sdk.mercadopago.com (SDK del Payment Brick, src/…/PaymentBrick.tsx:30).
      //  - frame-src: el Payment Brick renderiza un iframe de *.mercadopago.com /
      //    *.mercadolibre.com → sin esto el brick queda en blanco.
      //  - connect-src: el SDK/xhr del brick habla con *.mercadopago.com /
      //    *.mercadolibre.com (api.mercadopago.com es server-side, se lista por
      //    cierre por si el SDK hace llamadas directas al SDK host).
      //  - img-src: data: (QRs/WhatsApp/logo) y https: (imágenes de producto
      //    servidas vía next/image).
      //  - style-src 'unsafe-inline': el SDK/next inyectan estilos inline.
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' https://sdk.mercadopago.com",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob: https:",
          "font-src 'self' data:",
          "connect-src 'self' https://*.mercadopago.com https://*.mercadolibre.com",
          "frame-src 'self' https://*.mercadopago.com https://*.mercadolibre.com",
          "worker-src 'self' blob:",
          "base-uri 'self'",
          "form-action 'self'",
          "frame-ancestors 'none'",
          "upgrade-insecure-requests",
        ].join("; "),
      },
    ];

    const production = process.env.NODE_ENV === "production";
    if (production) {
      securityHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      });
    }

    // CSP global (Etapa C). Basada en lo que el código REAL carga desde
    // el navegador:
    //   • script-src  → sdk.mercadopago.com (PaymentBrick.tsx:30, SDK del
    //                    Payment Brick dinámico). 'unsafe-inline' es
    //                    REQUERIDO por Next.js en prod (scripts inline de
    //                    hidratación RSC sin nonce) y por el propio SDK MP.
    //   • frame-src   → el Payment Brick renderiza un iframe del SDK; los
    //                    iframes viven en *.mercadopago.com y
    //                    *.mercadolibre.com. Sin esto el Brick queda en
    //                    blanco.
    //   • connect-src → el SDK/Brick llaman a api.mercadopago.com en el
    //                    navegador (tokenización/instalments).
    //   • img-src     → data: (QR/emblemas) y https: (imágenes servidas por
    //                    next/image y emojis SVG ya permitidos).
    //   • style-src + connect-src 'unsafe-inline/eval' → brick + Next.
    // frame-ancestors 'none' + X-Frame-Options DENY: bloquea clickjacking.
    securityHeaders.push({
      key: "Content-Security-Policy",
      value: [
        "default-src 'self'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "object-src 'none'",
        "upgrade-insecure-requests",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://sdk.mercadopago.com",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data:",
        "connect-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.mercadopago.com https://api.mercadopago.com https://sdk.mercadopago.com",
        "frame-src 'self' https://*.mercadopago.com https://*.mercadolibre.com",
        "worker-src 'self' blob:",
      ].join("; "),
    });

    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
