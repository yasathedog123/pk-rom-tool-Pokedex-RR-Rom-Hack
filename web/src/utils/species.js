/**
 * Species name resolution with fuzzy matching.
 *
 * Resolution order:
 *  1. EXACT_ALIASES (priority overrides for special characters, known ROM hack names)
 *  2. Direct slug lookup against PokeAPI
 *  3. Fuzzy match against the full PokeAPI pokemon index (fetched once, cached)
 *
 * The fuzzy matcher uses Levenshtein distance against a base-name index
 * built from PokeAPI's full pokemon list. This handles:
 *  - Radical Red's 10-char truncation (IRONVALINT → iron-valiant)
 *  - Form-based Pokemon (Mimikyu → mimikyu-disguised)
 *  - Any ROM hack's custom species name mangling
 */

import { normalize, fuzzyMatchFromIndex, buildFuzzyIndex } from './fuzzy';

const EXACT_ALIASES = {
  MrMime: 'mr-mime',
  MRMIME: 'mr-mime',
  MimeJr: 'mime-jr',
  MIMEJR: 'mime-jr',
  MrRime: 'mr-rime',
  MRRIME: 'mr-rime',
  'Mr. Mime': 'mr-mime',
  'Mime Jr.': 'mime-jr',
  'Mr. Rime': 'mr-rime',
  Farfetchd: 'farfetchd',
  FARFETCHD: 'farfetchd',
  "Farfetch'd": 'farfetchd',
  Sirfetchd: 'sirfetchd',
  SIRFETCHD: 'sirfetchd',
  "Sirfetch'd": 'sirfetchd',
  TypeNull: 'type-null',
  TYPENULL: 'type-null',
  'Type: Null': 'type-null',
  TapuKoko: 'tapu-koko',
  TAPUKOKO: 'tapu-koko',
  TapuLele: 'tapu-lele',
  TAPULELE: 'tapu-lele',
  TapuBulu: 'tapu-bulu',
  TAPUBULU: 'tapu-bulu',
  TapuFini: 'tapu-fini',
  TAPUFINI: 'tapu-fini',
  'Nidoran♀': 'nidoran-f',
  'Nidoran♂': 'nidoran-m',
  NIDORANF: 'nidoran-f',
  NIDORANM: 'nidoran-m',
  'Flabébé': 'flabebe',
  FLABEBE: 'flabebe',
};

// --- PokeAPI Index (fetched once, cached) ---

let pokemonIndexPromise = null;
let pokemonIndex = null;

async function fetchPokemonIndex() {
  try {
    const resp = await fetch('https://pokeapi.co/api/v2/pokemon?limit=2000');
    if (!resp.ok) return null;
    const data = await resp.json();
    return buildFuzzyIndex(data.results || []);
  } catch {
    return null;
  }
}

function getPokemonIndex() {
  if (pokemonIndex) return Promise.resolve(pokemonIndex);
  if (!pokemonIndexPromise) {
    pokemonIndexPromise = fetchPokemonIndex().then(idx => {
      pokemonIndex = idx;
      return idx;
    });
  }
  return pokemonIndexPromise;
}

// --- Core resolution ---

const POKEAPI_DATA_CACHE = new Map();
const POKEAPI_CACHE = new Map();

function tidySpeciesName(name = '') {
  return String(name).trim();
}

function basicSlug(name) {
  return name
    .toLowerCase()
    .replace(/♀/g, '-f')
    .replace(/♂/g, '-m')
    .replace(/['':.]/g, '')
    .replace(/\s+/g, '-')
    .replace(/_/g, '-')
    .replace(/--+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '');
}

export function spriteCandidates(speciesName = '') {
  const clean = tidySpeciesName(speciesName);
  if (!clean) return [];

  const candidates = [];
  const exact = EXACT_ALIASES[clean];
  if (exact) candidates.push(exact);

  const slug = basicSlug(clean);
  if (slug) candidates.push(slug);

  const strippedRegional = slug
    .replace(/-sevii$/i, '')
    .replace(/-alola$/i, '')
    .replace(/-galar$/i, '')
    .replace(/-hisui$/i, '')
    .replace(/-paldea$/i, '')
    .replace(/-paldean$/i, '')
    .replace(/-mega.*$/i, '')
    .replace(/-gmax$/i, '');
  if (strippedRegional && strippedRegional !== slug) candidates.push(strippedRegional);

  return [...new Set(candidates)];
}

function extractBaseStats(data) {
  if (!data?.stats) return null;
  const map = {};
  let total = 0;
  for (const s of data.stats) {
    const val = s.base_stat ?? 0;
    total += val;
    switch (s.stat?.name) {
      case 'hp': map.hp = val; break;
      case 'attack': map.attack = val; break;
      case 'defense': map.defense = val; break;
      case 'special-attack': map.specialAttack = val; break;
      case 'special-defense': map.specialDefense = val; break;
      case 'speed': map.speed = val; break;
    }
  }
  map.total = total;
  return map;
}

async function tryFetch(slug) {
  const resp = await fetch(`https://pokeapi.co/api/v2/pokemon/${slug}`);
  if (!resp.ok) return null;
  return resp.json();
}

async function fetchPokeApiData(speciesName) {
  for (const candidate of spriteCandidates(speciesName)) {
    try {
      const data = await tryFetch(candidate);
      if (data) {
        return {
          sprite: data.sprites?.front_default ||
            data.sprites?.other?.['official-artwork']?.front_default || null,
          baseStats: extractBaseStats(data),
        };
      }
    } catch {
      // continue
    }
  }

  // Fuzzy fallback: match against the full PokeAPI index
  const index = await getPokemonIndex();
  const fuzzySlug = fuzzyMatchFromIndex(speciesName, index);
  if (fuzzySlug) {
    try {
      const data = await tryFetch(fuzzySlug);
      if (data) {
        return {
          sprite: data.sprites?.front_default ||
            data.sprites?.other?.['official-artwork']?.front_default || null,
          baseStats: extractBaseStats(data),
        };
      }
    } catch {
      // fall through
    }
  }

  return { sprite: null, baseStats: null };
}

export async function resolvePokeApiData(speciesName) {
  if (!speciesName) return { sprite: null, baseStats: null };
  if (POKEAPI_DATA_CACHE.has(speciesName)) return POKEAPI_DATA_CACHE.get(speciesName);
  const promise = fetchPokeApiData(speciesName);
  POKEAPI_DATA_CACHE.set(speciesName, promise);
  return promise;
}

export async function resolvePokeApiSprite(speciesName) {
  if (!speciesName) return null;
  if (POKEAPI_CACHE.has(speciesName)) return POKEAPI_CACHE.get(speciesName);
  const promise = resolvePokeApiData(speciesName).then(d => d.sprite);
  POKEAPI_CACHE.set(speciesName, promise);
  return promise;
}
