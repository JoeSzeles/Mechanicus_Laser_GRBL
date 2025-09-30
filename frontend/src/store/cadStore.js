import { create } from 'zustand'

const useCadStore = create((set) => ({
  shapes: [],
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
  undo: [],

  setShapes: (shapes) => set({ shapes }),
  addShape: (shape) => set((state) => ({ shapes: [...state.shapes, shape] })),
  removeShape: (shapeId) => set((state) => ({
    shapes: state.shapes.filter(s => s.id !== shapeId)
  })),
  
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
  
  pushUndo: (command) => set((state) => ({
    undo: [...state.undo, command]
  })),
  popUndo: () => set((state) => ({
    undo: state.undo.slice(0, -1)
  }))
}))

export default useCadStore
