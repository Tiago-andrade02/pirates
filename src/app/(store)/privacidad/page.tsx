import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Política de Privacidad — PIRATES",
  description:
    "Cómo recopilamos, usamos y protegemos tus datos personales en PIRATES, conforme a la Ley 25.326 de la República Argentina.",
};

export default function PrivacidadPage() {
  return (
    <LegalPage
      title="Política de Privacidad"
      updated="15 de agosto de 2026"
      sections={[
        {
          heading: "1. Datos que recopilamos",
          paragraphs: [
            "Al realizar un pedido recopilamos los datos necesarios para procesarlo: nombre y apellido, teléfono/WhatsApp, email, provincia y los datos de envío que completás (código postal, localidad, dirección o sucursal de retiro).",
          ],
        },
        {
          heading: "2. Uso de los datos",
          bullets: [
            "Procesar y gestionar tus pedidos.",
            "Comunicarnos por WhatsApp, email o teléfono sobre el estado del pedido y el envío.",
            "Mejorar la experiencia de compra en el sitio.",
            "Cumplir con obligaciones fiscales y legales.",
          ],
        },
        {
          heading: "3. Pagos y datos financieros",
          paragraphs: [
            "Los pagos con tarjeta se procesan a través de Mercado Pago. PIRATES no almacena números de tarjeta ni datos financieros; esos datos se manejan directamente por la pasarela de pago bajo sus propias políticas de seguridad.",
          ],
        },
        {
          heading: "4. Protección de los datos",
          paragraphs: [
            "Tus datos se almacenan en forma segura y solo tienen acceso a ellos las personas autorizadas para gestionar pedidos. Adoptamos medidas técnicas y organizativas razonables para proteger la información.",
          ],
        },
        {
          heading: "5. Confidencialidad de los datos personales (Ley 25.326)",
          paragraphs: [
            "Los datos personales obtenidos forman parte de bases de datos de PIRATES. Podés ejercer los derechos de acceso, rectificación y supresión previstos en la Ley 25.326 de Protección de los Datos Personales, escribiéndonos por WhatsApp o por mail.",
          ],
          bullets: [
            "WhatsApp: +54 9 11 7291-9482",
            "Mail: pirates.arg@hotmail.com",
          ],
        },
        {
          heading: "6. Cookies",
          paragraphs: [
            "El sitio utiliza almacenamiento local del navegador para el carrito de compras. No utilizamos cookies de seguimiento de terceros para publicidad sin tu consentimiento.",
          ],
        },
      ]}
    />
  );
}
