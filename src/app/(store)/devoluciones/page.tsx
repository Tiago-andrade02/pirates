import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Cambios y Devoluciones — PIRATES",
  description:
    "Condiciones de cambio y devolución de PIRATES conforme a la Ley de Defensa del Consumidor (Ley 24.240) de Argentina.",
};

export default function DevolucionesPage() {
  return (
    <LegalPage
      title="Cambios y Devoluciones"
      updated="15 de agosto de 2026"
      sections={[
        {
          heading: "1. Derecho de arrepentimiento",
          paragraphs: [
            "Conforme al artículo 34 de la Ley de Defensa del Consumidor (Ley 24.240), tenés derecho a arrepentirte de la compra dentro de los 10 (diez) días corridos desde la recepción del producto, sin necesidad de justificar el motivo.",
          ],
        },
        {
          heading: "2. Condiciones del arrepentimiento",
          bullets: [
            "El producto debe estar sin uso y con su envase original sellado.",
            "Los gastos de devolución corren por cuenta de PIRATES en caso de arrepentimiento.",
            "El reembolso se realiza por el mismo medio de pago dentro de los 10 días hábiles posteriores a recibir el producto devuelto.",
            "Por cuestiones de higiene, no se aceptan devoluciones de productos abiertos o con el sello de seguridad roto.",
          ],
        },
        {
          heading: "3. Producto defectuoso o error",
          paragraphs: [
            "Si recibís un producto equivocado o en mal estado, escribinos dentro de las 48 hs de recibirlo y lo reemplazamos o te devolvemos el dinero, asumiendo nosotros los costos de envío.",
          ],
        },
        {
          heading: "4. Cambios por talle o preferencia",
          paragraphs: [
            "Los cambios de un perfume por otro de igual o mayor valor están sujetos a disponibilidad de stock. La diferencia de precio se abona o se reintegra según corresponda.",
          ],
        },
        {
          heading: "5. Cómo gestionar un cambio o devolución",
          paragraphs: [
            "Escribinos por WhatsApp o mail indicando el código de pedido y el motivo. Te indicamos los pasos a seguir.",
          ],
          bullets: [
            "WhatsApp: +54 9 11 7291-9482",
            "Mail: pirates.arg@hotmail.com",
          ],
        },
      ]}
    />
  );
}
