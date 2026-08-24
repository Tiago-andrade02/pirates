import type { ReactNode } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export default function StoreLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Espacio exacto ocupado por el navbar fixed */}
      <div
        className="h-[64px] sm:h-[68px] lg:h-[72px]"
        aria-hidden="true"
      />

      <main>{children}</main>

      <Footer />
    </div>
  );
}
