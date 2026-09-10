import { LegalPage } from './LegalPage';
import { AUTHOR_BIO, EDITORIAL_POLICY, EDITORIAL_POLICY_PATH } from '../data/editorialPolicy';

/**
 * Author box: who wrote the article you just read, and what he is not.
 *
 * It lives beside the editorial policy rather than in components/ because the
 * two are one surface — a named author with no published standards is half a
 * trust signal, and the box exists to link the one to the other. Both render
 * from src/data/editorialPolicy.ts, which server.js also renders for crawlers
 * (via dist/seo-content.json), so the visitor's copy and the crawler's copy are
 * the same strings.
 *
 * `policyLink` is off on /editorial-policy itself, where it would point at the
 * page you are already reading.
 */
export function AuthorBox({ policyLink = true }: { policyLink?: boolean }) {
  return (
    <footer className="mt-14 rounded-2xl border border-stone-200 dark:border-ink-400 bg-white dark:bg-ink-50 p-6">
      <h2 className="text-sm font-semibold text-stone-800 dark:text-stone-100 mb-2">About the author</h2>
      <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed">
        <a href="/about" className="font-medium text-stone-700 dark:text-stone-200 hover:text-forest-600 dark:hover:text-forest-400 transition-colors">
          {AUTHOR_BIO.name}
        </a>
        {` — ${AUTHOR_BIO.role}. ${AUTHOR_BIO.bio}`}
      </p>
      <p className="mt-3 text-xs text-stone-400 dark:text-stone-500">
        <a href="/about" className="hover:text-stone-600 dark:hover:text-stone-300 transition-colors">
          More about Igor and why he built this
        </a>
        {policyLink && (
          <>
            {' · '}
            <a href={EDITORIAL_POLICY_PATH} className="hover:text-stone-600 dark:hover:text-stone-300 transition-colors">
              Editorial policy and corrections
            </a>
          </>
        )}
      </p>
    </footer>
  );
}

/**
 * /editorial-policy — the standards page the author box and the footer link to.
 *
 * Content comes from src/data/editorialPolicy.ts, whose header records the
 * repository evidence behind every sentence. Do not add a claim here that the
 * repo does not actually do.
 */
export function EditorialPolicyPage() {
  return (
    <LegalPage
      title={EDITORIAL_POLICY.title}
      lastUpdated={EDITORIAL_POLICY.lastUpdated}
      standfirst={EDITORIAL_POLICY.standfirst}
      sections={EDITORIAL_POLICY.sections}
    >
      <AuthorBox policyLink={false} />
    </LegalPage>
  );
}
