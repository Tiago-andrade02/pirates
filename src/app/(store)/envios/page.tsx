import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Política de Envíos — PIRATES",
  description:
    "Envíos gratis a todo el país por Correo Argentino. Plazos, seguimiento y datos de entrega.",
};

export default function EnviosPage() {
  return (
    <LegalPage
      title="Política de Envíos"
      updated="30 de septiembre de 2026"
      sections={[
        {
          heading: "1. Cobertura",
          paragraphs: [
            "Realizamos envíos a todo el país a través de Correo Argentino, con envío a domicilio en todas las provincias.",
            "No ofrecemos retiro en persona: todos los pedidos se despachan a la dirección que cargues en el checkout.",
          ],
        },
        {
          heading: "2. Costo de envío",
          bullets: [
            "El envío es GRATIS en todas las compras, sin mínimo de compra, a cualquier destino del país.",
            "El costo de envío que ves en el checkout y en el resumen de tu pedido es siempre $0.",
          ],
        },
        {
          heading: "3. Plazos de entrega",
          paragraphs: [
            "Despachamos los pedidos dentro de las 24/48 hs hábiles posteriores a la confirmación del pago. Los plazos de viaje dependen de la provincia de destino y comienzan a contar cuando Correo Argentino recibe el paquete.",
          ],
          bullets: [
            "Los plazos pueden extenderse por razones ajenas al correo o por condiciones climáticas.",
          ],
        },
        {
          heading: "4. Seguimiento",
          paragraphs: [
            "Cuando despachamos tu pedido, cargamos el número de seguimiento de Correo Argentino y te avisamos por email. Desde la página de tu pedido podés ver el número, el enlace para consultar el estado y el estado actual del envío.",
          ],
        },
        {
          heading: "5. Datos de envío",
          paragraphs: [
            "Es responsabilidad del comprador completar correctamente los datos de envío. Si los datos son incorrectos y el paquete no puede ser entregado, los costos de reenvío corren por cuenta del comprador.",
          ],
        },
        {
          heading: "6. Consultas",
          paragraphs: [
            "Ante cualquier duda sobre tu envío podés escribirnos por WhatsApp: +54 9 11 7291-9482.",
          ],
        },
      ]}
    />
  );
}
