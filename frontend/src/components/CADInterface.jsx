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
  const scrollContainerRef = useRef(null)
  const [canvas, setCanvas] = useState(null)
  const [activeTool, setActiveTool] = useState('select')
  const [showGrid, setShowGrid] = useState(true)
  const [gridSize, setGridSize] = useState(10)
  const [snapToGrid, setSnapToGrid] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [selectedObjects, setSelectedObjects] = useState([])
  const [machineProfile, setMachineProfile] = useState({
    bedSizeX: 370, // Default machine bed size in mm
    bedSizeY: 600,
    name: 'Default Profile',
    mmToPx: 1.0 // Scale factor: mm to pixels
  })
  const { user, logout } = useContext(AuthContext)

  // Generate G-code from current canvas design
  const generateGcode = () => {
    if (!canvas) return null

    const objects = canvas.getObjects()
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

    // Convert objects to G-code
    objects.forEach((obj, index) => {
      gcode.push(`; Object ${index + 1}: ${obj.type}`)
      
      if (obj.type === 'line') {
        const x1 = (obj.x1 * 0.1).toFixed(3) // Convert pixels to mm (rough conversion)
        const y1 = (obj.y1 * 0.1).toFixed(3)
        const x2 = (obj.x2 * 0.1).toFixed(3)
        const y2 = (obj.y2 * 0.1).toFixed(3)
        
        gcode.push(`G0 X${x1} Y${y1} ; Move to start point`)
        gcode.push('M3 S1000 ; Laser on')
        gcode.push(`G1 X${x2} Y${y2} F1000 ; Cut line`)
        gcode.push('M5 ; Laser off')
        
      } else if (obj.type === 'rect') {
        const left = ((obj.left - obj.width/2) * 0.1).toFixed(3)
        const top = ((obj.top - obj.height/2) * 0.1).toFixed(3)
        const right = ((obj.left + obj.width/2) * 0.1).toFixed(3)
        const bottom = ((obj.top + obj.height/2) * 0.1).toFixed(3)
        
        gcode.push(`G0 X${left} Y${top} ; Move to rectangle start`)
        gcode.push('M3 S1000 ; Laser on')
        gcode.push(`G1 X${right} Y${top} F1000 ; Top edge`)
        gcode.push(`G1 X${right} Y${bottom} F1000 ; Right edge`)
        gcode.push(`G1 X${left} Y${bottom} F1000 ; Bottom edge`)
        gcode.push(`G1 X${left} Y${top} F1000 ; Left edge`)
        gcode.push('M5 ; Laser off')
        
      } else if (obj.type === 'circle') {
        const centerX = (obj.left * 0.1).toFixed(3)
        const centerY = (obj.top * 0.1).toFixed(3)
        const radius = (obj.radius * 0.1).toFixed(3)
        const startX = ((obj.left + obj.radius) * 0.1).toFixed(3)
        
        gcode.push(`G0 X${startX} Y${centerY} ; Move to circle start`)
        gcode.push('M3 S1000 ; Laser on')
        gcode.push(`G2 X${startX} Y${centerY} I${-radius} J0 F1000 ; Cut circle`)
        gcode.push('M5 ; Laser off')
        
      } else if (obj.type === 'path') {
        // Handle free-draw paths
        if (obj.path) {
          let isFirstMove = true
          obj.path.forEach((point, i) => {
            if (point[0] === 'M') {
              const x = ((point[1] + obj.left) * 0.1).toFixed(3)
              const y = ((point[2] + obj.top) * 0.1).toFixed(3)
              if (isFirstMove) {
                gcode.push(`G0 X${x} Y${y} ; Move to path start`)
                gcode.push('M3 S800 ; Laser on (lower power for drawing)')
                isFirstMove = false
              } else {
                gcode.push(`G1 X${x} Y${y} F800 ; Draw path`)
              }
            } else if (point[0] === 'L') {
              const x = ((point[1] + obj.left) * 0.1).toFixed(3)
              const y = ((point[2] + obj.top) * 0.1).toFixed(3)
              gcode.push(`G1 X${x} Y${y} F800 ; Draw path`)
            }
          })
          gcode.push('M5 ; Laser off')
        }
      }
      
      gcode.push('')
    })

    // G-code footer
    gcode.push('; End of program')
    gcode.push('M5 ; Laser off')
    gcode.push('G0 X0 Y0 ; Return to origin')
    gcode.push('M30 ; Program end')

    const gcodeText = gcode.join('\n')
    console.log('Generated G-code:', gcodeText)
    return gcodeText
  }

  // Initialize Fabric.js canvas (once only)
  useEffect(() => {
    if (!canvasRef.current) return

    const fabricCanvas = new fabric.Canvas(canvasRef.current, {
      width: machineProfile.bedSizeX * machineProfile.mmToPx,
      height: machineProfile.bedSizeY * machineProfile.mmToPx,
      backgroundColor: 'white',
      selection: true,
    })

    // Enable object selection
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

    // Initialize rulers after canvas is ready
    setTimeout(() => updateRulers(), 100)

    // Cleanup on unmount
    return () => {
      fabricCanvas.dispose()
    }
  }, []) // Only initialize once

  // Handle machine profile changes (without recreating canvas)
  useEffect(() => {
    if (!canvas) return
    
    // Update canvas size based on machine profile
    const newWidth = machineProfile.bedSizeX * machineProfile.mmToPx
    const newHeight = machineProfile.bedSizeY * machineProfile.mmToPx
    
    canvas.setDimensions({ width: newWidth, height: newHeight })
    canvas.renderAll()
    updateRulers()
  }, [canvas, machineProfile])

  // Handle zoom changes (without recreating canvas)
  useEffect(() => {
    if (!canvas) return
    
    canvas.setZoom(zoom)
    canvas.renderAll()
    updateRulers()
  }, [canvas, zoom])

  // Handle grid display
  useEffect(() => {
    if (!canvas) return
    
    if (showGrid) {
      drawGrid()
    } else {
      removeGrid()
    }
  }, [canvas, showGrid, gridSize, zoom])

  const drawGrid = () => {
    if (!canvas) return
    
    removeGrid() // Remove existing grid first
    
    const gridSpacing = gridSize * zoom
    const canvasWidth = canvas.getWidth()
    const canvasHeight = canvas.getHeight()

    // Create vertical lines
    for (let x = 0; x <= canvasWidth; x += gridSpacing) {
      const line = new fabric.Line([x, 0, x, canvasHeight], {
        stroke: '#ddd',
        strokeWidth: 0.5,
        selectable: false,
        evented: false,
        excludeFromExport: true,
        isGrid: true
      })
      canvas.add(line)
      canvas.sendObjectToBack(line)
    }

    // Create horizontal lines
    for (let y = 0; y <= canvasHeight; y += gridSpacing) {
      const line = new fabric.Line([0, y, canvasWidth, y], {
        stroke: '#ddd',
        strokeWidth: 0.5,
        selectable: false,
        evented: false,
        excludeFromExport: true,
        isGrid: true
      })
      canvas.add(line)
      canvas.sendObjectToBack(line)
    }
    
    canvas.renderAll()
  }

  const removeGrid = () => {
    if (!canvas) return
    
    const gridLines = canvas.getObjects().filter(obj => obj.isGrid)
    gridLines.forEach(line => canvas.remove(line))
    canvas.renderAll()
  }

  // Tool handlers
  const handleToolChange = (tool) => {
    setActiveTool(tool)
    
    if (tool === 'select') {
      canvas.isDrawingMode = false
      canvas.selection = true
    } else if (tool === 'draw') {
      canvas.isDrawingMode = true
      canvas.freeDrawingBrush.width = 2
      canvas.freeDrawingBrush.color = '#ffffff'
      canvas.selection = false
    } else {
      canvas.isDrawingMode = false
      canvas.selection = false
    }
  }

  // Drawing tool functions
  const addRectangle = () => {
    const rect = new fabric.Rect({
      left: 100,
      top: 100,
      width: 100,
      height: 60,
      fill: 'transparent',
      stroke: '#ffffff',
      strokeWidth: 2
    })
    canvas.add(rect)
    canvas.setActiveObject(rect)
    canvas.renderAll()
  }

  const addCircle = () => {
    const circle = new fabric.Circle({
      left: 150,
      top: 150,
      radius: 50,
      fill: 'transparent',
      stroke: '#ffffff',
      strokeWidth: 2
    })
    canvas.add(circle)
    canvas.setActiveObject(circle)
    canvas.renderAll()
  }

  const addLine = () => {
    const line = new fabric.Line([50, 50, 200, 150], {
      stroke: '#ffffff',
      strokeWidth: 2
    })
    canvas.add(line)
    canvas.setActiveObject(line)
    canvas.renderAll()
  }

  const deleteSelected = () => {
    const activeObjects = canvas.getActiveObjects()
    if (activeObjects.length > 0) {
      activeObjects.forEach(obj => canvas.remove(obj))
      canvas.discardActiveObject()
      canvas.renderAll()
    }
  }

  const clearCanvas = () => {
    canvas.clear()
    if (showGrid) {
      drawGrid()
    }
  }

  const handleZoomIn = () => {
    const newZoom = Math.min(zoom * 1.2, 5)
    setZoom(newZoom)
  }

  const handleZoomOut = () => {
    const newZoom = Math.max(zoom / 1.2, 0.1)
    setZoom(newZoom)
    canvas.setZoom(newZoom)
    updateRulers()
    canvas.renderAll()
  }

  // Update rulers based on current scroll position and zoom
  const updateRulers = () => {
    if (!hRulerRef.current || !vRulerRef.current || !scrollContainerRef.current) return
    
    const scrollLeft = scrollContainerRef.current.scrollLeft
    const scrollTop = scrollContainerRef.current.scrollTop
    
    // Clear existing ruler content
    hRulerRef.current.innerHTML = ''
    vRulerRef.current.innerHTML = ''
    
    // Create ruler marks based on mm units
    const mmStep = Math.max(10, 50 / zoom) // mm step size
    const rulerHeight = 20
    const rulerWidth = 20
    
    // Horizontal ruler
    const hRulerCanvas = document.createElement('canvas')
    hRulerCanvas.width = machineProfile.bedSizeX * machineProfile.mmToPx * zoom
    hRulerCanvas.height = rulerHeight
    hRulerCanvas.style.position = 'absolute'
    hRulerCanvas.style.left = `-${scrollLeft}px`
    hRulerCanvas.style.backgroundColor = '#2b2b2b'
    
    const hCtx = hRulerCanvas.getContext('2d')
    hCtx.fillStyle = 'white'
    hCtx.strokeStyle = 'white'
    hCtx.font = '10px Arial'
    
    for (let i = 0; i <= machineProfile.bedSizeX; i += mmStep) {
      const x = i * machineProfile.mmToPx * zoom
      hCtx.beginPath()
      hCtx.moveTo(x, rulerHeight - 5)
      hCtx.lineTo(x, rulerHeight)
      hCtx.stroke()
      
      if (i % (mmStep * 2) === 0) {
        hCtx.fillText(i.toString() + 'mm', x + 2, rulerHeight - 8)
      }
    }
    
    hRulerRef.current.appendChild(hRulerCanvas)
    
    // Vertical ruler
    const vRulerCanvas = document.createElement('canvas')
    vRulerCanvas.width = rulerWidth
    vRulerCanvas.height = machineProfile.bedSizeY * machineProfile.mmToPx * zoom
    vRulerCanvas.style.position = 'absolute'
    vRulerCanvas.style.top = `-${scrollTop}px`
    vRulerCanvas.style.backgroundColor = '#2b2b2b'
    
    const vCtx = vRulerCanvas.getContext('2d')
    vCtx.fillStyle = 'white'
    vCtx.strokeStyle = 'white'
    vCtx.font = '10px Arial'
    
    for (let i = 0; i <= machineProfile.bedSizeY; i += mmStep) {
      const y = i * machineProfile.mmToPx * zoom
      vCtx.beginPath()
      vCtx.moveTo(rulerWidth - 5, y)
      vCtx.lineTo(rulerWidth, y)
      vCtx.stroke()
      
      if (i % (mmStep * 2) === 0) {
        vCtx.save()
        vCtx.translate(rulerWidth - 15, y + 2)
        vCtx.rotate(-Math.PI / 2)
        vCtx.fillText(i.toString() + 'mm', 0, 0)
        vCtx.restore()
      }
    }
    
    vRulerRef.current.appendChild(vRulerCanvas)
  }

  return (
    <div className="cad-interface">
      {/* Top Menu Bar */}
      <div className="top-menu">
        <div className="menu-left">
          <h2>MECHANICUS CAD v0.1</h2>
        </div>
        <div className="menu-center">
          <button onClick={clearCanvas}>New</button>
          <button>Open</button>
          <button>Save</button>
          <button>Export SVG</button>
          <button onClick={() => {
            const gcode = generateGcode()
            if (gcode) {
              const blob = new Blob([gcode], { type: 'text/plain' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = 'mechanicus_output.gcode'
              a.click()
              URL.revokeObjectURL(url)
            }
          }}>Export G-Code</button>
          <select 
            value={`${zoom * 100}%`}
            onChange={(e) => {
              const newZoom = parseFloat(e.target.value) / 100
              setZoom(newZoom)
              if (canvas) {
                canvas.setZoom(newZoom)
                updateRulers()
                canvas.renderAll()
              }
            }}
            className="zoom-select"
          >
            <option value="25%">25%</option>
            <option value="50%">50%</option>
            <option value="75%">75%</option>
            <option value="100%">100%</option>
            <option value="125%">125%</option>
            <option value="150%">150%</option>
            <option value="200%">200%</option>
          </select>
        </div>
        <div className="menu-right">
          <span>Machine: {machineProfile.name} ({machineProfile.bedSizeX}x{machineProfile.bedSizeY}mm)</span>
          <span>User: {user?.username}</span>
          <button onClick={logout}>Logout</button>
        </div>
      </div>

      <div className="cad-content">
        {/* Left Toolbar */}
        <div className="left-toolbar">
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
              Grid Size:
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

        {/* Viewport with Rulers */}
        <div className="viewport">
          {/* Horizontal Ruler */}
          <div className="h-ruler" ref={hRulerRef}></div>
          
          <div className="viewport-main">
            {/* Vertical Ruler */}
            <div className="v-ruler" ref={vRulerRef}></div>
            
            {/* Scrollable Canvas Area */}
            <div className="canvas-scroll-container" 
                 ref={scrollContainerRef}
                 onScroll={updateRulers}>
              <div className="canvas-container" style={{
                width: `${machineProfile.bedSizeX * machineProfile.mmToPx}px`,
                height: `${machineProfile.bedSizeY * machineProfile.mmToPx}px`,
                position: 'relative',
                backgroundColor: 'white',
                border: '2px solid #ccc'
              }}>
                <canvas 
                  ref={canvasRef}
 
                  className="cad-canvas"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Panels */}
        <div className="right-panels">
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