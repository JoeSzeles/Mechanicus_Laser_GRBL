import tkinter as tk
from tkinter import ttk, messagebox
import math
import time

class LineEditor:
    def __init__(self, parent_window, canvas):
        self.parent = parent_window
        self.canvas = canvas
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
        self.initialize_tools()

    def initialize_tools(self):
        """Initialize all line editing tools"""
        self.is_selecting = False
        self.canvas.unbind('<Button-1>')

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
        
        self.clear_selection()  # Clear any existing selection
        self.canvas.config(cursor="crosshair")
        
        # Update button appearance
        if self.select_btn:
            self.select_btn.configure(bg="#2ecc71")  # Green color for active state
            
        # Bind canvas events
        self.canvas.unbind('<Button-1>')
        self.canvas.bind('<Button-1>', self.on_canvas_click)

    def deactivate_selection(self):
        """Deactivate line selection mode"""
        self.clear_selection()
        self.canvas.config(cursor="")
        # Only try to configure the button if both the tools window and button still exist
        if self.tools_window and self.select_btn and tk.Toplevel.winfo_exists(self.tools_window):
            try:
                self.select_btn.configure(bg="#263d42")  # Reset to default color
            except tk.TclError:
                pass  # Ignore if button no longer exists
        self.canvas.unbind('<Button-1>')

    def on_canvas_click(self, event):
        """Handle canvas clicks for line selection"""
        x = self.canvas.canvasx(event.x)
        y = self.canvas.canvasy(event.y)
        self.scale_factor = self.get_scale_factor()
        tolerance = 5 * self.scale_factor
        
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
        
        if lines:
            item_id = lines[0]
            # Check if the line still exists and is valid
            try:
                coords = self.canvas.coords(item_id)
                if len(coords) != 4:  # Valid line should have 4 coordinates
                    return
                    
                if item_id not in self.selected_lines:
                    if len(self.selected_lines) >= 2:
                        self.clear_selection()
                    # Store original properties before changing them
                    self.original_colors[item_id] = self.canvas.itemcget(item_id, 'fill')
                    self.original_widths[item_id] = self.canvas.itemcget(item_id, 'width')
                    self.selected_lines.append(item_id)
                    self.canvas.itemconfig(item_id, fill='red', width=2)
                    if len(self.selected_lines) == 2:
                        self.find_intersection()
                        
            except tk.TclError:
                # If the line doesn't exist anymore
                self.clear_selection()

    def clear_selection(self):
        """Clear all selected lines"""
        self.canvas.delete('intersection')
        self.canvas.delete('endpoint_marker')
        self.canvas.delete('snap_marker')
        for line_id in self.selected_lines:
            # Restore original properties
            self.canvas.itemconfig(line_id, 
                                 fill=self.original_colors.get(line_id, 'black'),
                                 width=self.original_widths.get(line_id, 1))
        self.selected_lines = []
        self.selected_vertex = None
        self.original_colors = {}
        self.original_widths = {}
        self.drag_marker = None
        self.snap_markers = []

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
        """Apply fillet to selected lines following standard CAD approach"""
        if len(self.selected_lines) != 2 or not self.selected_vertex:
            return
        try:
            self.clear_debug()
            # Get the radius in mm (unscaled)
            radius_mm = float(self.radius_entry.get())
            if radius_mm <= 0:
                raise ValueError("Radius must be positive")
            
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

            # Add new elements to the active layer
            if hasattr(self.canvas, 'active_layer'):
                active_layer = self.canvas.active_layer
                for item in [new_line1, new_line2, arc]:
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

            # Save canvas state for undo/redo if the function exists
            if hasattr(self.parent, 'save_canvas_state'):
                self.parent.save_canvas_state()

            # Update layers window if it exists
            if hasattr(self.parent, 'layers_window') and self.parent.layers_window:
                self.parent.layers_window.update_layer_items()

            self.clear_selection()
        except ValueError as e:
            tk.messagebox.showerror("Error", str(e))
            self.clear_debug()

    def activate_chamfer(self):
        """Apply chamfer to selected lines following standard CAD approach"""
        if len(self.selected_lines) != 2 or not self.selected_vertex:
            return
        try:
            self.clear_debug()
            # Get the chamfer size in mm (unscaled)
            chamfer_size_mm = float(self.radius_entry.get())
            if chamfer_size_mm <= 0:
                raise ValueError("Chamfer size must be positive")
            
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

            # Save canvas state for undo/redo if the function exists
            if hasattr(self.parent, 'save_canvas_state'):
                self.parent.save_canvas_state()

            # Update layers window if it exists
            if hasattr(self.parent, 'layers_window') and self.parent.layers_window:
                self.parent.layers_window.update_layer_items()

            self.clear_selection()
        except ValueError as e:
            tk.messagebox.showerror("Error", str(e))
            self.clear_debug()

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
        
        # Update button appearance
        if self.select_btn:
            self.select_btn.configure(bg="#2ecc71")  # Green color for active state
            
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
        
        # Initialize trim-mid state
        self.trim_state = 'first_line'
        
        # Bind canvas events for selection
        self.canvas.unbind('<Button-1>')
        self.canvas.bind('<Button-1>', self.on_trim_mid_select)

    def on_trim_select(self, event):
        """Handle line selection for trimming"""
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
            self.trim_state = 'first_line'
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
                # Check if lines are parallel or intersecting
                line1_coords = list(self.canvas.coords(self.selected_lines[0]))
                line2_coords = list(self.canvas.coords(item_id))
                
                # Calculate vectors
                v1x = line1_coords[2] - line1_coords[0]
                v1y = line1_coords[3] - line1_coords[1]
                v2x = line2_coords[2] - line2_coords[0]
                v2y = line2_coords[3] - line2_coords[1]
                
                # Normalize vectors
                len1 = math.sqrt(v1x*v1x + v1y*v1y)
                len2 = math.sqrt(v2x*v2x + v2y*v2y)
                if len1 == 0 or len2 == 0:
                    return
                    
                v1x, v1y = v1x/len1, v1y/len1
                v2x, v2y = v2x/len2, v2y/len2
                
                # Check if parallel or intersecting
                dot_product = abs(v1x*v2x + v1y*v2y)
                if dot_product > 0.99 or self.find_line_intersection(
                    line1_coords[0], line1_coords[1], line1_coords[2], line1_coords[3],
                    line2_coords[0], line2_coords[1], line2_coords[2], line2_coords[3]):
                    # Lines are parallel or intersecting - accept as second line
                    self.original_colors[item_id] = self.canvas.itemcget(item_id, 'fill')
                    self.original_widths[item_id] = self.canvas.itemcget(item_id, 'width')
                    self.selected_lines.append(item_id)
                    self.canvas.itemconfig(item_id, fill='red', width=2)
                    self.trim_state = 'trim_crossing'
                else:
                    messagebox.showerror("Error", "The selected lines must be parallel or intersecting")
                
        elif self.trim_state == 'trim_crossing':
            if item_id not in self.selected_lines:
                # Check if this line intersects both selected lines
                line1_coords = list(self.canvas.coords(self.selected_lines[0]))
                line2_coords = list(self.canvas.coords(self.selected_lines[1]))
                crossing_coords = list(self.canvas.coords(item_id))
                
                intersection1 = self.find_line_intersection(
                    line1_coords[0], line1_coords[1], line1_coords[2], line1_coords[3],
                    crossing_coords[0], crossing_coords[1], crossing_coords[2], crossing_coords[3]
                )
                
                intersection2 = self.find_line_intersection(
                    line2_coords[0], line2_coords[1], line2_coords[2], line2_coords[3],
                    crossing_coords[0], crossing_coords[1], crossing_coords[2], crossing_coords[3]
                )
                
                if intersection1 and intersection2:
                    # Store original properties
                    line_width = self.canvas.itemcget(item_id, 'width')
                    line_color = self.canvas.itemcget(item_id, 'fill')
                    
                    # Create two new lines, skipping the middle segment
                    # First segment
                    new_line1 = self.canvas.create_line(
                        crossing_coords[0], crossing_coords[1],
                        intersection1[0], intersection1[1],
                        width=line_width,
                        fill=line_color,
                        tags=('line', 'shape', 'all_lines', self.get_next_shape_id())
                    )
                    
                    # Second segment
                    new_line2 = self.canvas.create_line(
                        intersection2[0], intersection2[1],
                        crossing_coords[2], crossing_coords[3],
                        width=line_width,
                        fill=line_color,
                        tags=('line', 'shape', 'all_lines', self.get_next_shape_id())
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
                    self.canvas.delete(item_id)
                    
                    # Save canvas state for undo/redo if the function exists
                    if hasattr(self.parent, 'save_canvas_state'):
                        self.parent.save_canvas_state()

                    # Update layers window if it exists
                    if hasattr(self.parent, 'layers_window') and self.parent.layers_window:
                        self.parent.layers_window.update_layer_items()
                    
                    # Keep the selection active for more trimming
                else:
                    messagebox.showerror("Error", "The selected line must intersect both boundary lines")

    def find_and_highlight_segments(self):
        """Find and highlight all possible middle segments between intersections"""
        if len(self.selected_lines) != 2:
            return False
            
        # Get coordinates of both lines
        line1_coords = list(self.canvas.coords(self.selected_lines[0]))
        line2_coords = list(self.canvas.coords(self.selected_lines[1]))
        
        # Find all intersection points
        intersections = []
        
        # Check main intersection
        intersection = self.find_line_intersection(
            line1_coords[0], line1_coords[1], line1_coords[2], line1_coords[3],
            line2_coords[0], line2_coords[1], line2_coords[2], line2_coords[3]
        )
        
        if intersection:
            intersections.append(intersection)
            
            # Find additional intersections by checking both ends of both lines
            # This helps find T-intersections and other special cases
            for point in [(line1_coords[0], line1_coords[1]), 
                         (line1_coords[2], line1_coords[3]),
                         (line2_coords[0], line2_coords[1]), 
                         (line2_coords[2], line2_coords[3])]:
                if self.point_on_line(point[0], point[1], 
                                    line1_coords[0], line1_coords[1], 
                                    line1_coords[2], line1_coords[3], 1e-6) or \
                   self.point_on_line(point[0], point[1], 
                                    line2_coords[0], line2_coords[1], 
                                    line2_coords[2], line2_coords[3], 1e-6):
                    if point not in intersections:
                        intersections.append(point)
        
        if len(intersections) < 2:
            return False
            
        # Sort intersections along each line
        def sort_points(points, line_start, line_end):
            return sorted(points, key=lambda p: 
                ((p[0] - line_start[0])**2 + (p[1] - line_start[1])**2))
        
        # Sort intersections for both lines
        line1_intersections = sort_points(intersections, 
                                        (line1_coords[0], line1_coords[1]),
                                        (line1_coords[2], line1_coords[3]))
        line2_intersections = sort_points(intersections, 
                                        (line2_coords[0], line2_coords[1]),
                                        (line2_coords[2], line2_coords[3]))
        
        # Create temporary lines for each segment between intersections
        self.canvas.delete('temp_highlight')  # Clear any existing highlights
        
        # Create segments for line 1
        for i in range(len(line1_intersections) - 1):
            self.canvas.create_line(
                line1_intersections[i][0], line1_intersections[i][1],
                line1_intersections[i+1][0], line1_intersections[i+1][1],
                fill='yellow', width=2, tags=('temp_highlight', 'segment_line1')
            )
            
        # Create segments for line 2
        for i in range(len(line2_intersections) - 1):
            self.canvas.create_line(
                line2_intersections[i][0], line2_intersections[i][1],
                line2_intersections[i+1][0], line2_intersections[i+1][1],
                fill='yellow', width=2, tags=('temp_highlight', 'segment_line2')
            )
        
        return True

    def find_clicked_segment(self, x, y):
        """Find which highlighted segment was clicked"""
        tolerance = 10 * self.scale_factor
        items = self.canvas.find_overlapping(x-tolerance, y-tolerance, x+tolerance, y+tolerance)
        
        # Filter for temporary highlight segments
        segments = [item for item in items if 'temp_highlight' in self.canvas.gettags(item)]
        
        if not segments:
            return None
            
        # Find the closest segment
        closest_segment = None
        min_distance = float('inf')
        for segment in segments:
            coords = list(self.canvas.coords(segment))
            dist = self.point_to_line_distance(x, y, coords[0], coords[1], coords[2], coords[3])
            if dist < min_distance:
                min_distance = dist
                closest_segment = segment
                
        return closest_segment

    def execute_trim_mid(self, selected_segment):
        """Execute the trim-mid operation on selected lines"""
        try:
            if len(self.selected_lines) != 2:
                return
                
            # Get coordinates of the selected segment
            segment_coords = list(self.canvas.coords(selected_segment))
            segment_tags = self.canvas.gettags(selected_segment)
            
            # Determine which line this segment belongs to
            is_line1_segment = 'segment_line1' in segment_tags
            line_id = self.selected_lines[0] if is_line1_segment else self.selected_lines[1]
            
            # Get coordinates and properties of the original line
            line_coords = list(self.canvas.coords(line_id))
            line_width = self.original_widths[line_id]
            line_color = self.original_colors[line_id]
            
            # Create two new lines, skipping the middle segment
            # First segment (from start to first intersection)
            new_line1 = self.canvas.create_line(
                line_coords[0], line_coords[1],
                segment_coords[0], segment_coords[1],
                width=line_width,
                fill=line_color,
                tags=('line', 'shape', 'all_lines', self.get_next_shape_id())
            )
            
            # Second segment (from second intersection to end)
            new_line2 = self.canvas.create_line(
                segment_coords[2], segment_coords[3],
                line_coords[2], line_coords[3],
                width=line_width,
                fill=line_color,
                tags=('line', 'shape', 'all_lines', self.get_next_shape_id())
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
            self.canvas.delete(line_id)
            
            # Delete all temporary highlights
            self.canvas.delete('temp_highlight')
            
            # Save canvas state for undo/redo if the function exists
            if hasattr(self.parent, 'save_canvas_state'):
                self.parent.save_canvas_state()

            # Update layers window if it exists
            if hasattr(self.parent, 'layers_window') and self.parent.layers_window:
                self.parent.layers_window.update_layer_items()

            # Reset selection and state
            self.clear_selection()
            self.trim_state = 'first_line'
            
        except Exception as e:
            messagebox.showerror("Error", str(e))
            self.clear_selection()
            self.trim_state = 'first_line'

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
            
            # Save canvas state for undo/redo if the function exists
            if hasattr(self.parent, 'save_canvas_state'):
                self.parent.save_canvas_state()

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
            
            # Selection mode button
            self.select_btn = tk.Button(self.tools_window, text="Select Lines", 
                                      bd=2, height=1, width=14,
                                      fg="white", bg="#263d42",
                                      command=self.activate_selection)
            self.select_btn.pack(pady=5, padx=5, fill='x')
            
            # Fillet button
            fillet_btn = tk.Button(self.tools_window, text="Fillet", 
                                 bd=2, height=1, width=14,
                                 fg="white", bg="#263d42",
                                 command=self.activate_fillet)
            fillet_btn.pack(pady=5, padx=5, fill='x')
            
            # Chamfer button
            chamfer_btn = tk.Button(self.tools_window, text="Chamfer", 
                                  bd=2, height=1, width=14,
                                  fg="white", bg="#263d42",
                                  command=self.activate_chamfer)
            chamfer_btn.pack(pady=5, padx=5, fill='x')
            
            # Trim button
            trim_btn = tk.Button(self.tools_window, text="Trim", 
                               bd=2, height=1, width=14,
                               fg="white", bg="#263d42",
                               command=self.activate_trim)
            trim_btn.pack(pady=5, padx=5, fill='x')
            
            # TrimMid button
            trim_mid_btn = tk.Button(self.tools_window, text="TrimMid", 
                                   bd=2, height=1, width=14,
                                   fg="white", bg="#263d42",
                                   command=self.activate_trim_mid)
            trim_mid_btn.pack(pady=5, padx=5, fill='x')
            
            # Extend button
            extend_btn = tk.Button(self.tools_window, text="Extend", 
                                 bd=2, height=1, width=14,
                                 fg="white", bg="#263d42",
                                 command=self.activate_extend)
            extend_btn.pack(pady=5, padx=5, fill='x')
            
            # Frame for Adjust Line button and snap checkbox
            adjust_frame = ttk.Frame(self.tools_window)
            adjust_frame.pack(pady=5, padx=5, fill='x')
            adjust_frame.configure(style='Dark.TFrame')
            
            # Adjust Line button
            adjust_btn = tk.Button(adjust_frame, text="Adjust Line", 
                                 bd=2, height=1, width=14,
                                 fg="white", bg="#263d42",
                                 command=self.activate_adjust)
            adjust_btn.pack(side='left', padx=2)
            
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
            clear_btn = tk.Button(self.tools_window, text="Clear Selection", 
                                bd=2, height=1, width=14,
                                fg="white", bg="#263d42",
                                command=self.clear_selection)
            clear_btn.pack(pady=5, padx=5, fill='x')
            
            # Handle window close
            self.tools_window.protocol("WM_DELETE_WINDOW", self.on_window_close)

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
                    
                    # Save canvas state for undo/redo if the function exists
                    if hasattr(self.parent, 'save_canvas_state'):
                        self.parent.save_canvas_state()

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
        tolerance = 10 * self.scale_factor
        
        print(f"\nDEBUG Adjust Click:")
        print(f"Click position: ({x}, {y})")
        print(f"Scale factor: {self.scale_factor}")
        print(f"Click tolerance: {tolerance}")
        
        # Find lines near click point
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
            # Check start point
            d1 = math.sqrt((x - coords[0])**2 + (y - coords[1])**2)
            print(f"Distance to start point: {d1}")
            if d1 < min_distance:
                min_distance = d1
                closest_line = line
                closest_end = 'start'
            # Check end point
            d2 = math.sqrt((x - coords[2])**2 + (y - coords[3])**2)
            print(f"Distance to end point: {d2}")
            if d2 < min_distance:
                min_distance = d2
                closest_line = line
                closest_end = 'end'
        
        print(f"\nClosest line: {closest_line}")
        print(f"Closest end: {closest_end}")
        print(f"Minimum distance: {min_distance}")
        
        if closest_line and min_distance < tolerance:
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
            marker_size = 6 * self.scale_factor
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
            marker_size = 6 * self.scale_factor
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

    def on_adjust_release(self, event):
        """Handle release of mouse button after dragging"""
        if self.dragging and self.drag_line:
            # Save canvas state for undo/redo if the function exists
            if hasattr(self.parent, 'save_canvas_state'):
                self.parent.save_canvas_state()
            
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
        snap_distance = 10 * self.scale_factor  # Increased snap distance for easier snapping
        print(f"Snap distance: {snap_distance} pixels")
        min_distance = float('inf')
        snap_point = None
        
        # Get all lines except the current one
        all_lines = [item for item in self.canvas.find_all() 
                    if item != current_line 
                    and self.canvas.type(item) == 'line'
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
        marker_size = 6 * self.scale_factor
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
                px - 2, py - 2,
                px + 2, py + 2,
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