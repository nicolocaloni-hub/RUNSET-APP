import { Person, SetPoint, UserRole } from "../types";
export interface Session {
  role: UserRole;
  runnerId?: string;
  roomCode: string;
  roomName: string;
}
export interface RunEvent {
  id: string;
  type: "PICKUP" | "ALERT" | "SET";
  message: string;
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
  version: number;
  accessCode?: string;
}
