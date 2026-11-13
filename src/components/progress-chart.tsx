import type { Session } from "@/lib/types";
import { formatDate, formatScore } from "./ui";

/** Voto riportato in decimi, per confrontare maturità (su 100) e il resto (su 10). */
export const toTenths = (s: Pick<Session, "score" | "scoreMax">) =>
  ((s.score ?? 0) * 10) / s.scoreMax;

/**
 * Andamento dei voti nel tempo. La linea tratteggiata è la sufficienza (6/10):
 * è il riferimento che uno studente guarda per primo.
 */
export function ProgressChart({
  sessions,
  height = 140,
}: {
  sessions: Session[];
  height?: number;
}) {
  const done = sessions
    .filter((s) => s.status === "completata" && s.score != null)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .slice(-12);

  if (done.length < 2) {
    return (
      <p className="text-sm leading-relaxed text-ink-soft">
        Dopo due simulazioni qui vedrai come cambiano i tuoi voti.
      </p>
    );
  }

  const W = 300;
  const H = height;
  const pad = { t: 12, r: 12, b: 22, l: 24 };
  const x = (i: number) =>
    pad.l + (i * (W - pad.l - pad.r)) / (done.length - 1);
  const y = (v: number) => pad.t + (1 - v / 10) * (H - pad.t - pad.b);
  const pts = done.map((s, i) => [x(i), y(toTenths(s))] as const);
  const line = pts
    .map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${pts.at(-1)![0].toFixed(1)},${y(0)} L${pts[0][0].toFixed(1)},${y(0)} Z`;
  const last = done.at(-1)!;
  const first = done[0];
  const delta = toTenths(last) - toTenths(first);

  const description = `Voti delle ultime ${done.length} simulazioni, in decimi: da ${toTenths(first).toLocaleString("it-IT", { maximumFractionDigits: 1 })} a ${toTenths(last).toLocaleString("it-IT", { maximumFractionDigits: 1 })}.`;

  return (
    <figure>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full overflow-visible"
        role="img"
        aria-label={description}
      >
        <defs>
          <linearGradient id="progress-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--color-teal)" stopOpacity="0.16" />
            <stop offset="1" stopColor="var(--color-teal)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 6, 10].map((v) => (
          <g key={v}>
            <line
              x1={pad.l}
              x2={W - pad.r}
              y1={y(v)}
              y2={y(v)}
              stroke={v === 6 ? "var(--color-ink-faint)" : "var(--color-line)"}
              strokeDasharray={v === 6 ? "3 4" : undefined}
              strokeWidth={1}
            />
            <text
              x={pad.l - 8}
              y={y(v) + 4}
              textAnchor="end"
              className="fill-ink-faint text-[10px] tabular"
            >
              {v}
            </text>
          </g>
        ))}
        <path d={area} fill="url(#progress-fill)" />
        <path
          d={line}
          fill="none"
          stroke="var(--color-teal)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {pts.map(([px, py], i) => (
          <circle
            key={done[i].id}
            cx={px}
            cy={py}
            r={i === pts.length - 1 ? 4.5 : 2.5}
            fill={
              i === pts.length - 1 ? "var(--color-amber)" : "var(--color-card)"
            }
            stroke={
              i === pts.length - 1 ? "var(--color-card)" : "var(--color-teal)"
            }
            strokeWidth={i === pts.length - 1 ? 2 : 1.5}
          />
        ))}
        <text x={pad.l} y={H - 4} className="fill-ink-faint text-[10px]">
          {formatDate(first.startedAt)}
        </text>
        <text
          x={W - pad.r}
          y={H - 4}
          textAnchor="end"
          className="fill-ink-faint text-[10px]"
        >
          {formatDate(last.startedAt)}
        </text>
      </svg>
      <figcaption className="mt-2 text-sm text-ink-soft">
        Ultimo voto{" "}
        <span className="font-medium text-amber-deep tabular">
          {formatScore(last.score, last.scoreMax)}
        </span>
        {Math.abs(delta) >= 0.1 ? (
          <>
            {", "}
            {delta > 0 ? "+" : "−"}
            <span className="tabular">
              {Math.abs(delta).toLocaleString("it-IT", {
                maximumFractionDigits: 1,
              })}
            </span>{" "}
            punti dalla prima
          </>
        ) : null}
        . La linea tratteggiata è la sufficienza.
      </figcaption>
    </figure>
  );
}
