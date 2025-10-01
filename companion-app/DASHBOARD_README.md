# Mechanicus Companion Dashboard

A modern web UI for managing local connections to the Mechanicus Companion app.

## Overview

The companion dashboard provides a user-friendly interface for:
- Managing connection requests from remote CAD applications
- Viewing and managing paired origins
- Configuring security settings (wildcard support)

## Access

The dashboard is available at: **http://localhost:8081**

When the companion app is running, simply open this URL in your browser.

## Features

### 1. Status Indicator
- **Green dot**: Companion app is running and connected
- **Connection count**: Shows number of active WebSocket connections

### 2. Connection Requests
- Displays pending connection requests from unknown origins
- **Accept**: Adds the origin to the paired list and allows future connections
- **Decline**: Rejects the request without adding to paired list
- Real-time notifications when new requests arrive

### 3. Paired Origins
- Table view of all approved origins
- Shows creation date and last seen timestamp
- **Remove button**: Unpairs an origin (they'll need approval to reconnect)
- Auto-refresh functionality

### 4. Settings
- **Wildcard Toggle**: When enabled, automatically accepts all `*.replit.dev` origins
- Settings are persisted in browser localStorage

## Architecture

### Frontend (Client)
- **index.html**: Main dashboard structure
- **styles.css**: Dark theme styling matching the CAD app
- **app.js**: Client-side logic and SSE handling

### Backend (Server)
The companion app (`src/index.js`) provides these endpoints:

#### HTTP Endpoints
- `GET /` - Serves the dashboard HTML
- `GET /status` - Returns current status and paired origins
- `GET /events` - Server-Sent Events stream for real-time updates
- `POST /pair/accept` - Accept a connection request
- `POST /pair/decline` - Decline a connection request
- `DELETE /origin/:origin` - Remove a paired origin
- `POST /settings/wildcard` - Update wildcard setting

#### WebSocket Integration
The companion app checks origins against the paired list before accepting WebSocket connections:
1. Localhost origins are always allowed
2. Paired origins are accepted and "last seen" is updated
3. Wildcard-enabled: auto-accepts `*.replit.dev`
4. Unknown origins trigger a connection request notification

## Security

- Origins must be explicitly paired before WebSocket connections are accepted
- Localhost connections are always allowed (for local development)
- Wildcard mode should only be enabled in trusted environments
- All pairing data is stored in-memory (cleared on restart)

## Usage Example

1. Start the companion app: `npm start`
2. Open http://localhost:8081 in your browser
3. When a remote CAD app tries to connect:
   - A connection request appears in the dashboard
   - Click "Accept" to pair the origin
   - Future connections from that origin will be auto-accepted
4. Enable wildcard for Replit deployments if desired

## Theme

The dashboard uses a dark theme to match the main Mechanicus CAD application:
- Background: #1e1e1e
- Accent: #3b82f6 (blue)
- Success: #10b981 (green)
- Error: #ef4444 (red)
- Text: #e0e0e0

## Real-time Updates

The dashboard uses Server-Sent Events (SSE) for real-time updates:
- Connection requests appear instantly
- Status changes are pushed to the dashboard
- Origin removal notifications
- Auto-reconnect on connection loss
