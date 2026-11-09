import { Person, SetPoint, UserRole } from "../types";

export interface Session {
  role: UserRole;
  runnerId?: string;
  productionId: string;
  productionName: string;
  dayNumber: number;
}

export type EventType = "PICKUP" | "UNDO" | "ALERT" | "SET" | "DAY" | "ARRIVING" | "LATE";
export type AlertType = "TRAFFIC" | "INCIDENT" | "FUEL";

export interface RunEvent {
  id: string;
  type: EventType;
  /** Names captured when the event happened; rendered in the viewer's language. */
  data: { person?: string; runner?: string; set?: string; address?: string; alert?: AlertType; day?: number; meters?: number; time?: string };
  createdAt: number;
  runnerId?: string;
  personId?: string;
}

export interface Snapshot {
  session: Session;
  people: Person[];
  sets: SetPoint[];
  producerInfo: { name: string; phone: string };
  events: RunEvent[];
}
