import type { TagOption } from './triggerTags';

// The glyph before a trigger label: a line icon for presets, the user's own
// emoji for tags they added. Decorative; the label beside it carries meaning.
export function TagMark({ tag, size = 16 }: { tag: TagOption; size?: number }) {
  if (tag.icon) {
    const Icon = tag.icon;
    return <Icon size={size} aria-hidden="true" className="flex-shrink-0 text-stone-500 dark:text-stone-400" />;
  }
  return tag.emoji ? <span aria-hidden="true">{tag.emoji}</span> : null;
}
