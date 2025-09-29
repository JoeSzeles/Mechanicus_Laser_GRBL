import tkinter as tk
from tkinter import ttk
import time  # Add import for timestamp
from snaptools import snap_to_grid, snap_to_endpoints, snap_to_midpoints, snap_to_centers  # Import snap tools

class MarkersWindow:
    def __init__(self, root, canvas):
        self.root = root
        self.canvas = canvas
        self.guides = []  # Store guide objects
        self.center_points = []  # Store center point markers
        self.line_markers = []  # Store line markers
        self.guides_locked = False
        self.guides_visible = True
        self.selected_guide = None
        self.drag_start = None
        self.snap_threshold = 10  # Pixels distance for snapping
        self.center_point_mode = False
        self.line_mode = False  # New line mode flag
        self.preview_circle = None
        self.preview_line = None  # Preview for line tool
        self.line_start_point = None  # Store start point for line tool
        self.snap_enabled = True  # New snap toggle state
        self.guide_mode = None  # Track current guide mode
        self.snap_label = None  # For displaying snap point type
        self.grid_size = 20  # Grid size for snapping
        self.marker_size = 5  # Base size for markers
        self.point_radius = 4  # Radius for point markers
        self.preview_radius = 7  # Radius for preview circles
        
        # Get initial canvas scale
        self.canvas_scale = 1.0
        self.update_canvas_scale()
        
        # Create a new window
        self.window = tk.Toplevel(root)
        self.window.title("Markers")
        self.window.geometry("200x350")
        self.window.configure(bg='#2b2b2b')
        
        # Make window stay on top
        self.window.transient(root)
        
        # Create main frame
        main_frame = tk.Frame(self.window, bg='#2b2b2b')
        main_frame.pack(padx=5, pady=5, fill='both', expand=True)
        
        # Markers Block
        markers_frame = tk.LabelFrame(main_frame, text="Markers", bg='#2b2b2b', fg='white')
        markers_frame.pack(pady=5, padx=5, fill='x')
        
        # Add Center Point button
        self.center_btn = tk.Button(markers_frame, text="Center Point", bd=2, height=1, width=20, 
                                  fg="white", bg="#263d42", command=self.toggle_center_point_mode)
        self.center_btn.pack(pady=5)
        
        # Add Line Marker button (after Center Point button)
        self.line_btn = tk.Button(markers_frame, text="Line Marker", bd=2, height=1, width=20, 
                                fg="white", bg="#263d42", command=self.toggle_line_mode)
        self.line_btn.pack(pady=5)
        
        # Add Snap checkbox
        self.snap_var = tk.BooleanVar(value=True)
        snap_check = tk.Checkbutton(markers_frame, text="Enable Snapping", variable=self.snap_var,
                                  bg='#2b2b2b', fg='white', selectcolor='#263d42',
                                  activebackground='#2b2b2b', activeforeground='white')
        snap_check.pack(pady=5)

        # Show/Hide markers button
        self.show_markers_btn = tk.Button(markers_frame, text="Hide Markers", bd=2, height=1, width=20,
                                fg="white", bg="#263d42", command=self.toggle_markers_visibility)
        self.show_markers_btn.pack(pady=5)
        
        # Clear markers button
        clear_markers_btn = tk.Button(markers_frame, text="Clear Markers", bd=2, height=1, width=20,
                            fg="white", bg="#263d42", command=self.clear_markers)
        clear_markers_btn.pack(pady=5)

        # Guides Block
        guides_frame = tk.LabelFrame(main_frame, text="Guides", bg='#2b2b2b', fg='white')
        guides_frame.pack(pady=5, padx=5, fill='x')
        
        # Buttons for adding guides
        self.add_h_guide_btn = tk.Button(guides_frame, text="Add Horizontal Guide", bd=2, height=1, width=20, 
                                  fg="white", bg="#263d42", command=lambda: self.toggle_guide_mode('horizontal'))
        self.add_h_guide_btn.pack(pady=5)
        
        self.add_v_guide_btn = tk.Button(guides_frame, text="Add Vertical Guide", bd=2, height=1, width=20,
                                  fg="white", bg="#263d42", command=lambda: self.toggle_guide_mode('vertical'))
        self.add_v_guide_btn.pack(pady=5)
        
        # Lock/Unlock button
        self.lock_btn = tk.Button(guides_frame, text="Lock Guides", bd=2, height=1, width=20,
                                fg="white", bg="#263d42", command=self.toggle_lock)
        self.lock_btn.pack(pady=5)
        
        # Show/Hide guides button
        self.show_btn = tk.Button(guides_frame, text="Hide Guides", bd=2, height=1, width=20,
                                fg="white", bg="#263d42", command=self.toggle_visibility)
        self.show_btn.pack(pady=5)
        
        # Clear guides button
        clear_btn = tk.Button(guides_frame, text="Clear Guides", bd=2, height=1, width=20,
                            fg="white", bg="#263d42", command=self.clear_guides)
        clear_btn.pack(pady=5)
        
        # Bind events
        self.canvas.bind('<Motion>', self.on_mouse_move)
        self.canvas.bind('<Button-1>', self.on_canvas_click)
        self.canvas.bind('<B1-Motion>', self.guide_drag)
        self.canvas.bind('<ButtonRelease-1>', self.guide_release)
        self.canvas.bind('<Escape>', self.cancel_center_point_mode)
        
        # Bind window close event
        self.window.protocol("WM_DELETE_WINDOW", self.on_closing)
    
    def toggle_center_point_mode(self):
        self.center_point_mode = not self.center_point_mode
        
        # Cancel guide mode if active
        if self.center_point_mode and self.guide_mode:
            self.cancel_guide_mode()
        
        if self.center_point_mode:
            self.center_btn.configure(bg='#4CAF50')  # Green when active
            self.canvas.config(cursor="crosshair")
            # Make sure our bindings are active
            self.restore_bindings()
        else:
            self.center_btn.configure(bg='#263d42')
            self.canvas.config(cursor="")
            self.remove_preview()
    
    def cancel_center_point_mode(self, event=None):
        self.center_point_mode = False
        self.center_btn.configure(bg='#263d42')
        self.canvas.config(cursor="")
        self.remove_preview()
    
    def remove_preview(self):
        """Remove all preview elements"""
        if self.preview_circle:
            self.canvas.delete(self.preview_circle)
            self.preview_circle = None
        if self.preview_line:
            self.canvas.delete(self.preview_line)
            self.preview_line = None
        if hasattr(self, 'preview_start_point'):
            self.canvas.delete(self.preview_start_point)
            delattr(self, 'preview_start_point')
        if hasattr(self, 'preview_end_point'):
            self.canvas.delete(self.preview_end_point)
            delattr(self, 'preview_end_point')
        if self.snap_label:
            self.canvas.delete(self.snap_label)
            self.snap_label = None
    
    def update_canvas_scale(self):
        """Update the canvas scale factor"""
        # Try to get scale from canvas transform matrix
        try:
            # Get the current transform matrix
            matrix = self.canvas.transform
            if matrix:
                # Scale is typically the first element
                self.canvas_scale = float(matrix[0])
            else:
                self.canvas_scale = 1.0
        except (AttributeError, IndexError):
            # If transform not available, try to get it from canvas state
            try:
                self.canvas_scale = float(self.canvas.scale("all")[0])
            except:
                self.canvas_scale = 1.0

    def find_nearest_snap_point(self, x, y):
        """Find the nearest snap point using all available snap methods"""
        if not self.snap_var.get():
            return None, None
            
        # Update canvas scale
        self.update_canvas_scale()
            
        # Adjust grid size based on zoom
        adjusted_grid_size = self.grid_size * self.canvas_scale
            
        # Try each snap method in sequence
        snap_point = snap_to_endpoints(self.canvas, x, y)
        if snap_point:
            return snap_point, "Endpoint"
            
        snap_point = snap_to_midpoints(self.canvas, x, y)
        if snap_point:
            return snap_point, "Midpoint"
            
        snap_point = snap_to_centers(self.canvas, x, y)
        if snap_point:
            return snap_point, "Center"
            
        # Try grid snap last
        snap_point = snap_to_grid(x, y, adjusted_grid_size)
        if snap_point:
            # Only return grid snap if it's different from the original point
            if abs(snap_point[0] - x) > 1 or abs(snap_point[1] - y) > 1:
                return snap_point, "Grid"
            
        return None, None

    def update_snap_label(self, x, y, snap_type):
        """Update or create the snap point label"""
        if not snap_type:
            if self.snap_label:
                self.canvas.delete(self.snap_label)
                self.snap_label = None
            return
            
        text = f"Snap: {snap_type}"
        if self.snap_label:
            # Update existing label
            self.canvas.coords(self.snap_label, x + 10, y - 10)
            self.canvas.itemconfig(self.snap_label, text=text)
        else:
            # Create new label
            self.snap_label = self.canvas.create_text(
                x + 10, y - 10,
                text=text,
                fill='#4CAF50',
                font=('Arial', 8),
                tags='preview'
            )

    def on_mouse_move(self, event):
        if self.center_point_mode or self.line_mode:
            x = self.canvas.canvasx(event.x)
            y = self.canvas.canvasy(event.y)
            
            # Find potential snap point
            snap_point, snap_type = self.find_nearest_snap_point(x, y)
            
            if snap_point:
                x, y = snap_point
            
            if self.center_point_mode or (self.line_mode and not self.line_start_point):
                # Show preview circle
                if self.preview_circle:
                    self.canvas.coords(
                        self.preview_circle,
                        x - self.preview_radius, y - self.preview_radius,
                        x + self.preview_radius, y + self.preview_radius
                    )
                else:
                    self.preview_circle = self.canvas.create_oval(
                        x - self.preview_radius, y - self.preview_radius,
                        x + self.preview_radius, y + self.preview_radius,
                        outline='#4CAF50',  # Green outline
                        width=2,
                        tags='preview'
                    )
                if snap_point:
                    self.update_snap_label(x, y, snap_type)
                else:
                    if self.snap_label:
                        self.canvas.delete(self.snap_label)
                        self.snap_label = None
            
            if self.line_mode and self.line_start_point:
                # Update line preview
                if self.preview_line:
                    self.canvas.coords(
                        self.preview_line,
                        self.line_start_point[0],
                        self.line_start_point[1],
                        x, y
                    )
                else:
                    self.preview_line = self.canvas.create_line(
                        self.line_start_point[0],
                        self.line_start_point[1],
                        x, y,
                        dash=(5, 5),  # Create dashed line
                        fill='#4CAF50',  # Green color
                        width=2,  # Make preview line thicker
                        tags='preview'
                    )
                    
                    # Create preview points at both ends
                    if not hasattr(self, 'preview_start_point'):
                        self.preview_start_point = self.canvas.create_oval(
                            self.line_start_point[0] - self.point_radius,
                            self.line_start_point[1] - self.point_radius,
                            self.line_start_point[0] + self.point_radius,
                            self.line_start_point[1] + self.point_radius,
                            fill='#4CAF50',
                            outline='#4CAF50',
                            tags='preview'
                        )
                    
                    if not hasattr(self, 'preview_end_point'):
                        self.preview_end_point = self.canvas.create_oval(
                            x - self.point_radius, y - self.point_radius,
                            x + self.point_radius, y + self.point_radius,
                            fill='#4CAF50',
                            outline='#4CAF50',
                            tags='preview'
                        )
                    else:
                        self.canvas.coords(
                            self.preview_end_point,
                            x - self.point_radius, y - self.point_radius,
                            x + self.point_radius, y + self.point_radius
                        )
                if snap_point:
                    self.update_snap_label(x, y, snap_type)
                else:
                    if self.snap_label:
                        self.canvas.delete(self.snap_label)
                        self.snap_label = None
    
    def on_canvas_click(self, event):
        if self.line_mode:
            x = self.canvas.canvasx(event.x)
            y = self.canvas.canvasy(event.y)
            
            # Find potential snap point
            snap_point, _ = self.find_nearest_snap_point(x, y)
            if snap_point:
                x, y = snap_point
            
            if not self.line_start_point:
                # First click - set start point
                self.line_start_point = (x, y)
            else:
                # Second click - create the line
                self.add_line_marker(self.line_start_point[0], self.line_start_point[1], x, y)
                self.line_start_point = None
                self.remove_preview()
            return
        elif self.center_point_mode:
            x = self.canvas.canvasx(event.x)
            y = self.canvas.canvasy(event.y)
            
            # Find potential snap point
            snap_point, _ = self.find_nearest_snap_point(x, y)
            if snap_point:
                x, y = snap_point
            
            self.add_center_marker(x, y)
            return
        
        # Handle guide selection
        if self.guide_mode:
            self.on_guide_click(event)
            return
            
        # Handle regular guide selection
        if self.guides_locked:
            return
            
        x = self.canvas.canvasx(event.x)
        y = self.canvas.canvasy(event.y)
        
        items = self.canvas.find_overlapping(x-5, y-5, x+5, y+5)
        
        for item in items:
            tags = self.canvas.gettags(item)
            if 'guide' in tags:
                self.selected_guide = item
                self.drag_start = (x, y)
                return
            elif 'marker' in tags:
                # Find the shape_id to select the whole marker group
                shape_id = None
                for tag in tags:
                    if tag.startswith('shape_'):
                        shape_id = tag
                        break
                
                if shape_id:
                    # Select any part of the marker group
                    marker_parts = list(self.canvas.find_withtag(shape_id))
                    if marker_parts:
                        self.selected_guide = marker_parts[0]  # Use first part as reference
                        self.drag_start = (x, y)
                        # Highlight the marker
                        for part in marker_parts:
                            if 'line_marker' in self.canvas.gettags(part):
                                self.canvas.itemconfig(part, fill='#4CAF50', outline='#4CAF50')
                return

    def on_closing(self):
        self.canvas.unbind('<Motion>')
        self.canvas.unbind('<Button-1>')
        self.canvas.unbind('<B1-Motion>')
        self.canvas.unbind('<ButtonRelease-1>')
        self.canvas.unbind('<Escape>')
        self.remove_preview()
        self.window.destroy()
    
    def find_nearest_center(self, x, y):
        # Use the snap tools in order of priority
        snap_point = None
        
        # Only try snapping if snap is enabled
        if self.snap_var.get():
            # Try each snap tool in sequence
            snap_point = snap_to_endpoints(self.canvas, x, y)
            if not snap_point:
                snap_point = snap_to_midpoints(self.canvas, x, y)
            if not snap_point:
                snap_point = snap_to_centers(self.canvas, x, y)
            
        return snap_point
    
    def update_center_point(self, marker, x, y):
        """Update center marker position"""
        # Find nearest shape center
        nearest = self.find_nearest_center(x, y)
        if nearest:
            x, y = nearest
        
        # Get both parts of the marker using the shape_id
        shape_id = None
        for tag in self.canvas.gettags(marker):
            if tag.startswith('shape_'):
                shape_id = tag
                break
                
        if shape_id:
            markers = list(self.canvas.find_withtag(shape_id))
            if len(markers) == 2:
                # Update outer circle
                self.canvas.coords(
                    markers[0],
                    x - self.point_radius * 2, y - self.point_radius * 2,
                    x + self.point_radius * 2, y + self.point_radius * 2
                )
                # Update inner dot
                self.canvas.coords(
                    markers[1],
                    x - self.point_radius/2, y - self.point_radius/2,
                    x + self.point_radius/2, y + self.point_radius/2
                )

    def add_horizontal_guide(self):
        if not self.guides_visible:
            return
        # Get current mouse Y position
        y = self.canvas.winfo_pointery() - self.canvas.winfo_rooty()
        # Keep within canvas bounds
        y = max(0, min(y, self.canvas.winfo_height()))
        # Create unique timestamp-based ID
        shape_id = f"shape_{int(time.time() * 1000)}"
        line = self.canvas.create_line(0, y, self.canvas.winfo_width(), y,
                                     fill='blue', width=1,
                                     tags=('guide', 'horizontal_guide', 'all_lines', shape_id))
        self.guides.append(line)
    
    def add_vertical_guide(self):
        if not self.guides_visible:
            return
        # Get current mouse X position
        x = self.canvas.winfo_pointerx() - self.canvas.winfo_rootx()
        # Keep within canvas bounds
        x = max(0, min(x, self.canvas.winfo_width()))
        # Create unique timestamp-based ID
        shape_id = f"shape_{int(time.time() * 1000)}"
        line = self.canvas.create_line(x, 0, x, self.canvas.winfo_height(),
                                     fill='blue', width=1,
                                     tags=('guide', 'vertical_guide', 'all_lines', shape_id))
        self.guides.append(line)
    
    def toggle_lock(self):
        self.guides_locked = not self.guides_locked
        self.lock_btn.configure(text="Unlock Guides" if self.guides_locked else "Lock Guides")
    
    def toggle_visibility(self):
        self.guides_visible = not self.guides_visible
        self.show_btn.configure(text="Show Guides" if not self.guides_visible else "Hide Guides")
        # Only toggle guides, not center points
        for guide in self.guides:
            if self.guides_visible:
                self.canvas.itemconfigure(guide, state='normal')
            else:
                self.canvas.itemconfigure(guide, state='hidden')
    
    def clear_guides(self):
        # Only clear guides, not center points
        for guide in self.guides[:]:
            self.canvas.delete(guide)
        self.guides.clear()
    
    def guide_drag(self, event):
        if not self.selected_guide:
            return
            
        if self.guides_locked and 'guide' in self.canvas.gettags(self.selected_guide):
            return
            
        x = self.canvas.canvasx(event.x)
        y = self.canvas.canvasy(event.y)
        
        tags = self.canvas.gettags(self.selected_guide)
        
        if 'marker' in tags:  # Marker
            # Find potential snap point
            snap_point, _ = self.find_nearest_snap_point(x, y)
            if snap_point:
                x, y = snap_point
            
            # Get the shape_id
            shape_id = None
            for tag in tags:
                if tag.startswith('shape_'):
                    shape_id = tag
                    break
                    
            if shape_id:
                marker_parts = list(self.canvas.find_withtag(shape_id))
                
                if 'center_point' in tags:
                    # Update center marker position
                    if len(marker_parts) == 2:
                        # Update outer circle
                        self.canvas.coords(
                            marker_parts[0],
                            x - self.point_radius * 2, y - self.point_radius * 2,
                            x + self.point_radius * 2, y + self.point_radius * 2
                        )
                        # Update inner dot
                        self.canvas.coords(
                            marker_parts[1],
                            x - self.point_radius/2, y - self.point_radius/2,
                            x + self.point_radius/2, y + self.point_radius/2
                        )
                elif 'line_marker' in tags:
                    # For line markers, we need to move all three parts (start point, line, end point)
                    if len(marker_parts) == 3:
                        # Calculate movement delta
                        dx = x - self.drag_start[0]
                        dy = y - self.drag_start[1]
                        
                        # Move all parts
                        for part in marker_parts:
                            if self.canvas.type(part) == 'line':
                                # For the line, move both endpoints
                                coords = self.canvas.coords(part)
                                self.canvas.coords(part,
                                    coords[0] + dx, coords[1] + dy,
                                    coords[2] + dx, coords[3] + dy
                                )
                            else:
                                # For endpoints, move the oval
                                coords = self.canvas.coords(part)
                                self.canvas.coords(part,
                                    coords[0] + dx, coords[1] + dy,
                                    coords[2] + dx, coords[3] + dy
                                )
            
            self.drag_start = (x, y)
        elif 'vertical_guide' in tags:
            dx = x - self.drag_start[0]
            self.canvas.move(self.selected_guide, dx, 0)
            self.drag_start = (x, self.drag_start[1])
        elif 'horizontal_guide' in tags:
            dy = y - self.drag_start[1]
            self.canvas.move(self.selected_guide, 0, dy)
            self.drag_start = (self.drag_start[0], y)
    
    def guide_release(self, event):
        if self.selected_guide:
            # Get the shape_id of the selected guide
            tags = self.canvas.gettags(self.selected_guide)
            shape_id = None
            for tag in tags:
                if tag.startswith('shape_'):
                    shape_id = tag
                    break
                    
            if shape_id and 'marker' in tags:
                # Change color of all parts back to red
                for item in self.canvas.find_withtag(shape_id):
                    self.canvas.itemconfig(item, fill='red', outline='red')
                    
        self.selected_guide = None
        self.drag_start = None

    def restore_bindings(self):
        """Restore marker tool bindings and state"""
        # Clear any existing bindings first
        self.canvas.unbind('<Motion>')
        self.canvas.unbind('<Button-1>')
        self.canvas.unbind('<B1-Motion>')
        self.canvas.unbind('<ButtonRelease-1>')
        self.canvas.unbind('<Escape>')
        
        # Restore our bindings
        self.canvas.bind('<Motion>', self.on_mouse_move)
        self.canvas.bind('<Button-1>', self.on_canvas_click)
        self.canvas.bind('<B1-Motion>', self.guide_drag)
        self.canvas.bind('<ButtonRelease-1>', self.guide_release)
        self.canvas.bind('<Escape>', self.cancel_center_point_mode)
        
        # Restore active modes if any
        if self.center_point_mode:
            self.center_btn.configure(bg='#4CAF50')
            self.canvas.config(cursor="crosshair")
        elif self.guide_mode:
            if self.guide_mode == 'horizontal':
                self.add_h_guide_btn.configure(bg='#4CAF50')
            else:
                self.add_v_guide_btn.configure(bg='#4CAF50')
            self.canvas.bind('<Button-1>', self.on_guide_click)
            self.canvas.bind('<Button-3>', self.cancel_guide_mode)

    def add_center_marker(self, x, y):
        """Add a new center marker"""
        # Create unique timestamp-based ID
        shape_id = f"shape_{int(time.time() * 1000)}"
        
        # Create outer circle (fixed size regardless of zoom)
        radius = 8  # Fixed radius for visibility
        outer = self.canvas.create_oval(
            x - radius, y - radius,
            x + radius, y + radius,
            outline='red',
            width=2,
            tags=('center_point', 'marker', 'all_lines', shape_id)
        )
        
        # Create inner dot (fixed size)
        inner_radius = 3  # Fixed inner radius
        inner = self.canvas.create_oval(
            x - inner_radius, y - inner_radius,
            x + inner_radius, y + inner_radius,
            fill='red',
            outline='red',
            tags=('center_point', 'marker', 'all_lines', shape_id)
        )
        
        self.center_points.extend([outer, inner])

    def toggle_markers_visibility(self):
        # Toggle visibility of markers
        visible = self.show_markers_btn.cget("text") == "Hide Markers"
        self.show_markers_btn.configure(text="Show Markers" if visible else "Hide Markers")
        
        # Update all markers visibility
        state = 'hidden' if visible else 'normal'
        for marker in self.center_points:
            self.canvas.itemconfigure(marker, state=state)
        for line in self.line_markers:
            self.canvas.itemconfigure(line, state=state)

    def clear_markers(self):
        # Clear center points and line markers
        for marker in self.center_points[:]:
            self.canvas.delete(marker)
        self.center_points.clear()
        
        for line in self.line_markers[:]:
            self.canvas.delete(line)
        self.line_markers.clear()

    def toggle_guide_mode(self, guide_type):
        if guide_type == 'horizontal':
            self.guide_mode = 'horizontal'
            self.add_h_guide_btn.configure(bg='#4CAF50')  # Green when active
            self.add_v_guide_btn.configure(bg='#263d42')  # Reset other button
        else:
            self.guide_mode = 'vertical'
            self.add_v_guide_btn.configure(bg='#4CAF50')  # Green when active
            self.add_h_guide_btn.configure(bg='#263d42')  # Reset other button
        
        # Bind mouse events for guide creation
        self.canvas.bind('<Button-1>', self.on_guide_click)
        self.canvas.bind('<Button-3>', self.cancel_guide_mode)  # Right click to cancel

    def on_guide_click(self, event):
        if self.guide_mode == 'horizontal':
            self.add_horizontal_guide()
        else:
            self.add_vertical_guide()

    def cancel_guide_mode(self, event=None):
        self.guide_mode = None
        self.add_h_guide_btn.configure(bg='#263d42')
        self.add_v_guide_btn.configure(bg='#263d42')
        self.canvas.unbind('<Button-1>')
        self.canvas.unbind('<Button-3>')

    def toggle_line_mode(self):
        """Toggle line marker mode on/off"""
        self.line_mode = not self.line_mode
        
        # Cancel center point mode if active
        if self.line_mode and self.center_point_mode:
            self.cancel_center_point_mode()
        
        # Cancel guide mode if active
        if self.line_mode and self.guide_mode:
            self.cancel_guide_mode()
            
        if self.line_mode:
            self.line_btn.configure(bg='#4CAF50')  # Green when active
            self.canvas.config(cursor="crosshair")
            # Reset start point and preview elements
            self.line_start_point = None
            self.remove_preview()
            # Make sure our bindings are active
            self.restore_bindings()
        else:
            self.line_btn.configure(bg='#263d42')
            self.canvas.config(cursor="")
            self.remove_preview()
            self.line_start_point = None

    def add_line_marker(self, x1, y1, x2, y2):
        """Add a new line marker"""
        # Create unique timestamp-based ID
        shape_id = f"shape_{int(time.time() * 1000)}"
        
        # Fixed size for endpoint markers
        endpoint_radius = 4
        
        # Create endpoint markers (fixed size)
        start_point = self.canvas.create_oval(
            x1 - endpoint_radius, y1 - endpoint_radius,
            x1 + endpoint_radius, y1 + endpoint_radius,
            fill='red',
            outline='red',
            tags=('line_marker', 'marker', 'all_lines', shape_id)
        )
        
        # Create the dashed line
        line = self.canvas.create_line(
            x1, y1, x2, y2,
            dash=(5, 5),  # Create dashed line
            fill='red',
            width=2,  # Fixed width
            tags=('line_marker', 'marker', 'all_lines', shape_id)
        )
        
        # Create end point marker
        end_point = self.canvas.create_oval(
            x2 - endpoint_radius, y2 - endpoint_radius,
            x2 + endpoint_radius, y2 + endpoint_radius,
            fill='red',
            outline='red',
            tags=('line_marker', 'marker', 'all_lines', shape_id)
        )
        
        self.line_markers.extend([start_point, line, end_point]) 