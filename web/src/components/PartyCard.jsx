import { useRef, useState, useEffect } from 'react';
import usePokemonData from '../hooks/usePokemonData';
import useMoveData from '../hooks/useMoveData';
import TypeBadge from './TypeBadge';
import MoveCard from './MoveCard';
import { TYPE_COLORS } from '../utils/types';
import { getEffectiveness, getTypeMatchup } from '../utils/typeEffectiveness';

const SHOWDOWN_ITEMS = 'https://play.pokemonshowdown.com/sprites/itemicons';
const SHOWDOWN_CATEGORIES = 'https://play.pokemonshowdown.com/sprites/categories';

function splitName(name) {
  if (!name) return '';
  return name.replace(/([a-z])([A-Z])/g, '$1 $2')
             .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
}

function itemSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

function CategoryIcon({ damageClass }) {
  if (!damageClass) return null;
  const file = damageClass.charAt(0).toUpperCase() + damageClass.slice(1);
  return (
    <img className="pc-cls-icon" src={`${SHOWDOWN_CATEGORIES}/${file}.png`} alt={damageClass} title={capitalize(damageClass)} />
  );
}

const NATURE_EFFECTS = {
  Adamant: ['+Atk', '-SpA'], Bashful: null, Bold: ['+Def', '-Atk'],
  Brave: ['+Atk', '-Spe'], Calm: ['+SpD', '-Atk'], Careful: ['+SpD', '-SpA'],
  Docile: null, Gentle: ['+SpD', '-Def'], Hardy: null,
  Hasty: ['+Spe', '-Def'], Impish: ['+Def', '-SpA'], Jolly: ['+Spe', '-SpA'],
  Lax: ['+Def', '-SpD'], Lonely: ['+Atk', '-Def'], Mild: ['+SpA', '-Def'],
  Modest: ['+SpA', '-Atk'], Naive: ['+Spe', '-SpD'], Naughty: ['+Atk', '-SpD'],
  Quiet: ['+SpA', '-Spe'], Quirky: null, Rash: ['+SpA', '-SpD'],
  Relaxed: ['+Def', '-Spe'], Sassy: ['+SpD', '-Spe'], Serious: null,
  Timid: ['+Spe', '-Atk'],
};

function hpColor(ratio) {
  if (ratio > 0.5) return '#34d399';
  if (ratio > 0.25) return '#fbbf24';
  return '#ef4444';
}

function statColor(value) {
  if (value >= 150) return '#00c2b8';
  if (value >= 120) return '#23cd5e';
  if (value >= 90)  return '#a0e515';
  if (value >= 60)  return '#ffdd57';
  if (value >= 30)  return '#ff7f0f';
  return '#f34444';
}

function typeGradient(types) {
  if (!types || types.length === 0) return 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))';
  const c1 = TYPE_COLORS[types[0]] || '#666';
  if (types.length === 1) return `linear-gradient(135deg, ${c1}66, ${c1}22)`;
  const c2 = TYPE_COLORS[types[1]] || '#666';
  return `linear-gradient(135deg, ${c1}66, ${c2}66)`;
}

const STATUS_META = {
  Poisoned:  { label: 'PSN', cls: 'pc-status-psn' },
  Toxic:     { label: 'TOX', cls: 'pc-status-tox' },
  Burned:    { label: 'BRN', cls: 'pc-status-brn' },
  Paralyzed: { label: 'PAR', cls: 'pc-status-par' },
  Asleep:    { label: 'SLP', cls: 'pc-status-slp' },
  Frozen:    { label: 'FRZ', cls: 'pc-status-frz' },
};

export default function PartyCard({ mon, routeName, isActiveBattler, inBattle, opponentTypes }) {
  const species    = mon.species_name || mon.species || '';
  const { sprite: img, baseStats } = usePokemonData(species);
  const nickname   = mon.nickname || species || '???';
  const level      = mon.level || 0;
  const hp         = mon.current_hp ?? mon.currentHP ?? 0;
  const maxHp      = mon.max_hp ?? mon.maxHP ?? 0;
  const types      = mon.types || [];
  const alive      = mon.alive !== undefined ? mon.alive : hp > 0;
  const hasHp      = maxHp > 0;
  const nature     = mon.nature;
  const natureEffects = nature ? NATURE_EFFECTS[nature] || null : null;
  const heldItem   = mon.held_item || mon.heldItem;
  const ability    = mon.abilityName || mon.ability_name || mon.ability || '';
  const friendship = mon.friendship;
  const hpRatio    = maxHp > 0 ? hp / maxHp : 0;
  const route      = routeName || mon.met_location_name || mon.metLocationName || mon.route_name || mon.routeName || '';
  const statusRaw  = mon.status;
  const statusInfo = statusRaw && statusRaw !== 'Healthy' ? STATUS_META[statusRaw] : null;
  const ivs        = mon.ivs || mon.IVs || null;
  const evs        = mon.evs || mon.EVs || null;
  const rawMoves   = mon.moveNames || mon.move_names || [];
  const moveSlots  = [];
  for (let i = 0; i < 4; i++) moveSlots.push(rawMoves[i] || null);
  const moveData   = useMoveData(rawMoves);
  const matchup    = isActiveBattler ? getTypeMatchup(types, opponentTypes) : null;

  const matchupCls = matchup === 'advantage' ? 'pc-matchup-adv'
    : matchup === 'disadvantage' ? 'pc-matchup-disadv' : '';

  const [modeFlash, setModeFlash] = useState(false);
  const prevBattle = useRef(inBattle);
  useEffect(() => {
    if (prevBattle.current !== inBattle) {
      setModeFlash(true);
      const t = setTimeout(() => setModeFlash(false), 200);
      prevBattle.current = inBattle;
      return () => clearTimeout(t);
    }
  }, [inBattle]);

  return (
    <div className={`pc ${alive ? '' : 'pc-dead'} ${isActiveBattler ? 'pc-active-battler' : ''} ${inBattle && !isActiveBattler ? 'pc-battle-inactive' : ''} ${matchupCls} ${modeFlash ? 'pc-mode-flash' : ''}`}>
      <div className="pc-header" style={{ background: typeGradient(types) }}>
        <div className="pc-level-block">
          <span className="pc-level-label">Level</span>
          <span className="pc-level-num">{level}</span>
        </div>
        <div className="pc-header-meta">
          {route && <span className="pc-route-badge">{route}</span>}
        </div>
        <div className="pc-sprite-anchor">
          {img ? (
            <img className="pc-sprite" src={img} alt={species} loading="lazy"
              onError={e => { e.currentTarget.style.display = 'none'; }} />
          ) : (
            <div className="pc-sprite-fb">?</div>
          )}
        </div>
      </div>

      <div className="pc-details">
        <div className="pc-name-row">
          <span className="pc-nickname">{nickname}</span>
          {mon.isShiny && <span className="pc-shiny">&#9733;</span>}
        </div>
        <div className="pc-species">{species !== nickname ? species : '\u00A0'}</div>
        <div className="pc-chips">
          {types.map(t => <TypeBadge key={t} type={t} />)}
          {statusInfo && <span className={`pc-status ${statusInfo.cls}`}>{statusInfo.label}</span>}
        </div>
        {(nature || ability) && (
          <div className="pc-meta-row">
            {nature && (
              <span className="pc-nature">
                {nature}
                {natureEffects && (
                  <span className="pc-nature-fx">
                    <span className="pc-nat-up">{natureEffects[0]}</span>
                    <span className="pc-nat-dn">{natureEffects[1]}</span>
                  </span>
                )}
              </span>
            )}
            {ability && <span className="pc-ability">{splitName(ability)}</span>}
          </div>
        )}
        {alive && hasHp && (
          <div className="pc-hp-row">
            <div className="pc-hp-track">
              <div className="pc-hp-fill" style={{ width: `${hpRatio * 100}%`, background: hpColor(hpRatio) }} />
            </div>
            <span className="pc-hp-val">{hp}/{maxHp}</span>
          </div>
        )}
        {!alive && <div className="pc-fallen">FALLEN</div>}
        {heldItem && heldItem !== 'None' && (
          <div className="pc-held-item" title={heldItem}>
            <img className="pc-item-icon" src={`${SHOWDOWN_ITEMS}/${itemSlug(heldItem)}.png`} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />
            {splitName(heldItem)}
          </div>
        )}
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

      <div className="pc-bottom-section">
        {inBattle ? (
          <div className="pc-battle-moves">
            {moveSlots.map((name, i) => {
              const md = name ? moveData.get(name) : undefined;
              const eff = md && md.type ? getEffectiveness(md.type, opponentTypes) : null;
              return <MoveCard key={i} name={name} data={md} effectiveness={eff} compact />;
            })}
          </div>
        ) : (
          <>
            {(baseStats || ivs || evs) && (
              <StatFooter baseStats={baseStats} ivs={ivs} evs={evs} />
            )}
            <div className="pc-concise-moves">
              {moveSlots.map((name, i) => {
                const md = name ? moveData.get(name) : null;
                const typeName = md?.type ? capitalize(md.type) : null;
                const typeColor = typeName ? TYPE_COLORS[typeName] : null;
                return (
                  <div key={i} className="pc-cmove" style={typeColor ? { borderLeftColor: typeColor, background: `linear-gradient(90deg, ${typeColor}15, transparent 60%)` } : {}}>
                    {name ? (
                      <>
                        <span className="pc-cmove-name">{splitName(name)}</span>
                        {md && (
                          <span className="pc-cmove-stats">
                            <CategoryIcon damageClass={md.damageClass || md.damage_class} />
                            <span className="pc-cmove-pow">{md.power || '—'}</span>
                            <span className="pc-cmove-acc">{md.accuracy || '—'}</span>
                          </span>
                        )}
                      </>
                    ) : <span className="pc-cmove-empty">&mdash;</span>}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
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

const BST_MAX = 255;
const STAT_KEYS = ['hp', 'attack', 'defense', 'specialAttack', 'specialDefense', 'speed'];
const STAT_LABELS = ['HP', 'ATK', 'DEF', 'SPA', 'SPD', 'SPE'];
const IV_EV_LABELS = ['HP', 'Atk', 'Def', 'SpA', 'SpD', 'Spe'];

function StatFooter({ baseStats, ivs, evs }) {
  const hasIvEv = ivs || evs;

  return (
    <div className="sf">
      {hasIvEv && (
        <div className="sf-ivev">
          <table>
            <thead>
              <tr>
                <th></th>
                {ivs && <th>IV</th>}
                {evs && <th>EV</th>}
              </tr>
            </thead>
            <tbody>
              {IV_EV_LABELS.map((label, i) => {
                const ivKey = STAT_KEYS[i];
                const ivVal = ivs?.[ivKey] ?? ivs?.[label.toLowerCase()];
                const evVal = evs?.[ivKey] ?? evs?.[label.toLowerCase()];
                return (
                  <tr key={label}>
                    <td className="sf-stat-label">{label}</td>
                    {ivs && <td className={ivVal === 31 ? 'sf-perfect' : ''}>{ivVal ?? '—'}</td>}
                    {evs && <td className={evVal === 252 ? 'sf-maxed' : ''}>{evVal ?? '—'}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {baseStats && (
        <div className="sf-bst">
          <div className="bst-title">Base Stats <span className="bst-total">{baseStats.total}</span></div>
          {STAT_KEYS.map((key, i) => {
            const val = baseStats[key] ?? 0;
            return (
              <div key={key} className="bst-row">
                <span className="bst-label">{STAT_LABELS[i]}</span>
                <span className="bst-val">{val}</span>
                <div className="bst-track">
                  <div className="bst-fill" style={{
                    width: `${Math.min(100, (val / BST_MAX) * 100)}%`,
                    background: statColor(val),
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
