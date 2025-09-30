import useCadStore from '../store/cadStore'

const MarkersWindow = ({ onActivateTool }) => {
  const { 
    markersVisible, 
    guidesVisible, 
    guidesLocked,
    setMarkersVisible, 
    setGuidesVisible,
    setGuidesLocked,
    clearMarkers,
    clearGuides,
    addGuide
  } = useCadStore()

  const handleAddHorizontalGuide = () => {
    addGuide({
      id: `guide-h-${Date.now()}`,
      type: 'horizontal',
      position: 100
    })
  }

  const handleAddVerticalGuide = () => {
    addGuide({
      id: `guide-v-${Date.now()}`,
      type: 'vertical',
      position: 100
    })
  }

  return (
    <div style={{ padding: '15px', minWidth: '200px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#fff', fontSize: '14px' }}>Markers</h3>
        
        <button
          onClick={() => onActivateTool('centerPoint')}
          style={{
            width: '100%',
            padding: '8px',
            marginBottom: '5px',
            backgroundColor: '#4a90e2',
            color: '#fff',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          Center Point
        </button>
        
        <button
          onClick={() => onActivateTool('lineMarker')}
          style={{
            width: '100%',
            padding: '8px',
            marginBottom: '10px',
            backgroundColor: '#4a90e2',
            color: '#fff',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          Line Marker
        </button>

        <div style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
          <button
            onClick={() => setMarkersVisible(!markersVisible)}
            style={{
              flex: 1,
              padding: '6px',
              backgroundColor: markersVisible ? '#666' : '#333',
              color: '#fff',
              border: '1px solid #555',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            {markersVisible ? 'Hide' : 'Show'}
          </button>
          <button
            onClick={clearMarkers}
            style={{
              flex: 1,
              padding: '6px',
              backgroundColor: '#d9534f',
              color: '#fff',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Clear
          </button>
        </div>
      </div>

      <div style={{ borderTop: '1px solid #444', paddingTop: '15px' }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#fff', fontSize: '14px' }}>Guides</h3>
        
        <button
          onClick={handleAddHorizontalGuide}
          style={{
            width: '100%',
            padding: '8px',
            marginBottom: '5px',
            backgroundColor: '#5cb85c',
            color: '#fff',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          Add Horizontal
        </button>
        
        <button
          onClick={handleAddVerticalGuide}
          style={{
            width: '100%',
            padding: '8px',
            marginBottom: '10px',
            backgroundColor: '#5cb85c',
            color: '#fff',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          Add Vertical
        </button>

        <label style={{
          display: 'flex',
          alignItems: 'center',
          color: '#fff',
          cursor: 'pointer',
          marginBottom: '8px',
          fontSize: '13px'
        }}>
          <input
            type="checkbox"
            checked={guidesLocked}
            onChange={(e) => setGuidesLocked(e.target.checked)}
            style={{ marginRight: '8px' }}
          />
          Lock Guides
        </label>

        <div style={{ display: 'flex', gap: '5px' }}>
          <button
            onClick={() => setGuidesVisible(!guidesVisible)}
            style={{
              flex: 1,
              padding: '6px',
              backgroundColor: guidesVisible ? '#666' : '#333',
              color: '#fff',
              border: '1px solid #555',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            {guidesVisible ? 'Hide' : 'Show'}
          </button>
          <button
            onClick={clearGuides}
            style={{
              flex: 1,
              padding: '6px',
              backgroundColor: '#d9534f',
              color: '#fff',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  )
}

export default MarkersWindow
