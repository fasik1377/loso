import { Suspense } from "react";
import { connection } from "next/server";
import { SitePageSkeleton } from "@/components/layout/site-page-skeleton";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { homePathFor } from "@/lib/auth/guards";
import { str } from "@/lib/search-params";
import { Alert, Card, CardBody } from "@/components/ui/primitives";
import { LoginForm } from "./login-form";
import { getDictionary } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Sign in" };

async function LoginPageContent({ searchParams }: PageProps<"/login">) {
  await connection(); // live data: render per request
  const [user, sp, { t }] = await Promise.all([getCurrentUser(), searchParams, getDictionary()]);
  if (user) redirect(homePathFor(user));
  const a = t.auth;
  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold text-ink">{a.signInTitle}</h1>
      <p className="mt-1 text-sm text-muted">
        {a.newHere} <Link href="/register" className="font-semibold text-brand hover:underline">{a.createAccount}</Link>
      </p>
      {str(sp, "reset") && <div className="mt-4"><Alert tone="success">{a.resetDone}</Alert></div>}
      <Card className="mt-6">
        <CardBody>
          <LoginForm next={str(sp, "next", 200)} t={a} />
        </CardBody>
      </Card>
      <p className="mt-4 text-center text-xs text-muted">{a.verificationNote}</p>
    </div>
  );
}

// Live data streams in behind Suspense so navigation shows the page shell instantly.
export default function LoginPage(props: PageProps<"/login">) {
  return (
    <Suspense fallback={<SitePageSkeleton />}>
      <LoginPageContent {...props} />
    </Suspense>
  );
}
