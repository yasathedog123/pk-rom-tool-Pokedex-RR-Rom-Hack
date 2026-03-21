import { useEffect, useState, useRef } from 'react';
import { resolveMoveData } from '../utils/moves';

export default function useMoveData(moveNames) {
  const [data, setData] = useState(new Map());
  const keyRef = useRef('');

  const key = (moveNames || []).join(',');

  useEffect(() => {
    if (key === keyRef.current) return;
    keyRef.current = key;

    const names = (moveNames || []).filter(Boolean);
    if (names.length === 0) { setData(new Map()); return; }

    let active = true;
    const results = new Map();

    Promise.all(
      names.map(name =>
        resolveMoveData(name).then(d => {
          if (active) {
            results.set(name, d);
            setData(new Map(results));
          }
        })
      )
    );

    return () => { active = false; };
  }, [key]);

  return data;
}
