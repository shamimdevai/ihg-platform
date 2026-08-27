/**
 * Generic placeholder for routes reserved ahead of their dedicated build
 * phase. Portal-agnostic — used by both staffRoutes.jsx and
 * customerRoutes.jsx. One shared component, not one file per domain/
 * portal (see Phase 5 decision notes; relocated here at Phase 6 when
 * the customer portal needed the identical placeholder).
 */
export default function RouteComingSoon({ title }) {
  return (
    <div className="text-center py-16 text-muted-foreground">
      <h2 className="text-lg font-medium text-foreground mb-2">{title}</h2>
      <p className="text-sm">
        This screen hasn't been built yet — it's reserved for an upcoming
        phase.
      </p>
    </div>
  )
}