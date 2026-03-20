import { useState } from 'react';
import { spriteUrl } from '../utils/types';
import TypeBadge from './TypeBadge';

export default function PokemonCard({ mon, playerName, dead }) {
  const [expanded, setExpanded] = useState(false);
  const species  = mon.species_name || mon.species || '';
  const img = spriteUrl(species);
  const nickname = mon.nickname || mon.species_name || mon.species || '???';
  const level    = mon.level || 0;
  const hp       = mon.current_hp ?? mon.currentHP ?? 0;
  const maxHp    = mon.max_hp ?? mon.maxHP ?? 0;
  const types    = mon.types || [];
  const alive    = dead === true ? false : (mon.alive !== undefined ? mon.alive : hp > 0);
  const hasHp    = maxHp > 0;
  const ivs      = mon.ivs || mon.IVs;
  const evs      = mon.evs || mon.EVs;
  const nature   = mon.nature;
  const metName  = mon.met_location_name || mon.metLocationName || mon.route_name || mon.routeName || `Loc ${mon.met_location ?? mon.metLocation ?? '?'}`;
  const metLevel = mon.met_level ?? mon.metLevel ?? '?';
  const heldItem = mon.held_item || mon.heldItem;
  const hiddenPower = mon.hidden_power || mon.hiddenPower;

  return (
    <div className={`poke-card ${alive ? '' : 'dead'}`} onClick={() => setExpanded(e => !e)}>
      <div className="poke-owner">{playerName}</div>
      <div className="poke-visual">
        {img && (
          <img
            className="poke-sprite"
            src={img}
            alt={species}
            loading="lazy"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        )}
        <div className="poke-info">
          <div className="poke-nickname">{nickname}</div>
          <div className="poke-species">{species}</div>
          <div className="poke-types">
            {types.map(t => <TypeBadge key={t} type={t} />)}
          </div>
          <div className="poke-level">Lv. {level}</div>
          {alive && hasHp && (
            <div className="hp-bar-wrap">
              <div className="hp-bar" style={{ width: `${maxHp > 0 ? (hp / maxHp) * 100 : 0}%` }} />
              <span className="hp-text">{hp}/{maxHp}</span>
            </div>
          )}
          {alive && !hasHp && <div className="poke-subtle">Live HP unavailable</div>}
          {!alive && <div className="poke-dead-label">FALLEN</div>}
        </div>
      </div>
      {expanded && (
        <div className="poke-details">
          <Detail label="Met" value={metName} />
          <Detail label="Met Lv" value={metLevel} />
          {nature && <Detail label="Nature" value={nature} />}
          {heldItem && <Detail label="Held Item" value={heldItem} />}
          {hiddenPower && <Detail label="Hidden Power" value={hiddenPower} />}
          {mon.isShiny && <Detail label="Shiny" value="Yes" />}
          {ivs && <StatBlock title="IVs" stats={ivs} />}
          {evs && <StatBlock title="EVs" stats={evs} />}
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }) {
  return <div className="poke-detail"><span className="detail-label">{label}</span> {String(value)}</div>;
}

function StatBlock({ title, stats }) {
  const entries = [
    ['HP', stats.hp],
    ['ATK', stats.attack],
    ['DEF', stats.defense],
    ['SPA', stats.specialAttack],
    ['SPD', stats.specialDefense],
    ['SPE', stats.speed],
  ];
  return (
    <div className="stat-block">
      <div className="stat-title">{title}</div>
      <div className="stat-grid">
        {entries.map(([label, value]) => (
          <div key={label} className="stat-item">
            <span className="detail-label">{label}</span>
            <span>{value ?? '-'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
