import useCadStore from '../store/cadStore'
import './SnapToolsWindow.css'

function SnapToolsWindow() {
  const snap = useCadStore((state) => state.snap)
  const updateSnap = useCadStore((state) => state.updateSnap)

  return (
    <div className="snap-tools-window">
      <div className="snap-option">
        <label>
          <input
            type="checkbox"
            checked={snap.grid}
            onChange={(e) => updateSnap('grid', e.target.checked)}
          />
          <span>Grid Snap</span>
        </label>
      </div>
      <div className="snap-option">
        <label>
          <input
            type="checkbox"
            checked={snap.endpoint}
            onChange={(e) => updateSnap('endpoint', e.target.checked)}
          />
          <span>Endpoint Snap</span>
        </label>
      </div>
      <div className="snap-option">
        <label>
          <input
            type="checkbox"
            checked={snap.midpoint}
            onChange={(e) => updateSnap('midpoint', e.target.checked)}
          />
          <span>Midpoint Snap</span>
        </label>
      </div>
      <div className="snap-option">
        <label>
          <input
            type="checkbox"
            checked={snap.center}
            onChange={(e) => updateSnap('center', e.target.checked)}
          />
          <span>Center Snap</span>
        </label>
      </div>
    </div>
  )
}

export default SnapToolsWindow
