import type { RunEvent } from "../services/protocol";
import type { TranslationKey } from "../translations";

type T = (key: TranslationKey, params?: Record<string, string | number>) => string;

/** Events store names and codes; the sentence is built in the viewer's language. */
export function eventText(event: RunEvent, t: T): string {
  const { person = "", runner = "", set = "", address = "", alert, day = "" } = event.data;
  switch (event.type) {
    case "PICKUP":
      return t("ev_PICKUP", { person, runner });
    case "UNDO":
      return t("ev_UNDO", { person });
    case "ALERT":
      return t("ev_ALERT", { runner, alert: alert ? t(`alert_${alert}`) : "" });
    case "SET":
      return t("ev_SET", { set, address }).trim();
    case "DAY":
      return t("ev_DAY", { day });
    case "ARRIVING":
      return t("ev_ARRIVING", { runner, person, meters: event.data.meters ?? "" });
  }
}
