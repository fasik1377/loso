import { AppShell } from "@/components/layout/app-shell";

export default function EmployerLayout({ children }: LayoutProps<"/employer">) {
  return <AppShell>{children}</AppShell>;
}
