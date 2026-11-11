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
- **Pagine**: `/` dashboard, `/esame?id=` simulazione a schermo pieno, `/report?id=` report finale, `/sessioni`, `/materiali`, `/progressi`, `/impostazioni`, `/accedi`.
- **Dati** (`src/lib/store`): un'unica interfaccia `DataStore` con due implementazioni, Supabase e locale.
- **AI e voce** (`src/lib/ai`): tre parti sostituibili dietro `AiProvider`: `examiner` (domande, voto, lettura materiali), `stt` (trascrizione), `tts` (voce). Ognuna può essere `remote` (Edge Functions) o di prova/browser.

## Supabase

1. Crea un progetto e applica la migrazione: `supabase db push` (file in `supabase/migrations`). Crea tabelle, regole di accesso (ognuno vede solo i propri dati) e l'archivio privato `materials`.
2. Copia `.env.example` in `.env.local` con URL e chiave pubblicabile del progetto.
3. Imposta i segreti delle funzioni partendo da `supabase/functions/.env.example`, poi `supabase secrets set --env-file supabase/functions/.env`.
4. Pubblica le funzioni: `supabase functions deploy esaminatore trascrivi voce`.
5. In Authentication, URL configuration, aggiungi l'indirizzo dell'app tra i redirect consentiti (link magico e Google).

### Fornitori AI (scelti con i segreti delle funzioni)

| Parte | Variabile | Predefinito | Alternativa |
|---|---|---|---|
| Cervello (domande, voto, lettura PDF e foto) | `LLM_PROVIDER` | `anthropic` (Claude Sonnet 5.5) | `openai` |
| Trascrizione | `STT_PROVIDER` | `openai` (gpt-4o-mini-transcribe) | |
| Voce | `TTS_PROVIDER` | `elevenlabs` (voce calma e severa) | `openai` |

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
