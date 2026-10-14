// Generic image card used by rooms, menu highlights and offers.
export default function CustomerCard({ image, imageAlt = '', badge, title, subtitle, children, footer }) {
  return (
    <article className="cx-card">
      <div className="cx-card-media">
        {image ? (
          <img
            src={image}
            alt={imageAlt || title}
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
        ) : null}
        <span className="cx-card-media-fallback" aria-hidden="true">
          {(title || '?').charAt(0)}
        </span>
        {badge && <div className="cx-card-badge">{badge}</div>}
      </div>
      <div className="cx-card-body">
        <h3 className="cx-card-title">{title}</h3>
        {subtitle && <p className="cx-card-subtitle">{subtitle}</p>}
        {children}
      </div>
      {footer && <div className="cx-card-footer">{footer}</div>}
    </article>
  )
}