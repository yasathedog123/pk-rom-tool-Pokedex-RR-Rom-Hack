export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const m = a.length;
  const n = b.length;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);

  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost,
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

export function normalize(str) {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function fuzzyMatchFromIndex(input, index) {
  if (!index) return null;

  const norm = normalize(input);
  if (!norm) return null;

  if (index.allSlugs.has(norm)) return norm;

  const baseHit = index.baseToSlug.get(norm);
  if (baseHit) return baseHit;

  let bestSlug = null;
  let bestDist = Infinity;

  for (const slug of index.list) {
    const slugNorm = normalize(slug);

    const dist = levenshtein(norm, slugNorm);
    if (dist < bestDist) {
      bestDist = dist;
      bestSlug = slug;
    }

    const base = slug.split('-')[0];
    const baseDist = levenshtein(norm, base);
    if (baseDist < bestDist) {
      bestDist = baseDist;
      bestSlug = slug;
    }
  }

  const maxLen = Math.max(norm.length, bestSlug ? normalize(bestSlug).length : 0);
  const threshold = Math.max(3, Math.floor(maxLen * 0.35));
  if (bestDist <= threshold) return bestSlug;

  return null;
}

export function buildFuzzyIndex(nameList) {
  const baseToSlug = new Map();
  const allSlugs = new Set();

  for (const { name } of nameList) {
    allSlugs.add(name);
    const base = name.split('-')[0];
    if (!baseToSlug.has(base)) {
      baseToSlug.set(base, name);
    }
    const norm = normalize(name);
    if (!baseToSlug.has(norm)) {
      baseToSlug.set(norm, name);
    }
  }

  return { baseToSlug, allSlugs, list: nameList.map(p => p.name) };
}
