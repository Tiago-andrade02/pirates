import { notFound } from "next/navigation";
import { getBrands } from "@/lib/data";
import { getAdminProductById } from "@/lib/admin-data";
import { updateProduct } from "../../actions";
import { ProductForm } from "@/components/admin/ProductForm";
import { PageHeader } from "@/components/admin/ui";

export default async function EditarProductoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getAdminProductById(Number(id));
  if (!product) notFound();
  const brands = await getBrands();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Editar: ${product.name}`}
        description={`Slug: ${product.slug}`}
      />
      <ProductForm product={product} brands={brands} action={updateProduct} />
    </div>
  );
}
