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
  
  useEffect(() => {
    if (file) {
      const reader = new FileReader()
      
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          // Convert pixel dimensions to mm (assuming 96 DPI)
          const dpi = 96
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
    const width = useOriginalSize ? imageData.widthMM : targetWidth
    const height = useOriginalSize ? imageData.heightMM : targetHeight
    
    let x = 0
    let y = 0
    
    const bedWidth = machineProfile.bedSizeX
    const bedHeight = machineProfile.bedSizeY
    const originPoint = machineProfile.originPoint || 'bottom-left'
    
    // Calculate position based on alignment and origin point
    switch (alignment) {
      case 'top-left':
        if (originPoint === 'top-left' || originPoint === 'top-right') {
          x = 0
          y = 0
        } else {
          x = 0
          y = bedHeight - height
        }
        break
      case 'top-right':
        if (originPoint === 'top-left' || originPoint === 'top-right') {
          x = bedWidth - width
          y = 0
        } else {
          x = bedWidth - width
          y = bedHeight - height
        }
        break
      case 'center':
        x = (bedWidth - width) / 2
        y = (bedHeight - height) / 2
        break
      case 'bottom-left':
        if (originPoint === 'bottom-left' || originPoint === 'bottom-right') {
          x = 0
          y = 0
        } else {
          x = 0
          y = bedHeight - height
        }
        break
      case 'bottom-right':
        if (originPoint === 'bottom-left' || originPoint === 'bottom-right') {
          x = bedWidth - width
          y = 0
        } else {
          x = bedWidth - width
          y = bedHeight - height
        }
        break
    }
    
    // Create image shape
    const imageShape = {
      id: `image-${Date.now()}`,
      type: 'image',
      x: x,
      y: y,
      width: width,
      height: height,
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
            <p>Original Size: {imageData.widthMM.toFixed(2)} × {imageData.heightMM.toFixed(2)} mm</p>
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
            Use original size
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
