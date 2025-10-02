import React, { useState, useEffect } from 'react'
import useCadStore from '../store/cadStore'
import './MachineSettingsPopup.css'

function MachineSettingsPopup({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('connection')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  
  const machineConnection = useCadStore((state) => state.machineConnection)
  const loadMachineProfiles = useCadStore((state) => state.loadMachineProfiles)
  const saveMachineProfile = useCadStore((state) => state.saveMachineProfile)
  const updateMachineProfile = useCadStore((state) => state.updateMachineProfile)
  const deleteMachineProfile = useCadStore((state) => state.deleteMachineProfile)
  const setDefaultProfile = useCadStore((state) => state.setDefaultProfile)
  const setCurrentProfile = useCadStore((state) => state.setCurrentProfile)
  
  // Form state for current profile
  const [formData, setFormData] = useState({
    name: '',
    machineType: 'laser_engraver',
    // Connection
    serialConnection: 'COM4',
    baud: 250000,
    // G-code Structure
    preamble: 'G1 Z60',
    postamble: '(postamble)',
    shapePreamble: 'G1 Z60',
    shapePostamble: 'G1 Z60',
    // Machine Behavior
    coordinates: 'absolute',
    units: 'points',
    autoScale: false,
    optimise: true,
    // Speed Settings
    lineSpeed: 2000,
    curveSpeed: 2000,
    drawSpeed: 2000,
    travelSpeed: 2000,
    feedRate: 3000,
    // Height/Z-Axis Settings (CNC)
    drawHeight: 0,
    travelHeight: 26,
    zTravel: 3,
    zDraw: 0.0,
    zLift: 2,
    zRefill: 20,
    zColor: 18,
    zStart: 19,
    zCenter: 15,
    zEnd: 19,
    // Laser Settings
    laserPower: 1000,
    // 3D Printing
    layerHeight: 0.15,
    printAccel: 3000,
    travelAccel: 2000,
    maxJerk: 200,
    layers: 1,
    // Workspace
    bedMaxX: 300,
    bedMaxY: 300,
    xOffset: 0,
    yOffset: 0,
    scaleF: 0.72,
    // Advanced
    smoothness: 0.34,
    connectTolerance: 0.001,
    refillPosX: 150,
    refillPosY: 10,
    refillPosZ: 20,
    refillLength: 200,
    refill: false,
    gradientLengthMm: 8
  })
  
  const [isNewProfile, setIsNewProfile] = useState(true)
  const [expandedSections, setExpandedSections] = useState({
    gcode: true,
    behavior: false,
    speed: false,
    laser: false,
    zaxis: false,
    printing: false,
    workspace: false,
    advanced: false
  })
  
  // Load profiles on mount
  useEffect(() => {
    if (isOpen) {
      loadMachineProfiles()
    }
  }, [isOpen])
  
  // Update form when current profile changes
  useEffect(() => {
    if (machineConnection.currentProfile) {
      setFormData({ ...machineConnection.currentProfile })
      setIsNewProfile(false)
    }
  }, [machineConnection.currentProfile])
  
  if (!isOpen) return null
  
  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }
  
  const handleProfileSelect = (profileId) => {
    const profile = machineConnection.availableProfiles.find(p => p.id === profileId)
    if (profile) {
      setFormData({ ...profile })
      setCurrentProfile(profile)
      setIsNewProfile(false)
    }
  }
  
  const handleNewProfile = () => {
    setFormData({
      name: 'New Profile',
      machineType: 'laser_engraver',
      serialConnection: 'COM4',
      baud: 250000,
      preamble: 'G1 Z60',
      postamble: '(postamble)',
      shapePreamble: 'G1 Z60',
      shapePostamble: 'G1 Z60',
      coordinates: 'absolute',
      units: 'points',
      autoScale: false,
      optimise: true,
      lineSpeed: 2000,
      curveSpeed: 2000,
      drawSpeed: 2000,
      travelSpeed: 2000,
      feedRate: 3000,
      drawHeight: 0,
      travelHeight: 26,
      zTravel: 3,
      zDraw: 0.0,
      zLift: 2,
      zRefill: 20,
      zColor: 18,
      zStart: 19,
      zCenter: 15,
      zEnd: 19,
      laserPower: 1000,
      layerHeight: 0.15,
      printAccel: 3000,
      travelAccel: 2000,
      maxJerk: 200,
      layers: 1,
      bedMaxX: 300,
      bedMaxY: 300,
      xOffset: 0,
      yOffset: 0,
      scaleF: 0.72,
      smoothness: 0.34,
      connectTolerance: 0.001,
      refillPosX: 150,
      refillPosY: 10,
      refillPosZ: 20,
      refillLength: 200,
      refill: false,
      gradientLengthMm: 8
    })
    setIsNewProfile(true)
    setCurrentProfile(null)
  }
  
  const handleSave = async () => {
    setIsLoading(true)
    setError(null)
    setSuccess(null)
    
    try {
      if (isNewProfile) {
        await saveMachineProfile(formData)
        setSuccess('Profile created successfully!')
      } else {
        await updateMachineProfile(machineConnection.currentProfile.id, formData)
        setSuccess('Profile updated successfully!')
      }
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError('Failed to save profile: ' + err.message)
    } finally {
      setIsLoading(false)
    }
  }
  
  const handleDelete = async () => {
    if (!machineConnection.currentProfile || isNewProfile) return
    
    if (!confirm('Are you sure you want to delete this profile?')) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      await deleteMachineProfile(machineConnection.currentProfile.id)
      handleNewProfile()
      setSuccess('Profile deleted successfully!')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError('Failed to delete profile: ' + err.message)
    } finally {
      setIsLoading(false)
    }
  }
  
  const handleSetDefault = async () => {
    if (!machineConnection.currentProfile || isNewProfile) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      await setDefaultProfile(machineConnection.currentProfile.id)
      setSuccess('Default profile set!')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError('Failed to set default: ' + err.message)
    } finally {
      setIsLoading(false)
    }
  }
  
  const handleAutoDetect = () => {
    // TODO: Implement auto-detect via companion app
    alert('Auto-detect feature will scan COM ports when companion app is running')
  }
  
  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }
  
  const isLaserMode = formData.machineType === 'laser_engraver'
  const isCNCMode = formData.machineType === 'cnc_printer'
  
  return (
    <div className="machine-settings-overlay" onClick={onClose}>
      <div className="machine-settings-popup" onClick={(e) => e.stopPropagation()}>
        <div className="machine-settings-header">
          <h2>Machine Settings</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="machine-settings-tabs">
          <button 
            className={`tab-button ${activeTab === 'connection' ? 'active' : ''}`}
            onClick={() => setActiveTab('connection')}
          >
            Connection
          </button>
          <button 
            className={`tab-button ${activeTab === 'config' ? 'active' : ''}`}
            onClick={() => setActiveTab('config')}
          >
            Configuration
          </button>
        </div>
        
        {error && <div className="settings-error">{error}</div>}
        {success && <div className="settings-success">{success}</div>}
        
        <div className="machine-settings-content">
          {activeTab === 'connection' && (
            <div className="connection-tab">
              <div className="settings-section">
                <h3>Profile Management</h3>
                
                <div className="form-group">
                  <label>Select Profile</label>
                  <div className="profile-selector">
                    <select 
                      value={machineConnection.currentProfile?.id || ''}
                      onChange={(e) => handleProfileSelect(parseInt(e.target.value))}
                    >
                      <option value="">-- Select Profile --</option>
                      {machineConnection.availableProfiles.map(profile => (
                        <option key={profile.id} value={profile.id}>
                          {profile.name} {profile.isDefault ? '(Default)' : ''}
                        </option>
                      ))}
                    </select>
                    <button className="new-profile-btn" onClick={handleNewProfile}>
                      + New Profile
                    </button>
                  </div>
                </div>
                
                <div className="form-group">
                  <label>Profile Name</label>
                  <input 
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="My Machine Profile"
                  />
                </div>
                
                <div className="form-group">
                  <label>Machine Type</label>
                  <div className="machine-type-toggle">
                    <button 
                      className={`machine-type-btn ${isLaserMode ? 'active' : ''}`}
                      onClick={() => handleInputChange('machineType', 'laser_engraver')}
                    >
                      🔥 Laser Engraver
                      <span className="machine-desc">2-axis + laser power</span>
                    </button>
                    <button 
                      className={`machine-type-btn ${isCNCMode ? 'active' : ''}`}
                      onClick={() => handleInputChange('machineType', 'cnc_printer')}
                    >
                      🔧 CNC/3D Printer
                      <span className="machine-desc">3-axis for G-code</span>
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="settings-section">
                <h3>Connection Settings</h3>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Serial Port</label>
                    <input 
                      type="text"
                      value={formData.serialConnection}
                      onChange={(e) => handleInputChange('serialConnection', e.target.value)}
                      placeholder="COM4"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Baud Rate</label>
                    <select 
                      value={formData.baud}
                      onChange={(e) => handleInputChange('baud', parseInt(e.target.value))}
                    >
                      <option value={9600}>9600</option>
                      <option value={19200}>19200</option>
                      <option value={38400}>38400</option>
                      <option value={57600}>57600</option>
                      <option value={115200}>115200</option>
                      <option value={250000}>250000</option>
                    </select>
                  </div>
                </div>
                
                <button className="auto-detect-btn" onClick={handleAutoDetect}>
                  🔍 Auto-Detect Machine
                </button>
              </div>
              
              <div className="settings-actions">
                <button className="save-btn" onClick={handleSave} disabled={isLoading}>
                  {isLoading ? 'Saving...' : 'Save Profile'}
                </button>
                {!isNewProfile && (
                  <>
                    <button className="default-btn" onClick={handleSetDefault} disabled={isLoading}>
                      Set as Default
                    </button>
                    <button className="delete-btn" onClick={handleDelete} disabled={isLoading}>
                      Delete Profile
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
          
          {activeTab === 'config' && (
            <div className="config-tab">
              {/* G-code Structure Section */}
              <div className="config-section">
                <div 
                  className="config-section-header" 
                  onClick={() => toggleSection('gcode')}
                >
                  <span>{expandedSections.gcode ? '▼' : '▶'} G-code Structure</span>
                </div>
                {expandedSections.gcode && (
                  <div className="config-section-content">
                    <div className="form-group">
                      <label>Preamble</label>
                      <input 
                        type="text"
                        value={formData.preamble}
                        onChange={(e) => handleInputChange('preamble', e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label>Postamble</label>
                      <input 
                        type="text"
                        value={formData.postamble}
                        onChange={(e) => handleInputChange('postamble', e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label>Shape Preamble</label>
                      <input 
                        type="text"
                        value={formData.shapePreamble}
                        onChange={(e) => handleInputChange('shapePreamble', e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label>Shape Postamble</label>
                      <input 
                        type="text"
                        value={formData.shapePostamble}
                        onChange={(e) => handleInputChange('shapePostamble', e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
              
              {/* Machine Behavior Section */}
              <div className="config-section">
                <div 
                  className="config-section-header" 
                  onClick={() => toggleSection('behavior')}
                >
                  <span>{expandedSections.behavior ? '▼' : '▶'} Machine Behavior</span>
                </div>
                {expandedSections.behavior && (
                  <div className="config-section-content">
                    <div className="form-row">
                      <div className="form-group">
                        <label>Coordinates</label>
                        <select 
                          value={formData.coordinates}
                          onChange={(e) => handleInputChange('coordinates', e.target.value)}
                        >
                          <option value="absolute">Absolute</option>
                          <option value="relative">Relative</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Units</label>
                        <select 
                          value={formData.units}
                          onChange={(e) => handleInputChange('units', e.target.value)}
                        >
                          <option value="points">Points</option>
                          <option value="mm">Millimeters</option>
                        </select>
                      </div>
                    </div>
                    <div className="form-group checkbox-group">
                      <label>
                        <input 
                          type="checkbox"
                          checked={formData.autoScale}
                          onChange={(e) => handleInputChange('autoScale', e.target.checked)}
                        />
                        Auto Scale to Bed Size
                      </label>
                    </div>
                    <div className="form-group checkbox-group">
                      <label>
                        <input 
                          type="checkbox"
                          checked={formData.optimise}
                          onChange={(e) => handleInputChange('optimise', e.target.checked)}
                        />
                        Optimize Path (slower for large files)
                      </label>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Speed Settings Section */}
              <div className="config-section">
                <div 
                  className="config-section-header" 
                  onClick={() => toggleSection('speed')}
                >
                  <span>{expandedSections.speed ? '▼' : '▶'} Speed Settings</span>
                </div>
                {expandedSections.speed && (
                  <div className="config-section-content">
                    <div className="form-row">
                      <div className="form-group">
                        <label>Line Speed</label>
                        <input 
                          type="number"
                          value={formData.lineSpeed}
                          onChange={(e) => handleInputChange('lineSpeed', parseInt(e.target.value))}
                        />
                      </div>
                      <div className="form-group">
                        <label>Curve Speed</label>
                        <input 
                          type="number"
                          value={formData.curveSpeed}
                          onChange={(e) => handleInputChange('curveSpeed', parseInt(e.target.value))}
                        />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Draw Speed</label>
                        <input 
                          type="number"
                          value={formData.drawSpeed}
                          onChange={(e) => handleInputChange('drawSpeed', parseInt(e.target.value))}
                        />
                      </div>
                      <div className="form-group">
                        <label>Travel Speed</label>
                        <input 
                          type="number"
                          value={formData.travelSpeed}
                          onChange={(e) => handleInputChange('travelSpeed', parseInt(e.target.value))}
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Feed Rate</label>
                      <input 
                        type="number"
                        value={formData.feedRate}
                        onChange={(e) => handleInputChange('feedRate', parseInt(e.target.value))}
                      />
                    </div>
                  </div>
                )}
              </div>
              
              {/* Laser Settings (only for Laser mode) */}
              {isLaserMode && (
                <div className="config-section">
                  <div 
                    className="config-section-header" 
                    onClick={() => toggleSection('laser')}
                  >
                    <span>{expandedSections.laser ? '▼' : '▶'} Laser Settings</span>
                  </div>
                  {expandedSections.laser && (
                    <div className="config-section-content">
                      <div className="form-group">
                        <label>Laser Power (0-1000)</label>
                        <input 
                          type="number"
                          value={formData.laserPower}
                          onChange={(e) => handleInputChange('laserPower', parseInt(e.target.value))}
                          min={0}
                          max={1000}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Z-Axis Settings (only for CNC mode) */}
              {isCNCMode && (
                <div className="config-section">
                  <div 
                    className="config-section-header" 
                    onClick={() => toggleSection('zaxis')}
                  >
                    <span>{expandedSections.zaxis ? '▼' : '▶'} Z-Axis Settings</span>
                  </div>
                  {expandedSections.zaxis && (
                    <div className="config-section-content">
                      <div className="form-row">
                        <div className="form-group">
                          <label>Draw Height</label>
                          <input 
                            type="number"
                            value={formData.drawHeight}
                            onChange={(e) => handleInputChange('drawHeight', parseInt(e.target.value))}
                          />
                        </div>
                        <div className="form-group">
                          <label>Travel Height</label>
                          <input 
                            type="number"
                            value={formData.travelHeight}
                            onChange={(e) => handleInputChange('travelHeight', parseInt(e.target.value))}
                          />
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Z Travel</label>
                          <input 
                            type="number"
                            step="0.1"
                            value={formData.zTravel}
                            onChange={(e) => handleInputChange('zTravel', parseFloat(e.target.value))}
                          />
                        </div>
                        <div className="form-group">
                          <label>Z Draw</label>
                          <input 
                            type="number"
                            step="0.1"
                            value={formData.zDraw}
                            onChange={(e) => handleInputChange('zDraw', parseFloat(e.target.value))}
                          />
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Z Lift</label>
                          <input 
                            type="number"
                            step="0.1"
                            value={formData.zLift}
                            onChange={(e) => handleInputChange('zLift', parseFloat(e.target.value))}
                          />
                        </div>
                        <div className="form-group">
                          <label>Z Refill</label>
                          <input 
                            type="number"
                            value={formData.zRefill}
                            onChange={(e) => handleInputChange('zRefill', parseInt(e.target.value))}
                          />
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Z Color</label>
                          <input 
                            type="number"
                            value={formData.zColor}
                            onChange={(e) => handleInputChange('zColor', parseInt(e.target.value))}
                          />
                        </div>
                        <div className="form-group">
                          <label>Z Start</label>
                          <input 
                            type="number"
                            value={formData.zStart}
                            onChange={(e) => handleInputChange('zStart', parseInt(e.target.value))}
                          />
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Z Center</label>
                          <input 
                            type="number"
                            value={formData.zCenter}
                            onChange={(e) => handleInputChange('zCenter', parseInt(e.target.value))}
                          />
                        </div>
                        <div className="form-group">
                          <label>Z End</label>
                          <input 
                            type="number"
                            value={formData.zEnd}
                            onChange={(e) => handleInputChange('zEnd', parseInt(e.target.value))}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* 3D Printing Settings (only for CNC mode) */}
              {isCNCMode && (
                <div className="config-section">
                  <div 
                    className="config-section-header" 
                    onClick={() => toggleSection('printing')}
                  >
                    <span>{expandedSections.printing ? '▼' : '▶'} 3D Printing Settings</span>
                  </div>
                  {expandedSections.printing && (
                    <div className="config-section-content">
                      <div className="form-row">
                        <div className="form-group">
                          <label>Layer Height</label>
                          <input 
                            type="number"
                            step="0.01"
                            value={formData.layerHeight}
                            onChange={(e) => handleInputChange('layerHeight', parseFloat(e.target.value))}
                          />
                        </div>
                        <div className="form-group">
                          <label>Layers</label>
                          <input 
                            type="number"
                            value={formData.layers}
                            onChange={(e) => handleInputChange('layers', parseInt(e.target.value))}
                          />
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Print Acceleration</label>
                          <input 
                            type="number"
                            value={formData.printAccel}
                            onChange={(e) => handleInputChange('printAccel', parseInt(e.target.value))}
                          />
                        </div>
                        <div className="form-group">
                          <label>Travel Acceleration</label>
                          <input 
                            type="number"
                            value={formData.travelAccel}
                            onChange={(e) => handleInputChange('travelAccel', parseInt(e.target.value))}
                          />
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Max Jerk</label>
                        <input 
                          type="number"
                          value={formData.maxJerk}
                          onChange={(e) => handleInputChange('maxJerk', parseInt(e.target.value))}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Workspace Settings Section */}
              <div className="config-section">
                <div 
                  className="config-section-header" 
                  onClick={() => toggleSection('workspace')}
                >
                  <span>{expandedSections.workspace ? '▼' : '▶'} Workspace Settings</span>
                </div>
                {expandedSections.workspace && (
                  <div className="config-section-content">
                    <div className="form-row">
                      <div className="form-group">
                        <label>Bed Max X (mm)</label>
                        <input 
                          type="number"
                          value={formData.bedMaxX}
                          onChange={(e) => handleInputChange('bedMaxX', parseInt(e.target.value))}
                        />
                      </div>
                      <div className="form-group">
                        <label>Bed Max Y (mm)</label>
                        <input 
                          type="number"
                          value={formData.bedMaxY}
                          onChange={(e) => handleInputChange('bedMaxY', parseInt(e.target.value))}
                        />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>X Offset</label>
                        <input 
                          type="number"
                          value={formData.xOffset}
                          onChange={(e) => handleInputChange('xOffset', parseInt(e.target.value))}
                        />
                      </div>
                      <div className="form-group">
                        <label>Y Offset</label>
                        <input 
                          type="number"
                          value={formData.yOffset}
                          onChange={(e) => handleInputChange('yOffset', parseInt(e.target.value))}
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Scale Factor</label>
                      <input 
                        type="number"
                        step="0.01"
                        value={formData.scaleF}
                        onChange={(e) => handleInputChange('scaleF', parseFloat(e.target.value))}
                      />
                    </div>
                  </div>
                )}
              </div>
              
              {/* Advanced Settings Section */}
              <div className="config-section">
                <div 
                  className="config-section-header" 
                  onClick={() => toggleSection('advanced')}
                >
                  <span>{expandedSections.advanced ? '▼' : '▶'} Advanced Settings</span>
                </div>
                {expandedSections.advanced && (
                  <div className="config-section-content">
                    <div className="form-row">
                      <div className="form-group">
                        <label>Smoothness</label>
                        <input 
                          type="number"
                          step="0.01"
                          value={formData.smoothness}
                          onChange={(e) => handleInputChange('smoothness', parseFloat(e.target.value))}
                        />
                      </div>
                      <div className="form-group">
                        <label>Connect Tolerance</label>
                        <input 
                          type="number"
                          step="0.001"
                          value={formData.connectTolerance}
                          onChange={(e) => handleInputChange('connectTolerance', parseFloat(e.target.value))}
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Refill Position (X, Y, Z)</label>
                      <div className="form-row">
                        <input 
                          type="number"
                          value={formData.refillPosX}
                          onChange={(e) => handleInputChange('refillPosX', parseInt(e.target.value))}
                          placeholder="X"
                        />
                        <input 
                          type="number"
                          value={formData.refillPosY}
                          onChange={(e) => handleInputChange('refillPosY', parseInt(e.target.value))}
                          placeholder="Y"
                        />
                        <input 
                          type="number"
                          value={formData.refillPosZ}
                          onChange={(e) => handleInputChange('refillPosZ', parseInt(e.target.value))}
                          placeholder="Z"
                        />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Refill Length</label>
                        <input 
                          type="number"
                          value={formData.refillLength}
                          onChange={(e) => handleInputChange('refillLength', parseInt(e.target.value))}
                        />
                      </div>
                      <div className="form-group">
                        <label>Gradient Length (mm)</label>
                        <input 
                          type="number"
                          value={formData.gradientLengthMm}
                          onChange={(e) => handleInputChange('gradientLengthMm', parseInt(e.target.value))}
                        />
                      </div>
                    </div>
                    <div className="form-group checkbox-group">
                      <label>
                        <input 
                          type="checkbox"
                          checked={formData.refill}
                          onChange={(e) => handleInputChange('refill', e.target.checked)}
                        />
                        Enable Refill
                      </label>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="settings-actions">
                <button className="save-btn" onClick={handleSave} disabled={isLoading}>
                  {isLoading ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default MachineSettingsPopup
