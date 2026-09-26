import type { Metadata } from "next";
import localFont from "next/font/local";
import { CartProvider } from "@/components/cart/CartProvider";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/Geist-Variable.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-geist-sans",
});

const geistMono = localFont({
  src: "./fonts/GeistMono-Variable.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-geist-mono",
});

const playfair = localFont({
  src: "./fonts/PlayfairDisplay-Variable.woff2",
  weight: "400 700",
  style: "normal",
  display: "swap",
  variable: "--font-playfair",
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL || "https://piratesarg.com"),
  title: {
    default: "PIRATES · Perfumes Árabes e Importados",
    template: "%s · PIRATES",
  },
  description:
    "Perfumes árabes e importados de alta calidad. Lattafa, Afnan, Armaf y más. Envíos a todo el país, pago seguro con Mercado Pago.",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    type: "website",
    locale: "es_AR",
    siteName: "PIRATES",
    title: "PIRATES · Perfumes Árabes e Importados",
    description:
      "Perfumes árabes e importados de alta calidad. Envíos a todo el país.",
  },
  twitter: {
    card: "summary_large_image",
    title: "PIRATES · Perfumes Árabes e Importados",
    description:
      "Perfumes árabes e importados de alta calidad. Envíos a todo el país.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background font-sans text-foreground [word-wrap:break-word]">
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
