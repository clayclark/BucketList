import { useEffect, useState } from 'react'

/** The current time, refreshed every `ms`. Keeps Date.now() out of render. */
export function useNow(ms: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(tick)
  }, [ms])
  return now
}
