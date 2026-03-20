import useSprite from '../hooks/useSprite';
import TypeBadge from './TypeBadge';

function hpColor(ratio) {
  if (ratio > 0.5) return '#34d399';
  if (ratio > 0.25) return '#fbbf24';
  return '#ef4444';
}

export default function PartyCard({ mon, routeName }) {
  const species  = mon.species_name || mon.species || '';
  const img = useSprite(species);
  const nickname = mon.nickname || species || '???';
  const level    = mon.level || 0;
  const hp       = mon.current_hp ?? mon.currentHP ?? 0;
  const maxHp    = mon.max_hp ?? mon.maxHP ?? 0;
  const types    = mon.types || [];
  const alive    = mon.alive !== undefined ? mon.alive : hp > 0;
  const hasHp    = maxHp > 0;
  const ivs      = mon.ivs || mon.IVs;
  const evs      = mon.evs || mon.EVs;
  const nature   = mon.nature;
  const heldItem = mon.held_item || mon.heldItem;
  const friendship = mon.friendship;
  const hpRatio  = maxHp > 0 ? hp / maxHp : 0;
  const route    = routeName || mon.met_location_name || mon.metLocationName || mon.route_name || mon.routeName || '';

  return (
    <div className={`pc ${alive ? '' : 'pc-dead'}`}>
      <div className="pc-top">
        {route && <span className="pc-route-badge">{route}</span>}
        <span className="pc-level">Lv.{level}</span>
      </div>
      <div className="pc-body">
        <div className="pc-info">
          <div className="pc-name-row">
            <span className="pc-nickname">{nickname}</span>
            {mon.isShiny && <span className="pc-shiny">&#9733;</span>}
          </div>
          {species !== nickname && <div className="pc-species">{species}</div>}
          <div className="pc-chips">
            {types.map(t => <TypeBadge key={t} type={t} />)}
            {nature && <span className="pc-nature">{nature}</span>}
          </div>
          {alive && hasHp && (
            <div className="pc-hp-row">
              <div className="pc-hp-track">
                <div className="pc-hp-fill" style={{ width: `${hpRatio * 100}%`, background: hpColor(hpRatio) }} />
              </div>
              <span className="pc-hp-val">{hp}/{maxHp}</span>
            </div>
          )}
          {!alive && <div className="pc-fallen">FALLEN</div>}
          {friendship !== undefined && friendship !== null && (
            <div className="pc-friend-row">
              <span className="pc-friend-label">Friendship</span>
              <div className="pc-friend-track">
                <div className="pc-friend-fill" style={{ width: `${Math.min(100, (friendship / 255) * 100)}%` }} />
              </div>
              <span className="pc-friend-val">{friendship}</span>
            </div>
          )}
        </div>
        <div className="pc-sprite-col">
          {img ? (
            <img className="pc-sprite" src={img} alt={species} loading="lazy"
              onError={e => { e.currentTarget.style.display = 'none'; }} />
          ) : (
            <div className="pc-sprite-fb">?</div>
          )}
          {heldItem && heldItem !== 'None' && (
            <div className="pc-held-item" title={heldItem}>{heldItem}</div>
          )}
        </div>
      </div>

      {(ivs || evs) && <StatBars ivs={ivs} evs={evs} />}
    </div>
  );
}

export function EmptySlot() {
  return (
    <div className="pc pc-empty">
      <div className="pc-empty-inner">Empty</div>
    </div>
  );
}

function StatBars({ ivs, evs }) {
  const stats = [
    ['HP',  ivs?.hp, evs?.hp],
    ['ATK', ivs?.attack, evs?.attack],
    ['DEF', ivs?.defense, evs?.defense],
    ['SPA', ivs?.specialAttack, evs?.specialAttack],
    ['SPD', ivs?.specialDefense, evs?.specialDefense],
    ['SPE', ivs?.speed, evs?.speed],
  ];

  return (
    <div className="sb">
      {stats.map(([label, iv, ev]) => (
        <div key={label} className="sb-row">
          <span className="sb-label">{label}</span>
          <div className="sb-bars">
            <div className="sb-track">
              <div
                className={`sb-fill sb-iv ${iv === 31 ? 'sb-perfect' : ''}`}
                style={{ width: `${((iv ?? 0) / 31) * 100}%` }}
              />
            </div>
            <div className="sb-track">
              <div
                className={`sb-fill sb-ev ${(ev ?? 0) > 0 ? 'sb-ev-active' : ''}`}
                style={{ width: `${((ev ?? 0) / 252) * 100}%` }}
              />
            </div>
          </div>
          <span className="sb-vals">
            <span className="sb-iv-num">{iv ?? '-'}</span>
            <span className="sb-ev-num">{ev ?? '-'}</span>
          </span>
        </div>
      ))}
      <div className="sb-legend">
        <span className="sb-legend-iv">IV</span>
        <span className="sb-legend-ev">EV</span>
      </div>
    </div>
  );
}
