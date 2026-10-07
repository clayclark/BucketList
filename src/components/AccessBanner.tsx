import { useEffect, useState } from 'react'
import { Banner } from '../ui'

const hasExtensionApi = typeof chrome !== 'undefined' && !!chrome.permissions
const ORIGINS = hasExtensionApi ? (chrome.runtime.getManifest().host_permissions ?? []) : []

/**
 * Some Chromium browsers (Helium included) can withhold an extension's site access. Without it the
 * draft room reader never runs, so ask for it up front instead of failing silently on draft night.
 */
export function AccessBanner() {
  const [granted, setGranted] = useState(true)

  useEffect(() => {
    if (!hasExtensionApi) return
    const check = () => chrome.permissions.contains({ origins: ORIGINS }).then(setGranted)
    check()
    chrome.permissions.onAdded.addListener(check)
    chrome.permissions.onRemoved.addListener(check)
    return () => {
      chrome.permissions.onAdded.removeListener(check)
      chrome.permissions.onRemoved.removeListener(check)
    }
  }, [])

  if (granted) return null
  return (
    <Banner action="Allow" onAction={() => chrome.permissions.request({ origins: ORIGINS })}>
      Needs access to ESPN to follow your draft. Reload the draft room after.
    </Banner>
  )
}
