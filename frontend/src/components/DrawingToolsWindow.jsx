import useCadStore from '../store/cadStore'
import './DrawingToolsWindow.css'

function DrawingToolsWindow() {
  const activeTool = useCadStore((state) => state.activeTool)
  const setActiveTool = useCadStore((state) => state.setActiveTool)

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
          >
            {tool.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default DrawingToolsWindow
