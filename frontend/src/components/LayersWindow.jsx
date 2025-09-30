import { useState } from 'react'
import useCadStore from '../store/cadStore'
import './LayersWindow.css'

function LayersWindow() {
  const layers = useCadStore((state) => state.layers)
  const shapes = useCadStore((state) => state.shapes)
  const selectedShapeId = useCadStore((state) => state.selectedShapeId)
  const setLayers = useCadStore((state) => state.setLayers)
  const addLayer = useCadStore((state) => state.addLayer)
  const updateShape = useCadStore((state) => state.updateShape)
  
  const [editingLayerId, setEditingLayerId] = useState(null)
  const [editingName, setEditingName] = useState('')
  
  const handleAddLayer = () => {
    const newLayer = {
      id: `layer-${Date.now()}`,
      name: `Layer ${layers.length + 1}`,
      visible: true,
      locked: false
    }
    addLayer(newLayer)
  }
  
  const handleDeleteLayer = (layerId) => {
    if (layers.length <= 1) {
      alert('Cannot delete the last layer')
      return
    }
    
    const remainingLayers = layers.filter(l => l.id !== layerId)
    setLayers(remainingLayers)
    
    shapes.forEach(shape => {
      if (shape.layerId === layerId) {
        updateShape(shape.id, { layerId: remainingLayers[0].id })
      }
    })
  }
  
  const handleToggleVisibility = (layerId) => {
    const updatedLayers = layers.map(layer =>
      layer.id === layerId ? { ...layer, visible: !layer.visible } : layer
    )
    setLayers(updatedLayers)
  }
  
  const handleToggleLock = (layerId) => {
    const updatedLayers = layers.map(layer =>
      layer.id === layerId ? { ...layer, locked: !layer.locked } : layer
    )
    setLayers(updatedLayers)
  }
  
  const handleStartRename = (layer) => {
    setEditingLayerId(layer.id)
    setEditingName(layer.name)
  }
  
  const handleFinishRename = () => {
    if (editingName.trim()) {
      const updatedLayers = layers.map(layer =>
        layer.id === editingLayerId ? { ...layer, name: editingName.trim() } : layer
      )
      setLayers(updatedLayers)
    }
    setEditingLayerId(null)
    setEditingName('')
  }
  
  const handleAssignToLayer = (layerId) => {
    if (selectedShapeId) {
      updateShape(selectedShapeId, { layerId })
    }
  }
  
  const selectedShape = shapes.find(s => s.id === selectedShapeId)
  
  return (
    <div className="layers-window">
      <div className="layers-header">
        <button className="icon-btn add-btn" onClick={handleAddLayer} title="New Layer">
          +
        </button>
        <span className="header-title">Layers</span>
      </div>
      
      <div className="layers-list">
        {layers.map((layer) => (
          <div key={layer.id} className="layer-item">
            <div className="layer-controls">
              <button 
                className={`icon-btn visibility-btn ${layer.visible ? 'visible' : 'hidden'}`}
                onClick={() => handleToggleVisibility(layer.id)}
                title={layer.visible ? 'Hide layer' : 'Show layer'}
              >
                {layer.visible ? '👁' : '👁‍🗨'}
              </button>
              <button 
                className={`icon-btn lock-btn ${layer.locked ? 'locked' : ''}`}
                onClick={() => handleToggleLock(layer.id)}
                title={layer.locked ? 'Unlock layer' : 'Lock layer'}
              >
                {layer.locked ? '🔒' : '🔓'}
              </button>
            </div>
            
            {editingLayerId === layer.id ? (
              <input
                type="text"
                className="layer-name-input"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={handleFinishRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleFinishRename()
                  if (e.key === 'Escape') {
                    setEditingLayerId(null)
                    setEditingName('')
                  }
                }}
                autoFocus
              />
            ) : (
              <div 
                className="layer-name"
                onDoubleClick={() => handleStartRename(layer)}
              >
                {layer.name}
              </div>
            )}
            
            {layers.length > 1 && (
              <button 
                className="icon-btn delete-btn"
                onClick={() => handleDeleteLayer(layer.id)}
                title="Delete layer"
              >
                🗑
              </button>
            )}
          </div>
        ))}
      </div>
      
      {selectedShape && (
        <div className="assign-section">
          <label>
            Assign selected to:
            <select 
              value={selectedShape.layerId || layers[0].id}
              onChange={(e) => handleAssignToLayer(e.target.value)}
            >
              {layers.map(layer => (
                <option key={layer.id} value={layer.id}>{layer.name}</option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  )
}

export default LayersWindow
