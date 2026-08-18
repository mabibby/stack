"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/** Root error boundary. Must be a client component. `retry` re-fetches + re-renders (Next 16.3+). */
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="font-semibold text-2xl">Something went wrong</h1>
      <p className="text-muted-foreground">We've logged it. Try again, or come back later.</p>
      <Button onClick={() => retry()}>Try again</Button>
    </main>
  );
}
