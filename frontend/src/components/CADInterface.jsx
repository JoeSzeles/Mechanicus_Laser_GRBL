import { useState, useEffect, useRef, useContext } from 'react'
import * as fabric from 'fabric'
import AuthContext from '../contexts/AuthContext'
import Toolbar from './Toolbar'
import LayerPanel from './LayerPanel'
import PropertiesPanel from './PropertiesPanel'
import SerialControl from './SerialControl'
import './CADInterface.css'

function CADInterface() {
  const canvasRef = useRef(null)
  const hRulerRef = useRef(null)
  const vRulerRef = useRef(null)
  const viewportRef = useRef(null)
  const [canvas, setCanvas] = useState(null)
  const [activeTool, setActiveTool] = useState('select')
  const [showGrid, setShowGrid] = useState(true)
  const [gridSize, setGridSize] = useState(10)
  const [snapToGrid, setSnapToGrid] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [selectedObjects, setSelectedObjects] = useState([])
  const [machineProfile, setMachineProfile] = useState({
    bedSizeX: 370, // mm
    bedSizeY: 600, // mm
    name: 'GRBL Default',
    mmToPx: 3.779527559 // 96 DPI standard conversion
  })
  
  // Viewport state for proper camera model
  const [viewport, setViewport] = useState({
    scrollLeft: 0,
    scrollTop: 0,
    containerWidth: 0,
    containerHeight: 0
  })
  const { user, logout } = useContext(AuthContext)

  // Load machine profile from JSON config
  useEffect(() => {
    const loadMachineProfile = async () => {
      try {
        // Load default machine configuration - later from JSON
        const defaultProfile = {
          bedSizeX: 370,
          bedSizeY: 600, 
          name: 'GRBL Default',
          mmToPx: 3.779527559 // 96 DPI standard
        }
        setMachineProfile(defaultProfile)
      } catch (error) {
        console.error('Failed to load machine profile:', error)
      }
    }
    
    loadMachineProfile()
  }, [])

  // Initialize Fabric.js canvas - ONCE ONLY
  useEffect(() => {
    if (!canvasRef.current) return

    const canvasWidth = machineProfile.bedSizeX * machineProfile.mmToPx
    const canvasHeight = machineProfile.bedSizeY * machineProfile.mmToPx

    const fabricCanvas = new fabric.Canvas(canvasRef.current, {
      width: canvasWidth,
      height: canvasHeight,
      backgroundColor: 'white',
      selection: true,
    })

    // Object selection events
    fabricCanvas.on('selection:created', (e) => {
      setSelectedObjects(e.selected || [])
    })

    fabricCanvas.on('selection:updated', (e) => {
      setSelectedObjects(e.selected || [])
    })

    fabricCanvas.on('selection:cleared', () => {
      setSelectedObjects([])
    })

    setCanvas(fabricCanvas)

    // Cleanup on unmount
    return () => {
      fabricCanvas.dispose()
    }
  }, []) // Initialize ONCE

  // Handle zoom changes with proper viewport coordination
  useEffect(() => {
    if (!canvas) return
    
    canvas.setZoom(zoom)
    canvas.renderAll()
    updateRulers()
  }, [canvas, zoom])

  // Handle viewport changes for ruler synchronization
  useEffect(() => {
    updateRulers()
  }, [viewport, zoom, machineProfile])

  // Handle grid display
  useEffect(() => {
    if (!canvas) return
    drawGrid()
  }, [canvas, showGrid, gridSize, zoom])

  // Draw grid
  const drawGrid = () => {
    if (!canvas) return

    // Remove existing grid
    const existingGrid = canvas.getObjects().filter(obj => obj.isGrid)
    existingGrid.forEach(obj => canvas.remove(obj))

    if (!showGrid) {
      canvas.renderAll()
      return
    }

    const canvasWidth = machineProfile.bedSizeX * machineProfile.mmToPx
    const canvasHeight = machineProfile.bedSizeY * machineProfile.mmToPx
    const gridSpacing = gridSize * machineProfile.mmToPx

    // Vertical lines
    for (let x = 0; x <= canvasWidth; x += gridSpacing) {
      const line = new fabric.Line([x, 0, x, canvasHeight], {
        stroke: '#e0e0e0',
        strokeWidth: 0.5,
        selectable: false,
        evented: false,
        excludeFromExport: true,
        isGrid: true
      })
      canvas.add(line)
      line.sendToBack()
    }

    // Horizontal lines
    for (let y = 0; y <= canvasHeight; y += gridSpacing) {
      const line = new fabric.Line([0, y, canvasWidth, y], {
        stroke: '#e0e0e0',
        strokeWidth: 0.5,
        selectable: false,
        evented: false,
        excludeFromExport: true,
        isGrid: true
      })
      canvas.add(line)
      line.sendToBack()
    }

    canvas.renderAll()
  }

  // Handle scroll events for viewport synchronization
  const handleScroll = (e) => {
    const container = e.target
    setViewport(prev => ({
      ...prev,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop
    }))
  }

  // Update rulers with proper scroll synchronization
  const updateRulers = () => {
    if (!hRulerRef.current || !vRulerRef.current || !canvas) return

    const rulerHeight = 25
    const rulerWidth = 25
    const rulerViewportWidth = viewport.containerWidth || 800
    const rulerViewportHeight = viewport.containerHeight || 600

    // Calculate ruler origin based on scroll position
    const rulerOriginX = viewport.scrollLeft / zoom
    const rulerOriginY = viewport.scrollTop / zoom
    const mmOriginX = rulerOriginX / machineProfile.mmToPx
    const mmOriginY = rulerOriginY / machineProfile.mmToPx

    // Horizontal ruler
    const hRulerCanvas = document.createElement('canvas')
    hRulerCanvas.width = rulerViewportWidth
    hRulerCanvas.height = rulerHeight
    const hCtx = hRulerCanvas.getContext('2d')
    
    hCtx.fillStyle = '#f0f0f0'
    hCtx.fillRect(0, 0, hRulerCanvas.width, rulerHeight)
    hCtx.strokeStyle = '#666'
    hCtx.fillStyle = '#333'
    hCtx.font = '10px Arial'

    const mmStep = Math.max(5, 50 / zoom) // Adaptive step based on zoom
    const startMM = Math.floor(mmOriginX / mmStep) * mmStep
    const endMM = mmOriginX + (rulerViewportWidth / zoom / machineProfile.mmToPx)
    
    for (let mmPos = startMM; mmPos <= endMM; mmPos += mmStep) {
      if (mmPos < 0 || mmPos > machineProfile.bedSizeX) continue
      
      const x = (mmPos - mmOriginX) * machineProfile.mmToPx * zoom
      hCtx.beginPath()
      hCtx.moveTo(x, rulerHeight - 8)
      hCtx.lineTo(x, rulerHeight)
      hCtx.stroke()
      
      if (mmPos % (mmStep * 2) === 0) {
        hCtx.fillText(mmPos.toFixed(0) + 'mm', x + 2, rulerHeight - 12)
      }
    }

    // Vertical ruler
    const vRulerCanvas = document.createElement('canvas')
    vRulerCanvas.width = rulerWidth
    vRulerCanvas.height = rulerViewportHeight
    const vCtx = vRulerCanvas.getContext('2d')
    
    vCtx.fillStyle = '#f0f0f0'
    vCtx.fillRect(0, 0, rulerWidth, vRulerCanvas.height)
    vCtx.strokeStyle = '#666'
    vCtx.fillStyle = '#333'
    vCtx.font = '10px Arial'

    const startMMY = Math.floor(mmOriginY / mmStep) * mmStep
    const endMMY = mmOriginY + (rulerViewportHeight / zoom / machineProfile.mmToPx)
    
    for (let mmPos = startMMY; mmPos <= endMMY; mmPos += mmStep) {
      if (mmPos < 0 || mmPos > machineProfile.bedSizeY) continue
      
      const y = (mmPos - mmOriginY) * machineProfile.mmToPx * zoom
      vCtx.beginPath()
      vCtx.moveTo(rulerWidth - 8, y)
      vCtx.lineTo(rulerWidth, y)
      vCtx.stroke()
      
      if (mmPos % (mmStep * 2) === 0) {
        vCtx.save()
        vCtx.translate(rulerWidth - 15, y + 2)
        vCtx.rotate(-Math.PI / 2)
        vCtx.fillText(mmPos.toFixed(0) + 'mm', 0, 0)
        vCtx.restore()
      }
    }

    // Update ruler displays
    hRulerRef.current.innerHTML = ''
    hRulerRef.current.appendChild(hRulerCanvas)
    
    vRulerRef.current.innerHTML = ''
    vRulerRef.current.appendChild(vRulerCanvas)
  }

  // Tool handlers
  const handleToolChange = (tool) => {
    setActiveTool(tool)
  }

  const handleZoomIn = () => {
    const newZoom = Math.min(zoom * 1.2, 5)
    setZoom(newZoom)
  }

  const handleZoomOut = () => {
    const newZoom = Math.max(zoom * 0.8, 0.1)
    setZoom(newZoom)
  }

  // Track container size for rulers
  useEffect(() => {
    const updateViewportSize = () => {
      if (viewportRef.current) {
        const rect = viewportRef.current.getBoundingClientRect()
        setViewport(prev => ({
          ...prev,
          containerWidth: rect.width - 25, // Account for vertical ruler
          containerHeight: rect.height - 25 // Account for horizontal ruler
        }))
      }
    }

    updateViewportSize()
    window.addEventListener('resize', updateViewportSize)
    return () => window.removeEventListener('resize', updateViewportSize)
  }, [])

  const addLine = () => {
    if (!canvas) return
    const line = new fabric.Line([50, 50, 150, 150], {
      stroke: '#000000',
      strokeWidth: 2,
      selectable: true
    })
    canvas.add(line)
    canvas.renderAll()
  }

  const addRectangle = () => {
    if (!canvas) return
    const rect = new fabric.Rect({
      left: 100,
      top: 100,
      width: 100,
      height: 100,
      fill: 'transparent',
      stroke: '#000000',
      strokeWidth: 2,
      selectable: true
    })
    canvas.add(rect)
    canvas.renderAll()
  }

  const addCircle = () => {
    if (!canvas) return
    const circle = new fabric.Circle({
      left: 200,
      top: 200,
      radius: 50,
      fill: 'transparent',
      stroke: '#000000',
      strokeWidth: 2,
      selectable: true
    })
    canvas.add(circle)
    canvas.renderAll()
  }

  const deleteSelected = () => {
    if (!canvas) return
    const activeObjects = canvas.getActiveObjects()
    if (activeObjects.length > 0) {
      activeObjects.forEach(obj => canvas.remove(obj))
      canvas.discardActiveObject()
      canvas.renderAll()
      setSelectedObjects([])
    }
  }

  // Generate G-code
  const generateGcode = () => {
    if (!canvas) return null

    const objects = canvas.getObjects().filter(obj => !obj.isGrid)
    if (objects.length === 0) {
      alert('No objects to export. Please draw something first.')
      return null
    }

    let gcode = []
    
    // G-code header
    gcode.push('; Mechanicus CAD Generated G-code')
    gcode.push('; Generated: ' + new Date().toISOString())
    gcode.push('')
    gcode.push('G21 ; Set units to millimeters')
    gcode.push('G90 ; Absolute positioning')
    gcode.push('G17 ; XY plane selection')
    gcode.push('M3 S1000 ; Start laser at low power')
    gcode.push('G4 P1 ; Pause 1 second')
    gcode.push('')

    // Convert objects to G-code with proper world coordinate handling
    const invViewportTransform = fabric.util.invertTransform(canvas.viewportTransform)
    
    objects.forEach((obj, index) => {
      gcode.push(`; Object ${index + 1}: ${obj.type}`)
      
      try {
        // Compute object-to-world matrix: inv(viewportTransform) × objectTransform
        const objTransform = obj.calcTransformMatrix()
        const worldTransform = fabric.util.multiplyTransformMatrices(invViewportTransform, objTransform)
        
        if (obj.type === 'line') {
          // Transform actual line endpoints from object space to world space
          const p1 = fabric.util.transformPoint({ x: obj.x1, y: obj.y1 }, worldTransform)
          const p2 = fabric.util.transformPoint({ x: obj.x2, y: obj.y2 }, worldTransform)
          
          const x1 = (p1.x / machineProfile.mmToPx).toFixed(3)
          const y1 = (p1.y / machineProfile.mmToPx).toFixed(3)
          const x2 = (p2.x / machineProfile.mmToPx).toFixed(3)
          const y2 = (p2.y / machineProfile.mmToPx).toFixed(3)
          
          gcode.push(`G0 X${x1} Y${y1} ; Move to start point`)
          gcode.push('M3 S1000 ; Laser on')
          gcode.push(`G1 X${x2} Y${y2} F1000 ; Cut line`)
          gcode.push('M5 ; Laser off')
          
        } else if (obj.type === 'rect') {
          // Transform rectangle corners from object space to world space
          // Respect fabric.Rect origin (default: left/top, not center)
          const originOffsetX = (obj.originX === 'center') ? -obj.width/2 : 0
          const originOffsetY = (obj.originY === 'center') ? -obj.height/2 : 0
          
          const localCorners = [
            { x: originOffsetX, y: originOffsetY },                                    // top-left
            { x: originOffsetX + obj.width, y: originOffsetY },                        // top-right  
            { x: originOffsetX + obj.width, y: originOffsetY + obj.height },           // bottom-right
            { x: originOffsetX, y: originOffsetY + obj.height }                        // bottom-left
          ]
          
          const worldCorners = localCorners.map(corner => 
            fabric.util.transformPoint(corner, worldTransform)
          )
          
          const tl = worldCorners[0], tr = worldCorners[1], br = worldCorners[2], bl = worldCorners[3]
          
          gcode.push(`G0 X${(tl.x / machineProfile.mmToPx).toFixed(3)} Y${(tl.y / machineProfile.mmToPx).toFixed(3)} ; Move to rectangle start`)
          gcode.push('M3 S1000 ; Laser on')
          gcode.push(`G1 X${(tr.x / machineProfile.mmToPx).toFixed(3)} Y${(tr.y / machineProfile.mmToPx).toFixed(3)} F1000`)
          gcode.push(`G1 X${(br.x / machineProfile.mmToPx).toFixed(3)} Y${(br.y / machineProfile.mmToPx).toFixed(3)}`)
          gcode.push(`G1 X${(bl.x / machineProfile.mmToPx).toFixed(3)} Y${(bl.y / machineProfile.mmToPx).toFixed(3)}`)
          gcode.push(`G1 X${(tl.x / machineProfile.mmToPx).toFixed(3)} Y${(tl.y / machineProfile.mmToPx).toFixed(3)}`)
          gcode.push('M5 ; Laser off')
          
        } else if (obj.type === 'circle' || obj.type === 'ellipse') {
          // Transform circle/ellipse center and derive world-space radii from transform matrix
          const localCenter = { x: 0, y: 0 }
          const worldCenter = fabric.util.transformPoint(localCenter, worldTransform)
          
          // Extract scale factors from world transform matrix to get accurate radii
          const scaleX = Math.sqrt(worldTransform[0] * worldTransform[0] + worldTransform[1] * worldTransform[1])
          const scaleY = Math.sqrt(worldTransform[2] * worldTransform[2] + worldTransform[3] * worldTransform[3])
          
          // Handle both circle (has radius) and ellipse (has rx/ry) types
          let radiusX, radiusY
          if (obj.type === 'ellipse') {
            radiusX = obj.rx * scaleX
            radiusY = obj.ry * scaleY
          } else {
            radiusX = obj.radius * scaleX
            radiusY = obj.radius * scaleY
          }
          
          const centerX = (worldCenter.x / machineProfile.mmToPx).toFixed(3)
          const centerY = (worldCenter.y / machineProfile.mmToPx).toFixed(3)
          
          // Check if it's a true circle or ellipse (accounting for transform scaling)
          if (Math.abs(scaleX - scaleY) < 0.001) {
            // True circle - use G02 arcs
            const radiusMM = (radiusX / machineProfile.mmToPx).toFixed(3)
            const startX = (parseFloat(centerX) + parseFloat(radiusMM)).toFixed(3)
            const startY = centerY
            
            gcode.push(`G0 X${startX} Y${startY} ; Move to circle start`)
            gcode.push('M3 S1000 ; Laser on')
            // First semicircle (right to left)
            gcode.push(`G02 X${(parseFloat(centerX) - parseFloat(radiusMM)).toFixed(3)} Y${centerY} I${(-parseFloat(radiusMM)).toFixed(3)} J0 F1000`)
            // Second semicircle (left to right)
            gcode.push(`G02 X${startX} Y${startY} I${parseFloat(radiusMM).toFixed(3)} J0`)
            gcode.push('M5 ; Laser off')
          } else {
            // Ellipse or rotated circle - approximate with line segments
            const segments = 32
            const angleStep = (2 * Math.PI) / segments
            let first = true
            
            for (let i = 0; i <= segments; i++) {
              const angle = i * angleStep
              // Sample ellipse points in local space then transform to world space
              const localRx = obj.type === 'ellipse' ? obj.rx : obj.radius
              const localRy = obj.type === 'ellipse' ? obj.ry : obj.radius
              const localPoint = {
                x: localRx * Math.cos(angle),
                y: localRy * Math.sin(angle)
              }
              const worldPoint = fabric.util.transformPoint(localPoint, worldTransform)
              const x = (worldPoint.x / machineProfile.mmToPx).toFixed(3)
              const y = (worldPoint.y / machineProfile.mmToPx).toFixed(3)
              
              if (first) {
                gcode.push(`G0 X${x} Y${y} ; Move to ellipse start`)
                gcode.push('M3 S1000 ; Laser on')
                first = false
              } else {
                gcode.push(`G1 X${x} Y${y} F1000`)
              }
            }
            gcode.push('M5 ; Laser off')
          }
        } else if (obj.type === 'path') {
          // Handle SVG paths with proper coordinate transformation and pathOffset
          gcode.push('; Path object with proper transforms and pathOffset')
          const pathData = obj.path
          const pathOffset = obj.pathOffset || { x: 0, y: 0 }
          
          if (pathData && pathData.length > 0) {
            let first = true
            for (const cmd of pathData) {
              if (cmd[0] === 'M' || cmd[0] === 'L') {
                // Account for pathOffset, then transform from object space to world space
                const localPoint = { 
                  x: cmd[1] - pathOffset.x, 
                  y: cmd[2] - pathOffset.y 
                }
                const worldPoint = fabric.util.transformPoint(localPoint, worldTransform)
                const x = (worldPoint.x / machineProfile.mmToPx).toFixed(3)
                const y = (worldPoint.y / machineProfile.mmToPx).toFixed(3)
                
                if (first || cmd[0] === 'M') {
                  if (!first) gcode.push('M5 ; Laser off')
                  gcode.push(`G0 X${x} Y${y} ; Move to path point`)
                  gcode.push('M3 S1000 ; Laser on')
                  first = false
                } else {
                  gcode.push(`G1 X${x} Y${y} F1000 ; Cut to path point`)
                }
              } else if (cmd[0] === 'Q') {
                // Quadratic Bezier - flatten to line segments
                const startPoint = { x: cmd[1] - pathOffset.x, y: cmd[2] - pathOffset.y }
                const controlPoint = { x: cmd[3] - pathOffset.x, y: cmd[4] - pathOffset.y }
                const endPoint = { x: cmd[5] - pathOffset.x, y: cmd[6] - pathOffset.y }
                
                const segments = 8 // Adaptive segmentation would be better
                for (let i = 1; i <= segments; i++) {
                  const t = i / segments
                  const localPoint = {
                    x: (1-t)*(1-t)*startPoint.x + 2*(1-t)*t*controlPoint.x + t*t*endPoint.x,
                    y: (1-t)*(1-t)*startPoint.y + 2*(1-t)*t*controlPoint.y + t*t*endPoint.y
                  }
                  const worldPoint = fabric.util.transformPoint(localPoint, worldTransform)
                  const x = (worldPoint.x / machineProfile.mmToPx).toFixed(3)
                  const y = (worldPoint.y / machineProfile.mmToPx).toFixed(3)
                  gcode.push(`G1 X${x} Y${y} F1000 ; Quadratic curve segment`)
                }
              } else if (cmd[0] === 'C') {
                // Cubic Bezier - flatten to line segments  
                const startPoint = { x: cmd[1] - pathOffset.x, y: cmd[2] - pathOffset.y }
                const control1 = { x: cmd[3] - pathOffset.x, y: cmd[4] - pathOffset.y }
                const control2 = { x: cmd[5] - pathOffset.x, y: cmd[6] - pathOffset.y }
                const endPoint = { x: cmd[7] - pathOffset.x, y: cmd[8] - pathOffset.y }
                
                const segments = 10 // Adaptive segmentation would be better
                for (let i = 1; i <= segments; i++) {
                  const t = i / segments
                  const localPoint = {
                    x: (1-t)*(1-t)*(1-t)*startPoint.x + 3*(1-t)*(1-t)*t*control1.x + 3*(1-t)*t*t*control2.x + t*t*t*endPoint.x,
                    y: (1-t)*(1-t)*(1-t)*startPoint.y + 3*(1-t)*(1-t)*t*control1.y + 3*(1-t)*t*t*control2.y + t*t*t*endPoint.y
                  }
                  const worldPoint = fabric.util.transformPoint(localPoint, worldTransform)
                  const x = (worldPoint.x / machineProfile.mmToPx).toFixed(3)
                  const y = (worldPoint.y / machineProfile.mmToPx).toFixed(3)
                  gcode.push(`G1 X${x} Y${y} F1000 ; Cubic curve segment`)
                }
              }
              // TODO: Handle Arc (A) commands with proper elliptical arc flattening
            }
            if (!first) gcode.push('M5 ; Laser off')
          }
        }
      } catch (error) {
        gcode.push(`; Error processing ${obj.type}: ${error.message}`)
        console.warn(`G-code generation error for ${obj.type}:`, error)
      }
      
      gcode.push('')
    })

    // G-code footer
    gcode.push('M5 ; Laser off')
    gcode.push('G0 X0 Y0 ; Return to origin')
    gcode.push('M30 ; Program end')

    const gcodeText = gcode.join('\n')
    console.log('Generated G-code:', gcodeText)
    return gcodeText
  }

  return (
    <div className="cad-interface">
      {/* Top Menu Bar */}
      <div className="top-menu">
        <div className="menu-left">
          <h2>Mechanicus CAD - {machineProfile.name}</h2>
        </div>
        <div className="menu-center">
          <button onClick={handleZoomIn}>Zoom In ({Math.round(zoom * 100)}%)</button>
          <button onClick={handleZoomOut}>Zoom Out</button>
          <button onClick={() => setZoom(1)}>Reset Zoom</button>
        </div>
        <div className="menu-right">
          <span>User: {user?.email}</span>
          <button onClick={logout}>Logout</button>
        </div>
      </div>

      {/* Main Workspace - Single Large Viewport like Python tkinter */}
      <div className="main-workspace">
        {/* Left Toolbar */}
        <div className="toolbar-panel">
          <Toolbar 
            activeTool={activeTool}
            onToolChange={handleToolChange}
            onAddRectangle={addRectangle}
            onAddCircle={addCircle}
            onAddLine={addLine}
            onDelete={deleteSelected}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            zoom={zoom}
          />
          
          <div className="tool-options">
            <label>
              <input 
                type="checkbox" 
                checked={showGrid}
                onChange={(e) => setShowGrid(e.target.checked)}
              />
              Show Grid
            </label>
            <label>
              Grid Size (mm):
              <input 
                type="number" 
                value={gridSize}
                onChange={(e) => setGridSize(Number(e.target.value))}
                min="1"
                max="50"
                className="grid-input"
              />
            </label>
            <label>
              <input 
                type="checkbox" 
                checked={snapToGrid}
                onChange={(e) => setSnapToGrid(e.target.checked)}
              />
              Snap to Grid
            </label>
          </div>
        </div>

        {/* Canvas Viewport with Rulers */}
        <div className="canvas-viewport" ref={viewportRef}>
          {/* Horizontal Ruler */}
          <div className="h-ruler" ref={hRulerRef}></div>
          
          <div className="canvas-workspace">
            {/* Vertical Ruler */}
            <div className="v-ruler" ref={vRulerRef}></div>
            
            {/* Main Canvas */}
            <div className="canvas-container" onScroll={handleScroll}>
              <canvas 
                ref={canvasRef}
                className="main-canvas"
                style={{
                  border: '2px solid #333',
                  cursor: activeTool === 'select' ? 'default' : 'crosshair'
                }}
              />
            </div>
          </div>
        </div>

        {/* Right Side Panels */}
        <div className="side-panels">
          <LayerPanel canvas={canvas} />
          <PropertiesPanel 
            canvas={canvas}
            selectedObjects={selectedObjects}
          />
          <SerialControl onGcodeGenerated={generateGcode} />
        </div>
      </div>
    </div>
  )
}

export default CADInterface