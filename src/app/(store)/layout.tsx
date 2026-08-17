import type { ReactNode } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export default function StoreLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="bg-white text-center text-[11px] font-medium uppercase tracking-widest text-black">
        <Link
          href="/perfumes"
          className="block px-4 py-2 transition-colors hover:bg-neutral-100"
        >
          Envío gratis en compras superiores a $80.000
        </Link>
      </div>
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
