import tkinter as tk

def init_grid(canvas, grid_var, scale_var, grid_size_var):
    """Initialize grid module with required variables."""
    global cv, _grid_var, _scale_var, _grid_size_var
    cv = canvas
    _grid_var = grid_var
    _scale_var = scale_var
    _grid_size_var = grid_size_var

def create_grid():
    """Create or update the grid on the canvas."""
    if _grid_var.get():
        # Get current scale factor
        try:
            scale_text = _scale_var.get().rstrip('%')
            current_scale = float(scale_text) / 100.0
        except:
            current_scale = 1.0
        
        # Get base grid spacing and adjust for scale
        base_spacing = float(_grid_size_var.get())
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
                fill='#808080', width=1,  # Medium grey color
                tags=('grid_lines', 'below_all')
            )
        
        # Create horizontal lines
        for y in range(0, height + int(grid_spacing), int(grid_spacing)):
            cv.create_line(
                0, y, width, y,
                fill='#808080', width=1,  # Medium grey color
                tags=('grid_lines', 'below_all')
            )
        
        # Make sure grid is below other elements
        cv.tag_lower('grid_lines')
        cv.tag_lower('below_all')
    else:
        # Remove grid
        cv.delete('grid_lines')

def get_snap_point(x, y, snap_var, is_final=False):
    """Get the nearest grid point for snapping."""
    # Convert to canvas coordinates
    x = cv.canvasx(x)
    y = cv.canvasy(y)
    
    # Initialize variables
    snap_x, snap_y = x, y
    found_snap = False
    
    # Only snap to grid if grid is visible and grid snap is enabled
    if not found_snap and _grid_var.get() and snap_var.get():
        # Get current scale
        current_scale = 1.0
        try:
            scale_text = _scale_var.get().rstrip('%')
            current_scale = float(scale_text) / 100.0
        except (ValueError, AttributeError):
            pass
        
        # Get grid spacing
        base_spacing = 50
        try:
            base_spacing = float(_grid_size_var.get())
            if base_spacing <= 0:
                base_spacing = 50
        except (ValueError, AttributeError):
            pass
        
        # Apply scale to grid spacing
        scaled_spacing = base_spacing * current_scale
        
        # Calculate nearest grid points
        snap_x = round(x / scaled_spacing) * scaled_spacing
        snap_y = round(y / scaled_spacing) * scaled_spacing
        found_snap = True
    
    return snap_x, snap_y

def on_grid_toggle():
    create_grid()

def on_grid_size_change(*args):
    if _grid_var.get():
        create_grid()