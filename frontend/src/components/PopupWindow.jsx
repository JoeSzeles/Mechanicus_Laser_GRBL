import { useState, useRef, useEffect } from 'react'
import './PopupWindow.css'

function PopupWindow({ title, children, isOpen, onClose, defaultPosition = { x: 100, y: 100 }, defaultSize = { width: 400, height: 500 }, onFocus }) {
  const [position, setPosition] = useState(defaultPosition)
  const [size, setSize] = useState(defaultSize)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [resizeDirection, setResizeDirection] = useState(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 })
  const windowRef = useRef(null)

  const handleMouseDown = (e) => {
    // Allow dragging from header or its children, but not from close button
    if (e.target.classList.contains('popup-close')) return
    
    setIsDragging(true)
    const rect = windowRef.current.getBoundingClientRect()
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    })
  }

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      })
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
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height
    })
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
        newX = position.x + deltaX
      }
      if (resizeDirection.includes('s')) {
        newHeight = Math.max(150, resizeStart.height + deltaY)
      }
      if (resizeDirection.includes('n')) {
        newHeight = Math.max(150, resizeStart.height - deltaY)
        newY = position.y + deltaY
      }

      setSize({ width: newWidth, height: newHeight })
      if (newX !== position.x || newY !== position.y) {
        setPosition({ x: newX, y: newY })
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
        height: `${size.height}px`
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
