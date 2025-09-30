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
      >
        {icon}
      </button>
      {showTooltip && <div className="tool-tooltip">{label}</div>}
    </div>
  )
}

export default ToolButton
