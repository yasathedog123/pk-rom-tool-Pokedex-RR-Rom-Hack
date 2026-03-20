import { useState, useCallback } from 'react';
import useSprite from '../hooks/useSprite';

export default function RouteManager({ routes, allCatches, assignments, onAssign, onClose, focusRoute }) {
  const [flashId, setFlashId] = useState(null);

  const handleAssign = useCallback((routeId, personality) => {
    setFlashId(personality);
    onAssign(routeId, personality);
    setTimeout(() => setFlashId(null), 700);
  }, [onAssign]);

  const routeGroups = routes.map(route => {
    const routeId = route.locationId ?? route.route ?? route.route_id;
    const routeName = route.locationName || route.route_name || `Location ${routeId}`;
    const assignedPersonality = assignments[String(routeId)] ?? assignments[routeId];

    const routeCatches = allCatches.filter(m => {
      const metLoc = m.metLocation ?? m.met_location ?? m.route;
      return Number(metLoc) === Number(routeId);
    });

    const assigned = routeCatches.find(m => m.personality === assignedPersonality) || routeCatches[0] || null;
    const alternatives = routeCatches.filter(m => m !== assigned);

    return { routeId, routeName, assigned, alternatives };
  });

  const resolvedPersonalities = new Set(
    routeGroups.map(g => g.assigned?.personality).filter(Boolean)
  );
  const unassigned = allCatches.filter(m => !resolvedPersonalities.has(m.personality));

  return (
    <div className="rm-backdrop" onClick={onClose}>
      <div className="rm-modal glass-card" onClick={e => e.stopPropagation()}>
        <div className="rm-header">
          <h2>Manage Route Assignments</h2>
          <button className="rm-close" onClick={onClose}>&times;</button>
        </div>
        <div className="rm-scroll">
          {routeGroups.map(({ routeId, routeName, assigned, alternatives }) => (
            <RouteSection
              key={routeId}
              routeId={routeId}
              routeName={routeName}
              assigned={assigned}
              alternatives={alternatives}
              onAssign={handleAssign}
              focused={focusRoute === routeId}
              flashId={flashId}
            />
          ))}

          {unassigned.length > 0 && (
            <div className="rm-section">
              <div className="rm-section-head">Unassigned</div>
              {unassigned.map(m => {
                const metLoc = m.metLocation ?? m.met_location ?? m.route;
                const metName = m.metLocationName || m.met_location_name || m.route_name || `Loc ${metLoc}`;
                return (
                  <MonRow
                    key={m.personality}
                    mon={m}
                    sub={`from ${metName}`}
                    flash={flashId === m.personality}
                    action={<button className="rm-btn" onClick={() => handleAssign(metLoc, m.personality)}>Assign</button>}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RouteSection({ routeId, routeName, assigned, alternatives, onAssign, focused, flashId }) {
  const [open, setOpen] = useState(focused || alternatives.length > 0);

  return (
    <div className={`rm-section ${focused ? 'rm-section-focus' : ''}`}>
      <div className="rm-section-head" onClick={() => setOpen(o => !o)}>
        <span>{routeName}</span>
        <span className="rm-chevron">{open ? '▾' : '▸'}</span>
      </div>
      {open && (
        <div className="rm-section-body">
          {assigned ? (
            <MonRow mon={assigned} highlight flash={flashId === assigned.personality} />
          ) : (
            <div className="rm-empty-slot">No Pokemon assigned</div>
          )}
          {alternatives.map(m => (
            <MonRow
              key={m.personality}
              mon={m}
              sub="available"
              flash={flashId === m.personality}
              action={<button className="rm-btn" onClick={() => onAssign(routeId, m.personality)}>Assign</button>}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MonRow({ mon, highlight, sub, action, flash }) {
  const species = mon.species_name || mon.species || '';
  const name = mon.nickname || species || '???';
  const img = useSprite(species);

  const cls = [
    'rm-row',
    highlight ? 'rm-row-active' : '',
    flash ? 'rm-row-flash' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={cls}>
      {img ? (
        <img className="rm-sprite" src={img} alt={species} loading="lazy" />
      ) : (
        <div className="rm-sprite-fb">?</div>
      )}
      <div className="rm-row-info">
        <span className="rm-row-name">{name}</span>
        <span className="rm-row-level">Lv. {mon.level || 0}</span>
      </div>
      {sub && <span className="rm-row-sub">{sub}</span>}
      {highlight && <span className="rm-row-tag">Assigned</span>}
      {action && <div className="rm-row-action">{action}</div>}
    </div>
  );
}
