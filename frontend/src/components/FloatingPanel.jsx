import React, { useState, useRef } from 'react'
import './FloatingPanel.css'

const FloatingPanel = ({ 
  title, 
  isOpen, 
  onClose, 
  children, 
  position = { x: 100, y: 100 },
  zIndex = 10,
  onPositionChange,
  onBringToFront,
  defaultSize = { width: 300, height: 400 },
  onSizeChange
}) => {
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [resizeDirection, setResizeDirection] = useState(null)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [size, setSize] = useState(defaultSize)
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 })
  const panelRef = useRef(null)

  const handleMouseDown = (e) => {
    if (e.target.closest('.panel-close-button')) return
    
    setIsDragging(true)
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    })
    
    if (onBringToFront) {
      onBringToFront()
    }
    
    e.preventDefault()
  }

  const handleMouseMove = (e) => {
    if (!isDragging) return
    
    requestAnimationFrame(() => {
      let newX = e.clientX - dragStart.x
      let newY = e.clientY - dragStart.y
      
      // Clamp Y position - must stay below menu bar (which is 40px tall)
      const MENU_BAR_HEIGHT = 50
      newY = Math.max(MENU_BAR_HEIGHT, newY)
      
      if (onPositionChange) {
        onPositionChange(newX, newY)
      }
    })
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
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height
    })
    
    if (onBringToFront) {
      onBringToFront()
    }
  }

  const handleResizeMouseMove = (e) => {
    if (isResizing && resizeDirection) {
      const deltaX = e.clientX - resizeStart.x
      const deltaY = e.clientY - resizeStart.y

      let newWidth = resizeStart.width
      let newHeight = resizeStart.height
      let newX = position.x
      let newY = position.y

      if (resizeDirection.includes('e')) {
        newWidth = Math.max(200, resizeStart.width + deltaX)
      }
      if (resizeDirection.includes('w')) {
        newWidth = Math.max(200, resizeStart.width - deltaX)
        newX = position.x + (resizeStart.width - newWidth)
      }
      if (resizeDirection.includes('s')) {
        newHeight = Math.max(150, resizeStart.height + deltaY)
      }
      if (resizeDirection.includes('n')) {
        newHeight = Math.max(150, resizeStart.height - deltaY)
        newY = position.y + (resizeStart.height - newHeight)
      }

      setSize({ width: newWidth, height: newHeight })
      if (onSizeChange) {
        onSizeChange(newWidth, newHeight)
      }
      if ((newX !== position.x || newY !== position.y) && onPositionChange) {
        onPositionChange(newX, newY)
      }
    }
  }

  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, dragStart, position])

  React.useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResizeMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      
      return () => {
        window.removeEventListener('mousemove', handleResizeMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isResizing, resizeDirection, resizeStart, size, position])

  const handlePanelClick = () => {
    if (onBringToFront) {
      onBringToFront()
    }
  }

  if (!isOpen) return null

  return (
    <div 
      ref={panelRef}
      className={`floating-panel ${isDragging ? 'dragging' : ''}`}
      style={{ 
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        zIndex 
      }}
      onClick={handlePanelClick}
      role="dialog"
      aria-label={title}
      aria-modal="false"
    >
      <div 
        className="panel-header"
        onMouseDown={handleMouseDown}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        role="banner"
        aria-label={`${title} header - drag to move`}
      >
        <h4 className="panel-title" id={`panel-title-${title.replace(/\s+/g, '-').toLowerCase()}`}>{title}</h4>
        <button 
          className="panel-close-button" 
          onClick={onClose}
          aria-label={`Close ${title} panel`}
          title={`Close ${title}`}
        >
          ×
        </button>
      </div>
      <div 
        className="panel-content"
        role="region"
        aria-labelledby={`panel-title-${title.replace(/\s+/g, '-').toLowerCase()}`}
      >
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

export default FloatingPanel
