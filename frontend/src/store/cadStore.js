import { create } from 'zustand'

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
  undo: [],

  setShapes: (shapes) => set({ shapes }),
  addShape: (shape) => set((state) => ({ shapes: [...state.shapes, shape] })),
  updateShape: (shapeId, updates) => set((state) => ({
    shapes: state.shapes.map(s => s.id === shapeId ? { ...s, ...updates } : s)
  })),
  removeShape: (shapeId) => set((state) => ({
    shapes: state.shapes.filter(s => s.id !== shapeId)
  })),
  
  setMarkers: (markers) => set({ markers }),
  addMarker: (marker) => set((state) => ({ markers: [...state.markers, marker] })),
  removeMarker: (markerId) => set((state) => ({
    markers: state.markers.filter(m => m.id !== markerId)
  })),
  clearMarkers: () => set({ markers: [] }),
  setMarkersVisible: (visible) => set({ markersVisible: visible }),
  
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
  
  pushUndo: (command) => set((state) => ({
    undo: [...state.undo, command]
  })),
  popUndo: () => set((state) => ({
    undo: state.undo.slice(0, -1)
  }))
}))

export default useCadStore
