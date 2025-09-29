import { useState, useEffect, useContext } from 'react'
import { Link } from 'react-router-dom'
import AuthContext from '../contexts/AuthContext'
import './Dashboard.css'

function Dashboard() {
  const [projects, setProjects] = useState([])
  const [machines, setMachines] = useState([])
  const [loading, setLoading] = useState(true)
  const { user, logout } = useContext(AuthContext)

  useEffect(() => {
    fetchProjects()
    fetchMachines()
  }, [])

  const fetchProjects = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/projects', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        setProjects(data)
      }
    } catch (err) {
      console.error('Error fetching projects:', err)
    }
  }

  const fetchMachines = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/machines', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        setMachines(data)
      }
    } catch (err) {
      console.error('Error fetching machines:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="loading">Loading dashboard...</div>
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-left">
          <h1>MECHANICUS</h1>
          <p>Welcome, {user?.username}</p>
        </div>
        <div className="header-right">
          <Link to="/cad" className="new-project-button">New Project</Link>
          <button onClick={logout} className="logout-button">Logout</button>
        </div>
      </header>

      <div className="dashboard-content">
        <div className="dashboard-section">
          <h2>Recent Projects</h2>
          {projects.length > 0 ? (
            <div className="projects-grid">
              {projects.map(project => (
                <div key={project.id} className="project-card">
                  <h3>{project.name}</h3>
                  <p>Last modified: {new Date(project.updatedAt).toLocaleDateString()}</p>
                  <div className="project-actions">
                    <Link to="/cad" className="open-button">Open</Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>No projects yet. <Link to="/cad">Create your first project</Link></p>
            </div>
          )}
        </div>

        <div className="dashboard-section">
          <h2>Machine Configurations</h2>
          {machines.length > 0 ? (
            <div className="machines-list">
              {machines.map(machine => (
                <div key={machine.id} className="machine-card">
                  <h3>{machine.name}</h3>
                  <p>Port: {machine.comPort || 'Not configured'}</p>
                  <p>Bed Size: {machine.bedSizeX} × {machine.bedSizeY} mm</p>
                  {machine.isDefault && <span className="default-badge">Default</span>}
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>No machine configurations. Configure your first machine in the CAD interface.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Dashboard