export function parseCategories(catStr: string | null | undefined): string[] {
  if (!catStr) return [];
  return catStr.split(',').map(s => s.trim()).filter(Boolean);
}

export function canonicalizeCategory(cat: string): string {
  if (!cat) return "";
  const trimmed = cat.trim();
  if (!trimmed) return "";
  return trimmed.replace(/\b[a-z]/g, (char) => char.toUpperCase());
}

export function deduplicateCategories(categories: (string | null | undefined)[]): string[] {
  const map = new Map<string, string>();
  for (const raw of categories) {
    if (!raw) continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (!map.has(lower)) {
      map.set(lower, canonicalizeCategory(trimmed));
    }
  }
  return Array.from(map.values());
}

export function categoryMatches(
  itemCategory: string | string[] | null | undefined,
  filterCategory: string | null | undefined
): boolean {
  if (!filterCategory || filterCategory === "All") return true;
  const target = filterCategory.trim().toLowerCase();
  if (target === "all") return true;

  if (Array.isArray(itemCategory)) {
    return itemCategory.some(c => (c || '').trim().toLowerCase() === target);
  }

  const parsed = parseCategories(itemCategory);
  if (parsed.length > 0) {
    return parsed.some(c => c.toLowerCase() === target);
  }

  return (itemCategory || '').trim().toLowerCase() === target;
}

