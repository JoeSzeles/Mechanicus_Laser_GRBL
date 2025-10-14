
import { useState, useEffect } from 'react'
import useCadStore from '../store/cadStore'
import { parseImageFile, createImageShape } from '../utils/imageImportUtils'
import './ImageImportDialog.css'

function ImageImportDialog({ file, onClose, onImport }) {
  const machineProfile = useCadStore((state) => state.machineProfile)
  const layers = useCadStore((state) => state.layers)
  const addLayer = useCadStore((state) => state.addLayer)
  
  const [imageData, setImageData] = useState(null)
  const [useOriginalSize, setUseOriginalSize] = useState(true)
  const [targetWidth, setTargetWidth] = useState(100)
  const [targetHeight, setTargetHeight] = useState(100)
  const [maintainAspect, setMaintainAspect] = useState(true)
  const [alignment, setAlignment] = useState('bottom-left')
  const [selectedLayer, setSelectedLayer] = useState('new')
  const [newLayerName, setNewLayerName] = useState('Imported Image')
  const [opacity, setOpacity] = useState(100)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    if (file) {
      parseImageFile(file).then(data => {
        setImageData(data)
        setTargetWidth(data.originalWidth)
        setTargetHeight(data.originalHeight)
        setLoading(false)
      }).catch(error => {
        console.error('Image parse error:', error)
        alert('Failed to parse image: ' + error.message)
        onClose()
      })
    }
  }, [file, onClose])
  
  const handleWidthChange = (newWidth) => {
    setTargetWidth(newWidth)
    if (maintainAspect && imageData) {
      setTargetHeight(newWidth / imageData.aspectRatio)
    }
  }
  
  const handleHeightChange = (newHeight) => {
    setTargetHeight(newHeight)
    if (maintainAspect && imageData) {
      setTargetWidth(newHeight * imageData.aspectRatio)
    }
  }
  
  const handleImport = () => {
    if (!imageData) return
    
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
    
    // Create image shape
    const imageShape = createImageShape(imageData, {
      targetWidth: useOriginalSize ? imageData.originalWidth : targetWidth,
      targetHeight: useOriginalSize ? imageData.originalHeight : targetHeight,
      alignment,
      layerId,
      useOriginalSize
    }, machineProfile)
    
    imageShape.opacity = opacity / 100
    
    onImport([imageShape])
    onClose()
  }
  
  if (loading) {
    return (
      <div className="image-import-overlay">
        <div className="image-import-dialog">
          <p>Loading image...</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="image-import-overlay">
      <div className="image-import-dialog">
        <h2>Import Image</h2>
        
        {imageData && (
          <div className="image-preview">
            <img 
              src={imageData.dataUrl} 
              alt="Preview" 
              style={{ 
                maxWidth: '100%', 
                maxHeight: '200px',
                opacity: opacity / 100
              }} 
            />
          </div>
        )}
        
        <div className="import-section">
          <h3>Size</h3>
          <div className="size-info">
            <p>Original: {imageData.originalWidth.toFixed(2)} × {imageData.originalHeight.toFixed(2)} mm</p>
            <p>Resolution: {imageData.pixelWidth} × {imageData.pixelHeight} px</p>
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
            <>
              <div className="size-inputs">
                <label>
                  Width (mm):
                  <input
                    type="number"
                    value={targetWidth.toFixed(2)}
                    onChange={(e) => handleWidthChange(parseFloat(e.target.value))}
                    step="0.1"
                  />
                </label>
                <label>
                  Height (mm):
                  <input
                    type="number"
                    value={targetHeight.toFixed(2)}
                    onChange={(e) => handleHeightChange(parseFloat(e.target.value))}
                    step="0.1"
                  />
                </label>
              </div>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={maintainAspect}
                  onChange={(e) => setMaintainAspect(e.target.checked)}
                />
                Maintain aspect ratio
              </label>
            </>
          )}
        </div>
        
        <div className="import-section">
          <h3>Opacity</h3>
          <div className="opacity-control">
            <input
              type="range"
              min="0"
              max="100"
              value={opacity}
              onChange={(e) => setOpacity(parseInt(e.target.value))}
              className="opacity-slider"
            />
            <span className="opacity-value">{opacity}%</span>
          </div>
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

export default ImageImportDialog
