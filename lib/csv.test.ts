import { describe, expect, it } from "vitest";
import { callTime, parseCsv, toCsv, toImportRows } from "./csv";

describe("import CSV", () => {
  it("legge un file Excel italiano con punto e virgola e virgolette", () => {
    const text =
      "﻿Nome;Categoria;Ruolo;Telefono;Indirizzo;Orario;Runner\r\n" +
      'Sara Bianchi;Cast;Protagonista;333 1;"Via Taro 25; Roma";7.15;Luca\r\n' +
      "Luca Ferri;Runner;;;;;\r\n" +
      ";;;;;;\r\n" +
      'Paolo "Pippo" Neri;troupe;Elettricista;;Via Chiana 40, Roma;07:45:00;\r\n';
    const rows = toImportRows(parseCsv(text));
    expect(rows.map((r) => [r.name, r.category, r.address, r.time, r.runner])).toEqual([
      ["Sara Bianchi", "ACTOR", "Via Taro 25; Roma", "07:15", "Luca"],
      ["Luca Ferri", "RUNNER", "", "", ""],
      ['Paolo "Pippo" Neri', "TROUPE", "Via Chiana 40, Roma", "07:45", ""],
    ]);
  });

  it("accetta la virgola come separatore e intestazioni in inglese", () => {
    const rows = toImportRows(parseCsv('name,address,time\nAnna,"Piazza Navona, Roma",9:05\n'));
    expect(rows).toEqual([
      { name: "Anna", category: "ACTOR", role: "", phone: "", address: "Piazza Navona, Roma", time: "09:05", runner: "" },
    ]);
  });

  it("scarta orari non validi", () => {
    expect(callTime("25:00")).toBe("");
    expect(callTime("domani")).toBe("");
  });
});

describe("toCsv", () => {
  it("separa con punto e virgola e protegge le celle speciali", () => {
    expect(toCsv([["Nome", "Note"], ["Sara", 'dice "ciao"; poi va']])).toBe('Nome;Note\r\nSara;"dice ""ciao""; poi va"');
  });
});
