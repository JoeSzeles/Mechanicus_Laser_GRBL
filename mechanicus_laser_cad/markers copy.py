import tkinter as tk
from tkinter import ttk
import time  # Add import for timestamp

class MarkersWindow:
    def __init__(self, root, canvas):
        self.root = root
        self.canvas = canvas
        self.guides = []  # Store guide objects
        self.center_points = []  # Store center point markers
        self.guides_locked = False
        self.guides_visible = True
        self.selected_guide = None
        self.drag_start = None
        self.snap_threshold = 10  # Pixels distance for snapping
        self.center_point_mode = False
        self.preview_circle = None
        self.snap_enabled = True  # New snap toggle state
        self.guide_mode = None  # Track current guide mode
        
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
        if self.preview_circle:
            self.canvas.delete(self.preview_circle)
            self.preview_circle = None
    
    def on_mouse_move(self, event):
        if not self.center_point_mode or not self.snap_var.get():
            return
            
        x = self.canvas.canvasx(event.x)
        y = self.canvas.canvasy(event.y)
        
        # Find potential center point under cursor
        center = self.find_nearest_center(x, y)
        
        # Update preview circle
        if center:
            cx, cy = center
            if self.preview_circle:
                self.canvas.coords(self.preview_circle, cx-7, cy-7, cx+7, cy+7)
            else:
                self.preview_circle = self.canvas.create_oval(
                    cx-7, cy-7, cx+7, cy+7,
                    outline='#4CAF50',  # Green outline
                    width=2,
                    tags='preview'
                )
        else:
            self.remove_preview()
    
    def on_canvas_click(self, event):
        if self.center_point_mode:
            x = self.canvas.canvasx(event.x)
            y = self.canvas.canvasy(event.y)
            
            if self.snap_var.get():  # Only snap if enabled
                # Find potential center point under cursor
                center = self.find_nearest_center(x, y)
                if center:
                    x, y = center
            
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
                self.selected_guide = item
                self.drag_start = (x, y)
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
        nearest_center = None
        min_distance = float('inf')
        
        # Check all items on canvas
        for item in self.canvas.find_all():
            tags = self.canvas.gettags(item)
            
            # Skip guides and center points
            if 'guide' in tags or 'center_point' in tags or 'marker' in tags:
                continue
                
            # Get item type and bounds
            item_type = tags[0] if tags else ''
            bounds = self.canvas.bbox(item)
            
            if not bounds:
                continue
                
            # Calculate center based on item type
            if 'circle' in item_type:
                cx = (bounds[0] + bounds[2]) / 2
                cy = (bounds[1] + bounds[3]) / 2
            elif 'rectangle' in item_type:
                cx = (bounds[0] + bounds[2]) / 2
                cy = (bounds[1] + bounds[3]) / 2
            elif 'arc' in item_type:
                cx = (bounds[0] + bounds[2]) / 2
                cy = (bounds[1] + bounds[3]) / 2
            elif 'line' in item_type:
                coords = self.canvas.coords(item)
                if len(coords) >= 4:  # Make sure it's a valid line
                    cx = (coords[0] + coords[2]) / 2
                    cy = (coords[1] + coords[3]) / 2
            elif 'polygon' in item_type:
                coords = self.canvas.coords(item)
                if coords:
                    cx = sum(coords[::2]) / (len(coords) // 2)
                    cy = sum(coords[1::2]) / (len(coords) // 2)
            elif 'ellipse' in item_type:
                # Placeholder for future ellipse implementation
                continue
            else:
                continue
            
            # Calculate distance to this center
            dist = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            if dist < min_distance and dist < self.snap_threshold:
                min_distance = dist
                nearest_center = (cx, cy)
        
        return nearest_center
    
    def update_center_point(self, marker, x, y):
        # Find nearest shape center
        nearest = self.find_nearest_center(x, y)
        if nearest:
            x, y = nearest
        
        # Update marker position
        size = 5
        self.canvas.coords(
            marker,
            x-size, y, x+size, y,  # Horizontal line
            x, y-size, x, y+size   # Vertical line
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
            # Set color to green when selected
            shape_id = None
            for tag in tags:
                if tag.startswith('shape_'):
                    shape_id = tag
                    break
                    
            if shape_id:
                # Change color of both parts of the cross to green
                for item in self.canvas.find_withtag(shape_id):
                    self.canvas.itemconfig(item, fill='#4CAF50')  # Green when selected
                    
            if self.snap_var.get():  # Only snap if enabled
                nearest = self.find_nearest_center(x, y)
                if nearest:
                    x, y = nearest
            
            # Find the paired marker line
            shape_id = None
            for tag in tags:
                if tag.startswith('shape_'):
                    shape_id = tag
                    break
                    
            if shape_id:
                # Find both parts of the cross using the shape_id
                for item in self.canvas.find_withtag(shape_id):
                    if item != self.selected_guide:
                        paired_marker = item
                        break
                
                # Move both lines of the cross
                size = 5
                if 'horizontal' in self.canvas.coords(self.selected_guide):  # If it's the horizontal line
                    self.canvas.coords(self.selected_guide, x-size, y, x+size, y)
                    self.canvas.coords(paired_marker, x, y-size, x, y+size)
                else:  # If it's the vertical line
                    self.canvas.coords(self.selected_guide, x, y-size, x, y+size)
                    self.canvas.coords(paired_marker, x-size, y, x+size, y)
            
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
                # Change color of both parts of the cross back to red
                for item in self.canvas.find_withtag(shape_id):
                    self.canvas.itemconfig(item, fill='red')
                    
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
        # Create unique timestamp-based ID
        shape_id = f"shape_{int(time.time() * 1000)}"
        # Create cross marker with fixed size
        size = 5  # Fixed size for markers
        # Create horizontal line
        marker1 = self.canvas.create_line(
            x-size, y, x+size, y,  # Horizontal line
            fill='red',
            width=1,
            tags=('center_point', 'marker', 'all_lines', shape_id)
        )
        # Add small delay to ensure unique timestamp
        time.sleep(0.001)
        # Create vertical line with same ID
        marker2 = self.canvas.create_line(
            x, y-size, x, y+size,  # Vertical line
            fill='red',
            width=1,
            tags=('center_point', 'marker', 'all_lines', shape_id)
        )
        self.center_points.extend([marker1, marker2])

    def toggle_markers_visibility(self):
        # Toggle visibility of markers
        visible = self.show_markers_btn.cget("text") == "Hide Markers"
        self.show_markers_btn.configure(text="Show Markers" if visible else "Hide Markers")
        
        # Update all markers visibility
        state = 'hidden' if visible else 'normal'
        for marker in self.center_points:
            self.canvas.itemconfigure(marker, state=state)

    def clear_markers(self):
        # Clear only the markers
        for marker in self.center_points[:]:
            self.canvas.delete(marker)
        self.center_points.clear()

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