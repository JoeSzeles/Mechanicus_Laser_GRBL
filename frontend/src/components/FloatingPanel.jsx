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

  if (!isOpen) return null

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
    
    const newX = e.clientX - dragStart.x
    const newY = e.clientY - dragStart.y
    
    if (onPositionChange) {
      onPositionChange(newX, newY)
    }
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
    >
      <div 
        className="panel-header"
        onMouseDown={handleMouseDown}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <h4 className="panel-title">{title}</h4>
        <button className="panel-close-button" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="panel-content">
        {children}
      </div>
    </div>
  )
}

export default FloatingPanel
