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
  onBringToFront
}) => {
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
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
    </div>
  )
}

export default FloatingPanel
