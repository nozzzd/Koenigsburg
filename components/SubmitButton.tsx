"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { goldButtonClass } from "./ui";

export function SubmitButton({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={goldButtonClass}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
