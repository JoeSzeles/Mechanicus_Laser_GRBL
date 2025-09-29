import tkinter as tk
import math
from snaptools import snap_to_grid, snap_to_endpoints, snap_to_midpoints, snap_to_centers
import time

class DrawingState:
    """Holds all the shared info tools need, like where you're drawing and what's selected."""
    def __init__(self):
        self.lastx = None  # Last X position
        self.lasty = None  # Last Y position
        self.linecount = 0  # Number of shapes drawn
        self.current_line_points = []  # Points for the current line
        self.current_shape_id = "shape_0"  # ID for the current shape
        self.active_tool = None  # Which tool is being used
        self.selected_items = set()  # Shapes you've picked
        self.hexstr = "#000000"  # Current color (black by default)
        self.current_shape = None  # The shape being drawn
        # New stuff for selection
        self.is_selecting = False  # Are we in selection mode?
        self.selection_rect = None  # The rectangle for multi-select
        self.start_x = 0  # Where selection starts (X)
        self.start_y = 0  # Where selection starts (Y)
        self.is_moving = False  # Are we dragging something?
        self.moved_items = {}  # Items being dragged and their original spots
        self.original_widths = {}  # Original line widths before highlighting

class Tool:
    """Base class for drawing tools"""
    def __init__(self, canvas, state, brush, snap_vars, serial=None, config=None, laser_var=None, z_axis_var=None):
        self.canvas = canvas
        self.state = state
        self.brush = brush
        self.snap_vars = snap_vars  # Dict with snap variables (grid, endpoints, etc.)
        self.snap_tolerance = 40.0
        self.serial = serial  # For machine control (e.g., Live Carving)
        self.config = config  # Machine configuration
        self.laser_var = laser_var  # Laser active checkbox variable
        self.z_axis_var = z_axis_var  # Z-axis active checkbox variable

    def get_snap_point(self, x, y, is_final=False):
        """Unified snapping logic returning snapped coordinates and visualization info"""
        snap_x, snap_y, snap_label, snap_color = x, y, None, None
        snap_types = [
            (self.snap_vars['endpoints'], snap_to_endpoints, "Endpoint", "red"),
            (self.snap_vars['midpoints'], snap_to_midpoints, "Midpoint", "#0088FF"),
            (self.snap_vars['centers'], snap_to_centers, "Center", "#0088FF"),
            (lambda: self.snap_vars['grid'].get() and self.snap_vars['grid_active'].get(), 
             lambda c, x, y, t: snap_to_grid(x, y, float(self.snap_vars['grid_size'].get()), is_final=is_final), 
             "Grid", "green")
        ]
        
        self.canvas.delete('snap_indicator', 'snap_label')
        for var, snap_func, label, color in snap_types:
            if var.get():
                result = snap_func(self.canvas, x, y, self.snap_tolerance)
                if result:
                    snap_x, snap_y = result
                    snap_label = label
                    snap_color = color
                    break
        
        if snap_label:
            self.canvas.create_polygon(snap_x-6, snap_y+6, snap_x+6, snap_y+6, snap_x, snap_y-6,
                                     fill=snap_color, outline='white',
                                     tags=('snap_indicator', 'above_all'))
            self.canvas.create_text(snap_x, snap_y-15, text=snap_label,
                                  fill=snap_color, font=('Arial', 8, 'bold'),
                                  tags=('snap_label', 'above_all'))
            self.canvas.tag_raise('above_all')
        
        return snap_x, snap_y

    def save_state(self):
        """Save canvas state for undo/redo"""
        from undoredo import save_canvas_state
        save_canvas_state()

    def start(self, event): pass
    def update(self, event): pass
    def finish(self, event): pass

class LineTool(Tool):
    def start(self, event):
        x, y = self.canvas.canvasx(event.x), self.canvas.canvasy(event.y)
        snap_x, snap_y = self.get_snap_point(x, y, is_final=True)
        self.state.lastx, self.state.lasty = snap_x, snap_y
        self.state.current_shape_id = f"shape_{self.state.linecount}"
        
        self.canvas.create_polygon(snap_x-6, snap_y+6, snap_x+6, snap_y+6, snap_x, snap_y-6,
                                 fill='green', outline='white',
                                 tags=('start_marker', 'above_all'))
        self.state.current_shape = self.canvas.create_line(
            snap_x, snap_y, snap_x, snap_y,
            fill='gray', dash=(4, 4), tags=('preview_line', 'above_all')
        )
        self.canvas.tag_raise('above_all')
        self.save_state()

    def update(self, event):
        if self.state.lastx is not None and self.state.lasty is not None:
            x, y = self.canvas.canvasx(event.x), self.canvas.canvasy(event.y)
            snap_x, snap_y = self.get_snap_point(x, y)
            self.canvas.delete('preview_line')
            self.state.current_shape = self.canvas.create_line(
                self.state.lastx, self.state.lasty, snap_x, snap_y,
                fill=self.state.hexstr, width=int(self.brush.get("1.0", "end-1c")),
                tags=('preview_line', 'above_all')
            )
            self.canvas.tag_raise('above_all')

    def finish(self, event):
        if self.state.lastx is not None and self.state.lasty is not None:
            x, y = self.canvas.canvasx(event.x), self.canvas.canvasy(event.y)
            snap_x, snap_y = self.get_snap_point(x, y, is_final=True)
            self.canvas.create_line(
                self.state.lastx, self.state.lasty, snap_x, snap_y,
                fill=self.state.hexstr, width=int(self.brush.get("1.0", "end-1c")),
                tags=('all_lines', self.state.current_shape_id), capstyle=tk.ROUND
            )
            self.canvas.delete('preview_line', 'start_marker', 'snap_indicator', 'snap_label')
            self.state.linecount += 1
            self.state.lastx = self.state.lasty = None
            self.state.current_shape = None
            self.save_state()

class CircleTool(Tool):
    def start(self, event):
        x, y = self.canvas.canvasx(event.x), self.canvas.canvasy(event.y)
        snap_x, snap_y = self.get_snap_point(x, y, is_final=True)
        self.state.lastx, self.state.lasty = snap_x, snap_y
        self.state.current_shape_id = f"shape_{self.state.linecount}"
        
        self.canvas.create_oval(snap_x-4, snap_y-4, snap_x+4, snap_y+4,
                              fill='#00FF00', outline='white', tags=('center_marker', 'above_all'))
        self.state.current_shape = self.canvas.create_oval(
            snap_x, snap_y, snap_x, snap_y,
            outline=self.state.hexstr, width=int(self.brush.get("1.0", "end-1c")),
            tags=('all_lines', self.state.current_shape_id)
        )
        self.canvas.tag_raise('above_all')

    def update(self, event):
        if self.state.current_shape:
            x, y = self.canvas.canvasx(event.x), self.canvas.canvasy(event.y)
            snap_x, snap_y = self.get_snap_point(x, y)
            radius = ((snap_x - self.state.lastx) ** 2 + (snap_y - self.state.lasty) ** 2) ** 0.5
            self.canvas.coords(self.state.current_shape,
                             self.state.lastx - radius, self.state.lasty - radius,
                             self.state.lastx + radius, self.state.lasty + radius)

    def finish(self, event):
        if self.state.current_shape:
            x, y = self.canvas.canvasx(event.x), self.canvas.canvasy(event.y)
            snap_x, snap_y = self.get_snap_point(x, y, is_final=True)
            radius = ((snap_x - self.state.lastx) ** 2 + (snap_y - self.state.lasty) ** 2) ** 0.5
            self.canvas.coords(self.state.current_shape,
                             self.state.lastx - radius, self.state.lasty - radius,
                             self.state.lastx + radius, self.state.lasty + radius)
            self.canvas.delete('center_marker', 'snap_indicator')
            self.state.linecount += 1
            self.state.current_shape = None
            self.save_state()

class RectangleTool(Tool):
    def start(self, event):
        x, y = self.canvas.canvasx(event.x), self.canvas.canvasy(event.y)
        snap_x, snap_y = self.get_snap_point(x, y, is_final=True)
        self.state.lastx, self.state.lasty = snap_x, snap_y
        self.state.current_shape_id = f"shape_{self.state.linecount}"
        
        self.canvas.create_oval(snap_x-4, snap_y-4, snap_x+4, snap_y+4,
                              fill='#00FF00', outline='white', tags=('start_marker', 'above_all'))
        self.state.current_shape = self.canvas.create_rectangle(
            snap_x, snap_y, snap_x, snap_y,
            outline=self.state.hexstr, width=int(self.brush.get("1.0", "end-1c")),
            tags=('all_lines', self.state.current_shape_id)
        )
        self.canvas.tag_raise('above_all')

    def update(self, event):
        if self.state.current_shape:
            x, y = self.canvas.canvasx(event.x), self.canvas.canvasy(event.y)
            snap_x, snap_y = self.get_snap_point(x, y)
            self.canvas.coords(self.state.current_shape,
                             self.state.lastx, self.state.lasty, snap_x, snap_y)

    def finish(self, event):
        if self.state.current_shape:
            x, y = self.canvas.canvasx(event.x), self.canvas.canvasy(event.y)
            snap_x, snap_y = self.get_snap_point(x, y, is_final=True)
            self.canvas.coords(self.state.current_shape,
                             self.state.lastx, self.state.lasty, snap_x, snap_y)
            self.canvas.delete('start_marker', 'snap_indicator')
            self.state.linecount += 1
            self.state.current_shape = None
            self.save_state()

class PolygonTool(Tool):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.vertices = 6  # Default hexagon

    def start(self, event):
        x, y = self.canvas.canvasx(event.x), self.canvas.canvasy(event.y)
        snap_x, snap_y = self.get_snap_point(x, y, is_final=True)
        self.state.lastx, self.state.lasty = snap_x, snap_y
        self.state.current_shape_id = f"shape_{self.state.linecount}"
        
        self.canvas.create_oval(snap_x-4, snap_y-4, snap_x+4, snap_y+4,
                              fill='#00FF00', outline='white', tags=('start_marker', 'above_all'))
        self.state.current_shape = self.canvas.create_polygon(
            [snap_x, snap_y, snap_x, snap_y],
            outline=self.state.hexstr, fill='', width=int(self.brush.get("1.0", "end-1c")),
            tags=('all_lines', self.state.current_shape_id)
        )
        self.canvas.tag_raise('above_all')

    def update(self, event):
        if self.state.current_shape:
            x, y = self.canvas.canvasx(event.x), self.canvas.canvasy(event.y)
            snap_x, snap_y = self.get_snap_point(x, y)
            radius = ((snap_x - self.state.lastx) ** 2 + (snap_y - self.state.lasty) ** 2) ** 0.5
            points = []
            for i in range(self.vertices):
                angle = 2 * math.pi * i / self.vertices - math.pi/2
                px = self.state.lastx + radius * math.cos(angle)
                py = self.state.lasty + radius * math.sin(angle)
                points.extend([px, py])
            self.canvas.coords(self.state.current_shape, *points)

    def finish(self, event):
        if self.state.current_shape:
            x, y = self.canvas.canvasx(event.x), self.canvas.canvasy(event.y)
            snap_x, snap_y = self.get_snap_point(x, y, is_final=True)
            radius = ((snap_x - self.state.lastx) ** 2 + (snap_y - self.state.lasty) ** 2) ** 0.5
            points = []
            for i in range(self.vertices):
                angle = 2 * math.pi * i / self.vertices - math.pi/2
                px = self.state.lastx + radius * math.cos(angle)
                py = self.state.lasty + radius * math.sin(angle)
                points.extend([px, py])
            self.canvas.coords(self.state.current_shape, *points)
            self.canvas.delete('start_marker', 'snap_indicator')
            self.state.linecount += 1
            self.state.current_shape = None
            self.save_state()

class ArcTool(Tool):
    def start(self, event):
        x, y = self.canvas.canvasx(event.x), self.canvas.canvasy(event.y)
        snap_x, snap_y = self.get_snap_point(x, y, is_final=True)
        self.state.lastx, self.state.lasty = snap_x, snap_y
        self.state.current_shape_id = f"shape_{self.state.linecount}"
        
        self.canvas.create_oval(snap_x-4, snap_y-4, snap_x+4, snap_y+4,
                              fill='#00FF00', outline='white', tags=('start_marker', 'above_all'))
        self.state.current_shape = self.canvas.create_arc(
            snap_x, snap_y, snap_x, snap_y,
            start=0, extent=90, outline=self.state.hexstr, width=int(self.brush.get("1.0", "end-1c")),
            tags=('all_lines', self.state.current_shape_id)
        )
        self.canvas.tag_raise('above_all')

    def update(self, event):
        if self.state.current_shape:
            x, y = self.canvas.canvasx(event.x), self.canvas.canvasy(event.y)
            snap_x, snap_y = self.get_snap_point(x, y)
            radius = ((snap_x - self.state.lastx) ** 2 + (snap_y - self.state.lasty) ** 2) ** 0.5
            angle = math.degrees(math.atan2(snap_y - self.state.lasty, snap_x - self.state.lastx))
            self.canvas.coords(self.state.current_shape,
                             self.state.lastx - radius, self.state.lasty - radius,
                             self.state.lastx + radius, self.state.lasty + radius)
            self.canvas.itemconfig(self.state.current_shape, start=angle, extent=90)

    def finish(self, event):
        if self.state.current_shape:
            x, y = self.canvas.canvasx(event.x), self.canvas.canvasy(event.y)
            snap_x, snap_y = self.get_snap_point(x, y, is_final=True)
            radius = ((snap_x - self.state.lastx) ** 2 + (snap_y - self.state.lasty) ** 2) ** 0.5
            angle = math.degrees(math.atan2(snap_y - self.state.lasty, snap_x - self.state.lastx))
            self.canvas.coords(self.state.current_shape,
                             self.state.lastx - radius, self.state.lasty - radius,
                             self.state.lastx + radius, self.state.lasty + radius)
            self.canvas.itemconfig(self.state.current_shape, start=angle, extent=90)
            self.canvas.delete('start_marker', 'snap_indicator')
            self.state.linecount += 1
            self.state.current_shape = None
            self.save_state()

class FreehandTool(Tool):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def start(self, event):
        x, y = self.canvas.canvasx(event.x), self.canvas.canvasy(event.y)
        snap_x, snap_y = self.get_snap_point(x, y, is_final=True)
        self.state.lastx, self.state.lasty = snap_x, snap_y
        self.state.current_shape_id = f"shape_{self.state.linecount}"
        self.state.current_line_points = [(snap_x, snap_y)]
        
        # Start drawing on canvas
        self.canvas.create_oval(snap_x-4, snap_y-4, snap_x+4, snap_y+4,
                              fill='#00FF00', outline='white', tags=('start_marker', 'above_all'))

    def update(self, event):
        if self.state.lastx is not None and self.state.lasty is not None:
            x, y = self.canvas.canvasx(event.x), self.canvas.canvasy(event.y)
            snap_x, snap_y = self.get_snap_point(x, y)
            self.state.current_line_points.append((snap_x, snap_y))
            
            # Update canvas with continuous line
            self.canvas.delete("temp_freehand")
            points = [coord for point in self.state.current_line_points for coord in point]
            self.canvas.create_line(
                *points, fill=self.state.hexstr, width=int(self.brush.get("1.0", "end-1c")),
                capstyle=tk.ROUND, tags=('temp_freehand',)
            )
            
            self.state.lastx, self.state.lasty = snap_x, snap_y

    def finish(self, event):
        if self.state.lastx is not None and self.state.lasty is not None:
            x, y = self.canvas.canvasx(event.x), self.canvas.canvasy(event.y)
            snap_x, snap_y = self.get_snap_point(x, y, is_final=True)
            self.state.current_line_points.append((snap_x, snap_y))
            
            # Finalize canvas drawing
            self.canvas.delete("temp_freehand")
            points = [coord for point in self.state.current_line_points for coord in point]
            self.canvas.create_line(
                *points, fill=self.state.hexstr, width=int(self.brush.get("1.0", "end-1c")),
                capstyle=tk.ROUND, tags=('all_lines', self.state.current_shape_id)
            )
            
            self.canvas.delete('start_marker', 'snap_indicator')
            self.state.linecount += 1
            self.state.lastx = self.state.lasty = None
            self.state.current_line_points = []
            self.state.current_shape = None
            self.save_state()



class SelectTool(Tool):
    """Lets you pick shapes by clicking, move them by dragging, or select multiple with a rectangle."""
    def start(self, event):
        self.state.is_selecting = True
        self.state.start_x = self.canvas.canvasx(event.x)
        self.state.start_y = self.canvas.canvasy(event.y)
        
        # Look for a shape under the click
        items = self.canvas.find_overlapping(
            self.state.start_x-5, self.state.start_y-5,
            self.state.start_x+5, self.state.start_y+5
        )
        
        clicked_shape = None
        for item in items:
            tags = self.canvas.gettags(item)
            shape_id = next((tag for tag in tags if tag.startswith('shape_')), None)
            if shape_id:
                clicked_shape = shape_id
                break
        
        if clicked_shape:
            # You clicked a shape—get ready to move it
            self.state.is_moving = True
            self.state.moved_items.clear()
            
            # Clear selection unless Ctrl is held (for multi-select)
            if clicked_shape not in self.state.selected_items and not event.state & 0x4:
                self.state.selected_items.clear()
            self.state.selected_items.add(clicked_shape)
            
            # Store original positions of selected items
            for shape_id in self.state.selected_items:
                for item in self.canvas.find_withtag(shape_id):
                    coords = self.canvas.coords(item)
                    if coords:
                        self.state.moved_items[item] = coords.copy()
            
            self.highlight_selected_shapes()
        else:
            # Clicked empty space—start a selection rectangle
            self.state.is_moving = False
            if not event.state & 0x4:  # Clear selection unless Ctrl is held
                self.state.selected_items.clear()
                self.highlight_selected_shapes()
            
            if self.state.selection_rect:
                self.canvas.delete(self.state.selection_rect)
            self.state.selection_rect = self.canvas.create_rectangle(
                self.state.start_x, self.state.start_y,
                self.state.start_x, self.state.start_y,
                outline='#00ff00', width=1, dash=(2, 2)
            )

    def update(self, event):
        if not self.state.is_selecting:
            return
        
        current_x = self.canvas.canvasx(event.x)
        current_y = self.canvas.canvasy(event.y)
        
        if self.state.is_moving and self.state.moved_items:
            # Move all selected items
            dx = current_x - self.state.start_x
            dy = current_y - self.state.start_y
            
            for item, original_coords in self.state.moved_items.items():
                new_coords = [original_coords[i] + (dx if i % 2 == 0 else dy) 
                            for i in range(len(original_coords))]
                self.canvas.coords(item, *new_coords)
        elif self.state.selection_rect:
            # Grow the selection rectangle
            self.canvas.coords(self.state.selection_rect,
                             self.state.start_x, self.state.start_y,
                             current_x, current_y)

    def finish(self, event):
        if not self.state.is_selecting:
            return
        
        if self.state.is_moving:
            # Done moving items
            self.state.is_moving = False
            self.state.moved_items.clear()
        elif self.state.selection_rect:
            # Finish rectangle selection
            bbox = self.canvas.coords(self.state.selection_rect)
            if bbox:
                x1, y1, x2, y2 = bbox
                x1, x2 = min(x1, x2), max(x1, x2)
                y1, y2 = min(y1, y2), max(y1, y2)
                
                items = self.canvas.find_enclosed(x1, y1, x2, y2)
                
                # Clear selection if it's a tiny click, else add items
                if not items and abs(x2 - x1) < 3 and abs(y2 - y1) < 3:
                    self.state.selected_items.clear()
                else:
                    for item in items:
                        tags = self.canvas.gettags(item)
                        shape_id = next((tag for tag in tags if tag.startswith('shape_')), None)
                        if shape_id and shape_id not in self.state.selected_items:
                            self.state.selected_items.add(shape_id)
            
            self.canvas.delete(self.state.selection_rect)
            self.state.selection_rect = None
            self.highlight_selected_shapes()
        
        self.state.is_selecting = False
        self.save_state()

    def highlight_selected_shapes(self):
        """Turns selected shapes green and others black."""
        # Save original widths
        for item in self.canvas.find_withtag('all_lines'):
            if item not in self.state.original_widths:
                self.state.original_widths[item] = self.canvas.itemcget(item, 'width')
        
        # Reset all to black
        for item in self.canvas.find_withtag('all_lines'):
            if self.canvas.type(item) == 'line':
                self.canvas.itemconfig(item, fill='black', width=self.state.original_widths[item])
            else:
                self.canvas.itemconfig(item, outline='black', width=self.state.original_widths[item])
        
        # Highlight selected in green
        for shape_id in self.state.selected_items:
            items = self.canvas.find_withtag(shape_id)
            for item in items:
                if self.canvas.type(item) == 'line':
                    self.canvas.itemconfig(item, fill='#00FF00', width=3)
                else:
                    self.canvas.itemconfig(item, outline='#00FF00', width=3, fill='')

def create_tool(tool_name, canvas, state, brush, snap_vars, serial=None, config=None, laser_var=None, z_axis_var=None, draw_speed=None, laser_power=None):
    """Factory function to create tool instances"""
    print(f"\n[DEBUG] create_tool called with tool_name: {tool_name}")
    print(f"[DEBUG] Parameters:")
    print(f"  - canvas: {canvas}")
    print(f"  - serial: {serial}")
    print(f"  - config: {config}")
    print(f"  - laser_var: {laser_var}")
    print(f"  - z_axis_var: {z_axis_var}")
    print(f"  - draw_speed: {draw_speed}")
    print(f"  - laser_power: {laser_power}")
    
    tools = {
        'line': LineTool,
        'circle': CircleTool,
        'rectangle': RectangleTool,
        'polygon': PolygonTool,
        'arc': ArcTool,
        'freehand': lambda *args, **kwargs: FreehandTool(*args, **kwargs)
        
    }
    
    tool_class = tools.get(tool_name.lower(), Tool)
    print(f"[DEBUG] Selected tool class: {tool_class.__name__}")
    
    tool = tool_class(canvas, state, brush, snap_vars, serial, config, laser_var, z_axis_var)
    print(f"[DEBUG] Tool instance created: {tool.__class__.__name__}")
    return tool