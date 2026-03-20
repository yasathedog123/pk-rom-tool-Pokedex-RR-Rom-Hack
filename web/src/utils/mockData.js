const MAX_PLAYERS = 4;

const SPECIES_POOL = [
  { name: 'Pikachu',    types: ['Electric'] },
  { name: 'Charizard',  types: ['Fire', 'Flying'] },
  { name: 'Gardevoir',  types: ['Psychic', 'Fairy'] },
  { name: 'Lucario',    types: ['Fighting', 'Steel'] },
  { name: 'Gengar',     types: ['Ghost', 'Poison'] },
  { name: 'Gyarados',   types: ['Water', 'Flying'] },
  { name: 'Dragonite',  types: ['Dragon', 'Flying'] },
  { name: 'Scizor',     types: ['Bug', 'Steel'] },
  { name: 'Tyranitar',  types: ['Rock', 'Dark'] },
  { name: 'Salamence',  types: ['Dragon', 'Flying'] },
  { name: 'Metagross',  types: ['Steel', 'Psychic'] },
  { name: 'Togekiss',   types: ['Fairy', 'Flying'] },
  { name: 'Excadrill',  types: ['Ground', 'Steel'] },
  { name: 'Volcarona',  types: ['Bug', 'Fire'] },
  { name: 'Aegislash',  types: ['Steel', 'Ghost'] },
  { name: 'Mimikyu',    types: ['Ghost', 'Fairy'] },
  { name: 'Toxapex',    types: ['Poison', 'Water'] },
  { name: 'Corviknight', types: ['Flying', 'Steel'] },
  { name: 'Dragapult',  types: ['Dragon', 'Ghost'] },
  { name: 'Blaziken',   types: ['Fire', 'Fighting'] },
  { name: 'Swampert',   types: ['Water', 'Ground'] },
  { name: 'Alakazam',   types: ['Psychic'] },
  { name: 'Starmie',    types: ['Water', 'Psychic'] },
  { name: 'Arcanine',   types: ['Fire'] },
  { name: 'Jolteon',    types: ['Electric'] },
  { name: 'Snorlax',    types: ['Normal'] },
  { name: 'Heracross',  types: ['Bug', 'Fighting'] },
  { name: 'Kingdra',    types: ['Water', 'Dragon'] },
];

const NATURES = [
  'Adamant', 'Jolly', 'Modest', 'Timid', 'Bold', 'Calm',
  'Impish', 'Careful', 'Brave', 'Quiet', 'Naive', 'Hasty',
];

const HELD_ITEMS = [
  'Leftovers', 'Choice Band', 'Choice Scarf', 'Life Orb', 'Focus Sash',
  'Assault Vest', 'Rocky Helmet', 'Eviolite', 'None',
];

const TRAINER_NAMES = ['Ash', 'Misty', 'Brock', 'Gary', 'Cynthia', 'Steven', 'Lance', 'Red'];

const ROUTE_NAMES = [
  'Route 1', 'Route 2', 'Route 3', 'Route 4', 'Route 5',
  'Viridian Forest', 'Mt. Moon', 'Rock Tunnel', 'Safari Zone',
  'Route 11', 'Route 12', 'Cerulean Cave',
];

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let personalityCounter = 900000;

function generateMockMon(level) {
  const sp = pick(SPECIES_POOL);
  const maxHp = rand(40, 200);
  const alive = Math.random() > 0.15;
  const hp = alive ? rand(1, maxHp) : 0;
  personalityCounter++;

  return {
    personality: personalityCounter,
    species_name: sp.name,
    species: sp.name,
    nickname: Math.random() > 0.4 ? sp.name : pick(['Buddy', 'Shadow', 'Tank', 'Zippy', 'Flash', 'Rex', 'Luna']),
    level: level || rand(5, 65),
    current_hp: hp,
    max_hp: maxHp,
    types: sp.types,
    alive,
    nature: pick(NATURES),
    held_item: pick(HELD_ITEMS),
    friendship: rand(0, 255),
    isShiny: Math.random() < 0.05,
    status: alive ? (Math.random() < 0.85 ? 'Healthy' : pick(['Poisoned', 'Burned', 'Paralyzed'])) : 'Healthy',
    ivs: {
      hp: rand(0, 31), attack: rand(0, 31), defense: rand(0, 31),
      specialAttack: rand(0, 31), specialDefense: rand(0, 31), speed: rand(0, 31),
    },
    evs: {
      hp: rand(0, 3) * 84, attack: rand(0, 3) * 84, defense: rand(0, 3) * 84,
      specialAttack: rand(0, 3) * 84, specialDefense: rand(0, 3) * 84, speed: rand(0, 3) * 84,
    },
  };
}

function generateMockParty() {
  const size = rand(3, 6);
  const party = [];
  for (let i = 0; i < size; i++) {
    party.push(generateMockMon(rand(5, 65)));
  }
  return party;
}

function generateMockRoutes(playerIds) {
  const routeCount = rand(5, 10);
  const routes = shuffle(ROUTE_NAMES).slice(0, routeCount);
  const pairs = [];

  for (let i = 0; i < routeCount; i++) {
    const pokemon = {};
    for (const pid of playerIds) {
      pokemon[pid] = generateMockMon(rand(5, 50));
    }
    pairs.push({
      route: 101 + i,
      route_name: routes[i],
      pokemon,
    });
  }
  return pairs;
}

function generateMockEvents(playerNames) {
  const events = [];
  const count = rand(3, 8);
  for (let i = 0; i < count; i++) {
    const sp = pick(SPECIES_POOL);
    const playerName = pick(playerNames);
    const isCatch = Math.random() > 0.3;
    events.push({
      id: `mock-ev-${i}`,
      type: isCatch ? 'catch' : 'faint',
      player_name: playerName,
      pokemon: {
        species_name: sp.name,
        nickname: sp.name,
        met_location_name: pick(ROUTE_NAMES),
      },
    });
  }
  return events;
}

export function getMockPlayerCount() {
  try {
    const params = new URLSearchParams(window.location.search);
    const val = parseInt(params.get('mock'), 10);
    if (isNaN(val) || val < 1) return 0;
    return Math.min(val, MAX_PLAYERS - 1);
  } catch {
    return 0;
  }
}

export function generateMockData(localPlayer) {
  const mockCount = getMockPlayerCount();
  if (mockCount === 0) return null;

  const availableNames = shuffle(TRAINER_NAMES);
  const mockPlayers = [];

  for (let i = 0; i < mockCount; i++) {
    const pid = `mock-player-${i + 1}`;
    mockPlayers.push({
      name: availableNames[i] || `Player ${i + 2}`,
      playerId: pid,
      party: generateMockParty(),
      spriteUrl: null,
      money: rand(500, 99999),
      coins: rand(0, 5000),
    });
  }

  const allPlayers = [localPlayer, ...mockPlayers];
  const allPlayerIds = allPlayers.map(p => p.playerId);
  const playerNames = allPlayers.map(p => p.name);

  const roomPairs = generateMockRoutes(allPlayerIds);
  const roomEvents = generateMockEvents(playerNames);

  const roomPlayers = allPlayers.map(p => ({
    player_id: p.playerId,
    player_name: p.name,
  }));

  const roomLinks = roomPairs.map(pair => ({
    route: pair.route,
    routeName: pair.route_name,
    pokemon: pair.pokemon,
    anyDead: Object.values(pair.pokemon).some(m => !m.alive),
  }));

  return {
    trainerParties: allPlayers,
    roomLinks,
    roomPlayers,
    roomEvents,
    roomPairs,
  };
}
