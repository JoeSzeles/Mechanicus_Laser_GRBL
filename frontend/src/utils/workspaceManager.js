const WORKSPACE_KEY = 'mechanicus_workspace'

export const saveWorkspace = (state) => {
  try {
    const workspaceState = {
      panelStates: state.panelStates || {},
      panelPositions: state.panelPositions || {},
      gridVisible: state.gridVisible,
      gridSize: state.gridSize,
      gridSnap: state.gridSnap,
      selectedTool: state.selectedTool,
      zoomLevel: state.zoomLevel,
      viewportPosition: state.viewportPosition,
      timestamp: Date.now()
    }

    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspaceState))
    console.log('💾 Workspace saved:', workspaceState)
    return true
  } catch (error) {
    console.error('Failed to save workspace:', error)
    return false
  }
}

export const loadWorkspace = () => {
  try {
    const saved = localStorage.getItem(WORKSPACE_KEY)
    if (!saved) {
      console.log('No saved workspace found')
      return null
    }

    const workspace = JSON.parse(saved)
    console.log('📂 Workspace loaded:', workspace)
    return workspace
  } catch (error) {
    console.error('Failed to load workspace:', error)
    return null
  }
}

export const resetWorkspace = () => {
  try {
    localStorage.removeItem(WORKSPACE_KEY)
    console.log('🔄 Workspace reset to defaults')
    return true
  } catch (error) {
    console.error('Failed to reset workspace:', error)
    return false
  }
}

export const getDefaultWorkspace = () => {
  return {
    panelStates: {
      drawingTools: true,
      layers: true,
      shapeProperties: true,
      snapTools: false,
      markersGuides: false,
      transformTools: false,
      lineEditorTools: false,
      textTools: false,
      engravingTools: false
    },
    gridVisible: true,
    gridSize: 10,
    gridSnap: false,
    selectedTool: 'select',
    zoomLevel: 100,
    viewportPosition: { x: 0, y: 0 }
  }
}