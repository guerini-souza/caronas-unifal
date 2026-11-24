import { ScreenSkeleton } from "@/components/Skeleton";

// Esqueleto da tela enquanto o servidor responde (mais suave que uma rodinha em tela cheia).
export default function Loading() {
  return <ScreenSkeleton />;
}
