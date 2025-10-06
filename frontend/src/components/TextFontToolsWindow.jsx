import { useState, useEffect } from 'react'
import useCadStore from '../store/cadStore'
import './TextFontToolsWindow.css'

// Placeholder for actual textToPathSVG function.
// This would involve using a library or browser APIs to convert text to SVG path data.
// For demonstration, we'll assume it exists and returns a dummy path string.
const textToPathSVG = (text, font, fontSize, x, y) => {
  console.log(`Converting text: "${text}" with font: "${font}", size: ${fontSize}, at: (${x}, ${y})`);
  // In a real implementation, you'd use something like:
  // 1. Create a temporary canvas or use SVG text element.
  // 2. Get the computed path data for the text.
  // 3. Return the path data string.
  // For now, returning a placeholder.
  return `M${x},${y} L${x + fontSize * text.length},${y} L${x + fontSize * text.length},${y + fontSize} L${x},${y + fontSize} Z`;
};

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

    const textShape = shapes.find(s => s.id === selectedTextId)
    if (!textShape || textShape.type !== 'text') return

    // Convert text to SVG path
    const pathData = textToPathSVG(
      textShape.text,
      textShape.font || 'Impact',
      textShape.fontSize || 50,
      textShape.x,
      textShape.y
    )

    // Create a new path shape with the converted data
    const pathShape = {
      ...textShape,
      type: 'path',
      pathData: pathData,
      isTextPath: true, // Mark this as converted from text
      originalText: textShape.text, // Keep reference to original
      // Remove text-specific properties if they are not relevant for paths
      text: undefined,
      font: undefined,
      fontSize: undefined,
      fill: textShape.fill || '#000000', // Use text fill as path stroke color
      stroke: textShape.fill || '#000000', // Use text fill as path stroke color
      strokeWidth: 1, // Default stroke width for paths
    }

    // Remove the original text shape and add the new path shape
    removeShape(selectedTextId)
    addShape(pathShape)

    clearSelection()

    alert('Text converted to paths successfully!')
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

        <div className="text-font-row">
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