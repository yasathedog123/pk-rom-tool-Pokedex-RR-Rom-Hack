import { useState, useEffect, useRef, useCallback } from 'react';
import {
  getPlayerId, createRoom as apiCreateRoom, joinRoom as apiJoinRoom,
  fetchRoomState, sendReconcile, overrideDeath, reassignRoute as apiReassign,
} from '../utils/api';

function buildProfile(status) {
  const g = status?.game || {};
  return {
    game_name: g.name || '',
    game_version: g.version || '',
    generation: String(g.generation || ''),
    engine: g.engine || String(g.generation || ''),
    profile_id: g.profileId || '',
    rom_hash: g.romHash || '',
    client_version: 'web-v1',
  };
}

function mapSyncMon(mon) {
  return {
    personality: mon.personality,
    species_id: mon.speciesId,
    species_name: mon.species || '',
    nickname: mon.nickname || '',
    level: mon.level || 0,
    current_hp: mon.currentHP ?? 0,
    max_hp: mon.maxHP ?? 0,
    met_location: mon.metLocation ?? 0,
    met_location_name: mon.metLocationName || '',
    met_level: mon.metLevel ?? 0,
    types: mon.types || [],
    alive: (mon.currentHP ?? 0) > 0,
    in_party: true,
  };
}

function mapEvent(ev, playerId, playerName) {
  return {
    id: `${playerId}:${ev.type}:${ev.personality}:${ev.frame || Date.now()}`,
    type: ev.type,
    player_id: playerId,
    player_name: playerName,
    timestamp: Math.floor(Date.now() / 1000),
    source: 'local_browser',
    pokemon: {
      personality: ev.personality,
      species_id: ev.speciesId,
      species_name: ev.species || '',
      nickname: ev.nickname || '',
      level: ev.level || 0,
      current_hp: ev.currentHP ?? 0,
      max_hp: ev.maxHP ?? 0,
      met_location: ev.metLocation ?? 0,
      met_location_name: ev.metLocationName || '',
      met_level: ev.metLevel ?? 0,
      types: ev.types || [],
      alive: (ev.currentHP ?? 0) > 0,
      in_party: true,
    },
  };
}

export default function useRoom(syncUrl, playerName, localStatus, localSoul, localParty, enemyParty) {
  const [roomCode, setRoomCode]       = useState('');
  const [roomState, setRoomState]     = useState(null);
  const [syncConnected, setSyncConn]  = useState(false);
  const [error, setError]             = useState('');
  const [mode, setMode]               = useState('solo');
  const wsRef      = useRef(null);
  const sentIds    = useRef(new Set());
  const syncTimer  = useRef(null);
  const playerId   = getPlayerId();

  const refreshRoom = useCallback(async (code) => {
    if (!code || !syncUrl) return;
    try {
      const state = await fetchRoomState(syncUrl, code);
      setRoomState(state);
      setSyncConn(true);
    } catch {
      setSyncConn(false);
    }
  }, [syncUrl]);

  const connectWs = useCallback((code) => {
    if (wsRef.current) wsRef.current.close();
    const wsUrl = syncUrl.replace(/^http/, 'ws') + `/rooms/${code}/ws`;
    const ws = new WebSocket(wsUrl);
    ws.onopen  = () => setSyncConn(true);
    ws.onclose = () => setSyncConn(false);
    ws.onerror = () => setSyncConn(false);
    ws.onmessage = () => refreshRoom(code);
    wsRef.current = ws;
  }, [syncUrl, refreshRoom]);

  const syncOnce = useCallback(async (code) => {
    if (!code || !syncUrl || !localSoul) return;
    const detailsByPersonality = new Map((localParty || []).map(mon => [mon.personality, mon]));
    const newEvents = (localSoul.recentEvents || [])
      .map(ev => {
        const details = detailsByPersonality.get(ev.personality) || {};
        return mapEvent({ ...ev, ...details }, playerId, playerName);
      })
      .filter(ev => !sentIds.current.has(ev.id));

    try {
      await sendReconcile(syncUrl, code, {
        player_id: playerId,
        player_name: playerName,
        timestamp: Math.floor(Date.now() / 1000),
        current_party: (localSoul.currentParty || []).map(mon => ({
          ...mapSyncMon(mon),
          ...(detailsByPersonality.get(mon.personality) ? {
            nature: detailsByPersonality.get(mon.personality).nature || '',
            ivs: detailsByPersonality.get(mon.personality).IVs || {},
            evs: detailsByPersonality.get(mon.personality).EVs || {},
            held_item: detailsByPersonality.get(mon.personality).heldItem || '',
            held_item_id: detailsByPersonality.get(mon.personality).heldItemId || 0,
            hidden_power: detailsByPersonality.get(mon.personality).hiddenPower || '',
            friendship: detailsByPersonality.get(mon.personality).friendship || 0,
          } : {}),
        })),
        enemy_party: (enemyParty || []).map(mon => mapSyncMon(mon)),
        recent_events: newEvents,
      });
      newEvents.forEach(ev => sentIds.current.add(ev.id));
      await refreshRoom(code);
    } catch { /* will retry next cycle */ }
  }, [syncUrl, localSoul, localParty, enemyParty, playerId, playerName, refreshRoom]);

  const create = useCallback(async () => {
    if (!localStatus?.game?.initialized) { setError('Local game not detected.'); return; }
    if (!playerName) { setError('Enter a display name.'); return; }
    setError('');
    try {
      const { code } = await apiCreateRoom(syncUrl);
      setRoomCode(code);
      const profile = buildProfile(localStatus);
      const result = await apiJoinRoom(syncUrl, code, playerId, playerName, profile);
      if (!result.compatibility?.compatible) { setError(result.compatibility?.reason || 'Incompatible.'); return; }
      setMode('room');
      connectWs(code);
      startSync(code);
      await refreshRoom(code);
    } catch (e) { setError(e.message); }
  }, [syncUrl, playerName, playerId, localStatus, connectWs, refreshRoom]);

  const join = useCallback(async (code) => {
    if (!code) { setError('Enter a room code.'); return; }
    if (!localStatus?.game?.initialized) { setError('Local game not detected.'); return; }
    if (!playerName) { setError('Enter a display name.'); return; }
    setError('');
    const upper = code.toUpperCase();
    setRoomCode(upper);
    try {
      const profile = buildProfile(localStatus);
      const result = await apiJoinRoom(syncUrl, upper, playerId, playerName, profile);
      if (!result.compatibility?.compatible) { setError(result.compatibility?.reason || 'Incompatible.'); return; }
      setMode('room');
      connectWs(upper);
      startSync(upper);
      await refreshRoom(upper);
    } catch (e) { setError(e.message); }
  }, [syncUrl, playerName, playerId, localStatus, connectWs, refreshRoom]);

  function startSync(code) {
    if (syncTimer.current) clearInterval(syncTimer.current);
    syncTimer.current = setInterval(() => syncOnce(code), 2500);
  }

  const goSolo = useCallback(() => {
    setMode('solo');
    setRoomState(null);
    if (wsRef.current) wsRef.current.close();
    if (syncTimer.current) clearInterval(syncTimer.current);
  }, []);

  const undoDeath = useCallback(async (route) => {
    if (!roomCode) return;
    try {
      await overrideDeath(syncUrl, roomCode, route, true);
      await refreshRoom(roomCode);
    } catch (e) {
      setError(e.message);
    }
  }, [syncUrl, roomCode, refreshRoom]);

  const markDead = useCallback(async (route) => {
    if (!roomCode) return;
    try {
      await overrideDeath(syncUrl, roomCode, route, false);
      await refreshRoom(roomCode);
    } catch (e) {
      setError(e.message);
    }
  }, [syncUrl, roomCode, refreshRoom]);

  const reassign = useCallback(async (route, personality) => {
    if (!roomCode) return;
    try {
      await apiReassign(syncUrl, roomCode, playerId, route, personality);
      await refreshRoom(roomCode);
    } catch (e) {
      setError(e.message);
    }
  }, [syncUrl, roomCode, playerId, refreshRoom]);

  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (syncTimer.current) clearInterval(syncTimer.current);
    };
  }, []);

  return {
    roomCode, setRoomCode, roomState, syncConnected,
    error, mode, create, join, goSolo, undoDeath, markDead, reassign,
  };
}
