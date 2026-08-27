import { useStaffAuth } from './useStaffAuth'
import { hasPermission } from '../utils/permissions'

// Standalone hook, kept separate from useStaffAuth's `can()` shortcut so
// components that only care about a single permission check don't need
// to pull in the entire auth object.
export function usePermission(code) {
  const { user } = useStaffAuth()
  return hasPermission(user, code)
}