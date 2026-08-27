import { cn } from '@/lib/utils'
import LoadingState from '@/components/ui/LoadingState'
import EmptyState from '@/components/ui/EmptyState'
import ErrorState from '@/components/ui/ErrorState'

/**
 * columns: [{ key, header, render?(row) }]
 * data: array of row objects
 * Generic — no domain knowledge. Handles loading/empty/error states
 * itself so every list screen doesn't reimplement the same three checks.
 */
export default function Table({
  columns,
  data,
  loading,
  error,
  onRetry,
  emptyTitle = 'No records found',
  rowKey = 'id',
  className,
}) {
  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={onRetry} />
  if (!data || data.length === 0) return <EmptyState title={emptyTitle} />

  return (
    <div className={cn('overflow-x-auto rounded-md border', className)}>
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className="text-left font-medium text-muted-foreground px-4 py-2">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row[rowKey]} className="border-t hover:bg-muted/50">
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-2 align-middle">
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}