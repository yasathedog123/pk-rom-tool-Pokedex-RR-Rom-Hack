import PokemonCard from './PokemonCard';

export default function RoutePairRow({ pair, players, onUndoDeath }) {
  const pokemon = pair.pokemon || {};
  const anyDead = Object.values(pokemon).some(m => m.alive === false);

  return (
    <div className={`route-row ${anyDead ? 'route-dead' : 'route-alive'}`}>
      <div className="route-label">
        <span className="route-name">{pair.route_name || `Location ${pair.route}`}</span>
        <div className="route-actions">
          {anyDead && <span className="route-fallen-tag">FALLEN</span>}
          {anyDead && onUndoDeath && (
            <button
              className="undo-button"
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`Undo death for ${pair.route_name || `Location ${pair.route}`}?`)) {
                  onUndoDeath(pair.route);
                }
              }}
            >
              Undo
            </button>
          )}
        </div>
      </div>
      <div className="route-cards">
        {(players || []).map(p => {
          const mon = pokemon[p.player_id || p];
          if (!mon) {
            return (
              <div key={p.player_id || p} className="poke-card waiting">
                <div className="poke-owner">{p.player_name || p}</div>
                <div className="poke-waiting">Waiting for catch...</div>
              </div>
            );
          }
          return (
            <PokemonCard
              key={mon.personality || mon.id}
              mon={mon}
              playerName={mon.player_name || p.player_name || p}
              dead={anyDead}
            />
          );
        })}
      </div>
    </div>
  );
}
