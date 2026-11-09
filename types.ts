export enum UserRole {
  PRODUCER = "PRODUCER",
  RUNNER = "RUNNER",
}

export interface Location {
  lat: number;
  lng: number;
}

export type Category = "RUNNER" | "ACTOR" | "TROUPE";

export interface SetPoint {
  id: string;
  name: string;
  address: string;
  managerName: string;
  phone: string;
  location: Location;
  note: string;
}

export interface Person {
  id: string;
  name: string;
  role: string;
  phone: string;
  initials: string;
  category: Category;
  address: string;
  /** Meeting point for cast/crew; last GPS fix for runners (absent until the first fix). */
  location?: Location;
  assignedRunnerId?: string;
  // Runner only: GPS state. lastSeen is server time, so device clocks don't matter.
  sharing?: boolean;
  lastSeen?: number;
  accuracy?: number;
  // Cast/crew only: pickup of the current working day.
  isRecovered?: boolean;
  recoveredAt?: number;
  recoveredBy?: string;
}
