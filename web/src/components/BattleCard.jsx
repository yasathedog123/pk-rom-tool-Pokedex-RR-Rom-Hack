import { useState, useEffect, useRef } from 'react';
import usePokemonData from '../hooks/usePokemonData';
import useMoveData from '../hooks/useMoveData';
import TypeBadge from './TypeBadge';
import MoveCard from './MoveCard';
import { TYPE_COLORS } from '../utils/types';

const SHOWDOWN_ITEMS = 'https://play.pokemonshowdown.com/sprites/itemicons';

function itemSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function typeGradient(types) {
  if (!types || types.length === 0) return 'linear-gradient(135deg, rgba(239,68,68,0.25), rgba(239,68,68,0.08))';
  const c1 = TYPE_COLORS[types[0]] || '#666';
  if (types.length === 1) return `linear-gradient(135deg, ${c1}88, ${c1}33)`;
  const c2 = TYPE_COLORS[types[1]] || '#666';
  return `linear-gradient(135deg, ${c1}88, ${c2}88)`;
}

function hpColor(ratio) {
  if (ratio > 0.5) return '#34d399';
  if (ratio > 0.25) return '#fbbf24';
  return '#ef4444';
}

const STATUS_META = {
  Poisoned:  { label: 'PSN', cls: 'pc-status-psn' },
  Toxic:     { label: 'TOX', cls: 'pc-status-tox' },
  Burned:    { label: 'BRN', cls: 'pc-status-brn' },
  Paralyzed: { label: 'PAR', cls: 'pc-status-par' },
  Asleep:    { label: 'SLP', cls: 'pc-status-slp' },
  Frozen:    { label: 'FRZ', cls: 'pc-status-frz' },
};

export default function BattleCard({ enemyParty }) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const lastPartyRef = useRef([]);

  const hasEnemies = enemyParty && enemyParty.length > 0;

  useEffect(() => {
    if (hasEnemies) {
      lastPartyRef.current = enemyParty;
      setExiting(false);
      setVisible(true);
    } else if (visible) {
      setExiting(true);
    }
  }, [hasEnemies]);

  useEffect(() => {
    if (!exiting) return;
    const t = setTimeout(() => {
      setVisible(false);
      setExiting(false);
    }, 300);
    return () => clearTimeout(t);
  }, [exiting]);

  if (!visible) return null;

  const displayParty = hasEnemies ? enemyParty : lastPartyRef.current;

  return (
    <div className={`bc-wrap ${exiting ? 'bc-exit' : 'bc-enter'}`}>
      <h3 className="section-title">Opponent</h3>
      {displayParty.map((mon, i) => (
        <BattleOpponent key={mon.personality || i} mon={mon} isActive={i === 0} />
      ))}
    </div>
  );
}

function BattleOpponent({ mon, isActive }) {
  const species = mon.species || '';
  const { sprite: img } = usePokemonData(species);
  const nickname = mon.nickname || species || '???';
  const level = mon.level || 0;
  const hp = mon.currentHP ?? mon.current_hp ?? 0;
  const maxHp = mon.maxHP ?? mon.max_hp ?? 0;
  const types = mon.types || [];
  const rawMoves = mon.moveNames || [];
  const hpRatio = maxHp > 0 ? hp / maxHp : 0;
  const alive = hp > 0;
  const nature = mon.nature;
  const ability = mon.ability;
  const heldItem = mon.heldItem || mon.held_item;
  const hasItem = heldItem && heldItem !== 'None';
  const statusRaw = mon.status;
  const statusInfo = statusRaw && statusRaw !== 'Healthy' ? STATUS_META[statusRaw] : null;
  const moveData = useMoveData(rawMoves);

  const moveSlots = [];
  for (let i = 0; i < 4; i++) {
    moveSlots.push(rawMoves[i] || null);
  }

  const isBench = !isActive;
  const cls = [
    'bc-opponent',
    !alive && 'bc-dead',
    isBench && 'bc-bench',
  ].filter(Boolean).join(' ');

  return (
    <div className={cls}>
      <div className="bc-header" style={{ background: typeGradient(types) }}>
        <div className="bc-level-block">
          <span className="bc-level-label">Lv</span>
          <span className="bc-level-num">{level}</span>
        </div>
        <div className="bc-header-meta">
          {isActive && <span className="bc-active-tag">ACTIVE</span>}
        </div>
        <div className="bc-sprite-anchor">
          {img ? (
            <img className="bc-sprite" src={img} alt={species} loading="lazy"
              onError={e => { e.currentTarget.style.display = 'none'; }} />
          ) : (
            <div className="bc-sprite-fb">?</div>
          )}
        </div>
      </div>

      <div className="bc-details">
        <div className="bc-name-row">
          <span className="bc-nickname">{nickname}</span>
        </div>
        {species !== nickname && <div className="bc-species">{species}</div>}
        <div className="bc-chips">
          {types.map(t => <TypeBadge key={t} type={t} />)}
          {nature && <span className="pc-nature">{nature}</span>}
          {statusInfo && <span className={`pc-status ${statusInfo.cls}`}>{statusInfo.label}</span>}
        </div>

        {maxHp > 0 && (
          <div className="bc-hp-row">
            <div className="bc-hp-track">
              <div className="bc-hp-fill" style={{ width: `${hpRatio * 100}%`, background: hpColor(hpRatio) }} />
            </div>
            <span className="bc-hp-val">{hp}/{maxHp}</span>
          </div>
        )}

        {!alive && maxHp > 0 && <div className="bc-fallen">FAINTED</div>}

        {ability && <div className="bc-ability">{ability}</div>}

        {hasItem && (
          <div className="bc-item">
            <img
              className="bc-item-icon"
              src={`${SHOWDOWN_ITEMS}/${itemSlug(heldItem)}.png`}
              alt={heldItem}
              loading="lazy"
              onError={e => { e.currentTarget.style.display = 'none'; }}
            />
            <span>{heldItem}</span>
          </div>
        )}

        {isActive && (
          <div className="bc-moves">
            {moveSlots.map((name, i) => (
              <MoveCard key={i} name={name} data={name ? moveData.get(name) : undefined} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

