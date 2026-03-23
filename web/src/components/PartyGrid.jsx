import { useRef, useLayoutEffect, useCallback, useState } from 'react';
import PartyCard, { EmptySlot } from './PartyCard';

export default function PartyGrid({ trainerName, party, routeMap, trainerSprite, allTrainers, onSelectTrainer, activePlayerId, inBattle, opponentTypes }) {
  const slots = [];
  for (let i = 0; i < 6; i++) {
    slots.push(party[i] || null);
  }

  const nodeMapRef = useRef(new Map());
  const prevRectsRef = useRef(new Map());
  const prevOrderRef = useRef('');
  const [animDir, setAnimDir] = useState(null);

  const registerNode = useCallback((personality, node) => {
    if (node) {
      nodeMapRef.current.set(personality, node);
    } else {
      nodeMapRef.current.delete(personality);
    }
  }, []);

  const currentOrder = slots.map(m => m?.personality ?? 'empty').join(',');

  useLayoutEffect(() => {
    const prevRects = prevRectsRef.current;
    const nodeMap = nodeMapRef.current;
    const orderChanged = prevOrderRef.current !== '' && prevOrderRef.current !== currentOrder;

    if (orderChanged) {
      nodeMap.forEach((node, personality) => {
        const prev = prevRects.get(personality);
        if (!prev) return;

        const curr = node.getBoundingClientRect();
        const dx = prev.left - curr.left;
        const dy = prev.top - curr.top;

        if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;

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
    }

    prevOrderRef.current = currentOrder;

    const nextRects = new Map();
    nodeMap.forEach((node, personality) => {
      nextRects.set(personality, node.getBoundingClientRect());
    });
    prevRectsRef.current = nextRects;
  });

  const hasCarousel = allTrainers && allTrainers.length > 1;

  function handleSelect(playerId) {
    if (playerId === activePlayerId) return;
    const curIdx = allTrainers.findIndex(t => t.playerId === activePlayerId);
    const nextIdx = allTrainers.findIndex(t => t.playerId === playerId);
    setAnimDir(nextIdx > curIdx ? 'slide-left' : 'slide-right');
    onSelectTrainer(playerId);
    setTimeout(() => setAnimDir(null), 350);
  }

  return (
    <div className="pg glass-card pg-group">
      {hasCarousel ? (
        <div className="pg-trainer-tabs">
          {allTrainers.map(t => {
            const isActive = t.playerId === activePlayerId;
            return (
              <button
                key={t.playerId}
                className={`pg-tab ${isActive ? 'pg-tab-active' : ''}`}
                onClick={() => handleSelect(t.playerId)}
              >
                {t.spriteUrl && (
                  <img className="pg-tab-sprite" src={t.spriteUrl} alt="" />
                )}
                <div className="pg-tab-info">
                  <span className="pg-tab-name">{t.name}</span>
                  <span className="pg-tab-label">View Party</span>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="pg-banner">
          {trainerSprite && (
            <img className="pg-banner-sprite" src={trainerSprite} alt="" />
          )}
          <div className="pg-banner-info">
            <span className="pg-trainer-name">{trainerName}</span>
          </div>
        </div>
      )}
      <div className={`pg-grid ${inBattle ? 'pg-grid-battle' : ''} ${animDir ? `pg-grid-${animDir}` : ''}`}>
        {slots.map((mon, i) =>
          mon ? (
            <div
              key={mon.personality || i}
              ref={node => registerNode(mon.personality, node)}
            >
              <PartyCard
                mon={mon}
                routeName={routeMap?.[mon.personality]}
                isActiveBattler={inBattle && i === 0}
                inBattle={inBattle}
                opponentTypes={opponentTypes}
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
