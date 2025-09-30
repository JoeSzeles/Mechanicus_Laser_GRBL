import React from 'react'
import './FloatingPanel.css'

const FloatingPanel = ({ title, isOpen, onClose, children, zIndex = 10 }) => {
  if (!isOpen) return null

  return (
    <div className="floating-panel" style={{ zIndex }}>
      <div className="panel-header">
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
