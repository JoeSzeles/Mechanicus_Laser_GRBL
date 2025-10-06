import { useState, useRef, useEffect } from 'react'
import './PopupWindow.css'

function PopupWindow({ 
  title, 
  children, 
  isOpen, 
  onClose, 
  defaultPosition = { x: 100, y: 100 }, 
  defaultSize = { width: 400, height: 500 }, 
  onFocus,
  onPositionChange,
  onSizeChange,
  zIndex = 1000
}) {
  const [position, setPosition] = useState(defaultPosition)
  const [size, setSize] = useState(defaultSize)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [resizeDirection, setResizeDirection] = useState(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 })
  const windowRef = useRef(null)

  // Update position when defaultPosition changes (from workspace restore)
  useEffect(() => {
    if (defaultPosition && (defaultPosition.x !== position.x || defaultPosition.y !== position.y)) {
      setPosition(defaultPosition)
    }
  }, [defaultPosition])

  // Update size when defaultSize changes (from workspace restore)
  useEffect(() => {
    if (defaultSize && (defaultSize.width !== size.width || defaultSize.height !== size.height)) {
      setSize(defaultSize)
    }
  }, [defaultSize])

  const handleMouseDown = (e) => {
    // Allow dragging from header or its children, but not from close button
    if (e.target.classList.contains('popup-close')) return
    
    setIsDragging(true)
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    })
  }

  const handleMouseMove = (e) => {
    if (isDragging) {
      const newPosition = {
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      }
      setPosition(newPosition)
      if (onPositionChange) {
        onPositionChange(newPosition)
      }
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    setIsResizing(false)
    setResizeDirection(null)
  }

  const handleResizeMouseDown = (e, direction) => {
    e.stopPropagation()
    setIsResizing(true)
    setResizeDirection(direction)
    setResizeStart({
      mouseX: e.clientX,
      mouseY: e.clientY,
      x: position.x,
      y: position.y,
      width: size.width,
      height: size.height
    })
  }

  const handleResizeMouseMove = (e) => {
    if (isResizing && resizeDirection) {
      const deltaX = e.clientX - resizeStart.mouseX
      const deltaY = e.clientY - resizeStart.mouseY

      let newWidth = resizeStart.width
      let newHeight = resizeStart.height
      let newX = resizeStart.x
      let newY = resizeStart.y

      const minWidth = 200
      const minHeight = 150

      if (resizeDirection.includes('e')) {
        newWidth = Math.max(minWidth, resizeStart.width + deltaX)
      }
      if (resizeDirection.includes('w')) {
        const proposedWidth = resizeStart.width - deltaX
        if (proposedWidth >= minWidth) {
          newWidth = proposedWidth
          newX = resizeStart.x + deltaX
        } else {
          newWidth = minWidth
          newX = resizeStart.x + (resizeStart.width - minWidth)
        }
      }
      if (resizeDirection.includes('s')) {
        newHeight = Math.max(minHeight, resizeStart.height + deltaY)
      }
      if (resizeDirection.includes('n')) {
        const proposedHeight = resizeStart.height - deltaY
        if (proposedHeight >= minHeight) {
          newHeight = proposedHeight
          newY = resizeStart.y + deltaY
        } else {
          newHeight = minHeight
          newY = resizeStart.y + (resizeStart.height - minHeight)
        }
      }

      // Constrain window to viewport bounds (minimum 50px visible on each edge)
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const minVisible = 50

      newX = Math.max(-newWidth + minVisible, Math.min(viewportWidth - minVisible, newX))
      newY = Math.max(0, Math.min(viewportHeight - 30, newY)) // Keep header visible

      setSize({ width: newWidth, height: newHeight })
      if (onSizeChange) {
        onSizeChange(newWidth, newHeight)
      }
      if (newX !== position.x || newY !== position.y) {
        const newPosition = { x: newX, y: newY }
        setPosition(newPosition)
        if (onPositionChange) {
          onPositionChange(newPosition)
        }
      }
    }
  }

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, dragOffset])

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResizeMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleResizeMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isResizing, resizeDirection, resizeStart, size, position])

  if (!isOpen) return null

  return (
    <div
      ref={windowRef}
      className="popup-window"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        zIndex: zIndex
      }}
      onMouseDown={onFocus}
    >
      <div className="popup-header" onMouseDown={handleMouseDown}>
        <span className="popup-title">{title}</span>
        <button className="popup-close" onClick={onClose}>×</button>
      </div>
      <div className="popup-content">
        {children}
      </div>
      {/* Resize handles */}
      <div className="resize-handle resize-n" onMouseDown={(e) => handleResizeMouseDown(e, 'n')} />
      <div className="resize-handle resize-s" onMouseDown={(e) => handleResizeMouseDown(e, 's')} />
      <div className="resize-handle resize-e" onMouseDown={(e) => handleResizeMouseDown(e, 'e')} />
      <div className="resize-handle resize-w" onMouseDown={(e) => handleResizeMouseDown(e, 'w')} />
      <div className="resize-handle resize-ne" onMouseDown={(e) => handleResizeMouseDown(e, 'ne')} />
      <div className="resize-handle resize-nw" onMouseDown={(e) => handleResizeMouseDown(e, 'nw')} />
      <div className="resize-handle resize-se" onMouseDown={(e) => handleResizeMouseDown(e, 'se')} />
      <div className="resize-handle resize-sw" onMouseDown={(e) => handleResizeMouseDown(e, 'sw')} />
    </div>
  )
}

export default PopupWindow
