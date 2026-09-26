import type { Metadata } from "next";
import { CartView } from "@/components/cart/CartView";
import { FREE_SHIPPING_MIN } from "@/lib/shipping";

export const metadata: Metadata = {
  title: "Carrito",
  description: "Revisá los productos de tu carrito en PIRATES.",
};

export default function CartPage() {
  return <CartView freeShippingMin={FREE_SHIPPING_MIN} />;
}
