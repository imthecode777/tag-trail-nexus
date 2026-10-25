import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "animate-page-in mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pb-20 pt-24 sm:px-6",
        className,
      )}
    >
      {children}
    </div>
  );
}
