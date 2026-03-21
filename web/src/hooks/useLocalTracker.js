import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchLocalStatus, fetchLocalSoulLink, fetchLocalParty, fetchLocalTrainer, fetchLocalEnemy } from '../utils/api';

export default function useLocalTracker(localUrl) {
  const [connected, setConnected] = useState(false);
  const [status, setStatus]       = useState(null);
  const [soulLink, setSoulLink]   = useState(null);
  const [party, setParty]         = useState([]);
  const [trainerInfo, setTrainerInfo] = useState(null);
  const [enemyParty, setEnemyParty] = useState([]);
  const intervalRef = useRef(null);
  const detailRef = useRef(null);
  const enemyRef = useRef(null);
  const inBattleRef = useRef(false);

  const poll = useCallback(async () => {
    if (!localUrl) return;
    try {
      const [s, sl] = await Promise.all([
        fetchLocalStatus(localUrl),
        fetchLocalSoulLink(localUrl),
      ]);
      setStatus(s);
      setSoulLink(sl);
      setConnected(true);
    } catch {
      setConnected(false);
    }
  }, [localUrl]);

  const pollEnemy = useCallback(async () => {
    if (!localUrl) return;
    try {
      const ep = await fetchLocalEnemy(localUrl);
      const arr = Array.isArray(ep) ? ep : [];
      setEnemyParty(arr);

      const nowInBattle = arr.length > 0;
      if (nowInBattle !== inBattleRef.current) {
        inBattleRef.current = nowInBattle;
        clearInterval(detailRef.current);
        detailRef.current = setInterval(pollDetailsRef.current, nowInBattle ? 1000 : 5000);
        pollDetailsRef.current();
      }
    } catch { /* keep previous */ }
  }, [localUrl]);

  const pollDetails = useCallback(async () => {
    if (!localUrl) return;
    try {
      const [p, t] = await Promise.all([
        fetchLocalParty(localUrl),
        fetchLocalTrainer(localUrl).catch(() => null),
      ]);
      setParty(Array.isArray(p) ? p : []);
      if (t) setTrainerInfo(t);
    } catch {
      /* keep previous details */
    }
  }, [localUrl]);

  const pollDetailsRef = useRef(pollDetails);
  pollDetailsRef.current = pollDetails;

  useEffect(() => {
    poll();
    pollDetails();
    pollEnemy();
    intervalRef.current = setInterval(poll, 1500);
    detailRef.current = setInterval(pollDetails, 5000);
    enemyRef.current = setInterval(pollEnemy, 500);
    return () => {
      clearInterval(intervalRef.current);
      clearInterval(detailRef.current);
      clearInterval(enemyRef.current);
    };
  }, [poll, pollDetails, pollEnemy]);

  return { connected, status, soulLink, party, trainerInfo, enemyParty, refresh: poll };
}
