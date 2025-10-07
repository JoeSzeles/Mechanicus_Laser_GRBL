import { useState, useEffect } from 'react'
import useCadStore from '../store/cadStore'
import './ContextMenu.css'

function ContextMenu({ x, y, onClose, selectedShapeIds, selectedShapeId }) {
  const layers = useCadStore((state) => state.layers)
  const updateShape = useCadStore((state) => state.updateShape)
  const removeShapeWithUndo = useCadStore((state) => state.removeShapeWithUndo)
  const setShapes = useCadStore((state) => state.setShapes)
  const shapes = useCadStore((state) => state.shapes)
  const [showLayerSubmenu, setShowLayerSubmenu] = useState(false)

  // Get all selected shape IDs (either multi-selection or single selection)
  const allSelectedIds = selectedShapeIds.length > 0 ? selectedShapeIds : (selectedShapeId ? [selectedShapeId] : [])

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => onClose()
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [onClose])

  const handleEngraveSelected = () => {
    const allSelectedIds = selectedShapeIds.length > 0 ? selectedShapeIds : (selectedShapeId ? [selectedShapeId] : [])

    // Verify shapes exist in store
    const currentShapes = useCadStore.getState().shapes
    console.log('🔥 Context Menu - Engrave Selected clicked:', {
      allSelectedIds,
      selectedShapeIds,
      selectedShapeId,
      shapesCount: allSelectedIds.length,
      shapesInStore: currentShapes.length,
      shapesInStoreIds: currentShapes.map(s => s.id)
    })

    // Dispatch custom event with selected shape IDs
    const event = new CustomEvent('engrave-selected', {
      detail: { shapeIds: allSelectedIds }
    })
    window.dispatchEvent(event)
    onClose()
  }

  const handleDeleteSelected = () => {
    allSelectedIds.forEach(id => {
      removeShapeWithUndo(id)
    })
    onClose()
  }

  const handleClearCanvas = () => {
    if (window.confirm('Clear entire canvas? This cannot be undone.')) {
      setShapes([])
      onClose()
    }
  }

  const handleAssignToLayer = (layerId) => {
    allSelectedIds.forEach(id => {
      updateShape(id, { layerId })
    })
    onClose()
  }

  // Get current layer of selected shape (for highlighting active layer)
  const currentLayerId = allSelectedIds.length === 1 
    ? shapes.find(s => s.id === allSelectedIds[0])?.layerId 
    : null

  return (
    <div 
      className="context-menu" 
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      <div 
        className="context-menu-item"
        onClick={handleEngraveSelected}
        style={{ opacity: allSelectedIds.length === 0 ? 0.5 : 1 }}
      >
        🔥 Engrave Selected ({allSelectedIds.length})
      </div>

      <div className="context-menu-separator" />

      <div 
        className="context-menu-item"
        onClick={handleDeleteSelected}
        style={{ opacity: allSelectedIds.length === 0 ? 0.5 : 1 }}
      >
        🗑 Delete Selected ({allSelectedIds.length})
      </div>

      <div className="context-menu-separator" />

      <div 
        className="context-menu-item context-menu-danger"
        onClick={handleClearCanvas}
      >
        ⚠️ Clear Canvas
      </div>

      <div className="context-menu-separator" />

      <div 
        className="context-menu-item context-menu-submenu"
        onMouseEnter={() => setShowLayerSubmenu(true)}
        onMouseLeave={() => setShowLayerSubmenu(false)}
        style={{ opacity: allSelectedIds.length === 0 ? 0.5 : 1 }}
      >
        📁 Add to Layer ({allSelectedIds.length}) ▶

        {showLayerSubmenu && (
          <div className="context-submenu">
            {layers.map(layer => (
              <div
                key={layer.id}
                className={`context-menu-item ${layer.id === currentLayerId ? 'active-layer' : ''}`}
                onClick={() => handleAssignToLayer(layer.id)}
              >
                <span className={`layer-indicator ${layer.visible ? 'visible' : 'hidden'} ${layer.locked ? 'locked' : ''}`} />
                {layer.name}
                {layer.id === currentLayerId && ' ✓'}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default ContextMenu