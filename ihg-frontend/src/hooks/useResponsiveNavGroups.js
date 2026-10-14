import { useLayoutEffect, useRef, useState } from 'react'

// Gap between nav items — must match NavigationMenuList's `gap-1` (0.25rem = 4px).
const GAP_PX = 4
const MORE_BUTTON_FALLBACK_WIDTH = 88

/**
 * Measures the REAL rendered width of every top-level nav group (via a
 * visually hidden but still-laid-out mirror row) against the available
 * container width, and decides how many groups fit before a "More"
 * overflow trigger is needed — rather than guessing a fixed breakpoint
 * count, which would either waste space or overflow depending on the
 * signed-in role's actual number of visible sections (Admin sees far
 * more sections than e.g. Housekeeping).
 *
 * Re-measures on container resize (ResizeObserver) and whenever the
 * `groups` array itself changes (role/module changes after login).
 */
export function useResponsiveNavGroups(groups) {
  const containerRef = useRef(null)
  const moreRef = useRef(null)
  const measureRefs = useRef([])
  const [visibleCount, setVisibleCount] = useState(groups.length)

  measureRefs.current = []
  const setMeasureRef = (index) => (el) => {
    measureRefs.current[index] = el
  }

  const recalculate = () => {
    const container = containerRef.current
    if (!container) return
    const containerWidth = container.offsetWidth
    const widths = measureRefs.current.map((el) => (el ? el.offsetWidth : 0))
    const moreWidth = moreRef.current ? moreRef.current.offsetWidth : MORE_BUTTON_FALLBACK_WIDTH

    const totalWidth = widths.reduce((sum, w) => sum + w + GAP_PX, 0)
    if (totalWidth <= containerWidth) {
      setVisibleCount(groups.length)
      return
    }

    let used = moreWidth + GAP_PX
    let count = 0
    for (let i = 0; i < widths.length; i++) {
      used += widths[i] + GAP_PX
      if (used > containerWidth) break
      count++
    }
    setVisibleCount(count)
  }

  useLayoutEffect(() => {
    recalculate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups])

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    let frame = null
    const scheduleRecalc = () => {
      if (frame) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(recalculate)
    }

    let observer = null
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(scheduleRecalc)
      observer.observe(container)
    }
    // Redundant fallback alongside ResizeObserver — cheap insurance
    // against any environment where the observer fires late relative to
    // an in-progress window resize.
    window.addEventListener('resize', scheduleRecalc)

    return () => {
      if (frame) cancelAnimationFrame(frame)
      observer?.disconnect()
      window.removeEventListener('resize', scheduleRecalc)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups])

  return {
    containerRef,
    moreRef,
    setMeasureRef,
    visibleGroups: groups.slice(0, visibleCount),
    overflowGroups: groups.slice(visibleCount),
  }
}