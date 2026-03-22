import { useState, useCallback, useRef, useEffect } from 'react';
import StatusBar from './components/StatusBar';
import SettingsModal from './components/SettingsModal';
import PartyGrid from './components/PartyGrid';
import RouteLinkList, { SoloRouteLinkList } from './components/RouteLinkList';
import EventFeed from './components/EventFeed';
import EventToasts from './components/EventToasts';
import BattleCard from './components/BattleCard';
import RouteManager from './components/RouteManager';
import TrainerSpritePicker, { getTrainerSpriteUrl } from './components/TrainerSpritePicker';
import useLocalTracker from './hooks/useLocalTracker';
import useRoom from './hooks/useRoom';
import { getMockPlayerCount, generateMockData } from './utils/mockData';
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
  const [soloAssignments, _setSoloAssignments] = useState(getSoloAssignments);
  const [routeManagerOpen, setRouteManagerOpen] = useState(false);
  const [focusRoute, setFocusRoute] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [trainerSpriteId, setTrainerSpriteId] = useState(getTrainerSprite);
  const [spritePickerOpen, setSpritePickerOpen] = useState(false);
  const [selectedTrainerId, setSelectedTrainerId] = useState(null);

  const { connected: localOk, status, soulLink, party: localParty, trainerInfo, enemyParty } = useLocalTracker(localUrl);
  const room = useRoom(syncUrl, playerName, status, soulLink, localParty);

  const localPlayerId = getPlayerId();

  function handleNameChange(n)     { setPlayerName(n); saveName(n); }
  function handleLocalChange(u)    { setLocalUrl(u);   saveLocal(u); }
  function handleSyncChange(u)     { setSyncUrl(u);    saveSync(u); }
  function handleSpriteChange(id)  { setTrainerSpriteId(id); saveTrainerSprite(id); }

  const resolvedTrainerName = trainerInfo?.name || playerName || 'You';
  const trainerSpriteUrl = getTrainerSpriteUrl(trainerSpriteId);
  const gameName = status?.game?.name || (getMockPlayerCount() > 0 ? 'Radical Red' : null);

  const updateSoloAssignments = useCallback((newAssignments) => {
    _setSoloAssignments(newAssignments);
    setSoloAssignments(newAssignments);
  }, []);

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
        const snap = room.roomState?.player_snapshots?.[p.player_id];
        const party = (snap?.current_party || []).map(mon => {
          const pairMon = enrichedRoomPairs.flatMap(pair =>
            Object.entries(pair.pokemon || {})
              .filter(([pid]) => pid === p.player_id)
              .map(([, m]) => m)
          ).find(m => m.personality === mon.personality);
          return { ...mon, ...pairMon };
        });
        const playerSprite = snap?.trainer_sprite_id
          ? getTrainerSpriteUrl(snap.trainer_sprite_id)
          : (p.player_id === localPlayerId ? trainerSpriteUrl : null);
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
    anyDead: Object.values(pair.pokemon || {}).some(m => m.alive === false),
  }));

  const mockPlayerCount = getMockPlayerCount();
  const mockDataRef = useRef(null);
  if (mockPlayerCount > 0 && !mockDataRef.current) {
    mockDataRef.current = generateMockData({
      name: resolvedTrainerName,
      playerId: localPlayerId,
      party: [],
      spriteUrl: trainerSpriteUrl,
      money: 0,
      coins: 0,
    });
  }
  const mockData = mockDataRef.current;

  const isMockMode = mockData !== null;
  const isSolo = !isRoom && !isMockMode;
  const isMulti = (isRoom && trainerParties.length > 1) || isMockMode;

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
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenRouteManager={() => { setFocusRoute(null); setRouteManagerOpen(true); }}
      />

      <main className="main-area">
        {!localOk && !isMockMode && (
          <div className="empty-state">
            <h2>Waiting for Local Tracker</h2>
            <p>Start BizHawk with the pk-rom-tool script, then refresh.</p>
          </div>
        )}

        {localOk && isSolo && (() => {
          return (
            <div className="layout-solo">
              <section className="solo-party">
                <h2 className="section-title">Party</h2>
                <div className="party-grids">
                  {trainerParties.map(t => (
                    <PartyGrid key={t.playerId} trainerName={t.name} party={t.party} routeMap={soloRouteMap} trainerSprite={t.spriteUrl} />
                  ))}
                </div>
              </section>
              <section className="solo-encounters">
                {filteredSoloRoutes.length > 0 && <SoloRouteLinkList routes={filteredSoloRoutes} gameName={gameName} />}
              </section>
              <BattleCard enemyParty={enemyParty} />
            </div>
          );
        })()}

        {(localOk || isMockMode) && isMulti && (() => {
          const activeId = selectedTrainerId || finalTrainerParties[0]?.playerId;
          const activeTrainer = finalTrainerParties.find(t => t.playerId === activeId) || finalTrainerParties[0];
          const isViewingLocal = activeId === localPlayerId;
          const showBattle = isViewingLocal && inBattle;
          const leadOpponentTypes = enemyParty?.[0]?.types || [];
          const leadPlayerTypes = activeTrainer?.party?.[0]?.types || [];

          return (
            <div className="layout-multi-new">
              <aside className="multi-encounters">
                {finalRoomLinks.length > 0 && (
                  <div className="multi-links-section">
                    <h3 className="section-title">Linked Encounters</h3>
                    <RouteLinkList links={finalRoomLinks} players={finalRoomPlayers} />
                  </div>
                )}
              </aside>
              <section className="multi-party-col">
                <PartyGrid
                  trainerName={activeTrainer.name}
                  party={activeTrainer.party}
                  routeMap={finalRouteMap}
                  trainerSprite={activeTrainer.spriteUrl}
                  allTrainers={finalTrainerParties}
                  onSelectTrainer={setSelectedTrainerId}
                  activePlayerId={activeId}
                  inBattle={isViewingLocal && inBattle}
                  opponentTypes={isViewingLocal ? leadOpponentTypes : []}
                />
              </section>
              <aside className={`multi-battle-col${!isViewingLocal ? ' multi-battle-disabled' : ''}`}>
                <h3 className="section-title">Battle</h3>
                {!isViewingLocal
                  ? <div className="multi-battle-placeholder multi-battle-remote"><span>Battle data not available for remote players</span></div>
                  : showBattle
                    ? <BattleCard enemyParty={enemyParty} playerLeadTypes={leadPlayerTypes} />
                    : <div className="multi-battle-placeholder"><span>No active battle</span></div>
                }
              </aside>
              <aside className="multi-events-col">
                <h3 className="section-title">{isMockMode ? 'Events (Mock)' : 'Events'}</h3>
                <EventFeed events={[...finalRoomEvents, ...battleEvents]} />
              </aside>
            </div>
          );
        })()}

        {localOk && isRoom && !isMulti && !isMockMode && (() => {
          const soloLeadOpponentTypes = enemyParty?.[0]?.types || [];
          const soloLeadPlayerTypes = trainerParties[0]?.party?.[0]?.types || [];
          return (
            <div className="layout-solo">
              <section className="solo-party">
                <h2 className="section-title">Party</h2>
                <div className="party-grids">
                  {trainerParties.map(t => (
                    <PartyGrid key={t.playerId} trainerName={t.name} party={t.party} routeMap={roomRouteMap} trainerSprite={t.spriteUrl} inBattle={inBattle} opponentTypes={soloLeadOpponentTypes} />
                  ))}
                </div>
              </section>
              <section className="solo-encounters">
                {roomLinks.length > 0 && <RouteLinkList links={roomLinks} players={roomPlayers} />}
              </section>
              <BattleCard enemyParty={enemyParty} playerLeadTypes={soloLeadPlayerTypes} />
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
          mode={room.mode}
          error={room.error}
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

      <footer className="app-footer">
        <div className="footer-brand">
          <span className="footer-brand-item">Made by <strong>Foins</strong></span>
          <span className="footer-dot">&bull;</span>
          <span className="footer-brand-item">Maintained by <strong>Foins</strong></span>
        </div>
        <div className="footer-legal">
          All content &amp; design &copy; Pok&eacute;mon Nuzlocke Tracker, 2021-2026.
          {' '}<span className="footer-legal-muted">Privacy Policy</span>.
          {' '}<span className="footer-legal-muted">Credits</span>.
          <br />
          Pok&eacute;mon images &amp; names &copy; 1995-2024 Nintendo/Creatures Inc./GAME FREAK inc. TM
        </div>
      </footer>

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
