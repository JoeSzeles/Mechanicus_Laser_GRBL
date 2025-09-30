import { create } from 'zustand'
import { saveWorkspace, loadWorkspace, resetWorkspace as resetWorkspaceStorage, getDefaultWorkspace } from '../utils/workspaceManager'

const useCadStore = create((set) => ({
  shapes: [
    { 
      id: 'test-line-1', 
      type: 'line', 
      x1: 100, 
      y1: 100, 
      x2: 300, 
      y2: 100,
      stroke: '#000',
      strokeWidth: 2
    },
    { 
      id: 'test-line-2', 
      type: 'line', 
      x1: 300, 
      y1: 100, 
      x2: 300, 
      y2: 300,
      stroke: '#000',
      strokeWidth: 2
    },
    { 
      id: 'test-circle', 
      type: 'circle', 
      x: 500, 
      y: 200, 
      radius: 50,
      stroke: '#000',
      strokeWidth: 2
    }
  ],
  layers: [
    { id: 'layer1', name: 'Layer 1', visible: true, locked: false }
  ],
  selection: null,
  activeTool: null,
  snap: {
    grid: false,
    endpoint: true,
    midpoint: true,
    center: true
  },
  machineProfile: {
    bedSizeX: 300,
    bedSizeY: 200,
    mmToPx: 3.7795275591
  },
  viewport: {
    zoom: 1,
    pan: { x: 0, y: 0 }
  },
  markers: [],
  guides: [],
  markersVisible: true,
  guidesVisible: true,
  guidesLocked: false,
  markerSnapEnabled: true,
  selectedShapeId: null,
  transformMode: null,
  transformSettings: {
    keepAspectRatio: true,
    createCopy: false,
    snapAngle: true,
    rotationCenter: null
  },
  lineEditorState: null,
  shapePropertiesState: null,
  textToolState: null,
  undoStack: [],
  redoStack: [],
  maxUndoStack: 50,
  
  workspace: {
    panelStates: {
      drawingTools: true,
      layers: true,
      shapeProperties: true,
      snapTools: false,
      markersGuides: false,
      transformTools: false,
      lineEditorTools: false,
      textTools: false
    },
    panelPositions: {},
    gridVisible: true,
    gridSize: 10,
    gridSnap: false,
    selectedTool: 'select',
    zoomLevel: 100,
    viewportPosition: { x: 0, y: 0 }
  },

  setShapes: (shapes) => set({ shapes }),
  addShape: (shape) => set((state) => ({ shapes: [...state.shapes, shape] })),
  updateShape: (shapeId, updates) => set((state) => ({
    shapes: state.shapes.map(s => s.id === shapeId ? { ...s, ...updates } : s)
  })),
  removeShape: (shapeId) => set((state) => ({
    shapes: state.shapes.filter(s => s.id !== shapeId)
  })),
  
  addShapeWithUndo: (shape) => set((state) => {
    const command = {
      type: 'addShape',
      shape: shape,
      undo: (store) => {
        store.removeShape(shape.id)
      },
      redo: (store) => {
        store.addShape(shape)
      }
    }
    const newUndoStack = [...state.undoStack, command].slice(-state.maxUndoStack)
    return { shapes: [...state.shapes, shape], undoStack: newUndoStack, redoStack: [] }
  }),
  
  removeShapeWithUndo: (shapeId) => set((state) => {
    const shape = state.shapes.find(s => s.id === shapeId)
    if (!shape) return state
    
    const command = {
      type: 'removeShape',
      shape: shape,
      undo: (store) => {
        store.addShape(shape)
      },
      redo: (store) => {
        store.removeShape(shapeId)
      }
    }
    const newUndoStack = [...state.undoStack, command].slice(-state.maxUndoStack)
    return { shapes: state.shapes.filter(s => s.id !== shapeId), undoStack: newUndoStack, redoStack: [] }
  }),
  
  updateShapeWithUndo: (shapeId, updates) => set((state) => {
    const shape = state.shapes.find(s => s.id === shapeId)
    if (!shape) return state
    
    const oldValues = {}
    Object.keys(updates).forEach(key => {
      oldValues[key] = shape[key]
    })
    
    const command = {
      type: 'updateShape',
      shapeId: shapeId,
      oldValues: oldValues,
      newValues: updates,
      undo: (store) => {
        store.updateShape(shapeId, oldValues)
      },
      redo: (store) => {
        store.updateShape(shapeId, updates)
      }
    }
    const newUndoStack = [...state.undoStack, command].slice(-state.maxUndoStack)
    return { 
      shapes: state.shapes.map(s => s.id === shapeId ? { ...s, ...updates } : s),
      undoStack: newUndoStack,
      redoStack: []
    }
  }),
  
  setMarkers: (markers) => set({ markers }),
  addMarker: (marker) => set((state) => ({ markers: [...state.markers, marker] })),
  removeMarker: (markerId) => set((state) => ({
    markers: state.markers.filter(m => m.id !== markerId)
  })),
  clearMarkers: () => set({ markers: [] }),
  setMarkersVisible: (visible) => set({ markersVisible: visible }),
  setMarkerSnapEnabled: (enabled) => set({ markerSnapEnabled: enabled }),
  
  setGuides: (guides) => set({ guides }),
  addGuide: (guide) => set((state) => ({ guides: [...state.guides, guide] })),
  removeGuide: (guideId) => set((state) => ({
    guides: state.guides.filter(g => g.id !== guideId)
  })),
  updateGuide: (guideId, updates) => set((state) => ({
    guides: state.guides.map(g => g.id === guideId ? { ...g, ...updates } : g)
  })),
  clearGuides: () => set({ guides: [] }),
  setGuidesVisible: (visible) => set({ guidesVisible: visible }),
  setGuidesLocked: (locked) => set({ guidesLocked: locked }),
  
  setLayers: (layers) => set({ layers }),
  addLayer: (layer) => set((state) => ({ layers: [...state.layers, layer] })),
  
  setSelection: (selection) => set({ selection }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  
  setSnap: (snap) => set({ snap }),
  updateSnap: (key, value) => set((state) => ({
    snap: { ...state.snap, [key]: value }
  })),
  
  setMachineProfile: (profile) => set({ machineProfile: profile }),
  
  setViewport: (viewport) => set({ viewport }),
  updateViewport: (updates) => set((state) => ({
    viewport: { ...state.viewport, ...updates }
  })),
  
  setSelectedShapeId: (id) => set({ selectedShapeId: id }),
  setTransformMode: (mode) => set({ transformMode: mode }),
  updateTransformSettings: (key, value) => set((state) => ({
    transformSettings: { ...state.transformSettings, [key]: value }
  })),
  
  setLineEditorState: (state) => set({ lineEditorState: state }),
  updateLineEditorState: (updates) => set((state) => ({
    lineEditorState: { ...(state.lineEditorState || {}), ...updates }
  })),
  
  setShapePropertiesState: (state) => set({ shapePropertiesState: state }),
  updateShapePropertiesState: (updates) => set((state) => ({
    shapePropertiesState: { ...(state.shapePropertiesState || {}), ...updates }
  })),
  
  setTextToolState: (state) => set({ textToolState: state }),
  updateTextToolState: (updates) => set((state) => ({
    textToolState: { ...(state.textToolState || {}), ...updates }
  })),
  
  undo: () => {
    const state = useCadStore.getState()
    if (state.undoStack.length === 0) return
    
    const command = state.undoStack[state.undoStack.length - 1]
    command.undo(useCadStore.getState())
    
    set({
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, command]
    })
  },
  
  redo: () => {
    const state = useCadStore.getState()
    if (state.redoStack.length === 0) return
    
    const command = state.redoStack[state.redoStack.length - 1]
    command.redo(useCadStore.getState())
    
    set({
      redoStack: state.redoStack.slice(0, -1),
      undoStack: [...state.undoStack, command]
    })
  },
  
  pushCommand: (command) => set((state) => ({
    undoStack: [...state.undoStack, command].slice(-state.maxUndoStack),
    redoStack: []
  })),
  
  clearHistory: () => set({ undoStack: [], redoStack: [] }),
  
  updateWorkspace: (updates) => set((state) => ({
    workspace: { ...state.workspace, ...updates }
  })),
  
  setPanelState: (panelId, isOpen) => set((state) => ({
    workspace: {
      ...state.workspace,
      panelStates: { ...state.workspace.panelStates, [panelId]: isOpen }
    }
  })),
  
  setPanelPosition: (panelId, position) => set((state) => ({
    workspace: {
      ...state.workspace,
      panelPositions: { ...state.workspace.panelPositions, [panelId]: position }
    }
  })),
  
  saveWorkspaceState: () => {
    const state = useCadStore.getState()
    const success = saveWorkspace(state.workspace)
    if (success) {
      console.log('✅ Workspace saved successfully')
    }
    return success
  },
  
  loadWorkspaceState: () => {
    const loaded = loadWorkspace()
    if (loaded) {
      set({ workspace: loaded })
      console.log('✅ Workspace loaded successfully')
      return true
    }
    return false
  },
  
  resetWorkspaceState: () => {
    const defaultWorkspace = getDefaultWorkspace()
    resetWorkspaceStorage()
    set({ workspace: defaultWorkspace })
    console.log('✅ Workspace reset to defaults')
    return true
  }
}))

export default useCadStore
