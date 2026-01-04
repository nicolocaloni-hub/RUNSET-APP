
export enum UserRole {
  PRODUCER = 'PRODUCER',
  RUNNER = 'RUNNER'
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
  category: 'RUNNER' | 'ACTOR' | 'TROUPE';
  assignedRunnerId?: string; // ID del runner responsabile
  isLive?: boolean; // Se il runner sta trasmettendo la posizione
}

export interface AppState {
  role: UserRole | null;
  activeRunnerId: string | null;
  sets: SetPoint[];
  people: Person[];
}
