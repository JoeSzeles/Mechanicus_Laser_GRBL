import { useState } from 'react'
import useCadStore from '../store/cadStore'
import {
  findLineIntersection,
  createFilletArc,
  createChamfer,
  getShapeCenter,
  rotateShape,
  findClosestEndpoint,
  calculateDistance
} from '../utils/lineEditorUtils'
import './LineEditorToolsWindow.css'

function LineEditorToolsWindow() {
  const shapes = useCadStore((state) => state.shapes)
  const addShape = useCadStore((state) => state.addShape)
  const updateShape = useCadStore((state) => state.updateShape)
  const removeShape = useCadStore((state) => state.removeShape)
  const lineEditorState = useCadStore((state) => state.lineEditorState)
  const setLineEditorState = useCadStore((state) => state.setLineEditorState)
  const viewport = useCadStore((state) => state.viewport)
  
  const [size, setSize] = useState(10)
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [angleSnapEnabled, setAngleSnapEnabled] = useState(true)
  const [rotationAngle, setRotationAngle] = useState(0)
  
  const selectedLines = lineEditorState?.selectedLines || []
  const selectedShapes = selectedLines.map(id => shapes.find(s => s.id === id)).filter(Boolean)
  
  const clearSelection = () => {
    if (lineEditorState) {
      selectedLines.forEach(id => {
        const shape = shapes.find(s => s.id === id)
        if (shape && shape.originalStroke) {
          updateShape(id, {
            stroke: shape.originalStroke,
            strokeWidth: shape.originalStrokeWidth
          })
        }
      })
    }
    setLineEditorState({
      selectedLines: [],
      currentTool: null
    })
  }
  
  const selectLine = (lineId) => {
    const shape = shapes.find(s => s.id === lineId)
    if (!shape) return
    
    if (!lineEditorState || !lineEditorState.selectedLines.includes(lineId)) {
      const newSelection = [...(lineEditorState?.selectedLines || []), lineId]
      
      if (!shape.originalStroke) {
        updateShape(lineId, {
          originalStroke: shape.stroke,
          originalStrokeWidth: shape.strokeWidth,
          stroke: '#FF0000',
          strokeWidth: 3
        })
      }
      
      setLineEditorState({
        ...(lineEditorState || {}),
        selectedLines: newSelection
      })
    }
  }
  
  const handleFillet = () => {
    if (selectedLines.length !== 2) {
      alert('Please select exactly 2 lines')
      return
    }
    
    const line1 = shapes.find(s => s.id === selectedLines[0])
    const line2 = shapes.find(s => s.id === selectedLines[1])
    
    if (!line1 || !line2 || line1.type !== 'line' || line2.type !== 'line') {
      alert('Both shapes must be lines')
      return
    }
    
    const intersection = findLineIntersection(line1, line2)
    if (!intersection) {
      alert('Lines do not intersect')
      return
    }
    
    try {
      const arcData = createFilletArc(line1, line2, size, intersection)
      
      updateShape(line1.id, {
        x2: arcData.tangent1.x,
        y2: arcData.tangent1.y
      })
      
      updateShape(line2.id, {
        x2: arcData.tangent2.x,
        y2: arcData.tangent2.y
      })
      
      addShape({
        id: `arc-${Date.now()}`,
        type: 'arc',
        x: arcData.centerX,
        y: arcData.centerY,
        outerRadius: arcData.radius,
        innerRadius: 0,
        angle: Math.abs(arcData.arcAngle),
        rotation: arcData.startAngle,
        stroke: '#000',
        strokeWidth: 2
      })
      
      clearSelection()
    } catch (error) {
      console.error('Fillet error:', error)
      alert('Failed to create fillet')
    }
  }
  
  const handleChamfer = () => {
    if (selectedLines.length !== 2) {
      alert('Please select exactly 2 lines')
      return
    }
    
    const line1 = shapes.find(s => s.id === selectedLines[0])
    const line2 = shapes.find(s => s.id === selectedLines[1])
    
    if (!line1 || !line2 || line1.type !== 'line' || line2.type !== 'line') {
      alert('Both shapes must be lines')
      return
    }
    
    const intersection = findLineIntersection(line1, line2)
    if (!intersection) {
      alert('Lines do not intersect')
      return
    }
    
    try {
      const chamferData = createChamfer(line1, line2, size, intersection)
      
      updateShape(line1.id, {
        x2: chamferData.point1.x,
        y2: chamferData.point1.y
      })
      
      updateShape(line2.id, {
        x2: chamferData.point2.x,
        y2: chamferData.point2.y
      })
      
      addShape({
        id: `line-${Date.now()}`,
        type: 'line',
        x1: chamferData.point1.x,
        y1: chamferData.point1.y,
        x2: chamferData.point2.x,
        y2: chamferData.point2.y,
        stroke: '#000',
        strokeWidth: 2
      })
      
      clearSelection()
    } catch (error) {
      console.error('Chamfer error:', error)
      alert('Failed to create chamfer')
    }
  }
  
  const handleTrim = () => {
    if (selectedLines.length < 2) {
      alert('Please select at least 2 lines')
      return
    }
    
    setLineEditorState({
      ...(lineEditorState || {}),
      currentTool: 'trim',
      waitingForSegmentClick: true
    })
  }
  
  const handleTrimMid = () => {
    if (selectedLines.length < 2) {
      alert('Please select at least 2 boundary lines first')
      return
    }
    
    setLineEditorState({
      ...(lineEditorState || {}),
      currentTool: 'trimMid',
      boundaryLines: selectedLines.slice(0, 2)
    })
  }
  
  const handleExtend = () => {
    if (selectedLines.length < 2) {
      alert('Please select boundary line and line to extend')
      return
    }
    
    const boundaryLine = shapes.find(s => s.id === selectedLines[0])
    const lineToExtend = shapes.find(s => s.id === selectedLines[1])
    
    if (!boundaryLine || !lineToExtend) return
    
    const intersection = findLineIntersection(boundaryLine, lineToExtend)
    if (!intersection) {
      alert('Lines do not intersect when extended')
      return
    }
    
    const distToStart = calculateDistance(intersection.x, intersection.y, lineToExtend.x1, lineToExtend.y1)
    const distToEnd = calculateDistance(intersection.x, intersection.y, lineToExtend.x2, lineToExtend.y2)
    
    if (distToStart < distToEnd) {
      updateShape(lineToExtend.id, {
        x1: intersection.x,
        y1: intersection.y
      })
    } else {
      updateShape(lineToExtend.id, {
        x2: intersection.x,
        y2: intersection.y
      })
    }
    
    clearSelection()
  }
  
  const handleAdjustLine = () => {
    setLineEditorState({
      ...(lineEditorState || {}),
      currentTool: 'adjustLine',
      snapEnabled
    })
  }
  
  const handleRotateShape = () => {
    if (selectedLines.length === 0) {
      alert('Please select at least one shape')
      return
    }
    
    setLineEditorState({
      ...(lineEditorState || {}),
      currentTool: 'rotate',
      rotationAngle: 0
    })
  }
  
  const applyRotation = (direction) => {
    if (selectedLines.length === 0) return
    
    let angle = rotationAngle
    if (angleSnapEnabled) {
      angle = Math.round(angle / 5) * 5
    }
    
    if (direction === 'ccw') angle = -Math.abs(angle)
    else if (direction === 'cw') angle = Math.abs(angle)
    
    selectedLines.forEach(shapeId => {
      const shape = shapes.find(s => s.id === shapeId)
      if (!shape) return
      
      const center = getShapeCenter(shape)
      const rotated = rotateShape(shape, center.x, center.y, angle)
      
      updateShape(shapeId, rotated)
    })
    
    clearSelection()
  }
  
  return (
    <div className="line-editor-tools-window">
      <h3>Line Editor Tools</h3>
      
      <div className="size-input">
        <label>
          Size (mm):
          <input
            type="number"
            value={size}
            onChange={(e) => setSize(parseFloat(e.target.value) || 0)}
            min="0.1"
            step="0.5"
          />
        </label>
      </div>
      
      <div className="tool-grid">
        <button onClick={handleFillet} title="Create rounded corner between two lines">
          Fillet
        </button>
        <button onClick={handleChamfer} title="Create beveled corner between two lines">
          Chamfer
        </button>
        
        <button onClick={handleTrim} title="Trim line segment at intersection">
          Trim
        </button>
        <button onClick={handleTrimMid} title="Trim middle section between boundaries">
          TrimMid
        </button>
        
        <button onClick={handleExtend} title="Extend line to meet boundary">
          Extend
        </button>
        <button onClick={handleAdjustLine} title="Drag line endpoints">
          Adjust Line
        </button>
      </div>
      
      <div className="snap-checkbox">
        <label>
          <input
            type="checkbox"
            checked={snapEnabled}
            onChange={(e) => setSnapEnabled(e.target.checked)}
          />
          Snap
        </label>
      </div>
      
      <div className="rotate-section">
        <button onClick={handleRotateShape} title="Rotate selected shapes">
          Rotate
        </button>
        <label className="angle-snap">
          <input
            type="checkbox"
            checked={angleSnapEnabled}
            onChange={(e) => setAngleSnapEnabled(e.target.checked)}
          />
          5° Snap
        </label>
        
        <div className="angle-input">
          <label>
            Angle (°):
            <input
              type="number"
              value={rotationAngle}
              onChange={(e) => setRotationAngle(parseFloat(e.target.value) || 0)}
              step="5"
            />
          </label>
        </div>
        
        <div className="rotation-buttons">
          <button onClick={() => applyRotation('ccw')} title="Rotate counter-clockwise">
            CCW
          </button>
          <button onClick={() => applyRotation('cw')} title="Rotate clockwise">
            CW
          </button>
        </div>
      </div>
      
      <button className="clear-selection-btn" onClick={clearSelection}>
        Clear Selection
      </button>
      
      {selectedLines.length > 0 && (
        <div className="selection-info">
          Selected: {selectedLines.length} shape(s)
        </div>
      )}
      
      {lineEditorState?.currentTool && (
        <div className="tool-status">
          Active: {lineEditorState.currentTool}
        </div>
      )}
    </div>
  )
}

export default LineEditorToolsWindow
