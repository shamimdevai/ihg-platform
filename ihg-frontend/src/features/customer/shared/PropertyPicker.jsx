import { Link } from 'react-router-dom'
import CustomerCard from '@/components/customer/CustomerCard'

// Card grid for choosing a hotel or restaurant when there is more than one.
// `buildLink(property)` returns the URL to open for that property.
export default function PropertyPicker({ kind, properties, buildLink, heading }) {
  const cta = kind === 'hotel' ? 'View rooms' : 'View menu'
  return (
    <div>
      {heading && (
        <h2 className="cx-section-title" style={{ marginBottom: '1rem' }}>
          {heading}
        </h2>
      )}
      <div className="cx-grid">
        {properties.map((p) => (
          <CustomerCard
            key={p.id}
            image={p.image_url}
            title={p.name}
            subtitle={p.address}
            footer={
              <>
                <span className="cx-muted" style={{ fontSize: '0.8rem' }}>
                  {p.phone || ''}
                </span>
                <Link to={buildLink(p)} className="cx-btn cx-btn-primary">
                  {cta}
                </Link>
              </>
            }
          />
        ))}
      </div>
    </div>
  )
}