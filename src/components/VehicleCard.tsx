import Link from "next/link";
import { IconCar } from "@/components/icons";
import type { Vehicle } from "@/lib/types";

/** Veículo do próprio usuário (placa completa só para o dono). */
export function VehicleCard({ vehicle, editHref }: { vehicle: Vehicle; editHref?: string }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border-2 border-border bg-surface p-4">
      <IconCar className="h-8 w-8 shrink-0 text-oferecer" />
      <div className="flex-1">
        <p className="text-lg font-bold">{vehicle.model}</p>
        <p className="text-muted">
          {vehicle.color} · <span className="font-mono">{vehicle.plate}</span>
        </p>
      </div>
      {editHref ? (
        <Link href={editHref} className="inline-flex min-h-11 items-center rounded-xl px-3 font-bold text-pegar underline-offset-4 hover:underline">
          Editar
        </Link>
      ) : null}
    </div>
  );
}
