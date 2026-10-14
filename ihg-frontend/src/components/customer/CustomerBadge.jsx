// tone: 'gold' | 'teal' | 'red' | 'navy' — styling lives in customerTheme.css
export default function CustomerBadge({ tone = 'navy', children }) {
  return <span className={`cx-badge cx-badge--${tone}`}>{children}</span>
}