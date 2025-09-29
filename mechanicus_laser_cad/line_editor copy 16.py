import tkinter as tk
from tkinter import ttk, messagebox
import math
import time

# Import undo/redo functions
from undoredo import save_canvas_state, set_canvas, init_canvas_history, set_grid_var, set_scale_var, set_grid_size_var

class LineEditor:
    def __init__(self, parent_window, canvas):
        self.parent = parent_window
        self.canvas = canvas
        
        # Set up undo/redo system
        from undoredo import set_canvas, set_grid_var, set_scale_var, set_grid_size_var, init_canvas_history
        
        # Set canvas reference for undo/redo system
        set_canvas(canvas)
        
        # Set grid variable if it exists in parent
        if hasattr(self.parent, 'grid_var'):
            set_grid_var(self.parent.grid_var)
        
        # Set scale variable if it exists in parent
        if hasattr(self.parent, 'scale_var'):
            set_scale_var(self.parent.scale_var)
        
        # Set grid size variable if it exists in parent
        if hasattr(self.parent, 'grid_size_var'):
            set_grid_size_var(self.parent.grid_size_var)
        
        # Initialize undo/redo history
        init_canvas_history()
        
        # Initialize other class variables
        self.selected_lines = []
        self.selected_vertex = None
        self.radius_entry = None
        self.scaale_factor = 1.0
        self.debug_mode = True  # Enable debug visualization
        self.original_colors = {}  # Store original colors
        self.original_widths = {}  # Store original widths
        self.tools_window = None
        self.select_btn = None  # Store reference to select button
        self.snap_enabled = tk.BooleanVar(value=True)  # Snap functionality toggle
        self.dragging = False  # Track if currently dragging endpoint
        self.drag_point = None  # Store which endpoint is being dragged
        self.drag_line = None  # Store which line is being adjusted
        self.drag_marker = None  # Store the marker for the dragged endpoint
        self.snap_markers = []  # Store markers for potential snap points
        self.rotation_center_markers = []  # Store rotation center markers
        self.angle_label = None  # Store angle label for rotation
        self.cumulative_angle = 0  # Track total rotation angle
        
        # Initialize rotation-related attributes
        self.rotate_shape = None
        self.rotation_point = None
        self.original_coords = None
        self.start_angle = None
        self.rotate_state = 'select_shape'
        self.original_width = None
        
        # Add at the beginning of __init__ after other initializations
        self.original_fills = {}  # Store original fill colors
        
        self.initialize_tools()

    def initialize_tools(self):
        """Initialize all line editing tools"""
        self.is_selecting = False
        self.canvas.unbind('<Button-1>')
        self.canvas.unbind('<Button-3>')  # Unbind right click
        self.current_tool = None
        self.selected_lines = []
        self.selected_vertex = None
        self.original_colors = {}
        self.original_widths = {}
        self.drag_marker = None
        self.snap_markers = []
        self.last_clicked = None

    def activate_selection(self):
        """Activate line selection mode"""
        # Deactivate main app's selection mode if active
        if hasattr(self.parent, 'is_selecting') and self.parent.is_selecting:
            self.parent.toggle_select()
        
        # Deactivate other tools in main app
        if hasattr(self.parent, 'deactivate_all_tools'):
            self.parent.deactivate_all_tools()
        
        # Set tool state in main app
        if hasattr(self.parent, 'current_tool'):
            self.parent.current_tool = 'line_select'
        
        # Set internal tool state
        self.current_tool = 'select'
        self.is_selecting = True
        
        # Update cursor
        self.canvas.config(cursor="crosshair")
        
        # Update button state
        self.set_active_tool('select')
            
        # Bind canvas events
        self.canvas.unbind('<Button-1>')
        self.canvas.unbind('<Button-3>')
        self.canvas.bind('<Button-1>', self.on_canvas_click)
        self.canvas.bind('<Button-3>', self.on_canvas_right_click)

    def on_canvas_click(self, event):
        """Handle canvas clicks for line selection"""
        if not self.is_selecting:
            return
            
        x = self.canvas.canvasx(event.x)
        y = self.canvas.canvasy(event.y)
        self.scale_factor = self.get_scale_factor()
        
        # Increased base tolerance and scale it properly
        tolerance = 15 / self.scale_factor
        
        # Find overlapping items
        items = self.canvas.find_overlapping(x-tolerance, y-tolerance, x+tolerance, y+tolerance)
        
        # Filter for valid lines and shapes
        exclude_tags = ['grid_lines', 'below_all', 'above_all', 'snap_point', 'snap_line', 
                       'temp_marker', 'radius_marker', 'center_marker', 'temp', 
                       'guide_point', 'guide_line', 'crosshair', 'machine_pos']
        
        valid_items = []
        for item in items:
            item_type = self.canvas.type(item)
            if item_type in ['line', 'arc', 'oval', 'polygon', 'rectangle']:
                tags = self.canvas.gettags(item)
                if not any(tag in tags for tag in exclude_tags):
                    valid_items.append(item)
        
        if valid_items:
            # Find closest item to click point
            closest_item = None
            min_distance = float('inf')
            
            for item in valid_items:
                coords = list(self.canvas.coords(item))
                if len(coords) >= 4:  # Ensure we have at least 2 points
                    if self.canvas.type(item) == 'line':
                        dist = self.point_to_line_distance(x, y, coords[0], coords[1], coords[2], coords[3])
                    else:
                        # For other shapes, use center point distance
                        center_x = sum(coords[::2]) / (len(coords) // 2)
                        center_y = sum(coords[1::2]) / (len(coords) // 2)
                        dist = ((x - center_x) ** 2 + (y - center_y) ** 2) ** 0.5
                    
                    if dist < min_distance:
                        min_distance = dist
                        closest_item = item
            
            if closest_item:
                try:
                    # If clicking the same item again, deselect it
                    if closest_item in self.selected_lines:
                        self.deselect_item(closest_item)
                    else:
                        # Store original properties
                        if self.canvas.type(closest_item) == 'arc':
                            self.original_colors[closest_item] = self.canvas.itemcget(closest_item, 'outline')
                        else:
                            self.original_colors[closest_item] = self.canvas.itemcget(closest_item, 'fill')
                        self.original_widths[closest_item] = self.canvas.itemcget(closest_item, 'width')
                        
                        # Add to selection
                        self.selected_lines.append(closest_item)
                        
                        # Highlight item
                        if self.canvas.type(closest_item) == 'arc':
                            self.canvas.itemconfig(closest_item, outline='green', width=2)
                        else:
                            self.canvas.itemconfig(closest_item, fill='green', width=2)
                        
                        self.last_clicked = closest_item
                        
                except tk.TclError:
                    # If the item doesn't exist anymore
                    self.clear_selection()
        else:
            # Click in empty space - clear selection
            self.clear_selection()

    def on_canvas_right_click(self, event):
        """Handle right-click for deselection"""
        self.clear_selection()

    def deselect_item(self, item_id):
        """Deselect a specific item"""
        try:
            # Restore original properties
            if self.canvas.type(item_id) == 'arc':
                self.canvas.itemconfig(item_id, 
                                    outline=self.original_colors.get(item_id, 'black'),
                                    width=self.original_widths.get(item_id, 1))
            else:
                self.canvas.itemconfig(item_id, 
                                    fill=self.original_colors.get(item_id, 'black'),
                                    width=self.original_widths.get(item_id, 1))
            
            # Remove from selection
            self.selected_lines.remove(item_id)
            
            # Clean up stored properties
            if item_id in self.original_colors:
                del self.original_colors[item_id]
            if item_id in self.original_widths:
                del self.original_widths[item_id]
                
            if item_id == self.last_clicked:
                self.last_clicked = None
                
        except (tk.TclError, ValueError):
            # If the item doesn't exist anymore or isn't in the selection
            pass

    def clear_selection(self):
        """Clear all selected lines"""
        self.canvas.delete('intersection')
        self.canvas.delete('endpoint_marker')
        self.canvas.delete('snap_marker')
        self.canvas.delete('angle_label')  # Also clear angle label
        
        # Reset rotation-specific state
        if hasattr(self, 'rotate_shape') and self.rotate_shape:
            shape_type = self.canvas.type(self.rotate_shape)
            if shape_type == 'line':
                self.canvas.itemconfig(self.rotate_shape, 
                    fill=self.original_colors.get(self.rotate_shape, 'black'),
                    width=self.original_widths.get(self.rotate_shape, 1))
            else:
                self.canvas.itemconfig(self.rotate_shape, 
                    outline=self.original_colors.get(self.rotate_shape, 'black'),
                    fill=self.original_fills.get(self.rotate_shape, ''),
                    width=self.original_widths.get(self.rotate_shape, 1))
            self.rotate_shape = None
            self.rotation_point = None
            self.original_coords = None
            self.start_angle = None
            self.rotate_state = 'select_shape'
            self.clear_rotation_markers()
            self.cumulative_angle = 0  # Reset cumulative angle
        
        # Reset all selected shapes
        for line_id in self.selected_lines[:]:
            try:
                shape_type = self.canvas.type(line_id)
                if shape_type == 'line':
                    self.canvas.itemconfig(line_id, 
                        fill=self.original_colors.get(line_id, 'black'),
                        width=self.original_widths.get(line_id, 1))
                else:
                    self.canvas.itemconfig(line_id, 
                        outline=self.original_colors.get(line_id, 'black'),
                        fill=self.original_fills.get(line_id, ''),
                        width=self.original_widths.get(line_id, 1))
            except tk.TclError:
                pass
        
        # Clear all state
        self.selected_lines = []
        self.selected_vertex = None
        self.original_colors = {}
        self.original_widths = {}
        self.original_fills = {}
        self.drag_marker = None
        self.snap_markers = []
        self.last_clicked = None
        
        # Reset tool state
        self.current_tool = None
        self.rotate_state = 'select_shape'
        
        # Reset button states
        if self.tools_window and tk.Toplevel.winfo_exists(self.tools_window):
            for button in self.tool_buttons.values():
                button.configure(relief='raised', bg='#263d42')

    def find_intersection(self):
        """Find the intersection point of two selected lines"""
        if len(self.selected_lines) == 2:
            self.canvas.delete('intersection')
            
            # Check if both lines still exist
            try:
                line1_coords = list(self.canvas.coords(self.selected_lines[0]))
                line2_coords = list(self.canvas.coords(self.selected_lines[1]))
                
                # Check if we got valid coordinates
                if len(line1_coords) != 4 or len(line2_coords) != 4:
                    self.clear_selection()
                    return
                
                x1, y1, x2, y2 = line1_coords
                x3, y3, x4, y4 = line2_coords
                
                denominator = ((x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4))
                if abs(denominator) < 1e-10:  # Check for near-zero denominator
                    messagebox.showerror("Error", "The selected lines are parallel or do not intersect.")
                    self.clear_selection()
                    return
                    
                t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denominator
                intersection_x = x1 + t * (x2 - x1)
                intersection_y = y1 + t * (y2 - y1)
                
                if not (min(x1, x2) <= intersection_x <= max(x1, x2) and
                        min(y1, y2) <= intersection_y <= max(y1, y2) and
                        min(x3, x4) <= intersection_x <= max(x3, x4) and
                        min(y3, y4) <= intersection_y <= max(y3, y4)):
                    messagebox.showerror("Error", "The lines do not intersect within their segments.")
                    self.clear_selection()
                    return
                    
                self.selected_vertex = (intersection_x, intersection_y)
                self.canvas.create_oval(
                    intersection_x - 3, intersection_y - 3,
                    intersection_x + 3, intersection_y + 3,
                    fill='red', tags='intersection'
                )
                
            except (ValueError, tk.TclError):
                # If there was any error getting coordinates or the lines don't exist
                self.clear_selection()
                return

    def get_next_shape_id(self):
        """Get next available shape ID from main app's linecount with millisecond timestamp"""
        timestamp = int(time.time() * 1000)  # Get current time in milliseconds
        if hasattr(self.canvas, 'linecount'):
            shape_id = f'shape_{self.canvas.linecount}_{timestamp}'
            self.canvas.linecount += 1
            return shape_id
        elif hasattr(self.parent, 'linecount'):
            shape_id = f'shape_{self.parent.linecount}_{timestamp}'
            self.parent.linecount += 1
            return shape_id
        return f'shape_0_{timestamp}'  # Fallback if linecount not available

    def activate_fillet(self):
        """Activate fillet mode for line selection and filleting"""
        # Deactivate main app's selection mode if active
        if hasattr(self.parent, 'is_selecting') and self.parent.is_selecting:
            self.parent.toggle_select()
        
        # Deactivate other tools in main app
        if hasattr(self.parent, 'deactivate_all_tools'):
            self.parent.deactivate_all_tools()
        
        # Set tool state in main app
        if hasattr(self.parent, 'current_tool'):
            self.parent.current_tool = 'fillet'
        
        self.clear_selection()  # Clear any existing selection
        self.canvas.config(cursor="crosshair")
        
        # Update button state
        self.set_active_tool('fillet')
        
        # Initialize fillet state
        self.fillet_state = 'first_line'
        
        # Bind canvas events for selection
        self.canvas.unbind('<Button-1>')
        self.canvas.bind('<Button-1>', self.on_fillet_select)

    def on_fillet_select(self, event):
        """Handle line selection for filleting"""
        x = self.canvas.canvasx(event.x)
        y = self.canvas.canvasy(event.y)
        self.scale_factor = self.get_scale_factor()
        tolerance = 10 / self.scale_factor
        
        # Find overlapping items
        items = self.canvas.find_overlapping(x-tolerance, y-tolerance, x+tolerance, y+tolerance)
        
        # Filter for valid lines - exclude grid lines and utility elements
        exclude_tags = ['grid_lines', 'below_all', 'above_all', 'snap_point', 'snap_line', 
                       'temp_marker', 'radius_marker', 'center_marker', 'temp', 
                       'guide_point', 'guide_line', 'crosshair', 'machine_pos']
        
        lines = []
        for item in items:
            if self.canvas.type(item) == 'line':
                tags = self.canvas.gettags(item)
                if not any(tag in tags for tag in exclude_tags):
                    lines.append(item)
        
        if not lines:
            return
            
        # Find the closest line to the click point
        closest_line = None
        min_distance = float('inf')
        for line in lines:
            coords = list(self.canvas.coords(line))
            dist = self.point_to_line_distance(x, y, coords[0], coords[1], coords[2], coords[3])
            if dist < min_distance:
                min_distance = dist
                closest_line = line
                
        if not closest_line:
            return
            
        item_id = closest_line
        
        if self.fillet_state == 'first_line':
            if item_id not in self.selected_lines:
                self.clear_selection()
                self.original_colors[item_id] = self.canvas.itemcget(item_id, 'fill')
                self.original_widths[item_id] = self.canvas.itemcget(item_id, 'width')
                self.selected_lines.append(item_id)
                self.canvas.itemconfig(item_id, fill='red', width=2)
                self.fillet_state = 'second_line'
                
        elif self.fillet_state == 'second_line':
            if item_id not in self.selected_lines:
                # Find intersection before accepting second line
                line1_coords = list(self.canvas.coords(self.selected_lines[0]))
                line2_coords = list(self.canvas.coords(item_id))
                intersection = self.find_line_intersection(
                    line1_coords[0], line1_coords[1], line1_coords[2], line1_coords[3],
                    line2_coords[0], line2_coords[1], line2_coords[2], line2_coords[3]
                )
                
                if intersection:
                    self.original_colors[item_id] = self.canvas.itemcget(item_id, 'fill')
                    self.original_widths[item_id] = self.canvas.itemcget(item_id, 'width')
                    self.selected_lines.append(item_id)
                    self.canvas.itemconfig(item_id, fill='red', width=2)
                    self.selected_vertex = intersection
                    
                    # Both lines are selected and intersection found, execute fillet
                    self.execute_fillet()
                else:
                    messagebox.showerror("Error", "The selected lines do not intersect")

    def execute_fillet(self):
        """Execute the fillet operation on selected lines"""
        try:
            self.clear_debug()
            # Get the radius in mm (unscaled)
            radius_mm = float(self.radius_entry.get())
            if radius_mm <= 0:
                raise ValueError("Radius must be positive")
            
            # Save state BEFORE making any changes
            save_canvas_state()
            
            # Get current scale and apply it to radius
            self.scale_factor = self.get_scale_factor()
            print(f"\nDEBUG FILLET:")
            print(f"Input radius (mm): {radius_mm}")
            print(f"Scale factor: {self.scale_factor}")
            
            # Scale the radius by the current zoom level
            radius = radius_mm * self.scale_factor
            print(f"Final scaled radius (pixels): {radius}")
            
            x_int, y_int = self.selected_vertex
            line1_coords = list(self.canvas.coords(self.selected_lines[0]))
            line2_coords = list(self.canvas.coords(self.selected_lines[1]))

            # Calculate vectors pointing AWAY from intersection
            v1x = line1_coords[2] - line1_coords[0]
            v1y = line1_coords[3] - line1_coords[1]  # Note: y increases downward
            v2x = line2_coords[2] - line2_coords[0]
            v2y = line2_coords[3] - line2_coords[1]  # Note: y increases downward
            
            # Normalize vectors
            len1 = math.sqrt(v1x*v1x + v1y*v1y)
            len2 = math.sqrt(v2x*v2x + v2y*v2y)
            v1x, v1y = v1x/len1, v1y/len1
            v2x, v2y = v2x/len2, v2y/len2
            
            # Make vectors point away from intersection
            if (x_int - line1_coords[0])*v1x + (y_int - line1_coords[1])*v1y > 0:
                v1x, v1y = -v1x, -v1y
                line1_keep_end = (line1_coords[0], line1_coords[1])
            else:
                line1_keep_end = (line1_coords[2], line1_coords[3])
                
            if (x_int - line2_coords[0])*v2x + (y_int - line2_coords[1])*v2y > 0:
                v2x, v2y = -v2x, -v2y
                line2_keep_end = (line2_coords[0], line2_coords[1])
            else:
                line2_keep_end = (line2_coords[2], line2_coords[3])

            # Calculate angle between vectors
            dot_product = v1x*v2x + v1y*v2y
            angle = math.acos(max(min(dot_product, 1), -1))
            if angle < 0.1:
                raise ValueError("Lines are too close to parallel for filleting")

            # Determine if this is an internal or external corner
            cross_product = v1x * v2y - v1y * v2x
            is_internal = cross_product < 0

            # Calculate tangent distance
            tan_dist = radius / math.tan(angle/2)
            
            # Calculate tangent points
            p1x = x_int + v1x * tan_dist
            p1y = y_int + v1y * tan_dist
            p2x = x_int + v2x * tan_dist
            p2y = y_int + v2y * tan_dist
            
            # Calculate center point using perpendicular vector
            # For canvas coordinates (y increases downward):
            if is_internal:
                perp_x = v1y  # For internal corners
                perp_y = -v1x
            else:
                perp_x = -v1y  # For external corners
                perp_y = v1x
            
            center_x = p1x + radius * perp_x
            center_y = p1y + radius * perp_y
            
            # Mirror the center point and tangent points along the horizontal axis
            # For canvas coordinates, we need to mirror in the opposite direction
            center_y = y_int + (center_y - y_int)  # Changed from - to +
            p1y = y_int + (p1y - y_int)           # Changed from - to +
            p2y = y_int + (p2y - y_int)           # Changed from - to +
            
            # Calculate arc angles for canvas coordinates
            start_angle = math.degrees(math.atan2(-(p1y - center_y), p1x - center_x))
            end_angle = math.degrees(math.atan2(-(p2y - center_y), p2x - center_x))
            
            # Calculate arc extent based on corner type and canvas coordinates
            extent = end_angle - start_angle
            if is_internal:
                if extent > 0:
                    extent -= 360
                if extent < -180:
                    extent += 360
            else:
                if extent < 0:
                    extent += 360
                if extent > 180:
                    extent -= 360
            
            # Get original line properties
            line1_width = self.original_widths[self.selected_lines[0]]
            line2_width = self.original_widths[self.selected_lines[1]]
            line1_color = self.original_colors[self.selected_lines[0]]
            line2_color = self.original_colors[self.selected_lines[1]]
            
            # Delete original lines
            self.canvas.delete(self.selected_lines[0])
            self.canvas.delete(self.selected_lines[1])
            
            # Create new trimmed lines with original properties
            new_line1 = self.canvas.create_line(
                p1x, p1y,
                line1_keep_end[0], line1_keep_end[1],
                width=line1_width,
                fill=line1_color,
                tags=('line', 'shape', 'all_lines', self.get_next_shape_id())
            )
            
            new_line2 = self.canvas.create_line(
                p2x, p2y,
                line2_keep_end[0], line2_keep_end[1],
                width=line2_width,
                fill=line2_color,
                tags=('line', 'shape', 'all_lines', self.get_next_shape_id())
            )
            
            # Create arc with same properties as first line
            arc = self.canvas.create_arc(
                center_x - radius, center_y - radius,
                center_x + radius, center_y + radius,
                start=start_angle, extent=extent,
                style='arc',
                width=line1_width,
                outline=line1_color,
                tags=('arc', 'shape', 'all_lines', self.get_next_shape_id())
            )

            # Create center marker (cross)
            marker_size = 3 * self.scale_factor  # Scale size with canvas but keep line width fixed
            # Horizontal line of cross
            center_marker_h = self.canvas.create_line(
                center_x - marker_size, center_y,
                center_x + marker_size, center_y,
                width=1,  # Fixed 1px width
                fill='#0066ff',  # Blue color
                tags=('permanent_center_marker', 'no_engrave')
            )
            # Vertical line of cross
            center_marker_v = self.canvas.create_line(
                center_x, center_y - marker_size,
                center_x, center_y + marker_size,
                width=1,  # Fixed 1px width
                fill='#0066ff',  # Blue color
                tags=('permanent_center_marker', 'no_engrave')
            )

            # Add new elements to the active layer
            if hasattr(self.canvas, 'active_layer'):
                active_layer = self.canvas.active_layer
                for item in [new_line1, new_line2, arc]:  # Don't add center markers to layer
                    self.canvas.addtag_withtag(f'layer{active_layer}', item)
                    # Add to canvas's shape list if it exists
                    if hasattr(self.canvas, 'shapes'):
                        self.canvas.shapes.append(item)

            # Create a group for the fillet elements
            group_tag = f'fillet_group_{new_line1}'
            for item in [new_line1, new_line2, arc]:
                self.canvas.addtag_withtag(group_tag, item)
                # Enable selection and movement through canvas bindings
                self.canvas.tag_bind(item, '<Button-1>', lambda e, i=item: self.canvas.event_generate('<<ShapeClicked>>', when='tail'))

            # Save canvas state AFTER successful operation
            save_canvas_state()

            # Update layers window if it exists
            if hasattr(self.parent, 'layers_window') and self.parent.layers_window:
                self.parent.layers_window.update_layer_items()

            self.clear_selection()
            self.fillet_state = 'first_line'
            
        except ValueError as e:
            tk.messagebox.showerror("Error", str(e))
            self.clear_debug()
            self.clear_selection()
            self.fillet_state = 'first_line'

    def activate_chamfer(self):
        """Activate chamfer mode for line selection and chamfering"""
        # Deactivate main app's selection mode if active
        if hasattr(self.parent, 'is_selecting') and self.parent.is_selecting:
            self.parent.toggle_select()
        
        # Deactivate other tools in main app
        if hasattr(self.parent, 'deactivate_all_tools'):
            self.parent.deactivate_all_tools()
        
        # Set tool state in main app
        if hasattr(self.parent, 'current_tool'):
            self.parent.current_tool = 'chamfer'
        
        self.clear_selection()  # Clear any existing selection
        self.canvas.config(cursor="crosshair")
        
        # Update button state
        self.set_active_tool('chamfer')
        
        # Initialize chamfer state
        self.chamfer_state = 'first_line'
        
        # Bind canvas events for selection
        self.canvas.unbind('<Button-1>')
        self.canvas.bind('<Button-1>', self.on_chamfer_select)

    def on_chamfer_select(self, event):
        """Handle line selection for chamfering"""
        x = self.canvas.canvasx(event.x)
        y = self.canvas.canvasy(event.y)
        self.scale_factor = self.get_scale_factor()
        tolerance = 10 / self.scale_factor
        
        # Find overlapping items
        items = self.canvas.find_overlapping(x-tolerance, y-tolerance, x+tolerance, y+tolerance)
        
        # Filter for valid lines - exclude grid lines and utility elements
        exclude_tags = ['grid_lines', 'below_all', 'above_all', 'snap_point', 'snap_line', 
                       'temp_marker', 'radius_marker', 'center_marker', 'temp', 
                       'guide_point', 'guide_line', 'crosshair', 'machine_pos']
        
        lines = []
        for item in items:
            if self.canvas.type(item) == 'line':
                tags = self.canvas.gettags(item)
                if not any(tag in tags for tag in exclude_tags):
                    lines.append(item)
        
        if not lines:
            return
            
        # Find the closest line to the click point
        closest_line = None
        min_distance = float('inf')
        for line in lines:
            coords = list(self.canvas.coords(line))
            dist = self.point_to_line_distance(x, y, coords[0], coords[1], coords[2], coords[3])
            if dist < min_distance:
                min_distance = dist
                closest_line = line
                
        if not closest_line:
            return
            
        item_id = closest_line
        
        if self.chamfer_state == 'first_line':
            if item_id not in self.selected_lines:
                self.clear_selection()
                self.original_colors[item_id] = self.canvas.itemcget(item_id, 'fill')
                self.original_widths[item_id] = self.canvas.itemcget(item_id, 'width')
                self.selected_lines.append(item_id)
                self.canvas.itemconfig(item_id, fill='red', width=2)
                self.chamfer_state = 'second_line'
                
        elif self.chamfer_state == 'second_line':
            if item_id not in self.selected_lines:
                # Find intersection before accepting second line
                line1_coords = list(self.canvas.coords(self.selected_lines[0]))
                line2_coords = list(self.canvas.coords(item_id))
                intersection = self.find_line_intersection(
                    line1_coords[0], line1_coords[1], line1_coords[2], line1_coords[3],
                    line2_coords[0], line2_coords[1], line2_coords[2], line2_coords[3]
                )
                
                if intersection:
                    self.original_colors[item_id] = self.canvas.itemcget(item_id, 'fill')
                    self.original_widths[item_id] = self.canvas.itemcget(item_id, 'width')
                    self.selected_lines.append(item_id)
                    self.canvas.itemconfig(item_id, fill='red', width=2)
                    self.selected_vertex = intersection
                    
                    # Both lines are selected and intersection found, execute chamfer
                    self.execute_chamfer()
                else:
                    messagebox.showerror("Error", "The selected lines do not intersect")

    def execute_chamfer(self):
        """Execute the chamfer operation on selected lines"""
        try:
            self.clear_debug()
            # Get the chamfer size in mm (unscaled)
            chamfer_size_mm = float(self.radius_entry.get())
            if chamfer_size_mm <= 0:
                raise ValueError("Chamfer size must be positive")
            
            # Save state BEFORE making any changes
            save_canvas_state()
            
            # Get current scale and apply it to chamfer size
            self.scale_factor = self.get_scale_factor()
            print(f"\nDEBUG CHAMFER:")
            print(f"Input size (mm): {chamfer_size_mm}")
            print(f"Scale factor: {self.scale_factor}")
            
            # Scale the chamfer size by the current zoom level
            chamfer_size = chamfer_size_mm * self.scale_factor
            print(f"Final scaled size (pixels): {chamfer_size}")
            
            x_int, y_int = self.selected_vertex
            line1_coords = list(self.canvas.coords(self.selected_lines[0]))
            line2_coords = list(self.canvas.coords(self.selected_lines[1]))

            # Calculate vectors pointing AWAY from intersection
            v1x = line1_coords[2] - line1_coords[0]
            v1y = line1_coords[3] - line1_coords[1]
            v2x = line2_coords[2] - line2_coords[0]
            v2y = line2_coords[3] - line2_coords[1]
            
            # Normalize vectors
            len1 = math.sqrt(v1x*v1x + v1y*v1y)
            len2 = math.sqrt(v2x*v2x + v2y*v2y)
            v1x, v1y = v1x/len1, v1y/len1
            v2x, v2y = v2x/len2, v2y/len2
            
            # Make vectors point away from intersection
            if (x_int - line1_coords[0])*v1x + (y_int - line1_coords[1])*v1y > 0:
                v1x, v1y = -v1x, -v1y
                line1_keep_end = (line1_coords[0], line1_coords[1])
            else:
                line1_keep_end = (line1_coords[2], line1_coords[3])
                
            if (x_int - line2_coords[0])*v2x + (y_int - line2_coords[1])*v2y > 0:
                v2x, v2y = -v2x, -v2y
                line2_keep_end = (line2_coords[0], line2_coords[1])
            else:
                line2_keep_end = (line2_coords[2], line2_coords[3])

            # Calculate angle between vectors
            dot_product = v1x*v2x + v1y*v2y
            angle = math.acos(max(min(dot_product, 1), -1))
            if angle < 0.1:
                raise ValueError("Lines are too close to parallel for chamfering")

            # Calculate chamfer points
            p1x = x_int + v1x * chamfer_size
            p1y = y_int + v1y * chamfer_size
            p2x = x_int + v2x * chamfer_size
            p2y = y_int + v2y * chamfer_size
            
            # Get original line properties
            line1_width = self.original_widths[self.selected_lines[0]]
            line2_width = self.original_widths[self.selected_lines[1]]
            line1_color = self.original_colors[self.selected_lines[0]]
            line2_color = self.original_colors[self.selected_lines[1]]
            
            # Delete original lines
            self.canvas.delete(self.selected_lines[0])
            self.canvas.delete(self.selected_lines[1])
            
            # Create new trimmed lines with original properties
            new_line1 = self.canvas.create_line(
                p1x, p1y,
                line1_keep_end[0], line1_keep_end[1],
                width=line1_width,
                fill=line1_color,
                tags=('line', 'shape', 'all_lines', self.get_next_shape_id())
            )
            
            new_line2 = self.canvas.create_line(
                p2x, p2y,
                line2_keep_end[0], line2_keep_end[1],
                width=line2_width,
                fill=line2_color,
                tags=('line', 'shape', 'all_lines', self.get_next_shape_id())
            )
            
            # Create chamfer line with same properties as first line
            chamfer_line = self.canvas.create_line(
                p1x, p1y,
                p2x, p2y,
                width=line1_width,
                fill=line1_color,
                tags=('line', 'shape', 'all_lines', self.get_next_shape_id())
            )

            # Add new elements to the active layer
            if hasattr(self.canvas, 'active_layer'):
                active_layer = self.canvas.active_layer
                for item in [new_line1, new_line2, chamfer_line]:
                    self.canvas.addtag_withtag(f'layer{active_layer}', item)
                    # Add to canvas's shape list if it exists
                    if hasattr(self.canvas, 'shapes'):
                        self.canvas.shapes.append(item)

            # Create a group for the chamfer elements
            group_tag = f'chamfer_group_{new_line1}'
            for item in [new_line1, new_line2, chamfer_line]:
                self.canvas.addtag_withtag(group_tag, item)
                # Enable selection and movement through canvas bindings
                self.canvas.tag_bind(item, '<Button-1>', lambda e, i=item: self.canvas.event_generate('<<ShapeClicked>>', when='tail'))

            # Save canvas state AFTER successful operation
            save_canvas_state()

            # Update layers window if it exists
            if hasattr(self.parent, 'layers_window') and self.parent.layers_window:
                self.parent.layers_window.update_layer_items()

            self.clear_selection()
            self.chamfer_state = 'first_line'
            
        except ValueError as e:
            tk.messagebox.showerror("Error", str(e))
            self.clear_debug()
            self.clear_selection()
            self.chamfer_state = 'first_line'

    def activate_trim(self):
        """Activate trim mode for line trimming using selection"""
        # Deactivate main app's selection mode if active
        if hasattr(self.parent, 'is_selecting') and self.parent.is_selecting:
            self.parent.toggle_select()
        
        # Deactivate other tools in main app
        if hasattr(self.parent, 'deactivate_all_tools'):
            self.parent.deactivate_all_tools()
        
        # Set tool state in main app
        if hasattr(self.parent, 'current_tool'):
            self.parent.current_tool = 'trim'
        
        self.clear_selection()  # Clear any existing selection
        self.canvas.config(cursor="crosshair")
        
        # Update button state
        self.set_active_tool('trim')
            
        # Initialize trim state
        self.trim_state = 'first_line'
        self.trim_intersection = None
        
        # Bind canvas events for selection
        self.canvas.unbind('<Button-1>')
        self.canvas.bind('<Button-1>', self.on_trim_select)

    def activate_trim_mid(self):
        """Activate trim-mid mode for trimming segments between intersections"""
        # Deactivate main app's selection mode if active
        if hasattr(self.parent, 'is_selecting') and self.parent.is_selecting:
            self.parent.toggle_select()
        
        # Deactivate other tools in main app
        if hasattr(self.parent, 'deactivate_all_tools'):
            self.parent.deactivate_all_tools()
        
        # Set tool state in main app
        if hasattr(self.parent, 'current_tool'):
            self.parent.current_tool = 'trim_mid'
        
        self.clear_selection()  # Clear any existing selection
        self.canvas.config(cursor="crosshair")
        
        # Update button state
        self.set_active_tool('trim_mid')
        
        # Initialize trim-mid state
        self.trim_state = 'first_line'
        
        # Bind canvas events for selection
        self.canvas.unbind('<Button-1>')
        self.canvas.unbind('<Button-3>')
        self.canvas.bind('<Button-1>', self.on_trim_mid_select)
        self.canvas.bind('<Button-3>', self.on_trim_mid_deselect)

    def on_trim_mid_deselect(self, event):
        """Handle right-click deselection for trim-mid operation"""
        self.clear_selection()
        self.trim_state = 'first_line'
        if hasattr(self, 'boundary_shape_ids'):
            self.boundary_shape_ids.clear()
        if hasattr(self, 'processed_coords'):
            self.processed_coords.clear()
        
        # Reset any highlighted lines
        for item in self.canvas.find_all():
            if self.canvas.type(item) == 'line':
                tags = self.canvas.gettags(item)
                if 'boundary_line' in tags:
                    self.canvas.itemconfig(item, fill='black', width=1)
                    self.canvas.dtag(item, 'boundary_line')

    def on_trim_select(self, event):
        """Handle line selection for trimming"""
        x = self.canvas.canvasx(event.x)
        y = self.canvas.canvasy(event.y)
        self.scale_factor = self.get_scale_factor()
        tolerance = 10 * self.scale_factor  # Increased tolerance for easier selection
        items = self.canvas.find_overlapping(x-tolerance, y-tolerance, x+tolerance, y+tolerance)
        
        # Filter out grid lines and utility elements
        exclude_tags = ['grid_lines', 'below_all', 'above_all', 'snap_point', 'snap_line', 
                       'temp_marker', 'radius_marker', 'permanent_center_marker', 'temp', 
                       'guide_point', 'guide_line', 'crosshair', 'machine_pos']
        
        lines = []
        for item in items:
            if self.canvas.type(item) == 'line':
                tags = self.canvas.gettags(item)
                if not any(tag in tags for tag in exclude_tags):
                    lines.append(item)
        
        if not lines:
            return
            
        # Find the closest line to the click point
        closest_line = None
        min_distance = float('inf')
        for line in lines:
            coords = list(self.canvas.coords(line))
            # Calculate distance from click to line segment
            dist = self.point_to_line_distance(x, y, coords[0], coords[1], coords[2], coords[3])
            if dist < min_distance:
                min_distance = dist
                closest_line = line
                
        if not closest_line:
            return
            
        item_id = closest_line
        
        if self.trim_state == 'first_line':
            if item_id not in self.selected_lines:
                self.clear_selection()
                self.original_colors[item_id] = self.canvas.itemcget(item_id, 'fill')
                self.original_widths[item_id] = self.canvas.itemcget(item_id, 'width')
                self.selected_lines.append(item_id)
                self.canvas.itemconfig(item_id, fill='red', width=2)
                self.trim_state = 'second_line'
                
        elif self.trim_state == 'second_line':
            if item_id not in self.selected_lines:
                # Find intersection before accepting second line
                line1_coords = list(self.canvas.coords(self.selected_lines[0]))
                line2_coords = list(self.canvas.coords(item_id))
                intersection = self.find_line_intersection(
                    line1_coords[0], line1_coords[1], line1_coords[2], line1_coords[3],
                    line2_coords[0], line2_coords[1], line2_coords[2], line2_coords[3]
                )
                
                if intersection:
                    self.trim_intersection = intersection
                    self.original_colors[item_id] = self.canvas.itemcget(item_id, 'fill')
                    self.original_widths[item_id] = self.canvas.itemcget(item_id, 'width')
                    self.selected_lines.append(item_id)
                    self.canvas.itemconfig(item_id, fill='red', width=2)
                    self.trim_state = 'select_segment'
                else:
                    messagebox.showerror("Error", "The selected lines do not intersect")
                    
        elif self.trim_state == 'select_segment':
            if item_id in self.selected_lines:
                # Store the click coordinates and line for trimming
                self.trim_click = (x, y)
                # Store original line state for undo
                self.store_line_state(item_id)
                # Highlight the clicked line in green temporarily
                self.canvas.itemconfig(item_id, fill='green', width=2)
                self.canvas.after(100, lambda: self.execute_trim(item_id))

    def on_trim_mid_select(self, event):
        """Handle line selection for trim-mid operation"""
        x = self.canvas.canvasx(event.x)
        y = self.canvas.canvasy(event.y)
        self.scale_factor = self.get_scale_factor()
        tolerance = 10 / self.scale_factor  # Use same tolerance as fillet tool
        
        # Find overlapping items
        items = self.canvas.find_overlapping(x-tolerance, y-tolerance, x+tolerance, y+tolerance)
        
        # Filter out utility elements - allow trimmed lines
        exclude_tags = ['grid_lines', 'below_all', 'above_all', 'snap_point', 'snap_line', 
                       'temp_marker', 'radius_marker', 'permanent_center_marker', 'temp', 
                       'guide_point', 'guide_line', 'crosshair', 'machine_pos']
        
        # Track base shape IDs of selected boundary lines
        if not hasattr(self, 'boundary_shape_ids'):
            self.boundary_shape_ids = set()
        
        # Initialize processed_coords set if it doesn't exist
        if not hasattr(self, 'processed_coords'):
            self.processed_coords = set()
            
        # Find all valid lines first
        lines = []
        for item in items:
            if self.canvas.type(item) == 'line':
                tags = self.canvas.gettags(item)
                if not any(tag in tags for tag in exclude_tags):
                    # For boundary line selection, don't allow selecting the same line twice
                    if self.trim_state in ['first_line', 'second_line']:
                        if item not in self.selected_lines:
                            lines.append(item)
                    else:  # For crossing line selection
                        shape_id = self.get_shape_id_from_tags(tags)
                        if shape_id:
                            base_id = self.get_base_shape_id(shape_id)
                            # Only add if base ID is different from boundary lines
                            if base_id not in self.boundary_shape_ids:
                                lines.append(item)
        
        if not lines:
            return
            
        # Find the closest line
        closest_line = None
        min_distance = float('inf')
        for line in lines:
            coords = list(self.canvas.coords(line))
            dist = self.point_to_line_distance(x, y, coords[0], coords[1], coords[2], coords[3])
            if dist < min_distance:
                min_distance = dist
                closest_line = line
                
        if not closest_line:
            return
            
        item_id = closest_line
        current_coords = tuple(self.canvas.coords(item_id))
        
        if self.trim_state == 'first_line':
            self.clear_selection()
            # Store the base shape ID of the first boundary line
            tags = self.canvas.gettags(item_id)
            shape_id = self.get_shape_id_from_tags(tags)
            if shape_id:
                base_id = self.get_base_shape_id(shape_id)
                if base_id is not None:
                    self.boundary_shape_ids.add(base_id)
            
            self.original_colors[item_id] = self.canvas.itemcget(item_id, 'fill')
            self.original_widths[item_id] = self.canvas.itemcget(item_id, 'width')
            self.selected_lines.append(item_id)
            self.canvas.itemconfig(item_id, fill='red', width=2)
            self.canvas.addtag_withtag('boundary_line', item_id)
            self.trim_state = 'second_line'
            
        elif self.trim_state == 'second_line':
            # Store the base shape ID of the second boundary line
            tags = self.canvas.gettags(item_id)
            shape_id = self.get_shape_id_from_tags(tags)
            if shape_id:
                base_id = self.get_base_shape_id(shape_id)
                if base_id is not None:
                    self.boundary_shape_ids.add(base_id)
            
            self.original_colors[item_id] = self.canvas.itemcget(item_id, 'fill')
            self.original_widths[item_id] = self.canvas.itemcget(item_id, 'width')
            self.selected_lines.append(item_id)
            self.canvas.itemconfig(item_id, fill='red', width=2)
            self.canvas.addtag_withtag('boundary_line', item_id)
            self.trim_state = 'trim_crossing'
            
        elif self.trim_state == 'trim_crossing':
            if item_id not in self.selected_lines and current_coords not in self.processed_coords:
                # Execute trim operation
                self.execute_trim_mid(item_id)

    def store_line_state(self, line_id):
        """Store the original state of a line for undo/redo"""
        if not hasattr(self, 'trim_history'):
            self.trim_history = []
        
        # Store the original line's properties
        coords = self.canvas.coords(line_id)
        tags = self.canvas.gettags(line_id)
        state = {
            'line_id': line_id,
            'coords': coords,
            'width': self.original_widths[line_id],
            'color': self.original_colors[line_id],
            'tags': tags
        }
        self.trim_history.append(state)

    def execute_trim(self, line_to_trim):
        """Execute the trim operation on selected lines"""
        try:
            # Save state BEFORE making any changes
            save_canvas_state()
            
            # Get coordinates of the line to trim
            line_coords = list(self.canvas.coords(line_to_trim))
            click_x, click_y = self.trim_click  # Use stored click coordinates
            
            # Get original properties
            line_width = self.original_widths[line_to_trim]
            line_color = self.original_colors[line_to_trim]
            
            # Calculate distances from click to endpoints
            d1 = math.sqrt((click_x - line_coords[0])**2 + (click_y - line_coords[1])**2)  # Distance to start
            d2 = math.sqrt((click_x - line_coords[2])**2 + (click_y - line_coords[3])**2)  # Distance to end
            
            # Simply keep the segment opposite to where the user clicked
            if d1 < d2:  # Click is closer to start point, so keep end segment
                new_line = self.canvas.create_line(
                    self.trim_intersection[0], self.trim_intersection[1],
                    line_coords[2], line_coords[3],
                    width=line_width,
                    fill=line_color,
                    tags=('line', 'shape', 'all_lines', self.get_next_shape_id())
                )
            else:  # Click is closer to end point, so keep start segment
                new_line = self.canvas.create_line(
                    line_coords[0], line_coords[1],
                    self.trim_intersection[0], self.trim_intersection[1],
                    width=line_width,
                    fill=line_color,
                    tags=('line', 'shape', 'all_lines', self.get_next_shape_id())
                )
            
            # Add new line to active layer
            if hasattr(self.canvas, 'active_layer'):
                active_layer = self.canvas.active_layer
                self.canvas.addtag_withtag(f'layer{active_layer}', new_line)
                if hasattr(self.canvas, 'shapes'):
                    self.canvas.shapes.append(new_line)

            # Enable selection and movement through canvas bindings
            self.canvas.tag_bind(new_line, '<Button-1>', 
                lambda e, i=new_line: self.canvas.event_generate('<<ShapeClicked>>', when='tail'))
            
            # Delete original line
            self.canvas.delete(line_to_trim)
            
            # Save canvas state AFTER successful operation
            save_canvas_state()

            # Update layers window if it exists
            if hasattr(self.parent, 'layers_window') and self.parent.layers_window:
                self.parent.layers_window.update_layer_items()

            # Reset selection and state
            self.clear_selection()
            self.trim_state = 'first_line'
            self.trim_intersection = None
            self.trim_click = None
            
        except Exception as e:
            messagebox.showerror("Error", str(e))
            self.clear_selection()
            self.trim_state = 'first_line'
            self.trim_intersection = None
            self.trim_click = None

    def find_line_intersection(self, x1, y1, x2, y2, x3, y3, x4, y4):
        """Find intersection point of two line segments if it exists"""
        # First check normal intersection
        denominator = ((x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4))
        if abs(denominator) > 1e-10:  # Not parallel
            t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denominator
            u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denominator
            
            if 0 <= t <= 1 and 0 <= u <= 1:
                x = x1 + t * (x2 - x1)
                y = y1 + t * (y2 - y1)
                return (x, y)

        # If no normal intersection, check for T-intersection
        # Check if any endpoint of line2 lies on line1
        tolerance = 1e-6  # Small tolerance for floating point comparison
        
        # Check endpoints of line2 on line1
        if self.point_on_line(x3, y3, x1, y1, x2, y2, tolerance):
            return (x3, y3)
        if self.point_on_line(x4, y4, x1, y1, x2, y2, tolerance):
            return (x4, y4)
            
        # Check endpoints of line1 on line2
        if self.point_on_line(x1, y1, x3, y3, x4, y4, tolerance):
            return (x1, y1)
        if self.point_on_line(x2, y2, x3, y3, x4, y4, tolerance):
            return (x2, y2)
            
        return None

    def point_on_line(self, px, py, x1, y1, x2, y2, tolerance):
        """Check if point (px,py) lies on line segment from (x1,y1) to (x2,y2)"""
        # Vector from line start to point
        vx = px - x1
        vy = py - y1
        # Vector from line start to line end
        ux = x2 - x1
        uy = y2 - y1
        # Length of line segment squared
        length_sq = ux*ux + uy*uy
        if length_sq == 0:
            return False
        # Project point onto line
        t = (vx*ux + vy*uy) / length_sq
        if t < 0 or t > 1:
            return False
        # Calculate closest point on line
        projx = x1 + t * ux
        projy = y1 + t * uy
        # Check if point is close enough to line
        dx = px - projx
        dy = py - projy
        dist_sq = dx*dx + dy*dy
        return dist_sq <= tolerance * tolerance

    def get_scale_factor(self):
        """Get current canvas scale factor from zoom dropdown"""
        try:
            # Get the root window
            root = self.parent.winfo_toplevel()
            
            # Find the zoom OptionMenu
            for child in root.winfo_children():
                if isinstance(child, tk.OptionMenu):
                    # Get the StringVar associated with the OptionMenu
                    scale_var = child.cget('textvariable')
                    if scale_var:
                        scale_text = root.getvar(scale_var)
                        print(f"\nDEBUG Scale:")
                        print(f"Found zoom menu: {child}")
                        print(f"Scale text: {scale_text}")
                        
                        # Convert percentage to float (e.g., "500%" -> 5.0)
                        scale_text = scale_text.replace('%', '')
                        scale = float(scale_text) / 100.0
                        print(f"Calculated scale factor: {scale}")
                        return scale
            
            print("Warning: Could not find zoom OptionMenu")
            return 1.0
        except (AttributeError, ValueError) as e:
            print(f"Warning: Scale factor error ({str(e)}). Using default scale.")
            return 1.0

    def debug_draw_point(self, x, y, color='blue', size=3, tags='debug'):
        """Draw a debug point on the canvas"""
        if self.debug_mode:
            self.canvas.create_oval(
                x - size, y - size,
                x + size, y + size,
                fill=color, outline=color, tags=tags
            )

    def debug_draw_line(self, x1, y1, x2, y2, color='blue', tags='debug'):
        """Draw a debug line on the canvas"""
        if self.debug_mode:
            self.canvas.create_line(x1, y1, x2, y2, fill=color, tags=tags)

    def clear_debug(self):
        """Clear debug visualizations"""
        if self.debug_mode:
            self.canvas.delete('debug')

    def show_tools_window(self):
        """Display the line editing tools window"""
        # Re-initialize undo/redo system when tools window is opened
        from undoredo import set_canvas, set_grid_var, set_scale_var, set_grid_size_var, init_canvas_history
        
        # Set canvas reference for undo/redo system
        set_canvas(self.canvas)
        
        # Set grid variable if it exists in parent
        if hasattr(self.parent, 'grid_var'):
            set_grid_var(self.parent.grid_var)
        
        # Set scale variable if it exists in parent
        if hasattr(self.parent, 'scale_var'):
            set_scale_var(self.parent.scale_var)
        
        # Set grid size variable if it exists in parent
        if hasattr(self.parent, 'grid_size_var'):
            set_grid_size_var(self.parent.grid_size_var)
        
        # Initialize undo/redo history
        init_canvas_history()
        
        if self.tools_window is None or not tk.Toplevel.winfo_exists(self.tools_window):
            self.tools_window = tk.Toplevel(self.parent)
            self.tools_window.title("Line Editor Tools")
            self.tools_window.geometry("200x450")  # Increased height for new controls
            self.tools_window.resizable(False, False)
            self.tools_window.configure(bg="#263d42")  # Match main app background
            self.tools_window.attributes('-topmost', True)  # Make window stay on top
            
            # Create custom styles
            style = ttk.Style()
            style.configure('Dark.TFrame', background='#263d42')
            style.configure('Dark.TLabel', 
                          background='#263d42',
                          foreground='white')
            style.configure('Dark.TEntry',
                          fieldbackground='white',  # Changed to white background
                          foreground='black',       # Changed to black text
                          insertcolor='black')      # Changed cursor color to black
            
            # Main label
            label = tk.Label(self.tools_window, text="Line Editor Tools", 
                           fg="white", bg="#263d42")
            label.pack(pady=10)
            
            # Frame for radius input
            radius_frame = ttk.Frame(self.tools_window, style='Dark.TFrame')
            radius_frame.pack(pady=5, padx=5, fill='x')
            
            ttk.Label(radius_frame, text="Size (mm):", 
                     style='Dark.TLabel').pack(side='left', padx=5)
            self.radius_entry = ttk.Entry(radius_frame, width=10, style='Dark.TEntry')
            self.radius_entry.insert(0, "20.0")  # Default size
            self.radius_entry.pack(side='left', padx=5)
            
            # Store button references
            self.tool_buttons = {}
            
            # Button style configuration
            button_config = {
                'bd': 2,
                'height': 1,
                'width': 14,
                'fg': 'white',
                'bg': '#263d42',
                'activebackground': '#2ecc71',  # Green color when pressed
                'activeforeground': 'white',
                'relief': 'raised'  # Default state is raised
            }
            
            # Fillet button (now first button)
            self.tool_buttons['fillet'] = tk.Button(
                self.tools_window,
                text="Fillet",
                command=self.activate_fillet,
                **button_config
            )
            self.tool_buttons['fillet'].pack(pady=5, padx=5, fill='x')
            
            # Chamfer button
            self.tool_buttons['chamfer'] = tk.Button(
                self.tools_window,
                text="Chamfer",
                command=self.activate_chamfer,
                **button_config
            )
            self.tool_buttons['chamfer'].pack(pady=5, padx=5, fill='x')
            
            # Trim button
            self.tool_buttons['trim'] = tk.Button(
                self.tools_window,
                text="Trim",
                command=self.activate_trim,
                **button_config
            )
            self.tool_buttons['trim'].pack(pady=5, padx=5, fill='x')
            
            # TrimMid button
            self.tool_buttons['trim_mid'] = tk.Button(
                self.tools_window,
                text="TrimMid",
                command=self.activate_trim_mid,
                **button_config
            )
            self.tool_buttons['trim_mid'].pack(pady=5, padx=5, fill='x')
            
            # Extend button
            self.tool_buttons['extend'] = tk.Button(
                self.tools_window,
                text="Extend",
                command=self.activate_extend,
                **button_config
            )
            self.tool_buttons['extend'].pack(pady=5, padx=5, fill='x')
            
            # Frame for Adjust Line button and snap checkbox
            adjust_frame = ttk.Frame(self.tools_window)
            adjust_frame.pack(pady=5, padx=5, fill='x')
            adjust_frame.configure(style='Dark.TFrame')
            
            # Adjust Line button
            self.tool_buttons['adjust'] = tk.Button(
                adjust_frame,
                text="Adjust Line",
                command=self.activate_adjust,
                **button_config
            )
            self.tool_buttons['adjust'].pack(side='left', padx=2)
            
            # Snap checkbox with fixed styling
            snap_cb = tk.Checkbutton(adjust_frame, text="Snap", 
                                   variable=self.snap_enabled,
                                   fg="white", bg="#263d42",
                                   selectcolor="#263d42",
                                   activebackground="#263d42",
                                   activeforeground="white")
            snap_cb.configure(highlightthickness=0)  # Remove highlight border
            snap_cb.pack(side='left', padx=2)
            
            # Clear selection button
            self.tool_buttons['clear'] = tk.Button(
                self.tools_window,
                text="Clear Selection",
                command=self.clear_selection,
                **button_config
            )
            self.tool_buttons['clear'].pack(pady=5, padx=5, fill='x')
            
            # Initialize current tool tracking
            self.current_tool = None
            
            # Handle window close
            self.tools_window.protocol("WM_DELETE_WINDOW", self.on_window_close)
            
            # Add angle snap variable
            self.angle_snap = tk.BooleanVar(value=True)
            
            # Frame for Rotate button and angle snap checkbox
            rotate_frame = ttk.Frame(self.tools_window)
            rotate_frame.pack(pady=5, padx=5, fill='x')
            rotate_frame.configure(style='Dark.TFrame')
            
            # Rotate button
            self.tool_buttons['rotate'] = tk.Button(
                rotate_frame,
                text="Rotate",
                command=self.activate_rotate,
                **button_config
            )
            self.tool_buttons['rotate'].pack(side='left', padx=2)
            
            # Angle snap checkbox with fixed styling
            angle_snap_cb = tk.Checkbutton(rotate_frame, text="5° Snap", 
                                         variable=self.angle_snap,
                                         fg="white", bg="#263d42",
                                         selectcolor="#263d42",
                                         activebackground="#263d42",
                                         activeforeground="white")
            angle_snap_cb.configure(highlightthickness=0)  # Remove highlight border
            angle_snap_cb.pack(side='left', padx=2)
            
            # Frame for manual angle input
            angle_input_frame = ttk.Frame(self.tools_window)
            angle_input_frame.pack(pady=5, padx=5, fill='x')
            angle_input_frame.configure(style='Dark.TFrame')
            
            # Label for angle input
            angle_label = ttk.Label(angle_input_frame, text="Angle:", style='Dark.TLabel')
            angle_label.pack(side='left', padx=2)
            
            # Entry for angle input
            self.angle_entry = ttk.Entry(angle_input_frame, width=8, style='Dark.TEntry')
            self.angle_entry.insert(0, "0.0")
            self.angle_entry.pack(side='left', padx=2)
            
            # CCW, Set Point, and CW buttons frame
            rotation_buttons_frame = ttk.Frame(self.tools_window)
            rotation_buttons_frame.pack(pady=2, padx=5, fill='x')
            rotation_buttons_frame.configure(style='Dark.TFrame')
            
            # CCW button
            ccw_btn = tk.Button(rotation_buttons_frame, text="CCW", width=4,
                              command=lambda: self.apply_manual_rotation('ccw'),
                              fg='white', bg='#263d42',
                              activebackground='#2ecc71',
                              activeforeground='white')
            ccw_btn.pack(side='left', padx=2)
            
            # Set Point button
            set_point_btn = tk.Button(rotation_buttons_frame, text="Set Point", width=8,
                           command=self.set_rotation_point,
                           fg='white', bg='#263d42',
                           activebackground='#2ecc71',
                           activeforeground='white')
            set_point_btn.pack(side='left', padx=2)
            
            # CW button
            cw_btn = tk.Button(rotation_buttons_frame, text="CW", width=4,
                             command=lambda: self.apply_manual_rotation('cw'),
                             fg='white', bg='#263d42',
                             activebackground='#2ecc71',
                             activeforeground='white')
            cw_btn.pack(side='left', padx=2)

    def set_active_tool(self, tool_name):
        """Set the active tool and update button states"""
        # Only try to configure buttons if the tools window exists
        if self.tools_window and tk.Toplevel.winfo_exists(self.tools_window):
            # Reset all buttons to raised state with default color
            for name, button in self.tool_buttons.items():
                button.configure(relief='raised', bg='#263d42')
            
            # If we have a new active tool, set its button to sunken state with active color
            if tool_name and tool_name in self.tool_buttons:
                self.tool_buttons[tool_name].configure(relief='sunken', bg='#2ecc71')
        
        self.current_tool = tool_name

    def on_window_close(self):
        """Handle tools window closing"""
        self.deactivate_selection()
        if self.tools_window:
            self.tools_window.destroy()
            self.tools_window = None 

    def point_to_line_distance(self, px, py, x1, y1, x2, y2):
        """Calculate the shortest distance from a point to a line segment"""
        # Vector from line start to point
        vx = px - x1
        vy = py - y1
        # Vector from line start to line end
        ux = x2 - x1
        uy = y2 - y1
        # Length of line segment squared
        length_sq = ux*ux + uy*uy
        if length_sq == 0:
            return math.sqrt(vx*vx + vy*vy)  # Point to point distance
        # Project point onto line segment
        t = max(0, min(1, (vx*ux + vy*uy) / length_sq))
        # Calculate closest point on line
        projx = x1 + t * ux
        projy = y1 + t * uy
        # Return distance to closest point
        dx = px - projx
        dy = py - projy
        return math.sqrt(dx*dx + dy*dy) 

    def activate_extend(self):
        """Activate extend mode for extending lines to boundaries"""
        # Deactivate main app's selection mode if active
        if hasattr(self.parent, 'is_selecting') and self.parent.is_selecting:
            self.parent.toggle_select()
        
        # Deactivate other tools in main app
        if hasattr(self.parent, 'deactivate_all_tools'):
            self.parent.deactivate_all_tools()
        
        # Set tool state in main app
        if hasattr(self.parent, 'current_tool'):
            self.parent.current_tool = 'extend'
        
        self.clear_selection()  # Clear any existing selection
        self.canvas.config(cursor="crosshair")
        
        # Update button state
        self.set_active_tool('extend')
        
        # Initialize extend state
        self.extend_state = 'select_boundary'
        self.boundary_lines = []
        
        # Bind canvas events for selection
        self.canvas.unbind('<Button-1>')
        self.canvas.bind('<Button-1>', self.on_extend_select)

    def on_extend_select(self, event):
        """Handle line selection for extending"""
        x = self.canvas.canvasx(event.x)
        y = self.canvas.canvasy(event.y)
        self.scale_factor = self.get_scale_factor()
        tolerance = 10 * self.scale_factor  # Increased tolerance for easier selection
        items = self.canvas.find_overlapping(x-tolerance, y-tolerance, x+tolerance, y+tolerance)
        
        # Filter out grid lines and utility elements
        exclude_tags = ['grid_lines', 'below_all', 'above_all', 'snap_point', 'snap_line', 
                       'temp_marker', 'radius_marker', 'center_marker', 'temp', 
                       'guide_point', 'guide_line', 'crosshair', 'machine_pos']
        
        lines = []
        for item in items:
            if self.canvas.type(item) == 'line':
                tags = self.canvas.gettags(item)
                if not any(tag in tags for tag in exclude_tags):
                    lines.append(item)
        
        if not lines:
            # Click in empty space - clear selection
            self.clear_selection()
            self.extend_state = 'select_boundary'
            self.boundary_lines = []
            return
            
        # Find the closest line to the click point
        closest_line = None
        min_distance = float('inf')
        for line in lines:
            coords = list(self.canvas.coords(line))
            dist = self.point_to_line_distance(x, y, coords[0], coords[1], coords[2], coords[3])
            if dist < min_distance:
                min_distance = dist
                closest_line = line
                
        if not closest_line:
            return
            
        item_id = closest_line
        
        if self.extend_state == 'select_boundary':
            if item_id not in self.boundary_lines:
                # Store original properties
                self.original_colors[item_id] = self.canvas.itemcget(item_id, 'fill')
                self.original_widths[item_id] = self.canvas.itemcget(item_id, 'width')
                self.boundary_lines.append(item_id)
                self.canvas.itemconfig(item_id, fill='red', width=2)
                
                # After selecting boundary, switch to extend mode
                if len(self.boundary_lines) > 0:
                    self.extend_state = 'extend_lines'
                
        elif self.extend_state == 'extend_lines':
            if item_id not in self.boundary_lines:
                # Get coordinates of the line to extend
                line_coords = list(self.canvas.coords(item_id))
                
                # Find which endpoint is closer to the click
                d1 = math.sqrt((x - line_coords[0])**2 + (y - line_coords[1])**2)
                d2 = math.sqrt((x - line_coords[2])**2 + (y - line_coords[3])**2)
                
                # Get the endpoint to extend and the direction vector
                if d1 < d2:
                    px, py = line_coords[0], line_coords[1]  # Extend from start point
                    vx = line_coords[0] - line_coords[2]  # Direction vector points from end to start
                    vy = line_coords[1] - line_coords[3]
                else:
                    px, py = line_coords[2], line_coords[3]  # Extend from end point
                    vx = line_coords[2] - line_coords[0]  # Direction vector points from start to end
                    vy = line_coords[3] - line_coords[1]
                
                # Normalize direction vector
                length = math.sqrt(vx*vx + vy*vy)
                if length == 0:
                    return
                vx, vy = vx/length, vy/length
                
                # Find intersection with boundary lines
                best_intersection = None
                min_distance = float('inf')
                
                # Extend the line by a large amount in the direction of the vector
                extend_length = 10000  # Large enough to intersect with any reasonable boundary
                extended_x = px + vx * extend_length
                extended_y = py + vy * extend_length
                
                for boundary_id in self.boundary_lines:
                    bound_coords = list(self.canvas.coords(boundary_id))
                    intersection = self.find_line_intersection(
                        px, py, extended_x, extended_y,
                        bound_coords[0], bound_coords[1], bound_coords[2], bound_coords[3]
                    )
                    
                    if intersection:
                        # Calculate distance from point to intersection
                        dist = math.sqrt((intersection[0] - px)**2 + (intersection[1] - py)**2)
                        # Check if this intersection is in the direction we want to extend
                        dot_product = (intersection[0] - px)*vx + (intersection[1] - py)*vy
                        if dot_product > 0 and dist < min_distance:
                            min_distance = dist
                            best_intersection = intersection
                
                if best_intersection:
                    # Store original properties
                    line_width = self.canvas.itemcget(item_id, 'width')
                    line_color = self.canvas.itemcget(item_id, 'fill')
                    
                    # Create new extended line
                    if d1 < d2:  # Extending from start point
                        new_line = self.canvas.create_line(
                            best_intersection[0], best_intersection[1],
                            line_coords[2], line_coords[3],
                            width=line_width,
                            fill=line_color,
                            tags=('line', 'shape', 'all_lines', self.get_next_shape_id())
                        )
                    else:  # Extending from end point
                        new_line = self.canvas.create_line(
                            line_coords[0], line_coords[1],
                            best_intersection[0], best_intersection[1],
                            width=line_width,
                            fill=line_color,
                            tags=('line', 'shape', 'all_lines', self.get_next_shape_id())
                        )
                    
                    # Add new line to active layer
                    if hasattr(self.canvas, 'active_layer'):
                        active_layer = self.canvas.active_layer
                        self.canvas.addtag_withtag(f'layer{active_layer}', new_line)
                        if hasattr(self.canvas, 'shapes'):
                            self.canvas.shapes.append(new_line)
                    
                    # Enable selection and movement through canvas bindings
                    self.canvas.tag_bind(new_line, '<Button-1>', 
                        lambda e, i=new_line: self.canvas.event_generate('<<ShapeClicked>>', when='tail'))
                    
                    # Delete original line
                    self.canvas.delete(item_id)
                    
                    # Save canvas state for undo/redo
                    save_canvas_state()

                    # Update layers window if it exists
                    if hasattr(self.parent, 'layers_window') and self.parent.layers_window:
                        self.parent.layers_window.update_layer_items()
                    
                    # Keep the boundary selection active for more extending
                else:
                    messagebox.showerror("Error", "Could not find a valid extension point") 

    def activate_adjust(self):
        """Activate adjust line mode for modifying line endpoints"""
        # Deactivate main app's selection mode if active
        if hasattr(self.parent, 'is_selecting') and self.parent.is_selecting:
            self.parent.toggle_select()
        
        # Deactivate other tools in main app
        if hasattr(self.parent, 'deactivate_all_tools'):
            self.parent.deactivate_all_tools()
        
        # Set tool state in main app
        if hasattr(self.parent, 'current_tool'):
            self.parent.current_tool = 'adjust'
        
        self.clear_selection()  # Clear any existing selection
        self.canvas.config(cursor="crosshair")
        
        # Update button state
        self.set_active_tool('adjust')
        
        # Bind canvas events for adjustment
        self.canvas.unbind('<Button-1>')
        self.canvas.bind('<Button-1>', self.on_adjust_click)
        self.canvas.bind('<B1-Motion>', self.on_adjust_drag)
        self.canvas.bind('<ButtonRelease-1>', self.on_adjust_release)

    def on_adjust_click(self, event):
        """Handle initial click for line adjustment"""
        x = self.canvas.canvasx(event.x)
        y = self.canvas.canvasy(event.y)
        self.scale_factor = self.get_scale_factor()
        # Increased base tolerance for easier endpoint selection
        base_tolerance = 20  # Increased from 10 to 20 pixels
        line_tolerance = base_tolerance / self.scale_factor  # For finding lines
        endpoint_tolerance = base_tolerance * 1.5 / self.scale_factor  # 50% larger for endpoints
        
        print(f"\nDEBUG Adjust Click:")
        print(f"Click position: ({x}, {y})")
        print(f"Scale factor: {self.scale_factor}")
        print(f"Line tolerance: {line_tolerance}")
        print(f"Endpoint tolerance: {endpoint_tolerance}")
        
        # Find lines near click point using the line tolerance
        items = self.canvas.find_overlapping(x-line_tolerance, y-line_tolerance, x+line_tolerance, y+line_tolerance)
        
        # Filter out grid lines and utility elements
        exclude_tags = ['grid_lines', 'below_all', 'above_all', 'snap_point', 'snap_line', 
                       'temp_marker', 'radius_marker', 'center_marker', 'temp', 
                       'guide_point', 'guide_line', 'crosshair', 'machine_pos']
        
        lines = []
        for item in items:
            if self.canvas.type(item) == 'line':
                tags = self.canvas.gettags(item)
                if not any(tag in tags for tag in exclude_tags):
                    lines.append(item)
        
        print(f"Found {len(lines)} lines near click point")
        
        if not lines:
            print("No valid lines found")
            return
            
        # Find the closest line and endpoint
        closest_line = None
        closest_end = None
        min_distance = float('inf')
        
        for line in lines:
            coords = list(self.canvas.coords(line))
            print(f"\nChecking line {line} with coords: {coords}")
            # Check start point with larger endpoint tolerance
            d1 = math.sqrt((x - coords[0])**2 + (y - coords[1])**2)
            print(f"Distance to start point: {d1}")
            if d1 < min_distance and d1 < endpoint_tolerance:
                min_distance = d1
                closest_line = line
                closest_end = 'start'
            # Check end point with larger endpoint tolerance
            d2 = math.sqrt((x - coords[2])**2 + (y - coords[3])**2)
            print(f"Distance to end point: {d2}")
            if d2 < min_distance and d2 < endpoint_tolerance:
                min_distance = d2
                closest_line = line
                closest_end = 'end'
        
        print(f"\nClosest line: {closest_line}")
        print(f"Closest end: {closest_end}")
        print(f"Minimum distance: {min_distance}")
        
        if closest_line and min_distance < endpoint_tolerance:  # Use endpoint tolerance here
            print("Initializing drag state")
            self.dragging = True
            self.drag_line = closest_line
            self.drag_point = closest_end
            # Store original properties
            self.original_colors[closest_line] = self.canvas.itemcget(closest_line, 'fill')
            self.original_widths[closest_line] = self.canvas.itemcget(closest_line, 'width')
            # Highlight the line
            self.canvas.itemconfig(closest_line, fill='red', width=2)
            
            # Create marker for dragged endpoint
            coords = list(self.canvas.coords(closest_line))
            if closest_end == 'start':
                marker_x, marker_y = coords[0], coords[1]
            else:
                marker_x, marker_y = coords[2], coords[3]
            
            print(f"Creating endpoint marker at ({marker_x}, {marker_y})")
            # Create endpoint marker (blue circle with white center)
            marker_size = 6  # Fixed pixel size regardless of zoom
            self.drag_marker = self.canvas.create_oval(
                marker_x - marker_size, marker_y - marker_size,
                marker_x + marker_size, marker_y + marker_size,
                outline='blue', fill='white', width=2,
                tags='endpoint_marker'
            )

    def on_adjust_drag(self, event):
        """Handle dragging of line endpoint"""
        if not self.dragging or not self.drag_line:
            print("\nDEBUG: Not dragging or no drag line")
            return
            
        # Save state BEFORE making any changes
        save_canvas_state()
        
        x = self.canvas.canvasx(event.x)
        y = self.canvas.canvasy(event.y)
        print(f"\nDEBUG Drag:")
        print(f"Mouse position: ({x}, {y})")
        print(f"Snap enabled: {self.snap_enabled.get()}")
        
        # Get current line coordinates
        coords = list(self.canvas.coords(self.drag_line))
        print(f"Current line coords: {coords}")
        
        # If snap is enabled, try to snap to nearby endpoints
        snapped = False
        if self.snap_enabled.get():
            print("Attempting to find snap point...")
            snap_point = self.find_snap_point(x, y, self.drag_line)
            if snap_point:
                print(f"Found snap point: {snap_point}")
                x, y = snap_point
                snapped = True
            else:
                print("No snap point found")
        
        # Update the appropriate endpoint
        if self.drag_point == 'start':
            self.canvas.coords(self.drag_line, x, y, coords[2], coords[3])
            print(f"Updated start point to: ({x}, {y})")
        else:  # end
            self.canvas.coords(self.drag_line, coords[0], coords[1], x, y)
            print(f"Updated end point to: ({x}, {y})")
        
        # Update endpoint marker position
        if self.drag_marker:
            marker_size = 6  # Fixed pixel size regardless of zoom
            self.canvas.coords(
                self.drag_marker,
                x - marker_size, y - marker_size,
                x + marker_size, y + marker_size
            )
            # Change marker color based on snap state
            if snapped:
                print("Setting marker color to green (snapped)")
                self.canvas.itemconfig(self.drag_marker, outline='green')
            else:
                print("Setting marker color to blue (not snapped)")
                self.canvas.itemconfig(self.drag_marker, outline='blue')
                
            # Save canvas state AFTER successful drag
            save_canvas_state()

    def on_adjust_release(self, event):
        """Handle release of mouse button after dragging"""
        if self.dragging and self.drag_line:
            # Save canvas state for undo/redo
            save_canvas_state()
            
            # Reset the line appearance
            self.canvas.itemconfig(
                self.drag_line,
                fill=self.original_colors.get(self.drag_line, 'black'),
                width=self.original_widths.get(self.drag_line, 1)
            )
            
            # Clear markers
            if self.drag_marker:
                self.canvas.delete(self.drag_marker)
                self.drag_marker = None
            
            for marker in self.snap_markers:
                self.canvas.delete(marker)
            self.snap_markers = []
            
            # Clear dragging state
            self.dragging = False
            self.drag_line = None
            self.drag_point = None

    def find_snap_point(self, x, y, current_line):
        """Find the nearest endpoint to snap to within 5 pixels"""
        print("\nDEBUG Find Snap Point:")
        # Base snap distance divided by scale factor for consistent feel at all zoom levels
        snap_distance = 10 / self.scale_factor
        print(f"Snap distance: {snap_distance} pixels")
        min_distance = float('inf')
        snap_point = None
        
        # Get all lines except the current one and grid lines
        exclude_tags = ['grid_lines', 'below_all', 'above_all', 'snap_point', 'snap_line', 
                       'temp_marker', 'radius_marker', 'center_marker', 'temp', 
                       'guide_point', 'guide_line', 'crosshair', 'machine_pos']
        
        all_lines = [item for item in self.canvas.find_all() 
                    if item != current_line 
                    and self.canvas.type(item) == 'line'
                    and not any(tag in self.canvas.gettags(item) for tag in exclude_tags)
                    and 'all_lines' in self.canvas.gettags(item)]
        
        print(f"Found {len(all_lines)} potential lines to snap to")
        
        # Store all potential snap points for visualization
        potential_snap_points = []
        
        for line in all_lines:
            coords = list(self.canvas.coords(line))
            print(f"\nChecking line {line} with coords: {coords}")
            # Check start point
            d1 = math.sqrt((x - coords[0])**2 + (y - coords[1])**2)
            print(f"Distance to start point: {d1}")
            if d1 < snap_distance:
                print(f"Adding start point ({coords[0]}, {coords[1]}) as potential snap point")
                potential_snap_points.append((coords[0], coords[1], d1))
            # Check end point
            d2 = math.sqrt((x - coords[2])**2 + (y - coords[3])**2)
            print(f"Distance to end point: {d2}")
            if d2 < snap_distance:
                print(f"Adding end point ({coords[2]}, {coords[3]}) as potential snap point")
                potential_snap_points.append((coords[2], coords[3], d2))
        
        print(f"\nFound {len(potential_snap_points)} potential snap points")
        
        # Sort potential snap points by distance
        potential_snap_points.sort(key=lambda p: p[2])
        
        # Clear previous snap markers
        for marker in self.snap_markers:
            self.canvas.delete(marker)
        self.snap_markers = []
        
        # Create markers for all potential snap points within range
        # Fixed size for markers regardless of zoom
        marker_size = 6  # Fixed pixel size
        dot_size = 2    # Fixed pixel size for center dot
        for px, py, dist in potential_snap_points:
            print(f"Creating marker for point ({px}, {py}) at distance {dist}")
            # Create a more visible snap marker (green diamond with thicker outline)
            snap_marker = self.canvas.create_polygon(
                px, py - marker_size,
                px + marker_size, py,
                px, py + marker_size,
                px - marker_size, py,
                outline='#00ff00',  # Bright green
                fill='white',
                width=2,
                tags='snap_marker'
            )
            self.snap_markers.append(snap_marker)
            
            # Add a small dot in the center for better visibility
            center_dot = self.canvas.create_oval(
                px - dot_size, py - dot_size,
                px + dot_size, py + dot_size,
                fill='#00ff00',
                outline='#00ff00',
                tags='snap_marker'
            )
            self.snap_markers.append(center_dot)
        
        # Return the closest snap point if any
        if potential_snap_points:
            snap_point = (potential_snap_points[0][0], potential_snap_points[0][1])
            print(f"Returning closest snap point: {snap_point}")
        else:
            print("No snap points found")
        
        return snap_point

    def activate_rotate(self):
        """Activate rotate mode for rotating shapes around a point"""
        # Deactivate main app's selection mode if active
        if hasattr(self.parent, 'is_selecting') and self.parent.is_selecting:
            self.parent.toggle_select()
        
        # Deactivate other tools in main app
        if hasattr(self.parent, 'deactivate_all_tools'):
            self.parent.deactivate_all_tools()
        
        # Set tool state in main app
        if hasattr(self.parent, 'current_tool'):
            self.parent.current_tool = 'rotate'
        
        # Clear any existing selection
        self.clear_selection()
        self.canvas.config(cursor="crosshair")
        
        # Update button state
        self.set_active_tool('rotate')
        
        # Initialize rotation state
        self.rotate_state = 'select_shape'
        self.rotation_point = None
        self.original_coords = None
        self.start_angle = None
        self.rotate_shape = None
        
        # Bind canvas events
        self.canvas.unbind('<Button-1>')
        self.canvas.bind('<Button-1>', self.on_rotate_click)
        self.canvas.bind('<B1-Motion>', self.on_rotate_drag)
        self.canvas.bind('<ButtonRelease-1>', self.on_rotate_release)

    def on_rotate_click(self, event):
        """Handle clicks for rotation tool"""
        x = self.canvas.canvasx(event.x)
        y = self.canvas.canvasy(event.y)
        self.scale_factor = self.get_scale_factor()
        tolerance = 10 / self.scale_factor
        
        # Find overlapping items
        items = self.canvas.find_overlapping(x-tolerance, y-tolerance, x+tolerance, y+tolerance)
        exclude_tags = ['grid_lines', 'below_all', 'above_all', 'snap_point', 'snap_line', 
                       'temp_marker', 'radius_marker', 'center_marker', 'temp', 
                       'guide_point', 'guide_line', 'crosshair', 'machine_pos',
                       'rotation_marker']
        
        shapes = []
        for item in items:
            if self.canvas.type(item) in ['line', 'arc', 'oval', 'polygon', 'rectangle']:
                tags = self.canvas.gettags(item)
                if not any(tag in tags for tag in exclude_tags):
                    shapes.append(item)
        
        if not shapes:
            # Click in empty space - clear selection and reset tool
            self.clear_selection()
            return
        
        # Find closest shape
        closest_shape = None
        min_distance = float('inf')
        for shape in shapes:
            center = self.get_shape_center(shape)
            dist = math.sqrt((x - center[0])**2 + (y - center[1])**2)
            if dist < min_distance:
                min_distance = dist
                closest_shape = shape
        
        if closest_shape:
            # If selecting a different shape, reset the previous one first
            if self.rotate_shape and self.rotate_shape != closest_shape:
                # Reset previous shape's appearance
                prev_type = self.canvas.type(self.rotate_shape)
                if prev_type == 'line':
                    self.canvas.itemconfig(self.rotate_shape, 
                        fill=self.original_colors.get(self.rotate_shape, 'black'),
                        width=self.original_widths.get(self.rotate_shape, 1))
                else:
                    self.canvas.itemconfig(self.rotate_shape, 
                        outline=self.original_colors.get(self.rotate_shape, 'black'),
                        fill=self.original_fills.get(self.rotate_shape, ''),
                        width=self.original_widths.get(self.rotate_shape, 1))
            
            # Clear previous selection and markers
            self.clear_rotation_markers()
            
            # Select new shape and store its original properties
            self.rotate_shape = closest_shape
            shape_type = self.canvas.type(closest_shape)
            
            # Store original properties
            if shape_type == 'line':
                self.original_colors[closest_shape] = self.canvas.itemcget(closest_shape, 'fill')
                self.original_widths[closest_shape] = self.canvas.itemcget(closest_shape, 'width')
            else:
                self.original_colors[closest_shape] = self.canvas.itemcget(closest_shape, 'outline')
                self.original_fills[closest_shape] = self.canvas.itemcget(closest_shape, 'fill')
                self.original_widths[closest_shape] = self.canvas.itemcget(closest_shape, 'width')
            
            # Highlight selected shape - only change outline/stroke color
            if shape_type == 'line':
                self.canvas.itemconfig(closest_shape, fill='green', width=2)
            else:
                self.canvas.itemconfig(closest_shape, 
                    outline='green',
                    fill=self.original_fills[closest_shape],
                    width=2)
            
            # Store original coordinates
            self.original_coords = list(self.canvas.coords(closest_shape))
            
            # Find rotation center
            center = self.get_shape_center(closest_shape)
            self.add_rotation_center_marker(center[0], center[1])
            self.rotation_point = center
            self.start_angle = self.get_current_angle(event)
            
            # Move to rotation state
            self.rotate_state = 'rotate'
            
            # Keep the button in pressed state
            if self.tools_window and tk.Toplevel.winfo_exists(self.tools_window):
                self.tool_buttons['rotate'].configure(relief='sunken', bg='#2ecc71')

    def rotate_shape_around_point(self, shape_id, cx, cy, angle):
        """Rotate a shape around a point by the specified angle"""
        # Convert angle to radians
        angle_rad = math.radians(angle)
        cos_a = math.cos(angle_rad)
        sin_a = math.sin(angle_rad)
        
        shape_type = self.canvas.type(shape_id)
        coords = list(self.canvas.coords(shape_id))
        
        if shape_type in ['rectangle', 'oval', 'arc']:
            # For shapes defined by bounding box, convert to corner points
            x1, y1, x2, y2 = coords
            
            # Convert to corner points
            points = [
                [x1, y1],  # Top-left
                [x2, y1],  # Top-right
                [x2, y2],  # Bottom-right
                [x1, y2]   # Bottom-left
            ]
            
            # Rotate each point
            rotated_points = []
            for x, y in points:
                dx = x - cx
                dy = y - cy
                new_x = cx + (dx * cos_a - dy * sin_a)
                new_y = cy + (dx * sin_a + dy * cos_a)
                rotated_points.extend([new_x, new_y])
            
            if shape_type == 'rectangle':
                # For rectangles, convert to polygon if not already converted
                if not hasattr(self, 'temp_polygon') or self.temp_polygon != shape_id:
                    # Get original properties
                    fill = self.canvas.itemcget(shape_id, 'fill')
                    outline = self.canvas.itemcget(shape_id, 'outline')
                    width = self.canvas.itemcget(shape_id, 'width')
                    tags = list(self.canvas.gettags(shape_id))
                    
                    # Create polygon with same properties
                    new_polygon = self.canvas.create_polygon(
                        *rotated_points,
                        fill='' if fill == 'none' else fill,  # Preserve empty fill
                        outline='green',  # Keep outline green while selected
                        width=width,
                        tags=tags
                    )
                    
                    # Store original properties - ensure we store empty fill as empty
                    self.original_colors[new_polygon] = outline
                    self.original_fills[new_polygon] = '' if fill == 'none' else fill
                    self.original_widths[new_polygon] = width
                    
                    # Delete original rectangle
                    self.canvas.delete(shape_id)
                    
                    # Update references
                    self.rotate_shape = new_polygon
                    self.temp_polygon = new_polygon
                else:
                    # Update existing polygon coordinates
                    self.canvas.coords(shape_id, *rotated_points)
            else:
                # For ovals and arcs, calculate new bounding box
                min_x = min(rotated_points[::2])
                max_x = max(rotated_points[::2])
                min_y = min(rotated_points[1::2])
                max_y = max(rotated_points[1::2])
                self.canvas.coords(shape_id, min_x, min_y, max_x, max_y)
        else:
            # For lines and polygons, rotate points directly
            new_coords = []
            for i in range(0, len(coords), 2):
                x, y = coords[i], coords[i+1]
                dx = x - cx
                dy = y - cy
                new_x = cx + (dx * cos_a - dy * sin_a)
                new_y = cy + (dx * sin_a + dy * cos_a)
                new_coords.extend([new_x, new_y])
            
            self.canvas.coords(shape_id, *new_coords)

    def apply_manual_rotation(self, direction):
        """Apply manual rotation based on angle input"""
        if not self.rotate_shape or not self.rotation_point:
            messagebox.showerror("Error", "Please select a shape and rotation point first")
            return
            
        try:
            angle = float(self.angle_entry.get())
            if direction == 'ccw':
                angle = -angle  # Counter-clockwise is negative
            
            # Store original width and color
            shape_type = self.canvas.type(self.rotate_shape)
            if shape_type == 'line':
                original_color = self.canvas.itemcget(self.rotate_shape, 'fill')
            else:
                original_color = self.canvas.itemcget(self.rotate_shape, 'outline')
            original_width = self.canvas.itemcget(self.rotate_shape, 'width')
            
            # Rotate the shape
            self.rotate_shape_around_point(
                self.rotate_shape,
                self.rotation_point[0],
                self.rotation_point[1],
                angle
            )
            
            # Restore appearance - keep green outline for selection
            if shape_type == 'line':
                self.canvas.itemconfig(self.rotate_shape, fill='green', width=2)
            else:
                self.canvas.itemconfig(self.rotate_shape, outline='green', width=2)
            
            # Save canvas state for undo/redo
            save_canvas_state()
                
        except ValueError:
            messagebox.showerror("Error", "Please enter a valid angle")

    def on_rotate_release(self, event):
        """Handle release after rotation"""
        if self.rotate_state == 'rotate' and self.rotate_shape:
            # Save canvas state for undo/redo
            save_canvas_state()
            
            # Reset the start angle for next rotation
            self.start_angle = None
            
            # Clear the angle label
            self.clear_angle_label()
            
            # Reset cumulative angle
            self.cumulative_angle = 0
            
            # Keep the tool active and shape selected
            self.rotate_state = 'rotate'
            
            # Keep shape highlighted - only outline
            shape_type = self.canvas.type(self.rotate_shape)
            if shape_type == 'line':
                self.canvas.itemconfig(self.rotate_shape, fill='green', width=2)
            else:
                self.canvas.itemconfig(self.rotate_shape, outline='green', width=2)
            
            # Keep the button in pressed state
            if self.tools_window and tk.Toplevel.winfo_exists(self.tools_window):
                self.tool_buttons['rotate'].configure(relief='sunken', bg='#2ecc71')

    def clear_rotation_markers(self):
        """Clear all rotation center markers"""
        for marker in self.rotation_center_markers:
            self.canvas.delete(marker)
        self.rotation_center_markers = []

    def add_rotation_center_marker(self, x, y):
        """Add a center marker for rotation using the marker system"""
        # Create unique timestamp-based ID
        shape_id = f"shape_{int(time.time() * 1000)}"
        
        # Convert canvas coordinates to screen coordinates
        screen_x = x / self.scale_factor
        screen_y = y / self.scale_factor
        
        # Fixed sizes in screen pixels
        radius = 8
        inner_radius = 3
        
        # Convert back to canvas coordinates for placement
        canvas_x = screen_x * self.scale_factor
        canvas_y = screen_y * self.scale_factor
        canvas_radius = radius * self.scale_factor
        canvas_inner_radius = inner_radius * self.scale_factor
        
        # Create outer circle
        outer = self.canvas.create_oval(
            canvas_x - canvas_radius, canvas_y - canvas_radius,
            canvas_x + canvas_radius, canvas_y + canvas_radius,
            outline='blue',
            width=2,
            tags=('rotation_center', 'marker', 'all_lines', shape_id)
        )
        
        # Create inner dot
        inner = self.canvas.create_oval(
            canvas_x - canvas_inner_radius, canvas_y - canvas_inner_radius,
            canvas_x + canvas_inner_radius, canvas_y + canvas_inner_radius,
            fill='blue',
            outline='blue',
            tags=('rotation_center', 'marker', 'all_lines', shape_id)
        )
        
        self.rotation_center_markers.extend([outer, inner])

    def on_rotate_drag(self, event):
        """Handle dragging for rotation"""
        if self.rotate_state == 'rotate' and self.rotate_shape and self.rotation_point:
            # Calculate current angle
            current_angle = self.get_current_angle(event)
            
            if self.start_angle is None:
                self.start_angle = current_angle
                return
            
            # Calculate rotation angle
            delta_angle = current_angle - self.start_angle
            
            # If angle snap is enabled, snap to nearest 5 degrees
            if self.angle_snap.get():
                # Ensure we're snapping the delta angle correctly
                delta_angle = round(delta_angle / 5.0) * 5.0
                current_angle = self.start_angle + delta_angle
            
            # Update cumulative angle
            self.cumulative_angle += delta_angle
            
            # Rotate the shape
            self.rotate_shape_around_point(
                self.rotate_shape,
                self.rotation_point[0],
                self.rotation_point[1],
                delta_angle
            )
            
            # Update the angle label at current mouse position
            x = self.canvas.canvasx(event.x)
            y = self.canvas.canvasy(event.y)
            self.update_angle_label(x, y, self.cumulative_angle)
            
            # Update start angle for next drag
            self.start_angle = current_angle

    def execute_trim_mid(self, selected_segment):
        """Execute the trim-mid operation on selected lines"""
        try:
            if len(self.selected_lines) != 2:
                return
                
            # Save state BEFORE making any changes
            save_canvas_state()
            
            # Find intersections between selected segment and boundary lines
            segment_coords = list(self.canvas.coords(selected_segment))
            intersections = []
            
            for boundary_line in self.selected_lines:
                boundary_coords = list(self.canvas.coords(boundary_line))
                intersection = self.find_line_intersection(
                    segment_coords[0], segment_coords[1], segment_coords[2], segment_coords[3],
                    boundary_coords[0], boundary_coords[1], boundary_coords[2], boundary_coords[3]
                )
                if intersection:
                    intersections.append(intersection)
            
            if len(intersections) != 2:
                messagebox.showerror("Error", "Selected line must intersect both boundary lines")
                return
            
            # Sort intersections by distance from start of line
            intersections.sort(key=lambda p: math.sqrt(
                (p[0] - segment_coords[0])**2 + (p[1] - segment_coords[1])**2
            ))
            
            # Get original properties
            line_width = self.canvas.itemcget(selected_segment, 'width')
            line_color = self.canvas.itemcget(selected_segment, 'fill')
            
            # Create two new lines, skipping the middle segment
            # First segment (from start to first intersection)
            new_line1 = self.canvas.create_line(
                segment_coords[0], segment_coords[1],
                intersections[0][0], intersections[0][1],
                width=line_width,
                fill=line_color,
                tags=('line', 'shape', 'all_lines', self.get_next_shape_id())
            )
            
            # Second segment (from second intersection to end)
            new_line2 = self.canvas.create_line(
                intersections[1][0], intersections[1][1],
                segment_coords[2], segment_coords[3],
                width=line_width,
                fill=line_color,
                tags=('line', 'shape', 'all_lines', self.get_next_shape_id())  # Use a different shape ID for second segment
            )
            
            # Add new lines to active layer
            if hasattr(self.canvas, 'active_layer'):
                active_layer = self.canvas.active_layer
                for new_line in [new_line1, new_line2]:
                    self.canvas.addtag_withtag(f'layer{active_layer}', new_line)
                    if hasattr(self.canvas, 'shapes'):
                        self.canvas.shapes.append(new_line)
            
            # Enable selection and movement through canvas bindings
            for new_line in [new_line1, new_line2]:
                self.canvas.tag_bind(new_line, '<Button-1>', 
                    lambda e, i=new_line: self.canvas.event_generate('<<ShapeClicked>>', when='tail'))
            
            # Delete original line
            self.canvas.delete(selected_segment)
            
            # Save canvas state AFTER successful operation
            save_canvas_state()

            # Update layers window if it exists
            if hasattr(self.parent, 'layers_window') and self.parent.layers_window:
                self.parent.layers_window.update_layer_items()

            # Add processed coordinates to prevent re-processing
            self.processed_coords.add(tuple(segment_coords))
            
        except Exception as e:
            messagebox.showerror("Error", str(e))
            print(f"Error in execute_trim_mid: {str(e)}")
            
        # Don't clear selection after each trim to allow multiple trims
        # Only reset if there was an error
        if len(self.selected_lines) != 2:
            self.clear_selection()
            self.trim_state = 'first_line'

    def get_base_shape_id(self, shape_id):
        """Extract the base numeric ID without timestamp"""
        try:
            if isinstance(shape_id, str) and shape_id.startswith('shape_'):
                id_parts = shape_id.split('_')
                if len(id_parts) >= 2:
                    return int(id_parts[1])
        except (ValueError, IndexError):
            pass
        return None

    def get_shape_id_from_tags(self, tags):
        """Get shape ID from tags, handling both old and new format"""
        for tag in tags:
            if tag.startswith('shape_'):
                return tag
        return None

    def set_rotation_point(self):
        """Set the rotation point at current mouse position"""
        if not self.rotate_shape:
            messagebox.showerror("Error", "Please select a shape first")
            return
            
        # Get current mouse position
        x = self.canvas.winfo_pointerx() - self.canvas.winfo_rootx()
        y = self.canvas.winfo_pointery() - self.canvas.winfo_rooty()
        x = self.canvas.canvasx(x)
        y = self.canvas.canvasy(y)
        
        # Clear any existing rotation markers
        self.clear_rotation_markers()
        
        # Create new marker at mouse position
        self.add_rotation_center_marker(x, y)
        
        # Store rotation point
        self.rotation_point = (x, y)
        
        # Store starting angle for relative rotation
        self.start_angle = self.get_current_angle_from_point(x, y)
        
        # Move to rotation state
        self.rotate_state = 'rotate'

    def get_current_angle_from_point(self, x, y):
        """Calculate current angle relative to rotation point from coordinates"""
        if not self.rotation_point:
            return 0
        return math.degrees(math.atan2(
            y - self.rotation_point[1],
            x - self.rotation_point[0]
        ))

    def get_current_angle(self, event):
        """Calculate current angle relative to rotation point from event"""
        if not self.rotation_point:
            return 0
        y = self.canvas.canvasy(event.y)
        x = self.canvas.canvasx(event.x)
        return math.degrees(math.atan2(
            y - self.rotation_point[1],
            x - self.rotation_point[0]
        ))

    def get_shape_center(self, shape_id):
        """Calculate the center point of a shape"""
        shape_type = self.canvas.type(shape_id)
        coords = list(self.canvas.coords(shape_id))
        
        if shape_type in ['rectangle', 'oval', 'arc']:
            # For shapes defined by bounding box
            x1, y1, x2, y2 = coords
            return ((x1 + x2) / 2, (y1 + y2) / 2)
            
        elif shape_type == 'line':
            # For lines, return midpoint
            x1, y1, x2, y2 = coords
            return ((x1 + x2) / 2, (y1 + y2) / 2)
            
        elif shape_type == 'polygon':
            # For polygons, calculate centroid
            x_coords = coords[::2]  # Even indices
            y_coords = coords[1::2]  # Odd indices
            x_center = sum(x_coords) / len(x_coords)
            y_center = sum(y_coords) / len(y_coords)
            return (x_center, y_center)
            
        else:
            # Default fallback - use bounding box
            bbox = self.canvas.bbox(shape_id)
            if bbox:
                x1, y1, x2, y2 = bbox
                return ((x1 + x2) / 2, (y1 + y2) / 2)
            return (0, 0)  # Fallback if no bbox available

    def update_angle_label(self, x, y, angle):
        """Update or create the angle label at the given position"""
        # Delete existing label if it exists
        if self.angle_label:
            self.canvas.delete(self.angle_label)
        
        # Format angle to 1 decimal place
        angle_text = f"{angle:.1f}°"
        
        # Create new label with white background for better visibility
        self.angle_label = self.canvas.create_text(
            x + 20, y - 20,  # Offset from cursor
            text=angle_text,
            fill='black',
            font=('Arial', 12),
            tags='angle_label'
        )
        
        # Create white background rectangle
        bbox = self.canvas.bbox(self.angle_label)
        if bbox:
            padding = 4
            bg = self.canvas.create_rectangle(
                bbox[0] - padding,
                bbox[1] - padding,
                bbox[2] + padding,
                bbox[3] + padding,
                fill='white',
                outline='#666666',
                tags='angle_label'
            )
            # Move background behind text
            self.canvas.tag_lower(bg, self.angle_label)

    def clear_angle_label(self):
        """Clear the angle label"""
        if self.angle_label:
            self.canvas.delete('angle_label')
            self.angle_label = None