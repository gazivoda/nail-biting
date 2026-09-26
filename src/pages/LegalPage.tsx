import type { ReactNode } from 'react';
import { SiteHeader } from '../components/site/SiteHeader';
import { SiteFooter } from '../components/site/SiteFooter';
import { useTheme } from '../hooks/useTheme';

interface Section {
  heading: string;
  content: string | string[];
}

interface Props {
  title: string;
  lastUpdated: string;
  sections: Section[];
  /**
   * Optional standfirst under the title. Carries `article-summary`, the class
   * the JSON-LD SpeakableSpecification selector names — server.js puts the same
   * class on the standfirst of the copy it renders for crawlers.
   */
  standfirst?: string;
  /** Rendered after the sections (the author box on /editorial-policy). */
  children?: ReactNode;
}

export function LegalPage({ title, lastUpdated, sections, standfirst, children }: Props) {
  useTheme('light');

  // Same header, footer and type as every other page: the privacy policy is
  // where people check whether to trust the camera app, so it should not look
  // like a different site.
  return (
    <div className="sg-page min-h-dvh bg-[color:var(--sg-ground)]">
      <div className="sg-page"><SiteHeader /></div>

      <main id="main" className="max-w-2xl mx-auto px-6 pt-28 pb-20">
        <h1 className="sg-h2">{title}</h1>
        <p className="sg-note mt-3">Last updated: {lastUpdated}</p>
        {standfirst && (
          <p className="article-summary sg-lede mt-5">{standfirst}</p>
        )}

        <div className="mt-10 space-y-9">
          {sections.map(({ heading, content }) => (
            <section key={heading}>
              <h2 className="sg-h3 mb-3">{heading}</h2>
              {Array.isArray(content) ? (
                <ul className="sg-body list-disc space-y-2 pl-5 marker:text-[color:var(--sg-accent)]">
                  {content.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="sg-body">{content}</p>
              )}
            </section>
          ))}
        </div>

        {children}

        <p className="sg-small mt-14 border-t border-[color:var(--sg-rule)] pt-6">
          Questions about this page: <a href="mailto:hello@stopbiting.today" className="sg-link">hello@stopbiting.today</a>
        </p>
      </main>

      <div className="sg-page"><SiteFooter /></div>
    </div>
  );
}
