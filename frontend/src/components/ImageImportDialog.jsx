import { useState, useEffect } from 'react'
import useCadStore from '../store/cadStore'
import './ImageImportDialog.css'

function ImageImportDialog({ file, onClose, onImport }) {
  const machineProfile = useCadStore((state) => state.machineProfile)
  const layers = useCadStore((state) => state.layers)
  const addLayer = useCadStore((state) => state.addLayer)
  
  const [imageData, setImageData] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [useOriginalSize, setUseOriginalSize] = useState(true)
  const [targetWidth, setTargetWidth] = useState(100)
  const [targetHeight, setTargetHeight] = useState(100)
  const [alignment, setAlignment] = useState('bottom-left')
  const [selectedLayer, setSelectedLayer] = useState('new')
  const [newLayerName, setNewLayerName] = useState('Imported Image')
  const [loading, setLoading] = useState(true)
  const [maintainAspectRatio, setMaintainAspectRatio] = useState(true)
  const [dpi, setDpi] = useState(96)
  
  useEffect(() => {
    if (file) {
      const reader = new FileReader()
      
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          // Convert pixel dimensions to mm based on DPI
          const mmPerInch = 25.4
          const widthMM = (img.width / dpi) * mmPerInch
          const heightMM = (img.height / dpi) * mmPerInch
          
          setImageData({
            url: e.target.result,
            width: img.width,
            height: img.height,
            widthMM: widthMM,
            heightMM: heightMM,
            aspectRatio: img.width / img.height
          })
          setPreviewUrl(e.target.result)
          setTargetWidth(widthMM)
          setTargetHeight(heightMM)
          setLoading(false)
        }
        img.onerror = () => {
          alert('Failed to load image')
          onClose()
        }
        img.src = e.target.result
      }
      
      reader.onerror = () => {
        alert('Failed to read file')
        onClose()
      }
      
      reader.readAsDataURL(file)
    }
  }, [file, onClose])
  
  // Recalculate sizes when DPI changes
  useEffect(() => {
    if (imageData) {
      const mmPerInch = 25.4
      const widthMM = (imageData.width / dpi) * mmPerInch
      const heightMM = (imageData.height / dpi) * mmPerInch
      
      setImageData(prev => ({ ...prev, widthMM, heightMM }))
      if (useOriginalSize) {
        setTargetWidth(widthMM)
        setTargetHeight(heightMM)
      }
    }
  }, [dpi])
  
  const handleWidthChange = (newWidth) => {
    setTargetWidth(newWidth)
    if (maintainAspectRatio && imageData) {
      setTargetHeight(newWidth / imageData.aspectRatio)
    }
  }
  
  const handleHeightChange = (newHeight) => {
    setTargetHeight(newHeight)
    if (maintainAspectRatio && imageData) {
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
    
    // Calculate position based on alignment
    const mmToPx = machineProfile.mmToPx || 3.7795275591 // Default: 96 DPI
    
    // Determine size in pixels
    let widthPx, heightPx
    if (useOriginalSize) {
      // Use image's native pixel dimensions directly
      widthPx = imageData.width
      heightPx = imageData.height
    } else {
      // Convert custom mm size to pixels
      widthPx = targetWidth * mmToPx
      heightPx = targetHeight * mmToPx
    }
    
    let x = 0
    let y = 0
    
    const bedWidthPx = machineProfile.bedSizeX * mmToPx
    const bedHeightPx = machineProfile.bedSizeY * mmToPx
    
    // Konva uses top-left origin, so we always calculate from top-left
    // regardless of machine origin setting
    switch (alignment) {
      case 'top-left':
        x = 0
        y = 0
        break
      case 'top-right':
        x = bedWidthPx - widthPx
        y = 0
        break
      case 'center':
        x = (bedWidthPx - widthPx) / 2
        y = (bedHeightPx - heightPx) / 2
        break
      case 'bottom-left':
        x = 0
        y = bedHeightPx - heightPx
        break
      case 'bottom-right':
        x = bedWidthPx - widthPx
        y = bedHeightPx - heightPx
        break
    }
    
    // Create image shape with pixel dimensions
    const imageShape = {
      id: `image-${Date.now()}`,
      type: 'image',
      x: x,
      y: y,
      width: widthPx,
      height: heightPx,
      imageUrl: imageData.url,
      layerId: layerId,
      locked: false
    }
    
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
        
        <div className="import-section">
          <h3>Preview</h3>
          <div className="image-preview">
            <img src={previewUrl} alt="Preview" />
          </div>
          <div className="image-info">
            <p>Resolution: {imageData.width} × {imageData.height} pixels</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                DPI (for reference):
                <input
                  type="number"
                  value={dpi}
                  onChange={(e) => setDpi(Number(e.target.value))}
                  style={{ width: '70px', padding: '4px' }}
                  min="72"
                  max="1200"
                />
              </label>
            </div>
            <p>Physical size at {dpi} DPI: {imageData.widthMM.toFixed(2)} × {imageData.heightMM.toFixed(2)} mm</p>
          </div>
        </div>
        
        <div className="import-section">
          <h3>Size</h3>
          
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={useOriginalSize}
              onChange={(e) => setUseOriginalSize(e.target.checked)}
            />
            Use original size ({imageData.width} × {imageData.height} pixels)
          </label>
          
          {!useOriginalSize && (
            <>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={maintainAspectRatio}
                  onChange={(e) => setMaintainAspectRatio(e.target.checked)}
                />
                Maintain aspect ratio
              </label>
              
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
            </>
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

export default ImageImportDialog
