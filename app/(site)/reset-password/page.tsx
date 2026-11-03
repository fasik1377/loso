import type { Metadata } from "next";
import Link from "next/link";
import { str } from "@/lib/search-params";
import { Alert, Card, CardBody } from "@/components/ui/primitives";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const token = str(await searchParams, "token", 200);
  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold text-ink">Choose a new password</h1>
      <Card className="mt-6">
        <CardBody>
          {token ? (
            <ResetForm token={token} />
          ) : (
            <Alert tone="warning">
              This page needs a valid reset link. <Link href="/forgot-password" className="underline">Request a new one</Link>.
            </Alert>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
