from tkinter import *

# Global variables
cv = None  # Canvas reference
grid_var = None  # Grid visibility variable
scale_var = None  # Scale variable for zoom
grid_size_var = None  # Grid size variable
max_history = 50  # Maximum history states to keep
ROUND = 'round'  # Line capstyle constant

# Initialize history variables
canvas_history = []
current_history_index = -1

def set_canvas(canvas):
    """Set the canvas reference for undo/redo operations"""
    global cv
    cv = canvas

def set_grid_var(var):
    """Set the grid visibility variable"""
    global grid_var
    grid_var = var

def set_scale_var(var):
    """Set the scale variable for zoom"""
    global scale_var
    scale_var = var

def set_grid_size_var(var):
    """Set the grid size variable"""
    global grid_size_var
    grid_size_var = var

def get_current_scale():
    """Get current canvas scale factor"""
    if scale_var is not None:
        try:
            scale_text = scale_var.get().rstrip('%')
            return float(scale_text) / 100.0
        except:
            pass
    return 1.0

def create_grid():
    """Create or remove grid based on grid_var state"""
    if grid_var.get():
        # Get current scale factor
        current_scale = 1.0
        if scale_var is not None:
            try:
                scale_text = scale_var.get().rstrip('%')
                current_scale = float(scale_text) / 100.0
            except:
                pass
        
        # Get base grid spacing and adjust for scale
        base_spacing = float(grid_size_var.get())
        grid_spacing = base_spacing * current_scale
        
        # Get canvas dimensions
        width = cv.winfo_width()
        height = cv.winfo_height()
        
        # Remove any existing grid
        cv.delete('grid_lines')
        
        # Create vertical lines
        for x in range(0, width + int(grid_spacing), int(grid_spacing)):
            cv.create_line(
                x, 0, x, height,
                fill='#404040', width=1,
                tags=('grid_lines', 'below_all')
            )
        
        # Create horizontal lines
        for y in range(0, height + int(grid_spacing), int(grid_spacing)):
            cv.create_line(
                0, y, width, y,
                fill='#404040', width=1,
                tags=('grid_lines', 'below_all')
            )
        
        # Make sure grid is below other elements
        cv.tag_lower('grid_lines')
        cv.tag_lower('below_all')
    else:
        # Remove grid
        cv.delete('grid_lines')

def init_canvas_history():
    """Initialize or reset the canvas history"""
    global current_history_index, canvas_history
    canvas_history = []
    current_history_index = -1
    save_canvas_state()  # Save initial empty state

def save_canvas_state():
    """Save current canvas state to history"""
    global canvas_history, current_history_index
    
    if cv is None:
        print("Warning: Canvas not set for undo/redo")
        return

    # Get all canvas items and their properties
    items = []
    for item in cv.find_all():
        try:
            item_type = cv.type(item)
            coords = list(cv.coords(item))
            tags = cv.gettags(item)
            
            # Skip temporary items, grid lines, crosshair, and markers
            skip_tags = ['start_marker', 'preview_line', 'radius_marker', 'center_marker', 
                        'grid_lines', 'above_all', 'below_all', 'snap_marker', 'rotation_marker',
                        'endpoint_marker', 'permanent_center_marker', 'no_engrave', 'crosshair',
                        'machine_pos']
            if any(tag in skip_tags for tag in tags):
                continue
                
            config = {
                'type': item_type,
                'coords': coords,
                'fill': cv.itemcget(item, 'fill'),
                'width': float(cv.itemcget(item, 'width')),
                'tags': [tag for tag in tags if not tag in skip_tags]
            }
            
            # Add type-specific properties
            if item_type == 'arc':
                config['start'] = float(cv.itemcget(item, 'start'))
                config['extent'] = float(cv.itemcget(item, 'extent'))
                config['outline'] = cv.itemcget(item, 'outline')
                config['style'] = cv.itemcget(item, 'style')
            elif item_type in ['oval', 'rectangle', 'polygon']:
                config['outline'] = cv.itemcget(item, 'outline')
            
            items.append(config)
        except Exception as e:
            print(f"Error saving item: {e}")

    # Create state
    state = {
        'items': items,
        'scale': get_current_scale()
    }
    
    # Handle history management
    if current_history_index == -1:
        # First state - reset history
        canvas_history = []
        canvas_history.append(state)
        current_history_index = 0
    else:
        # Remove any states after current index (redo stack)
        canvas_history = canvas_history[:current_history_index + 1]
        # Add new state
        canvas_history.append(state)
        current_history_index = len(canvas_history) - 1
    
    # Limit history size
    if len(canvas_history) > max_history:
        excess = len(canvas_history) - max_history
        canvas_history = canvas_history[excess:]
        current_history_index = max(0, current_history_index - excess)
    
    # Generate event to update layers window
    cv.event_generate('<<ShapeAdded>>')

def undo():
    """Undo last canvas operation"""
    global current_history_index
    
    if cv is None:
        print("Warning: Canvas not set for undo/redo")
        return
        
    if not canvas_history or current_history_index <= 0:
        print("Nothing to undo")
        return
        
    # Move back one state
    current_history_index -= 1
    restore_canvas_state(canvas_history[current_history_index])
    
    # Generate event to update layers window
    cv.event_generate('<<ShapeAdded>>')

def redo():
    """Redo last undone canvas operation"""
    global current_history_index
    
    if cv is None:
        print("Warning: Canvas not set for undo/redo")
        return
        
    if not canvas_history or current_history_index >= len(canvas_history) - 1:
        print("Nothing to redo")
        return
        
    # Move forward one state
    current_history_index += 1
    restore_canvas_state(canvas_history[current_history_index])
    
    # Generate event to update layers window
    cv.event_generate('<<ShapeAdded>>')

def restore_canvas_state(state):
    """Restore canvas to a saved state"""
    if cv is None:
        print("Warning: Canvas not set for undo/redo")
        return
        
    # Store crosshair and grid visibility state
    crosshair_items = []
    for item in cv.find_all():
        tags = cv.gettags(item)
        if 'crosshair' in tags:
            crosshair_items.append({
                'coords': list(cv.coords(item)),
                'fill': cv.itemcget(item, 'fill'),
                'width': cv.itemcget(item, 'width'),
                'dash': cv.itemcget(item, 'dash'),
                'tags': tags
            })
    
    # Clear existing items, except grid lines and utility elements
    for item in cv.find_all():
        tags = cv.gettags(item)
        skip_tags = ['grid_lines', 'above_all', 'below_all', 'snap_marker', 'rotation_marker',
                    'endpoint_marker', 'permanent_center_marker', 'no_engrave']
        if not any(tag in skip_tags for tag in tags):
            cv.delete(item)
    
    # Restore items from state
    for item_config in state['items']:
        try:
            item_type = item_config['type']
            coords = item_config['coords']
            tags = item_config['tags']
            
            # Create item based on type
            if item_type == 'line':
                item = cv.create_line(*coords, 
                    fill=item_config['fill'],
                    width=item_config['width'],
                    tags=tags)
            elif item_type == 'arc':
                item = cv.create_arc(*coords,
                    start=item_config['start'],
                    extent=item_config['extent'],
                    outline=item_config['outline'],
                    width=item_config['width'],
                    style=item_config['style'],
                    tags=tags)
            elif item_type == 'oval':
                item = cv.create_oval(*coords,
                    fill=item_config['fill'],
                    outline=item_config['outline'],
                    width=item_config['width'],
                    tags=tags)
            elif item_type == 'rectangle':
                item = cv.create_rectangle(*coords,
                    fill=item_config['fill'],
                    outline=item_config['outline'],
                    width=item_config['width'],
                    tags=tags)
            elif item_type == 'polygon':
                item = cv.create_polygon(*coords,
                    fill=item_config['fill'],
                    outline=item_config['outline'],
                    width=item_config['width'],
                    tags=tags)
            
            # Restore event bindings for shapes
            if 'shape' in tags:
                cv.tag_bind(item, '<Button-1>', 
                    lambda e, i=item: cv.event_generate('<<ShapeClicked>>', when='tail'))
                
        except Exception as e:
            print(f"Error restoring item: {e}")
    
    # Restore crosshair
    for crosshair in crosshair_items:
        cv.create_line(*crosshair['coords'],
                      fill=crosshair['fill'],
                      width=crosshair['width'],
                      dash=crosshair['dash'],
                      tags=crosshair['tags'])
    
    # Update canvas display
    cv.update_idletasks()