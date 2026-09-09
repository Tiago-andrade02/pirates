import { Suspense } from "react";
import { AdminLogin } from "@/components/admin/AdminLogin";

export default function AdminUnauthorizedPage() {
  return (
    <Suspense fallback={null}>
      <AdminLogin />
    </Suspense>
  );
}