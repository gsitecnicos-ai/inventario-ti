import { redirect } from "next/navigation";
import { getCurrentAccess } from "@/lib/supabase-server";

export default async function HomePage() {
  const access = await getCurrentAccess();

  if (!access.user) {
    redirect("/login");
  }

  if (access.isGlobalAdmin) {
    redirect("/admin/users");
  }

  redirect("/dashboard");
}
