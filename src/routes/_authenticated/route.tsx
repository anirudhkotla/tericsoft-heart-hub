import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/workspace/AppSidebar";
import { Topbar } from "@/components/workspace/Topbar";
import { ensureDevSession } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // No login page in this app — every browser auto-signs-in as one shared
    // dev account (see src/lib/auth.tsx). If that fails outright (e.g. the
    // dev account is stuck pending email confirmation), surface it as a page
    // error instead of bouncing to a login screen that no longer exists.
    const session = await ensureDevSession();
    if (!session) {
      throw new Error(
        "Could not establish a session. The shared dev account may be pending email confirmation — check its inbox once, then reload.",
      );
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <Topbar />
        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
