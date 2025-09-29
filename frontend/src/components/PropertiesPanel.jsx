import { useState, useEffect } from 'react'
import './PropertiesPanel.css'

function PropertiesPanel({ canvas, selectedObjects }) {
  const [properties, setProperties] = useState({})

  useEffect(() => {
    if (selectedObjects.length === 1) {
      const obj = selectedObjects[0]
      setProperties({
        left: Math.round(obj.left) || 0,
        top: Math.round(obj.top) || 0,
        width: Math.round(obj.getScaledWidth()) || 0,
        height: Math.round(obj.getScaledHeight()) || 0,
        scaleX: obj.scaleX || 1,
        scaleY: obj.scaleY || 1,
        angle: Math.round(obj.angle) || 0,
        fill: obj.fill || 'transparent',
        stroke: obj.stroke || '#ffffff',
        strokeWidth: obj.strokeWidth || 1,
        opacity: obj.opacity || 1
      })
    } else {
      setProperties({})
    }
  }, [selectedObjects])

  const updateProperty = (key, value) => {
    if (selectedObjects.length !== 1) return

    const obj = selectedObjects[0]
    obj.set(key, value)
    canvas.renderAll()
    
    setProperties(prev => ({ ...prev, [key]: value }))
  }

  if (selectedObjects.length === 0) {
    return (
      <div className="properties-panel">
        <h3>Properties</h3>
        <p className="no-selection">No object selected</p>
      </div>
    )
  }

  if (selectedObjects.length > 1) {
    return (
      <div className="properties-panel">
        <h3>Properties</h3>
        <p className="multi-selection">{selectedObjects.length} objects selected</p>
      </div>
    )
  }

  return (
    <div className="properties-panel">
      <h3>Properties</h3>
      
      <div className="property-group">
        <h4>Position</h4>
        <div className="property-row">
          <label>X:</label>
          <input
            type="number"
            value={properties.left}
            onChange={(e) => updateProperty('left', Number(e.target.value))}
          />
        </div>
        <div className="property-row">
          <label>Y:</label>
          <input
            type="number"
            value={properties.top}
            onChange={(e) => updateProperty('top', Number(e.target.value))}
          />
        </div>
      </div>

      <div className="property-group">
        <h4>Size</h4>
        <div className="property-row">
          <label>Width:</label>
          <input
            type="number"
            value={properties.width}
            onChange={(e) => {
              const newWidth = Number(e.target.value)
              const obj = selectedObjects[0]
              obj.set('scaleX', newWidth / obj.width)
              canvas.renderAll()
            }}
          />
        </div>
        <div className="property-row">
          <label>Height:</label>
          <input
            type="number"
            value={properties.height}
            onChange={(e) => {
              const newHeight = Number(e.target.value)
              const obj = selectedObjects[0]
              obj.set('scaleY', newHeight / obj.height)
              canvas.renderAll()
            }}
          />
        </div>
      </div>

      <div className="property-group">
        <h4>Transform</h4>
        <div className="property-row">
          <label>Rotation:</label>
          <input
            type="number"
            value={properties.angle}
            onChange={(e) => updateProperty('angle', Number(e.target.value))}
          />
        </div>
        <div className="property-row">
          <label>Opacity:</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={properties.opacity}
            onChange={(e) => updateProperty('opacity', Number(e.target.value))}
          />
          <span>{Math.round(properties.opacity * 100)}%</span>
        </div>
      </div>

      <div className="property-group">
        <h4>Appearance</h4>
        <div className="property-row">
          <label>Fill:</label>
          <input
            type="color"
            value={properties.fill === 'transparent' ? '#000000' : properties.fill}
            onChange={(e) => updateProperty('fill', e.target.value)}
          />
          <button 
            onClick={() => updateProperty('fill', 'transparent')}
            className={properties.fill === 'transparent' ? 'active' : ''}
          >
            None
          </button>
        </div>
        <div className="property-row">
          <label>Stroke:</label>
          <input
            type="color"
            value={properties.stroke}
            onChange={(e) => updateProperty('stroke', e.target.value)}
          />
        </div>
        <div className="property-row">
          <label>Stroke Width:</label>
          <input
            type="number"
            min="0"
            value={properties.strokeWidth}
            onChange={(e) => updateProperty('strokeWidth', Number(e.target.value))}
          />
        </div>
      </div>
    </div>
  )
}

export default PropertiesPanel