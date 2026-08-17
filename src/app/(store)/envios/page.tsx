import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Política de Envíos — PIRATES",
  description:
    "Modalidades, plazos y costos de envío de PIRATES: envíos a todo el país por Correo Argentino y retiro en sucursal.",
};

export default function EnviosPage() {
  return (
    <LegalPage
      title="Política de Envíos"
      updated="15 de agosto de 2026"
      sections={[
        {
          heading: "1. Cobertura",
          paragraphs: [
            "Realizamos envíos a todo el país a través de Correo Argentino, con dos modalidades disponibles: envío a domicilio y retiro en sucursal.",
          ],
        },
        {
          heading: "2. Costo de envío",
          bullets: [
            "El costo del envío se calcula automáticamente durante el checkout según el destino, la modalidad elegida y el peso del pedido.",
            "El envío es GRATIS para pedidos desde $80.000, sin importar el destino.",
            "No se cobran costos de envío adicionales por retiro en sucursal.",
          ],
        },
        {
          heading: "3. Plazos de entrega",
          paragraphs: [
            "Los plazos indicados en el checkout son días hábiles y dependen de la provincia de destino. Despachamos los pedidos en un plazo de hasta 24/48 hs hábiles una vez confirmado el pago.",
          ],
          bullets: [
            "El plazo comienza a contar cuando el paquete es recibido por Correo Argentino.",
            "En la página de seguimiento de tu pedido podés ver el estado real del envío en todo momento.",
            "Los plazos pueden extenderse por razones ajenas al correo o por condiciones climáticas.",
          ],
        },
        {
          heading: "4. Retiro en sucursal",
          paragraphs: [
            "Si elegís retiro en sucursal, te avisamos por WhatsApp cuando tu pedido esté disponible. Deberás retirarlo presentando el código de pedido y un documento, dentro del plazo que indique Correo Argentino.",
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
