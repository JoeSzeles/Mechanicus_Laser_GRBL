import { useState, useEffect, useRef, useContext } from 'react'
import * as fabric from 'fabric'
import AuthContext from '../contexts/AuthContext'
import Toolbar from './Toolbar'
import LayerPanel from './LayerPanel'
import PropertiesPanel from './PropertiesPanel'
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
        </div>
      </div>
    </div>
  )
}

export default CADInterface