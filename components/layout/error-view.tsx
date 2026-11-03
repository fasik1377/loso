"use client";

import { RefreshCw, WifiOff } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/primitives";

/** Friendly fallback for unexpected errors (e.g. the database is temporarily unreachable). */
export function ErrorView({ retry, digest }: { retry: () => void; digest?: string }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-20 text-center">
      <span className="rounded-2xl bg-brand-50 p-4 text-brand">
        <WifiOff className="h-8 w-8" aria-hidden="true" />
      </span>
      <h1 className="mt-5 text-2xl font-bold text-ink">We couldn&apos;t load this page</h1>
      <p className="mt-2 text-muted">
        Loso is having trouble reaching its services right now. Please check your internet connection and try again in a moment.
      </p>
      <div className="mt-6 flex gap-3">
        <Button onClick={retry}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
        </Button>
        <ButtonLink href="/" variant="outline">Go to homepage</ButtonLink>
      </div>
      {digest && <p className="mt-6 text-xs text-muted">Reference: {digest}</p>}
    </div>
  );
}
