const TYPES = [
  'Normal','Fire','Water','Electric','Grass','Ice',
  'Fighting','Poison','Ground','Flying','Psychic','Bug',
  'Rock','Ghost','Dragon','Dark','Steel','Fairy',
];

// Row = attacker, Col = defender. 0 = immune, 0.5 = NVE, 2 = SE. Omitted = 1.
const CHART = buildChart([
  //                        Nor  Fir  Wat  Ele  Gra  Ice  Fig  Poi  Gro  Fly  Psy  Bug  Roc  Gho  Dra  Dar  Ste  Fai
  /* Normal   */ [          1,   1,   1,   1,   1,   1,   1,   1,   1,   1,   1,   1,  .5,   0,   1,   1,  .5,   1  ],
  /* Fire     */ [          1,  .5,  .5,   1,   2,   2,   1,   1,   1,   1,   1,   2,  .5,   1,  .5,   1,   2,   1  ],
  /* Water    */ [          1,   2,  .5,   1,  .5,   1,   1,   1,   2,   1,   1,   1,   2,   1,  .5,   1,   1,   1  ],
  /* Electric */ [          1,   1,   2,  .5,  .5,   1,   1,   1,   0,   2,   1,   1,   1,   1,  .5,   1,   1,   1  ],
  /* Grass    */ [          1,  .5,   2,   1,  .5,   1,   1,  .5,   2,  .5,   1,  .5,   2,   1,  .5,   1,  .5,   1  ],
  /* Ice      */ [          1,  .5,  .5,   1,   2,  .5,   1,   1,   2,   2,   1,   1,   1,   1,   2,   1,  .5,   1  ],
  /* Fighting */ [          2,   1,   1,   1,   1,   2,   1,  .5,   1,  .5,  .5,  .5,   2,   0,   1,   2,   2,  .5  ],
  /* Poison   */ [          1,   1,   1,   1,   2,   1,   1,  .5,  .5,   1,   1,   1,  .5,  .5,   1,   1,   0,   2  ],
  /* Ground   */ [          1,   2,   1,   2,  .5,   1,   1,   2,   1,   0,   1,  .5,   2,   1,   1,   1,   2,   1  ],
  /* Flying   */ [          1,   1,   1,  .5,   2,   1,   2,   1,   1,   1,   1,   2,  .5,   1,   1,   1,  .5,   1  ],
  /* Psychic  */ [          1,   1,   1,   1,   1,   1,   2,   2,   1,   1,  .5,   1,   1,   1,   1,   0,  .5,   1  ],
  /* Bug      */ [          1,  .5,   1,   1,   2,   1,  .5,  .5,   1,  .5,   2,   1,   1,  .5,   1,   2,  .5,  .5  ],
  /* Rock     */ [          1,   2,   1,   1,   1,   2,  .5,   1,  .5,   2,   1,   2,   1,   1,   1,   1,  .5,   1  ],
  /* Ghost    */ [          0,   1,   1,   1,   1,   1,   1,   1,   1,   1,   2,   1,   1,   2,   1,  .5,   1,   1  ],
  /* Dragon   */ [          1,   1,   1,   1,   1,   1,   1,   1,   1,   1,   1,   1,   1,   1,   2,   1,  .5,   0  ],
  /* Dark     */ [          1,   1,   1,   1,   1,   1,  .5,   1,   1,   1,   2,   1,   1,   2,   1,  .5,  .5,  .5  ],
  /* Steel    */ [          1,  .5,  .5,  .5,   1,   2,   1,   1,   1,   1,   1,   1,   2,   1,   1,   1,  .5,   2  ],
  /* Fairy    */ [          1,  .5,   1,   1,   1,   1,   2,  .5,   1,   1,   1,   1,   1,   1,   2,   2,  .5,   1  ],
]);

function buildChart(rows) {
  const map = new Map();
  rows.forEach((cols, atkIdx) => {
    const inner = new Map();
    cols.forEach((mult, defIdx) => {
      inner.set(TYPES[defIdx].toLowerCase(), mult);
    });
    map.set(TYPES[atkIdx].toLowerCase(), inner);
  });
  return map;
}

function lookupMultiplier(atkType, defType) {
  const row = CHART.get(atkType);
  if (!row) return 1;
  return row.get(defType) ?? 1;
}

/**
 * @param {string} moveType - lowercase type from PokeAPI (e.g. "fire")
 * @param {string[]} defenderTypes - capitalized types from party data (e.g. ["Grass", "Steel"])
 * @returns {{ multiplier: number, label: string|null }}
 */
export function getEffectiveness(moveType, defenderTypes) {
  if (!moveType || !defenderTypes || defenderTypes.length === 0) {
    return { multiplier: 1, label: null };
  }

  const atk = moveType.toLowerCase();
  let mult = 1;
  for (const dt of defenderTypes) {
    mult *= lookupMultiplier(atk, dt.toLowerCase());
  }

  if (mult === 1) return { multiplier: 1, label: null };
  if (mult === 0) return { multiplier: 0, label: 'Immune' };
  if (mult >= 4)  return { multiplier: mult, label: 'Super Effective' };
  if (mult >= 2)  return { multiplier: mult, label: 'Effective' };
  if (mult <= 0.25) return { multiplier: mult, label: 'Not Effective' };
  if (mult < 1)   return { multiplier: mult, label: 'Not Effective' };
  return { multiplier: mult, label: null };
}
