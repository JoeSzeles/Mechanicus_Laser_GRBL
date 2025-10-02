
# Machine Settings Popup Documentation

## Overview
The Machine Settings Popup is a comprehensive configuration interface for managing machine profiles, connection settings, and G-code generation parameters.

## Location
**File:** `frontend/src/components/MachineSettingsPopup.jsx`  
**Styles:** `frontend/src/components/MachineSettingsPopup.css`

## Architecture

### Component Structure
```
MachineSettingsPopup (Props: isOpen, onClose)
├── Header (Title + Close Button)
├── Tabs (Connection | Configuration)
├── Error/Success Messages
└── Tab Content
    ├── Connection Tab
    │   ├── Profile Management
    │   └── Connection Settings
    └── Configuration Tab
        ├── G-code Structure
        ├── Machine Behavior
        ├── Speed Settings
        ├── Laser Settings (Laser Mode Only)
        ├── Z-Axis Settings (CNC Mode Only)
        ├── 3D Printing Settings (CNC Mode Only)
        ├── Workspace Settings
        └── Advanced Settings
```

## State Management

### Store Integration
Uses Zustand store (`useCadStore`) for:
- `machineConnection` - Connection state and profiles
- `loadMachineProfiles()` - Fetch all profiles from database
- `saveMachineProfile()` - Create new profile
- `updateMachineProfile()` - Update existing profile
- `deleteMachineProfile()` - Remove profile
- `setDefaultProfile()` - Mark profile as default
- `setCurrentProfile()` - Switch active profile

### Local Component State
```javascript
const [activeTab, setActiveTab] = useState('connection')
const [isLoading, setIsLoading] = useState(false)
const [error, setError] = useState(null)
const [success, setSuccess] = useState(null)
const [formData, setFormData] = useState({...})
const [isNewProfile, setIsNewProfile] = useState(true)
const [expandedSections, setExpandedSections] = useState({...})
```

## Tab 1: Connection Settings

### Profile Management Section
**Fields:**
- **Select Profile** (Dropdown) - Choose from saved profiles
- **New Profile Button** - Create blank profile
- **Profile Name** (Text Input) - Name for identification
- **Machine Type** (Toggle Buttons)
  - 🔥 Laser Engraver (2-axis + laser power)
  - 🔧 CNC/3D Printer (3-axis for G-code)

### Connection Settings Section
**Fields:**
- **Serial Port** (Text Input) - e.g., "COM4", "/dev/ttyUSB0"
- **Baud Rate** (Dropdown) - 9600, 19200, 38400, 57600, 115200, 250000
- **Auto-Detect Button** - Scan for connected machines (requires companion app)

### Action Buttons
- **Save Profile** - Create or update profile in database
- **Set as Default** - Mark this profile to load on startup
- **Delete Profile** - Remove profile (with confirmation)

## Tab 2: Configuration Settings

All sections are collapsible (click header to expand/collapse).

### 1. G-code Structure
Controls G-code output formatting:
- **Preamble** - Commands at file start (e.g., "G90")
- **Postamble** - Commands at file end
- **Shape Preamble** - Commands before each shape
- **Shape Postamble** - Commands after each shape

### 2. Machine Behavior
- **Coordinates** (Dropdown) - Absolute | Relative
- **Units** (Dropdown) - Points | Millimeters
- **Auto Scale to Bed Size** (Checkbox) - Fit designs to bed
- **Optimize Path** (Checkbox) - Minimize travel (slower for large files)

### 3. Speed Settings
All values in units/minute:
- **Line Speed** - Drawing straight lines
- **Curve Speed** - Drawing curves/arcs
- **Draw Speed** - General drawing speed
- **Travel Speed** - Non-drawing movements
- **Feed Rate** - Overall feed rate

### 4. Laser Settings (Laser Mode Only)
- **Laser Power (0-1000)** - PWM power level
  - 0 = Off
  - 1000 = Maximum power

### 5. Z-Axis Settings (CNC Mode Only)
Height control for pen plotters, CNC routers, 3D printers:
- **Draw Height** - Z position when drawing
- **Travel Height** - Z position when moving
- **Z Travel** - Safe travel height
- **Z Draw** - Active drawing height
- **Z Lift** - Lift between operations
- **Z Refill** - Height for pen refill
- **Z Color** - Height for color change
- **Z Start** - Starting Z position
- **Z Center** - Center operation Z
- **Z End** - Ending Z position

### 6. 3D Printing Settings (CNC Mode Only)
FDM printing parameters:
- **Layer Height** - Z increment per layer (mm)
- **Layers** - Number of layers to print
- **Print Acceleration** - Acceleration when printing
- **Travel Acceleration** - Acceleration when moving
- **Max Jerk** - Maximum jerk value

### 7. Workspace Settings
**Canvas/Bed Dimensions:**
- **Bed Max X (mm)** - Maximum X dimension (width)
- **Bed Max Y (mm)** - Maximum Y dimension (height)
- **X Offset** - Origin offset in X
- **Y Offset** - Origin offset in Y
- **Scale Factor** - Global scaling multiplier

### 8. Advanced Settings
Fine-tuning parameters:
- **Smoothness** - Curve smoothing factor (0.01-1.0)
- **Connect Tolerance** - Path connection threshold (mm)
- **Refill Position (X, Y, Z)** - Coordinates for pen refill
- **Refill Length** - Distance to travel during refill
- **Gradient Length (mm)** - Gradient transition distance
- **Enable Refill** (Checkbox) - Automatic refill on long paths

## Data Flow

### Profile Loading
```
User selects profile
    ↓
loadMachineProfiles() fetches from API
    ↓
setCurrentProfile() updates store
    ↓
formData state populated
    ↓
Form fields update
```

### Profile Saving
```
User modifies form
    ↓
handleInputChange() updates formData
    ↓
User clicks "Save Profile"
    ↓
saveMachineProfile() or updateMachineProfile()
    ↓
API POST/PUT to /api/machine-profiles
    ↓
Database update
    ↓
loadMachineProfiles() refreshes list
    ↓
Success message displayed
```

## Database Schema

**Table:** `machine_profiles`

```typescript
{
  id: number (Primary Key)
  userId: number (Foreign Key)
  name: string
  isDefault: boolean
  machineType: 'laser_engraver' | 'cnc_printer'
  
  // Connection
  serialConnection: string
  baud: number
  
  // G-code
  preamble: string
  postamble: string
  shapePreamble: string
  shapePostamble: string
  
  // Behavior
  coordinates: 'absolute' | 'relative'
  units: 'points' | 'mm'
  autoScale: boolean
  optimise: boolean
  
  // Speed (all numbers)
  lineSpeed: number
  curveSpeed: number
  drawSpeed: number
  travelSpeed: number
  feedRate: number
  
  // Z-Axis (all numbers)
  drawHeight: number
  travelHeight: number
  zTravel: number
  zDraw: number
  zLift: number
  zRefill: number
  zColor: number
  zStart: number
  zCenter: number
  zEnd: number
  
  // Laser
  laserPower: number
  
  // 3D Printing (all numbers)
  layerHeight: number
  printAccel: number
  travelAccel: number
  maxJerk: number
  layers: number
  
  // Workspace (all numbers)
  bedMaxX: number
  bedMaxY: number
  xOffset: number
  yOffset: number
  scaleF: number
  
  // Advanced
  smoothness: number
  connectTolerance: number
  refillPosX: number
  refillPosY: number
  refillPosZ: number
  refillLength: number
  refill: boolean
  gradientLengthMm: number
  
  createdAt: Date
  updatedAt: Date
}
```

## API Endpoints

### GET /api/machine-profiles
Fetch all profiles for authenticated user

### GET /api/machine-profiles/default
Fetch the default profile for authenticated user

### POST /api/machine-profiles
Create new profile
```json
{
  "name": "My Laser",
  "machineType": "laser_engraver",
  "serialConnection": "COM4",
  "baud": 250000,
  ...
}
```

### PUT /api/machine-profiles/:id
Update existing profile

### DELETE /api/machine-profiles/:id
Delete profile (cannot delete if it's the only profile)

### POST /api/machine-profiles/:id/set-default
Set profile as default

## Usage Examples

### Opening the Popup
```javascript
import MachineSettingsPopup from './components/MachineSettingsPopup'

function MyComponent() {
  const [showSettings, setShowSettings] = useState(false)
  
  return (
    <>
      <button onClick={() => setShowSettings(true)}>
        Settings
      </button>
      
      <MachineSettingsPopup 
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </>
  )
}
```

### Programmatically Loading Default Profile
```javascript
const loadDefaultProfile = useCadStore((state) => state.loadDefaultProfile)

useEffect(() => {
  loadDefaultProfile()
}, [])
```

### Creating a Profile via Code
```javascript
const saveMachineProfile = useCadStore((state) => state.saveMachineProfile)

await saveMachineProfile({
  name: 'Test Machine',
  machineType: 'laser_engraver',
  serialConnection: 'COM5',
  baud: 115200,
  bedMaxX: 400,
  bedMaxY: 300,
  laserPower: 800
})
```

## UI/UX Features

### Visual Feedback
- **Error Messages** - Red banner at top when operations fail
- **Success Messages** - Green banner at top when operations succeed
- **Loading States** - Disabled buttons with "Saving..." text
- **Validation** - Client-side validation before API calls

### Responsive Design
- **Max Width:** 800px
- **Max Height:** 85vh (85% of viewport height)
- **Scrollable Content** - Vertical scroll when content overflows
- **Mobile Responsive** - Grid layout adapts on smaller screens

### Animations
- **Slide In** - Popup entrance animation
- **Section Expand** - Smooth height transition on section toggle
- **Button Hover** - Color change and slight lift effect

## Integration Points

### With CADInterface
```javascript
// In CADInterface.jsx
const [showMachineSettings, setShowMachineSettings] = useState(false)

<button onClick={() => setShowMachineSettings(true)}>
  Settings
</button>

<MachineSettingsPopup 
  isOpen={showMachineSettings}
  onClose={() => setShowMachineSettings(false)}
/>
```

### With Serial Communication
Machine profiles configure serial connection parameters used by the companion app.

### With G-code Generation
Settings control how shapes are converted to G-code (see `gcodegenerator.py`).

## Future Enhancements

### Planned Features
1. **Import/Export Profiles** - Save/load profiles as JSON files
2. **Profile Templates** - Pre-configured profiles for common machines
3. **Auto-Detection** - Automatic serial port and baud rate detection
4. **Machine Test** - Send test patterns to verify settings
5. **Profile Sharing** - Share profiles with other users
6. **Validation Rules** - More robust input validation
7. **Preset Management** - Quick-switch between saved presets

### Known Limitations
1. Auto-detect requires companion app running
2. No real-time validation of serial connection
3. Profile changes don't update active canvas immediately
4. No undo/redo for profile edits
5. Limited error handling for malformed data

## Troubleshooting

### Common Issues

**Problem:** Profile won't save  
**Solution:** Check authentication, verify all required fields filled

**Problem:** Can't delete profile  
**Solution:** Must have at least one profile, cannot delete last one

**Problem:** Settings don't take effect  
**Solution:** Reload page or reconnect to machine after profile change

**Problem:** Auto-detect doesn't work  
**Solution:** Ensure companion app is running and accessible

## Related Files

- `frontend/src/components/MachineSettingsPopup.jsx` - Component logic
- `frontend/src/components/MachineSettingsPopup.css` - Styling
- `frontend/src/store/cadStore.js` - State management
- `server/index.ts` - API endpoints
- `shared/schema.ts` - Database schema
- `mechanicus_laser_cad/machine_profiles/` - Profile storage
