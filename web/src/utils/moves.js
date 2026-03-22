import { normalize, fuzzyMatchFromIndex, buildFuzzyIndex } from './fuzzy';

let moveIndexPromise = null;
let moveIndex = null;

async function fetchMoveIndex() {
  try {
    const resp = await fetch('https://pokeapi.co/api/v2/move?limit=1000');
    if (!resp.ok) return null;
    const data = await resp.json();
    return buildFuzzyIndex(data.results || []);
  } catch {
    return null;
  }
}

function getMoveIndex() {
  if (moveIndex) return Promise.resolve(moveIndex);
  if (!moveIndexPromise) {
    moveIndexPromise = fetchMoveIndex().then(idx => {
      moveIndex = idx;
      return idx;
    });
  }
  return moveIndexPromise;
}

function moveSlug(name) {
  return name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function tryFetchMove(slug) {
  const resp = await fetch(`https://pokeapi.co/api/v2/move/${slug}`);
  if (!resp.ok) return null;
  return resp.json();
}

function extractMoveData(data) {
  if (!data) return null;

  const enEffect = (data.effect_entries || []).find(
    e => e.language?.name === 'en'
  );

  return {
    type: data.type?.name || null,
    power: data.power,
    accuracy: data.accuracy,
    damageClass: data.damage_class?.name || null,
    description: enEffect?.short_effect || null,
  };
}

const MOVE_CACHE = new Map();

async function fetchMoveData(moveName) {
  const slug = moveSlug(moveName);
  if (!slug) return null;

  try {
    const data = await tryFetchMove(slug);
    if (data) return extractMoveData(data);
  } catch { /* continue */ }

  const norm = normalize(moveName);
  const idx = await getMoveIndex();
  if (idx) {
    const directHit = idx.baseToSlug.get(norm) || (idx.allSlugs.has(slug) ? slug : null);
    if (directHit && directHit !== slug) {
      try {
        const data = await tryFetchMove(directHit);
        if (data) return extractMoveData(data);
      } catch { /* continue */ }
    }

    const fuzzySlug = fuzzyMatchFromIndex(moveName, idx);
    if (fuzzySlug && fuzzySlug !== slug && fuzzySlug !== directHit) {
      try {
        const data = await tryFetchMove(fuzzySlug);
        if (data) return extractMoveData(data);
      } catch { /* fall through */ }
    }
  }

  return null;
}

export async function resolveMoveData(moveName) {
  if (!moveName) return null;
  if (MOVE_CACHE.has(moveName)) return MOVE_CACHE.get(moveName);
  const promise = fetchMoveData(moveName);
  MOVE_CACHE.set(moveName, promise);
  return promise;
}
