# Ai Insegnante

App web in cui un'intelligenza artificiale ti interroga a voce per preparare l'orale: prima la maturità 2027, poi gli esami universitari e i concorsi pubblici.

## Avvio rapido

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # export statico nella cartella out/
```

Senza variabili d'ambiente l'app parte in **modalità prova**: materiali e sessioni restano nel browser, l'esaminatore è simulato e la voce è quella del browser. Serve per provare tutte le schermate senza account né chiavi.

## Come è fatta

- **Next.js (App Router) + TypeScript + Tailwind**, con `output: "export"`: l'app è solo HTML/CSS/JS, pronta da impacchettare con Capacitor per iOS e Android.
- **Due formati per ogni prova**: *a voce* (`/esame?id=`, una domanda alla volta con approfondimenti) e *per iscritto* (`/scritto?id=`, l'AI prepara un compito intero con domande aperte, a crocette o una traccia di elaborato; lo studente consegna e l'AI corregge). Il report è lo stesso.
- **Materiali**: PDF, Word, testo, foto (anche scritte a mano), link, e audio o video di una lezione (MP3, M4A, WAV, MP4, WebM, fino a 25 MB), che vengono trascritti e usati come appunti.
- **Pagine**: `/` dashboard, `/esame?id=` prova orale a schermo pieno, `/scritto?id=` prova scritta, `/report?id=` report finale, `/sessioni`, `/materiali`, `/progressi`, `/impostazioni`, `/accedi`.
- **Dati** (`src/lib/store`): un'unica interfaccia `DataStore` con due implementazioni, Supabase e locale.
- **AI e voce** (`src/lib/ai`): tre parti sostituibili dietro `AiProvider`: `examiner` (domande, voto, lettura materiali), `stt` (trascrizione), `tts` (voce). Ognuna può essere `remote` (Edge Functions) o di prova/browser.

## Supabase

1. Crea un progetto e applica la migrazione: `supabase db push` (file in `supabase/migrations`). Crea tabelle, regole di accesso (ognuno vede solo i propri dati) e l'archivio privato `materials`.
2. Copia `.env.example` in `.env.local` con URL e chiave pubblicabile del progetto.
3. Imposta i segreti delle funzioni partendo da `supabase/functions/.env.example`, poi `supabase secrets set --env-file supabase/functions/.env`.
4. Pubblica le funzioni: `supabase functions deploy esaminatore trascrivi voce`.
5. In Authentication, URL configuration, aggiungi l'indirizzo dell'app tra i redirect consentiti (link magico e Google).

### Pubblicazione automatica (GitHub Actions)

`.github/workflows/supabase.yml` applica le migrazioni e pubblica le funzioni a ogni modifica in `supabase/` sul ramo `main` (o a mano da Actions > Supabase > Run workflow). Servono tre segreti GitHub: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`. Le chiavi AI si inseriscono solo nel pannello Supabase (Edge Functions > Secrets), mai nel codice o in GitHub.

### Sito online (Vercel)

Importa il repository su Vercel (preset Next.js, nessuna modifica ai comandi) e aggiungi le variabili `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Poi metti l'indirizzo del sito in Supabase, Authentication > URL configuration (Site URL e Redirect URLs).

### Fornitori AI (scelti con i segreti delle funzioni)

| Parte | Variabile | Gratis | Qualità massima |
|---|---|---|---|
| Cervello (domande, voto, lettura PDF e foto) | `LLM_PROVIDER` | `gemini` (versione gratuita di Google, con limiti giornalieri) | `anthropic` (Claude Sonnet 5.5) |
| Trascrizione (risposte a voce, audio e video caricati) | `STT_PROVIDER` | `gemini` (automatico con `LLM_PROVIDER=gemini`) | `openai` (gpt-4o-mini-transcribe) |
| Voce | `TTS_PROVIDER` | `gemini` (con `GEMINI_API_KEY`; se finisce il limite si usa la voce del browser) | `elevenlabs` o `openai` |

Con `LLM_PROVIDER=compatibile` si usa qualunque servizio con API in stile OpenAI, per esempio OpenRouter per Qwen, DeepSeek o Llama (`LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`). Per leggere foto e PDF serve un modello che vede le immagini (per Qwen le versioni "VL"). Nelle versioni gratuite il fornitore può conservare i testi inviati: meglio non caricare dati personali.

Audio e video: il servizio di trascrizione accetta file fino a 25 MB (con Gemini circa 15 MB, perché il file viaggia dentro la richiesta) e ha un limite di durata per file; per lezioni lunghe conviene caricare solo l'audio o dividerlo in parti. I video .mov dell'iPhone vanno esportati in MP4.

Per aggiungere un fornitore basta implementare l'interfaccia in `supabase/functions/_shared/llm.ts` o `speech.ts`.

## Skill installate per Claude Code

Si trovano in `.claude/skills/`; l'elenco con le fonti e l'impronta di ogni versione è in `skills-lock.json`.

| Skill | Fonte | A cosa serve |
|---|---|---|
| frontend-design | anthropics/skills | Stile curato delle schermate |
| design-taste-frontend | leonxlnx/taste-skill | Pagina di presentazione (aggiunge un controllo automatico con Chrome a fine lavoro) |
| vercel-react-best-practices | vercel-labs/agent-skills | Codice React e Next.js veloce |
| web-design-guidelines | vercel-labs/agent-skills | Revisione di interfaccia e accessibilità |
| supabase | supabase/agent-skills | Database, login e archivio file |
| copywriting | coreyhaines31/marketingskills | Testi di home, prezzi e pulsanti |
| seo-audit | coreyhaines31/marketingskills | Controllo per i motori di ricerca |

Per aggiornarle: `npx skills update -p`.
