import { useRef, useLayoutEffect, useCallback } from 'react';
import PartyCard, { EmptySlot } from './PartyCard';

function formatMoney(n) {
  return n != null ? `$${Number(n).toLocaleString()}` : null;
}

export default function PartyGrid({ trainerName, party, routeMap, trainerSprite, money, coins }) {
  const slots = [];
  for (let i = 0; i < 6; i++) {
    slots.push(party[i] || null);
  }

  const nodeMapRef = useRef(new Map());
  const prevRectsRef = useRef(new Map());

  const registerNode = useCallback((personality, node) => {
    if (node) {
      nodeMapRef.current.set(personality, node);
    } else {
      nodeMapRef.current.delete(personality);
    }
  }, []);

  useLayoutEffect(() => {
    const prevRects = prevRectsRef.current;
    const nodeMap = nodeMapRef.current;

    nodeMap.forEach((node, personality) => {
      const prev = prevRects.get(personality);
      if (!prev) return;

      const curr = node.getBoundingClientRect();
      const dx = prev.left - curr.left;
      const dy = prev.top - curr.top;

      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;

      node.classList.remove('pc-flip-animate');
      node.style.transform = `translate(${dx}px, ${dy}px)`;

      requestAnimationFrame(() => {
        node.classList.add('pc-flip-animate');
        node.style.transform = '';

        const onEnd = () => {
          node.classList.remove('pc-flip-animate');
          node.removeEventListener('transitionend', onEnd);
        };
        node.addEventListener('transitionend', onEnd);
      });
    });

    const nextRects = new Map();
    nodeMap.forEach((node, personality) => {
      nextRects.set(personality, node.getBoundingClientRect());
    });
    prevRectsRef.current = nextRects;
  });

  return (
    <div className="pg">
      <div className="pg-banner glass-card">
        {trainerSprite && (
          <img className="pg-banner-sprite" src={trainerSprite} alt="" />
        )}
        <div className="pg-banner-info">
          <span className="pg-trainer-name">{trainerName}</span>
          {money != null && <span className="pg-money">{formatMoney(money)}</span>}
          {coins != null && coins > 0 && <span className="pg-coins">{Number(coins).toLocaleString()} coins</span>}
        </div>
      </div>
      <div className="pg-grid">
        {slots.map((mon, i) =>
          mon ? (
            <div
              key={mon.personality || i}
              ref={node => registerNode(mon.personality, node)}
            >
              <PartyCard
                mon={mon}
                routeName={routeMap?.[mon.personality]}
              />
            </div>
          ) : (
            <EmptySlot key={`empty-${i}`} />
          )
        )}
      </div>
    </div>
  );
}
