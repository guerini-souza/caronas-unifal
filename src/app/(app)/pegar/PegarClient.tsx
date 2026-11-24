"use client";

import dynamic from "next/dynamic";
import { ScreenSkeleton } from "@/components/Skeleton";

// Só no navegador: o wizard restaura a última busca do sessionStorage já no primeiro render.
export const PegarClient = dynamic(() => import("./PegarWizard").then((m) => m.PegarWizard), {
  ssr: false,
  loading: () => <ScreenSkeleton cards={2} />,
});
