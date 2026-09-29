import { useState } from 'react'

import { Check, Share2 } from '@/components/icons'

// Copies a URL to the clipboard and confirms for 2 seconds. Shared UI primitive.
// Label hides below `sm` to avoid wrapping in tight phone headers.
export function CopyLinkButton({ url, label = 'Share', title, className = '' }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access denied; URL is still in the address bar.
    }
  }

  return (
    <button
      className={`glass-raised hover:border-base-content/30 hover:bg-base-content/5 flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition-all duration-200 ease-out active:scale-[0.98] sm:px-4 ${className}`}
      onClick={copy}
      title={title}
      aria-label={copied ? 'Link copied' : label}
    >
      {copied ? <Check className="h-4 w-4 shrink-0" /> : <Share2 className="h-4 w-4 shrink-0" />}
      <span className="hidden sm:inline">{copied ? 'Link copied' : label}</span>
    </button>
  )
}
