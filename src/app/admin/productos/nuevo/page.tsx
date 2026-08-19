import { getBrands } from "@/lib/data";
import { createProduct } from "../../actions";
import { ProductForm } from "@/components/admin/ProductForm";
import { PageHeader } from "@/components/admin/ui";

export default async function NuevoProductoPage() {
  const brands = await getBrands();

  return (
    <div className="space-y-6">
      <PageHeader title="Nuevo producto" description="Agregá un perfume al catálogo" />
      <ProductForm product={null} brands={brands} action={createProduct} />
    </div>
  );
}
