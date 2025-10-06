import React, { useContext } from 'react'
import AuthContext from '../contexts/AuthContext'
import useCadStore from '../store/cadStore'
import DropdownMenu from './DropdownMenu'
import './MenuBar.css'

const MenuBar = ({
  onImportSVG,
  onExportSVG,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onZoomFit,
  setShowGrid,
  showGrid,
  onSaveWorkspace,
  onRestoreWorkspace,
  onResetWorkspace
}) => {
  const { logout } = useContext(AuthContext)
  const undo = useCadStore((state) => state.undo)
  const redo = useCadStore((state) => state.redo)
  const undoStack = useCadStore((state) => state.undoStack)
  const redoStack = useCadStore((state) => state.redoStack)
  const shapes = useCadStore((state) => state.shapes)
  const setShapes = useCadStore((state) => state.setShapes)
  const setSelectedShapeId = useCadStore((state) => state.setSelectedShapeId)
  const removeShapeWithUndo = useCadStore((state) => state.removeShapeWithUndo)
  const selectedShapeId = useCadStore((state) => state.selectedShapeId)
  const newProject = useCadStore((state) => state.newProject)

  const handleNewProject = () => {
    const confirmed = window.confirm('Start a new project? All unsaved changes will be lost.')
    if (confirmed) {
      newProject()
    }
  }

  const fileMenuItems = [
    { label: 'New Project', onClick: handleNewProject, shortcut: 'Ctrl+N' },
    { label: 'Open Project', onClick: () => console.log('Open Project'), disabled: true },
    { separator: true },
    { label: 'Save Project', onClick: () => console.log('Save Project'), shortcut: 'Ctrl+S', disabled: true },
    { label: 'Save As...', onClick: () => console.log('Save As'), disabled: true },
    { separator: true },
    { label: 'Import SVG', onClick: onImportSVG, shortcut: 'Ctrl+I' },
    { label: 'Export SVG', onClick: onExportSVG, shortcut: 'Ctrl+E' },
    { separator: true },
    { label: 'Export G-Code', onClick: () => console.log('Export G-Code'), disabled: true }
  ]

  const editMenuItems = [
    { label: 'Undo', onClick: undo, shortcut: 'Ctrl+Z', disabled: undoStack.length === 0 },
    { label: 'Redo', onClick: redo, shortcut: 'Ctrl+Y', disabled: redoStack.length === 0 },
    { separator: true },
    { label: 'Cut', onClick: () => console.log('Cut'), shortcut: 'Ctrl+X', disabled: true },
    { label: 'Copy', onClick: () => console.log('Copy'), shortcut: 'Ctrl+C', disabled: true },
    { label: 'Paste', onClick: () => console.log('Paste'), shortcut: 'Ctrl+V', disabled: true },
    { separator: true },
    { label: 'Delete', onClick: () => selectedShapeId && removeShapeWithUndo(selectedShapeId), shortcut: 'Del', disabled: !selectedShapeId },
    { separator: true },
    { label: 'Select All', onClick: () => console.log('Select All'), shortcut: 'Ctrl+A', disabled: true }
  ]

  const selectionMenuItems = [
    { label: 'Select All', onClick: () => console.log('Select All'), disabled: true },
    { label: 'Deselect All', onClick: () => setSelectedShapeId(null), disabled: !selectedShapeId },
    { label: 'Invert Selection', onClick: () => console.log('Invert'), disabled: true },
    { separator: true },
    { label: 'Select by Layer', onClick: () => console.log('Select by Layer'), disabled: true }
  ]

  const toolsMenuItems = [
    { label: 'Drawing Tools', onClick: () => console.log('Drawing Tools') },
    { label: 'Snap Tools', onClick: () => console.log('Snap Tools') },
    { label: 'Transform Tools', onClick: () => console.log('Transform Tools') },
    { label: 'Line Editor Tools', onClick: () => console.log('Line Editor') },
    { label: 'Text Tools', onClick: () => console.log('Text Tools') }
  ]

  const viewMenuItems = [
    { label: 'Zoom In', onClick: onZoomIn, shortcut: '+' },
    { label: 'Zoom Out', onClick: onZoomOut, shortcut: '-' },
    { label: 'Zoom to Fit', onClick: onZoomFit, shortcut: 'Ctrl+0', disabled: true },
    { label: 'Reset Zoom', onClick: onZoomReset, shortcut: 'Ctrl+1' },
    { separator: true },
    { label: showGrid ? 'Hide Grid' : 'Show Grid', onClick: () => setShowGrid(!showGrid), shortcut: 'G' },
    { label: 'Show Rulers', onClick: () => console.log('Rulers'), disabled: true }
  ]

  const workspaceMenuItems = [
    { label: 'Save Workspace Layout', onClick: onSaveWorkspace },
    { label: 'Restore Default Layout', onClick: onResetWorkspace },
    { label: 'Reset All Panels', onClick: onResetWorkspace }
  ]

  const settingsMenuItems = [
    { label: 'Grid Settings', onClick: () => console.log('Grid Settings'), disabled: true },
    { label: 'Snap Settings', onClick: () => console.log('Snap Settings'), disabled: true },
    { label: 'Machine Configuration', onClick: () => console.log('Machine Config'), disabled: true },
    { separator: true },
    { label: 'Preferences', onClick: () => console.log('Preferences'), disabled: true }
  ]

  const userMenuItems = [
    { label: 'Profile', onClick: () => console.log('Profile'), disabled: true },
    { label: 'Change Password', onClick: () => console.log('Change Password'), disabled: true },
    { separator: true },
    { label: 'Logout', onClick: logout }
  ]

  const helpMenuItems = [
    { label: 'Documentation', onClick: () => console.log('Documentation'), disabled: true },
    { label: 'Keyboard Shortcuts', onClick: () => console.log('Shortcuts'), disabled: true },
    { separator: true },
    { label: 'About', onClick: () => console.log('About'), disabled: true }
  ]

  return (
    <div className="menu-bar">
      <DropdownMenu label="File" items={fileMenuItems} />
      <DropdownMenu label="Edit" items={editMenuItems} />
      <DropdownMenu label="Selection" items={selectionMenuItems} />
      <DropdownMenu label="Tools" items={toolsMenuItems} />
      <DropdownMenu label="View" items={viewMenuItems} />
      <DropdownMenu label="Workspace" items={workspaceMenuItems} />
      <DropdownMenu label="Settings" items={settingsMenuItems} />
      <DropdownMenu label="User" items={userMenuItems} />
      <DropdownMenu label="Help" items={helpMenuItems} />
    </div>
  )
}

export default MenuBar
