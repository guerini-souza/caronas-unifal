/** Blocos cinza pulsando no lugar do conteúdo que está carregando. */
export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-2xl bg-border/70 ${className}`} />;
}

export function RideCardSkeleton() {
  return (
    <div aria-hidden className="rounded-2xl border-2 border-border bg-surface p-4">
      <div className="flex justify-between">
        <SkeletonBlock className="h-9 w-28" />
        <SkeletonBlock className="h-8 w-20" />
      </div>
      <SkeletonBlock className="mt-4 h-4 w-40" />
      <SkeletonBlock className="mt-2 h-4 w-56" />
      <SkeletonBlock className="mt-2 h-4 w-48" />
    </div>
  );
}

/** Esqueleto genérico de uma tela: título + cartões. */
export function ScreenSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div role="status" aria-label="Carregando" className="pt-2">
      <SkeletonBlock className="h-12 w-12 rounded-full" />
      <SkeletonBlock className="mt-4 h-8 w-3/4" />
      <SkeletonBlock className="mt-2 h-5 w-1/2" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: cards }, (_, i) => (
          <SkeletonBlock key={i} className="h-20 w-full" />
        ))}
      </div>
    </div>
  );
}
