import { create } from 'zustand'
import { saveWorkspace, loadWorkspace, resetWorkspaceStorage, getDefaultWorkspace } from '../utils/workspaceManager'

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
    bedSizeX: 300,  // Default, will be updated from profile
    bedSizeY: 200,  // Default, will be updated from profile
    mmToPx: 3.7795275591,
    originPoint: 'bottom-left'  // Default origin point
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

  newProject: () => set({
    shapes: [],
    selectedShapeId: null,
    selectedShapeIds: [],
    markers: [],
    guides: [],
    undoStack: [],
    redoStack: [],
    lineEditorState: null,
    shapePropertiesState: null,
    textToolState: null
  }),

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
  },

  // Machine Connection State
  machineConnection: {
    isConnected: false,
    currentProfile: null,
    availableProfiles: [],
    connectionStatus: 'disconnected',
    lastError: null,
    quickConnect: {
      comPort: 'COM4',
      baudRate: 250000
    }
  },

  // Machine Connection Actions
  setMachineConnection: (updates) => set((state) => ({
    machineConnection: { ...state.machineConnection, ...updates }
  })),

  setQuickConnect: (updates) => set((state) => ({
    machineConnection: {
      ...state.machineConnection,
      quickConnect: { ...state.machineConnection.quickConnect, ...updates }
    }
  })),

  setCurrentProfile: (profile) => set((state) => ({
    machineConnection: { ...state.machineConnection, currentProfile: profile }
  })),

  setAvailableProfiles: (profiles) => set((state) => ({
    machineConnection: { ...state.machineConnection, availableProfiles: profiles }
  })),

  setConnectionStatus: (status, error = null) => set((state) => ({
    machineConnection: { 
      ...state.machineConnection, 
      connectionStatus: status,
      isConnected: status === 'connected',
      lastError: error
    }
  })),

  // Load machine profiles from API
  loadMachineProfiles: async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/machine-profiles', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const profiles = await response.json()
      set((state) => ({
        machineConnection: { ...state.machineConnection, availableProfiles: profiles }
      }))
      return profiles
    } catch (error) {
      console.error('Failed to load machine profiles:', error)
      return []
    }
  },

  // Load default machine profile
  loadDefaultProfile: async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/machine-profiles/default', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const profile = await response.json()
      if (profile) {
        set((state) => ({
          machineConnection: { ...state.machineConnection, currentProfile: profile },
          machineProfile: {
            bedSizeX: profile.bedMaxX || 300,
            bedSizeY: profile.bedMaxY || 200,
            mmToPx: 3.7795275591,
            originPoint: profile.originPoint || 'bottom-left'
          }
        }))
      }
      return profile
    } catch (error) {
      console.error('Failed to load default profile:', error)
      return null
    }
  },

  // Save machine profile
  saveMachineProfile: async (profileData) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/machine-profiles', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(profileData)
      })
      const profile = await response.json()

      // Refresh profiles list
      const state = useCadStore.getState()
      await state.loadMachineProfiles()

      return profile
    } catch (error) {
      console.error('Failed to save machine profile:', error)
      throw error
    }
  },

  // Update machine profile
  updateMachineProfile: async (profileId, updates) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/machine-profiles/${profileId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      })
      const profile = await response.json()

      // Refresh profiles list
      const state = useCadStore.getState()
      await state.loadMachineProfiles()

      // Update current profile if it's the one being updated
      if (state.machineConnection.currentProfile?.id === profileId) {
        set((st) => ({
          machineConnection: { ...st.machineConnection, currentProfile: profile }
        }))
      }

      return profile
    } catch (error) {
      console.error('Failed to update machine profile:', error)
      throw error
    }
  },

  // Delete machine profile
  deleteMachineProfile: async (profileId) => {
    try {
      const token = localStorage.getItem('token')
      await fetch(`/api/machine-profiles/${profileId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      // Refresh profiles list
      const state = useCadStore.getState()
      await state.loadMachineProfiles()

      // Clear current profile if it was deleted
      if (state.machineConnection.currentProfile?.id === profileId) {
        set((st) => ({
          machineConnection: { ...st.machineConnection, currentProfile: null }
        }))
      }

      return true
    } catch (error) {
      console.error('Failed to delete machine profile:', error)
      throw error
    }
  },

  // Set profile as default
  setDefaultProfile: async (profileId) => {
    try {
      const token = localStorage.getItem('token')
      await fetch(`/api/machine-profiles/${profileId}/set-default`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      // Refresh profiles list
      const state = useCadStore.getState()
      await state.loadMachineProfiles()

      return true
    } catch (error) {
      console.error('Failed to set default profile:', error)
      throw error
    }
  },

  // Handle mouse down for dragging
  handleMouseDown: (x, y) => {
    const state = get()
    const { shapes, selectedShapes, activeTool } = state

    // Only allow dragging in select mode or when no tool is active
    if (activeTool && activeTool !== 'select') return

    // Check if clicking on a selected shape
    const clickedShape = shapes.find(shape => {
      const tolerance = 5

      if (shape.type === 'line') {
        return state.isPointNearLine(x, y, shape, tolerance)
      } else if (shape.type === 'circle') {
        const dx = x - shape.x
        const dy = y - shape.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        return Math.abs(dist - shape.radius) < tolerance
      } else if (shape.type === 'rectangle') {
        return x >= shape.x && x <= shape.x + shape.width &&
               y >= shape.y && y <= shape.y + shape.height
      } else if (shape.type === 'polygon' || shape.type === 'path' || shape.type === 'freehand') {
        // Check if point is inside polygon bounds
        if (shape.points && shape.points.length > 0) {
          const xs = shape.points.map(p => p.x)
          const ys = shape.points.map(p => p.y)
          const minX = Math.min(...xs)
          const maxX = Math.max(...xs)
          const minY = Math.min(...ys)
          const maxY = Math.max(...ys)
          return x >= minX - tolerance && x <= maxX + tolerance &&
                 y >= minY - tolerance && y <= maxY + tolerance
        }
      } else if (shape.type === 'arc') {
        const dx = x - shape.x
        const dy = y - shape.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const radius = shape.outerRadius || shape.radius || 50
        return Math.abs(dist - radius) < tolerance * 2
      } else if (shape.type === 'text') {
        const width = shape.width || 100
        const height = shape.fontSize || 50
        return x >= shape.x && x <= shape.x + width &&
               y >= shape.y - height && y <= shape.y
      }

      return false
    })

    if (clickedShape && selectedShapes.includes(clickedShape.id)) {
      set({ 
        isDragging: true, 
        dragStart: { x, y },
        dragOffset: shapes
          .filter(s => selectedShapes.includes(s.id))
          .map(s => {
            // Calculate offset based on shape type
            if (s.type === 'line') {
              return {
                id: s.id,
                offsetX: s.x1 - x,
                offsetY: s.y1 - y,
                offsetX2: s.x2 - x,
                offsetY2: s.y2 - y
              }
            } else {
              return {
                id: s.id,
                offsetX: s.x - x,
                offsetY: s.y - y
              }
            }
          })
      })
    }
  },

  // Handle mouse move for dragging
  handleMouseMove: (x, y) => {
    const state = get()
    if (!state.isDragging || !state.dragOffset) return

    const { shapes, selectedShapes, dragOffset } = state

    const updatedShapes = shapes.map(shape => {
      if (!selectedShapes.includes(shape.id)) return shape

      const offset = dragOffset.find(o => o.id === shape.id)
      if (!offset) return shape

      if (shape.type === 'line') {
        return {
          ...shape,
          x1: x + offset.offsetX,
          y1: y + offset.offsetY,
          x2: x + offset.offsetX2,
          y2: y + offset.offsetY2
        }
      } else if (shape.type === 'circle' || shape.type === 'arc') {
        return {
          ...shape,
          x: x + offset.offsetX,
          y: y + offset.offsetY
        }
      } else if (shape.type === 'rectangle') {
        return {
          ...shape,
          x: x + offset.offsetX,
          y: y + offset.offsetY
        }
      } else if (shape.type === 'polygon' || shape.type === 'path' || shape.type === 'freehand') {
        const dx = x - (shape.x || 0)
        const dy = y - (shape.y || 0)
        return {
          ...shape,
          x: x + offset.offsetX,
          y: y + offset.offsetY,
          points: shape.points ? shape.points.map(p => ({
            x: p.x + dx,
            y: p.y + dy
          })) : shape.points
        }
      } else if (shape.type === 'text') {
        return {
          ...shape,
          x: x + offset.offsetX,
          y: y + offset.offsetY
        }
      }

      return shape
    })

    set({ shapes: updatedShapes })
  },

  // Handle mouse up after dragging
  handleMouseUp: () => {
    set({ isDragging: false, dragOffset: null })
  },

  // Helper function to check if a point is near a line
  isPointNearLine: (x, y, line, tolerance) => {
    const { x1, y1, x2, y2 } = line
    const A = x - x1
    const B = y - y1
    const C = x2 - x1
    const D = y2 - y1

    const dot = A * C + B * D
    const lenSq = C * C + D * D
    let param = -1
    if (lenSq !== 0) { // in case of 0 length line
      param = dot / lenSq
    }

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

    const dx = x - xx
    const dy = y - yy
    return Math.sqrt(dx * dx + dy * dy) <= tolerance
  },

  // Helper function to check if a point is inside a shape
  isPointInShape: (x, y, shape) => {
    const tolerance = 5 // A small tolerance for boundary clicks

    switch (shape.type) {
      case 'line':
        return useCadStore.getState().isPointNearLine(x, y, shape, tolerance)
      case 'circle': {
        const dx = x - shape.x
        const dy = y - shape.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        return Math.abs(dist - shape.radius) < tolerance
      }
      case 'rectangle':
        return x >= shape.x - tolerance && x <= shape.x + shape.width + tolerance &&
               y >= shape.y - tolerance && y <= shape.y + shape.height + tolerance
      case 'polygon':
      case 'path':
      case 'freehand': {
        if (shape.points && shape.points.length > 0) {
          const xs = shape.points.map(p => p.x)
          const ys = shape.points.map(p => p.y)
          const minX = Math.min(...xs)
          const maxX = Math.max(...xs)
          const minY = Math.min(...ys)
          const maxY = Math.max(...ys)
          return x >= minX - tolerance && x <= maxX + tolerance &&
                 y >= minY - tolerance && y <= maxY + tolerance
        }
        return false
      }
      case 'arc': {
        const dx = x - shape.x
        const dy = y - shape.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const radius = shape.outerRadius || shape.radius || 50
        return Math.abs(dist - radius) < tolerance * 2
      }
      case 'text': {
        const width = shape.width || 100
        const height = shape.fontSize || 50
        return x >= shape.x - tolerance && x <= shape.x + width + tolerance &&
               y >= shape.y - height - tolerance && y <= shape.y + tolerance
      }
      default:
        return false
    }
  },

  // Select shape(s)
  selectShapes: (shapeIds, clearSelection = true) => set((state) => {
    const { selection } = state
    let newSelectedIds = clearSelection ? [] : (selection?.ids || [])
    
    shapeIds.forEach(id => {
      if (!newSelectedIds.includes(id)) {
        newSelectedIds.push(id)
      }
    })

    // Update selection state
    const selectedShapes = state.shapes.filter(s => newSelectedIds.includes(s.id))
    return {
      selection: {
        ids: newSelectedIds,
        shapes: selectedShapes,
        // Calculate bounding box of selected shapes
        ...state.calculateBoundingBox(selectedShapes)
      }
    }
  }),

  // Deselect shape(s)
  deselectShapes: (shapeIds) => set((state) => {
    const newSelectedIds = (state.selection?.ids || []).filter(id => !shapeIds.includes(id))
    const selectedShapes = state.shapes.filter(s => newSelectedIds.includes(s.id))
    
    // Update selection state
    return {
      selection: {
        ids: newSelectedIds,
        shapes: selectedShapes,
        // Calculate bounding box of selected shapes
        ...state.calculateBoundingBox(selectedShapes)
      }
    }
  }),

  // Clear selection
  clearSelection: () => set({
    selection: null
  }),

  // Calculate bounding box of selected shapes
  calculateBoundingBox: (selectedShapes) => {
    if (!selectedShapes || selectedShapes.length === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 }
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

    selectedShapes.forEach(shape => {
      switch (shape.type) {
        case 'line':
          minX = Math.min(minX, shape.x1, shape.x2)
          minY = Math.min(minY, shape.y1, shape.y2)
          maxX = Math.max(maxX, shape.x1, shape.x2)
          maxY = Math.max(maxY, shape.y1, shape.y2)
          break
        case 'circle':
        case 'arc':
          minX = Math.min(minX, shape.x - shape.radius)
          minY = Math.min(minY, shape.y - shape.radius)
          maxX = Math.max(maxX, shape.x + shape.radius)
          maxY = Math.max(maxY, shape.y + shape.radius)
          break
        case 'rectangle':
          minX = Math.min(minX, shape.x)
          minY = Math.min(minY, shape.y)
          maxX = Math.max(maxX, shape.x + shape.width)
          maxY = Math.max(maxY, shape.y + shape.height)
          break
        case 'polygon':
        case 'path':
        case 'freehand':
          if (shape.points && shape.points.length > 0) {
            shape.points.forEach(p => {
              minX = Math.min(minX, p.x)
              minY = Math.min(minY, p.y)
              maxX = Math.max(maxX, p.x)
              maxY = Math.max(maxY, p.y)
            })
          }
          break
        case 'text': {
          const width = shape.width || 100
          const height = shape.fontSize || 50
          minX = Math.min(minX, shape.x)
          minY = Math.min(minY, shape.y - height)
          maxX = Math.max(maxX, shape.x + width)
          maxY = Math.max(maxY, shape.y)
          break
        }
        default:
          break
      }
    })

    // Add a small buffer around the bounding box for selection handles
    const buffer = 10
    minX -= buffer
    minY -= buffer
    maxX += buffer
    maxY += buffer

    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
  },

  // Apply transform to selected shapes
  applyTransform: (transformMatrix) => set((state) => {
    const { shapes, selection } = state
    if (!selection || selection.ids.length === 0) return state

    const updatedShapes = shapes.map(shape => {
      if (!selection.ids.includes(shape.id)) return shape

      // Apply transformation based on shape type
      switch (shape.type) {
        case 'line': {
          const p1 = transformMatrix.transformPoint(shape.x1, shape.y1)
          const p2 = transformMatrix.transformPoint(shape.x2, shape.y2)
          return { ...shape, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y }
        }
        case 'circle':
        case 'arc': {
          const p = transformMatrix.transformPoint(shape.x, shape.y)
          // Also need to consider scaling the radius if the transform is not uniform
          // For simplicity, assuming uniform scaling or rotation only for now
          return { ...shape, x: p.x, y: p.y }
        }
        case 'rectangle': {
          const p1 = transformMatrix.transformPoint(shape.x, shape.y)
          const p2 = transformMatrix.transformPoint(shape.x + shape.width, shape.y)
          const p3 = transformMatrix.transformPoint(shape.x + shape.width, shape.y + shape.height)
          const p4 = transformMatrix.transformPoint(shape.x, shape.y + shape.height)

          // Recalculate new x, y, width, height based on transformed points
          const minX = Math.min(p1.x, p2.x, p3.x, p4.x)
          const minY = Math.min(p1.y, p2.y, p3.y, p4.y)
          const maxX = Math.max(p1.x, p2.x, p3.x, p4.x)
          const maxY = Math.max(p1.y, p2.y, p3.y, p4.y)
          return { ...shape, x: minX, y: minY, width: maxX - minX, height: maxY - minY }
        }
        case 'polygon':
        case 'path':
        case 'freehand': {
          if (shape.points) {
            const newPoints = shape.points.map(p => transformMatrix.transformPoint(p.x, p.y))
            return { ...shape, points: newPoints }
          }
          return shape
        }
        case 'text': {
          const p = transformMatrix.transformPoint(shape.x, shape.y)
          // Text transformations can be complex, especially rotation and scaling affecting bounding box
          // For simplicity, just moving the origin point
          return { ...shape, x: p.x, y: p.y }
        }
        default:
          return shape
      }
    })

    // Recalculate bounding box after transformation
    const newSelection = {
      ...state.selection,
      shapes: updatedShapes.filter(s => state.selection.ids.includes(s.id)),
      ...state.calculateBoundingBox(updatedShapes.filter(s => state.selection.ids.includes(s.id)))
    }

    return { shapes: updatedShapes, selection: newSelection }
  }),

  // Function to convert SVG path data to shape points
  svgPathToPoints: (pathData) => {
    const points = [];
    const commands = pathData.match(/[a-zA-Z][^a-zA-Z]*/g);

    if (!commands) return points;

    let currentX = 0, currentY = 0;

    for (const command of commands) {
      const type = command[0];
      const args = command.substring(1).trim().split(/[\s,]+/).map(parseFloat);

      switch (type) {
        case 'M': // moveto (absolute)
        case 'L': // lineto (absolute)
        case 'T': // smooth lineto (absolute)
          currentX = args[0];
          currentY = args[1];
          points.push({ x: currentX, y: currentY });
          break;
        case 'm': // moveto (relative)
        case 'l': // lineto (relative)
        case 't': // smooth lineto (relative)
          currentX += args[0];
          currentY += args[1];
          points.push({ x: currentX, y: currentY });
          break;
        case 'H': // horizontal lineto (absolute)
          currentX = args[0];
          points.push({ x: currentX, y: currentY });
          break;
        case 'h': // horizontal lineto (relative)
          currentX += args[0];
          points.push({ x: currentX, y: currentY });
          break;
        case 'V': // vertical lineto (absolute)
          currentY = args[0];
          points.push({ x: currentX, y: currentY });
          break;
        case 'v': // vertical lineto (relative)
          currentY += args[0];
          points.push({ x: currentX, y: currentY });
          break;
        case 'C': // curveto (absolute)
        case 'S': // smooth curveto (absolute)
          // For simplicity, we'll approximate curves with line segments
          // A more accurate approach would involve Bezier curve calculations
          currentX = args[4];
          currentY = args[5];
          points.push({ x: currentX, y: currentY });
          break;
        case 'c': // curveto (relative)
        case 's': // smooth curveto (relative)
          // Approximation
          currentX += args[4];
          currentY += args[5];
          points.push({ x: currentX, y: currentY });
          break;
        case 'Q': // quadratic curveto (absolute)
        case 'T': // smooth quadratic curveto (absolute)
          // Approximation
          currentX = args[2];
          currentY = args[3];
          points.push({ x: currentX, y: currentY });
          break;
        case 'q': // quadratic curveto (relative)
        case 't': // smooth quadratic curveto (relative)
          // Approximation
          currentX += args[2];
          currentY += args[3];
          points.push({ x: currentX, y: currentY });
          break;
        case 'A': // elliptical arc (absolute)
          // Approximation: Treat as a straight line for simplicity
          currentX = args[5];
          currentY = args[6];
          points.push({ x: currentX, y: currentY });
          break;
        case 'a': // elliptical arc (relative)
          // Approximation
          currentX += args[5];
          currentY += args[6];
          points.push({ x: currentX, y: currentY });
          break;
        case 'Z': // closepath
        case 'z': // closepath
          // No point added, path is closed
          break;
        default:
          console.warn(`Unsupported SVG path command: ${type}`);
      }
    }
    return points;
  },

  // Function to convert SVG path data to a circle or arc approximation
  svgPathToCircleOrArc: (pathData) => {
    const commands = pathData.match(/[a-zA-Z][^a-zA-Z]*/g);
    if (!commands) return null;

    let startX = 0, startY = 0;
    let currentX = 0, currentY = 0;
    let lastCommandType = '';

    for (const command of commands) {
      const type = command[0];
      const args = command.substring(1).trim().split(/[\s,]+/).map(parseFloat);

      switch (type) {
        case 'M':
          startX = currentX = args[0];
          startY = currentY = args[1];
          lastCommandType = 'M';
          break;
        case 'm':
          startX = currentX += args[0];
          startY = currentY += args[1];
          lastCommandType = 'm';
          break;
        case 'L':
        case 'H':
        case 'V':
          currentX = args[0];
          currentY = args.length > 1 ? args[1] : currentY;
          lastCommandType = type;
          break;
        case 'l':
        case 'h':
        case 'v':
          currentX += args[0];
          currentY += args.length > 1 ? args[1] : args[0];
          lastCommandType = type;
          break;
        case 'A': {
          const [rx, ry, xAxisRotation, largeArcFlag, sweepFlag, x, y] = args;
          // If it's an arc command, try to determine center and radius
          // This is a simplified approximation. Accurate SVG arc to circle conversion is complex.
          const radius = Math.sqrt(rx * rx + ry * ry); // Use average radius as approximation
          const centerX = x; // Approximation
          const centerY = y; // Approximation

          // Check if it's a full circle (often represented by arc commands)
          // This check is heuristic and might not cover all cases.
          const isLikelyFullCircle = Math.abs(x - startX) < 1 && Math.abs(y - startY) < 1 && (largeArcFlag !== sweepFlag);

          if (isLikelyFullCircle) {
            // Try to find the center more accurately if possible
            // This part is highly dependent on the specific SVG generation
            // For now, assume center is roughly start point if it's a full circle
            const approxCenterX = startX;
            const approxCenterY = startY;
            return { type: 'circle', x: approxCenterX, y: approxCenterY, radius: radius };
          } else {
            // Approximate as an arc segment
            return { type: 'arc', x: centerX, y: centerY, radius: radius, startAngle: 0, endAngle: Math.PI * 2 }; // Placeholder angles
          }
        }
        case 'a': {
          const [rx, ry, xAxisRotation, largeArcFlag, sweepFlag, x, y] = args;
          const radius = Math.sqrt(rx * rx + ry * ry);
          const centerX = currentX + x;
          const centerY = currentY + y;
           // Check if it's a full circle (often represented by arc commands)
          const isLikelyFullCircle = Math.abs(x) < 1 && Math.abs(y) < 1 && (largeArcFlag !== sweepFlag);

          if (isLikelyFullCircle) {
            const approxCenterX = startX;
            const approxCenterY = startY;
            return { type: 'circle', x: approxCenterX, y: approxCenterY, radius: radius };
          } else {
             return { type: 'arc', x: centerX, y: centerY, radius: radius, startAngle: 0, endAngle: Math.PI * 2 }; // Placeholder angles
          }
        }
        case 'Z':
        case 'z':
          // Close path, potentially forms a closed shape like a polygon
          lastCommandType = 'Z';
          break;
        default:
          console.warn(`Unsupported SVG path command for circle/arc detection: ${type}`);
      }
    }

    // Fallback: if only one command and it's 'M', maybe it's a degenerate shape?
    if (commands.length === 1 && lastCommandType === 'M') {
        return { type: 'point', x: startX, y: startY };
    }

    // If we processed commands but didn't identify a circle/arc, return null
    return null;
  },

  // Convert SVG path to a shape object
  addSvgPath: (pathData, options = {}) => {
    const { x = 0, y = 0, layerId = 'layer1', color = '#000000' } = options;
    const points = useCadStore.getState().svgPathToPoints(pathData);

    if (points.length === 0) {
      console.warn("SVG path resulted in no points.");
      return;
    }

    // Attempt to interpret as a circle or arc first
    const circleOrArc = useCadStore.getState().svgPathToCircleOrArc(pathData);

    if (circleOrArc) {
        if (circleOrArc.type === 'circle') {
            useCadStore.getState().addShape({
                id: crypto.randomUUID(),
                type: 'circle',
                x: circleOrArc.x + x,
                y: circleOrArc.y + y,
                radius: circleOrArc.radius,
                layerId,
                color,
                ...options
            });
            return;
        } else if (circleOrArc.type === 'arc') {
             useCadStore.getState().addShape({
                id: crypto.randomUUID(),
                type: 'arc',
                x: circleOrArc.x + x,
                y: circleOrArc.y + y,
                radius: circleOrArc.radius, // Use outerRadius or radius
                startAngle: circleOrArc.startAngle,
                endAngle: circleOrArc.endAngle,
                layerId,
                color,
                ...options
            });
            return;
        }
    }

    // If not a circle or arc, treat as a polygon or path
    if (points.length === 1) {
      // If only one point, treat as a marker or a very small shape
      useCadStore.getState().addShape({
        id: crypto.randomUUID(),
        type: 'point', // Or consider a small circle
        x: points[0].x + x,
        y: points[0].y + y,
        layerId,
        color,
        ...options
      });
    } else {
      // Determine if it's a closed path (polygon) or open path (path/freehand)
      const isClosed = pathData.trim().toUpperCase().endsWith('Z');
      useCadStore.getState().addShape({
        id: crypto.randomUUID(),
        type: isClosed ? 'polygon' : 'path',
        points: points.map(p => ({ x: p.x + x, y: p.y + y })),
        layerId,
        color,
        ...options,
        closed: isClosed // Explicitly add closed property
      });
    }
  },

  // Convert text to a shape (approximated by a rectangle or path)
  addTextShape: (text, options = {}) => {
    const { x = 0, y = 0, layerId = 'layer1', color = '#000000', fontSize = 20, fontFamily = 'Arial' } = options;

    // For simplicity, represent text as a rectangle for now.
    // A more advanced implementation would use actual font rendering to get path data.
    const textShape = {
      id: crypto.randomUUID(),
      type: 'text',
      text: text,
      x: x,
      y: y,
      fontSize: fontSize,
      fontFamily: fontFamily,
      color: color,
      layerId: layerId,
      width: text.length * (fontSize * 0.6), // Approximate width based on text length and font size
      height: fontSize, // Approximate height
      ...options
    };
    useCadStore.getState().addShape(textShape);
  },

  // Convert shape to SVG path data
  shapeToSvgPath: (shape) => {
    switch (shape.type) {
      case 'line':
        return `M ${shape.x1} ${shape.y1} L ${shape.x2} ${shape.y2}`;
      case 'circle':
        // SVG circles are elements, not path data. Representing as path is an approximation.
        // A common way is to use arcs.
        const radius = shape.radius;
        const cx = shape.x;
        const cy = shape.y;
        return `M ${cx - radius} ${cy} A ${radius} ${radius} 0 1 0 ${cx + radius} ${cy} A ${radius} ${radius} 0 1 0 ${cx - radius} ${cy} Z`;
      case 'rectangle':
        return `M ${shape.x} ${shape.y} L ${shape.x + shape.width} ${shape.y} L ${shape.x + shape.width} ${shape.y + shape.height} L ${shape.x} ${shape.y + shape.height} Z`;
      case 'polygon':
      case 'path':
      case 'freehand':
        if (!shape.points || shape.points.length === 0) return '';
        const startPoint = shape.points[0];
        let path = `M ${startPoint.x} ${startPoint.y}`;
        for (let i = 1; i < shape.points.length; i++) {
          path += ` L ${shape.points[i].x} ${shape.points[i].y}`;
        }
        if (shape.closed || shape.type === 'polygon') { // Add Z for closed paths/polygons
          path += ' Z';
        }
        return path;
      case 'arc':
        // SVG arcs are complex. This is a placeholder.
        // Requires start angle, end angle, radii, rotation.
        // For now, represent as a line segment approximation or a partial circle path.
        // A simplified arc path:
        const radiusArc = shape.outerRadius || shape.radius || 50;
        const startAngle = shape.startAngle || 0;
        const endAngle = shape.endAngle || Math.PI / 2;
        const cxArc = shape.x;
        const cyArc = shape.y;

        // Convert angles to Cartesian coordinates for start and end points
        const startXArc = cxArc + radiusArc * Math.cos(startAngle);
        const startYArc = cyArc + radiusArc * Math.sin(startAngle);
        const endXArc = cxArc + radiusArc * Math.cos(endAngle);
        const endYArc = cyArc + radiusArc * Math.sin(endAngle);

        // SVG arc command parameters: rx ry x-axis-rotation large-arc-flag sweep-flag x y
        // Determining flags requires more info about the arc's specific geometry.
        // Assuming sweep-flag=1 and large-arc-flag=0 for a typical arc segment.
        return `M ${startXArc} ${startYArc} A ${radiusArc} ${radiusArc} 0 0 1 ${endXArc} ${endYArc}`;
      case 'text':
        // Text is not directly converted to path data in this context.
        // For export, it might be rendered to an image or a basic bounding box.
        // Return a rectangle for now as a placeholder.
        const width = shape.width || 100;
        const height = shape.fontSize || 50;
        return `M ${shape.x} ${shape.y - height} L ${shape.x + width} ${shape.y - height} L ${shape.x + width} ${shape.y} L ${shape.x} ${shape.y} Z`;
      default:
        return '';
    }
  },

}))

export default useCadStore