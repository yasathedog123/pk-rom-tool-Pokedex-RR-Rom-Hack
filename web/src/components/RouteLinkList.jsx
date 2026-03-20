import useSprite from '../hooks/useSprite';

export default function RouteLinkList({ links, players }) {
  if (!links || links.length === 0) return null;

  return (
    <div className="et-wrap">
      <div className="et glass-card">
        <div className="et-head-row">
          <div className="et-col-route et-hdr">Route</div>
          {(players || []).map(p => (
            <div key={p.player_id || p} className="et-col-trainer et-hdr">
              {p.player_name || p}
            </div>
          ))}
        </div>
        <div className="et-body">
          {links.map((link, idx) => (
            <div key={link.route} className={`et-row ${link.anyDead ? 'et-row-dead' : ''} ${idx % 2 === 1 ? 'et-row-alt' : ''}`}>
              <div className="et-col-route">{link.routeName || `Loc ${link.route}`}</div>
              {(players || []).map(p => {
                const pid = p.player_id || p;
                const mon = link.pokemon?.[pid];
                return (
                  <div key={pid} className="et-col-trainer">
                    {mon ? <EncounterCell mon={mon} /> : <span className="et-empty">--</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SoloRouteLinkList({ routes }) {
  if (!routes || routes.length === 0) return null;

  return (
    <div className="et-wrap et-wrap-solo">
      <div className="et glass-card">
        <div className="et-head-row">
          <div className="et-col-route et-hdr">Route</div>
          <div className="et-col-trainer et-hdr">Pokemon</div>
          <div className="et-col-status et-hdr">Status</div>
        </div>
        <div className="et-body">
          {routes.map((route, idx) => {
            const mon = route.pokemon?.[0];
            const anyDead = (route.pokemon || []).some(m => m.alive === false || (m.currentHP ?? m.current_hp ?? 1) === 0);
            return (
              <div key={route.locationId} className={`et-row ${anyDead ? 'et-row-dead' : ''} ${idx % 2 === 1 ? 'et-row-alt' : ''}`}>
                <div className="et-col-route">{route.locationName || `Loc ${route.locationId}`}</div>
                <div className="et-col-trainer">
                  {mon ? <EncounterCell mon={mon} /> : <span className="et-empty">--</span>}
                </div>
                <div className="et-col-status">
                  {mon && (mon.alive === false ? <span className="et-tag-dead">Fallen</span>
                    : (mon.in_party ?? mon.inParty) === false ? <span className="et-tag-box">Boxed</span>
                    : <span className="et-tag-party">Party</span>)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EncounterCell({ mon }) {
  const species = mon.species_name || mon.species || '';
  const name = mon.nickname || species || '???';
  const img = useSprite(species);
  const alive = mon.alive !== undefined ? mon.alive : true;
  const inParty = mon.in_party ?? mon.inParty ?? true;

  return (
    <div className={`et-cell ${!alive ? 'et-cell-dead' : ''}`}>
      {img ? (
        <img className="et-sprite" src={img} alt={species} loading="lazy" />
      ) : (
        <div className="et-sprite-fb">?</div>
      )}
      <div className="et-cell-info">
        <span className="et-cell-name">{name}</span>
        {!alive && <span className="et-tag-dead">Fallen</span>}
        {alive && !inParty && <span className="et-tag-box">Boxed</span>}
      </div>
    </div>
  );
}
