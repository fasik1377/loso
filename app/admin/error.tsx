"use client";

import { useEffect } from "react";
import { ErrorView } from "@/components/layout/error-view";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const digest = typeof error === "object" && error && "digest" in error ? String((error as { digest?: string }).digest ?? "") : undefined;
  return <ErrorView retry={retry} digest={digest || undefined} />;
}
