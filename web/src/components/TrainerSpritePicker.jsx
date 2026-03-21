import { useState } from 'react';

const SHOWDOWN_BASE = 'https://play.pokemonshowdown.com/sprites/trainers';

const TRAINER_SPRITES = [
  { id: 'red', label: 'Red', url: `${SHOWDOWN_BASE}/red.png` },
  { id: 'red-gen1', label: 'Red (Gen 1)', url: `${SHOWDOWN_BASE}/red-gen1.png` },
  { id: 'red-gen3', label: 'Red (Gen 3)', url: `${SHOWDOWN_BASE}/red-gen3.png` },
  { id: 'leaf', label: 'Leaf', url: `${SHOWDOWN_BASE}/leaf.png` },
  { id: 'ethan', label: 'Ethan', url: `${SHOWDOWN_BASE}/ethan.png` },
  { id: 'lyra', label: 'Lyra', url: `${SHOWDOWN_BASE}/lyra.png` },
  { id: 'brendan', label: 'Brendan', url: `${SHOWDOWN_BASE}/brendan.png` },
  { id: 'may', label: 'May', url: `${SHOWDOWN_BASE}/may.png` },
  { id: 'lucas', label: 'Lucas', url: `${SHOWDOWN_BASE}/lucas.png` },
  { id: 'dawn', label: 'Dawn', url: `${SHOWDOWN_BASE}/dawn.png` },
  { id: 'hilbert', label: 'Hilbert', url: `${SHOWDOWN_BASE}/hilbert.png` },
  { id: 'hilda', label: 'Hilda', url: `${SHOWDOWN_BASE}/hilda.png` },
  { id: 'nate', label: 'Nate', url: `${SHOWDOWN_BASE}/nate.png` },
  { id: 'rosa', label: 'Rosa', url: `${SHOWDOWN_BASE}/rosa.png` },
  { id: 'calem', label: 'Calem', url: `${SHOWDOWN_BASE}/calem.png` },
  { id: 'serena', label: 'Serena', url: `${SHOWDOWN_BASE}/serena.png` },
  { id: 'elio', label: 'Elio', url: `${SHOWDOWN_BASE}/elio.png` },
  { id: 'selene', label: 'Selene', url: `${SHOWDOWN_BASE}/selene.png` },
  { id: 'victor', label: 'Victor', url: `${SHOWDOWN_BASE}/victor.png` },
  { id: 'gloria', label: 'Gloria', url: `${SHOWDOWN_BASE}/gloria.png` },
  { id: 'blue', label: 'Blue', url: `${SHOWDOWN_BASE}/blue.png` },
  { id: 'blue-gen1', label: 'Blue (Gen 1)', url: `${SHOWDOWN_BASE}/blue-gen1.png` },
  { id: 'lance', label: 'Lance', url: `${SHOWDOWN_BASE}/lance.png` },
  { id: 'steven', label: 'Steven', url: `${SHOWDOWN_BASE}/steven.png` },
  { id: 'cynthia', label: 'Cynthia', url: `${SHOWDOWN_BASE}/cynthia.png` },
  { id: 'n', label: 'N', url: `${SHOWDOWN_BASE}/n.png` },
  { id: 'giovanni', label: 'Giovanni', url: `${SHOWDOWN_BASE}/giovanni.png` },
  { id: 'oak', label: 'Prof. Oak', url: `${SHOWDOWN_BASE}/oak.png` },
  { id: 'misty', label: 'Misty', url: `${SHOWDOWN_BASE}/misty.png` },
  { id: 'brock', label: 'Brock', url: `${SHOWDOWN_BASE}/brock.png` },
  { id: 'erika', label: 'Erika', url: `${SHOWDOWN_BASE}/erika.png` },
  { id: 'sabrina', label: 'Sabrina', url: `${SHOWDOWN_BASE}/sabrina.png` },
  { id: 'surge', label: 'Lt. Surge', url: `${SHOWDOWN_BASE}/surge.png` },
  { id: 'blaine', label: 'Blaine', url: `${SHOWDOWN_BASE}/blaine.png` },
  { id: 'whitney', label: 'Whitney', url: `${SHOWDOWN_BASE}/whitney.png` },
  { id: 'silver', label: 'Silver', url: `${SHOWDOWN_BASE}/silver.png` },
  { id: 'wallace', label: 'Wallace', url: `${SHOWDOWN_BASE}/wallace.png` },
  { id: 'wally', label: 'Wally', url: `${SHOWDOWN_BASE}/wally.png` },
  { id: 'flannery', label: 'Flannery', url: `${SHOWDOWN_BASE}/flannery.png` },
  { id: 'gardenia', label: 'Gardenia', url: `${SHOWDOWN_BASE}/gardenia.png` },
  { id: 'volkner', label: 'Volkner', url: `${SHOWDOWN_BASE}/volkner.png` },
  { id: 'elesa', label: 'Elesa', url: `${SHOWDOWN_BASE}/elesa.png` },
  { id: 'skyla', label: 'Skyla', url: `${SHOWDOWN_BASE}/skyla.png` },
  { id: 'iris', label: 'Iris', url: `${SHOWDOWN_BASE}/iris.png` },
  { id: 'diantha', label: 'Diantha', url: `${SHOWDOWN_BASE}/diantha.png` },
  { id: 'leon', label: 'Leon', url: `${SHOWDOWN_BASE}/leon.png` },
  { id: 'marnie', label: 'Marnie', url: `${SHOWDOWN_BASE}/marnie.png` },
  { id: 'bea', label: 'Bea', url: `${SHOWDOWN_BASE}/bea.png` },
  { id: 'nessa', label: 'Nessa', url: `${SHOWDOWN_BASE}/nessa.png` },
  { id: 'raihan', label: 'Raihan', url: `${SHOWDOWN_BASE}/raihan.png` },
  { id: 'hop', label: 'Hop', url: `${SHOWDOWN_BASE}/hop.png` },
  { id: 'piers', label: 'Piers', url: `${SHOWDOWN_BASE}/piers.png` },
  { id: 'team-rocket-grunt', label: 'Team Rocket (M)', url: `${SHOWDOWN_BASE}/rocketgrunt.png` },
  { id: 'team-rocket-grunt-f', label: 'Team Rocket (F)', url: `${SHOWDOWN_BASE}/rocketgruntf.png` },
  { id: 'team-magma-grunt', label: 'Team Magma (M)', url: `${SHOWDOWN_BASE}/magmagrunt.png` },
  { id: 'team-magma-grunt-f', label: 'Team Magma (F)', url: `${SHOWDOWN_BASE}/magmagruntf.png` },
  { id: 'team-aqua-grunt', label: 'Team Aqua (M)', url: `${SHOWDOWN_BASE}/aquagrunt.png` },
  { id: 'team-aqua-grunt-f', label: 'Team Aqua (F)', url: `${SHOWDOWN_BASE}/aquagruntf.png` },
  { id: 'team-galactic-grunt', label: 'Team Galactic (M)', url: `${SHOWDOWN_BASE}/galacticgrunt.png` },
  { id: 'team-galactic-grunt-f', label: 'Team Galactic (F)', url: `${SHOWDOWN_BASE}/galacticgruntf.png` },
  { id: 'team-plasma-grunt', label: 'Team Plasma (M)', url: `${SHOWDOWN_BASE}/plasmagrunt.png` },
  { id: 'team-plasma-grunt-f', label: 'Team Plasma (F)', url: `${SHOWDOWN_BASE}/plasmagruntf.png` },
  { id: 'team-skull-grunt', label: 'Team Skull (M)', url: `${SHOWDOWN_BASE}/skullgrunt.png` },
  { id: 'team-skull-grunt-f', label: 'Team Skull (F)', url: `${SHOWDOWN_BASE}/skullgruntf.png` },
  { id: 'team-yell-grunt', label: 'Team Yell (M)', url: `${SHOWDOWN_BASE}/yellgrunt.png` },
  { id: 'team-yell-grunt-f', label: 'Team Yell (F)', url: `${SHOWDOWN_BASE}/yellgruntf.png` },
  { id: 'ace-trainer', label: 'Ace Trainer (M)', url: `${SHOWDOWN_BASE}/acetrainer.png` },
  { id: 'ace-trainer-f', label: 'Ace Trainer (F)', url: `${SHOWDOWN_BASE}/acetrainerf.png` },
  { id: 'youngster', label: 'Youngster', url: `${SHOWDOWN_BASE}/youngster.png` },
  { id: 'lass', label: 'Lass', url: `${SHOWDOWN_BASE}/lass.png` },
  { id: 'ranger', label: 'Ranger (M)', url: `${SHOWDOWN_BASE}/pokemonranger.png` },
  { id: 'ranger-f', label: 'Ranger (F)', url: `${SHOWDOWN_BASE}/pokemonrangerf.png` },
  { id: 'bug-catcher', label: 'Bug Catcher', url: `${SHOWDOWN_BASE}/bugcatcher.png` },
  { id: 'hiker', label: 'Hiker', url: `${SHOWDOWN_BASE}/hiker.png` },
  { id: 'fisherman', label: 'Fisherman', url: `${SHOWDOWN_BASE}/fisherman.png` },
  { id: 'swimmer', label: 'Swimmer (M)', url: `${SHOWDOWN_BASE}/swimmer.png` },
  { id: 'swimmer-f', label: 'Swimmer (F)', url: `${SHOWDOWN_BASE}/swimmerf.png` },
  { id: 'beauty', label: 'Beauty', url: `${SHOWDOWN_BASE}/beauty.png` },
  { id: 'gentleman', label: 'Gentleman', url: `${SHOWDOWN_BASE}/gentleman.png` },
  { id: 'scientist', label: 'Scientist', url: `${SHOWDOWN_BASE}/scientist.png` },
  { id: 'ninja-boy', label: 'Ninja Boy', url: `${SHOWDOWN_BASE}/ninjaboy.png` },
  { id: 'psychic', label: 'Psychic (M)', url: `${SHOWDOWN_BASE}/psychic.png` },
  { id: 'psychic-f', label: 'Psychic (F)', url: `${SHOWDOWN_BASE}/psychicf.png` },
  { id: 'blackbelt', label: 'Black Belt', url: `${SHOWDOWN_BASE}/blackbelt.png` },
  { id: 'hex-maniac', label: 'Hex Maniac', url: `${SHOWDOWN_BASE}/hexmaniac-gen6.png` },
  { id: 'veteran', label: 'Veteran (M)', url: `${SHOWDOWN_BASE}/veteran.png` },
  { id: 'veteran-f', label: 'Veteran (F)', url: `${SHOWDOWN_BASE}/veteranf.png` },
  { id: 'bird-keeper', label: 'Bird Keeper', url: `${SHOWDOWN_BASE}/birdkeeper.png` },
  { id: 'channeler', label: 'Channeler', url: `${SHOWDOWN_BASE}/channeler-gen3.png` },
];

export function getTrainerSpriteUrl(id) {
  if (!id) return null;
  const entry = TRAINER_SPRITES.find(s => s.id === id);
  return entry?.url || null;
}

export default function TrainerSpritePicker({ selected, onSelect, onClose }) {
  const [search, setSearch] = useState('');
  const filtered = search
    ? TRAINER_SPRITES.filter(s => s.label.toLowerCase().includes(search.toLowerCase()))
    : TRAINER_SPRITES;

  return (
    <div className="tsp-backdrop" onClick={onClose}>
      <div className="tsp-modal glass-card" onClick={e => e.stopPropagation()}>
        <div className="tsp-header">
          <h3>Choose Trainer Sprite</h3>
          <button className="rm-close" onClick={onClose}>&times;</button>
        </div>
        <div className="tsp-search">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search trainers..."
            autoFocus
          />
        </div>
        <div className="tsp-grid">
          <button
            className={`tsp-item ${!selected ? 'tsp-item-active' : ''}`}
            onClick={() => { onSelect(''); onClose(); }}
          >
            <div className="tsp-item-none">None</div>
          </button>
          {filtered.map(s => (
            <button
              key={s.id}
              className={`tsp-item ${selected === s.id ? 'tsp-item-active' : ''}`}
              onClick={() => { onSelect(s.id); onClose(); }}
              title={s.label}
            >
              <img src={s.url} alt={s.label} className="tsp-img" onError={e => { e.currentTarget.style.display = 'none'; }} />
              <span className="tsp-label">{s.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
