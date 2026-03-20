import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchLocalStatus, fetchLocalSoulLink, fetchLocalParty } from '../utils/api';

export default function useLocalTracker(localUrl) {
  const [connected, setConnected] = useState(false);
  const [status, setStatus]       = useState(null);
  const [soulLink, setSoulLink]   = useState(null);
  const [party, setParty]         = useState([]);
  const intervalRef = useRef(null);
  const detailRef = useRef(null);

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

  const pollDetails = useCallback(async () => {
    if (!localUrl) return;
    try {
      const p = await fetchLocalParty(localUrl);
      setParty(Array.isArray(p) ? p : []);
    } catch {
      /* keep previous details */
    }
  }, [localUrl]);

  useEffect(() => {
    poll();
    pollDetails();
    intervalRef.current = setInterval(poll, 1500);
    detailRef.current = setInterval(pollDetails, 5000);
    return () => {
      clearInterval(intervalRef.current);
      clearInterval(detailRef.current);
    };
  }, [poll, pollDetails]);

  return { connected, status, soulLink, party, refresh: poll };
}
