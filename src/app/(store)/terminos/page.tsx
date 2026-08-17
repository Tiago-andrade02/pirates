import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Términos y Condiciones — PIRATES",
  description:
    "Términos y condiciones de uso de la tienda online de PIRATES: pedidos, precios, pagos y disposiciones legales.",
};

export default function TerminosPage() {
  return (
    <LegalPage
      title="Términos y Condiciones"
      updated="15 de agosto de 2026"
      sections={[
        {
          heading: "1. Aceptación de los términos",
          paragraphs: [
            "Al navegar por este sitio y realizar un pedido, aceptás los presentes Términos y Condiciones. Si no estás de acuerdo con alguna parte, te pedimos que no utilices el sitio.",
          ],
        },
        {
          heading: "2. Productos y precios",
          paragraphs: [
            "PIRATES vende perfumes árabes e importados de alta calidad. Los precios publicados están expresados en pesos argentinos (ARS), incluyen IVA y pueden ser modificados sin previo aviso. El precio válido es el que figura al momento de confirmar el pedido.",
          ],
          bullets: [
            "Las fotos son ilustrativas y pueden diferir levemente del producto final.",
            "Los tamaños disponibles (30, 50 y 100 ml) se informan en cada ficha de producto.",
            "El stock publicado se actualiza de forma automática; si un producto figura agotado no se podrá completar su compra.",
          ],
        },
        {
          heading: "3. Proceso de compra",
          paragraphs: [
            "Para realizar un pedido completás tus datos de contacto, elegís la modalidad de envío y el método de pago. Al confirmar, se te asigna un código de pedido que te permite hacer seguimiento del estado y del envío en el sitio.",
          ],
          bullets: [
            "Pagos con Mercado Pago: tarjeta de crédito, débito o billetera.",
            "Pagos por transferencia bancaria: se coordina la confirmación del pago por WhatsApp.",
            "Una vez confirmado el pago, el pedido pasa a preparación y se despacha en el menor plazo posible.",
          ],
        },
        {
          heading: "4. Responsabilidad",
          paragraphs: [
            "PIRATES no se responsabiliza por demoras del correo, errores en los datos de envío informados por el cliente, ni por el mal uso de los productos. Los datos de contacto son responsabilidad de quien realiza el pedido.",
          ],
        },
        {
          heading: "5. Propiedad intelectual",
          paragraphs: [
            "Los contenidos del sitio (textos, imágenes, logotipos y diseño) pertenecen a PIRATES o a sus respectivos titulares y no pueden ser reproducidos sin autorización.",
          ],
        },
        {
          heading: "6. Jurisdicción",
          paragraphs: [
            "Estos términos se rigen por la legislación de la República Argentina. Ante cualquier controversia, las partes se someten a los tribunales ordinarios de la Ciudad Autónoma de Buenos Aires, renunciando a cualquier otro fuero.",
          ],
        },
      ]}
    />
  );
}
