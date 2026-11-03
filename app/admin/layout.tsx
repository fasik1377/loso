import { AppShell } from "@/components/layout/app-shell";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <AppShell>{children}</AppShell>;
}
