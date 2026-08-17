import type { Metadata } from "next";
import { CartView } from "@/components/cart/CartView";

export const metadata: Metadata = {
  title: "Carrito",
  description: "Revisá los productos de tu carrito en PIRATES.",
};

export default function CartPage() {
  return <CartView />;
}
