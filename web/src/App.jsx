import { useState, useCallback, useRef, useEffect } from 'react';
import StatusBar from './components/StatusBar';
import SettingsModal from './components/SettingsModal';
import PartyGrid from './components/PartyGrid';
import SoulLinkTimeline from './components/SoulLinkTimeline';
import RouteLinkList, { SoloRouteLinkList } from './components/RouteLinkList';
import EventToasts from './components/EventToasts';
import DebugTicker from './components/DebugTicker';
import BattleCard from './components/BattleCard';
import TrainerColumn from './components/TrainerColumn';
import RouteManager from './components/RouteManager';
import TrainerSpritePicker, { getTrainerSpriteUrl } from './components/TrainerSpritePicker';
import useLocalTracker from './hooks/useLocalTracker';
import useRoom from './hooks/useRoom';
import { getMockPlayerCount, generateMockData } from './utils/mockData';
import { getTimeline } from './data/gameTimelines';
import {
  getPlayerId, getPlayerName, setPlayerName as saveName,
  getLocalUrl, setLocalUrl as saveLocal,
  getSyncUrl, setSyncUrl as saveSync,
  getSoloAssignments, setSoloAssignments,
  getTrainerSprite, setTrainerSprite as saveTrainerSprite,
} from './utils/api';

function mergeLocalDetails(base, details, routeLabel) {
  return {
    ...base,
    ...details,
    routeName: routeLabel || base.routeName || base.route_name,
    route_name: routeLabel || base.route_name || base.routeName,
    metLocationName:
      details?.metLocationName ||
      details?.met_location_name ||
      base.metLocationName ||
      base.met_location_name ||
      routeLabel,
  };
}

function applySoloFirstCatch(routes, assignments) {
  return routes.map(route => {
    const mons = route.pokemon || [];
    if (mons.length <= 1) return route;
    const assignedPersonality = assignments[String(route.locationId)] ?? assignments[route.locationId];
    const assigned = assignedPersonality
      ? mons.find(m => m.personality === assignedPersonality) || mons[0]
      : mons[0];
    return { ...route, pokemon: [assigned], allPokemon: mons };
  });
}

function buildRouteMap(routes) {
  const map = {};
  for (const route of routes) {
    const name = route.locationName || route.route_name || '';
    for (const mon of (route.pokemon || [])) {
      if (mon.personality) map[mon.personality] = name;
    }
  }
  return map;
}

function buildRoomRouteMap(pairs) {
  const map = {};
  for (const pair of pairs) {
    const name = pair.route_name || '';
    for (const mon of Object.values(pair.pokemon || {})) {
      if (mon.personality) map[mon.personality] = name;
    }
  }
  return map;
}

export default function App() {
  const [playerName, setPlayerName] = useState(getPlayerName());
  const [localUrl, setLocalUrl]     = useState(getLocalUrl());
  const [syncUrl, setSyncUrl]       = useState(getSyncUrl());
  const [soloAssignments, _setSoloAssignments] = useState({});
  const [routeManagerOpen, setRouteManagerOpen] = useState(false);
  const [focusRoute, setFocusRoute] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [trainerSpriteId, setTrainerSpriteId] = useState(getTrainerSprite);
  const [spritePickerOpen, setSpritePickerOpen] = useState(false);

  const { connected: localOk, status, soulLink, party: localParty, trainerInfo, enemyParty } = useLocalTracker(localUrl);
  const room = useRoom(syncUrl, playerName, status, soulLink, localParty, enemyParty);


  const localPlayerId = getPlayerId();

  function handleNameChange(n)     { setPlayerName(n); saveName(n); }
  function handleLocalChange(u)    { setLocalUrl(u);   saveLocal(u); }
  function handleSyncChange(u)     { setSyncUrl(u);    saveSync(u); }
  function handleSpriteChange(id)  { setTrainerSpriteId(id); saveTrainerSprite(id); }

  const resolvedTrainerName = trainerInfo?.name || playerName || 'You';
  const trainerSpriteUrl = getTrainerSpriteUrl(trainerSpriteId);
  const gameName = status?.game?.name || (getMockPlayerCount() > 0 ? 'Radical Red' : null);

  const soloGameKey = status?.game?.profileId
    ? `${status.game.name || 'unknown'}:${status.game.profileId}`
    : '';

  useEffect(() => {
    if (soloGameKey) {
      _setSoloAssignments(getSoloAssignments(soloGameKey));
    }
  }, [soloGameKey]);

  const updateSoloAssignments = useCallback((newAssignments) => {
    _setSoloAssignments(newAssignments);
    setSoloAssignments(newAssignments, soloGameKey);
  }, [soloGameKey]);

  const soloRoutes = soulLink?.routes || [];
  const soloEvents = soulLink?.recentEvents || [];
  const inBattle = enemyParty.length > 0;

  const prevInBattleRef = useRef(false);
  const [battleEvents, setBattleEvents] = useState([]);

  useEffect(() => {
    const wasInBattle = prevInBattleRef.current;
    prevInBattleRef.current = inBattle;

    if (inBattle && !wasInBattle) {
      const lead = enemyParty[0];
      setBattleEvents(prev => [...prev, {
        id: `battle_start_${Date.now()}`,
        type: 'battle_start',
        pokemon: { species: lead?.species, level: lead?.level },
        timestamp: Date.now(),
      }]);
    } else if (!inBattle && wasInBattle) {
      setBattleEvents(prev => [...prev, {
        id: `battle_end_${Date.now()}`,
        type: 'battle_end',
        timestamp: Date.now(),
      }]);
    }
  }, [inBattle]);

  const roomPairs  = room.roomState?.pairs || [];
  const roomEvents = room.roomState?.events || [];
  const roomPlayers = room.roomState?.players || [];
  const roomCatches = room.roomState?.catches || [];

  const localPartyByPersonality = new Map((localParty || []).map(mon => [mon.personality, mon]));
  const snapshotByPlayer = new Map(
    Object.entries(room.roomState?.player_snapshots || {}).map(([playerId, snapshot]) => [
      playerId,
      new Map((snapshot.current_party || []).map(mon => [mon.personality, mon])),
    ])
  );

  const enrichedSoloRoutes = soloRoutes.map(route => ({
    ...route,
    pokemon: (route.pokemon || []).map(mon =>
      mergeLocalDetails(mon, localPartyByPersonality.get(mon.personality), route.locationName)
    ),
  }));

  const filteredSoloRoutes = applySoloFirstCatch(enrichedSoloRoutes, soloAssignments);
  const allSoloCatches = enrichedSoloRoutes.flatMap(r => r.pokemon || []);

  const enrichedLocalParty = (localParty || []).map(mon => {
    const routeInfo = enrichedSoloRoutes.find(r =>
      (r.pokemon || []).some(p => p.personality === mon.personality)
    );
    return mergeLocalDetails(mon, {}, routeInfo?.locationName || '');
  });

  const soloRouteMap = buildRouteMap(filteredSoloRoutes);

  const enrichedRoomPairs = roomPairs.map(pair => {
    const mergedPokemon = {};
    Object.entries(pair.pokemon || {}).forEach(([playerId, mon]) => {
      const snapMap = snapshotByPlayer.get(playerId);
      const snapMon = snapMap?.get(mon.personality);
      mergedPokemon[playerId] = {
        ...mon,
        ...snapMon,
        route_name: pair.route_name,
        routeName: pair.route_name,
        met_location_name: snapMon?.met_location_name || pair.route_name,
      };
    });
    return { ...pair, pokemon: mergedPokemon };
  });

  const roomRouteMap = buildRoomRouteMap(enrichedRoomPairs);
  const isRoom = room.mode === 'room' && room.roomState;

  const trainerParties = isRoom
    ? roomPlayers.map(p => {
        const isLocal = p.player_id === localPlayerId;
        const snap = room.roomState?.player_snapshots?.[p.player_id];
        const baseParty = isLocal ? enrichedLocalParty : (snap?.current_party || []);
        const party = baseParty.map(mon => {
          const pairMon = enrichedRoomPairs.flatMap(pair =>
            Object.entries(pair.pokemon || {})
              .filter(([pid]) => pid === p.player_id)
              .map(([, m]) => m)
          ).find(m => m.personality === mon.personality);
          return { ...mon, ...pairMon };
        });
        const playerSprite = snap?.trainer_sprite_id
          ? getTrainerSpriteUrl(snap.trainer_sprite_id)
          : (isLocal ? trainerSpriteUrl : null);
        return {
          name: p.player_name,
          playerId: p.player_id,
          party,
          spriteUrl: playerSprite,
          money: snap?.money,
          coins: snap?.coins,
        };
      })
    : [{
        name: resolvedTrainerName,
        playerId: localPlayerId,
        party: enrichedLocalParty,
        spriteUrl: trainerSpriteUrl,
        money: trainerInfo?.money,
        coins: trainerInfo?.coins,
      }];

  const roomLinks = enrichedRoomPairs.map(pair => ({
    route: pair.route,
    routeName: pair.route_name,
    pokemon: pair.pokemon,
    team: pair.team || '',
    anyDead: Object.values(pair.pokemon || {}).some(m => m.alive === false),
  }));

  const roomMode = room.roomState?.settings?.mode || 'soullink';

  const mockPlayerCount = getMockPlayerCount();
  const mockDataRef = useRef(null);
  if (mockPlayerCount > 0 && !mockDataRef.current) {
    mockDataRef.current = generateMockData({
      name: resolvedTrainerName,
      playerId: localPlayerId,
      party: enrichedLocalParty,
      spriteUrl: trainerSpriteUrl,
      money: trainerInfo?.money || 0,
      coins: trainerInfo?.coins || 0,
    });
  }
  const mockData = mockDataRef.current;

  const isMockMode = mockData !== null;
  const isRaceMode = isMockMode ? !!mockData.raceMode : roomMode === 'race';
  const isSolo = !isRoom && !isMockMode;
  const isMulti = (isRoom && trainerParties.length > 1) || isMockMode;

  const teamNames = isMockMode
    ? { A: 'Alpha Squad', B: 'Beta Crew' }
    : (room.roomState?.settings?.team_names || {});
  const getTeamName = (key) => teamNames[key] || `Team ${key}`;

  let finalTrainerParties, finalRoomLinks, finalRoomPlayers, finalRoomEvents, finalRouteMap;
  if (isMockMode) {
    const localEntry = {
      name: resolvedTrainerName,
      playerId: localPlayerId,
      party: enrichedLocalParty,
      spriteUrl: trainerSpriteUrl,
      money: trainerInfo?.money,
      coins: trainerInfo?.coins,
    };
    finalTrainerParties = [localEntry, ...mockData.trainerParties.slice(1)];
    finalRoomLinks = mockData.roomLinks;
    finalRoomPlayers = mockData.roomPlayers;
    finalRoomEvents = mockData.roomEvents;
    finalRouteMap = buildRoomRouteMap(mockData.roomPairs);
  } else {
    finalTrainerParties = trainerParties;
    finalRoomLinks = roomLinks;
    finalRoomPlayers = roomPlayers;
    finalRoomEvents = roomEvents;
    finalRouteMap = roomRouteMap;
  }

  function handleSoloAssign(routeId, personality) {
    const next = { ...soloAssignments, [String(routeId)]: personality };
    updateSoloAssignments(next);
  }

  function handleRoomAssign(routeId, personality) {
    room.reassign(routeId, personality);
  }

  return (
    <div className="app-shell">
      <StatusBar
        localConnected={localOk}
        syncConnected={room.syncConnected}
        mode={room.mode}
        roomCode={room.roomCode}
        gameInfo={status}
        players={roomPlayers}
        localPlayerId={localPlayerId}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenRouteManager={() => { setFocusRoute(null); setRouteManagerOpen(true); }}
      />

      {!localOk && !isMockMode && (
        <div className="landing">
          <div className="landing-hero">
            <img className="landing-mascot" src="/link-cable.png" alt="Link Cable" />
            <h1 className="landing-title">Link Cable</h1>
            <p className="landing-subtitle">A Pokemon ROM Companion</p>
            <div className="landing-features">
              <div className="landing-feat">
                <span className="landing-feat-icon">⚡</span>
                <div>
                  <strong>Live Tracking</strong>
                  <span>Real-time party, stats, and battle data from your emulator</span>
                </div>
              </div>
              <div className="landing-feat">
                <span className="landing-feat-icon">🔗</span>
                <div>
                  <strong>Soul Link Sync</strong>
                  <span>Link encounters across players with shared tracking</span>
                </div>
              </div>
              <div className="landing-feat">
                <span className="landing-feat-icon">⚔</span>
                <div>
                  <strong>Battle Awareness</strong>
                  <span>See your partner's battles and get type matchup info</span>
                </div>
              </div>
            </div>
            <button className="landing-cta" onClick={() => setSettingsOpen(true)}>Get Started</button>
            <p className="landing-hint">Start BizHawk with the Link Cable Lua script, then connect above.</p>
          </div>
        </div>
      )}

      <main className="main-area" style={!localOk && !isMockMode ? { display: 'none' } : undefined}>

        {localOk && isSolo && (() => {
          const timeline = getTimeline(gameName);
          const soloLeadOpponent = enemyParty?.[0]?.types || [];
          const soloLeadPlayerTypes = trainerParties[0]?.party?.[0]?.types || [];
          return (
            <div className={`layout-main${inBattle ? ' lm-battle' : ''}`}>
              <section className="col-party">
                <PartyGrid trainerName={trainerParties[0]?.name} party={trainerParties[0]?.party} routeMap={soloRouteMap} trainerSprite={trainerParties[0]?.spriteUrl} inBattle={inBattle} opponentTypes={soloLeadOpponent} />
              </section>
              {inBattle && (
                <section className="col-battle">
                  <h2 className="section-title">Battle</h2>
                  <BattleCard enemyParty={enemyParty} playerLeadTypes={soloLeadPlayerTypes} />
                </section>
              )}
              <section className="col-encounters">
                <h2 className="section-title">Encounters</h2>
                {filteredSoloRoutes.length > 0 && <SoloRouteLinkList routes={filteredSoloRoutes} gameName={gameName} />}
              </section>
              <aside className="col-timeline">
                {timeline && <SoulLinkTimeline timeline={timeline} encounters={filteredSoloRoutes} gameName={gameName} />}
              </aside>
            </div>
          );
        })()}

        {(localOk || isMockMode) && isMulti && (() => {
          const timeline = getTimeline(gameName);
          const localTrainer = finalTrainerParties.find(t => t.playerId === localPlayerId) || finalTrainerParties[0];
          const otherTrainers = finalTrainerParties.filter(t => t.playerId !== localPlayerId);
          const leadOpponentTypes = enemyParty?.[0]?.types || [];
          const leadPlayerTypes = localTrainer?.party?.[0]?.types || [];

          const partnerBattles = (finalRoomPlayers || [])
            .filter(p => (p.player_id || p) !== localPlayerId)
            .map(p => {
              const pid = p.player_id || p;
              const snap = room.roomState?.player_snapshots?.[pid];
              const ep = snap?.enemy_party || [];
              return ep.length > 0 ? { playerName: p.player_name || pid, lead: ep[0] } : null;
            })
            .filter(Boolean);

          const myTeam = (finalRoomPlayers || []).find(p => p.player_id === localPlayerId)?.team || 'A';
          const enemyTeam = myTeam === 'A' ? 'B' : 'A';
          const teamOrder = [myTeam, enemyTeam];

          const lmClasses = ['layout-main', 'lm-trainers'];
          if (inBattle) lmClasses.push('lm-battle');
          return (
            <div className={lmClasses.join(' ')}>
              <section className="col-trainers">
                <div className="ts-hero">
                  <img className="ts-hero-sprite"
                    src={localTrainer?.spriteUrl || 'https://play.pokemonshowdown.com/sprites/trainers/red.png'}
                    alt="" />
                </div>
                {otherTrainers.length > 0 && (
                  <TrainerColumn
                    trainers={otherTrainers}
                    players={finalRoomPlayers}
                    teamNames={teamNames}
                    isRaceMode={isRaceMode}
                    myTeam={myTeam}
                  />
                )}
              </section>
              <section className="col-party">
                {partnerBattles.length > 0 && (
                  <div className="partner-battle-banner glass-card">
                    {partnerBattles.map(pb => (
                      <div key={pb.playerName} className="pb-row">
                        <span className="pb-icon">⚔</span>
                        <span className="pb-text">
                          <strong>{pb.playerName}</strong> battling{' '}
                          {pb.lead.species_name || pb.lead.species || '???'}
                          {pb.lead.level ? ` Lv.${pb.lead.level}` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <PartyGrid
                  trainerName={localTrainer.name}
                  party={localTrainer.party}
                  routeMap={finalRouteMap}
                  trainerSprite={localTrainer.spriteUrl}
                  inBattle={inBattle}
                  opponentTypes={leadOpponentTypes}
                />
              </section>
              {inBattle && (
                <section className="col-battle">
                  <h3 className="section-title">Battle</h3>
                  <BattleCard enemyParty={enemyParty} playerLeadTypes={leadPlayerTypes} />
                </section>
              )}
              <section className="col-encounters">
                {isRaceMode && finalRoomLinks.length > 0 ? (
                  <>
                    {teamOrder.map((team, idx) => {
                      const teamLinks = finalRoomLinks.filter(l => l.team === team);
                      const teamPlayers = (finalRoomPlayers || []).filter(p => p.team === team);
                      if (teamLinks.length === 0 && teamPlayers.length === 0) return null;
                      const side = idx === 0 ? 'mine' : 'theirs';
                      return (
                        <div key={team} className="race-team-section">
                          <h3 className={`section-title race-team-header race-team-${side}`}>{getTeamName(team)}</h3>
                          {teamLinks.length > 0 && <RouteLinkList links={teamLinks} players={teamPlayers} />}
                        </div>
                      );
                    })}
                  </>
                ) : finalRoomLinks.length > 0 ? (
                  <>
                    <h3 className="section-title">Linked Encounters</h3>
                    <RouteLinkList links={finalRoomLinks} players={finalRoomPlayers} />
                  </>
                ) : null}
              </section>
              <aside className="col-timeline">
                <SoulLinkTimeline
                  timeline={timeline}
                  encounters={finalRoomLinks.map(l => ({
                    locationName: l.routeName,
                    pokemon: l.pokemon[localPlayerId] ? [l.pokemon[localPlayerId]] : [],
                  }))}
                  gameName={gameName}
                  teams={isRaceMode ? { links: finalRoomLinks, players: finalRoomPlayers, teamNames } : null}
                  myTeam={myTeam}
                  battlesByTeam={isRaceMode ? (() => {
                    const bt = {};
                    for (const p of (finalRoomPlayers || [])) {
                      const snap = room.roomState?.player_snapshots?.[p.player_id];
                      if (snap?.enemy_party?.length > 0) {
                        const team = p.team || 'A';
                        if (!bt[team]) bt[team] = true;
                      }
                    }
                    return bt;
                  })() : null}
                />
              </aside>
            </div>
          );
        })()}

        {localOk && isRoom && !isMulti && !isMockMode && (() => {
          const soloLeadOpponentTypes = enemyParty?.[0]?.types || [];
          const soloLeadPlayerTypes = trainerParties[0]?.party?.[0]?.types || [];
          const timeline = getTimeline(gameName);
          return (
            <div className={`layout-main${inBattle ? ' lm-battle' : ''}`}>
              <section className="col-party">
                <PartyGrid trainerName={trainerParties[0]?.name} party={trainerParties[0]?.party} routeMap={roomRouteMap} trainerSprite={trainerParties[0]?.spriteUrl} inBattle={inBattle} opponentTypes={soloLeadOpponentTypes} />
              </section>
              {inBattle && (
                <section className="col-battle">
                  <h2 className="section-title">Battle</h2>
                  <BattleCard enemyParty={enemyParty} playerLeadTypes={soloLeadPlayerTypes} />
                </section>
              )}
              <section className="col-encounters">
                <h2 className="section-title">Encounters</h2>
                {roomLinks.length > 0 && <RouteLinkList links={roomLinks} players={roomPlayers} />}
              </section>
              <aside className="col-timeline">
                {timeline && <SoulLinkTimeline timeline={timeline} encounters={filteredSoloRoutes} gameName={gameName} />}
              </aside>
            </div>
          );
        })()}
      </main>

      {settingsOpen && (
        <SettingsModal
          playerName={playerName}
          onNameChange={handleNameChange}
          localUrl={localUrl}
          onLocalUrlChange={handleLocalChange}
          syncUrl={syncUrl}
          onSyncUrlChange={handleSyncChange}
          roomCode={room.roomCode}
          onRoomCodeChange={room.setRoomCode}
          onCreate={room.create}
          onJoin={room.join}
          onSolo={room.goSolo}
          onSetTeamNames={room.setTeamNames}
          mode={room.mode}
          error={room.error}
          roomSettings={room.roomState?.settings}
          trainerSpriteId={trainerSpriteId}
          onOpenSpritePicker={() => setSpritePickerOpen(true)}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {spritePickerOpen && (
        <TrainerSpritePicker
          selected={trainerSpriteId}
          onSelect={handleSpriteChange}
          onClose={() => setSpritePickerOpen(false)}
        />
      )}

      <EventToasts events={[...soloEvents, ...roomEvents, ...battleEvents]} />

      <DebugTicker
        localConnected={localOk}
        syncConnected={room.syncConnected}
        mode={room.mode}
        roomCode={room.roomCode}
      />


      {routeManagerOpen && (() => {
        const roomAssignments = room.roomState?.route_assignments?.[localPlayerId] || {};
        const intKeyedRoomAssignments = {};
        for (const [k, v] of Object.entries(roomAssignments)) {
          intKeyedRoomAssignments[Number(k)] = v;
        }
        return (
          <RouteManager
            routes={isRoom ? enrichedRoomPairs.map(p => ({ locationId: p.route, locationName: p.route_name, pokemon: Object.values(p.pokemon || {}) })) : enrichedSoloRoutes}
            allCatches={isRoom ? roomCatches.filter(c => c.player_id === localPlayerId) : allSoloCatches}
            assignments={isRoom ? intKeyedRoomAssignments : soloAssignments}
            onAssign={isRoom ? handleRoomAssign : handleSoloAssign}
            onClose={() => setRouteManagerOpen(false)}
            focusRoute={focusRoute}
          />
        );
      })()}
    </div>
  );
}
