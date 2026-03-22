import { TYPE_COLORS } from '../utils/types';

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

function splitMoveName(name) {
  if (!name) return '';
  return name.replace(/([a-z])([A-Z])/g, '$1 $2')
             .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
}

const CLS_LABEL = { physical: 'Phys', special: 'Spec', status: 'Status' };

function EffBadge({ eff, damageClass }) {
  if (damageClass === 'status') return null;
  if (!eff || !eff.label) return null;
  const cls = eff.multiplier > 1 ? 'mc-eff-se'
            : eff.multiplier === 0 ? 'mc-eff-immune'
            : 'mc-eff-nve';
  return <span className={`mc-eff ${cls}`}>{eff.label}</span>;
}

export default function MoveCard({ name, data, effectiveness, compact }) {
  const displayName = splitMoveName(name);

  if (!name) return <div className={`mc mc-empty ${compact ? 'mc-compact' : ''}`} />;

  if (data === undefined) {
    return (
      <div className={`mc mc-loading ${compact ? 'mc-compact' : ''}`}>
        <div className="mc-top">
          <span className="mc-type-placeholder" />
          <span className="mc-name">{displayName}</span>
        </div>
        {!compact && (
          <div className="mc-bottom">
            <span className="mc-stat">&hellip;</span>
          </div>
        )}
      </div>
    );
  }

  if (data === null) {
    return (
      <div className={`mc mc-custom ${compact ? 'mc-compact' : ''}`}>
        <div className="mc-top">
          <span className="mc-name">{displayName}</span>
          <EffBadge eff={effectiveness} />
        </div>
        {!compact && (
          <div className="mc-bottom">
            <span className="mc-stat mc-stat-muted">Custom move</span>
          </div>
        )}
      </div>
    );
  }

  const typeName = capitalize(data.type);
  const typeColor = TYPE_COLORS[typeName] || '#666';
  const powerLabel = data.power != null ? data.power : '--';
  const accLabel = data.accuracy != null ? data.accuracy : '--';
  const clsLabel = CLS_LABEL[data.damageClass] || '';
  const isStatus = data.damageClass === 'status';

  if (compact) {
    return (
      <div
        className="mc mc-compact"
        style={{ borderLeftColor: typeColor, background: `linear-gradient(90deg, ${typeColor}22, transparent 60%)` }}
        title={data.description || displayName}
      >
        <div className="mc-top">
          <span className="mc-type" style={{ background: typeColor }}>{typeName}</span>
          <span className="mc-name">{displayName}</span>
          {clsLabel && <span className={`mc-cls mc-cls-${data.damageClass}`}>{clsLabel}</span>}
          <EffBadge eff={effectiveness} damageClass={data.damageClass} />
        </div>
      </div>
    );
  }

  return (
    <div
      className="mc"
      style={{ borderLeftColor: typeColor, background: `linear-gradient(90deg, ${typeColor}22, transparent 60%)` }}
      title={data.description || displayName}
    >
      <div className="mc-top">
        <span className="mc-type" style={{ background: typeColor }}>{typeName}</span>
        <span className="mc-name">{displayName}</span>
        <EffBadge eff={effectiveness} damageClass={data.damageClass} />
      </div>
      <div className="mc-bottom">
        {!isStatus && <span className="mc-stat"><b>PWR</b> <span className="mc-val">{powerLabel}</span></span>}
        <span className="mc-stat"><b>ACC</b> <span className="mc-val">{accLabel}</span></span>
        {clsLabel && <span className={`mc-cls mc-cls-${data.damageClass}`}>{clsLabel}</span>}
      </div>
    </div>
  );
}
