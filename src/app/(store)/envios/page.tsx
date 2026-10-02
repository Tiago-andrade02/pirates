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
      updated="1 de octubre de 2026"
      sections={[
        {
          heading: "1. Cobertura",
          paragraphs: [
            "Realizamos envíos a todo el país a través de Correo Argentino.",
            "Podés elegir entre dos modalidades, ambas gratuitas: envío a domicilio en todas las provincias, o envío a una sucursal de Correo Argentino.",
          ],
        },
        {
          heading: "2. Envío a sucursal de Correo Argentino",
          paragraphs: [
            "Al elegir esta modalidad no necesités indicar una dirección: retirás tu pedido en la sucursal.",
            "No publicamos el listado de sucursales. Si querés, podés escribir en el checkout qué sucursal te queda más cómoda, pero es un dato opcional: si no lo escribís, lo coordinamos con vos.",
            "Apenas confirmes el pedido te escribimos por WhatsApp para acordar la sucursal según la disponibilidad de tu zona. El pedido se considera coordinar hasta que confirmemos la sucursal.",
            "Los horarios de atención y de retiro son los de la sucursal elegida.",
          ],
        },
        {
          heading: "3. Costo de envío",
          bullets: [
            "El envío es GRATIS en todas las compras, sin mínimo de compra, a cualquier destino del país y en ambas modalidades.",
            "El costo de envío que ves en el checkout y en el resumen de tu pedido es siempre $0.",
          ],
        },
        {
          heading: "4. Plazos de entrega",
          paragraphs: [
            "Despachamos los pedidos dentro de las 24/48 hs hábiles posteriores a la confirmación del pago. Los plazos de viaje dependen de la provincia de destino y comienzan a contar cuando Correo Argentino recibe el paquete.",
            "En la modalidad de sucursal, el plazo corre hasta que el paquete llega a la sucursal acordada.",
          ],
          bullets: [
            "Los plazos pueden extenderse por razones ajenas al correo o por condiciones climáticas.",
          ],
        },
        {
          heading: "5. Seguimiento",
          paragraphs: [
            "Cuando despachamos tu pedido, cargamos el número de seguimiento de Correo Argentino y te avisamos por WhatsApp (y también por email) con el código y el enlace para consultarlo.",
            "Desde la página de tu pedido podés ver el número, el enlace para consultar el estado y el estado actual del envío.",
          ],
        },
        {
          heading: "6. Datos de envío",
          paragraphs: [
            "Es responsabilidad del comprador completar correctamente los datos de envío. Si los datos son incorrectos y el paquete no puede ser entregado, los costos de reenvío corren por cuenta del comprador.",
            "Podés dejar observaciones en el checkout (por ejemplo, un horario para la entrega). Las tenemos en cuenta si nos resulta posible, pero no son un compromiso.",
          ],
        },
        {
          heading: "7. Consultas",
          paragraphs: [
            "Ante cualquier duda sobre tu envío podés escribirnos por WhatsApp: +54 9 11 7291-9482.",
          ],
        },
      ]}
    />
  );
}
