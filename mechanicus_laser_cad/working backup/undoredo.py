from tkinter import *

# Global variables
cv = None  # Canvas reference
grid_var = None  # Grid visibility variable
scale_var = None  # Scale variable for zoom
grid_size_var = None  # Grid size variable
max_history = 50  # Maximum history states to keep
ROUND = 'round'  # Line capstyle constant

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
    global current_history_index, canvas_history, current_shape_id, linecount
    canvas_history = []
    current_history_index = -1
    current_shape_id = f"shape_0"
    linecount = 0
    save_canvas_state()  # Save initial empty state

def save_canvas_state():
    global canvas_history, current_history_index
    # Get all canvas items and their properties
    state = []
    for item in cv.find_all():
        try:
            item_type = cv.type(item)
            coords = cv.coords(item)
            tags = cv.gettags(item)
            
            # Skip temporary items and grid lines
            if any(tag in ['start_marker', 'preview_line', 'radius_marker', 'center_marker', 'grid_lines', 'above_all', 'below_all'] for tag in tags):
                continue
                
            config = {
                'type': item_type,
                'coords': coords,
                'fill': cv.itemcget(item, 'fill'),
                'width': cv.itemcget(item, 'width'),
                'tags': [tag for tag in tags if not tag in ['above_all', 'below_all']]  # Filter out special tags
            }
            
            # Add type-specific properties
            if item_type == 'arc':
                config['start'] = float(cv.itemcget(item, 'start'))
                config['extent'] = float(cv.itemcget(item, 'extent'))
                config['outline'] = cv.itemcget(item, 'outline')
                config['style'] = cv.itemcget(item, 'style')
            elif item_type in ['oval', 'rectangle', 'polygon']:
                config['outline'] = cv.itemcget(item, 'outline')
            
            state.append(config)
        except Exception as e:
            print(f"Error saving item: {e}")
    
    # Remove any redo states and append new state
    canvas_history = canvas_history[:current_history_index + 1]
    canvas_history.append(state)
    current_history_index = len(canvas_history) - 1
    
    # Limit history size
    if len(canvas_history) > max_history:
        canvas_history = canvas_history[-max_history:]
        current_history_index = len(canvas_history) - 1
        
    # Generate event to update layers window
    cv.event_generate('<<ShapeAdded>>')

def undo():
    global current_history_index
    if current_history_index > 0:
        current_history_index -= 1
        was_grid_visible = grid_var.get()  # Store grid state
        restore_canvas_state(canvas_history[current_history_index])
        if was_grid_visible:  # Restore grid if it was visible
            create_grid()

def redo():
    global current_history_index
    if current_history_index < len(canvas_history) - 1:
        current_history_index += 1
        was_grid_visible = grid_var.get()  # Store grid state
        restore_canvas_state(canvas_history[current_history_index])
        if was_grid_visible:  # Restore grid if it was visible
            create_grid()

def restore_canvas_state(state):
    # Store grid visibility
    was_grid_visible = grid_var.get()
    
    # Clear canvas except grid
    for item in cv.find_all():
        if 'grid_lines' not in cv.gettags(item):
            cv.delete(item)
    
    # Restore items
    for item in state:
        try:
            item_type = item['type']
            coords = item['coords']
            tags = item['tags']
            fill = item['fill']
            width = item['width']
            
            if item_type == 'line':
                cv.create_line(coords, 
                             fill=fill, 
                             width=width,
                             tags=tags,
                             capstyle=ROUND)
            elif item_type == 'oval':
                cv.create_oval(coords,
                             outline=item.get('outline', fill),
                             width=width,
                             tags=tags)
            elif item_type == 'rectangle':
                cv.create_rectangle(coords,
                                outline=item.get('outline', fill),
                                width=width,
                                tags=tags)
            elif item_type == 'polygon':
                cv.create_polygon(coords,
                              fill='',
                              outline=item.get('outline', fill),
                              width=width,
                              tags=tags)
            elif item_type == 'arc':
                cv.create_arc(coords,
                          start=float(item.get('start', 0)),
                          extent=float(item.get('extent', 90)),
                          fill='',
                          outline=item.get('outline', fill),
                          width=width,
                          style=item.get('style', 'arc'),
                          tags=tags)
        except Exception as e:
            print(f"Error restoring item: {e}")
    
    # Make sure grid stays on top if it was visible
    if was_grid_visible:
        cv.tag_raise('grid_lines')
        cv.tag_lower('below_all')
        
    # Generate event to update layers window
    cv.event_generate('<<ShapeAdded>>')