import { Suspense } from "react";
import { isAdmin } from "./actions";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminLogin } from "@/components/admin/AdminLogin";

export default async function AdminLayout({
  children,
}: LayoutProps<"/admin">) {
  const admin = await isAdmin();

  if (!admin) {
    return (
      <Suspense fallback={null}>
        <AdminLogin />
      </Suspense>
    );
  }

  return <AdminShell>{children}</AdminShell>;
}
