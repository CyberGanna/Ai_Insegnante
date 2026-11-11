import Link from "next/link";
import { examHref, modeLabel, type Session } from "@/lib/types";
import { cn, formatDate, formatScore } from "./ui";

export function SessionRow({
  session,
  compact,
}: {
  session: Session;
  compact?: boolean;
}) {
  const href =
    session.status === "completata"
      ? `/report/?id=${session.id}`
      : examHref(session);
  const label =
    session.status === "completata"
      ? null
      : session.status === "in_corso"
        ? "Da finire"
        : "Interrotta";
  return (
    <li>
      <Link
        href={href}
        className={cn(
          "flex items-center gap-3 rounded-[10px] transition-colors hover:bg-paper",
          compact ? "-mx-2 px-2 py-2.5" : "px-4 py-3.5",
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium text-ink">
            {session.title}
          </p>
          <p className="mt-0.5 truncate text-[13px] text-ink-faint">
            {modeLabel(session)}, {formatDate(session.startedAt)}
          </p>
        </div>
        {label ? (
          <span className="shrink-0 text-[13px] text-ink-soft">{label}</span>
        ) : (
          <span className="shrink-0 font-serif text-lg font-semibold text-amber-deep tabular">
            {formatScore(session.score, session.scoreMax)}
          </span>
        )}
      </Link>
    </li>
  );
}
