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
  const [canvas, setCanvas] = useState(null)
  const [activeTool, setActiveTool] = useState('select')
  const [showGrid, setShowGrid] = useState(true)
  const [gridSize, setGridSize] = useState(10)
  const [snapToGrid, setSnapToGrid] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [selectedObjects, setSelectedObjects] = useState([])
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

  // Initialize Fabric.js canvas
  useEffect(() => {
    if (!canvasRef.current) return

    const fabricCanvas = new fabric.Canvas(canvasRef.current, {
      width: 800,
      height: 600,
      backgroundColor: '#1a1a1a',
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

    // Cleanup on unmount
    return () => {
      fabricCanvas.dispose()
    }
  }, [])

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
        stroke: '#333',
        strokeWidth: 0.5,
        selectable: false,
        evented: false,
        excludeFromExport: true,
        isGrid: true
      })
      canvas.add(line)
      canvas.sendToBack(line)
    }

    // Create horizontal lines
    for (let y = 0; y <= canvasHeight; y += gridSpacing) {
      const line = new fabric.Line([0, y, canvasWidth, y], {
        stroke: '#333',
        strokeWidth: 0.5,
        selectable: false,
        evented: false,
        excludeFromExport: true,
        isGrid: true
      })
      canvas.add(line)
      canvas.sendToBack(line)
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
    canvas.setZoom(newZoom)
    canvas.renderAll()
  }

  const handleZoomOut = () => {
    const newZoom = Math.max(zoom / 1.2, 0.1)
    setZoom(newZoom)
    canvas.setZoom(newZoom)
    canvas.renderAll()
  }

  return (
    <div className="cad-interface">
      {/* Top Menu Bar */}
      <div className="top-menu">
        <div className="menu-left">
          <h2>MECHANICUS CAD</h2>
        </div>
        <div className="menu-center">
          <button onClick={clearCanvas}>New</button>
          <button>Open</button>
          <button>Save</button>
          <button>Export SVG</button>
          <button>Generate G-Code</button>
        </div>
        <div className="menu-right">
          <span>User: {user?.username}</span>
          <button onClick={logout}>Logout</button>
        </div>
      </div>

      <div className="cad-content">
        {/* Left Toolbar */}
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

        {/* Main Canvas Area */}
        <div className="canvas-container">
          <div className="canvas-controls">
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
                min="5"
                max="50"
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
          
          <div className="canvas-wrapper">
            <canvas ref={canvasRef} />
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