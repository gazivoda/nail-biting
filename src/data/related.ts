export interface RelatedPost {
  slug: string;
  title: string;
  tag: string;
}

// The head-term pillar: the guide the rest of this corpus exists to support.
//
// It is named here because every non-Treatment post's own hub is a different
// guide, so the pillar would otherwise lose the inbound links from the other
// posts. getRelated appends it to each post whose hub is not the pillar.
export const PILLAR_SLUG = 'how-to-stop-nail-biting';

// Topic clusters: hub -> sub-cluster -> spoke slugs, in reading order.
const TOPIC_HUBS: { hub: string | null; clusters: string[][] }[] = [
  {
    hub: 'how-to-stop-nail-biting',
    clusters: [
      // T1 Clinical therapy
      ['habit-reversal-training-guide', 'nail-biting-cognitive-behavioral-therapy', 'acceptance-commitment-therapy-nail-biting', 'nail-biting-hypnosis', 'online-therapy-nail-biting', 'nail-biting-finding-a-therapist', 'nail-biting-app-vs-therapy'],
      // T2 Self-help techniques
      ['nail-biting-trigger-mapping', 'nail-biting-habit-tracking', 'nail-biting-stimulus-control', 'nail-biting-urge-surfing', 'nail-biting-mindfulness', 'nail-biting-habit-stacking', 'rubber-band-snap-nail-biting', 'nail-biting-accountability-partner', 'nail-biting-alternatives'],
      // T3 Barriers and deterrents
      ['products-to-stop-nail-biting', 'bitter-nail-polish-review', 'stop-biting-vs-mavala-stop', 'nail-biting-home-remedies', 'nail-biting-essential-oils', 'nail-biting-gloves', 'nail-biting-finger-tape', 'nail-biting-regular-nail-polish', 'nail-biting-short-nails-trimming', 'nail-biting-night-guard'],
      // T4 Manicure as barrier
      ['acrylics-to-stop-nail-biting', 'nail-biting-gel-manicure', 'press-on-nails-to-stop-nail-biting', 'uv-nail-lamps-safety', 'nail-biting-nail-technicians'],
      // T5 Hand and mouth substitutes
      ['nail-biting-fidget-toys', 'nail-biting-chewing-gum', 'nail-biting-substitute-habits'],
      // T6 Supplements and medication
      ['nac-nail-biting', 'inositol-nail-biting', 'nail-biting-magnesium', 'cbd-cannabis-nail-biting', 'nail-biting-medication'],
      // T7 Apps and detection tech
      ['best-apps-to-stop-nail-biting', 'how-ai-can-help-stop-nail-biting', 'stop-biting-app-review', 'nail-biting-wearable-technology', 'nail-biting-detection-accuracy', 'mediapipe-ai-detection-explained', 'webcam-privacy-nail-biting-app', 'nail-biting-camera-setup', 'nail-biting-app-battery-performance'],
      // T8 Plans and timelines
      ['best-nail-biting-remedies', 'stop-nail-biting-fast', 'nail-biting-30-day-plan', 'stop-nail-biting-challenge', 'how-long-to-stop-nail-biting', 'nail-biting-cold-turkey-or-gradual', 'how-to-choose-nail-biting-treatment', 'nail-biting-mistakes', 'nail-biting-new-years-resolution', 'nail-biting-cost', 'nail-biting-fsa-hsa'],
      // T9 Staying stopped
      ['nail-biting-cure', 'stopping-nail-biting-for-good', 'nail-biting-relapse', 'nail-biting-reddit', 'nail-biting-support-groups'],
    ],
  },
  {
    hub: 'bfrb-guide',
    clusters: [
      // B1 Classification
      ['onychophagia', 'nail-biting-mental-disorder', 'nail-biting-ocd-connection', 'is-nail-biting-self-harm', 'nail-biting-vs-tics-tourette', 'nail-biting-quiz', 'nail-biting-statistics'],
      // B2 Sibling BFRBs
      ['nail-biting-vs-skin-picking', 'nail-and-cuticle-picking', 'nail-biting-dermatophagia', 'nail-biting-vs-hair-pulling', 'nail-biting-vs-cheek-biting', 'nail-biting-toenails'],
      // B3 Habit look-alikes
      ['nail-biting-vs-pen-chewing', 'nail-biting-knuckle-cracking', 'nail-biting-vs-teeth-grinding', 'nail-biting-oral-fixation'],
      // B4 Co-occurring conditions
      ['nail-biting-adhd', 'nail-biting-autism', 'nail-biting-stimming', 'nail-biting-anxiety-treatment', 'nail-biting-panic-disorder', 'nail-biting-ptsd', 'nail-biting-and-depression', 'nail-biting-and-perfectionism'],
      // B5 Mechanism
      ['why-do-people-bite-their-nails', 'stress-and-nail-biting', 'nail-biting-cortisol', 'nail-biting-emotional-regulation', 'nail-biting-premonitory-urge', 'nail-biting-subconscious-habit', 'nail-biting-dopamine', 'breaking-any-habit-science', 'nail-biting-genetics', 'nail-biting-evolutionary-psychology', 'nail-biting-adults-why-persists'],
    ],
  },
  {
    hub: 'nail-biting-health-risks',
    clusters: [
      // H1 Infections
      ['nail-biting-paronychia', 'staph-mrsa-nail-biting', 'nail-biting-herpetic-whitlow', 'nail-biting-warts', 'nail-biting-fungal-infection'],
      // H2 Germs and swallowing
      ['nail-biting-bacteria-parasites', 'nail-biting-gut-health', 'nail-biting-immune-system', 'nail-biting-colds-flu-norovirus', 'nail-biting-hand-sanitizer', 'swallowing-fingernails', 'swallowing-nail-polish-biting', 'pinworm-nail-biting', 'nail-biting-healthcare-workers', 'nail-biting-chefs-food-service'],
      // H3 Mouth and jaw
      ['nail-biting-teeth-damage', 'nail-biting-gum-disease', 'nail-biting-jaw-pain-tmj'],
      // H4 Nail damage signs
      ['does-nail-biting-cause-permanent-damage', 'nail-biting-cuticle-damage', 'nail-biting-hangnails', 'nail-biting-onycholysis', 'nail-biting-nail-ridges-grooves', 'nail-biting-dark-line-on-nail', 'nail-biting-white-spots', 'nail-biting-cancer', 'nail-biting-fingerprints', 'when-to-see-a-doctor-for-nail-biting'],
      // H5 Recovery and nail care
      ['grow-nails-after-nail-biting', 'nail-care-routine-for-nail-biters', 'nail-biting-hand-cream-moisturiser', 'nail-biting-nail-hardeners', 'biotin-bitten-nails', 'nail-biting-vitamin-deficiency', 'nail-biting-eczema', 'nail-biting-dry-skin-winter'],
      // H6 Hormones and life stage
      ['nail-biting-pregnancy', 'nail-biting-menopause', 'nail-biting-birth-control', 'nail-biting-before-period', 'nail-biting-seniors-elderly'],
    ],
  },
  {
    hub: 'nail-biting-in-children',
    clusters: [
      // K1 Ages
      ['nail-biting-toddler', 'nail-biting-thumb-sucking', 'nail-biting-teenagers', 'nail-biting-college-students'],
      // K2 Parenting approach
      ['nail-biting-punishing-children', 'nail-biting-reward-chart-children', 'nail-biting-parents-modeling'],
      // K3 School
      ['nail-biting-during-exams', 'nail-biting-teachers', 'nail-biting-braces'],
    ],
  },
  {
    hub: 'nail-biting-by-situation',
    clusters: [
      // X1 Work and screens
      ['nail-biting-during-focus-and-work', 'nail-biting-at-work-meetings', 'nail-biting-laptop-working-from-home', 'nail-biting-screen-time', 'nail-biting-gaming'],
      // X2 Performance
      ['nail-biting-interview-anxiety', 'nail-biting-public-speaking', 'nail-biting-musicians', 'nail-biting-gym-sports'],
      // X3 Time and place
      ['nail-biting-evening', 'nail-biting-during-sleep', 'nail-biting-flights-travel', 'nail-biting-boredom', 'nail-biting-major-life-changes'],
      // X4 Substances and body state
      ['nail-biting-caffeine', 'nail-biting-alcohol', 'nail-biting-vaping-nicotine', 'nail-biting-after-quitting-smoking', 'nail-biting-lack-of-sleep', 'nail-biting-exercise'],
      // X5 Self-image and social
      ['nail-biting-social-confidence', 'nail-biting-self-esteem', 'nail-biting-shame-self-compassion', 'nail-biting-dating-relationships', 'how-to-help-someone-who-bites-their-nails', 'nail-biting-contagious', 'nail-biting-men', 'nail-biting-women'],
      // X6 Curiosity
      ['nail-biting-famous-people', 'nail-biting-personality', 'nail-biting-myths', 'nail-biting-which-fingers'],
    ],
  },
];

const TOPIC_OF = new Map<string, { hub: string | null; cluster: string[]; hubSpokes: string[] }>();
for (const { hub, clusters } of TOPIC_HUBS) {
  const hubSpokes = clusters.flat();
  for (const cluster of clusters) {
    for (const slug of cluster) TOPIC_OF.set(slug, { hub, cluster, hubSpokes });
  }
}
const HUB_SLUGS = TOPIC_HUBS.map(t => t.hub).filter((h): h is string => h !== null);

// Related articles for a post, used by both BlogPost.tsx (what visitors see)
// and scripts/generate-seo-content.mjs (what the server renders for crawlers),
// so the two can never disagree. Kept free of imports so Node can load it
// directly from the build script.
//
// Links follow topic, not tag. Tags are broad (33 Psychology posts that share
// nothing but a label), so the old tag cycle linked a post about jaw pain to
// one about perfectionism. Each spoke now links to the posts that FOLLOW it in
// its own sub-cluster, wrapping around, so every post in a cluster of four or
// more still receives exactly three inbound links. A cluster smaller than
// count + 1 borrows from the rest of its hub, then from its tag, then from the
// wider corpus. Posts not in the map (new ones) fall straight to the tag cycle.
//
// The link up is the post's hub guide, plus the head-term pillar when the hub
// is another one. The hubs link to each other. Both are appended last so the
// topic picks keep their positions.
export function getRelated<T extends RelatedPost>(
  posts: T[],
  currentSlug: string,
  count = 3,
): RelatedPost[] {
  const index = posts.findIndex(p => p.slug === currentSlug);
  if (index === -1) return [];

  const bySlug = new Map(posts.map(p => [p.slug, p]));
  const isHub = HUB_SLUGS.includes(currentSlug);
  const topic = TOPIC_OF.get(currentSlug);
  const uplinks = topic ? [topic.hub, PILLAR_SLUG] : [PILLAR_SLUG];

  const picks: RelatedPost[] = [];
  const add = (post: RelatedPost | undefined) => {
    if (!post || post.slug === currentSlug) return;
    // Hubs are appended once, in a fixed position, not landing in picks.
    if (!isHub && HUB_SLUGS.includes(post.slug)) return;
    if (picks.some(p => p.slug === post.slug)) return;
    picks.push({ slug: post.slug, title: post.title, tag: post.tag });
  };
  // Walk a slug list from just after this post, wrapping, until count is met.
  const cycle = (slugs: string[]) => {
    const at = slugs.indexOf(currentSlug);
    for (let i = 1; i < slugs.length && picks.length < count; i++) {
      add(bySlug.get(slugs[(Math.max(at, 0) + i) % slugs.length]));
    }
  };

  if (isHub) {
    // Hubs link to every other hub, not just the first `count`.
    for (const slug of HUB_SLUGS) add(bySlug.get(slug));
  } else if (topic) {
    cycle(topic.cluster);
    cycle(topic.hubSpokes);
  }

  const tagGroup = posts.filter(p => p.tag === posts[index].tag).map(p => p.slug);
  cycle(tagGroup);

  // Undersized groups fall back to the wider corpus, starting just after this
  // post so they don't all point at the same tail.
  for (let i = 1; i < posts.length && picks.length < count; i++) {
    add(posts[(index + i) % posts.length]);
  }

  if (!isHub) {
    const seen = new Set<string>();
    for (const slug of uplinks) {
      const up = slug ? bySlug.get(slug) : undefined;
      if (!up || seen.has(up.slug)) continue;
      seen.add(up.slug);
      picks.push({ slug: up.slug, title: up.title, tag: up.tag });
    }
  }

  return picks;
}

// One commercial page per post that is already about the thing it points to.
//
// getRelated only ever links post to post, so before this map no article
// reached a compare or solutions page except by a hand-written link in its
// body: the pages built to convert were reachable from the blog only through
// the nav. Each entry sends the reader to the page that answers the question
// the post leaves open. Posts without a natural fit are left out on purpose,
// because a forced link is a worse experience than none.
//
// Same constraint as getRelated: free of imports, shared by BlogPost.tsx and
// scripts/generate-seo-content.mjs so the visitor and the crawler see one link.
export interface ProductLink {
  href: string;
  label: string;
}

export const PRODUCT_LINKS: Record<string, ProductLink> = {
  'stop-biting-vs-mavala-stop': { href: '/compare/bitter-polish-alternative', label: 'Stop Biting vs bitter nail polish' },
  'products-to-stop-nail-biting': { href: '/compare/bitter-polish-alternative', label: 'Stop Biting vs bitter nail polish' },
  'nail-biting-alternatives': { href: '/compare/ai-detection-apps', label: 'AI apps that detect nail biting, compared' },
  'nail-biting-habit-tracking': { href: '/compare/habit-tracking-apps', label: 'Why habit tracking apps do not work for nail biting' },
  'nail-biting-adhd': { href: '/solutions/for-adhd', label: 'Nail biting and ADHD: how AI detection helps' },
  'nail-biting-wearable-technology': { href: '/compare/stop-biting-vs-habitaware', label: 'Stop Biting vs HabitAware (Keen): wrist sensor or webcam?' },
  'stop-biting-app-review': { href: '/compare/ai-detection-apps', label: 'AI apps that detect nail biting, compared' },
  'nail-biting-app-vs-therapy': { href: '/compare/ai-detection-apps', label: 'AI apps that detect nail biting, compared' },
  'nail-biting-reddit': { href: '/compare/ai-detection-apps', label: 'AI apps that detect nail biting, compared' },
  'nail-biting-cure': { href: '/how-it-works', label: 'How Stop Biting detects nail biting on your device' },
  'stop-nail-biting-fast': { href: '/how-it-works', label: 'How Stop Biting detects nail biting on your device' },
  'nail-biting-30-day-plan': { href: '/how-it-works', label: 'How Stop Biting detects nail biting on your device' },
  'nail-biting-quiz': { href: '/how-it-works', label: 'How Stop Biting detects nail biting on your device' },
  'nail-biting-cognitive-behavioral-therapy': { href: '/how-it-works', label: 'How Stop Biting detects nail biting on your device' },
  'nail-biting-gaming': { href: '/solutions/for-gamers', label: 'Stop nail biting while gaming' },
  'nail-biting-during-exams': { href: '/solutions/for-students', label: 'Stop nail biting as a student' },
  'nail-biting-college-students': { href: '/solutions/for-students', label: 'Stop nail biting as a student' },
  'nail-biting-laptop-working-from-home': { href: '/solutions/for-remote-workers', label: 'Stop nail biting while working from home' },
  'nail-biting-during-focus-and-work': { href: '/solutions/for-desk-workers', label: 'Stop nail biting at your desk' },
  'nail-biting-at-work-meetings': { href: '/solutions/for-desk-workers', label: 'Stop nail biting at your desk' },
  'bitter-nail-polish-review': { href: '/compare/bitter-polish-alternative', label: 'Stop Biting vs bitter nail polish' },
  'best-apps-to-stop-nail-biting': { href: '/compare/ai-detection-apps', label: 'AI apps that detect nail biting, compared' },
  'how-ai-can-help-stop-nail-biting': { href: '/compare/ai-detection-apps', label: 'AI apps that detect nail biting, compared' },
  'webcam-privacy-nail-biting-app': { href: '/how-it-works', label: 'How Stop Biting detects nail biting on your device' },
  'mediapipe-ai-detection-explained': { href: '/how-it-works', label: 'How Stop Biting detects nail biting on your device' },
  'nail-biting-detection-accuracy': { href: '/how-it-works', label: 'How Stop Biting detects nail biting on your device' },
  'nail-biting-camera-setup': { href: '/how-it-works', label: 'How Stop Biting detects nail biting on your device' },
  'nail-biting-app-battery-performance': { href: '/how-it-works', label: 'How Stop Biting detects nail biting on your device' },
};
