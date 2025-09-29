import './Toolbar.css'

function Toolbar({ 
  activeTool, 
  onToolChange, 
  onAddRectangle, 
  onAddCircle, 
  onAddLine, 
  onDelete,
  onZoomIn,
  onZoomOut,
  zoom
}) {
  return (
    <div className="toolbar">
      <div className="tool-section">
        <h3>Tools</h3>
        <button 
          className={activeTool === 'select' ? 'active' : ''}
          onClick={() => onToolChange('select')}
          title="Select Tool"
        >
          ↖
        </button>
        <button 
          className={activeTool === 'draw' ? 'active' : ''}
          onClick={() => onToolChange('draw')}
          title="Free Draw"
        >
          ✏
        </button>
      </div>

      <div className="tool-section">
        <h3>Shapes</h3>
        <button onClick={onAddLine} title="Add Line">━</button>
        <button onClick={onAddRectangle} title="Add Rectangle">▭</button>
        <button onClick={onAddCircle} title="Add Circle">○</button>
      </div>

      <div className="tool-section">
        <h3>Actions</h3>
        <button onClick={onDelete} title="Delete Selected">🗑</button>
      </div>

      <div className="tool-section">
        <h3>View</h3>
        <button onClick={onZoomIn} title="Zoom In">+</button>
        <button onClick={onZoomOut} title="Zoom Out">-</button>
        <div className="zoom-display">{Math.round(zoom * 100)}%</div>
      </div>
    </div>
  )
}

export default Toolbar