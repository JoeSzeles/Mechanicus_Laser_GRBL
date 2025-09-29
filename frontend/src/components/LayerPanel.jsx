import { useState, useEffect } from 'react'
import './LayerPanel.css'

function LayerPanel({ canvas }) {
  const [layers, setLayers] = useState([])
  const [activeLayer, setActiveLayer] = useState(0)

  useEffect(() => {
    if (!canvas) return

    // Initialize with default layer
    setLayers([{ id: 0, name: 'Layer 1', visible: true, objects: [] }])

    // Listen for canvas changes
    const updateLayers = () => {
      const objects = canvas.getObjects().filter(obj => !obj.isGrid)
      setLayers(prevLayers => 
        prevLayers.map(layer => 
          layer.id === activeLayer 
            ? { ...layer, objects }
            : layer
        )
      )
    }

    canvas.on('object:added', updateLayers)
    canvas.on('object:removed', updateLayers)

    return () => {
      canvas.off('object:added', updateLayers)
      canvas.off('object:removed', updateLayers)
    }
  }, [canvas, activeLayer])

  const addLayer = () => {
    const newLayer = {
      id: layers.length,
      name: `Layer ${layers.length + 1}`,
      visible: true,
      objects: []
    }
    setLayers([...layers, newLayer])
  }

  const toggleLayerVisibility = (layerId) => {
    setLayers(prevLayers =>
      prevLayers.map(layer =>
        layer.id === layerId
          ? { ...layer, visible: !layer.visible }
          : layer
      )
    )
  }

  const deleteLayer = (layerId) => {
    if (layers.length <= 1) return // Keep at least one layer
    setLayers(prevLayers => prevLayers.filter(layer => layer.id !== layerId))
    if (activeLayer === layerId) {
      setActiveLayer(0)
    }
  }

  return (
    <div className="layer-panel">
      <div className="panel-header">
        <h3>Layers</h3>
        <button onClick={addLayer} className="add-button">+</button>
      </div>
      
      <div className="layer-list">
        {layers.map(layer => (
          <div 
            key={layer.id} 
            className={`layer-item ${activeLayer === layer.id ? 'active' : ''}`}
            onClick={() => setActiveLayer(layer.id)}
          >
            <button
              className={`visibility-toggle ${layer.visible ? 'visible' : 'hidden'}`}
              onClick={(e) => {
                e.stopPropagation()
                toggleLayerVisibility(layer.id)
              }}
            >
              {layer.visible ? '👁' : '🚫'}
            </button>
            
            <span className="layer-name">{layer.name}</span>
            <span className="object-count">({layer.objects.length})</span>
            
            {layers.length > 1 && (
              <button
                className="delete-button"
                onClick={(e) => {
                  e.stopPropagation()
                  deleteLayer(layer.id)
                }}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default LayerPanel