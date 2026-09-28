import { getBrands } from "@/lib/data";
import { createProduct, requireAdminPage } from "../../actions";
import { ProductForm } from "@/components/admin/ProductForm";
import { PageHeader } from "@/components/admin/ui";

export default async function NuevoProductoPage() {
  await requireAdminPage();
  const brands = await getBrands();

  return (
    <div className="space-y-6">
      <PageHeader title="Nuevo producto" description="Agregá un perfume al catálogo" />
      <ProductForm product={null} brands={brands} action={createProduct} />
    </div>
  );
}
