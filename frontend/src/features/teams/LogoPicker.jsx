import { useRef } from 'react'

/** Roughly 190KB of image once base64 has added its third. */
const LOGO_MAX_BYTES = 256 * 1024

/**
 * "Add a logo" / "Remove", reading the chosen file straight into a data URL.
 *
 * No upload endpoint and no storage configuration: the image travels with the
 * team as text. Checked against the same ceiling the server enforces, so an
 * oversized file is refused here rather than after a round trip.
 */
export function LogoPicker({ logo, onChange, onError }) {
  const fileInput = useRef(null)

  function onPick(event) {
    const file = event.target.files?.[0]
    if (!file) return

    onError(null)

    // The base64 encoding adds about a third, so the file itself has to be
    // comfortably under the stored ceiling.
    if (file.size > LOGO_MAX_BYTES * 0.74) {
      onError('That image is too large — pick one under about 190KB.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => onChange(String(reader.result))
    reader.onerror = () => onError('That file could not be read.')
    reader.readAsDataURL(file)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => fileInput.current?.click()}
        className="text-base-content/60 hover:bg-base-content/8 hover:text-base-content rounded-lg px-2 py-1 text-xs font-medium transition-colors duration-150"
      >
        {logo ? 'Change logo' : 'Add a logo'}
      </button>

      {logo && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="text-base-content/50 hover:text-error rounded-lg px-2 py-1 text-xs font-medium transition-colors duration-150"
        >
          Remove
        </button>
      )}

      <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={onPick} />
    </div>
  )
}
