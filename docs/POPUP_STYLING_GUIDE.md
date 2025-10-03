
# Popup Window Styling Guide

## Overview
This document defines the consistent styling patterns used across all floating panel/popup windows in the Mechanicus CAD application.

## Color Palette

### Background Colors
- **Main Panel Background**: `#2a2d35` - Dark charcoal gray
- **Panel Header**: `#1a1d24` - Darker charcoal for contrast
- **Tab Content Background**: Inherits from main panel
- **Input Fields**: `#1e1e1e` - Very dark gray
- **Hover States**: `#333` or `#2a3a3f`

### Border Colors
- **Panel Border**: `#3a3f47` - Medium gray
- **Header Border**: `#3a3f47` - Same as panel
- **Input Border**: `#444` - Slightly lighter gray
- **Focus Border**: `#0088ff` - Bright blue
- **Active/Selected Border**: `#4CAF50` - Green

### Text Colors
- **Primary Text**: `#e0e0e0` - Light gray
- **Secondary Text**: `#ccc` - Medium light gray
- **Disabled Text**: `#888` - Medium gray
- **Label Text**: `#ccc`
- **Hint Text**: `#888` with italic style

### Accent Colors
- **Primary Action**: `#0088ff` - Bright blue
- **Success/Active**: `#4CAF50` - Green
- **Danger/Delete**: `#d32f2f` - Red
- **Warning**: `#ff9800` - Orange
- **Info**: `#00BFFF` - Sky blue

## Layout Structure

### Panel Container
```css
.floating-panel {
  width: 320px;
  background: #2a2d35;
  border: 1px solid #3a3f47;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  overflow: hidden;
  animation: panel-slide-in 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
}

.floating-panel:focus-within {
  border-color: #4a9eff;
  box-shadow: 0 4px 16px rgba(74, 158, 255, 0.3);
}
```

### Panel Header
```css
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #1a1d24;
  border-bottom: 1px solid #3a3f47;
}

.panel-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #e0e0e0;
}
```

### Close Button
```css
.panel-close-button {
  width: 24px;
  height: 24px;
  background: transparent;
  border: none;
  color: #999;
  font-size: 24px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s cubic-bezier(0.4, 0.0, 0.2, 1);
}

.panel-close-button:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #e0e0e0;
  transform: scale(1.1);
}
```

## Tab Navigation

### Tab Buttons
```css
.tabs {
  display: flex;
  gap: 5px;
  border-bottom: 2px solid #444;
  padding-bottom: 5px;
}

.tabs button {
  flex: 1;
  padding: 8px 12px;
  background: #2a2a2a;
  color: #ccc;
  border: 1px solid #444;
  border-radius: 4px 4px 0 0;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.tabs button:hover {
  background: #333;
  color: #fff;
}

.tabs button.active {
  background: #0088ff;
  color: #fff;
  border-color: #0088ff;
}
```

## Form Elements

### Buttons
```css
/* Primary Action Button */
.button-row button {
  flex: 1;
  padding: 8px 12px;
  background: #0088ff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.button-row button:hover:not(:disabled) {
  background: #0066cc;
}

.button-row button:disabled {
  background: #444;
  color: #888;
  cursor: not-allowed;
}

/* Success/Add Button */
.add-btn {
  background: #4CAF50;
  border-color: #4CAF50;
  font-weight: bold;
}

.add-btn:hover {
  background: #45a049;
}

/* Danger/Delete Button */
.delete-btn {
  background: #d32f2f;
  border-color: #d32f2f;
}

.delete-btn:hover {
  background: #b71c1c;
}
```

### Input Fields
```css
input[type="number"],
input[type="text"],
select {
  padding: 6px 8px;
  background: #1e1e1e;
  color: #fff;
  border: 1px solid #444;
  border-radius: 4px;
  font-size: 13px;
}

input:focus,
select:focus {
  outline: none;
  border-color: #0088ff;
}
```

### Checkboxes
```css
input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}
```

### Labels
```css
label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  color: #ccc;
  font-size: 13px;
}

/* Column layout for inputs */
.input-row label {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
```

## Layout Patterns

### Button Rows
```css
.button-row {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}
```

### Input Rows
```css
.input-row {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}
```

### Icon Buttons
```css
.icon-btn {
  padding: 4px 8px;
  background: #444;
  color: #fff;
  border: 1px solid #555;
  border-radius: 3px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.icon-btn:hover {
  background: #555;
}
```

## Scrolling Content

### Panel Content
```css
.panel-content {
  max-height: 500px;
  overflow-y: auto;
  overflow-x: hidden;
  scroll-behavior: smooth;
}

.panel-content::-webkit-scrollbar {
  width: 6px;
}

.panel-content::-webkit-scrollbar-track {
  background: #1a1d24;
}

.panel-content::-webkit-scrollbar-thumb {
  background: #444;
  border-radius: 3px;
}

.panel-content::-webkit-scrollbar-thumb:hover {
  background: #666;
}
```

## Animations

### Panel Entry
```css
@keyframes panel-slide-in {
  from {
    opacity: 0;
    transform: translateY(-10px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
```

### Dragging State
```css
.floating-panel.dragging {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
  cursor: grabbing;
  transition: none;
}
```

## Utility Classes

### Hints and Info Text
```css
.hint {
  color: #888;
  font-size: 12px;
  font-style: italic;
  margin-top: 10px;
}

.selection-info {
  padding: 8px;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 4px;
  color: #0088ff;
  font-size: 12px;
  margin-top: 10px;
}
```

## Best Practices

1. **Consistency**: Always use the defined color palette
2. **Spacing**: Use 8px increments for padding/margins (8px, 10px, 12px, 16px)
3. **Typography**: Primary text is 13-14px, hints are 12px
4. **Transitions**: Use `all 0.2s` for smooth interactions
5. **Focus States**: Always include focus styles for accessibility
6. **Disabled States**: Clearly distinguish disabled buttons with reduced opacity/different colors
7. **Z-index Management**: Panels use 10-50 range, menu bar uses 100
8. **Border Radius**: Panels use 8px, buttons use 4px, inputs use 4px
9. **Shadows**: Use layered shadows for depth (4px base, 8px for elevation)
10. **Responsive**: Min-width 220px, max-width 320px for panels

## Example Implementation

When creating a new popup window, follow this template:

```jsx
<div className="[window-name]-window">
  <div className="tabs">
    <button className={activeTab === 'tab1' ? 'active' : ''}>Tab 1</button>
  </div>
  
  <div className="tab-content">
    <div className="button-row">
      <button>Action 1</button>
      <button>Action 2</button>
    </div>
    
    <div className="input-row">
      <label>
        Label:
        <input type="number" />
      </label>
    </div>
    
    <label>
      <input type="checkbox" />
      Option Name
    </label>
    
    <p className="hint">Helper text here</p>
  </div>
</div>
```

This ensures visual consistency across the entire application.
