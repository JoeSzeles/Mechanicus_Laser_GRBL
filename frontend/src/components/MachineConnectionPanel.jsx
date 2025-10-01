import { useState } from 'react'
import { useSerial } from '../contexts/SerialContext'
import useCadStore from '../store/cadStore'

export default function MachineConnectionPanel() {
  const { companionStatus, serialState, isConnected, connectToCompanion, connectSerial, disconnectSerial } = useSerial()
  const machineProfile = useCadStore((state) => state.machineProfile)
  const [selectedPort, setSelectedPort] = useState('COM7')

  const handleConnect = () => {
    if (companionStatus !== 'connected') {
      connectToCompanion()
    } else if (!isConnected) {
      connectSerial(selectedPort, machineProfile.profileName || 'grbl')
    }
  }

  const handleDisconnect = () => {
    if (serialState.port) {
      disconnectSerial(serialState.port)
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '6px 8px',
    backgroundColor: '#1f2937',
    border: '1px solid #4b5563',
    borderRadius: '4px',
    color: '#fff',
    fontSize: '11px',
    marginTop: '4px'
  }

  return (
    <div style={{
      padding: '12px',
      marginBottom: '8px',
      backgroundColor: 'rgba(0, 0, 0, 0.2)',
      borderRadius: '6px',
      fontSize: '12px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <div style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          backgroundColor: isConnected && serialState.port ? '#4ade80' : companionStatus === 'connecting' ? '#fbbf24' : '#ef4444',
          boxShadow: isConnected && serialState.port ? '0 0 8px #4ade80' : 'none'
        }} />
        <span style={{ fontWeight: 'bold', color: '#fff', flex: 1, fontSize: '11px' }}>
          {isConnected && serialState.port ? 'Machine Connected' : companionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
        </span>
      </div>

      {isConnected && serialState.port ? (
        <>
          <div style={{ paddingLeft: '18px', color: '#4ade80', fontSize: '11px', fontWeight: 'bold', marginBottom: '8px' }}>
            ✓ {serialState.port}
          </div>
          <button
            onClick={handleDisconnect}
            style={{
              width: '100%',
              padding: '6px 12px',
              fontSize: '11px',
              backgroundColor: '#ef4444',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Disconnect
          </button>
        </>
      ) : (
        <>
          <div style={{ marginBottom: '8px' }}>
            <label style={{ fontSize: '10px', color: '#9ca3af', display: 'block' }}>
              COM Port
            </label>
            <input
              type="text"
              value={selectedPort}
              onChange={(e) => setSelectedPort(e.target.value)}
              placeholder="COM7"
              style={inputStyle}
              disabled={isConnected}
            />
          </div>
          <button
            onClick={handleConnect}
            disabled={!selectedPort || (companionStatus === 'connecting')}
            style={{
              width: '100%',
              padding: '6px 12px',
              fontSize: '11px',
              backgroundColor: selectedPort ? '#3b82f6' : '#1e3a8a',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: selectedPort ? 'pointer' : 'not-allowed',
              fontWeight: 'bold'
            }}
          >
            {companionStatus !== 'connected' ? 'Connect to Companion' : 'Connect Serial'}
          </button>
        </>
      )}
    </div>
  )
}
