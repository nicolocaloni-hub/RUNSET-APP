# RunSet

Applicazione web per coordinare i trasporti di una produzione: produttore, runner, cast, troupe e set su una mappa condivisa.

## Avvio operativo

1. Apri [RunSet](https://runset-app.vercel.app) e scegli **Produttore → Crea una produzione**. Conserva password e codice produzione (disponibile anche in Impostazioni).
2. In **Squadra**, aggiungi i runner. Crea un **invito personale** per ciascuno e condividilo direttamente con il destinatario insieme al codice produzione. Rinnovarlo revoca gli accessi precedenti di quel runner.
3. Aggiungi cast/troupe e assegna ogni persona a un runner. Indica un indirizzo completo, oppure scegli il punto di recupero sulla mappa. Crea i set con referente, telefono e note.
4. Sul proprio telefono il runner sceglie **Runner**, inserisce i due codici e preme **Condividi GPS**, accettando il permesso del browser. Vede soltanto le persone assegnate e i set della produzione.
5. Il produttore riceve le posizioni aggiornate, le segnalazioni e le conferme di recupero. **Ferma GPS** interrompe la condivisione; la posizione precedente viene indicata come non aggiornata.

## Funzioni e limiti reali

- Dati condivisi e persistenti su PostgreSQL Neon, non più `localStorage`/`BroadcastChannel`. Produzioni isolate e permessi verificati dal server. Cookie di sessione HttpOnly/SameSite, Secure su Vercel; password con scrypt e inviti/sessioni salvati come hash.
- Sincronizzazione tramite richieste HTTPS ogni 3 secondi mentre la pagina è visibile; intervallo maggiore in background. Aggiornamenti GPS limitati a circa uno ogni 3 secondi, con richiesta di un fix fresco ogni 12 secondi. Ritardi dipendono da rete, GPS e carico. Indicazione live rimossa dopo 30 secondi senza aggiornamenti.
- Il banner di recupero si propone entro **5 metri**, soltanto per persone assegnate e non recuperate, con fix di massimo 15 secondi e precisione dichiarata di massimo 10 metri. La precisione GPS non è una garanzia di distanza: il runner conferma sempre. **No** sospende la proposta finché si allontana di almeno 12 metri. È sempre disponibile la conferma manuale in Squadra.
- Il recupero viene salvato una sola volta, compare nel registro Attività e rende il bollino della persona in bianco e nero su entrambe le mappe.
- Avvisi traffico, imprevisto e pausa benzina; attività persistenti (ultimi 200 eventi). Le notifiche browser sono facoltative e funzionano solo sui dispositivi compatibili con l'app aperta. Non è implementato un servizio push con app chiusa.
- Mappe Leaflet con cartografia standard OpenStreetMap; indirizzi cercati tramite Nominatim su invio esplicito del modulo. Se la ricerca non riesce, il modulo mantiene i dati e richiede una posizione valida: non viene inventata una coordinata. Per carichi elevati, adottare un servizio cartografico/geocoding dedicato. Il server di tile standard è best effort, senza SLA; nessuna funzione di download offline. `VITE_MAP_TILE_URL` e `VITE_MAP_ATTRIBUTION` permettono di configurare un provider diverso.
- Installabile sulla schermata Home tramite il browser compatibile. Richiede Internet. **Una web app non garantisce tracciamento con schermo bloccato o app in background**: per quel requisito serve un'app mobile nativa con autorizzazioni di localizzazione in background. Il wake lock, quando disponibile, aiuta a mantenere lo schermo acceso.
- Nessun recupero password via email in questa versione: conservare le credenziali del produttore. Le vecchie informazioni salvate solo nel browser non sono automaticamente importate; restano nel relativo storage locale.

## Sviluppo

Node.js 22 o superiore (produzione: 24), npm e PostgreSQL Neon. Nessuna chiave Gemini o Google Maps richiesta.

```sh
npm ci
vercel link --project runset-app
vercel env pull .env.local
npm run db:setup
```

Avvia in due terminali:

```sh
npm run dev:api
npm run dev
```

Apri `http://127.0.0.1:3000`. Il proxy conserva l'host originale per i controlli dell'origine. Le variabili in `.env.local` sono esclusivamente server: non aggiungere prefissi `VITE_` alle credenziali. Il database viene inizializzato anche dal server al primo accesso con `CREATE TABLE IF NOT EXISTS`.

```sh
npm run typecheck
npm test
npm run build
```

Per il collaudo integrato con il backend locale già avviato:

```sh
node scripts/smoke-test.mjs
# Dopo l'eventuale verifica nel browser, elimina esclusivamente la produzione di prova:
node --env-file=.env.local scripts/cleanup-smoke.mjs
```

Il test crea una produzione con dati inventati, due sessioni produttore e due runner. Verifica isolamento, GPS concorrenti, recupero persistente e idempotente, segnalazioni, stop GPS, revoca inviti e logout. Le credenziali temporanee sono scritte solo nella cartella `.cache` ignorata da Git. Non rieseguire prima di aver ripulito il precedente collaudo.

## Deploy

Il progetto Vercel `runset-app` è collegato a questo repository. Il database dedicato `runset-production` (Neon Free, Francoforte) deve essere connesso all'ambiente di destinazione. La API serverless è `api/runset.ts`; Vite genera il frontend in `dist`. Il codice client non riceve mai le credenziali del database. Le scritture usano versioni e aggiornamenti condizionali per evitare che due dispositivi si sovrascrivano.

Prima della pubblicazione eseguire i controlli sopra. Per una preview: `vercel deploy`; per la produzione: `vercel deploy --prod`. Il workflow GitHub esegue typecheck, test e build ad ogni push/PR. Il piano gratuito ha limiti di utilizzo: controllare le dashboard Vercel/Neon quando aumenta il numero di runner.

Riferimenti: [Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API), [Vite su Vercel](https://vercel.com/docs/frameworks/frontend/vite), [Neon serverless driver](https://neon.com/docs/serverless/serverless-driver).
