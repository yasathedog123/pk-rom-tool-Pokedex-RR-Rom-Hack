import { useState, useEffect, useRef } from 'react';

function ts() { return new Date().toLocaleTimeString(); }
function mkLog(text, type) { return { text, type, id: Date.now() + Math.random(), ts: ts() }; }

export default function DebugTicker({ localConnected, syncConnected, mode, roomCode }) {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const prevState = useRef(null);

  useEffect(() => {
    const prev = prevState.current;
    const entries = [];

    if (prev === null) {
      entries.push(mkLog(localConnected ? 'Tracker connected' : 'Tracker offline', localConnected ? 'ok' : 'err'));
      entries.push(mkLog(syncConnected ? 'Sync server connected' : 'Sync server offline', syncConnected ? 'ok' : 'err'));
      if (mode === 'room' && roomCode) entries.push(mkLog(`In room ${roomCode}`, 'info'));
    } else {
      if (prev.localConnected !== localConnected) {
        entries.push(mkLog(localConnected ? 'Tracker connected' : 'Tracker disconnected', localConnected ? 'ok' : 'err'));
      }
      if (prev.syncConnected !== syncConnected) {
        entries.push(mkLog(syncConnected ? 'Sync server connected' : 'Sync server disconnected', syncConnected ? 'ok' : 'err'));
      }
      if (prev.mode !== mode) {
        entries.push(mkLog(mode === 'room' ? `Joined room ${roomCode}` : 'Switched to solo', 'info'));
      }
    }

    prevState.current = { localConnected, syncConnected, mode, roomCode };

    if (entries.length > 0) {
      setLogs(prev => [...prev, ...entries].slice(-50));
    }
  }, [localConnected, syncConnected, mode, roomCode]);

  const dotColor = localConnected ? (syncConnected ? '#34d399' : '#fbbf24') : '#ef4444';

  return (
    <div className="dt-wrap">
      <button className="dt-toggle" onClick={() => setOpen(o => !o)} title="Connection Log">
        <span className="dt-dot" style={{ background: dotColor }} />
      </button>
      {open && (
        <div className="dt-panel glass-card">
          <div className="dt-header">
            <span className="dt-title">Connection Log</span>
          </div>
          <div className="dt-status">
            <div className="dt-stat">
              <span className="dt-dot" style={{ background: localConnected ? '#34d399' : '#ef4444' }} />
              Tracker {localConnected ? 'Online' : 'Offline'}
            </div>
            <div className="dt-stat">
              <span className="dt-dot" style={{ background: syncConnected ? '#34d399' : '#ef4444' }} />
              Sync {syncConnected ? 'Online' : 'Offline'}
            </div>
            {mode === 'room' && roomCode && (
              <div className="dt-stat">
                <span className="dt-dot" style={{ background: '#3b82f6' }} />
                Room {roomCode}
              </div>
            )}
          </div>
          <div className="dt-logs">
            {logs.length === 0 && <div className="dt-empty">No events yet</div>}
            {logs.slice().reverse().map(log => (
              <div key={log.id} className={`dt-log dt-log-${log.type}`}>
                <span className="dt-log-time">{log.ts}</span>
                <span className="dt-log-text">{log.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
