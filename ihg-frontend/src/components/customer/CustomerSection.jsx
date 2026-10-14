import { Link } from 'react-router-dom'

// tone: 'plain' | 'sky' | 'blush'. `action` is { to, label } (optional).
export default function CustomerSection({ title, subtitle, tone = 'plain', action, children }) {
  const toneClass = tone === 'plain' ? '' : ` cx-section--${tone}`
  return (
    <section className={`cx-section${toneClass}`}>
      <div className="cx-container">
        <div className="cx-section-head">
          <div>
            <h2 className="cx-section-title">{title}</h2>
            {subtitle && <p className="cx-section-subtitle">{subtitle}</p>}
          </div>
          {action && (
            <Link to={action.to} className="cx-section-link">
              {action.label} →
            </Link>
          )}
        </div>
        {children}
      </div>
    </section>
  )
}