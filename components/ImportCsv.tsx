import React, { useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { parseCsv, toImportRows } from "../lib/csv";
import { usePrefs } from "../lib/preferences";
import { initials } from "../services/proximity";
import { actions, errorCode, geocode } from "../services/store";
import type { Person } from "../types";

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Bulk import of cast, crew and runners from a CSV export (e.g. the call sheet in Excel). */
export default function ImportCsv({
  productionId,
  people,
  run,
}: {
  productionId: string;
  people: Person[];
  run: <T>(write: () => Promise<T>) => Promise<T>;
}) {
  const { t, tError, language } = usePrefs();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState("");

  async function importFile(file: File) {
    setResult("");
    // shortcut: at most 300 rows per file, the same cap the database puts on a production.
    const rows = toImportRows(parseCsv(await file.text())).slice(0, 300);
    if (rows.length === 0) return setResult(t("import_empty"));
    const failed: string[] = [];
    let ok = 0;
    setProgress({ done: 0, total: rows.length });
    try {
      // Runners first, so cast and crew can be assigned to them by name.
      for (const row of rows.filter((r) => r.category === "RUNNER")) {
        if (!people.some((p) => p.category === "RUNNER" && sameName(p.name, row.name))) {
          await actions.savePerson(productionId, person(row, undefined), true);
        }
        ok++;
        setProgress({ done: ok + failed.length, total: rows.length });
      }
      const runners = await actions.runners(productionId);
      for (const row of rows.filter((r) => r.category !== "RUNNER")) {
        try {
          if (!row.address) throw new Error("no address");
          const [place] = await geocode(row.address, language);
          // Our geocoding endpoint allows one search per second per user.
          await wait(1100);
          if (!place) throw new Error("not found");
          const runner = runners.find((r) => sameName(r.name, row.runner) || sameName(r.name.split(" ")[0], row.runner));
          await actions.savePerson(
            productionId,
            { ...person(row, { lat: place.lat, lng: place.lng }), assignedRunnerId: row.runner ? runner?.id : undefined },
            true,
          );
          ok++;
        } catch (cause) {
          if (errorCode(cause) === "people_limit") throw cause;
          failed.push(row.name);
        }
        setProgress({ done: ok + failed.length, total: rows.length });
      }
      setResult(
        [t("import_done", { ok }), failed.length ? t("import_failed", { count: failed.length, names: failed.join(", ") }) : ""]
          .filter(Boolean)
          .join(" "),
      );
    } catch (cause) {
      setResult(tError(errorCode(cause)));
    } finally {
      setProgress(null);
      await run(async () => undefined);
    }
  }

  function person(row: ReturnType<typeof toImportRows>[number], location: Person["location"]): Person {
    return {
      id: "",
      name: row.name,
      initials: initials(row.name),
      role: row.role || t(`default_role_${row.category}`),
      phone: row.phone,
      address: row.address,
      category: row.category,
      location,
      pickupTime: row.time || undefined,
    };
  }

  return (
    <section className="space-y-2 rounded-2xl border-[1.5px] border-dashed border-line2 p-3">
      <label className="flex cursor-pointer items-center gap-2 font-display text-sm font-semibold">
        {progress ? <Loader2 size={18} className="animate-spin" /> : <FileUp size={18} />}
        {progress ? t("import_progress", progress) : t("import_csv")}
        <input
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          disabled={progress !== null}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void importFile(file);
          }}
        />
      </label>
      <p className="text-xs leading-relaxed text-muted">{t("import_help")}</p>
      {result && (
        <p role="status" className="text-xs text-ink2">
          {result}
        </p>
      )}
    </section>
  );
}
