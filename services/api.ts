import { Snapshot } from "./protocol";
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api(body?: Record<string, unknown>): Promise<Snapshot> {
  let response: Response;
  try {
    response = await fetch("/api/runset", {
      method: body ? "POST" : "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new ApiError(
      "Connessione assente o lenta. Riprova quando sei online.",
      0,
    );
  }
  const data = await response
    .json()
    .catch(() => ({ error: "Servizio non disponibile. Riprova tra poco." }));
  if (!response.ok)
    throw new ApiError(
      data.error ?? "Operazione non riuscita.",
      response.status,
    );
  return data;
}
