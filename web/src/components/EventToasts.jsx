import { useState, useEffect, useRef } from 'react';
import EventFeed from './EventFeed';

function toastText(event) {
  const mon = event.pokemon || event;
  const species = mon.species_name || mon.species || '';
  const nickname = mon.nickname || '';
  const player = event.player_name || '';
  const type = event.type || '';

  if (type === 'battle_start') return `Battle vs ${species}${mon.level ? ` Lv.${mon.level}` : ''}`;
  if (type === 'battle_end') return 'Battle ended';

  const name = nickname && nickname !== species ? `${species} "${nickname}"` : species || '???';
  return `${player ? player + ' ' : ''}${type} ${name}`;
}

function toastMeta(type) {
  if (type === 'catch' || type === 'gift') return { icon: '+', cls: 'toast-catch' };
  if (type === 'faint') return { icon: '×', cls: 'toast-faint' };
  if (type === 'battle_start') return { icon: '⚔', cls: 'toast-battle' };
  if (type === 'battle_end') return { icon: '✓', cls: 'toast-battle-end' };
  return { icon: '·', cls: '' };
}

export default function EventToasts({ events }) {
  const [toasts, setToasts] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const seenRef = useRef(new Set());
  const panelRef = useRef(null);

  useEffect(() => {
    if (!events || events.length === 0) return;

    const newToasts = [];
    for (const ev of events) {
      const id = ev.id || `${ev.type}_${ev.timestamp}`;
      if (!seenRef.current.has(id)) {
        seenRef.current.add(id);
        newToasts.push({ ...ev, _toastId: id, _exitAt: Date.now() + 4000 });
      }
    }

    if (newToasts.length > 0) {
      setToasts(prev => [...prev, ...newToasts].slice(-3));
    }
  }, [events]);

  useEffect(() => {
    if (toasts.length === 0) return;
    const soonest = Math.min(...toasts.map(t => t._exitAt));
    const delay = Math.max(100, soonest - Date.now());
    const timer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t._exitAt > Date.now()));
    }, delay);
    return () => clearTimeout(timer);
  }, [toasts]);

  useEffect(() => {
    if (!historyOpen) return;
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setHistoryOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [historyOpen]);

  return (
    <>
      <div className="toast-container">
        {toasts.map(t => {
          const { icon, cls } = toastMeta(t.type);
          const exiting = t._exitAt - Date.now() < 400;
          return (
            <div key={t._toastId} className={`toast-item ${cls} ${exiting ? 'toast-exit' : ''}`}>
              <span className="toast-icon">{icon}</span>
              <span className="toast-text">{toastText(t)}</span>
            </div>
          );
        })}
      </div>

      <button
        className="event-history-btn"
        onClick={() => setHistoryOpen(o => !o)}
        title="Event History"
      >
        <span className="event-history-icon">
          {historyOpen ? '✕' : '⚡'}
        </span>
        {!historyOpen && <span className="event-history-label">Events</span>}
      </button>

      {historyOpen && (
        <div className="event-history-panel glass-card" ref={panelRef}>
          <div className="event-history-header">
            <span>Event History</span>
            <button className="event-history-close" onClick={() => setHistoryOpen(false)}>✕</button>
          </div>
          <div className="event-history-body">
            <EventFeed events={events} />
          </div>
        </div>
      )}
    </>
  );
}
