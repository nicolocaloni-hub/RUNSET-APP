export enum UserRole {
  PRODUCER = "PRODUCER",
  RUNNER = "RUNNER",
}

export interface Location {
  lat: number;
  lng: number;
}

export interface SetPoint {
  id: string;
  name: string;
  address: string;
  managerName: string;
  phone: string;
  location: Location;
  note?: string;
}

export interface Person {
  id: string;
  name: string;
  role: string;
  phone: string;
  initials: string;
  location: Location;
  address?: string; // Indirizzo di partenza/locazione
  category: "RUNNER" | "ACTOR" | "TROUPE";
  assignedRunnerId?: string; // ID del runner responsabile
  isLive?: boolean; // Se il runner sta trasmettendo la posizione
  isRecovered?: boolean; // Se la persona è stata recuperata dal runner
  lastSeen?: number;
  accuracy?: number;
  locationTimestamp?: number;
  recoveredAt?: number;
}

export interface AppState {
  role: UserRole | null;
  activeRunnerId: string | null;
  sets: SetPoint[];
  people: Person[];
}
