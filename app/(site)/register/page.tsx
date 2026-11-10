import { Suspense } from "react";
import { connection } from "next/server";
import { SitePageSkeleton } from "@/components/layout/site-page-skeleton";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { homePathFor } from "@/lib/auth/guards";
import { str } from "@/lib/search-params";
import { Card, CardBody } from "@/components/ui/primitives";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create an account" };

async function RegisterPageContent({ searchParams }: PageProps<"/register">) {
  await connection(); // live data: render per request
  const [user, sp] = await Promise.all([getCurrentUser(), searchParams]);
  if (user) redirect(homePathFor(user));
  const type = str(sp, "type");
  const initial = type === "employer" ? "EMPLOYER" : type === "customer" ? "CUSTOMER" : "WORKER";
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-ink">Join Looso</h1>
      <p className="mt-1 text-sm text-muted">
        Already have an account? <Link href="/login" className="font-semibold text-brand hover:underline">Sign in</Link>
      </p>
      <Card className="mt-6">
        <CardBody>
          <RegisterForm initialType={initial} />
        </CardBody>
      </Card>
    </div>
  );
}

// Live data streams in behind Suspense so navigation shows the page shell instantly.
export default function RegisterPage(props: PageProps<"/register">) {
  return (
    <Suspense fallback={<SitePageSkeleton />}>
      <RegisterPageContent {...props} />
    </Suspense>
  );
}
