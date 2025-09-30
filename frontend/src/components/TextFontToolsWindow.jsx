import { useState, useEffect } from 'react'
import useCadStore from '../store/cadStore'
import './TextFontToolsWindow.css'

const AVAILABLE_FONTS = [
  'Impact',
  'Arial',
  'Times New Roman',
  'Courier New',
  'Georgia',
  'Verdana',
  'Comic Sans MS',
  'Trebuchet MS',
  'Arial Black',
  'Palatino'
]

function TextFontToolsWindow() {
  const shapes = useCadStore((state) => state.shapes)
  const addShape = useCadStore((state) => state.addShape)
  const updateShape = useCadStore((state) => state.updateShape)
  const removeShape = useCadStore((state) => state.removeShape)
  const textToolState = useCadStore((state) => state.textToolState)
  const setTextToolState = useCadStore((state) => state.setTextToolState)
  const setActiveTool = useCadStore((state) => state.setActiveTool)
  const viewport = useCadStore((state) => state.viewport)
  const machineProfile = useCadStore((state) => state.machineProfile)
  
  const [text, setText] = useState('')
  const [font, setFont] = useState('Impact')
  const [size, setSize] = useState(50)
  const [color, setColor] = useState('#000000')
  
  const selectedTextId = textToolState?.selectedTextId
  const selectedText = selectedTextId ? shapes.find(s => s.id === selectedTextId) : null
  const isPlaceMode = textToolState?.placeMode
  const isSelectMode = textToolState?.selectMode
  
  useEffect(() => {
    if (selectedText && selectedText.type === 'text') {
      setText(selectedText.text || '')
      setFont(selectedText.font || 'Impact')
      setSize(selectedText.fontSize || 50)
      setColor(selectedText.fill || '#000000')
      
      updateShape(selectedTextId, {
        stroke: 'red',
        strokeWidth: 2,
        originalStroke: selectedText.originalStroke || selectedText.stroke,
        originalStrokeWidth: selectedText.originalStrokeWidth || selectedText.strokeWidth
      })
    }
  }, [selectedTextId])
  
  const clearSelection = () => {
    if (selectedTextId && selectedText) {
      if (selectedText.originalStroke !== undefined) {
        updateShape(selectedTextId, {
          stroke: selectedText.originalStroke,
          strokeWidth: selectedText.originalStrokeWidth,
          originalStroke: undefined,
          originalStrokeWidth: undefined
        })
      }
    }
    setTextToolState({
      placeMode: false,
      selectMode: false,
      selectedTextId: null
    })
  }
  
  const handlePlaceText = () => {
    if (!text.trim()) {
      alert('Please enter some text')
      return
    }
    
    setActiveTool(null)
    clearSelection()
    
    setTextToolState({
      placeMode: true,
      selectMode: false,
      selectedTextId: null,
      pendingText: {
        text,
        font,
        fontSize: size,
        fill: color
      }
    })
  }
  
  const handleSelectText = () => {
    setActiveTool(null)
    clearSelection()
    
    setTextToolState({
      selectMode: true,
      placeMode: false,
      selectedTextId: null
    })
  }
  
  const handleEditSelected = () => {
    if (!selectedText) {
      alert('Please select a text element first')
      return
    }
    
    if (!text.trim()) {
      alert('Text cannot be empty')
      return
    }
    
    updateShape(selectedTextId, {
      text,
      font,
      fontSize: size,
      fill: color,
      stroke: undefined,
      strokeWidth: undefined,
      originalStroke: undefined,
      originalStrokeWidth: undefined
    })
    
    clearSelection()
  }
  
  const handleConvertToPaths = () => {
    if (!selectedText) {
      alert('Please select a text element first')
      return
    }
    
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    ctx.font = `${selectedText.fontSize}px ${selectedText.font}`
    
    const textWidth = ctx.measureText(selectedText.text).width
    const textHeight = selectedText.fontSize
    
    const pathGroup = {
      id: `path-group-${Date.now()}`,
      type: 'path-group',
      originalText: selectedText.text,
      x: selectedText.x,
      y: selectedText.y,
      width: textWidth,
      height: textHeight,
      base_x: selectedText.base_x,
      base_y: selectedText.base_y,
      stroke: selectedText.fill || '#000000',
      strokeWidth: 1,
      fill: 'transparent'
    }
    
    removeShape(selectedTextId)
    addShape(pathGroup)
    
    clearSelection()
    
    alert('Text converted to path group. Note: Individual character paths require browser canvas API extensions.')
  }
  
  const handleDeleteText = () => {
    if (!selectedText) {
      alert('Please select a text element first')
      return
    }
    
    removeShape(selectedTextId)
    clearSelection()
  }
  
  return (
    <div className="text-font-window">
      <div className="text-font-header">
        <h3>Text & Font Tools</h3>
      </div>
      
      <div className="text-font-content">
        <div className="property-group">
          <label>Text:</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            className="text-input"
            placeholder="Enter text here..."
          />
        </div>
        
        <div className="property-group">
          <label>Font:</label>
          <select
            value={font}
            onChange={(e) => setFont(e.target.value)}
            className="font-select"
          >
            {AVAILABLE_FONTS.map(f => (
              <option key={f} value={f} style={{ fontFamily: f }}>
                {f}
              </option>
            ))}
          </select>
        </div>
        
        <div className="property-row">
          <div className="property-group">
            <label>Size:</label>
            <input
              type="number"
              min="8"
              max="200"
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              className="number-input"
            />
            <span className="unit-label">pt</span>
          </div>
          
          <div className="property-group">
            <label>Color:</label>
            <div className="color-input-group">
              <div 
                className="color-preview" 
                style={{ backgroundColor: color }}
              />
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </div>
          </div>
        </div>
        
        {selectedText && (
          <div className="selected-text-info">
            Selected: {selectedText.text?.substring(0, 30)}
            {selectedText.text?.length > 30 && '...'}
          </div>
        )}
        
        <div className="button-grid">
          <button
            className={`text-tool-button ${isPlaceMode ? 'active' : ''}`}
            onClick={handlePlaceText}
          >
            Place Text
          </button>
          <button
            className={`text-tool-button ${isSelectMode ? 'active' : ''}`}
            onClick={handleSelectText}
          >
            Select Text
          </button>
          <button
            className="text-tool-button"
            onClick={handleEditSelected}
            disabled={!selectedText}
          >
            Edit Selected
          </button>
          <button
            className="text-tool-button convert-button"
            onClick={handleConvertToPaths}
            disabled={!selectedText}
          >
            Convert to Paths
          </button>
          <button
            className="text-tool-button delete-button"
            onClick={handleDeleteText}
            disabled={!selectedText}
          >
            Delete Text
          </button>
        </div>
      </div>
    </div>
  )
}

export default TextFontToolsWindow
