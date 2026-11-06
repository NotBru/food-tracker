import { useEffect, useRef, useState } from 'react'

// The barcode button of "Search Open Food Facts" (External.jsx): the back camera in a sheet; the first EAN/UPC code
// it reads goes back to the search, which looks it up. zxing (@zxing/browser) loads only when the sheet opens, so the
// app's own bundle doesn't carry it.

const cameraError = (e) =>
  !navigator.mediaDevices?.getUserMedia ? 'This browser gives no camera here (it needs the app over https).'
    : e?.name === 'NotAllowedError' ? 'The camera isn’t allowed: allow it in the browser’s settings for this site.'
      : e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError' ? 'No camera found.'
        : `Couldn’t start the camera${e?.message ? `: ${e.message}` : '.'}`

export default function ScanSheet({ onCode, onClose }) {
  const video = useRef(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let controls
    let done = false
    ;(async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) return setError(cameraError())
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([import('@zxing/browser'), import('@zxing/library')])
        if (done) return
        const formats = [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]
        const reader = new BrowserMultiFormatReader(new Map([[DecodeHintType.POSSIBLE_FORMATS, formats]]), { delayBetweenScanAttempts: 100 })
        const camera = { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } }
        controls = await reader.decodeFromConstraints(camera, video.current, (result, _, c) => {
          if (!result || done) return
          done = true
          c.stop()
          onCode(result.getText())
        })
        if (done) controls.stop()
      } catch (e) {
        if (!done) setError(cameraError(e))
      }
    })()
    return () => { done = true; controls?.stop() }
  }, [])

  return (
    <div className="modal" onClick={onClose}>
      <div className="sheet scan-sheet" onClick={(e) => e.stopPropagation()}>
        <h2>Scan a barcode</h2>
        {error ? <p className="warn">{error}</p> : (
          <div className="scan-view">
            <video ref={video} muted playsInline aria-label="Camera" />
            <span className="scan-line" aria-hidden="true" />
          </div>
        )}
        <p className="muted small">Hold the bars across the line; it looks the code up once it reads it.</p>
        <div className="row actions">
          <button className="secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
