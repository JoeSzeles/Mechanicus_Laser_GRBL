
import { useState, useEffect } from 'react'
import useCadStore from '../store/cadStore'
import { parseImageFile, createImageShape } from '../utils/imageImportUtils'
import './ImageImportDialog.css'

function ImageImportDialog({ file, onClose, onImport }) {
  console.log('🖼️ ImageImportDialog: Component rendering', { file, hasOnClose: !!onClose, hasOnImport: !!onImport })
  
  const machineProfile = useCadStore((state) => state.machineProfile)
  const layers = useCadStore((state) => state.layers)
  const addLayer = useCadStore((state) => state.addLayer)

  console.log('🖼️ ImageImportDialog: Store state', { 
    machineProfile: machineProfile ? 'loaded' : 'null', 
    layersCount: layers?.length,
    hasAddLayer: !!addLayer 
  })

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
  const [error, setError] = useState(null)

  console.log('🖼️ ImageImportDialog: State initialized', { 
    loading, 
    error, 
    hasImageData: !!imageData,
    useOriginalSize,
    selectedLayer 
  })

  useEffect(() => {
    console.log('🖼️ ImageImportDialog: useEffect triggered', { hasFile: !!file })
    if (file) {
      console.log('🖼️ ImageImportDialog: Starting image parse', { fileName: file.name, fileSize: file.size, fileType: file.type })
      parseImageFile(file).then(data => {
        console.log('🖼️ ImageImportDialog: Image parsed successfully', data)
        setImageData(data)
        setTargetWidth(data.originalWidth)
        setTargetHeight(data.originalHeight)
        setLoading(false)
        console.log('🖼️ ImageImportDialog: State updated after parse')
      }).catch(error => {
        console.error('🖼️ ImageImportDialog: Image parse error:', error)
        console.error('🖼️ ImageImportDialog: Error stack:', error.stack)
        setError('Failed to parse image: ' + error.message)
        setLoading(false)
        console.log('🖼️ ImageImportDialog: Error state set')
      })
    }
  }, [file])

  const handleWidthChange = (newWidth) => {
    console.log('🖼️ ImageImportDialog: Width change', { newWidth, maintainAspect })
    setTargetWidth(newWidth)
    if (maintainAspect && imageData) {
      setTargetHeight(newWidth / imageData.aspectRatio)
    }
  }

  const handleHeightChange = (newHeight) => {
    console.log('🖼️ ImageImportDialog: Height change', { newHeight, maintainAspect })
    setTargetHeight(newHeight)
    if (maintainAspect && imageData) {
      setTargetWidth(newHeight * imageData.aspectRatio)
    }
  }

  const handleImport = () => {
    console.log('🖼️ ImageImportDialog: Import clicked', { 
      hasImageData: !!imageData,
      selectedLayer,
      useOriginalSize,
      targetWidth,
      targetHeight,
      opacity
    })
    if (!imageData) {
      console.warn('🖼️ ImageImportDialog: No image data, aborting import')
      return
    }

    // Determine layer
    let layerId = selectedLayer
    console.log('🖼️ ImageImportDialog: Determining layer', { selectedLayer, newLayerName })
    if (selectedLayer === 'new') {
      const newLayer = {
        id: `layer-${Date.now()}`,
        name: newLayerName,
        visible: true,
        locked: false
      }
      console.log('🖼️ ImageImportDialog: Creating new layer', newLayer)
      try {
        addLayer(newLayer)
        layerId = newLayer.id
        console.log('🖼️ ImageImportDialog: Layer created successfully', { layerId })
      } catch (err) {
        console.error('🖼️ ImageImportDialog: Error creating layer:', err)
        throw err
      }
    }

    // Create image shape
    console.log('🖼️ ImageImportDialog: Creating image shape', {
      targetWidth: useOriginalSize ? imageData.originalWidth : targetWidth,
      targetHeight: useOriginalSize ? imageData.originalHeight : targetHeight,
      alignment,
      layerId,
      useOriginalSize,
      hasMachineProfile: !!machineProfile
    })
    
    let imageShape
    try {
      imageShape = createImageShape(imageData, {
        targetWidth: useOriginalSize ? imageData.originalWidth : targetWidth,
        targetHeight: useOriginalSize ? imageData.originalHeight : targetHeight,
        alignment,
        layerId,
        useOriginalSize
      }, machineProfile)
      console.log('🖼️ ImageImportDialog: Image shape created', imageShape)
    } catch (err) {
      console.error('🖼️ ImageImportDialog: Error creating image shape:', err)
      throw err
    }

    imageShape.opacity = opacity / 100
    console.log('🖼️ ImageImportDialog: Opacity set', { opacity: imageShape.opacity })

    console.log('🖼️ ImageImportDialog: Calling onImport with shapes:', [imageShape])
    try {
      onImport([imageShape])
      console.log('🖼️ ImageImportDialog: onImport called successfully')
    } catch (err) {
      console.error('🖼️ ImageImportDialog: Error in onImport:', err)
      throw err
    }
    
    console.log('🖼️ ImageImportDialog: Calling onClose')
    onClose()
  }

  if (loading) {
    console.log('🖼️ ImageImportDialog: Rendering loading state')
    return (
      <div className="image-import-overlay">
        <div className="image-import-dialog">
          <h2>Import Image</h2>
          <p>Loading image...</p>
        </div>
      </div>
    )
  }

  if (error) {
    console.log('🖼️ ImageImportDialog: Rendering error state', { error })
    return (
      <div className="image-import-overlay">
        <div className="image-import-dialog">
          <h2>Import Image</h2>
          <p style={{ color: '#ef4444' }}>{error}</p>
          <div className="dialog-buttons">
            <button onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    )
  }

  if (!imageData) {
    console.log('🖼️ ImageImportDialog: No image data, rendering null')
    return null
  }

  console.log('🖼️ ImageImportDialog: Rendering main dialog')
  return (
    <div className="image-import-overlay">
      <div className="image-import-dialog">
        <h2>Import Image</h2>

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

        <div className="import-section">
          <h3>Size</h3>
          <div className="size-info">
            <p>Original: {imageData.originalWidth.toFixed(2)} × {imageData.originalHeight.toFixed(2)} mm</p>
            <p>Resolution: {imageData.pixelWidth} × {imageData.pixelHeight} px</p>
            {imageData.dpi && <p>DPI: {imageData.dpi}</p>}
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
