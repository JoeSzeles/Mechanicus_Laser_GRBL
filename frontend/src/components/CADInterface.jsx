import React, { useState, useRef, useEffect, useContext } from 'react'
import { Stage, Layer, Line, Rect, Circle, Text, RegularPolygon, Arc, Wedge } from 'react-konva'
import AuthContext from '../contexts/AuthContext'
import useCadStore from '../store/cadStore'
import DrawingToolsWindow from './DrawingToolsWindow'
import SnapToolsWindow from './SnapToolsWindow'
import MarkersWindow from './MarkersWindow'
import TransformToolsWindow from './TransformToolsWindow'
import LineEditorToolsWindow from './LineEditorToolsWindow'
import ShapePropertiesWindow from './ShapePropertiesWindow'
import TextFontToolsWindow from './TextFontToolsWindow'
import LayersWindow from './LayersWindow'
import { findSnapPoint, updateSpatialIndex, SNAP_COLORS } from '../utils/snapEngine'
import { findLineIntersection } from '../utils/lineEditorUtils'
import { exportToSVG, downloadSVG, importFromSVG } from '../utils/svgUtils'
import ToolButton from './ToolButton'
import {
  ImportIcon, ExportIcon, UndoIcon, RedoIcon,
  DrawingToolsIcon, SnapToolsIcon, MarkersIcon, TransformIcon,
  LineEditorIcon, ShapePropertiesIcon, TextToolsIcon, LayersIcon,
  UserIcon, LogoutIcon
} from './ToolIcons'
import MenuBar from './MenuBar'
import FloatingPanel from './FloatingPanel'
import './CADInterface.css'

function CADInterface() {
  const { user, logout } = useContext(AuthContext)
  const machineProfile = useCadStore((state) => state.machineProfile)
  const viewport = useCadStore((state) => state.viewport)
  const updateViewport = useCadStore((state) => state.updateViewport)
  const shapes = useCadStore((state) => state.shapes)
  const snap = useCadStore((state) => state.snap)
  const activeTool = useCadStore((state) => state.activeTool)
  const setActiveTool = useCadStore((state) => state.setActiveTool)
  const addShape = useCadStore((state) => state.addShape)
  const addShapeWithUndo = useCadStore((state) => state.addShapeWithUndo)
  const removeShape = useCadStore((state) => state.removeShape)
  const removeShapeWithUndo = useCadStore((state) => state.removeShapeWithUndo)
  const updateShapeWithUndo = useCadStore((state) => state.updateShapeWithUndo)
  const markers = useCadStore((state) => state.markers)
  const guides = useCadStore((state) => state.guides)
  const markersVisible = useCadStore((state) => state.markersVisible)
  const guidesVisible = useCadStore((state) => state.guidesVisible)
  const guidesLocked = useCadStore((state) => state.guidesLocked)
  const markerSnapEnabled = useCadStore((state) => state.markerSnapEnabled)
  const addMarker = useCadStore((state) => state.addMarker)
  const updateGuide = useCadStore((state) => state.updateGuide)
  const selectedShapeId = useCadStore((state) => state.selectedShapeId)
  const setSelectedShapeId = useCadStore((state) => state.setSelectedShapeId)
  const updateShape = useCadStore((state) => state.updateShape)
  const layers = useCadStore((state) => state.layers)
  const setLayers = useCadStore((state) => state.setLayers)
  const setShapes = useCadStore((state) => state.setShapes)
  const lineEditorState = useCadStore((state) => state.lineEditorState)
  const setLineEditorState = useCadStore((state) => state.setLineEditorState)
  const updateLineEditorState = useCadStore((state) => state.updateLineEditorState)
  const undoStack = useCadStore((state) => state.undoStack)
  const redoStack = useCadStore((state) => state.redoStack)
  const undo = useCadStore((state) => state.undo)
  const redo = useCadStore((state) => state.redo)
  
  useEffect(() => {
    if (typeof updateLineEditorState !== 'function') {
      console.error('🚨 CRITICAL: updateLineEditorState is NOT a function!', typeof updateLineEditorState)
    } else {
      console.log('✅ updateLineEditorState is available')
    }
  }, [])
  
  const [showDrawingTools, setShowDrawingTools] = useState(true)
  const [showSnapTools, setShowSnapTools] = useState(false)
  const [showMarkersWindow, setShowMarkersWindow] = useState(false)
  const [showTransformTools, setShowTransformTools] = useState(false)
  const [showLineEditorTools, setShowLineEditorTools] = useState(false)
  const [showShapeProperties, setShowShapeProperties] = useState(true)
  const [showTextTools, setShowTextTools] = useState(false)
  const [showLayers, setShowLayers] = useState(true)
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 })
  const [gridSize, setGridSize] = useState(10)
  const [showGrid, setShowGrid] = useState(true)
  const [gridSnap, setGridSnap] = useState(false)
  const [snapIndicator, setSnapIndicator] = useState(null)
  const [drawingState, setDrawingState] = useState(null)
  const [previewShape, setPreviewShape] = useState(null)
  const [markerState, setMarkerState] = useState(null)
  const [draggedGuide, setDraggedGuide] = useState(null)
  const [draggedHandle, setDraggedHandle] = useState(null)
  const [initialBbox, setInitialBbox] = useState(null)
  const [mirrorAxisSelectionCallback, setMirrorAxisSelectionCallback] = useState(null)
  const [mirrorAxisLineId, setMirrorAxisLineId] = useState(null)
  const [hoveredShapeId, setHoveredShapeId] = useState(null)
  const [adjustLineState, setAdjustLineState] = useState(null)
  const [trimPreviewLines, setTrimPreviewLines] = useState([])
  const [selectionRect, setSelectionRect] = useState(null)
  const [selectedShapeIds, setSelectedShapeIds] = useState([])
  
  const [panelPositions, setPanelPositions] = useState(() => {
    const defaultPositions = {}
    const panels = [
      'drawingTools',
      'layers',
      'shapeProperties',
      'snapTools',
      'markersGuides',
      'transformTools',
      'lineEditorTools',
      'textTools'
    ]
    
    const PANEL_WIDTH = 320
    const START_Y = 80
    const SPACING = 40
    const viewportWidth = window.innerWidth
    
    let currentY = START_Y
    let currentColumn = 0
    
    panels.forEach((panelId, index) => {
      defaultPositions[panelId] = {
        x: viewportWidth - PANEL_WIDTH - 20 - (currentColumn * (PANEL_WIDTH + 20)),
        y: currentY,
        zIndex: 10 + index
      }
      
      currentY += SPACING
      if (currentY > 500) {
        currentColumn++
        currentY = START_Y
      }
    })
    
    return defaultPositions
  })
  const [topZIndex, setTopZIndex] = useState(50)
  
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
    const handleResize = () => {
      const PANEL_WIDTH = 320
      const MIN_VISIBLE = 100
      
      setPanelPositions(prev => {
        const updated = {}
        Object.keys(prev).forEach(panelId => {
          const pos = prev[panelId]
          updated[panelId] = {
            ...pos,
            x: Math.max(MIN_VISIBLE - PANEL_WIDTH, Math.min(pos.x, window.innerWidth - MIN_VISIBLE)),
            y: Math.max(0, pos.y)
          }
        })
        return updated
      })
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    updateRulers()
  }, [viewport, containerSize])

  useEffect(() => {
    updateSpatialIndex(shapes)
  }, [shapes])

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'Escape') {
        setActiveTool(null)
        setDrawingState(null)
        setMarkerState(null)
        setMirrorAxisSelectionCallback(null)
        setMirrorAxisLineId(null)
        setTrimPreviewLines([])
        
        if (lineEditorState) {
          const selectedLines = lineEditorState.selectedLines || []
          selectedLines.forEach(id => {
            const shape = shapes.find(s => s.id === id)
            if (shape && shape.originalStroke) {
              updateShape(id, {
                stroke: shape.originalStroke,
                strokeWidth: shape.originalStrokeWidth,
                originalStroke: undefined,
                originalStrokeWidth: undefined
              })
            }
          })
          setLineEditorState({ selectedLines: [], currentTool: null })
        }
        
        const shapePropertiesState = useCadStore.getState().shapePropertiesState
        if (shapePropertiesState?.selectedShapeId) {
          const shape = shapes.find(s => s.id === shapePropertiesState.selectedShapeId)
          if (shape && shape.originalStroke !== undefined) {
            updateShape(shapePropertiesState.selectedShapeId, {
              stroke: shape.originalStroke,
              strokeWidth: shape.originalStrokeWidth,
              originalStroke: undefined,
              originalStrokeWidth: undefined
            })
          }
          const setShapePropertiesState = useCadStore.getState().setShapePropertiesState
          setShapePropertiesState(null)
        }
        
        const textToolState = useCadStore.getState().textToolState
        if (textToolState?.selectedTextId) {
          const text = shapes.find(s => s.id === textToolState.selectedTextId)
          if (text && text.originalStroke !== undefined) {
            updateShape(textToolState.selectedTextId, {
              stroke: text.originalStroke,
              strokeWidth: text.originalStrokeWidth,
              originalStroke: undefined,
              originalStrokeWidth: undefined
            })
          }
          const setTextToolState = useCadStore.getState().setTextToolState
          setTextToolState(null)
        }
      } else if (e.key === 'Delete' || e.key === 'Del') {
        if (selectedShapeIds.length > 0) {
          selectedShapeIds.forEach(id => {
            removeShapeWithUndo(id)
          })
          setSelectedShapeIds([])
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
        e.preventDefault()
        redo()
      }
    }
    
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [lineEditorState, shapes, selectedShapeIds, setActiveTool, updateShape, setLineEditorState, removeShape])

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

  const getWorldPoint = (e, enableSnap = true) => {
    const stage = stageRef.current
    if (!stage) return { x: 0, y: 0 }
    
    const point = stage.getPointerPosition()
    let worldX = (point.x - viewport.pan.x) / viewport.zoom
    let worldY = (point.y - viewport.pan.y) / viewport.zoom
    
    if (enableSnap) {
      const gridSpacing = gridSize * machineProfile.mmToPx
      const snapResult = findSnapPoint(worldX, worldY, viewport.zoom, snap, gridSpacing, showGrid)
      
      if (snapResult) {
        worldX = snapResult.x
        worldY = snapResult.y
      }
    }
    
    return { x: worldX, y: worldY }
  }

  const handleMouseDown = (e) => {
    if ((e.evt.button === 0 && spaceKeyPressed.current) || e.evt.button === 1) {
      e.evt.preventDefault()
      setIsPanning(true)
      setPanStart({ x: e.evt.clientX - viewport.pan.x, y: e.evt.clientY - viewport.pan.y })
      return
    }
    
    const clickedOnEmpty = e.target === e.target.getStage()
    if (clickedOnEmpty && e.evt.button === 0) {
      setSelectedShapeId(null)
      setSelectedShapeIds([])
      if (showLineEditorTools && lineEditorState) {
        const selectedLines = lineEditorState.selectedLines || []
        selectedLines.forEach(id => {
          const shape = shapes.find(s => s.id === id)
          if (shape && shape.originalStroke) {
            updateShape(id, {
              stroke: shape.originalStroke,
              strokeWidth: shape.originalStrokeWidth
            })
          }
        })
        updateLineEditorState({
          selectedLines: [],
          trimState: lineEditorState.currentTool === 'trim' ? 'first_line' : lineEditorState.trimState,
          extendState: lineEditorState.currentTool === 'extend' ? 'select_boundary' : lineEditorState.extendState,
          trimMidState: lineEditorState.currentTool === 'trimMid' ? 'first_line' : lineEditorState.trimMidState,
          boundaryLines: []
        })
      }
      setTrimPreviewLines([])
      
      if (!activeTool && !showLineEditorTools) {
        const point = getWorldPoint(e, false)
        setSelectionRect({ x: point.x, y: point.y, width: 0, height: 0 })
      }
    }
    
    if (lineEditorState?.currentTool === 'adjustLine' && e.evt.button === 0) {
      const point = getWorldPoint(e)
      const tolerance = 15 / viewport.zoom
      
      for (const shape of shapes) {
        if (shape.type === 'line') {
          const distToStart = Math.sqrt((point.x - shape.x1)**2 + (point.y - shape.y1)**2)
          const distToEnd = Math.sqrt((point.x - shape.x2)**2 + (point.y - shape.y2)**2)
          
          if (distToStart < tolerance) {
            setAdjustLineState({
              shapeId: shape.id,
              endpoint: 'start'
            })
            updateShape(shape.id, {
              originalStroke: shape.stroke,
              originalStrokeWidth: shape.strokeWidth,
              stroke: '#FF0000',
              strokeWidth: 2
            })
            return
          } else if (distToEnd < tolerance) {
            setAdjustLineState({
              shapeId: shape.id,
              endpoint: 'end'
            })
            updateShape(shape.id, {
              originalStroke: shape.stroke,
              originalStrokeWidth: shape.strokeWidth,
              stroke: '#FF0000',
              strokeWidth: 2
            })
            return
          }
        }
      }
      return
    }
    
    if (guidesVisible && !guidesLocked && e.evt.button === 0) {
      const point = getWorldPoint(e)
      const threshold = 10 / viewport.zoom
      
      for (const guide of guides) {
        if (guide.type === 'horizontal' && Math.abs(point.y - guide.position) < threshold) {
          setDraggedGuide(guide.id)
          return
        } else if (guide.type === 'vertical' && Math.abs(point.x - guide.position) < threshold) {
          setDraggedGuide(guide.id)
          return
        }
      }
    }
    
    if (activeTool && e.evt.button === 0) {
      const point = getWorldPoint(e)
      
      if (activeTool === 'line') {
        setDrawingState({ tool: 'line', startX: point.x, startY: point.y })
      } else if (activeTool === 'circle') {
        setDrawingState({ tool: 'circle', centerX: point.x, centerY: point.y })
      } else if (activeTool === 'rectangle') {
        setDrawingState({ tool: 'rectangle', startX: point.x, startY: point.y })
      } else if (activeTool === 'polygon') {
        setDrawingState({ tool: 'polygon', centerX: point.x, centerY: point.y })
      } else if (activeTool === 'arc') {
        setDrawingState({ tool: 'arc', centerX: point.x, centerY: point.y })
      } else if (activeTool === 'freehand') {
        setDrawingState({ tool: 'freehand', points: [point.x, point.y] })
      } else if (activeTool === 'centerPoint') {
        const markerPoint = getWorldPoint(e, markerSnapEnabled)
        addMarker({
          id: `marker-${Date.now()}`,
          type: 'centerPoint',
          x: markerPoint.x,
          y: markerPoint.y
        })
        setActiveTool(null)
      } else if (activeTool === 'lineMarker') {
        if (!markerState) {
          const markerPoint = getWorldPoint(e, markerSnapEnabled)
          setMarkerState({ tool: 'lineMarker', startX: markerPoint.x, startY: markerPoint.y })
        }
      }
    }
  }

  const handleMouseMove = (e) => {
    if (isPanning) {
      const newPan = {
        x: e.evt.clientX - panStart.x,
        y: e.evt.clientY - panStart.y
      }
      updateViewport({ pan: newPan })
      return
    }
    
    if (selectionRect) {
      const point = getWorldPoint(e, false)
      const x = Math.min(selectionRect.x, point.x)
      const y = Math.min(selectionRect.y, point.y)
      const width = Math.abs(point.x - selectionRect.x)
      const height = Math.abs(point.y - selectionRect.y)
      setSelectionRect({ x, y, width, height })
      return
    }
    
    if (adjustLineState) {
      const point = getWorldPoint(e)
      const shape = shapes.find(s => s.id === adjustLineState.shapeId)
      if (shape) {
        if (adjustLineState.endpoint === 'start') {
          updateShape(shape.id, {
            x1: point.x,
            y1: point.y
          })
        } else {
          updateShape(shape.id, {
            x2: point.x,
            y2: point.y
          })
        }
      }
      return
    }
    
    if (draggedGuide) {
      const point = getWorldPoint(e)
      const guide = guides.find(g => g.id === draggedGuide)
      if (guide) {
        updateGuide(draggedGuide, {
          position: guide.type === 'horizontal' ? point.y : point.x
        })
      }
      return
    }
    
    const stage = stageRef.current
    if (!stage) return
    
    const point = stage.getPointerPosition()
    const worldX = (point.x - viewport.pan.x) / viewport.zoom
    const worldY = (point.y - viewport.pan.y) / viewport.zoom
    
    const gridSpacing = gridSize * machineProfile.mmToPx
    const snapResult = findSnapPoint(worldX, worldY, viewport.zoom, snap, gridSpacing, showGrid)
    
    setSnapIndicator(snapResult)
    
    if (drawingState) {
      const currentPoint = getWorldPoint(e)
      
      if (drawingState.tool === 'line') {
        setPreviewShape({
          type: 'line',
          x1: drawingState.startX,
          y1: drawingState.startY,
          x2: currentPoint.x,
          y2: currentPoint.y
        })
      } else if (drawingState.tool === 'circle') {
        const radius = Math.sqrt(
          Math.pow(currentPoint.x - drawingState.centerX, 2) +
          Math.pow(currentPoint.y - drawingState.centerY, 2)
        )
        setPreviewShape({
          type: 'circle',
          x: drawingState.centerX,
          y: drawingState.centerY,
          radius
        })
      } else if (drawingState.tool === 'rectangle') {
        setPreviewShape({
          type: 'rectangle',
          x: Math.min(drawingState.startX, currentPoint.x),
          y: Math.min(drawingState.startY, currentPoint.y),
          width: Math.abs(currentPoint.x - drawingState.startX),
          height: Math.abs(currentPoint.y - drawingState.startY)
        })
      } else if (drawingState.tool === 'polygon') {
        const radius = Math.sqrt(
          Math.pow(currentPoint.x - drawingState.centerX, 2) +
          Math.pow(currentPoint.y - drawingState.centerY, 2)
        )
        setPreviewShape({
          type: 'polygon',
          x: drawingState.centerX,
          y: drawingState.centerY,
          radius
        })
      } else if (drawingState.tool === 'arc') {
        const radius = Math.sqrt(
          Math.pow(currentPoint.x - drawingState.centerX, 2) +
          Math.pow(currentPoint.y - drawingState.centerY, 2)
        )
        setPreviewShape({
          type: 'arc',
          x: drawingState.centerX,
          y: drawingState.centerY,
          radius
        })
      } else if (drawingState.tool === 'freehand') {
        setDrawingState({
          ...drawingState,
          points: [...drawingState.points, currentPoint.x, currentPoint.y]
        })
        setPreviewShape({
          type: 'freehand',
          points: [...drawingState.points, currentPoint.x, currentPoint.y]
        })
      }
    }
    
    if (showLineEditorTools && lineEditorState) {
      const currentPoint = getWorldPoint(e)
      const previewLines = []
      
      const pointToLineDistance = (px, py, x1, y1, x2, y2) => {
        const A = px - x1
        const B = py - y1
        const C = x2 - x1
        const D = y2 - y1
        const dot = A * C + B * D
        const lenSq = C * C + D * D
        const param = lenSq !== 0 ? dot / lenSq : -1
        let xx, yy
        if (param < 0) {
          xx = x1
          yy = y1
        } else if (param > 1) {
          xx = x2
          yy = y2
        } else {
          xx = x1 + param * C
          yy = y1 + param * D
        }
        const dx = px - xx
        const dy = py - yy
        return Math.sqrt(dx * dx + dy * dy)
      }
      
      if (lineEditorState.trimState === 'select_segment' && lineEditorState.selectedLines && lineEditorState.selectedLines.length === 2 && lineEditorState.intersection) {
        const tolerance = 15 / viewport.zoom
        let hoveredLine = null
        let minDist = Infinity
        
        for (const lineId of lineEditorState.selectedLines) {
          const line = shapes.find(s => s.id === lineId)
          if (line && line.type === 'line') {
            const dist = pointToLineDistance(currentPoint.x, currentPoint.y, line.x1, line.y1, line.x2, line.y2)
            if (dist < tolerance && dist < minDist) {
              minDist = dist
              hoveredLine = line
            }
          }
        }
        
        if (hoveredLine) {
          const distToStart = Math.sqrt((currentPoint.x - hoveredLine.x1)**2 + (currentPoint.y - hoveredLine.y1)**2)
          const distToEnd = Math.sqrt((currentPoint.x - hoveredLine.x2)**2 + (currentPoint.y - hoveredLine.y2)**2)
          
          const keepEndSegment = distToStart < distToEnd
          
          if (keepEndSegment) {
            previewLines.push({
              x1: lineEditorState.intersection.x,
              y1: lineEditorState.intersection.y,
              x2: hoveredLine.x2,
              y2: hoveredLine.y2
            })
          } else {
            previewLines.push({
              x1: hoveredLine.x1,
              y1: hoveredLine.y1,
              x2: lineEditorState.intersection.x,
              y2: lineEditorState.intersection.y
            })
          }
        }
      } else if (lineEditorState.trimState === 'trim_crossing' && lineEditorState.boundaryLines && lineEditorState.boundaryLines.length === 2) {
        const tolerance = 15 / viewport.zoom
        let hoveredLine = null
        let minDist = Infinity
        
        for (const shape of shapes) {
          if (shape.type === 'line' && !lineEditorState.boundaryLines.includes(shape.id)) {
            const dist = pointToLineDistance(currentPoint.x, currentPoint.y, shape.x1, shape.y1, shape.x2, shape.y2)
            if (dist < tolerance && dist < minDist) {
              minDist = dist
              hoveredLine = shape
            }
          }
        }
        
        if (hoveredLine) {
          const boundary1 = shapes.find(s => s.id === lineEditorState.boundaryLines[0])
          const boundary2 = shapes.find(s => s.id === lineEditorState.boundaryLines[1])
          
          const int1 = findLineIntersection(boundary1, hoveredLine)
          const int2 = findLineIntersection(boundary2, hoveredLine)
          
          if (int1 && int2) {
            const dist1ToStart = Math.sqrt((int1.x - hoveredLine.x1)**2 + (int1.y - hoveredLine.y1)**2)
            const dist2ToStart = Math.sqrt((int2.x - hoveredLine.x1)**2 + (int2.y - hoveredLine.y1)**2)
            
            const startInt = dist1ToStart < dist2ToStart ? int1 : int2
            const endInt = dist1ToStart < dist2ToStart ? int2 : int1
            
            previewLines.push({
              x1: hoveredLine.x1,
              y1: hoveredLine.y1,
              x2: startInt.x,
              y2: startInt.y
            })
            
            previewLines.push({
              x1: endInt.x,
              y1: endInt.y,
              x2: hoveredLine.x2,
              y2: hoveredLine.y2
            })
          }
        }
      } else if (lineEditorState.extendState === 'extend_lines' && lineEditorState.boundaryLines && lineEditorState.boundaryLines.length > 0) {
        const tolerance = 15 / viewport.zoom
        let hoveredLine = null
        let nearEndpoint = null
        
        for (const shape of shapes) {
          if (shape.type === 'line' && !lineEditorState.boundaryLines.includes(shape.id)) {
            const distToStart = Math.sqrt((currentPoint.x - shape.x1)**2 + (currentPoint.y - shape.y1)**2)
            const distToEnd = Math.sqrt((currentPoint.x - shape.x2)**2 + (currentPoint.y - shape.y2)**2)
            
            if (distToStart < tolerance) {
              hoveredLine = shape
              nearEndpoint = 'start'
              break
            } else if (distToEnd < tolerance) {
              hoveredLine = shape
              nearEndpoint = 'end'
              break
            }
          }
        }
        
        if (hoveredLine && nearEndpoint) {
          const extendFromStart = nearEndpoint === 'start'
          const px = extendFromStart ? hoveredLine.x1 : hoveredLine.x2
          const py = extendFromStart ? hoveredLine.y1 : hoveredLine.y2
          const vx = extendFromStart ? (hoveredLine.x1 - hoveredLine.x2) : (hoveredLine.x2 - hoveredLine.x1)
          const vy = extendFromStart ? (hoveredLine.y1 - hoveredLine.y2) : (hoveredLine.y2 - hoveredLine.y1)
          const len = Math.sqrt(vx*vx + vy*vy)
          const dirX = vx / len
          const dirY = vy / len
          
          const extendedX = px + dirX * 10000
          const extendedY = py + dirY * 10000
          
          let bestIntersection = null
          let minDist = Infinity
          
          lineEditorState.boundaryLines.forEach(boundaryId => {
            const boundary = shapes.find(s => s.id === boundaryId)
            if (!boundary) return
            
            const inters = findLineIntersection(
              { x1: px, y1: py, x2: extendedX, y2: extendedY },
              boundary
            )
            
            if (inters) {
              const dist = Math.sqrt((inters.x - px)**2 + (inters.y - py)**2)
              const dot = (inters.x - px) * dirX + (inters.y - py) * dirY
              if (dot > 0 && dist < minDist) {
                minDist = dist
                bestIntersection = inters
              }
            }
          })
          
          if (bestIntersection) {
            previewLines.push({
              x1: px,
              y1: py,
              x2: bestIntersection.x,
              y2: bestIntersection.y
            })
          }
        }
      }
      
      setTrimPreviewLines(previewLines)
    } else {
      setTrimPreviewLines([])
    }
  }

  const handleMouseUp = (e) => {
    setIsPanning(false)
    setDraggedGuide(null)
    
    if (selectionRect && selectionRect.width > 5 && selectionRect.height > 5) {
      const selectedIds = []
      shapes.forEach(shape => {
        const shapeLayer = layers.find(l => l.id === shape.layerId) || layers[0]
        if (!shapeLayer || !shapeLayer.visible || shapeLayer.locked) return
        
        let intersects = false
        if (shape.type === 'line') {
          const x1 = shape.x1, y1 = shape.y1, x2 = shape.x2, y2 = shape.y2
          const minX = Math.min(x1, x2), maxX = Math.max(x1, x2)
          const minY = Math.min(y1, y2), maxY = Math.max(y1, y2)
          intersects = !(maxX < selectionRect.x || minX > selectionRect.x + selectionRect.width ||
                        maxY < selectionRect.y || minY > selectionRect.y + selectionRect.height)
        } else if (shape.type === 'circle') {
          const cx = shape.x, cy = shape.y, r = shape.radius
          intersects = !(cx + r < selectionRect.x || cx - r > selectionRect.x + selectionRect.width ||
                        cy + r < selectionRect.y || cy - r > selectionRect.y + selectionRect.height)
        } else if (shape.type === 'rectangle') {
          intersects = !(shape.x + shape.width < selectionRect.x || shape.x > selectionRect.x + selectionRect.width ||
                        shape.y + shape.height < selectionRect.y || shape.y > selectionRect.y + selectionRect.height)
        } else if (shape.type === 'polygon' && shape.points) {
          for (let i = 0; i < shape.points.length; i += 2) {
            const px = shape.points[i], py = shape.points[i + 1]
            if (px >= selectionRect.x && px <= selectionRect.x + selectionRect.width &&
                py >= selectionRect.y && py <= selectionRect.y + selectionRect.height) {
              intersects = true
              break
            }
          }
        } else if (shape.type === 'freehand' && shape.points) {
          for (let i = 0; i < shape.points.length; i += 2) {
            const px = shape.points[i], py = shape.points[i + 1]
            if (px >= selectionRect.x && px <= selectionRect.x + selectionRect.width &&
                py >= selectionRect.y && py <= selectionRect.y + selectionRect.height) {
              intersects = true
              break
            }
          }
        } else if (shape.type === 'text') {
          intersects = shape.x >= selectionRect.x && shape.x <= selectionRect.x + selectionRect.width &&
                      shape.y >= selectionRect.y && shape.y <= selectionRect.y + selectionRect.height
        } else if (shape.type === 'arc') {
          const cx = shape.x, cy = shape.y, r = shape.outerRadius || 50
          intersects = !(cx + r < selectionRect.x || cx - r > selectionRect.x + selectionRect.width ||
                        cy + r < selectionRect.y || cy - r > selectionRect.y + selectionRect.height)
        }
        
        if (intersects) {
          selectedIds.push(shape.id)
        }
      })
      
      setSelectedShapeIds(selectedIds)
      setSelectionRect(null)
      return
    }
    
    setSelectionRect(null)
    
    if (adjustLineState) {
      const shape = shapes.find(s => s.id === adjustLineState.shapeId)
      if (shape && shape.originalStroke) {
        updateShape(shape.id, {
          stroke: shape.originalStroke,
          strokeWidth: shape.originalStrokeWidth
        })
      }
      setAdjustLineState(null)
      return
    }
    
    if (drawingState && previewShape) {
      const currentPoint = getWorldPoint(e)
      const newShape = {
        id: `shape-${Date.now()}`,
        stroke: '#000',
        strokeWidth: 2,
        ...previewShape
      }
      
      if (drawingState.tool === 'polygon') {
        const sides = 6
        const points = []
        for (let i = 0; i < sides; i++) {
          const angle = (i / sides) * Math.PI * 2 - Math.PI / 2
          points.push(
            drawingState.centerX + previewShape.radius * Math.cos(angle),
            drawingState.centerY + previewShape.radius * Math.sin(angle)
          )
        }
        newShape.type = 'polygon'
        newShape.points = points
        delete newShape.x
        delete newShape.y
        delete newShape.radius
      } else if (drawingState.tool === 'arc') {
        newShape.type = 'arc'
        newShape.angle = 0
        newShape.innerRadius = 0
        newShape.outerRadius = previewShape.radius
        newShape.rotation = 0
      }
      
      addShapeWithUndo(newShape)
      setDrawingState(null)
      setPreviewShape(null)
    }
    
    if (markerState && markerState.tool === 'lineMarker') {
      const currentPoint = getWorldPoint(e, markerSnapEnabled)
      const dx = currentPoint.x - markerState.startX
      const dy = currentPoint.y - markerState.startY
      const distance = Math.sqrt(dx * dx + dy * dy)
      const angle = Math.atan2(dy, dx) * 180 / Math.PI
      
      addMarker({
        id: `marker-${Date.now()}`,
        type: 'lineMarker',
        x1: markerState.startX,
        y1: markerState.startY,
        x2: currentPoint.x,
        y2: currentPoint.y,
        distance: distance,
        angle: angle
      })
      setMarkerState(null)
      setActiveTool(null)
    }
    
    const textToolState = useCadStore.getState().textToolState
    if (textToolState?.placeMode && textToolState.pendingText) {
      const clickedOnEmpty = e.target === e.target.getStage()
      if (clickedOnEmpty) {
        const clickPoint = getWorldPoint(e)
        const newTextId = `text-${Date.now()}`
        const newText = {
          id: newTextId,
          type: 'text',
          x: clickPoint.x,
          y: clickPoint.y,
          text: textToolState.pendingText.text,
          font: textToolState.pendingText.font,
          fontSize: textToolState.pendingText.fontSize,
          fill: textToolState.pendingText.fill,
          stroke: textToolState.pendingText.stroke,
          strokeWidth: textToolState.pendingText.strokeWidth || 0,
          base_x: clickPoint.x / machineProfile.mmToPx,
          base_y: clickPoint.y / machineProfile.mmToPx
        }
        
        addShape(newText)
        
        const setTextToolState = useCadStore.getState().setTextToolState
        setTextToolState({
          placeMode: false,
          selectMode: false,
          selectedTextId: newTextId,
          pendingText: null
        })
      }
    }
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

  const updatePanelPosition = (panelId, x, y) => {
    const PANEL_WIDTH = 320
    const MIN_VISIBLE = 100
    
    setPanelPositions(prev => ({
      ...prev,
      [panelId]: {
        ...prev[panelId],
        x: Math.max(MIN_VISIBLE - PANEL_WIDTH, Math.min(x, window.innerWidth - MIN_VISIBLE)),
        y: Math.max(0, y)
      }
    }))
  }

  const bringPanelToFront = (panelId) => {
    setTopZIndex(prev => {
      const newZIndex = prev + 1
      setPanelPositions(positions => ({
        ...positions,
        [panelId]: {
          ...positions[panelId],
          zIndex: newZIndex
        }
      }))
      return newZIndex
    })
  }

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
  
  const handleExportSVG = () => {
    const svgContent = exportToSVG(shapes, machineProfile, layers)
    downloadSVG(svgContent, 'design.svg')
  }
  
  const handleImportSVG = async (event) => {
    const file = event.target.files[0]
    if (!file) return
    
    try {
      const { shapes: importedShapes, layers: importedLayers } = await importFromSVG(file, machineProfile)
      
      if (importedLayers && importedLayers.length > 0) {
        setLayers(importedLayers)
      }
      
      if (importedShapes && importedShapes.length > 0) {
        setShapes(importedShapes)
      }
      
      alert(`Imported ${importedShapes.length} shapes and ${importedLayers.length} layers`)
    } catch (error) {
      console.error('SVG import error:', error)
      alert('Failed to import SVG: ' + error.message)
    }
    
    event.target.value = ''
  }
  
  const handleDeleteSelected = () => {
    if (selectedShapeIds.length === 0) return
    
    selectedShapeIds.forEach(id => {
      removeShapeWithUndo(id)
    })
    setSelectedShapeIds([])
  }

  const handleLineEditorToolClick = (shape, clickX, clickY) => {
    const tool = lineEditorState?.currentTool
    
    if (tool === 'trim') {
      handleTrimClick(shape, clickX, clickY)
    } else if (tool === 'trimMid') {
      handleTrimMidClick(shape)
    } else if (tool === 'extend') {
      handleExtendClick(shape, clickX, clickY)
    } else {
      handleDefaultLineEditorClick(shape)
    }
  }

  const handleTrimClick = (shape, clickX, clickY) => {
    if (shape.type !== 'line') {
      console.log('❌ TRIM: Shape is not a line, ignoring')
      return
    }
    
    const { trimState, selectedLines = [], intersection } = lineEditorState
    console.log('✂️ TRIM CLICK - Current state:', { trimState, selectedLines, intersection })
    
    if (trimState === 'first_line') {
      console.log('  → Selecting FIRST line:', shape.id)
      const updates = {
        selectedLines: [shape.id],
        trimState: 'second_line'
      }
      console.log('  → Updating state to:', updates)
      updateLineEditorState(updates)
      console.log('  → State update called, highlighting line red')
      updateShape(shape.id, {
        originalStroke: shape.stroke,
        originalStrokeWidth: shape.strokeWidth,
        stroke: '#FF0000',
        strokeWidth: 2
      })
      console.log('  ✅ First line selected, waiting for second line')
    } else if (trimState === 'second_line') {
      if (selectedLines.includes(shape.id)) {
        console.log('  ⚠️ Already selected, ignoring')
        return
      }
      
      console.log('  → Selecting SECOND line:', shape.id)
      const line1 = shapes.find(s => s.id === selectedLines[0])
      console.log('  → Finding intersection between line1:', selectedLines[0], 'and line2:', shape.id)
      const inters = findLineIntersection(line1, shape)
      
      if (!inters) {
        console.log('  ❌ Lines do not intersect!')
        alert('Lines do not intersect')
        return
      }
      
      console.log('  ✓ Intersection found:', inters)
      const updates = {
        selectedLines: [...selectedLines, shape.id],
        intersection: inters,
        trimState: 'select_segment'
      }
      console.log('  → Updating state to:', updates)
      updateLineEditorState(updates)
      updateShape(shape.id, {
        originalStroke: shape.stroke,
        originalStrokeWidth: shape.strokeWidth,
        stroke: '#FF0000',
        strokeWidth: 2
      })
    } else if (trimState === 'select_segment' && selectedLines.includes(shape.id)) {
      const distToStart = Math.sqrt((clickX - shape.x1)**2 + (clickY - shape.y1)**2)
      const distToEnd = Math.sqrt((clickX - shape.x2)**2 + (clickY - shape.y2)**2)
      
      const keepEndSegment = distToStart < distToEnd
      
      if (keepEndSegment) {
        updateShape(shape.id, {
          x1: intersection.x,
          y1: intersection.y,
          stroke: shape.originalStroke,
          strokeWidth: shape.originalStrokeWidth
        })
      } else {
        updateShape(shape.id, {
          x2: intersection.x,
          y2: intersection.y,
          stroke: shape.originalStroke,
          strokeWidth: shape.originalStrokeWidth
        })
      }
      
      selectedLines.forEach(id => {
        const s = shapes.find(sh => sh.id === id)
        if (s && s.originalStroke) {
          updateShape(id, {
            stroke: s.originalStroke,
            strokeWidth: s.originalStrokeWidth
          })
        }
      })
      
      updateLineEditorState({
        selectedLines: [],
        trimState: 'first_line',
        intersection: null
      })
    }
  }

  const handleTrimMidClick = (shape) => {
    if (shape.type !== 'line') {
      console.log('❌ TRIM MID: Shape is not a line, ignoring')
      return
    }
    
    const { trimState, selectedLines = [], boundaryLines = [] } = lineEditorState
    console.log('✂️ TRIM MID CLICK - Current state:', { trimState, selectedLines, boundaryLines })
    
    if (trimState === 'first_line') {
      console.log('  → Selecting FIRST BOUNDARY line:', shape.id)
      const updates = {
        selectedLines: [shape.id],
        boundaryLines: [shape.id],
        trimState: 'second_line'
      }
      console.log('  → Updating state to:', updates)
      updateLineEditorState(updates)
      updateShape(shape.id, {
        originalStroke: shape.stroke,
        originalStrokeWidth: shape.strokeWidth,
        stroke: '#FF0000',
        strokeWidth: 2
      })
    } else if (trimState === 'second_line') {
      if (selectedLines.includes(shape.id)) {
        console.log('  ⚠️ Already selected, ignoring')
        return
      }
      
      console.log('  → Selecting SECOND BOUNDARY line:', shape.id)
      const updates = {
        selectedLines: [...selectedLines, shape.id],
        boundaryLines: [...boundaryLines, shape.id],
        trimState: 'trim_crossing'
      }
      console.log('  → Updating state to:', updates)
      updateLineEditorState(updates)
      updateShape(shape.id, {
        originalStroke: shape.stroke,
        originalStrokeWidth: shape.strokeWidth,
        stroke: '#FF0000',
        strokeWidth: 2
      })
    } else if (trimState === 'trim_crossing' && !boundaryLines.includes(shape.id)) {
      const boundary1 = shapes.find(s => s.id === boundaryLines[0])
      const boundary2 = shapes.find(s => s.id === boundaryLines[1])
      
      const int1 = findLineIntersection(boundary1, shape)
      const int2 = findLineIntersection(boundary2, shape)
      
      if (int1 && int2) {
        const dist1Start = Math.sqrt((int1.x - shape.x1)**2 + (int1.y - shape.y1)**2)
        const dist1End = Math.sqrt((int1.x - shape.x2)**2 + (int1.y - shape.y2)**2)
        const dist2Start = Math.sqrt((int2.x - shape.x1)**2 + (int2.y - shape.y1)**2)
        const dist2End = Math.sqrt((int2.x - shape.x2)**2 + (int2.y - shape.y2)**2)
        
        const newLine1 = {
          id: `line-${Date.now()}-1`,
          type: 'line',
          x1: shape.x1,
          y1: shape.y1,
          x2: dist1Start < dist1End ? int1.x : int2.x,
          y2: dist1Start < dist1End ? int1.y : int2.y,
          stroke: shape.stroke,
          strokeWidth: shape.strokeWidth
        }
        
        const newLine2 = {
          id: `line-${Date.now()}-2`,
          type: 'line',
          x1: dist2End < dist2Start ? int2.x : int1.x,
          y1: dist2End < dist2Start ? int2.y : int1.y,
          x2: shape.x2,
          y2: shape.y2,
          stroke: shape.stroke,
          strokeWidth: shape.strokeWidth
        }
        
        removeShape(shape.id)
        addShape(newLine1)
        addShape(newLine2)
        
        boundaryLines.forEach(id => {
          const s = shapes.find(sh => sh.id === id)
          if (s && s.originalStroke) {
            updateShape(id, {
              stroke: s.originalStroke,
              strokeWidth: s.originalStrokeWidth
            })
          }
        })
        
        setLineEditorState({
          currentTool: 'trimMid',
          trimState: 'first_line',
          selectedLines: [],
          boundaryLines: []
        })
      }
    }
  }

  const handleExtendClick = (shape, clickX, clickY) => {
    if (shape.type !== 'line') {
      console.log('❌ EXTEND: Shape is not a line, ignoring')
      return
    }
    
    const { extendState, boundaryLines = [] } = lineEditorState
    console.log('↗️ EXTEND CLICK - Current state:', { extendState, boundaryLines })
    
    if (extendState === 'select_boundary') {
      console.log('  → Selecting BOUNDARY line:', shape.id)
      const updates = {
        boundaryLines: [...boundaryLines, shape.id],
        extendState: 'extend_lines'
      }
      console.log('  → Updating state to:', updates)
      updateLineEditorState(updates)
      updateShape(shape.id, {
        originalStroke: shape.stroke,
        originalStrokeWidth: shape.strokeWidth,
        stroke: '#FF0000',
        strokeWidth: 2
      })
    } else if (extendState === 'extend_lines' && !boundaryLines.includes(shape.id)) {
      const distToStart = Math.sqrt((clickX - shape.x1)**2 + (clickY - shape.y1)**2)
      const distToEnd = Math.sqrt((clickX - shape.x2)**2 + (clickY - shape.y2)**2)
      
      const extendFromStart = distToStart < distToEnd
      const px = extendFromStart ? shape.x1 : shape.x2
      const py = extendFromStart ? shape.y1 : shape.y2
      const vx = extendFromStart ? (shape.x1 - shape.x2) : (shape.x2 - shape.x1)
      const vy = extendFromStart ? (shape.y1 - shape.y2) : (shape.y2 - shape.y1)
      const len = Math.sqrt(vx*vx + vy*vy)
      const dirX = vx / len
      const dirY = vy / len
      
      const extendedX = px + dirX * 10000
      const extendedY = py + dirY * 10000
      
      let bestIntersection = null
      let minDist = Infinity
      
      boundaryLines.forEach(boundaryId => {
        const boundary = shapes.find(s => s.id === boundaryId)
        if (!boundary) return
        
        const inters = findLineIntersection(
          { x1: px, y1: py, x2: extendedX, y2: extendedY },
          boundary
        )
        
        if (inters) {
          const dist = Math.sqrt((inters.x - px)**2 + (inters.y - py)**2)
          const dot = (inters.x - px) * dirX + (inters.y - py) * dirY
          if (dot > 0 && dist < minDist) {
            minDist = dist
            bestIntersection = inters
          }
        }
      })
      
      if (bestIntersection) {
        if (extendFromStart) {
          updateShape(shape.id, {
            x1: bestIntersection.x,
            y1: bestIntersection.y
          })
        } else {
          updateShape(shape.id, {
            x2: bestIntersection.x,
            y2: bestIntersection.y
          })
        }
        
        boundaryLines.forEach(id => {
          const s = shapes.find(sh => sh.id === id)
          if (s && s.originalStroke) {
            updateShape(id, {
              stroke: s.originalStroke,
              strokeWidth: s.originalStrokeWidth
            })
          }
        })
        
        setLineEditorState({
          currentTool: 'extend',
          extendState: 'select_boundary',
          boundaryLines: []
        })
      } else {
        alert('Could not find valid extension point')
        
        boundaryLines.forEach(id => {
          const s = shapes.find(sh => sh.id === id)
          if (s && s.originalStroke) {
            updateShape(id, {
              stroke: s.originalStroke,
              strokeWidth: s.originalStrokeWidth
            })
          }
        })
        
        setLineEditorState({
          currentTool: 'extend',
          extendState: 'select_boundary',
          boundaryLines: []
        })
      }
    }
  }

  const handleDefaultLineEditorClick = (shape) => {
    const currentSelected = lineEditorState.selectedLines || []
    if (currentSelected.includes(shape.id)) {
      const newSelection = currentSelected.filter(id => id !== shape.id)
      if (shape.originalStroke) {
        updateShape(shape.id, {
          stroke: shape.originalStroke,
          strokeWidth: shape.originalStrokeWidth
        })
      }
      setLineEditorState({
        ...lineEditorState,
        selectedLines: newSelection
      })
    } else {
      const newSelection = [...currentSelected, shape.id]
      if (!shape.originalStroke) {
        updateShape(shape.id, {
          originalStroke: shape.stroke,
          originalStrokeWidth: shape.strokeWidth,
          stroke: '#FF0000',
          strokeWidth: 3
        })
      }
      setLineEditorState({
        ...lineEditorState,
        selectedLines: newSelection
      })
    }
  }

  const handleShapeClick = (shape, event) => {
    console.log('👆 SHAPE CLICKED:', shape.id, 'type:', shape.type)
    console.log('   showLineEditorTools:', showLineEditorTools)
    console.log('   lineEditorState:', lineEditorState)
    
    if (event && event.evt) {
      event.evt.cancelBubble = true
      event.evt.stopPropagation()
    }
    
    const shapeLayer = layers.find(l => l.id === shape.layerId) || layers[0]
    if (shapeLayer && shapeLayer.locked) {
      console.log('   → Shape on locked layer, ignoring click')
      return
    }
    
    const textToolState = useCadStore.getState().textToolState
    const shapePropertiesState = useCadStore.getState().shapePropertiesState
    
    if (textToolState?.selectMode && shape.type === 'text') {
      console.log('   → Text selection')
      const setTextToolState = useCadStore.getState().setTextToolState
      setTextToolState({
        selectMode: false,
        placeMode: false,
        selectedTextId: shape.id
      })
    } else if (shapePropertiesState?.selectMode) {
      console.log('   → Shape properties selection')
      const setShapePropertiesState = useCadStore.getState().setShapePropertiesState
      setShapePropertiesState({
        selectMode: false,
        selectedShapeId: shape.id
      })
    } else if (mirrorAxisSelectionCallback) {
      console.log('   → Mirror axis callback')
      mirrorAxisSelectionCallback(shape.id)
      setMirrorAxisLineId(shape.id)
      setMirrorAxisSelectionCallback(null)
    } else if (showLineEditorTools && lineEditorState && lineEditorState.currentTool) {
      console.log('   → Routing to line editor tool:', lineEditorState.currentTool)
      const stage = event?.target?.getStage()
      const pointerPos = stage?.getPointerPosition()
      if (pointerPos) {
        const clickX = (pointerPos.x - viewport.pan.x) / viewport.zoom
        const clickY = (pointerPos.y - viewport.pan.y) / viewport.zoom
        handleLineEditorToolClick(shape, clickX, clickY)
      } else {
        handleDefaultLineEditorClick(shape)
      }
    } else {
      console.log('   → Default selection')
      setSelectedShapeId(shape.id)
    }
  }

  const handleShapeHover = (shape, isEntering) => {
    if (showLineEditorTools && lineEditorState?.currentTool) {
      const isSelected = lineEditorState.selectedLines?.includes(shape.id)
      if (!isSelected) {
        if (isEntering) {
          setHoveredShapeId(shape.id)
        } else {
          setHoveredShapeId(null)
        }
      }
    }
  }

  const getShapeStroke = (shape) => {
    const isSelected = lineEditorState?.selectedLines?.includes(shape.id) || selectedShapeIds.includes(shape.id)
    const isHovered = hoveredShapeId === shape.id
    
    if (isSelected) {
      return '#FF0000'
    } else if (isHovered && showLineEditorTools && lineEditorState?.currentTool) {
      return '#0088FF'
    }
    return shape.stroke
  }

  const getShapeStrokeWidth = (shape) => {
    const isSelected = lineEditorState?.selectedLines?.includes(shape.id) || selectedShapeIds.includes(shape.id)
    const isHovered = hoveredShapeId === shape.id
    
    if (isSelected) {
      return 3
    } else if (isHovered && showLineEditorTools && lineEditorState?.currentTool) {
      return 2
    }
    return shape.strokeWidth
  }

  const getHitStrokeWidth = (shape) => {
    return Math.max(15, shape.strokeWidth || 2)
  }

  return (
    <div className="cad-interface">
      <MenuBar 
        onImportSVG={() => document.getElementById('svg-import-input').click()}
        onExportSVG={handleExportSVG}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
        onZoomFit={() => console.log('Zoom to fit')}
        setShowGrid={setShowGrid}
        showGrid={showGrid}
      />
      <div className="top-toolbar">
        <div className="toolbar-left">
          <button 
            onClick={handleDeleteSelected} 
            className="delete-button"
            disabled={selectedShapeIds.length === 0}
          >
            Delete Selected
          </button>
        </div>
        <div className="toolbar-center">
          <h3>Mechanicus CAD - {machineProfile.bedSizeX}x{machineProfile.bedSizeY}mm</h3>
        </div>
        <div className="toolbar-right">
          <label className="toolbar-checkbox">
            <input 
              type="checkbox" 
              checked={showGrid}
              onChange={(e) => setShowGrid(e.target.checked)}
            />
            Show Grid
          </label>
          <label className="toolbar-input-label">
            Grid Size:
            <input 
              type="number" 
              value={gridSize}
              onChange={(e) => setGridSize(Number(e.target.value))}
              className="toolbar-number-input"
              min="1"
              max="100"
            />
          </label>
          <label className="toolbar-checkbox">
            <input 
              type="checkbox" 
              checked={gridSnap}
              onChange={(e) => setGridSnap(e.target.checked)}
            />
            Grid Snap
          </label>
          <button onClick={handleZoomIn}>Zoom In</button>
          <button onClick={handleZoomOut}>Zoom Out</button>
          <button onClick={handleZoomReset}>Reset Zoom ({Math.round(viewport.zoom * 100)}%)</button>
        </div>
      </div>

      <div className="main-workspace">
        <div className="toolbar-panel">
          <div className="tool-button-grid">
            <ToolButton 
              icon={<ImportIcon />} 
              label="Import SVG" 
              onClick={() => document.getElementById('svg-import-input').click()} 
            />
            <input 
              id="svg-import-input" 
              type="file" 
              accept=".svg" 
              onChange={handleImportSVG} 
              style={{ display: 'none' }} 
            />
            <ToolButton 
              icon={<ExportIcon />} 
              label="Export SVG" 
              onClick={handleExportSVG} 
            />
            <ToolButton 
              icon={<UndoIcon />} 
              label="Undo (Ctrl+Z)" 
              onClick={undo} 
              disabled={undoStack.length === 0}
            />
            <ToolButton 
              icon={<RedoIcon />} 
              label="Redo (Ctrl+Y)" 
              onClick={redo} 
              disabled={redoStack.length === 0}
            />

            <ToolButton 
              icon={<DrawingToolsIcon />} 
              label="Drawing Tools" 
              onClick={() => setShowDrawingTools(!showDrawingTools)}
              active={showDrawingTools}
            />
            <ToolButton 
              icon={<SnapToolsIcon />} 
              label="Snap Tools" 
              onClick={() => setShowSnapTools(!showSnapTools)}
              active={showSnapTools}
            />
            <ToolButton 
              icon={<MarkersIcon />} 
              label="Markers" 
              onClick={() => setShowMarkersWindow(!showMarkersWindow)}
              active={showMarkersWindow}
            />
            <ToolButton 
              icon={<TransformIcon />} 
              label="Transform Tools" 
              onClick={() => setShowTransformTools(!showTransformTools)}
              active={showTransformTools}
            />

            <ToolButton 
              icon={<LineEditorIcon />} 
              label="Line Editor" 
              onClick={() => setShowLineEditorTools(!showLineEditorTools)}
              active={showLineEditorTools}
            />
            <ToolButton 
              icon={<ShapePropertiesIcon />} 
              label="Shape Properties" 
              onClick={() => setShowShapeProperties(!showShapeProperties)}
              active={showShapeProperties}
            />
            <ToolButton 
              icon={<TextToolsIcon />} 
              label="Text Tools" 
              onClick={() => setShowTextTools(!showTextTools)}
              active={showTextTools}
            />
            <ToolButton 
              icon={<LayersIcon />} 
              label="Layers" 
              onClick={() => setShowLayers(!showLayers)}
              active={showLayers}
            />
          </div>

          <div className="user-section">
            <div className="user-info">
              <UserIcon />
              <span className="user-email">{user?.email}</span>
            </div>
            <button className="logout-button" onClick={logout}>
              <LogoutIcon />
              <span>Logout</span>
            </button>
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
                    listening={false}
                  />
                  {drawGrid()}
                  
                  {shapes.filter(shape => {
                    const shapeLayer = layers.find(l => l.id === shape.layerId) || layers[0]
                    return shapeLayer && shapeLayer.visible
                  }).map(shape => {
                    if (shape.type === 'line') {
                      return (
                        <Line
                          key={shape.id}
                          points={[shape.x1, shape.y1, shape.x2, shape.y2]}
                          stroke={getShapeStroke(shape)}
                          strokeWidth={getShapeStrokeWidth(shape)}
                          hitStrokeWidth={getHitStrokeWidth(shape)}
                          onClick={(e) => handleShapeClick(shape, e)}
                          onMouseEnter={() => handleShapeHover(shape, true)}
                          onMouseLeave={() => handleShapeHover(shape, false)}
                        />
                      )
                    } else if (shape.type === 'circle') {
                      return (
                        <Circle
                          key={shape.id}
                          x={shape.x}
                          y={shape.y}
                          radius={shape.radius}
                          stroke={getShapeStroke(shape)}
                          strokeWidth={getShapeStrokeWidth(shape)}
                          hitStrokeWidth={getHitStrokeWidth(shape)}
                          rotation={shape.rotation || 0}
                          scaleX={shape.scaleX || 1}
                          scaleY={shape.scaleY || 1}
                          onClick={(e) => handleShapeClick(shape, e)}
                          onMouseEnter={() => handleShapeHover(shape, true)}
                          onMouseLeave={() => handleShapeHover(shape, false)}
                        />
                      )
                    } else if (shape.type === 'rectangle') {
                      return (
                        <Rect
                          key={shape.id}
                          x={shape.x}
                          y={shape.y}
                          width={shape.width}
                          height={shape.height}
                          stroke={getShapeStroke(shape)}
                          strokeWidth={getShapeStrokeWidth(shape)}
                          hitStrokeWidth={getHitStrokeWidth(shape)}
                          rotation={shape.rotation || 0}
                          scaleX={shape.scaleX || 1}
                          scaleY={shape.scaleY || 1}
                          onClick={(e) => handleShapeClick(shape, e)}
                          onMouseEnter={() => handleShapeHover(shape, true)}
                          onMouseLeave={() => handleShapeHover(shape, false)}
                        />
                      )
                    } else if (shape.type === 'polygon') {
                      return (
                        <Line
                          key={shape.id}
                          points={shape.points}
                          closed
                          stroke={getShapeStroke(shape)}
                          strokeWidth={getShapeStrokeWidth(shape)}
                          hitStrokeWidth={getHitStrokeWidth(shape)}
                          onClick={(e) => handleShapeClick(shape, e)}
                          onMouseEnter={() => handleShapeHover(shape, true)}
                          onMouseLeave={() => handleShapeHover(shape, false)}
                        />
                      )
                    } else if (shape.type === 'arc') {
                      return (
                        <Arc
                          key={shape.id}
                          x={shape.x}
                          y={shape.y}
                          innerRadius={shape.outerRadius}
                          outerRadius={shape.outerRadius}
                          angle={shape.angle}
                          rotation={shape.rotation || 0}
                          stroke={getShapeStroke(shape)}
                          strokeWidth={getShapeStrokeWidth(shape)}
                          hitStrokeWidth={getHitStrokeWidth(shape)}
                          fill={undefined}
                          scaleX={shape.scaleX || 1}
                          scaleY={shape.scaleY || 1}
                          onClick={(e) => handleShapeClick(shape, e)}
                          onMouseEnter={() => handleShapeHover(shape, true)}
                          onMouseLeave={() => handleShapeHover(shape, false)}
                        />
                      )
                    } else if (shape.type === 'text') {
                      return (
                        <Text
                          key={shape.id}
                          x={shape.x}
                          y={shape.y}
                          text={shape.text}
                          fontSize={shape.fontSize || 50}
                          fontFamily={shape.font || 'Impact'}
                          fill={shape.fill || '#000000'}
                          stroke={shape.stroke}
                          strokeWidth={shape.strokeWidth || 0}
                          draggable={true}
                          onClick={(e) => handleShapeClick(shape, e)}
                          onDragEnd={(e) => {
                            const newX = e.target.x()
                            const newY = e.target.y()
                            updateShape(shape.id, { x: newX, y: newY })
                          }}
                        />
                      )
                    } else if (shape.type === 'freehand') {
                      return (
                        <Line
                          key={shape.id}
                          points={shape.points}
                          stroke={getShapeStroke(shape)}
                          strokeWidth={getShapeStrokeWidth(shape)}
                          hitStrokeWidth={getHitStrokeWidth(shape)}
                          lineCap="round"
                          lineJoin="round"
                          onClick={(e) => handleShapeClick(shape, e)}
                          onMouseEnter={() => handleShapeHover(shape, true)}
                          onMouseLeave={() => handleShapeHover(shape, false)}
                        />
                      )
                    } else if (shape.type === 'path-group') {
                      return (
                        <Rect
                          key={shape.id}
                          x={shape.x}
                          y={shape.y}
                          width={shape.width}
                          height={shape.height}
                          stroke={shape.stroke || '#000000'}
                          strokeWidth={shape.strokeWidth || 1}
                          fill={shape.fill || 'transparent'}
                          dash={[5, 5]}
                          onClick={(e) => handleShapeClick(shape, e)}
                          onMouseEnter={() => handleShapeHover(shape, true)}
                          onMouseLeave={() => handleShapeHover(shape, false)}
                        />
                      )
                    }
                    return null
                  })}
                  
                  {drawingState && drawingState.tool === 'line' && (
                    <Circle
                      x={drawingState.startX}
                      y={drawingState.startY}
                      radius={5 / viewport.zoom}
                      fill="#00FF00"
                      listening={false}
                    />
                  )}
                  
                  {drawingState && (drawingState.tool === 'circle' || drawingState.tool === 'polygon' || drawingState.tool === 'arc') && (
                    <Circle
                      x={drawingState.centerX}
                      y={drawingState.centerY}
                      radius={5 / viewport.zoom}
                      fill="#00FF00"
                      listening={false}
                    />
                  )}
                  
                  {drawingState && drawingState.tool === 'rectangle' && (
                    <Circle
                      x={drawingState.startX}
                      y={drawingState.startY}
                      radius={5 / viewport.zoom}
                      fill="#00FF00"
                      listening={false}
                    />
                  )}
                  
                  {previewShape && previewShape.type === 'line' && (
                    <Line
                      points={[previewShape.x1, previewShape.y1, previewShape.x2, previewShape.y2]}
                      stroke="#00FF00"
                      strokeWidth={1}
                      dash={[5, 5]}
                      listening={false}
                    />
                  )}
                  
                  {previewShape && previewShape.type === 'circle' && (
                    <Circle
                      x={previewShape.x}
                      y={previewShape.y}
                      radius={previewShape.radius}
                      stroke="#00FF00"
                      strokeWidth={1}
                      dash={[5, 5]}
                      listening={false}
                    />
                  )}
                  
                  {previewShape && previewShape.type === 'rectangle' && (
                    <Rect
                      x={previewShape.x}
                      y={previewShape.y}
                      width={previewShape.width}
                      height={previewShape.height}
                      stroke="#00FF00"
                      strokeWidth={1}
                      dash={[5, 5]}
                      listening={false}
                    />
                  )}
                  
                  {previewShape && previewShape.type === 'polygon' && (() => {
                    const sides = 6
                    const points = []
                    for (let i = 0; i < sides; i++) {
                      const angle = (i / sides) * Math.PI * 2 - Math.PI / 2
                      points.push(
                        previewShape.x + previewShape.radius * Math.cos(angle),
                        previewShape.y + previewShape.radius * Math.sin(angle)
                      )
                    }
                    return (
                      <Line
                        points={points}
                        closed
                        stroke="#00FF00"
                        strokeWidth={1}
                        dash={[5, 5]}
                        listening={false}
                      />
                    )
                  })()}
                  
                  {previewShape && previewShape.type === 'arc' && (
                    <Wedge
                      x={previewShape.x}
                      y={previewShape.y}
                      radius={previewShape.radius}
                      angle={90}
                      stroke="#00FF00"
                      strokeWidth={1}
                      dash={[5, 5]}
                      listening={false}
                    />
                  )}
                  
                  {previewShape && previewShape.type === 'freehand' && (
                    <Line
                      points={previewShape.points}
                      stroke="#00FF00"
                      strokeWidth={1}
                      lineCap="round"
                      lineJoin="round"
                      listening={false}
                    />
                  )}
                  
                  {trimPreviewLines.map((line, index) => (
                    <Line
                      key={`trim-preview-${index}`}
                      points={[line.x1, line.y1, line.x2, line.y2]}
                      stroke="#FF0000"
                      strokeWidth={2}
                      dash={[10, 5]}
                      listening={false}
                    />
                  ))}
                  
                  {selectionRect && selectionRect.width > 0 && selectionRect.height > 0 && (
                    <Rect
                      x={selectionRect.x}
                      y={selectionRect.y}
                      width={selectionRect.width}
                      height={selectionRect.height}
                      stroke="#0088FF"
                      strokeWidth={1 / viewport.zoom}
                      fill="rgba(0, 136, 255, 0.1)"
                      listening={false}
                    />
                  )}
                  
                  {guidesVisible && guides.map(guide => {
                    if (guide.type === 'horizontal') {
                      return (
                        <Line
                          key={guide.id}
                          points={[0, guide.position, canvasWidth, guide.position]}
                          stroke="#FF00FF"
                          strokeWidth={1 / viewport.zoom}
                          dash={[10 / viewport.zoom, 5 / viewport.zoom]}
                          listening={!guidesLocked}
                        />
                      )
                    } else {
                      return (
                        <Line
                          key={guide.id}
                          points={[guide.position, 0, guide.position, canvasHeight]}
                          stroke="#FF00FF"
                          strokeWidth={1 / viewport.zoom}
                          dash={[10 / viewport.zoom, 5 / viewport.zoom]}
                          listening={!guidesLocked}
                        />
                      )
                    }
                  })}
                  
                  {markersVisible && markers.map(marker => {
                    if (marker.type === 'centerPoint') {
                      return (
                        <React.Fragment key={marker.id}>
                          <Circle
                            x={marker.x}
                            y={marker.y}
                            radius={10 / viewport.zoom}
                            stroke="#0088FF"
                            strokeWidth={2 / viewport.zoom}
                          />
                          <Circle
                            x={marker.x}
                            y={marker.y}
                            radius={3 / viewport.zoom}
                            fill="#0088FF"
                          />
                        </React.Fragment>
                      )
                    } else if (marker.type === 'lineMarker') {
                      const mmDist = marker.distance / machineProfile.mmToPx
                      return (
                        <React.Fragment key={marker.id}>
                          <Line
                            points={[marker.x1, marker.y1, marker.x2, marker.y2]}
                            stroke="#FF8800"
                            strokeWidth={2 / viewport.zoom}
                          />
                          <Circle
                            x={marker.x1}
                            y={marker.y1}
                            radius={5 / viewport.zoom}
                            fill="#FF8800"
                          />
                          <Circle
                            x={marker.x2}
                            y={marker.y2}
                            radius={5 / viewport.zoom}
                            fill="#FF8800"
                          />
                          <Text
                            x={(marker.x1 + marker.x2) / 2}
                            y={(marker.y1 + marker.y2) / 2 - 15 / viewport.zoom}
                            text={`${mmDist.toFixed(1)}mm ${marker.angle.toFixed(1)}°`}
                            fontSize={12 / viewport.zoom}
                            fill="#FF8800"
                            listening={false}
                          />
                        </React.Fragment>
                      )
                    }
                    return null
                  })}
                  
                  {mirrorAxisLineId && (() => {
                    const axisLine = shapes.find(s => s.id === mirrorAxisLineId && s.type === 'line')
                    if (!axisLine) return null
                    
                    return (
                      <Line
                        key={`mirror-axis-${mirrorAxisLineId}`}
                        points={[axisLine.x1, axisLine.y1, axisLine.x2, axisLine.y2]}
                        stroke="#FF0000"
                        strokeWidth={4 / viewport.zoom}
                        listening={false}
                      />
                    )
                  })()}
                  
                  {selectedShapeId && (() => {
                    const shape = shapes.find(s => s.id === selectedShapeId)
                    if (!shape) return null
                    
                    if (shape.type === 'line') {
                      const endpointSize = 10 / viewport.zoom
                      return (
                        <React.Fragment key={`selection-${selectedShapeId}`}>
                          <Line
                            points={[shape.x1, shape.y1, shape.x2, shape.y2]}
                            stroke="#0088FF"
                            strokeWidth={3 / viewport.zoom}
                            listening={false}
                          />
                          <Circle
                            x={shape.x1}
                            y={shape.y1}
                            radius={endpointSize / 2}
                            fill="#0088FF"
                            stroke="white"
                            strokeWidth={2 / viewport.zoom}
                            draggable
                            onDragMove={(e) => {
                              const pos = e.target.position()
                              const stage = stageRef.current
                              if (!stage) return
                              
                              const point = stage.getPointerPosition()
                              let worldX = (point.x - viewport.pan.x) / viewport.zoom
                              let worldY = (point.y - viewport.pan.y) / viewport.zoom
                              
                              const gridSpacing = gridSize * machineProfile.mmToPx
                              const snapResult = findSnapPoint(worldX, worldY, viewport.zoom, snap, gridSpacing, showGrid)
                              
                              if (snapResult) {
                                worldX = snapResult.x
                                worldY = snapResult.y
                                setSnapIndicator(snapResult)
                              } else {
                                setSnapIndicator(null)
                              }
                              
                              updateShape(selectedShapeId, { x1: worldX, y1: worldY })
                              e.target.position({ x: worldX, y: worldY })
                            }}
                            onDragEnd={() => setSnapIndicator(null)}
                          />
                          <Circle
                            x={shape.x2}
                            y={shape.y2}
                            radius={endpointSize / 2}
                            fill="#0088FF"
                            stroke="white"
                            strokeWidth={2 / viewport.zoom}
                            draggable
                            onDragMove={(e) => {
                              const pos = e.target.position()
                              const stage = stageRef.current
                              if (!stage) return
                              
                              const point = stage.getPointerPosition()
                              let worldX = (point.x - viewport.pan.x) / viewport.zoom
                              let worldY = (point.y - viewport.pan.y) / viewport.zoom
                              
                              const gridSpacing = gridSize * machineProfile.mmToPx
                              const snapResult = findSnapPoint(worldX, worldY, viewport.zoom, snap, gridSpacing, showGrid)
                              
                              if (snapResult) {
                                worldX = snapResult.x
                                worldY = snapResult.y
                                setSnapIndicator(snapResult)
                              } else {
                                setSnapIndicator(null)
                              }
                              
                              updateShape(selectedShapeId, { x2: worldX, y2: worldY })
                              e.target.position({ x: worldX, y: worldY })
                            }}
                            onDragEnd={() => setSnapIndicator(null)}
                          />
                        </React.Fragment>
                      )
                    }
                    
                    let bbox = { x: 0, y: 0, width: 0, height: 0 }
                    
                    if (shape.type === 'circle') {
                      bbox = {
                        x: shape.x - shape.radius,
                        y: shape.y - shape.radius,
                        width: shape.radius * 2,
                        height: shape.radius * 2
                      }
                    } else if (shape.type === 'rectangle') {
                      bbox = { x: shape.x, y: shape.y, width: shape.width, height: shape.height }
                    } else if (shape.type === 'polygon' || shape.type === 'freehand') {
                      const xs = shape.points.filter((_, i) => i % 2 === 0)
                      const ys = shape.points.filter((_, i) => i % 2 === 1)
                      const minX = Math.min(...xs)
                      const maxX = Math.max(...xs)
                      const minY = Math.min(...ys)
                      const maxY = Math.max(...ys)
                      bbox = { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
                    } else if (shape.type === 'arc') {
                      bbox = {
                        x: shape.x - shape.outerRadius,
                        y: shape.y - shape.outerRadius,
                        width: shape.outerRadius * 2,
                        height: shape.outerRadius * 2
                      }
                    }
                    
                    const handleSize = 8 / viewport.zoom
                    const handles = [
                      { x: bbox.x, y: bbox.y, cursor: 'nw-resize' },
                      { x: bbox.x + bbox.width / 2, y: bbox.y, cursor: 'n-resize' },
                      { x: bbox.x + bbox.width, y: bbox.y, cursor: 'ne-resize' },
                      { x: bbox.x + bbox.width, y: bbox.y + bbox.height / 2, cursor: 'e-resize' },
                      { x: bbox.x + bbox.width, y: bbox.y + bbox.height, cursor: 'se-resize' },
                      { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height, cursor: 's-resize' },
                      { x: bbox.x, y: bbox.y + bbox.height, cursor: 'sw-resize' },
                      { x: bbox.x, y: bbox.y + bbox.height / 2, cursor: 'w-resize' }
                    ]
                    
                    return (
                      <React.Fragment key={`selection-${selectedShapeId}`}>
                        <Rect
                          x={bbox.x}
                          y={bbox.y}
                          width={bbox.width}
                          height={bbox.height}
                          stroke="#0088FF"
                          strokeWidth={2 / viewport.zoom}
                          dash={[5 / viewport.zoom, 5 / viewport.zoom]}
                          listening={false}
                        />
                        {handles.map((handle, i) => (
                          <Rect
                            key={`handle-${i}`}
                            x={handle.x - handleSize / 2}
                            y={handle.y - handleSize / 2}
                            width={handleSize}
                            height={handleSize}
                            fill="white"
                            stroke="#0088FF"
                            strokeWidth={1 / viewport.zoom}
                            draggable
                            onDragStart={(e) => {
                              setDraggedHandle(i)
                              setInitialBbox(bbox)
                            }}
                            onDragMove={(e) => {
                              if (draggedHandle === null || !initialBbox) return
                              
                              const pos = e.target.position()
                              const worldX = pos.x
                              const worldY = pos.y
                              
                              const newShape = { ...shape }
                              const scaleX = Math.abs((worldX - bbox.x) / bbox.width)
                              const scaleY = Math.abs((worldY - bbox.y) / bbox.height)
                              
                              if (shape.type === 'circle') {
                                const centerX = shape.x
                                const centerY = shape.y
                                const radius = Math.sqrt(Math.pow(worldX - centerX, 2) + Math.pow(worldY - centerY, 2))
                                newShape.radius = radius
                              } else if (shape.type === 'rectangle') {
                                if (i === 4) {
                                  newShape.width = worldX - shape.x
                                  newShape.height = worldY - shape.y
                                }
                              } else if (shape.type === 'line') {
                                if (i === 4) {
                                  newShape.x2 = worldX
                                  newShape.y2 = worldY
                                }
                              }
                              
                              updateShape(selectedShapeId, newShape)
                            }}
                            onDragEnd={() => {
                              setDraggedHandle(null)
                              setInitialBbox(null)
                            }}
                          />
                        ))}
                      </React.Fragment>
                    )
                  })()}
                  
                  {snapIndicator && (
                    <>
                      <Circle
                        x={snapIndicator.x}
                        y={snapIndicator.y}
                        radius={6 / viewport.zoom}
                        fill={SNAP_COLORS[snapIndicator.type]}
                        stroke="white"
                        strokeWidth={1 / viewport.zoom}
                        listening={false}
                      />
                      <Text
                        x={snapIndicator.x + 10 / viewport.zoom}
                        y={snapIndicator.y - 15 / viewport.zoom}
                        text={snapIndicator.label}
                        fontSize={12 / viewport.zoom}
                        fill="#0088FF"
                        listening={false}
                      />
                    </>
                  )}
                </Layer>
              </Stage>
            </div>
          </div>
        </div>

        <FloatingPanel 
          title="Drawing Tools" 
          isOpen={showDrawingTools}
          onClose={() => setShowDrawingTools(false)}
          position={panelPositions.drawingTools}
          zIndex={panelPositions.drawingTools.zIndex}
          onPositionChange={(x, y) => updatePanelPosition('drawingTools', x, y)}
          onBringToFront={() => bringPanelToFront('drawingTools')}
        >
          <DrawingToolsWindow />
        </FloatingPanel>

        <FloatingPanel 
          title="Layers" 
          isOpen={showLayers}
          onClose={() => setShowLayers(false)}
          position={panelPositions.layers}
          zIndex={panelPositions.layers.zIndex}
          onPositionChange={(x, y) => updatePanelPosition('layers', x, y)}
          onBringToFront={() => bringPanelToFront('layers')}
        >
          <LayersWindow />
        </FloatingPanel>

        <FloatingPanel 
          title="Shape Properties" 
          isOpen={showShapeProperties}
          onClose={() => setShowShapeProperties(false)}
          position={panelPositions.shapeProperties}
          zIndex={panelPositions.shapeProperties.zIndex}
          onPositionChange={(x, y) => updatePanelPosition('shapeProperties', x, y)}
          onBringToFront={() => bringPanelToFront('shapeProperties')}
        >
          <ShapePropertiesWindow />
        </FloatingPanel>

        <FloatingPanel 
          title="Snap Tools" 
          isOpen={showSnapTools}
          onClose={() => setShowSnapTools(false)}
          position={panelPositions.snapTools}
          zIndex={panelPositions.snapTools.zIndex}
          onPositionChange={(x, y) => updatePanelPosition('snapTools', x, y)}
          onBringToFront={() => bringPanelToFront('snapTools')}
        >
          <SnapToolsWindow />
        </FloatingPanel>

        <FloatingPanel 
          title="Markers & Guides" 
          isOpen={showMarkersWindow}
          onClose={() => setShowMarkersWindow(false)}
          position={panelPositions.markersGuides}
          zIndex={panelPositions.markersGuides.zIndex}
          onPositionChange={(x, y) => updatePanelPosition('markersGuides', x, y)}
          onBringToFront={() => bringPanelToFront('markersGuides')}
        >
          <MarkersWindow onActivateTool={setActiveTool} />
        </FloatingPanel>

        <FloatingPanel 
          title="Transform Tools" 
          isOpen={showTransformTools}
          onClose={() => setShowTransformTools(false)}
          position={panelPositions.transformTools}
          zIndex={panelPositions.transformTools.zIndex}
          onPositionChange={(x, y) => updatePanelPosition('transformTools', x, y)}
          onBringToFront={() => bringPanelToFront('transformTools')}
        >
          <TransformToolsWindow 
            onSelectingMirrorAxis={(callback) => setMirrorAxisSelectionCallback(() => callback)}
            mirrorAxisLineId={mirrorAxisLineId}
            onClearMirrorAxis={() => setMirrorAxisLineId(null)}
          />
        </FloatingPanel>

        <FloatingPanel 
          title="Line Editor Tools" 
          isOpen={showLineEditorTools}
          onClose={() => setShowLineEditorTools(false)}
          position={panelPositions.lineEditorTools}
          zIndex={panelPositions.lineEditorTools.zIndex}
          onPositionChange={(x, y) => updatePanelPosition('lineEditorTools', x, y)}
          onBringToFront={() => bringPanelToFront('lineEditorTools')}
        >
          <LineEditorToolsWindow />
        </FloatingPanel>

        <FloatingPanel 
          title="Text & Font Tools" 
          isOpen={showTextTools}
          onClose={() => setShowTextTools(false)}
          position={panelPositions.textTools}
          zIndex={panelPositions.textTools.zIndex}
          onPositionChange={(x, y) => updatePanelPosition('textTools', x, y)}
          onBringToFront={() => bringPanelToFront('textTools')}
        >
          <TextFontToolsWindow />
        </FloatingPanel>
      </div>
    </div>
  )
}

export default CADInterface
