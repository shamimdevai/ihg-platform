import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Standard shadcn/ui helper — merges conditional class names (clsx) and
// resolves Tailwind class conflicts (twMerge), e.g. cn('p-2', isBig && 'p-4')
// correctly keeps only 'p-4' rather than emitting both.
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}