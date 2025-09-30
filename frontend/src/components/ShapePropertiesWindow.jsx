import { useState, useEffect } from 'react'
import useCadStore from '../store/cadStore'
import './ShapePropertiesWindow.css'

function ShapePropertiesWindow() {
  const shapes = useCadStore((state) => state.shapes)
  const updateShape = useCadStore((state) => state.updateShape)
  const shapePropertiesState = useCadStore((state) => state.shapePropertiesState)
  const setShapePropertiesState = useCadStore((state) => state.setShapePropertiesState)
  const setActiveTool = useCadStore((state) => state.setActiveTool)
  
  const [lineColor, setLineColor] = useState('#000000')
  const [fillColor, setFillColor] = useState('')
  const [noFill, setNoFill] = useState(true)
  const [lineWidth, setLineWidth] = useState(1)
  
  const [originalProperties, setOriginalProperties] = useState(null)
  
  const selectedShapeId = shapePropertiesState?.selectedShapeId
  const selectedShape = selectedShapeId ? shapes.find(s => s.id === selectedShapeId) : null
  const isSelectMode = shapePropertiesState?.selectMode
  
  useEffect(() => {
    if (selectedShape) {
      setLineColor(selectedShape.stroke || '#000000')
      setLineWidth(selectedShape.strokeWidth || 1)
      
      const hasFill = selectedShape.fill && selectedShape.fill !== 'transparent'
      setNoFill(!hasFill)
      setFillColor(hasFill ? selectedShape.fill : '#ffffff')
      
      setOriginalProperties({
        stroke: selectedShape.stroke || '#000000',
        strokeWidth: selectedShape.strokeWidth || 1,
        fill: selectedShape.fill || 'transparent'
      })
      
      updateShape(selectedShapeId, {
        stroke: '#00ff00',
        strokeWidth: (selectedShape.originalStrokeWidth || selectedShape.strokeWidth || 1) + 1,
        originalStroke: selectedShape.originalStroke || selectedShape.stroke,
        originalStrokeWidth: selectedShape.originalStrokeWidth || selectedShape.strokeWidth
      })
    }
  }, [selectedShapeId])
  
  const startSelectMode = () => {
    setActiveTool(null)
    clearSelection()
    setShapePropertiesState({
      selectMode: true,
      selectedShapeId: null
    })
  }
  
  const clearSelection = () => {
    if (selectedShapeId && selectedShape) {
      if (selectedShape.originalStroke) {
        updateShape(selectedShapeId, {
          stroke: selectedShape.originalStroke,
          strokeWidth: selectedShape.originalStrokeWidth,
          originalStroke: undefined,
          originalStrokeWidth: undefined
        })
      }
    }
    setShapePropertiesState({
      selectMode: false,
      selectedShapeId: null
    })
    setOriginalProperties(null)
  }
  
  const handleApply = () => {
    if (!selectedShape) {
      alert('Please select a shape first')
      return
    }
    
    const updates = {
      stroke: lineColor,
      strokeWidth: lineWidth,
      originalStroke: undefined,
      originalStrokeWidth: undefined
    }
    
    if (selectedShape.type !== 'line') {
      updates.fill = noFill ? 'transparent' : fillColor
    }
    
    updateShape(selectedShapeId, updates)
    
    setShapePropertiesState({
      selectMode: false,
      selectedShapeId: null
    })
    setOriginalProperties(null)
  }
  
  const handleReset = () => {
    if (!originalProperties || !selectedShape) return
    
    setLineColor(originalProperties.stroke)
    setLineWidth(originalProperties.strokeWidth)
    
    const hasFill = originalProperties.fill && originalProperties.fill !== 'transparent'
    setNoFill(!hasFill)
    setFillColor(hasFill ? originalProperties.fill : '#ffffff')
    
    updateShape(selectedShapeId, {
      stroke: '#00ff00',
      strokeWidth: (selectedShape.originalStrokeWidth || selectedShape.strokeWidth || 1) + 1,
      originalStroke: selectedShape.originalStroke || originalProperties.stroke,
      originalStrokeWidth: selectedShape.originalStrokeWidth || originalProperties.strokeWidth
    })
  }
  
  const canApplyToFill = selectedShape && selectedShape.type !== 'line'
  
  return (
    <div className="shape-properties-window">
      <div className="shape-properties-header">
        <h3>Shape Properties</h3>
      </div>
      
      <div className="shape-properties-content">
        <button
          className={`shape-props-button ${isSelectMode ? 'active' : ''}`}
          onClick={startSelectMode}
        >
          Select Shape
        </button>
        
        {selectedShape && (
          <div className="selected-shape-info">
            Selected: {selectedShape.type} ({selectedShape.id.substring(0, 12)}...)
          </div>
        )}
        
        <div className="property-group">
          <label>Line Color:</label>
          <div className="color-input-group">
            <div 
              className="color-preview" 
              style={{ backgroundColor: lineColor }}
            />
            <input
              type="color"
              value={lineColor}
              onChange={(e) => setLineColor(e.target.value)}
              disabled={!selectedShape}
            />
          </div>
        </div>
        
        {canApplyToFill && (
          <div className="property-group">
            <label>Fill Color:</label>
            <div className="color-input-group">
              <div 
                className="color-preview" 
                style={{ backgroundColor: noFill ? '#ffffff' : fillColor }}
              />
              <input
                type="color"
                value={fillColor}
                onChange={(e) => setFillColor(e.target.value)}
                disabled={!selectedShape || noFill}
              />
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={noFill}
                  onChange={(e) => setNoFill(e.target.checked)}
                  disabled={!selectedShape}
                />
                No Fill
              </label>
            </div>
          </div>
        )}
        
        <div className="property-group">
          <label>Line Width:</label>
          <input
            type="number"
            min="1"
            max="20"
            value={lineWidth}
            onChange={(e) => setLineWidth(Number(e.target.value))}
            disabled={!selectedShape}
            className="number-input"
          />
          <span className="unit-label">px</span>
        </div>
        
        <div className="button-group">
          <button
            className="shape-props-button apply-button"
            onClick={handleApply}
            disabled={!selectedShape}
          >
            Apply
          </button>
          <button
            className="shape-props-button reset-button"
            onClick={handleReset}
            disabled={!selectedShape || !originalProperties}
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  )
}

export default ShapePropertiesWindow
