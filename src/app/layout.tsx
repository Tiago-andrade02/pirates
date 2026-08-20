import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import { CartProvider } from "@/components/cart/CartProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "https://pirates-perfumeria.vercel.app"),
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
      className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background font-sans text-foreground [word-wrap:break-word]">
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
