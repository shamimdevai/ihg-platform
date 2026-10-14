// variant: 'full' (home, edge-to-edge) | 'banner' (inside a page container)
export default function CustomerHero({ title, subtitle, variant = 'banner', actions, children }) {
  return (
    <section className={`cx-hero cx-hero--${variant}`}>
      <div className="cx-hero-inner">
        <h1 className="cx-hero-title">{title}</h1>
        {subtitle && <p className="cx-hero-subtitle">{subtitle}</p>}
        {actions && <div className="cx-hero-actions">{actions}</div>}
        {children}
      </div>
    </section>
  )
}