class CompanionDashboard {
    constructor() {
        this.eventSource = null;
        this.pairedOrigins = [];
        this.connectionRequests = [];
        this.wildcardEnabled = false;
        this.serialState = null;
        this.latestRequest = null;
        this.scanResults = [];
        this.isScanning = false;
        // Communication logs tracking
        this.communicationLogs = [];
        this.MAX_LOGS = 500;

        this.init();
    }

    init() {
        this.loadSettings();
        this.setupEventListeners();
        this.connectToSSE();
        this.fetchStatus();
        // Setup console intercept to capture logs
        this.setupConsoleIntercept();
    }

    loadSettings() {
        const savedWildcard = localStorage.getItem('wildcardEnabled');
        if (savedWildcard !== null) {
            this.wildcardEnabled = savedWildcard === 'true';
            document.getElementById('wildcardToggle').checked = this.wildcardEnabled;
        }
    }

    setupEventListeners() {
        const wildcardToggle = document.getElementById('wildcardToggle');
        const refreshBtn = document.getElementById('refreshBtn');
        const connectBtn = document.getElementById('connectBtn');
        const disconnectBtn = document.getElementById('disconnectBtn');
        const scanBtn = document.getElementById('scanBtn');
        const modalClose = document.getElementById('modalClose');
        const clearLogsBtn = document.getElementById('clearLogsBtn');
        const autoScrollToggle = document.getElementById('autoScrollToggle');

        if (!wildcardToggle || !refreshBtn || !connectBtn || !disconnectBtn || !scanBtn || !modalClose || !clearLogsBtn || !autoScrollToggle) {
            console.error('❌ Some required DOM elements are missing. Retrying in 100ms...');
            setTimeout(() => this.setupEventListeners(), 100);
            return;
        }

        wildcardToggle.addEventListener('change', (e) => {
            this.toggleWildcard(e.target.checked);
        });

        refreshBtn.addEventListener('click', () => {
            this.fetchStatus();
        });

        connectBtn.addEventListener('click', () => {
            this.connectSerial();
        });

        disconnectBtn.addEventListener('click', () => {
            this.disconnectSerial();
        });

        scanBtn.addEventListener('click', () => {
            this.scanPorts();
        });

        modalClose.addEventListener('click', () => {
            this.closeScanModal();
        });

        window.addEventListener('click', (e) => {
            const modal = document.getElementById('scanModal');
            if (e.target === modal) {
                this.closeScanModal();
            }
        });

        clearLogsBtn.addEventListener('click', () => {
            this.clearLogs();
        });

        autoScrollToggle.addEventListener('change', () => {
            this.displayCommunicationLogs(); // Refresh display to apply auto-scroll setting
        });
    }

    connectToSSE() {
        if (this.eventSource) {
            this.eventSource.close();
        }

        this.eventSource = new EventSource('/events');

        this.eventSource.onopen = () => {
            this.updateStatus('running', 'Connected');
            this.addCommunicationLog('system-info', 'SSE connection opened.');
        };

        this.eventSource.onerror = () => {
            this.updateStatus('error', 'Connection Error');
            this.addCommunicationLog('system-error', 'SSE connection error. Retrying in 5 seconds...');
            setTimeout(() => this.connectToSSE(), 5000);
        };

        this.eventSource.addEventListener('connection_request', (e) => {
            const data = JSON.parse(e.data);
            this.addCommunicationLog('machine-to-companion', `[MACHINE → COMPANION] Received connection request: ${JSON.stringify(data)}`);
            this.handleConnectionRequest(data);
        });

        this.eventSource.addEventListener('status_update', (e) => {
            const data = JSON.parse(e.data);
            this.addCommunicationLog('system-info', `[COMPANION → MAIN APP] Received status update: ${JSON.stringify(data)}`);
            this.handleStatusUpdate(data);
        });

        this.eventSource.addEventListener('origin_removed', (e) => {
            const data = JSON.parse(e.data);
            this.addCommunicationLog('system-info', `[COMPANION → MAIN APP] Origin removed: ${data.origin}`);
            this.showNotification(`Origin removed: ${data.origin}`, 'success');
            this.fetchStatus();
        });

        this.eventSource.addEventListener('serial_state', (e) => {
            const data = JSON.parse(e.data);
            this.addCommunicationLog('system-info', `[COMPANION → MAIN APP] Received serial state: ${JSON.stringify(data)}`);
            this.handleSerialStateUpdate(data);
        });

        this.eventSource.addEventListener('session_request', (e) => {
            const data = JSON.parse(e.data);
            this.addCommunicationLog('machine-to-companion', `[MACHINE → COMPANION] Received session request: ${JSON.stringify(data)}`);
            this.handleSessionRequest(data);
        });

        this.eventSource.addEventListener('scan_progress', (e) => {
            const data = JSON.parse(e.data);
            this.addCommunicationLog('machine-to-companion', `[MACHINE → COMPANION] Scan progress: ${JSON.stringify(data)}`);
            this.handleScanProgress(data);
        });

        this.eventSource.addEventListener('scan_started', (e) => {
            const data = JSON.parse(e.data);
            this.addCommunicationLog('machine-to-companion', `[MACHINE → COMPANION] Scan started: ${JSON.stringify(data)}`);
            this.handleScanStarted(data);
        });

        this.eventSource.addEventListener('scan_complete', (e) => {
            const data = JSON.parse(e.data);
            this.addCommunicationLog('machine-to-companion', `[MACHINE → COMPANION] Scan complete: ${JSON.stringify(data)}`);
            this.handleScanComplete(data);
        });
    }

    async fetchStatus() {
        try {
            const response = await fetch('/status');
            if (!response.ok) throw new Error('Failed to fetch status');

            const data = await response.json();
            this.pairedOrigins = data.pairedOrigins || [];
            this.connectionRequests = data.pendingRequests || [];
            this.serialState = data.serialState || null;

            if (data.sessionRequests && data.sessionRequests.length > 0) {
                this.latestRequest = data.sessionRequests[0];
            }

            this.updateStatus('running', 'Running');
            this.updateConnectionCount(data.activeConnections || 0);
            this.renderPairedOrigins();
            this.renderConnectionRequests();
            this.updateSerialUI();
            this.addCommunicationLog('system-info', `[COMPANION → MAIN APP] Fetched status: ${JSON.stringify(data)}`);
        } catch (error) {
            console.error('Error fetching status:', error);
            this.updateStatus('error', 'Failed to load');
            this.addCommunicationLog('system-error', `Error fetching status: ${error.message}`);
        }
    }

    handleConnectionRequest(data) {
        const existing = this.connectionRequests.find(r => r.origin === data.origin);
        if (!existing) {
            this.connectionRequests.push({
                origin: data.origin,
                timestamp: data.timestamp || Date.now()
            });
            this.renderConnectionRequests();
            this.showNotification(`New connection request from ${data.origin}`, 'info');
            this.addCommunicationLog('system-info', `Added new connection request from ${data.origin}`);
        }
    }

    handleStatusUpdate(data) {
        if (data.pairedOrigins) {
            this.pairedOrigins = data.pairedOrigins;
            this.renderPairedOrigins();
            this.addCommunicationLog('system-info', `Updated paired origins: ${JSON.stringify(data.pairedOrigins)}`);
        }
        if (data.activeConnections !== undefined) {
            this.updateConnectionCount(data.activeConnections);
            this.addCommunicationLog('system-info', `Updated active connections to ${data.activeConnections}`);
        }
    }

    async acceptConnection(origin) {
        const card = document.querySelector(`[data-origin="${origin}"]`);
        if (card) card.classList.add('loading');

        try {
            this.addCommunicationLog('companion-to-main', `[COMPANION → MAIN APP] Accepting connection from ${origin}`);
            const response = await fetch('/pair/accept', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ origin })
            });

            if (!response.ok) throw new Error('Failed to accept connection');

            this.connectionRequests = this.connectionRequests.filter(r => r.origin !== origin);
            this.renderConnectionRequests();
            this.showNotification(`Accepted connection from ${origin}`, 'success');
            this.fetchStatus();
            this.addCommunicationLog('system-info', `Successfully accepted connection from ${origin}`);
        } catch (error) {
            console.error('Error accepting connection:', error);
            this.showNotification(`Failed to accept connection: ${error.message}`, 'error');
            this.addCommunicationLog('system-error', `Error accepting connection from ${origin}: ${error.message}`);
        } finally {
            if (card) card.classList.remove('loading');
        }
    }

    async declineConnection(origin) {
        const card = document.querySelector(`[data-origin="${origin}"]`);
        if (card) card.classList.add('loading');

        try {
            this.addCommunicationLog('companion-to-main', `[COMPANION → MAIN APP] Declining connection from ${origin}`);
            const response = await fetch('/pair/decline', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ origin })
            });

            if (!response.ok) throw new Error('Failed to decline connection');

            this.connectionRequests = this.connectionRequests.filter(r => r.origin !== origin);
            this.renderConnectionRequests();
            this.showNotification(`Declined connection from ${origin}`, 'success');
            this.addCommunicationLog('system-info', `Successfully declined connection from ${origin}`);
        } catch (error) {
            console.error('Error declining connection:', error);
            this.showNotification(`Failed to decline connection: ${error.message}`, 'error');
            this.addCommunicationLog('system-error', `Error declining connection from ${origin}: ${error.message}`);
        } finally {
            if (card) card.classList.remove('loading');
        }
    }

    async removeOrigin(origin) {
        if (!confirm(`Are you sure you want to remove ${origin}?`)) {
            return;
        }

        const row = document.querySelector(`tr[data-origin="${origin}"]`);
        if (row) row.classList.add('loading');

        try {
            this.addCommunicationLog('companion-to-main', `[COMPANION → MAIN APP] Removing origin: ${origin}`);
            const response = await fetch(`/origin/${encodeURIComponent(origin)}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('Failed to remove origin');

            this.pairedOrigins = this.pairedOrigins.filter(o => o.origin !== origin);
            this.renderPairedOrigins();
            this.showNotification(`Removed origin: ${origin}`, 'success');
            this.addCommunicationLog('system-info', `Successfully removed origin: ${origin}`);
        } catch (error) {
            console.error('Error removing origin:', error);
            this.showNotification(`Failed to remove origin: ${error.message}`, 'error');
            this.addCommunicationLog('system-error', `Error removing origin ${origin}: ${error.message}`);
        } finally {
            if (row) row.classList.remove('loading');
        }
    }

    async toggleWildcard(enabled) {
        this.wildcardEnabled = enabled;
        localStorage.setItem('wildcardEnabled', enabled);

        try {
            this.addCommunicationLog('companion-to-main', `[COMPANION → MAIN APP] Toggling wildcard to ${enabled}`);
            const response = await fetch('/settings/wildcard', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled })
            });

            if (!response.ok) throw new Error('Failed to update wildcard setting');

            this.showNotification(
                enabled ? 'Wildcard enabled for *.replit.dev' : 'Wildcard disabled',
                'success'
            );
            this.addCommunicationLog('system-info', `Wildcard setting updated to ${enabled}`);
        } catch (error) {
            console.error('Error toggling wildcard:', error);
            this.showNotification(`Failed to update setting: ${error.message}`, 'error');
            this.addCommunicationLog('system-error', `Error toggling wildcard to ${enabled}: ${error.message}`);
            document.getElementById('wildcardToggle').checked = !enabled;
            this.wildcardEnabled = !enabled;
        }
    }

    renderConnectionRequests() {
        const container = document.getElementById('connectionRequests');
        const badge = document.getElementById('requestsBadge');

        badge.textContent = this.connectionRequests.length;

        if (this.connectionRequests.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No pending connection requests</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.connectionRequests.map(request => `
            <div class="request-card" data-origin="${this.escapeHtml(request.origin)}">
                <div class="request-info">
                    <div class="request-origin">${this.escapeHtml(request.origin)}</div>
                    <div class="request-time">${this.formatTime(request.timestamp)}</div>
                </div>
                <div class="request-actions">
                    <button class="btn btn-primary btn-sm" onclick="dashboard.acceptConnection('${this.escapeHtml(request.origin)}')">
                        <span class="icon">✓</span> Accept
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="dashboard.declineConnection('${this.escapeHtml(request.origin)}')">
                        <span class="icon">✕</span> Decline
                    </button>
                </div>
            </div>
        `).join('');
    }

    renderPairedOrigins() {
        const tbody = document.getElementById('pairedOriginsBody');
        const connectedUsersContainer = document.getElementById('connectedUsers');

        if (this.pairedOrigins.length === 0) {
            tbody.innerHTML = `
                <tr class="empty-state-row">
                    <td colspan="4" class="empty-state">
                        <p>No paired origins yet</p>
                    </td>
                </tr>
            `;
            connectedUsersContainer.innerHTML = '<p class="empty-state">No connected users</p>';
            return;
        }

        tbody.innerHTML = this.pairedOrigins.map(origin => `
            <tr data-origin="${this.escapeHtml(origin.origin)}">
                <td>${this.escapeHtml(origin.origin)}</td>
                <td>${this.formatDate(origin.createdAt)}</td>
                <td>${this.formatDate(origin.lastSeen)}</td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="dashboard.removeOrigin('${this.escapeHtml(origin.origin)}')">
                        <span class="icon">🗑️</span> Remove
                    </button>
                </td>
            </tr>
        `).join('');

        connectedUsersContainer.innerHTML = this.pairedOrigins.map(origin => `
            <div class="user-card">
                <div class="user-info">
                    <span class="user-icon">👤</span>
                    <span class="username">${this.escapeHtml(origin.origin)}</span>
                </div>
                <button class="btn btn-secondary btn-sm disconnect-user-btn" onclick="dashboard.removeOrigin('${this.escapeHtml(origin.origin)}')">
                    Disconnect
                </button>
            </div>
        `).join('');
    }

    updateStatus(status, text) {
        const dot = document.getElementById('statusDot');
        const statusText = document.getElementById('statusText');

        dot.className = `status-dot ${status}`;
        statusText.textContent = text;
    }

    updateConnectionCount(count) {
        const element = document.getElementById('connectionCount');
        element.textContent = `${count} ${count === 1 ? 'connection' : 'connections'}`;
    }

    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.className = `notification ${type} show`;

        setTimeout(() => {
            notification.classList.remove('show');
        }, 5000);
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) {
            return 'Just now';
        } else if (diff < 3600000) {
            const minutes = Math.floor(diff / 60000);
            return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
        } else {
            return date.toLocaleTimeString();
        }
    }

    formatDate(timestamp) {
        if (!timestamp) return 'Never';
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        if (diff < 86400000) {
            return date.toLocaleTimeString();
        } else {
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    handleSerialStateUpdate(state) {
        this.serialState = state;
        this.updateSerialUI();
        this.addCommunicationLog('system-info', `Serial state updated: ${JSON.stringify(state)}`);
    }

    handleSessionRequest(data) {
        this.latestRequest = data;
        this.updateSerialUI();
        this.showNotification(`New session request: ${data.com} @ ${data.baud}`, 'info');
        this.addCommunicationLog('machine-to-companion', `Session request received: ${JSON.stringify(data)}`);
    }

    updateSerialUI() {
        const serialDot = document.getElementById('serialDot');
        const serialStatusText = document.getElementById('serialStatusText');
        const serialPort = document.getElementById('serialPort');
        const serialBaud = document.getElementById('serialBaud');
        const connectBtn = document.getElementById('connectBtn');
        const disconnectBtn = document.getElementById('disconnectBtn');
        const serialRequestInfo = document.getElementById('serialRequestInfo');
        const requestedCOM = document.getElementById('requestedCOM');
        const requestedBaud = document.getElementById('requestedBaud');

        if (this.serialState && this.serialState.connected) {
            serialDot.className = 'serial-dot connected';
            serialStatusText.textContent = 'Connected';
            serialPort.textContent = this.serialState.port || '-';
            serialBaud.textContent = this.serialState.baud || '-';
            connectBtn.disabled = true;
            disconnectBtn.disabled = false;
        } else {
            serialDot.className = 'serial-dot disconnected';
            serialStatusText.textContent = 'Disconnected';
            serialPort.textContent = '-';
            serialBaud.textContent = '-';
            disconnectBtn.disabled = true;

            if (this.latestRequest && this.latestRequest.com && this.latestRequest.baud) {
                connectBtn.disabled = false;
            } else {
                connectBtn.disabled = true;
            }
        }

        if (this.latestRequest && this.latestRequest.com && this.latestRequest.baud) {
            serialRequestInfo.style.display = 'block';
            requestedCOM.textContent = this.latestRequest.com;
            requestedBaud.textContent = this.latestRequest.baud;
        } else {
            serialRequestInfo.style.display = 'none';
        }
    }

    async connectSerial() {
        if (!this.latestRequest || !this.latestRequest.com || !this.latestRequest.baud) {
            this.showNotification('No connection request available', 'error');
            this.addCommunicationLog('system-error', 'Attempted to connect serial without a valid request.');
            return;
        }

        const connectBtn = document.getElementById('connectBtn');
        connectBtn.classList.add('loading');
        connectBtn.disabled = true;

        try {
            this.addCommunicationLog('companion-to-main', `[COMPANION → MAIN APP] Connecting to serial: ${JSON.stringify(this.latestRequest)}`);
            const response = await fetch('/serial/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requestId: this.latestRequest.requestId,
                    com: this.latestRequest.com,
                    baud: this.latestRequest.baud
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to connect');
            }

            this.showNotification(`Connected to ${result.state.port} @ ${result.state.baud}`, 'success');
            this.serialState = result.state;
            this.updateSerialUI();
            this.addCommunicationLog('system-info', `Serial connection established: ${JSON.stringify(result.state)}`);
        } catch (error) {
            console.error('Error connecting:', error);
            this.showNotification(`Failed to connect: ${error.message}`, 'error');
            this.addCommunicationLog('system-error', `Error connecting to serial: ${error.message}`);
        } finally {
            connectBtn.classList.remove('loading');
        }
    }

    async disconnectSerial() {
        const disconnectBtn = document.getElementById('disconnectBtn');
        disconnectBtn.classList.add('loading');
        disconnectBtn.disabled = true;

        try {
            this.addCommunicationLog('companion-to-main', '[COMPANION → MAIN APP] Disconnecting serial port.');
            const response = await fetch('/serial/disconnect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: 'User requested disconnect' })
            });

            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.error || 'Failed to disconnect');
            }

            this.showNotification('Disconnected from serial port', 'success');
            this.serialState = { connected: false };
            this.updateSerialUI();
            this.addCommunicationLog('system-info', 'Serial port disconnected successfully.');
        } catch (error) {
            console.error('Error disconnecting:', error);
            this.showNotification(`Failed to disconnect: ${error.message}`, 'error');
            this.addCommunicationLog('system-error', `Error disconnecting serial port: ${error.message}`);
        } finally {
            disconnectBtn.classList.remove('loading');
        }
    }

    async scanPorts() {
        const scanBtn = document.getElementById('scanBtn');
        scanBtn.classList.add('loading');
        scanBtn.disabled = true;
        this.isScanning = true;
        this.scanResults = [];

        this.openScanModal();

        try {
            this.addCommunicationLog('companion-to-main', '[COMPANION → MAIN APP] Starting serial port scan.');
            const response = await fetch('/serial/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });

            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.error || 'Failed to start scan');
            }

            const result = await response.json();
            this.scanResults = result.results || [];
            this.addCommunicationLog('system-info', `Serial port scan initiated. Response: ${JSON.stringify(result)}`);
        } catch (error) {
            console.error('Error scanning ports:', error);
            this.showNotification(`Scan failed: ${error.message}`, 'error');
            this.addCommunicationLog('system-error', `Serial port scan failed: ${error.message}`);
            this.closeScanModal();
        } finally {
            scanBtn.classList.remove('loading');
            scanBtn.disabled = false;
            this.isScanning = false;
        }
    }

    handleScanStarted(data) {
        const scanResults = document.getElementById('scanResults');
        scanResults.innerHTML = `
            <div class="scan-progress">
                <p>Scanning ${data.ports.length} port(s) at ${data.baudRates.length} baud rate(s)...</p>
                <div class="progress-bar">
                    <div class="progress-fill" id="scanProgress"></div>
                </div>
                <p id="scanStatus">Starting scan...</p>
            </div>
        `;
    }

    handleScanProgress(data) {
        const scanStatus = document.getElementById('scanStatus');
        if (scanStatus) {
            scanStatus.textContent = `${data.status}: ${data.port}`;
        }

        if (data.detected) {
            this.scanResults.push(data);
        }
    }

    handleScanComplete(data) {
        console.log('📊 [SCAN COMPLETE] Received data:', data);
        const scanResults = document.getElementById('scanResults');
        
        if (!scanResults) {
            console.error('❌ scanResults element not found!');
            return;
        }

        // Filter successful results
        const successfulResults = data.results ? data.results.filter(r => r.success) : [];
        
        console.log('📊 [SCAN COMPLETE] Successful results:', successfulResults);

        if (successfulResults.length > 0) {
            this.scanResults = successfulResults;
            scanResults.innerHTML = `
                <div class="scan-complete">
                    <p class="scan-success">✅ Scan complete! Found ${successfulResults.length} machine(s)</p>
                    <div class="scan-results-list">
                        ${successfulResults.map((result, index) => `
                            <div class="scan-result-card" data-index="${index}">
                                <div class="result-info">
                                    <h3>${this.escapeHtml(result.firmware || 'Unknown')}</h3>
                                    <p><strong>Port:</strong> ${this.escapeHtml(result.port)}</p>
                                    <p><strong>Baud:</strong> ${result.baud}</p>
                                    ${result.message ? `<p class="result-response">${this.escapeHtml(result.message)}</p>` : ''}
                                </div>
                                <button class="btn btn-primary btn-sm" onclick="dashboard.selectScanResult(${index})">
                                    <span class="icon">✓</span> Select
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } else {
            scanResults.innerHTML = `
                <div class="scan-complete">
                    <p class="scan-failure">❌ No machines detected</p>
                    <p>Make sure your machine is powered on and connected.</p>
                    <p>Scanned ${data.results ? data.results.length : 0} port(s)</p>
                </div>
            `;
        }
        
        console.log('📊 [SCAN COMPLETE] Updated UI');
    }

    selectScanResult(index) {
        const result = this.scanResults[index];
        if (!result) return;

        this.latestRequest = {
            requestId: `scan_${Date.now()}`,
            com: result.port,
            baud: result.baud,
            profile: result.firmware
        };

        this.updateSerialUI();
        this.closeScanModal();
        this.showNotification(`Selected ${result.port} @ ${result.baud}`, 'success');
        this.addCommunicationLog('system-info', `Selected scan result: ${JSON.stringify(result)}`);
    }

    openScanModal() {
        const modal = document.getElementById('scanModal');
        modal.style.display = 'flex';
    }

    closeScanModal() {
        const modal = document.getElementById('scanModal');
        modal.style.display = 'none';
    }

    // Communication logs tracking
    setupConsoleIntercept() {
        const originalLog = console.log;
        console.log = (...args) => {
            originalLog.apply(console, args);

            const message = args.join(' ');

            // Parse log messages and categorize them
            if (message.includes('[MAIN APP → COMPANION]')) {
                this.addCommunicationLog('main-to-companion', message);
            } else if (message.includes('[COMPANION → MAIN APP]')) {
                this.addCommunicationLog('companion-to-main', message);
            } else if (message.includes('[MACHINE → COMPANION]')) {
                this.addCommunicationLog('machine-to-companion', message);
            } else if (message.includes('[COMPANION → MACHINE]')) {
                this.addCommunicationLog('companion-to-machine', message);
            } else if (message.startsWith('error:') || message.includes('error')) {
                this.addCommunicationLog('system-error', message);
            } else {
                this.addCommunicationLog('system-info', message);
            }
        };

        const originalError = console.error;
        console.error = (...args) => {
            originalError.apply(console, args);
            this.addCommunicationLog('system-error', `ERROR: ${args.join(' ')}`);
        };
    }

    addCommunicationLog(type, message) {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = {
            type,
            message,
            timestamp
        };

        this.communicationLogs.push(logEntry);

        // Keep only last MAX_LOGS entries
        if (this.communicationLogs.length > this.MAX_LOGS) {
            this.communicationLogs.shift();
        }

        // Update UI
        this.displayCommunicationLogs();
    }

    displayCommunicationLogs() {
        const container = document.getElementById('communication-logs');
        if (!container) return;

        if (this.communicationLogs.length === 0) {
            container.innerHTML = '<p class="empty-state">Waiting for communication...</p>';
            return;
        }

        container.innerHTML = this.communicationLogs.map(log => `
            <div class="log-entry log-${log.type}">
                <span class="log-timestamp">[${log.timestamp}]</span>
                ${this.escapeHtml(log.message)}
            </div>
        `).join('');

        // Auto-scroll if enabled
        const autoScrollToggle = document.getElementById('autoScrollToggle');
        if (autoScrollToggle && autoScrollToggle.checked) {
            container.scrollTop = container.scrollHeight;
        }
    }

    clearLogs() {
        this.communicationLogs.length = 0;
        this.displayCommunicationLogs();
        this.addCommunicationLog('system-info', 'Communication logs cleared.');
    }
}

let dashboard;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        dashboard = new CompanionDashboard();
    });
} else {
    dashboard = new CompanionDashboard();
}