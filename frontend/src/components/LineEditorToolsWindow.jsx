import { useState, useEffect } from 'react'
import useCadStore from '../store/cadStore'
import {
  findLineIntersection,
  createFilletArc,
  createChamfer,
  getShapeCenter,
  rotateShape,
  findClosestEndpoint,
  calculateDistance,
  calculateAngleBetweenLines
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
  const setActiveTool = useCadStore((state) => state.setActiveTool)
  
  const [size, setSize] = useState(10)
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [angleSnapEnabled, setAngleSnapEnabled] = useState(true)
  const [rotationAngle, setRotationAngle] = useState(0)
  
  const selectedLines = lineEditorState?.selectedLines || []
  const selectedShapes = selectedLines.map(id => shapes.find(s => s.id === id)).filter(Boolean)
  const currentTool = lineEditorState?.currentTool
  
  const toolRequirements = {
    fillet: { minLines: 2, maxLines: 2, label: 'Fillet' },
    chamfer: { minLines: 2, maxLines: 2, label: 'Chamfer' },
    trim: { minLines: 2, maxLines: null, label: 'Trim' },
    trimMid: { minLines: 2, maxLines: 2, label: 'Trim Mid' },
    extend: { minLines: 2, maxLines: 2, label: 'Extend' },
    adjustLine: { minLines: 1, maxLines: 1, label: 'Adjust Line' },
    rotate: { minLines: 1, maxLines: null, label: 'Rotate' }
  }
  
  const canApplyTool = () => {
    if (!currentTool) return false
    const req = toolRequirements[currentTool]
    if (!req) return false
    if (selectedLines.length < req.minLines) return false
    if (req.maxLines && selectedLines.length > req.maxLines) return false
    return true
  }
  
  useEffect(() => {
    if (currentTool === 'fillet' && selectedLines.length === 2) {
      executeFillet()
    } else if (currentTool === 'chamfer' && selectedLines.length === 2) {
      executeChamfer()
    }
  }, [selectedLines.length, currentTool])
  
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
  
  const startToolSelection = (toolName) => {
    setActiveTool(null)
    clearSelection()
    setLineEditorState({
      selectedLines: [],
      currentTool: toolName
    })
  }
  
  const executeFillet = () => {
    if (selectedLines.length !== 2) {
      alert('Please select exactly 2 lines')
      return
    }
    
    if (size <= 0) {
      alert('Fillet radius must be greater than 0')
      return
    }
    
    const line1 = shapes.find(s => s.id === selectedLines[0])
    const line2 = shapes.find(s => s.id === selectedLines[1])
    
    if (!line1 || !line2 || line1.type !== 'line' || line2.type !== 'line') {
      alert('Both shapes must be lines')
      return
    }
    
    const angleBetween = calculateAngleBetweenLines(line1, line2)
    const minAngle = (2 * Math.PI) / 180
    
    if (angleBetween < minAngle || angleBetween > (Math.PI - minAngle)) {
      alert('Lines are too close to parallel for fillet (angle must be > 2°)')
      return
    }
    
    const intersection = findLineIntersection(line1, line2)
    if (!intersection) {
      alert('Lines do not intersect or are parallel')
      return
    }
    
    if (intersection.extended) {
      if (!confirm('Lines only intersect when extended. Continue with fillet?')) {
        return
      }
    }
    
    const line1Length = calculateDistance(line1.x1, line1.y1, line1.x2, line1.y2)
    const line2Length = calculateDistance(line2.x1, line2.y1, line2.x2, line2.y2)
    
    if (size * 1.5 > Math.min(line1Length, line2Length)) {
      alert('Fillet radius is too large for the selected lines')
      return
    }
    
    try {
      const arcData = createFilletArc(line1, line2, size, intersection)
      
      if (!isFinite(arcData.tangent1.x) || !isFinite(arcData.tangent1.y) || 
          !isFinite(arcData.tangent2.x) || !isFinite(arcData.tangent2.y) ||
          !isFinite(arcData.centerX) || !isFinite(arcData.centerY) ||
          !isFinite(arcData.radius) || !isFinite(arcData.arcAngle) ||
          !isFinite(arcData.startAngle)) {
        alert('Invalid fillet geometry (angle too small or lines nearly parallel)')
        return
      }
      
      if (arcData.line1KeepEnd.x === line1.x1 && arcData.line1KeepEnd.y === line1.y1) {
        updateShape(line1.id, {
          x2: arcData.tangent1.x,
          y2: arcData.tangent1.y
        })
      } else {
        updateShape(line1.id, {
          x1: arcData.tangent1.x,
          y1: arcData.tangent1.y
        })
      }
      
      if (arcData.line2KeepEnd.x === line2.x1 && arcData.line2KeepEnd.y === line2.y1) {
        updateShape(line2.id, {
          x2: arcData.tangent2.x,
          y2: arcData.tangent2.y
        })
      } else {
        updateShape(line2.id, {
          x1: arcData.tangent2.x,
          y1: arcData.tangent2.y
        })
      }
      
      const isClockwise = arcData.arcAngle < 0
      const arcRotation = isClockwise ? arcData.startAngle + arcData.arcAngle : arcData.startAngle
      
      addShape({
        id: `arc-${Date.now()}`,
        type: 'arc',
        x: arcData.centerX,
        y: arcData.centerY,
        outerRadius: arcData.radius,
        angle: Math.abs(arcData.arcAngle),
        rotation: arcRotation,
        stroke: '#000',
        strokeWidth: 2
      })
      
      clearSelection()
    } catch (error) {
      console.error('Fillet error:', error)
      alert('Failed to create fillet: ' + error.message)
    }
  }
  
  const executeChamfer = () => {
    if (selectedLines.length !== 2) {
      alert('Please select exactly 2 lines')
      return
    }
    
    if (size <= 0) {
      alert('Chamfer size must be greater than 0')
      return
    }
    
    const line1 = shapes.find(s => s.id === selectedLines[0])
    const line2 = shapes.find(s => s.id === selectedLines[1])
    
    if (!line1 || !line2 || line1.type !== 'line' || line2.type !== 'line') {
      alert('Both shapes must be lines')
      return
    }
    
    const angleBetween = calculateAngleBetweenLines(line1, line2)
    const minAngle = (2 * Math.PI) / 180
    
    if (angleBetween < minAngle || angleBetween > (Math.PI - minAngle)) {
      alert('Lines are too close to parallel for chamfer (angle must be > 2°)')
      return
    }
    
    const intersection = findLineIntersection(line1, line2)
    if (!intersection) {
      alert('Lines do not intersect or are parallel')
      return
    }
    
    if (intersection.extended) {
      if (!confirm('Lines only intersect when extended. Continue with chamfer?')) {
        return
      }
    }
    
    const line1Length = calculateDistance(line1.x1, line1.y1, line1.x2, line1.y2)
    const line2Length = calculateDistance(line2.x1, line2.y1, line2.x2, line2.y2)
    
    if (size * 1.5 > Math.min(line1Length, line2Length)) {
      alert('Chamfer size is too large for the selected lines')
      return
    }
    
    try {
      const chamferData = createChamfer(line1, line2, size, intersection)
      
      if (!isFinite(chamferData.point1.x) || !isFinite(chamferData.point1.y) || 
          !isFinite(chamferData.point2.x) || !isFinite(chamferData.point2.y)) {
        alert('Invalid chamfer geometry (angle too small or lines nearly parallel)')
        return
      }
      
      if (chamferData.line1KeepEnd.x === line1.x1 && chamferData.line1KeepEnd.y === line1.y1) {
        updateShape(line1.id, {
          x2: chamferData.point1.x,
          y2: chamferData.point1.y
        })
      } else {
        updateShape(line1.id, {
          x1: chamferData.point1.x,
          y1: chamferData.point1.y
        })
      }
      
      if (chamferData.line2KeepEnd.x === line2.x1 && chamferData.line2KeepEnd.y === line2.y1) {
        updateShape(line2.id, {
          x2: chamferData.point2.x,
          y2: chamferData.point2.y
        })
      } else {
        updateShape(line2.id, {
          x1: chamferData.point2.x,
          y1: chamferData.point2.y
        })
      }
      
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
      alert('Failed to create chamfer: ' + error.message)
    }
  }
  
  const executeTrim = () => {
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
  
  const executeTrimMid = () => {
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
  
  const executeExtend = () => {
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
  
  const executeAdjustLine = () => {
    if (selectedLines.length < 1) {
      alert('Please select a line to adjust')
      return
    }
    
    setLineEditorState({
      ...(lineEditorState || {}),
      currentTool: 'adjustLine',
      snapEnabled
    })
  }
  
  const executeRotate = () => {
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
  
  const applyCurrentTool = () => {
    if (!currentTool || !canApplyTool()) return
    
    switch (currentTool) {
      case 'fillet':
        executeFillet()
        break
      case 'chamfer':
        executeChamfer()
        break
      case 'trim':
        executeTrim()
        break
      case 'trimMid':
        executeTrimMid()
        break
      case 'extend':
        executeExtend()
        break
      case 'adjustLine':
        executeAdjustLine()
        break
      case 'rotate':
        executeRotate()
        break
      default:
        break
    }
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
        <button 
          onClick={() => startToolSelection('fillet')} 
          className={currentTool === 'fillet' ? 'active' : ''}
          title="Create rounded corner between two lines"
        >
          Fillet
        </button>
        <button 
          onClick={() => startToolSelection('chamfer')} 
          className={currentTool === 'chamfer' ? 'active' : ''}
          title="Create beveled corner between two lines"
        >
          Chamfer
        </button>
        
        <button 
          onClick={() => startToolSelection('trim')} 
          className={currentTool === 'trim' ? 'active' : ''}
          title="Trim line segment at intersection"
        >
          Trim
        </button>
        <button 
          onClick={() => startToolSelection('trimMid')} 
          className={currentTool === 'trimMid' ? 'active' : ''}
          title="Trim middle section between boundaries"
        >
          TrimMid
        </button>
        
        <button 
          onClick={() => startToolSelection('extend')} 
          className={currentTool === 'extend' ? 'active' : ''}
          title="Extend line to meet boundary"
        >
          Extend
        </button>
        <button 
          onClick={() => startToolSelection('adjustLine')} 
          className={currentTool === 'adjustLine' ? 'active' : ''}
          title="Drag line endpoints"
        >
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
        <button 
          onClick={() => startToolSelection('rotate')} 
          className={currentTool === 'rotate' ? 'active' : ''}
          title="Rotate selected shapes"
        >
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
      
      {currentTool && toolRequirements[currentTool] && (
        <div className="tool-status-panel">
          <div className="tool-status">
            <strong>{toolRequirements[currentTool].label} Active</strong>
            <div className="selection-progress">
              {toolRequirements[currentTool].maxLines ? (
                <>Select {toolRequirements[currentTool].minLines} line(s): {selectedLines.length}/{toolRequirements[currentTool].maxLines}</>
              ) : (
                <>Select at least {toolRequirements[currentTool].minLines} line(s): {selectedLines.length} selected</>
              )}
            </div>
            {(currentTool === 'fillet' || currentTool === 'chamfer') && selectedLines.length === toolRequirements[currentTool].maxLines && (
              <div className="auto-execute-notice">Will execute automatically</div>
            )}
          </div>
        </div>
      )}
      
      {!currentTool && selectedLines.length > 0 && (
        <div className="selection-info">
          Selected: {selectedLines.length} shape(s)
        </div>
      )}
    </div>
  )
}

export default LineEditorToolsWindow
