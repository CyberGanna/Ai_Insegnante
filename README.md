# Ai Insegnante

App web in cui un'intelligenza artificiale ti interroga a voce per preparare l'orale: prima la maturità 2027, poi gli esami universitari e i concorsi pubblici.

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
