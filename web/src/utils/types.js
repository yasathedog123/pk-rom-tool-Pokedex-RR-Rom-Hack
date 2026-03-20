export const TYPE_COLORS = {
  Normal:   '#929da3',
  Fire:     '#ff9c54',
  Water:    '#4d90d5',
  Electric: '#f3d23b',
  Grass:    '#5fbd58',
  Ice:      '#73cec0',
  Fighting: '#ce4069',
  Poison:   '#ab6ac8',
  Ground:   '#d97746',
  Flying:   '#8fa8dd',
  Psychic:  '#f97176',
  Bug:      '#90c12c',
  Rock:     '#c7b78b',
  Ghost:    '#5269ac',
  Dragon:   '#0a6dc4',
  Dark:     '#5a5366',
  Steel:    '#5a8ea1',
  Fairy:    '#ec8fe6',
};

const SHOWDOWN_SPRITE_BASE = 'https://play.pokemonshowdown.com/sprites/sv';

const SPECIES_ALIASES = {
  IronBouldr: 'ironboulder',
  IronLeaves: 'ironleaves',
  IronMoth: 'ironmoth',
  IronHands: 'ironhands',
  IronJuguls: 'ironjugulis',
  IronThorns: 'ironthorns',
  IronTreads: 'irontreads',
  IronBundle: 'ironbundle',
  GreatTusk: 'greattusk',
  ScreamTail: 'screamtail',
  BruteBonnet: 'brutebonnet',
  FlutterMane: 'fluttermane',
  SlitherWing: 'slitherwing',
  SandyShocks: 'sandyshocks',
  RoaringMoon: 'roaringmoon',
  WalkingWake: 'walkingwake',
  RagingBolt: 'ragingbolt',
  GougingFire: 'gougingfire',
  Terapagos: 'terapagos',
};

export function toShowdownId(speciesName = '') {
  if (!speciesName) return '';
  if (SPECIES_ALIASES[speciesName]) return SPECIES_ALIASES[speciesName];
  return speciesName
    .toLowerCase()
    .replace(/♀/g, 'f')
    .replace(/♂/g, 'm')
    .replace(/['’:.\\s-]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function spriteUrl(speciesName) {
  const id = toShowdownId(speciesName);
  return id ? `${SHOWDOWN_SPRITE_BASE}/${id}.png` : null;
}
