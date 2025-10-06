import useCadStore from '../store/cadStore'
import './DrawingToolsWindow.css'

function DrawingToolsWindow() {
  const activeTool = useCadStore((state) => state.activeTool)
  const setActiveTool = useCadStore((state) => state.setActiveTool)

  const toolIcons = {
    select: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
      </svg>
    ),
    line: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="5" y1="19" x2="19" y2="5" />
      </svg>
    ),
    circle: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="8" />
      </svg>
    ),
    rectangle: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="5" y="7" width="14" height="10" rx="1" />
      </svg>
    ),
    polygon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2L19 8L16 17L8 17L5 8L12 2Z" />
      </svg>
    ),
    arc: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2 A10 10 0 0 1 22 12" />
        <line x1="12" y1="2" x2="12" y2="12" />
        <line x1="12" y1="12" x2="22" y2="12" />
      </svg>
    ),
    freehand: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 12 Q6 5, 9 12 T15 12 Q18 17, 21 12" strokeLinecap="round" />
      </svg>
    )
  }

  const tools = [
    { id: 'select', label: 'Select' },
    { id: 'line', label: 'Line' },
    { id: 'circle', label: 'Circle' },
    { id: 'rectangle', label: 'Rectangle' },
    { id: 'polygon', label: 'Polygon' },
    { id: 'arc', label: 'Arc' },
    { id: 'freehand', label: 'Freehand' }
  ]

  return (
    <div className="drawing-tools-window">
      <div className="tools-grid">
        {tools.map((tool) => (
          <button
            key={tool.id}
            className={`tool-btn ${activeTool === tool.id ? 'active' : ''}`}
            onClick={() => setActiveTool(tool.id)}
            title={tool.label}
          >
            <div className="tool-icon">{toolIcons[tool.id]}</div>
            <span className="tool-label">{tool.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default DrawingToolsWindow
