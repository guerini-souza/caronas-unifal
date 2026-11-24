import type { RideDirection } from "@/lib/direction";

export type { RideDirection };

export type Neighborhood = { id: string; name: string };

export type PickupPoint = {
  id: string;
  neighborhood_id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  image_url: string | null;
  description: string | null;
  data_status: "pending_data" | "complete";
  display_order: number;
};

export type AdminPoint = PickupPoint & { active: boolean };

/** Prévia pública do link da carona (sem nome do motorista, placa ou telefone). */
export type RidePreview = {
  ride_id: string;
  direction: RideDirection;
  departure_at: string;
  price: number;
  available_seats: number;
  total_seats: number;
  status: RideStatus;
  neighborhood_name: string;
  points: string[];
};

export type Vehicle = {
  id: string;
  model: string;
  color: string;
  plate: string;
  active: boolean;
};

export type RidePoint = { id: string; name: string; route_order: number };

export type AvailableRide = {
  ride_id: string;
  departure_at: string;
  price: number;
  available_seats: number;
  total_seats: number;
  driver_first_name: string;
  vehicle_model: string;
  vehicle_color: string;
  plate_masked: string;
  points: RidePoint[];
  already_reserved: boolean;
  /** true quando a carona é do próprio usuário (só aparece na busca, não pode reservar). */
  is_mine?: boolean;
  direction: RideDirection;
};

export type RideSummary = AvailableRide & {
  status: RideStatus;
  neighborhood_name: string;
  is_driver: boolean;
};

export type RideStatus = "OPEN" | "FULL" | "CANCELLED" | "COMPLETED";
export type ReservationStatus =
  | "ACTIVE"
  | "CANCELLED_BY_PASSENGER"
  | "CANCELLED_BY_DRIVER"
  | "COMPLETED";

export type MyReservation = {
  reservation_id: string;
  reservation_status: ReservationStatus;
  created_at: string;
  cancelled_at: string | null;
  ride_id: string;
  ride_status: RideStatus;
  departure_at: string;
  price: number;
  pickup_point_name: string;
  driver_first_name: string;
  driver_phone: string | null;
  vehicle_model: string;
  vehicle_color: string;
  plate_masked: string;
  direction: RideDirection;
  started_at: string | null;
  arrived_at: string | null;
};

export type RidePassenger = {
  reservation_id: string;
  status: ReservationStatus;
  name: string;
  phone: string;
  pickup_point: string;
  arrived_at: string | null;
};

export type MyRide = {
  ride_id: string;
  status: RideStatus;
  departure_at: string;
  price: number;
  total_seats: number;
  available_seats: number;
  cancelled_at: string | null;
  points: RidePoint[];
  passengers: RidePassenger[];
  direction: RideDirection;
  started_at: string | null;
};

/** Resultado padrão das Server Actions. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };
