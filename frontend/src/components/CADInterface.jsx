import { useState, useRef, useEffect, useContext } from 'react'
import { Stage, Layer, Line, Rect } from 'react-konva'
import AuthContext from '../contexts/AuthContext'
import useCadStore from '../store/cadStore'
import PopupWindow from './PopupWindow'
import DrawingToolsWindow from './DrawingToolsWindow'
import SnapToolsWindow from './SnapToolsWindow'
import './CADInterface.css'

function CADInterface() {
  const { user, logout } = useContext(AuthContext)
  const machineProfile = useCadStore((state) => state.machineProfile)
  const viewport = useCadStore((state) => state.viewport)
  const updateViewport = useCadStore((state) => state.updateViewport)
  
  const [showDrawingTools, setShowDrawingTools] = useState(true)
  const [showSnapTools, setShowSnapTools] = useState(true)
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 })
  const [gridSize, setGridSize] = useState(10)
  const [showGrid, setShowGrid] = useState(true)
  
  const containerRef = useRef(null)
  const stageRef = useRef(null)
  const hRulerRef = useRef(null)
  const vRulerRef = useRef(null)
  const spaceKeyPressed = useRef(false)

  const canvasWidth = machineProfile.bedSizeX * machineProfile.mmToPx
  const canvasHeight = machineProfile.bedSizeY * machineProfile.mmToPx

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setContainerSize({ width: rect.width - 25, height: rect.height - 25 })
      }
    }
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  useEffect(() => {
    updateRulers()
  }, [viewport, containerSize])

  const handleWheel = (e) => {
    e.evt.preventDefault()
    const stage = stageRef.current
    if (!stage) return

    const oldScale = viewport.zoom
    const pointer = stage.getPointerPosition()
    
    const mousePointTo = {
      x: (pointer.x - viewport.pan.x) / oldScale,
      y: (pointer.y - viewport.pan.y) / oldScale
    }

    const newScale = e.evt.deltaY < 0 ? oldScale * 1.1 : oldScale / 1.1
    const clampedScale = Math.max(0.1, Math.min(5, newScale))

    const newPos = {
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale
    }

    updateViewport({ zoom: clampedScale, pan: newPos })
  }

  const handleMouseDown = (e) => {
    if (e.evt.button === 0 && spaceKeyPressed.current) {
      setIsPanning(true)
      setPanStart({ x: e.evt.clientX - viewport.pan.x, y: e.evt.clientY - viewport.pan.y })
    }
  }

  const handleMouseMove = (e) => {
    if (isPanning) {
      const newPan = {
        x: e.evt.clientX - panStart.x,
        y: e.evt.clientY - panStart.y
      }
      updateViewport({ pan: newPan })
    }
  }

  const handleMouseUp = () => {
    setIsPanning(false)
  }

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space') {
        e.preventDefault()
        spaceKeyPressed.current = true
      }
    }

    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        spaceKeyPressed.current = false
        setIsPanning(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  const drawGrid = () => {
    if (!showGrid) return []
    
    const lines = []
    const gridSpacing = gridSize * machineProfile.mmToPx
    
    for (let x = 0; x <= canvasWidth; x += gridSpacing) {
      lines.push(
        <Line
          key={`v-${x}`}
          points={[x, 0, x, canvasHeight]}
          stroke="#808080"
          strokeWidth={0.5}
          listening={false}
        />
      )
    }
    
    for (let y = 0; y <= canvasHeight; y += gridSpacing) {
      lines.push(
        <Line
          key={`h-${y}`}
          points={[0, y, canvasWidth, y]}
          stroke="#808080"
          strokeWidth={0.5}
          listening={false}
        />
      )
    }
    
    return lines
  }

  const updateRulers = () => {
    if (!hRulerRef.current || !vRulerRef.current) return

    const rulerHeight = 25
    const rulerWidth = 25

    const hRulerCanvas = document.createElement('canvas')
    hRulerCanvas.width = containerSize.width
    hRulerCanvas.height = rulerHeight
    const hCtx = hRulerCanvas.getContext('2d')
    
    hCtx.fillStyle = '#f0f0f0'
    hCtx.fillRect(0, 0, hRulerCanvas.width, rulerHeight)
    hCtx.strokeStyle = '#666'
    hCtx.fillStyle = '#333'
    hCtx.font = '10px Arial'

    const mmStep = Math.max(5, 50 / viewport.zoom)
    const startMM = Math.floor((-viewport.pan.x / viewport.zoom / machineProfile.mmToPx) / mmStep) * mmStep
    const endMM = startMM + (containerSize.width / viewport.zoom / machineProfile.mmToPx)
    
    for (let mmPos = startMM; mmPos <= endMM; mmPos += mmStep) {
      if (mmPos < 0 || mmPos > machineProfile.bedSizeX) continue
      
      const x = (mmPos * machineProfile.mmToPx * viewport.zoom) + viewport.pan.x
      hCtx.beginPath()
      hCtx.moveTo(x, rulerHeight - 8)
      hCtx.lineTo(x, rulerHeight)
      hCtx.stroke()
      
      if (mmPos % (mmStep * 2) === 0) {
        hCtx.fillText(mmPos.toFixed(0) + 'mm', x + 2, rulerHeight - 12)
      }
    }

    const vRulerCanvas = document.createElement('canvas')
    vRulerCanvas.width = rulerWidth
    vRulerCanvas.height = containerSize.height
    const vCtx = vRulerCanvas.getContext('2d')
    
    vCtx.fillStyle = '#f0f0f0'
    vCtx.fillRect(0, 0, rulerWidth, vRulerCanvas.height)
    vCtx.strokeStyle = '#666'
    vCtx.fillStyle = '#333'
    vCtx.font = '10px Arial'

    const startMMY = Math.floor((-viewport.pan.y / viewport.zoom / machineProfile.mmToPx) / mmStep) * mmStep
    const endMMY = startMMY + (containerSize.height / viewport.zoom / machineProfile.mmToPx)
    
    for (let mmPos = startMMY; mmPos <= endMMY; mmPos += mmStep) {
      if (mmPos < 0 || mmPos > machineProfile.bedSizeY) continue
      
      const y = (mmPos * machineProfile.mmToPx * viewport.zoom) + viewport.pan.y
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

    hRulerRef.current.innerHTML = ''
    hRulerRef.current.appendChild(hRulerCanvas)
    
    vRulerRef.current.innerHTML = ''
    vRulerRef.current.appendChild(vRulerCanvas)
  }

  const handleZoomIn = () => {
    const newZoom = Math.min(viewport.zoom * 1.2, 5)
    updateViewport({ zoom: newZoom })
  }

  const handleZoomOut = () => {
    const newZoom = Math.max(viewport.zoom * 0.8, 0.1)
    updateViewport({ zoom: newZoom })
  }

  const handleZoomReset = () => {
    updateViewport({ zoom: 1, pan: { x: 0, y: 0 } })
  }

  return (
    <div className="cad-interface">
      <div className="top-menu">
        <div className="menu-left">
          <h2>Mechanicus CAD - {machineProfile.bedSizeX}x{machineProfile.bedSizeY}mm</h2>
        </div>
        <div className="menu-center">
          <button onClick={() => setShowDrawingTools(!showDrawingTools)}>
            {showDrawingTools ? 'Hide' : 'Show'} Drawing Tools
          </button>
          <button onClick={() => setShowSnapTools(!showSnapTools)}>
            {showSnapTools ? 'Hide' : 'Show'} Snap Tools
          </button>
          <button onClick={handleZoomIn}>Zoom In</button>
          <button onClick={handleZoomOut}>Zoom Out</button>
          <button onClick={handleZoomReset}>Reset Zoom ({Math.round(viewport.zoom * 100)}%)</button>
        </div>
        <div className="menu-right">
          <span>User: {user?.email}</span>
          <button onClick={logout}>Logout</button>
        </div>
      </div>

      <div className="main-workspace">
        <div className="toolbar-panel">
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
                className="grid-input"
                min="1"
                max="100"
              />
            </label>
          </div>
        </div>

        <div className="canvas-viewport" ref={containerRef}>
          <div className="h-ruler" ref={hRulerRef}></div>
          <div className="canvas-workspace">
            <div className="v-ruler" ref={vRulerRef}></div>
            <div className="canvas-container">
              <Stage
                ref={stageRef}
                width={containerSize.width}
                height={containerSize.height}
                scaleX={viewport.zoom}
                scaleY={viewport.zoom}
                x={viewport.pan.x}
                y={viewport.pan.y}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                style={{ backgroundColor: '#263d42' }}
              >
                <Layer>
                  <Rect
                    x={0}
                    y={0}
                    width={canvasWidth}
                    height={canvasHeight}
                    fill="white"
                  />
                  {drawGrid()}
                </Layer>
              </Stage>
            </div>
          </div>
        </div>
      </div>

      <PopupWindow
        title="Drawing Tools"
        isOpen={showDrawingTools}
        onClose={() => setShowDrawingTools(false)}
        defaultPosition={{ x: 50, y: 100 }}
      >
        <DrawingToolsWindow />
      </PopupWindow>

      <PopupWindow
        title="Snap Tools"
        isOpen={showSnapTools}
        onClose={() => setShowSnapTools(false)}
        defaultPosition={{ x: 50, y: 320 }}
      >
        <SnapToolsWindow />
      </PopupWindow>
    </div>
  )
}

export default CADInterface
