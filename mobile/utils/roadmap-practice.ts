// Picking a roadmap day's topics out of the practice topic list: the same
// rules as the website's lib/roadmap-practice.ts (the keys come from
// /api/dsc-sgt/roadmap). A key matches a topic name, ignoring case:
// "=name" the whole name; Latin at the start of a word; Telugu anywhere.

/** A topic name the database stored with broken characters. */
export const isBrokenTopicName = (name: string) => name.includes('�');

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function keyMatches(key: string, name: string): boolean {
  const k = key.toLowerCase();
  const n = name.toLowerCase().trim();
  if (k.startsWith('=')) return n === k.slice(1);
  if (/^[\x00-\x7f]+$/.test(k)) return new RegExp(`(^|[^a-z0-9])${escapeRegExp(k)}`).test(n);
  return n.includes(k);
}

/** The topic names, out of those given, that a day's keys pick. */
export function matchPracticeTopics(names: readonly string[], keys: readonly string[]): string[] {
  return names.filter(name => !isBrokenTopicName(name) && keys.some(key => keyMatches(key, name)));
}
