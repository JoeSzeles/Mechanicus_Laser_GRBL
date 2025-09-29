import { useState, useEffect } from 'react'
import { useSerial } from '../contexts/SerialContext'
import './SerialControl.css'

function SerialControl({ onGcodeGenerated }) {
  const {
    companionStatus,
    isConnected,
    connectedPorts,
    availablePorts,
    machineProfiles,
    currentProfile,
    transmissionStatus,
    messages,
    listPorts,
    connectToPort,
    disconnectFromPort,
    sendCommand,
    sendGcode,
    setMachineProfile,
    emergencyStop,
    clearMessages
  } = useSerial()

  const [selectedPort, setSelectedPort] = useState('')
  const [selectedProfile, setSelectedProfile] = useState('grbl')
  const [customCommand, setCustomCommand] = useState('')
  const [showLog, setShowLog] = useState(false)

  // Refresh ports on component mount
  useEffect(() => {
    if (companionStatus === 'connected') {
      listPorts()
    }
  }, [companionStatus])

  const handleConnect = () => {
    if (selectedPort) {
      connectToPort(selectedPort, selectedProfile)
    }
  }

  const handleDisconnect = (portPath) => {
    disconnectFromPort(portPath)
  }

  const handleSendCommand = (e) => {
    e.preventDefault()
    if (customCommand.trim() && connectedPorts.length > 0) {
      sendCommand(connectedPorts[0], customCommand.trim())
      setCustomCommand('')
    }
  }

  const handleSendGcode = () => {
    if (onGcodeGenerated && connectedPorts.length > 0) {
      const gcode = onGcodeGenerated()
      if (gcode) {
        sendGcode(connectedPorts[0], gcode, 'CAD_Design.gcode')
      }
    }
  }

  const getCompanionStatusIcon = () => {
    switch (companionStatus) {
      case 'connected': return '🟢'
      case 'connecting': return '🟡'
      case 'error': return '🔴'
      default: return '⚫'
    }
  }

  const getMessageIcon = (type) => {
    switch (type) {
      case 'success': return '✅'
      case 'error': return '❌'
      case 'warning': return '⚠️'
      case 'send': return '📤'
      case 'receive': return '📨'
      case 'info': return 'ℹ️'
      default: return '•'
    }
  }

  return (
    <div className="serial-control">
      <div className="serial-header">
        <h3>🔧 Machine Control</h3>
        <div className="companion-status">
          <span className="status-indicator">
            {getCompanionStatusIcon()} Companion App: {companionStatus}
          </span>
        </div>
      </div>

      {companionStatus === 'error' && (
        <div className="error-notice">
          <h4>⚠️ Companion App Not Found</h4>
          <p>Please download and start the Mechanicus Companion App:</p>
          <ol>
            <li>Download from: <code>http://localhost:8081/health</code></li>
            <li>Run the companion app</li>
            <li>Refresh this page</li>
          </ol>
        </div>
      )}

      {companionStatus === 'connected' && (
        <>
          {/* Connection Section */}
          <div className="connection-section">
            <h4>Serial Connection</h4>
            
            <div className="connection-controls">
              <div className="form-group">
                <label>Machine Profile:</label>
                <select 
                  value={selectedProfile} 
                  onChange={(e) => setSelectedProfile(e.target.value)}
                  disabled={isConnected}
                >
                  {machineProfiles.map(([key, profile]) => (
                    <option key={key} value={key}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Serial Port:</label>
                <select 
                  value={selectedPort} 
                  onChange={(e) => setSelectedPort(e.target.value)}
                  disabled={isConnected}
                >
                  <option value="">Select a port...</option>
                  {availablePorts.map(port => (
                    <option key={port.path} value={port.path}>
                      {port.friendly} ({port.path})
                    </option>
                  ))}
                </select>
              </div>

              <div className="connection-buttons">
                <button 
                  onClick={listPorts} 
                  className="refresh-btn"
                  disabled={isConnected}
                >
                  🔄 Refresh
                </button>
                
                {!isConnected ? (
                  <button 
                    onClick={handleConnect}
                    disabled={!selectedPort}
                    className="connect-btn"
                  >
                    🔌 Connect
                  </button>
                ) : (
                  <button 
                    onClick={() => handleDisconnect(connectedPorts[0])}
                    className="disconnect-btn"
                  >
                    🔌 Disconnect
                  </button>
                )}
              </div>
            </div>

            {/* Connected Ports */}
            {connectedPorts.length > 0 && (
              <div className="connected-ports">
                <h5>Connected Machines:</h5>
                {connectedPorts.map(port => (
                  <div key={port} className="connected-port">
                    <span>🟢 {port}</span>
                    <button 
                      onClick={() => handleDisconnect(port)}
                      className="disconnect-small-btn"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Control Section */}
          {isConnected && (
            <div className="control-section">
              <h4>Machine Control</h4>
              
              {/* Quick Commands */}
              <div className="quick-commands">
                <button 
                  onClick={() => sendCommand(connectedPorts[0], '$H')}
                  className="quick-cmd-btn"
                >
                  🏠 Home
                </button>
                <button 
                  onClick={() => sendCommand(connectedPorts[0], '?')}
                  className="quick-cmd-btn"
                >
                  📊 Status
                </button>
                <button 
                  onClick={() => sendCommand(connectedPorts[0], '$X')}
                  className="quick-cmd-btn"
                >
                  🔓 Unlock
                </button>
                <button 
                  onClick={emergencyStop}
                  className="emergency-btn"
                >
                  🚨 STOP
                </button>
              </div>

              {/* Custom Command */}
              <form onSubmit={handleSendCommand} className="custom-command">
                <input
                  type="text"
                  value={customCommand}
                  onChange={(e) => setCustomCommand(e.target.value)}
                  placeholder="Enter G-code command..."
                  className="command-input"
                />
                <button type="submit" disabled={!customCommand.trim()}>
                  📤 Send
                </button>
              </form>

              {/* G-code Transmission */}
              <div className="gcode-section">
                <button 
                  onClick={handleSendGcode}
                  disabled={!onGcodeGenerated || transmissionStatus}
                  className="send-gcode-btn"
                >
                  📋 Send Current Design
                </button>
                
                {transmissionStatus && (
                  <div className="transmission-status">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill"
                        style={{ width: `${transmissionStatus.percentage}%` }}
                      ></div>
                    </div>
                    <div className="progress-text">
                      {transmissionStatus.percentage}% - Line {transmissionStatus.currentLine} of {transmissionStatus.totalLines}
                    </div>
                    {transmissionStatus.currentCommand && (
                      <div className="current-command">
                        {transmissionStatus.currentCommand}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Message Log */}
          <div className="message-log-section">
            <div className="log-header">
              <h4>Communication Log</h4>
              <div className="log-controls">
                <button 
                  onClick={() => setShowLog(!showLog)}
                  className="toggle-log-btn"
                >
                  {showLog ? '📄 Hide' : '📋 Show'} Log
                </button>
                <button onClick={clearMessages} className="clear-log-btn">
                  🗑️ Clear
                </button>
              </div>
            </div>
            
            {showLog && (
              <div className="message-log">
                {messages.length === 0 ? (
                  <div className="no-messages">No messages yet...</div>
                ) : (
                  messages.slice(-20).map(message => (
                    <div key={message.id} className={`message message-${message.type}`}>
                      <span className="message-icon">{getMessageIcon(message.type)}</span>
                      <span className="message-time">
                        {message.timestamp.toLocaleTimeString()}
                      </span>
                      <span className="message-content">{message.content}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default SerialControl