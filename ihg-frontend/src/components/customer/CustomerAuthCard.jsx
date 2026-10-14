import { Link } from 'react-router-dom'
import { useAppConfig } from '@/hooks/useAppConfig'
import '@/theme/customerTheme.css'

// Shared wrapper for every customer auth screen (login, register, verify,
// forgot/reset password). `notices` is an optional array of strings.
export default function CustomerAuthCard({ title, notices = [], children }) {
  const { data } = useAppConfig()
  return (
    <div className="customer-shell cx-auth-page">
      <Link to="/shop" className="cx-auth-brand">
        {data.logo_url && (
          <img
            src={data.logo_url}
            alt=""
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
        )}
        <span>{data.company_name || 'IHG Platform'}</span>
      </Link>
      <div className="cx-auth-card">
        <h1 className="cx-auth-title">{title}</h1>
        {notices.map((n) => (
          <div key={n} className="cx-notice">{n}</div>
        ))}
        {children}
      </div>
    </div>
  )
}