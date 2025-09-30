import useCadStore from '../store/cadStore'

const SnapToolsWindow = () => {
  const { snap, updateSnap } = useCadStore()

  return (
    <div style={{ padding: '10px' }}>
      <div style={{ marginBottom: '10px' }}>
        <label style={{ 
          display: 'flex', 
          alignItems: 'center', 
          color: '#fff',
          cursor: 'pointer',
          marginBottom: '8px'
        }}>
          <input
            type="checkbox"
            checked={snap.grid}
            onChange={(e) => updateSnap('grid', e.target.checked)}
            style={{ marginRight: '8px' }}
          />
          <span style={{ color: '#00FF00', marginRight: '8px' }}>●</span>
          Grid Snap
        </label>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label style={{ 
          display: 'flex', 
          alignItems: 'center', 
          color: '#fff',
          cursor: 'pointer',
          marginBottom: '8px'
        }}>
          <input
            type="checkbox"
            checked={snap.endpoint}
            onChange={(e) => updateSnap('endpoint', e.target.checked)}
            style={{ marginRight: '8px' }}
          />
          <span style={{ color: '#FF0000', marginRight: '8px' }}>●</span>
          Endpoint Snap
        </label>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label style={{ 
          display: 'flex', 
          alignItems: 'center', 
          color: '#fff',
          cursor: 'pointer',
          marginBottom: '8px'
        }}>
          <input
            type="checkbox"
            checked={snap.midpoint}
            onChange={(e) => updateSnap('midpoint', e.target.checked)}
            style={{ marginRight: '8px' }}
          />
          <span style={{ color: '#0088FF', marginRight: '8px' }}>●</span>
          Midpoint Snap
        </label>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label style={{ 
          display: 'flex', 
          alignItems: 'center', 
          color: '#fff',
          cursor: 'pointer',
          marginBottom: '8px'
        }}>
          <input
            type="checkbox"
            checked={snap.center}
            onChange={(e) => updateSnap('center', e.target.checked)}
            style={{ marginRight: '8px' }}
          />
          <span style={{ color: '#0088FF', marginRight: '8px' }}>●</span>
          Center Snap
        </label>
      </div>

      <div style={{ 
        marginTop: '15px', 
        paddingTop: '10px', 
        borderTop: '1px solid #444',
        fontSize: '12px',
        color: '#888'
      }}>
        Snap priority: Endpoint → Midpoint → Center → Grid
      </div>
    </div>
  )
}

export default SnapToolsWindow
