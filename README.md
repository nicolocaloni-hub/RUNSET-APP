# RunSet

Web app per coordinare i trasporti di una produzione: produttore, runner, cast, troupe e set su una mappa condivisa, aggiornata in tempo reale.

## Come si usa

1. Il **produttore** crea un account (email e password) e una produzione. Da un solo account può gestire più produzioni.
2. In **Squadra** aggiunge i runner e, per ciascuno, crea un **link d'invito** da mandare su WhatsApp. Il link funziona una sola volta e scade dopo 7 giorni. Crearne uno nuovo scollega il dispositivo precedente di quel runner.
3. Aggiunge cast e troupe: cerca il punto di incontro, sceglie il risultato corretto (oppure tiene premuto sulla mappa) e assegna ogni persona a un runner. Crea i set con referente, telefono e note.
4. Il **runner** apre il link sul telefono: entra senza password e vede solo sé stesso, le persone assegnate e i set. Con **Condividi GPS** il produttore vede la sua ultima posizione.
5. Vicino a una persona assegnata compare "Hai recuperato…?". Il raggio dipende dalla precisione GPS (25–60 m). Il recupero è sempre confermato a mano. Un recupero sbagliato si annulla dalla scheda: il produttore può farlo sempre, il runner entro 10 minuti.
6. A fine giornata il produttore usa **Nuova giornata** in Impostazioni: i recuperi si azzerano, lo storico resta in Attività.

Altre funzioni: segnalazioni (traffico, imprevisto, pausa benzina) con limite di frequenza; registro Attività; interfaccia in italiano e inglese; mappa chiara o scura; tutorial per ruolo; cambio password, recupero via email ed "esci da tutti i dispositivi"; eliminazione definitiva della produzione.

## Limiti reali

- È una web app: **il GPS non è garantito con schermo bloccato o app in secondo piano**. Il wake lock, dove disponibile, tiene lo schermo acceso. Per il tracciamento in background serve un'app nativa (prevista in una fase successiva).
- Un runner è "live" se il server ha ricevuto un segnale negli ultimi 30 secondi. Il confronto usa l'ora del server, quindi l'orologio del telefono non conta.
- La ricerca indirizzi usa OpenStreetMap Nominatim tramite il nostro server (`api/geocode.ts`), con un limite di una richiesta al secondo. Per volumi alti serve un provider dedicato.
- Le tile standard di OpenStreetMap sono best effort, senza SLA. `VITE_MAP_TILE_URL` permette un altro provider; aggiungerne l'host anche alla CSP in `vercel.json`.

## Architettura

- **Frontend**: React 19 + Vite + Tailwind + Leaflet, ospitato su Vercel.
- **Backend**: Supabase (Postgres, Auth, Realtime), regione Francoforte.
  - Produttori: account email/password. Runner: accesso anonimo legato a un invito monouso (`redeem_invite`).
  - Isolamento delle produzioni con Row Level Security. Le scritture sensibili (inviti, GPS, recuperi, segnalazioni, giornate) passano da funzioni `SECURITY DEFINER` che verificano ruolo e appartenenza.
  - Il tempo reale arriva da Supabase Realtime: niente polling, solo un aggiornamento di sicurezza ogni 60 secondi.
  - Per ogni runner si salva solo l'ultima posizione, non il percorso. Ogni notte `pg_cron` cancella eventi più vecchi di 90 giorni, posizioni ferme da 30 giorni e inviti scaduti.
- **API Vercel**: solo `api/geocode.ts`. Accetta richieste di produttori autenticati, mai account anonimi.

Lo schema è in `supabase/migrations/`; i test di schema e RLS sono in `supabase/tests/`. I test girano su un Postgres in-process (PGlite), senza database esterno.

## Configurazione di Supabase (una volta)

1. Applica le migrazioni di `supabase/migrations/` in ordine (SQL Editor oppure `supabase db push`).
2. In **Authentication → Sign In / Providers**: abilita **Allow anonymous sign-ins** (serve ai runner).
3. In **Authentication → URL Configuration**: imposta **Site URL** a `https://runset-app.vercel.app` e aggiungi l'URL di sviluppo (`http://127.0.0.1:3000`) ai Redirect URLs.
4. Email: il server SMTP integrato di Supabase invia solo agli indirizzi del team. Per conferma account e recupero password verso utenti esterni configura un SMTP personalizzato (ad esempio Resend) in **Authentication → SMTP**. In alternativa disattiva la conferma email; il recupero password resterà comunque non disponibile.
5. Su Vercel imposta `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` (Production e Preview) e rimuovi le vecchie variabili Neon (`DATABASE_URL`).

## Sviluppo

Node.js 22 o superiore.

```sh
npm ci
cp .env.example .env.local   # inserisci URL e publishable key del progetto
npm run dev:api              # ricerca indirizzi su http://127.0.0.1:3001
npm run dev                  # app su http://127.0.0.1:3000
```

Controlli (eseguiti anche dalla GitHub Action a ogni push):

```sh
npm run typecheck
npm test
npm run build
```

## Privacy

Il riepilogo per gli utenti è in app (link "Informativa privacy"). Il titolare del trattamento è la produzione che usa RunSet. Deve informare cast, troupe e runner e, per la geolocalizzazione dei lavoratori, rispettare l'art. 4 dello Statuto dei Lavoratori e il GDPR. Il testo in app è una sintesi tecnica e va verificato da chi segue gli aspetti legali.
