// Editorial identity: who writes this site, what he is qualified to say, and
// the rules he actually follows. One home for two pieces of copy that must be
// identical everywhere they appear:
//
//   AUTHOR_BIO         the author box under every article and comparison page,
//                      rendered by BlogPost.tsx / ComparePage.tsx for visitors
//                      and by server.js for crawlers that never run JS.
//   EDITORIAL_POLICY   the /editorial-policy page itself.
//
// EVERY SENTENCE BELOW DESCRIBES SOMETHING THIS REPOSITORY ACTUALLY DOES.
// There is no editorial board, no medical reviewer, no staff and no review
// cadence, so none is claimed. The evidence for each clause, in case a future
// edit is tempted to inflate it:
//
//   "one person writes it"        SCHEMA_AUTHOR in server.js names one Person
//                                 on all 152 content pages; the byline is the
//                                 same string on every one.
//   "not a clinician"             src/pages/About.tsx and the /about SSR copy:
//                                 "I'm Igor Gazivoda, a software developer."
//                                 Nothing in this repo is medically reviewed
//                                 and no credential is claimed anywhere.
//   "standing health disclaimer"  MEDICAL_DISCLAIMER_SECTION, appended as the
//                                 final section in src/data/blogPosts.ts and
//                                 duplicated verbatim in comparePages.ts,
//                                 where all 9 pages carry it.
//   "citations point at papers"   the Sources blocks in blogPosts.ts, and the
//                                 repointed/removed links recorded in
//                                 tasks/todo.md (a dental-news digest swapped
//                                 for the study, a characterisation absent
//                                 from the paper's full text, an agency page
//                                 carrying no nail guidance).
//   "soften or delete"            tasks/todo.md, iteration 1: five unsourced
//                                 claims deleted, eight softened, eleven
//                                 sources re-fetched and verified.
//   "competitor re-verification"  the FACT-CHECK LOG comment in
//                                 comparePages.ts and the dated, visible
//                                 verificationSection() that closes all 9
//                                 pages, including the four corrections that
//                                 went against us (a fifth behaviour we had
//                                 omitted, a tracker we had implied was ours
//                                 alone, a macOS version we had denied, and a
//                                 price the vendor's own store contradicted).
//   "what the dates mean"         the freshness ledger in scripts/sync-seo.mjs:
//                                 fingerprints the rendered VISIBLE TEXT, so
//                                 markup and schema edits cannot move a date.
//   "commercial disclosure"       "Disclosure: Stop Biting is our product" in
//                                 the intro of each head-to-head comparison.
//   "corrections by email"        hello@stopbiting.today, the contact address
//                                 already published in the site footer.

/** Same shape LegalPage.tsx renders: a string is a paragraph, an array is a list. */
export interface PolicySection {
  heading: string;
  content: string | string[];
}

export const EDITORIAL_POLICY_PATH = '/editorial-policy';

/**
 * The author box under every article.
 *
 * `bio` deliberately names what Igor is NOT. On a site covering infection,
 * medication and children's mental health, saying plainly that the author is a
 * developer rather than a clinician is the honest trust signal; implying
 * clinical authority he does not have would be the opposite.
 *
 * It also deliberately avoids the words "onychophagia", "habit reversal
 * training" and "bitter-taste nail polish". conditionIsVisible() in server.js
 * grants a page the MedicalCondition entity only when its own visible text
 * names the condition AND one of its treatments; boilerplate that appears on
 * all 152 articles must not be able to satisfy that gate for them.
 */
export const AUTHOR_BIO = {
  name: 'Igor Gazivoda',
  role: 'Founder, Stop Biting',
  bio: `Igor is a software developer — not a doctor, therapist or researcher. He bit his nails for over 20 years, tried bitter polish, reminder bands and willpower without success, and built Stop Biting to supply the one thing none of them did: something outside his own attention that notices when his hand moves toward his mouth.`,
};

export const EDITORIAL_POLICY = {
  title: 'Editorial Policy and Corrections',
  lastUpdated: '10 September 2026',
  standfirst: `Who writes this site, what he is qualified to say, how claims get sourced, and what happens when something here turns out to be wrong.`,
  sections: [
    {
      heading: 'One person writes this site',
      content: `Every article, guide and comparison on stopbiting.today is written by Igor Gazivoda, who built Stop Biting. There is no editorial team, no staff writers and no guest contributors. His name is the byline on every page because he is the only person it could be.`,
    },
    {
      heading: 'He is not a clinician, and this site does not pretend otherwise',
      content: `Igor is a software developer. He bit his nails for more than 20 years — automatically, without noticing, until the damage was already done — and built this app after bitter polish, reminder bands and willpower had each failed him. That lived experience is the qualification this site actually has, and it is the only one it claims. He is not a doctor, dermatologist, dentist, psychologist or researcher. Nothing published here is medically reviewed, and no article is a substitute for a professional who can examine you.`,
    },
    {
      heading: 'Health topics carry a standing disclaimer',
      content: `Articles that touch on infection, medication, supplements, children, pregnancy or mental health end with a note saying they are general information rather than medical advice, and pointing readers to the TLC Foundation for Body-Focused Repetitive Behaviors directory of BFRB-informed clinicians. All nine comparison pages carry the same note.`,
    },
    {
      heading: 'How claims are sourced',
      content: [
        `Citations point at the study itself — PubMed, PMC or the publisher — rather than at a news write-up of it.`,
        `Every citation is opened and read against the sentence it is attached to before it ships. Links that turned out not to support their claim have been repointed or removed: one led to a dental-news digest instead of the study, one credited a paper with a characterisation its full text does not contain, and one pointed at a health agency page carrying no nail guidance at all.`,
        `A claim that cannot be traced to a source is softened or deleted. It is never handed a citation that does not support it, and no figure stays on the page merely because it was written down first.`,
      ],
    },
    {
      heading: 'How claims about competing products are checked',
      content: `Every statement about another company's product is checked against that company's own website — and against the app store listing that site links to, when the two disagree. Each comparison page closes with a dated "How we verified this page" section naming what was checked and when. Competitor details are re-checked quarterly, and the date shown on a page is a date on which a check actually ran.`,
    },
    {
      heading: 'Corrections that make us look worse get published too',
      content: `The most recent pass added a fifth behaviour a rival covers that we had left out of its column, credited a progress tracker our copy had implied only we shipped, withdrew a "no Mac version" claim its own store listing contradicted, and stopped asserting a competitor's price that the same vendor's store listing put at something else. Each of those corrections is described on the page it affected, in the reader's view, not in a changelog.`,
    },
    {
      heading: 'What the dates mean',
      content: `The updated date on a page is derived from a fingerprint of the text a reader actually sees. Restyling a page, rewriting its markup or changing its structured data does not move that date; changing a sentence does. The same value feeds the visible page, the sitemap and the structured data, so the three cannot disagree with each other.`,
    },
    {
      heading: 'Commercial disclosure',
      content: `Stop Biting is a paid product and this site exists to sell it. The pages that compare it head-to-head with a competing app say so in their own opening paragraph rather than leaving you to work it out.`,
    },
    {
      heading: 'Corrections and contact',
      content: `If something here is wrong, email hello@stopbiting.today. Corrections are made in the page itself rather than filed in a separate log — one person maintains this site, and a fix a reader can see is worth more than an archive nobody opens. When a correction changes what a page claims, the change is described in that page's own verification section, and the page's updated date moves with it.`,
    },
  ] as PolicySection[],
};
