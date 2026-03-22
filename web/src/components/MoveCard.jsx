import { TYPE_COLORS } from '../utils/types';

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

const CLS_LABEL = { physical: 'Phys', special: 'Spec', status: 'Status' };

export default function MoveCard({ name, data }) {
  if (!name) return <div className="mc mc-empty" />;

  if (data === undefined) {
    return (
      <div className="mc mc-loading">
        <div className="mc-top">
          <span className="mc-type-placeholder" />
          <span className="mc-name">{name}</span>
        </div>
        <div className="mc-bottom">
          <span className="mc-stat">&hellip;</span>
        </div>
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="mc mc-custom">
        <div className="mc-top">
          <span className="mc-name">{name}</span>
        </div>
        <div className="mc-bottom">
          <span className="mc-stat mc-stat-muted">Custom move</span>
        </div>
      </div>
    );
  }

  const typeName = capitalize(data.type);
  const typeColor = TYPE_COLORS[typeName] || '#666';
  const powerLabel = data.power != null ? data.power : '--';
  const accLabel = data.accuracy != null ? data.accuracy : '--';
  const clsLabel = CLS_LABEL[data.damageClass] || '';

  return (
    <div
      className="mc"
      style={{ borderLeftColor: typeColor, background: `linear-gradient(90deg, ${typeColor}18, transparent 60%)` }}
      title={data.description || name}
    >
      <div className="mc-top">
        <span className="mc-type" style={{ background: typeColor }}>{typeName}</span>
        <span className="mc-name">{name}</span>
      </div>
      <div className="mc-bottom">
        <span className="mc-stat"><b>PWR</b> {powerLabel}</span>
        <span className="mc-stat"><b>ACC</b> {accLabel}</span>
        {clsLabel && <span className={`mc-cls mc-cls-${data.damageClass}`}>{clsLabel}</span>}
      </div>
    </div>
  );
}
