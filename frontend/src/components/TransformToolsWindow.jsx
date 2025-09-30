import { useState } from 'react'
import useCadStore from '../store/cadStore'
import './TransformToolsWindow.css'

function TransformToolsWindow() {
  const [activeTab, setActiveTab] = useState('scale')
  const selectedShapeId = useCadStore((state) => state.selectedShapeId)
  const shapes = useCadStore((state) => state.shapes)
  const setSelectedShapeId = useCadStore((state) => state.setSelectedShapeId)
  const updateShape = useCadStore((state) => state.updateShape)
  const addShape = useCadStore((state) => state.addShape)
  const removeShape = useCadStore((state) => state.removeShape)
  const transformSettings = useCadStore((state) => state.transformSettings)
  const updateTransformSettings = useCadStore((state) => state.updateTransformSettings)
  const machineProfile = useCadStore((state) => state.machineProfile)
  
  const [scaleX, setScaleX] = useState(100)
  const [scaleY, setScaleY] = useState(100)
  const [rotationAngle, setRotationAngle] = useState(0)
  
  const selectedShape = shapes.find(s => s.id === selectedShapeId)
  
  const handleSelect = () => {
    if (shapes.length > 0 && !selectedShapeId) {
      setSelectedShapeId(shapes[0].id)
    }
  }
  
  const handleDeselect = () => {
    setSelectedShapeId(null)
  }
  
  const handleMirrorHorizontal = () => {
    if (!selectedShape) return
    
    const mirroredShape = { ...selectedShape }
    
    if (selectedShape.type === 'line') {
      const centerX = (selectedShape.x1 + selectedShape.x2) / 2
      mirroredShape.x1 = 2 * centerX - selectedShape.x1
      mirroredShape.x2 = 2 * centerX - selectedShape.x2
    } else if (selectedShape.type === 'rectangle') {
      mirroredShape.x = selectedShape.x + selectedShape.width
      mirroredShape.scaleX = -1
    } else if (selectedShape.type === 'polygon') {
      const points = [...selectedShape.points]
      const centerX = points.reduce((sum, x, i) => i % 2 === 0 ? sum + x : sum, 0) / (points.length / 2)
      for (let i = 0; i < points.length; i += 2) {
        points[i] = 2 * centerX - points[i]
      }
      mirroredShape.points = points
    }
    
    if (transformSettings.createCopy) {
      mirroredShape.id = `shape-${Date.now()}`
      addShape(mirroredShape)
    } else {
      updateShape(selectedShapeId, mirroredShape)
    }
  }
  
  const handleMirrorVertical = () => {
    if (!selectedShape) return
    
    const mirroredShape = { ...selectedShape }
    
    if (selectedShape.type === 'line') {
      const centerY = (selectedShape.y1 + selectedShape.y2) / 2
      mirroredShape.y1 = 2 * centerY - selectedShape.y1
      mirroredShape.y2 = 2 * centerY - selectedShape.y2
    } else if (selectedShape.type === 'rectangle') {
      mirroredShape.y = selectedShape.y + selectedShape.height
      mirroredShape.scaleY = -1
    } else if (selectedShape.type === 'polygon') {
      const points = [...selectedShape.points]
      const centerY = points.reduce((sum, y, i) => i % 2 === 1 ? sum + y : sum, 0) / (points.length / 2)
      for (let i = 1; i < points.length; i += 2) {
        points[i] = 2 * centerY - points[i]
      }
      mirroredShape.points = points
    }
    
    if (transformSettings.createCopy) {
      mirroredShape.id = `shape-${Date.now()}`
      addShape(mirroredShape)
    } else {
      updateShape(selectedShapeId, mirroredShape)
    }
  }
  
  const handleClone = () => {
    if (!selectedShape) return
    
    const clone = {
      ...selectedShape,
      id: `shape-${Date.now()}`,
      x: selectedShape.x ? selectedShape.x + 20 : undefined,
      y: selectedShape.y ? selectedShape.y + 20 : undefined,
      x1: selectedShape.x1 ? selectedShape.x1 + 20 : undefined,
      y1: selectedShape.y1 ? selectedShape.y1 + 20 : undefined,
      x2: selectedShape.x2 ? selectedShape.x2 + 20 : undefined,
      y2: selectedShape.y2 ? selectedShape.y2 + 20 : undefined
    }
    
    if (selectedShape.type === 'polygon' && selectedShape.points) {
      clone.points = selectedShape.points.map((val, i) => val + 20)
    }
    
    addShape(clone)
    setSelectedShapeId(clone.id)
  }
  
  const handleDelete = () => {
    if (selectedShapeId) {
      removeShape(selectedShapeId)
      setSelectedShapeId(null)
    }
  }
  
  const handleRotate = (angleDelta) => {
    if (!selectedShape) return
    
    let newAngle = rotationAngle + angleDelta
    if (transformSettings.snapAngle) {
      newAngle = Math.round(newAngle / 5) * 5
    }
    setRotationAngle(newAngle)
    
    updateShape(selectedShapeId, {
      rotation: newAngle
    })
  }
  
  return (
    <div className="transform-tools-window">
      <div className="tabs">
        <button 
          className={activeTab === 'scale' ? 'active' : ''} 
          onClick={() => setActiveTab('scale')}
        >
          Scale
        </button>
        <button 
          className={activeTab === 'mirror' ? 'active' : ''} 
          onClick={() => setActiveTab('mirror')}
        >
          Mirror
        </button>
        <button 
          className={activeTab === 'clone' ? 'active' : ''} 
          onClick={() => setActiveTab('clone')}
        >
          Clone
        </button>
        <button 
          className={activeTab === 'rotate' ? 'active' : ''} 
          onClick={() => setActiveTab('rotate')}
        >
          Rotate
        </button>
      </div>
      
      <div className="tab-content">
        {activeTab === 'scale' && (
          <div className="scale-tab">
            <div className="button-row">
              <button onClick={handleSelect} disabled={selectedShapeId}>Select</button>
              <button onClick={handleDeselect} disabled={!selectedShapeId}>Deselect</button>
            </div>
            <label>
              <input 
                type="checkbox" 
                checked={transformSettings.keepAspectRatio}
                onChange={(e) => updateTransformSettings('keepAspectRatio', e.target.checked)}
              />
              Keep Aspect Ratio
            </label>
            <div className="input-row">
              <label>
                Size X (mm):
                <input 
                  type="number" 
                  value={scaleX} 
                  onChange={(e) => setScaleX(parseFloat(e.target.value))}
                />
              </label>
              <label>
                Size Y (mm):
                <input 
                  type="number" 
                  value={scaleY} 
                  onChange={(e) => setScaleY(parseFloat(e.target.value))}
                />
              </label>
            </div>
          </div>
        )}
        
        {activeTab === 'mirror' && (
          <div className="mirror-tab">
            <div className="button-row">
              <button onClick={handleSelect} disabled={selectedShapeId}>Select</button>
              <button onClick={handleDeselect} disabled={!selectedShapeId}>Deselect</button>
            </div>
            <div className="button-row">
              <button onClick={handleMirrorHorizontal} disabled={!selectedShapeId}>
                Flip Horizontal
              </button>
              <button onClick={handleMirrorVertical} disabled={!selectedShapeId}>
                Flip Vertical
              </button>
            </div>
            <label>
              <input 
                type="checkbox" 
                checked={transformSettings.createCopy}
                onChange={(e) => updateTransformSettings('createCopy', e.target.checked)}
              />
              Create Copy
            </label>
          </div>
        )}
        
        {activeTab === 'clone' && (
          <div className="clone-tab">
            <div className="button-row">
              <button onClick={handleSelect} disabled={selectedShapeId}>Select</button>
              <button onClick={handleClone} disabled={!selectedShapeId}>Clone</button>
            </div>
            <div className="button-row">
              <button onClick={handleDeselect} disabled={!selectedShapeId}>Deselect</button>
              <button onClick={handleDelete} disabled={!selectedShapeId}>Delete</button>
            </div>
            <p className="hint">Quick Clone: Alt + Click & Drag</p>
          </div>
        )}
        
        {activeTab === 'rotate' && (
          <div className="rotate-tab">
            <div className="button-row">
              <button onClick={handleSelect} disabled={selectedShapeId}>Select</button>
              <button onClick={handleDeselect} disabled={!selectedShapeId}>Deselect</button>
            </div>
            <label>
              Angle (°):
              <input 
                type="number" 
                value={rotationAngle} 
                onChange={(e) => setRotationAngle(parseFloat(e.target.value))}
              />
              <button onClick={() => handleRotate(0)} disabled={!selectedShapeId}>Apply</button>
            </label>
            <label>
              <input 
                type="checkbox" 
                checked={transformSettings.snapAngle}
                onChange={(e) => updateTransformSettings('snapAngle', e.target.checked)}
              />
              Snap to 5°
            </label>
            <div className="button-row">
              <button onClick={() => handleRotate(-90)} disabled={!selectedShapeId}>
                Rotate -90°
              </button>
              <button onClick={() => handleRotate(90)} disabled={!selectedShapeId}>
                Rotate +90°
              </button>
            </div>
          </div>
        )}
      </div>
      
      {selectedShape && (
        <div className="selection-info">
          Selected: {selectedShape.type} ({selectedShape.id})
        </div>
      )}
    </div>
  )
}

export default TransformToolsWindow
