import type { ReactNode } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export default function StoreLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Navbar />
      <div className="h-[88px] sm:h-[92px] lg:h-[96px]" aria-hidden="true" />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
