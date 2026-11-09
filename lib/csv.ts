import type { Category } from "../types";

export interface ImportRow {
  name: string;
  category: Category;
  role: string;
  phone: string;
  address: string;
  /** "HH:MM" or "" */
  time: string;
  /** Runner name as written in the file, or "" */
  runner: string;
}

/** Splits CSV text into rows of cells; handles quotes and both "," and ";" (Excel in Italian uses ";"). */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell === "") quoted = true;
    else if (c === delimiter) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && clean[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((value) => value.trim() !== ""));
}

const normalize = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

const COLUMNS: Record<keyof ImportRow, string[]> = {
  name: ["nome", "name", "nominativo", "nome e cognome"],
  category: ["categoria", "category", "tipo", "type"],
  role: ["ruolo", "role", "reparto", "personaggio"],
  phone: ["telefono", "phone", "cellulare", "tel"],
  address: ["indirizzo", "address", "punto di incontro", "pickup"],
  time: ["orario", "ora", "time", "convocazione", "call"],
  runner: ["runner", "autista", "driver"],
};

function category(value: string): Category {
  const v = normalize(value);
  if (v.includes("run") || v.includes("autist") || v.includes("driver")) return "RUNNER";
  if (v.includes("troupe") || v.includes("crew") || v.includes("tecnic")) return "TROUPE";
  return "ACTOR";
}

/** "7.15", "7:15", "07:15:00" -> "07:15"; anything else -> "". */
export function callTime(value: string): string {
  const match = value.trim().match(/^(\d{1,2})[:.](\d{2})/);
  if (!match) return "";
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? `${String(hours).padStart(2, "0")}:${match[2]}` : "";
}

/** Reads the header row to find the columns, then maps each line; rows without a name are skipped. */
export function toImportRows(table: string[][]): ImportRow[] {
  const [header, ...lines] = table;
  if (!header) return [];
  const names = header.map(normalize);
  const index = Object.fromEntries(
    (Object.keys(COLUMNS) as (keyof ImportRow)[]).map((key) => [key, names.findIndex((n) => COLUMNS[key].includes(n))]),
  ) as Record<keyof ImportRow, number>;
  const cell = (line: string[], key: keyof ImportRow) => (index[key] >= 0 ? (line[index[key]] ?? "").trim() : "");
  return lines
    .map((line) => ({
      name: cell(line, "name").slice(0, 120),
      category: category(cell(line, "category")),
      role: cell(line, "role").slice(0, 100),
      phone: cell(line, "phone").slice(0, 40),
      address: cell(line, "address").slice(0, 500),
      time: callTime(cell(line, "time")),
      runner: cell(line, "runner"),
    }))
    .filter((row) => row.name !== "");
}

/** Semicolon CSV (what Italian Excel expects), quoting only cells that need it. */
export function toCsv(rows: (string | number)[][]): string {
  const cell = (value: string | number) => {
    const text = String(value);
    return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return rows.map((row) => row.map(cell).join(";")).join("\r\n");
}
