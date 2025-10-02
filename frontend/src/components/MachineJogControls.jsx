import { useState } from 'react'
import { useSerial } from '../contexts/SerialContext'
import { machinePositionTracker } from '../utils/machinePositionTracker'

export default function MachineJogControls() {
  const { sendGcode, isConnected, serialState } = useSerial()
  const [feedRate, setFeedRate] = useState(1000)
  const [stepSize, setStepSize] = useState(5)

  const isReady = isConnected && serialState.port

  const isValidNumber = (value) => {
    return !isNaN(value) && isFinite(value) && value > 0
  }

  const handleJog = (xDir, yDir) => {
    if (!isReady) return
    if (!isValidNumber(feedRate) || !isValidNumber(stepSize)) return

    const xMove = xDir * stepSize
    const yMove = yDir * stepSize

    console.log('🕹️ [JOG] Jogging machine:', {
      direction: { x: xDir, y: yDir },
      distance: { x: xMove, y: yMove },
      feedRate,
      port: serialState.port
    })

    const gcodeCommands = [
      'G91',
      `G0 X${xMove.toFixed(3)} Y${yMove.toFixed(3)} F${feedRate}`,
      'G90'
    ]

    console.log('🕹️ [JOG] Sending G-code sequence:', gcodeCommands)

    sendGcode(`G91`)
    sendGcode(`G0 X${xMove.toFixed(3)} Y${yMove.toFixed(3)} F${feedRate}`)
    sendGcode(`G90`)
    
    // Query position after movement completes
    setTimeout(() => {
      console.log('🔍 [JOG] Querying position after jog to:', serialState.port)
      machinePositionTracker.queryPosition(serialState.port)
    }, 500)
  }

  const handleHome = () => {
    if (!isReady) return
    sendGcode(`G28`)
  }

  const handleFeedRateChange = (e) => {
    const value = Number(e.target.value)
    if (!isNaN(value) && value >= 1 && value <= 10000) {
      setFeedRate(value)
    }
  }

  const handleStepSizeChange = (e) => {
    const value = Number(e.target.value)
    if (!isNaN(value) && value >= 0.1 && value <= 100) {
      setStepSize(value)
    }
  }

  const buttonStyle = {
    width: '40px',
    height: '40px',
    backgroundColor: isReady ? '#374151' : '#1f2937',
    border: '1px solid #4b5563',
    borderRadius: '4px',
    color: isReady ? '#fff' : '#6b7280',
    fontSize: '18px',
    cursor: isReady ? 'pointer' : 'not-allowed',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s'
  }

  const homeButtonStyle = {
    ...buttonStyle,
    backgroundColor: isReady ? '#3b82f6' : '#1e3a8a',
    fontSize: '20px'
  }

  const inputStyle = {
    width: '100%',
    padding: '6px 8px',
    backgroundColor: '#1f2937',
    border: '1px solid #4b5563',
    borderRadius: '4px',
    color: '#fff',
    fontSize: '12px'
  }

  return (
    <div style={{
      padding: '12px',
      backgroundColor: 'rgba(0, 0, 0, 0.2)',
      borderRadius: '6px',
      marginBottom: '12px'
    }}>
      <div style={{ 
        fontSize: '12px', 
        fontWeight: 'bold', 
        color: '#9ca3af',
        marginBottom: '10px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}>
        Machine Jog Controls
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
        <div>
          <label style={{ fontSize: '11px', color: '#9ca3af', display: 'block', marginBottom: '4px' }}>
            Feed Rate (F)
          </label>
          <input
            type="number"
            value={feedRate}
            onChange={handleFeedRateChange}
            min="1"
            max="10000"
            style={inputStyle}
            disabled={!isReady}
          />
        </div>
        <div>
          <label style={{ fontSize: '11px', color: '#9ca3af', display: 'block', marginBottom: '4px' }}>
            Step (mm)
          </label>
          <input
            type="number"
            value={stepSize}
            onChange={handleStepSizeChange}
            min="0.1"
            max="100"
            step="0.1"
            style={inputStyle}
            disabled={!isReady}
          />
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 40px)',
        gap: '4px',
        justifyContent: 'center'
      }}>
        <button
          onClick={() => handleJog(-1, 1)}
          disabled={!isReady}
          style={buttonStyle}
          title="Move Up-Left"
        >
          ↖
        </button>
        <button
          onClick={() => handleJog(0, 1)}
          disabled={!isReady}
          style={buttonStyle}
          title="Move Up"
        >
          ↑
        </button>
        <button
          onClick={() => handleJog(1, 1)}
          disabled={!isReady}
          style={buttonStyle}
          title="Move Up-Right"
        >
          ↗
        </button>

        <button
          onClick={() => handleJog(-1, 0)}
          disabled={!isReady}
          style={buttonStyle}
          title="Move Left"
        >
          ←
        </button>
        <button
          onClick={handleHome}
          disabled={!isReady}
          style={homeButtonStyle}
          title="Home (G28)"
        >
          🏠
        </button>
        <button
          onClick={() => handleJog(1, 0)}
          disabled={!isReady}
          style={buttonStyle}
          title="Move Right"
        >
          →
        </button>

        <button
          onClick={() => handleJog(-1, -1)}
          disabled={!isReady}
          style={buttonStyle}
          title="Move Down-Left"
        >
          ↙
        </button>
        <button
          onClick={() => handleJog(0, -1)}
          disabled={!isReady}
          style={buttonStyle}
          title="Move Down"
        >
          ↓
        </button>
        <button
          onClick={() => handleJog(1, -1)}
          disabled={!isReady}
          style={buttonStyle}
          title="Move Down-Right"
        >
          ↘
        </button>
      </div>

      {!isReady && (
        <div style={{
          marginTop: '8px',
          fontSize: '10px',
          color: '#6b7280',
          textAlign: 'center'
        }}>
          Connect machine to enable
        </div>
      )}
    </div>
  )
}
