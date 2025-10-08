
import { useState, useEffect } from 'react'
import useCadStore from '../store/cadStore'
import { parseSVGFile, transformImportedShapes } from '../utils/svgImportUtils'
import './SVGImportDialog.css'

function SVGImportDialog({ file, onClose, onImport }) {
  const machineProfile = useCadStore((state) => state.machineProfile)
  const layers = useCadStore((state) => state.layers)
  const addLayer = useCadStore((state) => state.addLayer)
  
  const [svgData, setSvgData] = useState(null)
  const [useOriginalSize, setUseOriginalSize] = useState(true)
  const [targetWidth, setTargetWidth] = useState(100)
  const [targetHeight, setTargetHeight] = useState(100)
  const [alignment, setAlignment] = useState('bottom-left')
  const [selectedLayer, setSelectedLayer] = useState('new')
  const [newLayerName, setNewLayerName] = useState('Imported SVG')
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    if (file) {
      parseSVGFile(file, machineProfile).then(data => {
        setSvgData(data)
        setTargetWidth(data.originalWidth)
        setTargetHeight(data.originalHeight)
        setLoading(false)
      }).catch(error => {
        console.error('SVG parse error:', error)
        alert('Failed to parse SVG: ' + error.message)
        onClose()
      })
    }
  }, [file, machineProfile, onClose])
  
  const handleImport = () => {
    if (!svgData) return
    
    // Determine layer
    let layerId = selectedLayer
    if (selectedLayer === 'new') {
      const newLayer = {
        id: `layer-${Date.now()}`,
        name: newLayerName,
        visible: true,
        locked: false
      }
      addLayer(newLayer)
      layerId = newLayer.id
    }
    
    // Transform shapes
    const transformedShapes = transformImportedShapes(svgData.shapes, {
      targetWidth: useOriginalSize ? svgData.originalWidth : targetWidth,
      targetHeight: useOriginalSize ? svgData.originalHeight : targetHeight,
      originalWidth: svgData.originalWidth,
      originalHeight: svgData.originalHeight,
      alignment,
      layerId,
      useOriginalSize
    }, machineProfile)
    
    onImport(transformedShapes)
    onClose()
  }
  
  if (loading) {
    return (
      <div className="svg-import-overlay">
        <div className="svg-import-dialog">
          <p>Loading SVG...</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="svg-import-overlay">
      <div className="svg-import-dialog">
        <h2>Import SVG</h2>
        
        <div className="import-section">
          <h3>Size</h3>
          <div className="size-info">
            <p>Original: {svgData.originalWidth.toFixed(2)} × {svgData.originalHeight.toFixed(2)} mm</p>
          </div>
          
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={useOriginalSize}
              onChange={(e) => setUseOriginalSize(e.target.checked)}
            />
            Use original size
          </label>
          
          {!useOriginalSize && (
            <div className="size-inputs">
              <label>
                Width (mm):
                <input
                  type="number"
                  value={targetWidth}
                  onChange={(e) => setTargetWidth(parseFloat(e.target.value))}
                  step="0.1"
                />
              </label>
              <label>
                Height (mm):
                <input
                  type="number"
                  value={targetHeight}
                  onChange={(e) => setTargetHeight(parseFloat(e.target.value))}
                  step="0.1"
                />
              </label>
            </div>
          )}
        </div>
        
        <div className="import-section">
          <h3>Alignment</h3>
          <div className="alignment-grid">
            {['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'].map(align => (
              <button
                key={align}
                className={`alignment-btn ${alignment === align ? 'active' : ''}`}
                onClick={() => setAlignment(align)}
              >
                <div className="alignment-visual">
                  <div className={`inner-rect ${align}`}></div>
                </div>
                <span>{align.replace('-', ' ')}</span>
              </button>
            ))}
          </div>
        </div>
        
        <div className="import-section">
          <h3>Layer</h3>
          <select value={selectedLayer} onChange={(e) => setSelectedLayer(e.target.value)}>
            <option value="new">New Layer</option>
            {layers.map(layer => (
              <option key={layer.id} value={layer.id}>{layer.name}</option>
            ))}
          </select>
          
          {selectedLayer === 'new' && (
            <input
              type="text"
              value={newLayerName}
              onChange={(e) => setNewLayerName(e.target.value)}
              placeholder="Layer name"
              className="layer-name-input"
            />
          )}
        </div>
        
        <div className="dialog-buttons">
          <button onClick={onClose}>Cancel</button>
          <button onClick={handleImport} className="primary">Import</button>
        </div>
      </div>
    </div>
  )
}

export default SVGImportDialog
