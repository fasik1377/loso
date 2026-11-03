import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { homePathFor } from "@/lib/auth/guards";
import { str } from "@/lib/search-params";
import { Alert, Card, CardBody } from "@/components/ui/primitives";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const [user, sp] = await Promise.all([getCurrentUser(), searchParams]);
  if (user) redirect(homePathFor(user));
  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold text-ink">Sign in to Loso</h1>
      <p className="mt-1 text-sm text-muted">
        New here? <Link href="/register" className="font-semibold text-brand hover:underline">Create an account</Link>
      </p>
      {str(sp, "reset") && <div className="mt-4"><Alert tone="success">Your password was changed. Sign in with your new password.</Alert></div>}
      <Card className="mt-6">
        <CardBody>
          <LoginForm next={str(sp, "next", 200)} />
        </CardBody>
      </Card>
    </div>
  );
}
