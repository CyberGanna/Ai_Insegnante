export function PageHeader({
  title,
  intro,
  action,
}: {
  title: string;
  intro?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-[2rem] leading-tight font-medium sm:text-[2.25rem]">
          {title}
        </h1>
        {intro ? (
          <p className="mt-2 max-w-prose leading-relaxed text-ink-soft">
            {intro}
          </p>
        ) : null}
      </div>
      {action}
    </header>
  );
}

export function PageFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[56rem] px-4 pt-8 pb-16 sm:px-6 lg:px-10 lg:pt-12">
      {children}
    </div>
  );
}
