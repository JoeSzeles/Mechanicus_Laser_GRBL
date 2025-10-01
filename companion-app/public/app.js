class CompanionDashboard {
    constructor() {
        this.eventSource = null;
        this.pairedOrigins = [];
        this.connectionRequests = [];
        this.wildcardEnabled = false;
        
        this.init();
    }

    init() {
        this.loadSettings();
        this.setupEventListeners();
        this.connectToSSE();
        this.fetchStatus();
    }

    loadSettings() {
        const savedWildcard = localStorage.getItem('wildcardEnabled');
        if (savedWildcard !== null) {
            this.wildcardEnabled = savedWildcard === 'true';
            document.getElementById('wildcardToggle').checked = this.wildcardEnabled;
        }
    }

    setupEventListeners() {
        document.getElementById('wildcardToggle').addEventListener('change', (e) => {
            this.toggleWildcard(e.target.checked);
        });

        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.fetchStatus();
        });
    }

    connectToSSE() {
        if (this.eventSource) {
            this.eventSource.close();
        }

        this.eventSource = new EventSource('/events');
        
        this.eventSource.onopen = () => {
            this.updateStatus('running', 'Connected');
        };

        this.eventSource.onerror = () => {
            this.updateStatus('error', 'Connection Error');
            setTimeout(() => this.connectToSSE(), 5000);
        };

        this.eventSource.addEventListener('connection_request', (e) => {
            const data = JSON.parse(e.data);
            this.handleConnectionRequest(data);
        });

        this.eventSource.addEventListener('status_update', (e) => {
            const data = JSON.parse(e.data);
            this.handleStatusUpdate(data);
        });

        this.eventSource.addEventListener('origin_removed', (e) => {
            const data = JSON.parse(e.data);
            this.showNotification(`Origin removed: ${data.origin}`, 'success');
            this.fetchStatus();
        });
    }

    async fetchStatus() {
        try {
            const response = await fetch('/status');
            if (!response.ok) throw new Error('Failed to fetch status');
            
            const data = await response.json();
            this.pairedOrigins = data.pairedOrigins || [];
            this.connectionRequests = data.pendingRequests || [];
            
            this.updateStatus('running', 'Running');
            this.updateConnectionCount(data.activeConnections || 0);
            this.renderPairedOrigins();
            this.renderConnectionRequests();
        } catch (error) {
            console.error('Error fetching status:', error);
            this.updateStatus('error', 'Failed to load');
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
        }
    }

    handleStatusUpdate(data) {
        if (data.pairedOrigins) {
            this.pairedOrigins = data.pairedOrigins;
            this.renderPairedOrigins();
        }
        if (data.activeConnections !== undefined) {
            this.updateConnectionCount(data.activeConnections);
        }
    }

    async acceptConnection(origin) {
        const card = document.querySelector(`[data-origin="${origin}"]`);
        if (card) card.classList.add('loading');

        try {
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
        } catch (error) {
            console.error('Error accepting connection:', error);
            this.showNotification(`Failed to accept connection: ${error.message}`, 'error');
        } finally {
            if (card) card.classList.remove('loading');
        }
    }

    async declineConnection(origin) {
        const card = document.querySelector(`[data-origin="${origin}"]`);
        if (card) card.classList.add('loading');

        try {
            const response = await fetch('/pair/decline', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ origin })
            });

            if (!response.ok) throw new Error('Failed to decline connection');

            this.connectionRequests = this.connectionRequests.filter(r => r.origin !== origin);
            this.renderConnectionRequests();
            this.showNotification(`Declined connection from ${origin}`, 'success');
        } catch (error) {
            console.error('Error declining connection:', error);
            this.showNotification(`Failed to decline connection: ${error.message}`, 'error');
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
            const response = await fetch(`/origin/${encodeURIComponent(origin)}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('Failed to remove origin');

            this.pairedOrigins = this.pairedOrigins.filter(o => o.origin !== origin);
            this.renderPairedOrigins();
            this.showNotification(`Removed origin: ${origin}`, 'success');
        } catch (error) {
            console.error('Error removing origin:', error);
            this.showNotification(`Failed to remove origin: ${error.message}`, 'error');
        } finally {
            if (row) row.classList.remove('loading');
        }
    }

    async toggleWildcard(enabled) {
        this.wildcardEnabled = enabled;
        localStorage.setItem('wildcardEnabled', enabled);

        try {
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
        } catch (error) {
            console.error('Error toggling wildcard:', error);
            this.showNotification(`Failed to update setting: ${error.message}`, 'error');
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

        if (this.pairedOrigins.length === 0) {
            tbody.innerHTML = `
                <tr class="empty-state-row">
                    <td colspan="4" class="empty-state">
                        <p>No paired origins yet</p>
                    </td>
                </tr>
            `;
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
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }
}

const dashboard = new CompanionDashboard();
