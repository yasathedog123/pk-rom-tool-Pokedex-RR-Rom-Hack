export default function StatusBar({ localConnected, syncConnected, mode, roomCode, gameInfo, onOpenSettings, onOpenRouteManager, players, localPlayerId }) {
  const gameName = gameInfo?.game?.name;
  const gameVersion = gameInfo?.game?.version;
  const gen = gameInfo?.game?.generation;
  const hasGame = gameName && gameName !== 'None';

  return (
    <header className="status-bar">
      <div className="brand">
        <img className="brand-logo" src="/link-cable.png" alt="" />
        <h1>Link Cable</h1>
        <span className="brand-sub">Pokemon ROM Companion</span>
        {hasGame && (
          <span className="brand-game">
            {gameName}
            {gameVersion && gameVersion !== 'None' && ` — ${gameVersion}`}
            {gen > 0 && <span className="brand-gen">Gen {gen}</span>}
          </span>
        )}
      </div>
      <div className="toolbar">
        {mode === 'room' && players && players.length > 0 && (
          <div className="player-indicators">
            {players.map(p => {
              const isLocal = p.player_id === localPlayerId;
              const staleMs = p.last_seen ? Date.now() - new Date(p.last_seen).getTime() : Infinity;
              const online = staleMs < 30000;
              return (
                <span key={p.player_id} className={`pi-chip ${online ? 'pi-online' : 'pi-offline'}`} title={`${p.player_name}${isLocal ? ' (you)' : ''} — ${online ? 'online' : 'offline'}`}>
                  <span className={`pi-dot ${online ? '' : 'pi-dot-off'}`} />
                  {p.player_name || p.player_id.slice(0, 6)}
                </span>
              );
            })}
          </div>
        )}
        <div className="indicators">
          <Pill label="Tracker" ok={localConnected} />
          <Pill label="Sync" ok={syncConnected} />
          <Pill label={mode === 'room' ? `Room ${roomCode}` : 'Solo'} ok={mode === 'room'} variant={mode === 'solo' ? 'neutral' : undefined} />
        </div>
        <div className="toolbar-actions">
          {onOpenRouteManager && (
            <button className="toolbar-btn" onClick={onOpenRouteManager} title="Manage Routes">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
          )}
          {onOpenSettings && (
            <button className="toolbar-btn" onClick={onOpenSettings} title="Settings">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

function Pill({ label, ok, variant }) {
  const cls = variant === 'neutral' ? 'pill neutral' : ok ? 'pill on' : 'pill off';
  return <span className={cls}>{label}</span>;
}
