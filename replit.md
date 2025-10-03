# Mechanicus CAD - Laser/CNC Design System

## Overview

Mechanicus CAD is a web-based CAD system for laser engraving and CNC machines. The project consists of three main components:

1. **Web Application** - A React/Vite frontend with Node.js/Express backend for the CAD interface
2. **Companion App** - A local Node.js application that bridges serial communication between the web app and physical machines
3. **Legacy Python Application** - Original tkinter-based CAD application (located in `mechanicus_laser_cad/` directory)

The web application provides user authentication, drawing tools, layer management, SVG import/export, and machine control capabilities. The companion app runs locally on the user's machine to handle direct serial port communication with CNC/laser engraver hardware.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React 19 + Vite 7  
**Canvas Library**: Konva.js (via react-konva) for 2D drawing operations  
**State Management**: Zustand for global application state  
**Routing**: React Router DOM for navigation  
**Spatial Indexing**: rbush for efficient snap calculations  

**Key Design Patterns**:
- Component-based architecture with functional React components
- Context API for serial communication (SerialContext.jsx)
- Zustand store (`cadStore.js`) managing CAD state including shapes, layers, selection, viewport, and machine profiles
- Workspace persistence with auto-save/restore functionality
- Floating panel system with draggable windows

**UI Structure**:
- Professional menu bar with dropdown menus (File, Edit, Selection, Tools, View, Workspace, Settings, User, Help)
- Left sidebar with icon-based tool buttons in 4-column grid layout
- Top toolbar with grid controls and machine settings
- Right-side floating panels (Drawing Tools, Layers, Shape Properties)
- Canvas area with Konva stages and layers for rendering

### Backend Architecture

**Framework**: Node.js + Express 5  
**Authentication**: JWT (jsonwebtoken) with bcrypt password hashing  
**Security**: Helmet for security headers, CORS for cross-origin control  

**API Design**:
- RESTful endpoints for authentication (`/api/auth/register`, `/api/auth/login`)
- Machine profile CRUD operations (`/api/machine-profiles/*`)
- User preferences management
- Error handling with try-catch blocks and appropriate HTTP status codes

**Server Configuration**:
- Runs on port 3001
- Serves built frontend from `/dist/frontend` in production
- Proxy setup in development (Vite dev server on 5000, backend on 3001)

### Data Storage

**Database**: PostgreSQL  
**ORM**: Drizzle ORM with Neon serverless driver  
**Schema Location**: `shared/schema.ts`

**Database Tables**:
1. **users** - User accounts with email/password authentication
2. **machine_profiles** - Machine configurations with 42+ settings (speeds, dimensions, G-code structure, laser/CNC parameters)
3. **user_preferences** - UI preferences and workspace layouts
4. **projects** - CAD project metadata (planned/future)

**Schema Design Rationale**:
- Shared schema in `shared/` directory for code reuse between frontend and backend
- TypeScript for type safety across the stack
- Drizzle provides type-safe queries and migrations
- Neon serverless for scalable PostgreSQL hosting

**Machine Profile Architecture**:
- Comprehensive 42-field configuration matching Python application (`config3.py`)
- Conditional rendering based on machine type (Laser vs CNC)
- Default profile system with `is_default` flag
- Profile selection persists per user

### Companion App Architecture

**Technology**: Standalone Node.js application  
**WebSocket Server**: `ws` library on port 8080  
**HTTP Server**: Express on port 8008  
**Serial Communication**: `serialport` library  

**Key Features**:
- Local serial port management (open/close, baud rate configuration)
- Auto-scan for COM ports with firmware detection (GRBL, Marlin, Smoothieware)
- Real-time WebSocket bidirectional communication
- G-code transmission with line-by-line sending and progress tracking
- Session-based JWT authentication (2-minute expiry)
- Dashboard UI for connection management

**Security Model**:
- CORS restricted to localhost and local network IPs only
- Origin validation with paired origins system
- Wildcard support for `*.replit.dev` domains (configurable)
- Connection request approval workflow

**Communication Flow**:
```
Web App (Browser) → WebSocket (port 8080) → Companion App → Serial Port → CNC/Laser Machine
```

### WebSocket Message Protocol

**Message Types**:
- `send_gcode` - Transmit G-code to machine
- `scan_ports` - Detect available COM ports
- `connect_port` - Open serial connection
- `disconnect_port` - Close serial connection
- `gcode_start` - G-code transmission started
- `gcode_progress` - Progress updates during transmission
- `gcode_complete` - Transmission finished
- `gcode_error` - Error during transmission
- `status` - Machine status updates

**Authentication Flow**:
1. Client connects to WebSocket
2. Companion sends status message
3. Client validates origin
4. Session token issued with 2-minute expiry
5. Token refresh on activity

## External Dependencies

### Third-Party Services

**Neon Database**: PostgreSQL serverless database hosting
- Connection via `@neondatabase/serverless` driver
- Connection string stored in `DATABASE_URL` environment variable
- Used for user data, machine profiles, and preferences

### Frontend Libraries

**UI & Rendering**:
- `react-konva` (v19.0.10) - Canvas rendering with Konva.js
- `konva` (v10.0.2) - 2D drawing library
- `fabric` (v6.7.1) - Alternative canvas library (may be legacy)

**State & Routing**:
- `zustand` (v5.0.8) - Lightweight state management
- `react-router-dom` (v7.9.3) - Client-side routing
- `axios` (v1.12.2) - HTTP client for API calls

**CAD Functionality**:
- `rbush` (v4.0.1) - R-tree spatial indexing for snap tools
- `makerjs` (v0.18.1) - G-code generation library
- `gcode-viewer` (v0.7.1) - G-code visualization

### Backend Libraries

**Core Framework**:
- `express` (v5.1.0) - Web server framework
- `ws` (v8.18.3) - WebSocket server implementation

**Database & ORM**:
- `drizzle-orm` (v0.44.5) - TypeScript ORM
- `drizzle-kit` (v0.31.5) - Schema migrations
- `@neondatabase/serverless` (v1.0.1) - Neon database driver
- `pg` (v8.16.3) - PostgreSQL client

**Security & Authentication**:
- `jsonwebtoken` (v9.0.2) - JWT token generation/validation
- `bcryptjs` (v3.0.2) - Password hashing
- `helmet` (v8.1.0) - Security headers middleware
- `cors` (v2.8.5) - CORS middleware

### Companion App Libraries

**Serial Communication**:
- `serialport` (v12.0.0) - Serial port access and control

**Server & WebSocket**:
- `express` (v4.19.2) - HTTP server for dashboard
- `ws` (v8.18.3) - WebSocket communication
- `cors` (v2.8.5) - CORS handling

**Utilities**:
- `jsonwebtoken` (v9.0.2) - Session authentication
- `node-notifier` (v10.0.1) - Desktop notifications
- `open` (v8.4.2) - Open URLs in browser

### Development Tools

**Build Tools**:
- `typescript` (v5.9.3) - TypeScript compiler
- `tsc-alias` (v1.8.16) - Path alias resolution
- `vite` (v7.1.7) - Frontend build tool
- `tsx` (v4.20.6) - TypeScript execution for development

**Development Utilities**:
- `nodemon` (v3.1.10) - Auto-restart on file changes
- `concurrently` (v9.2.1) - Run multiple npm scripts
- `pkg` (v5.8.1) - Package companion app as executable

### Environment Variables

**Required**:
- `DATABASE_URL` - PostgreSQL connection string for Neon database

**Optional**:
- `JWT_SECRET` - Secret key for JWT token signing (auto-generated if not provided)
- `PORT` - Backend server port (defaults to 3001)