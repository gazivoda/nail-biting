// The app's page heading in the Signal style: Bricolage display, one word under
// the lime marker swash (light ground; plain on the dark ground, where lime is
// kept for actions). Same box as
// PageHeader so the pages line up with the rest of the app.
export function PageTitle({ before, mark }: { before?: string; mark: string }) {
  return (
    <header className="mb-7">
      <h1 className="font-display text-[2.75rem] sm:text-6xl font-extrabold leading-[0.95] tracking-[-0.045em] text-stone-900 dark:text-stone-100">
        {before && <>{before} </>}
        <span className="sg-mark dark:!bg-none">{mark}</span>
      </h1>
    </header>
  );
}
