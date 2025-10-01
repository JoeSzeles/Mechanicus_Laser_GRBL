import React, { useState } from 'react'
import './ToolButton.css'

const ToolButton = ({ icon, label, onClick, active = false, disabled = false }) => {
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div className="tool-button-wrapper">
      <button
        className={`tool-button ${active ? 'active' : ''}`}
        onClick={onClick}
        disabled={disabled}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        aria-label={label || 'Tool button'}
        aria-pressed={active}
        title={label}
      >
        {icon}
      </button>
      {showTooltip && label && (
        <div className="tool-tooltip" role="tooltip" aria-hidden="true">{label}</div>
      )}
    </div>
  )
}

export default ToolButton
