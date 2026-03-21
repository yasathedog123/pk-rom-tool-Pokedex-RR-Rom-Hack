export default function EventFeed({ events }) {
  if (!events || events.length === 0) {
    return <div className="feed-empty">No events yet.</div>;
  }

  return (
    <div className="feed">
      {events.slice().reverse().slice(0, 40).map((ev, i) => (
        <FeedItem key={ev.id || i} event={ev} />
      ))}
    </div>
  );
}

function FeedItem({ event }) {
  const mon = event.pokemon || event;
  const species = mon.species_name || mon.species || '';
  const nickname = mon.nickname || '';
  const location = mon.met_location_name || mon.metLocationName || '';
  const player = event.player_name || '';
  const type = event.type || '';
  const hasNickname = nickname && nickname !== species;

  let icon = '';
  let cls = '';
  if (type === 'catch')             { icon = '+'; cls = 'feed-catch'; }
  else if (type === 'faint')        { icon = '×'; cls = 'feed-faint'; }
  else if (type === 'gift')         { icon = '★'; cls = 'feed-catch'; }
  else if (type === 'battle_start') { icon = '⚔'; cls = 'feed-battle'; }
  else if (type === 'battle_end')   { icon = '✓'; cls = 'feed-battle-end'; }
  else                              { icon = '·'; cls = ''; }

  if (type === 'battle_start') {
    return (
      <div className={`feed-item ${cls}`}>
        <span className="feed-icon">{icon}</span>
        <div className="feed-body">
          Battle started{species ? <> vs <strong>{species}</strong></> : null}
          {mon.level ? <span className="feed-loc"> Lv.{mon.level}</span> : null}
        </div>
      </div>
    );
  }

  if (type === 'battle_end') {
    return (
      <div className={`feed-item ${cls}`}>
        <span className="feed-icon">{icon}</span>
        <div className="feed-body">Battle ended</div>
      </div>
    );
  }

  return (
    <div className={`feed-item ${cls}`}>
      <span className="feed-icon">{icon}</span>
      <div className="feed-body">
        <span className="feed-player">{player}</span>
        {' '}{type}{' '}
        <strong>{species || '???'}</strong>
        {hasNickname && <span className="feed-nick"> "{nickname}"</span>}
        {location && <span className="feed-loc"> — {location}</span>}
      </div>
    </div>
  );
}
