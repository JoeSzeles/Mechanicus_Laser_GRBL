# Mechanicus CAD - Laser/CNC Design System

## Project Overview
A modern web-based CAD system for laser engraving and CNC machines, inspired by the Python Mechanicus application. Built with React/Vite frontend, Node.js backend, and PostgreSQL database.

## Current Implementation Status
✅ **Stages 1 & 2 Completed** (September 30, 2025)
- Full-stack web application setup with authentication system
- Main CAD interface with Fabric.js canvas integration
- Database schema for users, projects, machine configurations, and preferences
- Complete drawing tools (line, rectangle, circle, polygon, arc, free draw)
- Grid system with zoom/pan functionality
- **Layer Management**: Full layer system with visibility, lock, reorder, rename
- Properties panel for object editing
- User authentication with email/password
- Responsive dark theme UI
- **Rectangle Selection**: Multi-shape selection with visual feedback
- **SVG Import/Export**: Full layer organization support
- **Undo/Redo System**: Complete with keyboard shortcuts (Ctrl+Z, Ctrl+Y)

**Stage 2: Professional UI Optimization**
- **Phase 9**: Icon-based 4-column sidebar with organized tool buttons
- **Phase 10**: Professional menu bar with 9 dropdown menus (File, Edit, Selection, Tools, View, Workspace, Settings, User, Help)
- **Phase 11**: Grid controls moved to top toolbar for cleaner layout
- **Phase 12**: Floating panel system with stacking on right side (Drawing Tools, Layers, Shape Properties default open)
- **Phase 13**: Workspace persistence with auto-save/restore
- **Phase 14**: UI polish with animations, accessibility, performance optimization

✅ **Stage 3: Machine Connection & Companion App** (Completed - October 1, 2025)
- **Phase 15**: Database schema with all 42 config variables from config3.py
- **Phase 16**: Connection status panel in left sidebar (COM/baud inputs, connect/settings buttons, LED indicator)
- **Phase 17**: Machine Settings Popup with 2 tabs (Connection + Config with conditional rendering)
- **Phase 18**: Backend API - 9 complete endpoints for machine profile CRUD operations
- **Phase 19**: Zustand store integration with default profile loading on user login
- **Phase 20**: Companion app - Fully functional WebSocket server with serial communication, authentication, machine profiles (GRBL/Marlin/Smoothie), G-code transmission, and auto-detect features

## Architecture
- **Frontend**: React + Vite + Fabric.js for canvas operations
- **Backend**: Node.js + Express + JWT authentication
- **Database**: PostgreSQL + Drizzle ORM
- **Libraries**: 
  - Fabric.js for CAD drawing canvas
  - makerjs for G-code generation (planned)
  - gcode-viewer for simulation (planned)

## Key Features Implemented
1. **Authentication System**: Email/password registration and login
2. **CAD Interface**: Professional dark theme with toolbar, canvas, and panels
3. **Drawing Tools**: Select, free draw, line, rectangle, circle tools
4. **Canvas Features**: Grid toggle, zoom in/out, object selection and deletion
5. **User Interface**: Left toolbar, main canvas, right panels (layers/properties)
6. **Database Integration**: User profiles, preferences, project storage ready

## Companion App Features
The companion app (`companion-app/`) is a Node.js desktop application that runs locally to bridge serial communication:
- **WebSocket Server**: Runs on `ws://localhost:8080` for real-time CAD app communication
- **HTTP API**: Status endpoint on `http://localhost:8081` for health checks
- **Authentication**: Token-based security to prevent unauthorized connections
- **Machine Profiles**: Pre-configured profiles for GRBL, Marlin, and Smoothieware
- **Serial Communication**: Full duplex serial port communication with configurable baud rates
- **G-code Transmission**: Line-by-line transmission with progress tracking and buffer management
- **Auto-detect**: Scans available COM ports and tests baud rates automatically
- **Emergency Stop**: Immediate feed hold command to all connected machines
- **System Notifications**: Desktop notifications for connection status and errors
- **Graceful Shutdown**: Proper cleanup of serial connections and servers

To run the companion app locally:
```bash
cd companion-app
npm install
npm start  # or npm run dev for development
```

## Pending Features (Next Phases)
- [ ] Snap tools (grid, endpoint, midpoint, center snapping)
- [ ] G-code generation and preview
- [ ] Advanced drawing tools (text, spiral)
- [ ] Image processing (PNG/JPEG to G-code)

## Technology Stack
- **Frontend**: React 18, Vite, Fabric.js, React Router
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT tokens with bcrypt password hashing
- **Styling**: Custom CSS with dark theme

## Development Notes
- Application runs on port 5000 (frontend) with backend proxy to port 3001
- Database schema includes comprehensive tables for users, projects, machines, preferences
- Modular component architecture following the original Python app's structure
- Grid and zoom functionality needs refinement (architect review identified areas for improvement)

## User Preferences Documented
- Email/password authentication (ready for Google/Twitter OAuth later)
- Cross-browser compatibility prioritized 
- Local machine serial communication via WebSocket bridge (planned)
- Modular architecture maintaining separation of concerns
- Library-based approach using established CAD libraries

## Getting Started
1. Navigate to the application URL
2. Click "Sign up" to create a new account
3. Use the CAD interface to start drawing
4. Tools available: Select, Free Draw, Line, Rectangle, Circle
5. Toggle grid, zoom in/out, delete selected objects

The foundation is solid and ready for the next development phases!