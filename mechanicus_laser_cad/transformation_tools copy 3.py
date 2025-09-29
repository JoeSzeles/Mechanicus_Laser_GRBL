import tkinter as tk
from tkinter import ttk, messagebox
import math
import time

# Import undo/redo functions if available
try:
    from undoredo import save_canvas_state, set_canvas, init_canvas_history
except ImportError:
    print("Warning: Undo/redo functionality not available")
    
class TransformationTools:
    def __init__(self, parent_window, canvas):
        self.parent = parent_window
        self.canvas = canvas
        
        # Initialize state variables
        self.selected_shape = None
        self.original_coords = None
        self.original_colors = {}
        self.original_fills = {}
        self.original_widths = {}
        self.tools_window = None
        self.bounding_box = None
        self.scale_handles = []
        self.current_handle = None
        self.start_coords = None
        self.keep_aspect_ratio = tk.BooleanVar(value=False)
        self.original_bbox = None
        self.scale_entry_x = None
        self.scale_entry_y = None
        self.selection_mode = False
        
        # Bind to canvas deletion events
        self.canvas.bind('<Delete>', self.on_shape_delete)
        
        # Try to initialize undo/redo system if available
        try:
            set_canvas(canvas)
            init_canvas_history()
        except NameError:
            pass

    def show_tools_window(self):
        """Display the transformation tools window"""
        if self.tools_window is None or not tk.Toplevel.winfo_exists(self.tools_window):
            self.tools_window = tk.Toplevel(self.parent)
            self.tools_window.title("Transform Tools")
            self.tools_window.geometry("240x220+1700+240") 
            self.tools_window.resizable(False, False)
            self.tools_window.configure(bg="#263d42")
            self.tools_window.attributes('-topmost', True)
            
            # Create custom styles
            style = ttk.Style()
            style.configure('Dark.TFrame', background='#263d42')
            style.configure('Dark.TLabel', 
                          background='#263d42',
                          foreground='white')
            style.configure('Dark.TEntry',
                          fieldbackground='white',
                          foreground='black',
                          insertcolor='black')
            
            # Main label
            label = tk.Label(self.tools_window, text="Resize Shape", 
                           fg="white", bg="#263d42")
            label.pack(pady=10)
            
            # Button frame for aligned buttons
            button_frame = ttk.Frame(self.tools_window, style='Dark.TFrame')
            button_frame.pack(pady=5, padx=5, fill='x')
            
            # Select button
            self.select_btn = tk.Button(button_frame, text="Select",
                                      command=self.toggle_selection,
                                      fg='white', bg='#263d42',
                                      activebackground='#2ecc71',
                                      activeforeground='white',
                                      width=6)
            self.select_btn.pack(side='left', padx=2)
            
            # Deselect button
            deselect_btn = tk.Button(button_frame, text="Deselect",
                                   command=self.clear_selection,
                                   fg='white', bg='#263d42',
                                   activebackground='#2ecc71',
                                   activeforeground='white',
                                   width=6)
            deselect_btn.pack(side='left', padx=2)
            
            # Reset button
            reset_btn = tk.Button(button_frame, text="Reset",
                                command=self.reset_shape,
                                fg='white', bg='#263d42',
                                activebackground='#2ecc71',
                                activeforeground='white',
                                width=6)
            reset_btn.pack(side='left', padx=2)
            
            # Keep aspect ratio checkbox
            aspect_cb = tk.Checkbutton(self.tools_window, text="Keep Aspect Ratio", 
                                     variable=self.keep_aspect_ratio,
                                     command=self.on_aspect_ratio_change,
                                     fg="white", bg="#263d42",
                                     selectcolor="#263d42",
                                     activebackground="#263d42",
                                     activeforeground="white")
            aspect_cb.pack(pady=5)
            
            # Manual size input frame
            scale_frame = ttk.Frame(self.tools_window, style='Dark.TFrame')
            scale_frame.pack(pady=10, padx=5, fill='x')
            
            # X size
            ttk.Label(scale_frame, text="Size X (mm):", 
                     style='Dark.TLabel').grid(row=0, column=0, padx=5)
            self.scale_entry_x = ttk.Entry(scale_frame, width=8, style='Dark.TEntry')
            self.scale_entry_x.insert(0, "0.0")  # Will be updated when shape is selected
            self.scale_entry_x.grid(row=0, column=1, padx=5)
            self.scale_entry_x.bind('<KeyRelease>', self.on_size_entry_change)
            
            # Y size
            ttk.Label(scale_frame, text="Size Y (mm):", 
                     style='Dark.TLabel').grid(row=1, column=0, padx=5, pady=5)
            self.scale_entry_y = ttk.Entry(scale_frame, width=8, style='Dark.TEntry')
            self.scale_entry_y.insert(0, "0.0")  # Will be updated when shape is selected
            self.scale_entry_y.grid(row=1, column=1, padx=5, pady=5)
            self.scale_entry_y.bind('<KeyRelease>', self.on_size_entry_change)
            
            # Apply button at the top with other buttons
            apply_btn = tk.Button(button_frame, text="Apply",
                                command=self.apply_manual_scale,
                                fg='white', bg='#263d42',
                                activebackground='#2ecc71',
                                activeforeground='white',
                                width=6)
            apply_btn.pack(side='left', padx=2)
            
            # Handle window close
            self.tools_window.protocol("WM_DELETE_WINDOW", self.on_window_close)

    def toggle_selection(self):
        """Toggle selection mode"""
        self.selection_mode = not self.selection_mode
        if self.selection_mode:
            self.select_btn.configure(relief='sunken', bg='#2ecc71')
            self.canvas.config(cursor="crosshair")
            # Bind canvas events only when selection is active
            self.canvas.bind('<Button-1>', self.on_canvas_click)
            self.canvas.bind('<B1-Motion>', self.on_canvas_drag)
            self.canvas.bind('<ButtonRelease-1>', self.on_canvas_release)
        else:
            self.select_btn.configure(relief='raised', bg='#263d42')
            self.canvas.config(cursor="arrow")
            # Unbind canvas events when selection is inactive
            self.canvas.unbind('<Button-1>')
            self.canvas.unbind('<B1-Motion>')
            self.canvas.unbind('<ButtonRelease-1>')

    def on_aspect_ratio_change(self):
        """Handle aspect ratio checkbox changes"""
        if self.keep_aspect_ratio.get():
            # When enabled, sync Y to X
            try:
                x_value = float(self.scale_entry_x.get())
                self.scale_entry_y.delete(0, tk.END)
                self.scale_entry_y.insert(0, f"{x_value:.1f}")
            except ValueError:
                pass

    def on_size_entry_change(self, event=None):
        """Handle size entry changes"""
        if self.keep_aspect_ratio.get():
            # Sync the other entry if aspect ratio is locked
            try:
                if event.widget == self.scale_entry_x:
                    x_value = float(self.scale_entry_x.get())
                    self.scale_entry_y.delete(0, tk.END)
                    self.scale_entry_y.insert(0, f"{x_value:.1f}")
                else:
                    y_value = float(self.scale_entry_y.get())
                    self.scale_entry_x.delete(0, tk.END)
                    self.scale_entry_x.insert(0, f"{y_value:.1f}")
            except ValueError:
                pass

    def get_scale_factor(self):
        """Get current canvas scale factor"""
        try:
            # Get the canvas scale factor directly
            return self.canvas.scale_factor
        except AttributeError:
            return 1.0

    def apply_manual_scale(self):
        """Apply scaling from manual input in mm"""
        try:
            # Get desired sizes in mm
            target_width_mm = float(self.scale_entry_x.get())
            target_height_mm = float(self.scale_entry_y.get())
            
            if target_width_mm <= 0 or target_height_mm <= 0:
                raise ValueError("Sizes must be positive")
            
            if not self.selected_shape or not self.original_bbox:
                raise ValueError("No shape selected")
                
            # Get current scale factor
            scale_factor = self.get_scale_factor()
            
            # Get current size in pixels from original bbox
            current_width_pixels = self.original_bbox[2] - self.original_bbox[0]
            current_height_pixels = self.original_bbox[3] - self.original_bbox[1]
            
            # Convert current size to mm
            current_width_mm = current_width_pixels / scale_factor
            current_height_mm = current_height_pixels / scale_factor
            
            # Calculate scale factors based on mm measurements
            scale_x = target_width_mm / current_width_mm
            scale_y = target_height_mm / current_height_mm
            
            print(f"DEBUG Scale Application:")
            print(f"Scale factor: {scale_factor}")
            print(f"Current size (px): {current_width_pixels} x {current_height_pixels}")
            print(f"Current size (mm): {current_width_mm:.1f} x {current_height_mm:.1f}")
            print(f"Target size (mm): {target_width_mm:.1f} x {target_height_mm:.1f}")
            print(f"Scale factors: {scale_x:.3f} x {scale_y:.3f}")
            
            if self.keep_aspect_ratio.get():
                # Use the larger scale factor for both dimensions
                scale = max(scale_x, scale_y)
                scale_x = scale_y = scale
            
            # Apply scaling
            self.apply_scale(scale_x, scale_y)
            
            # Save state for undo/redo if available
            try:
                save_canvas_state()
            except NameError:
                pass
                
        except ValueError as e:
            messagebox.showerror("Error", str(e))

    def on_window_close(self):
        """Handle tools window closing"""
        self.clear_selection()
        self.canvas.config(cursor="arrow")
        # Unbind all events
        self.canvas.unbind('<Button-1>')
        self.canvas.unbind('<B1-Motion>')
        self.canvas.unbind('<ButtonRelease-1>')
        if self.tools_window:
            self.tools_window.destroy()
            self.tools_window = None

    def on_canvas_click(self, event):
        """Handle canvas clicks for shape selection and scaling"""
        x = self.canvas.canvasx(event.x)
        y = self.canvas.canvasy(event.y)
        
        # Check if clicking a scale handle
        handle = self.find_scale_handle(x, y)
        if handle:
            self.current_handle = handle
            self.start_coords = (x, y)
            return
            
        # Find shapes under click
        items = self.canvas.find_overlapping(x-5, y-5, x+5, y+5)
        
        # Filter out utility elements
        exclude_tags = ['grid_lines', 'below_all', 'above_all', 'snap_point', 'snap_line', 
                       'temp_marker', 'radius_marker', 'center_marker', 'temp', 
                       'guide_point', 'guide_line', 'crosshair', 'machine_pos',
                       'bounding_box', 'scale_handle']
        
        shapes = []
        for item in items:
            if self.canvas.type(item) in ['line', 'arc', 'oval', 'polygon', 'rectangle']:
                tags = self.canvas.gettags(item)
                if not any(tag in tags for tag in exclude_tags):
                    shapes.append(item)
        
        if shapes:
            # If clicking a different shape, deselect current one
            if self.selected_shape and self.selected_shape != shapes[0]:
                self.clear_selection()
            
            # Select the new shape
            self.select_shape(shapes[0])
        else:
            # Click in empty space - clear selection
            self.clear_selection()

    def on_canvas_drag(self, event):
        """Handle dragging for scaling"""
        if not self.current_handle or not self.start_coords:
            return
            
        x = self.canvas.canvasx(event.x)
        y = self.canvas.canvasy(event.y)
        
        # Calculate scale factors based on drag distance
        if not self.original_bbox:
            return
            
        orig_width = self.original_bbox[2] - self.original_bbox[0]
        orig_height = self.original_bbox[3] - self.original_bbox[1]
        
        # Calculate scale factors
        if 'e' in self.current_handle:  # East handles
            scale_x = (x - self.original_bbox[0]) / orig_width
        elif 'w' in self.current_handle:  # West handles
            scale_x = (self.original_bbox[2] - x) / orig_width
        else:
            scale_x = 1.0
            
        if 'n' in self.current_handle:  # North handles
            scale_y = (self.original_bbox[3] - y) / orig_height
        elif 's' in self.current_handle:  # South handles
            scale_y = (y - self.original_bbox[1]) / orig_height
        else:
            scale_y = 1.0
            
        # Keep aspect ratio if enabled
        if self.keep_aspect_ratio.get():
            if abs(scale_x - 1.0) > abs(scale_y - 1.0):
                scale_y = scale_x
            else:
                scale_x = scale_y
        
        # Apply scaling
        self.apply_scale(scale_x, scale_y)

    def on_canvas_release(self, event):
        """Handle release after scaling"""
        if self.current_handle:
            # Save state for undo/redo
            try:
                save_canvas_state()
            except NameError:
                pass
                
            self.current_handle = None
            self.start_coords = None

    def select_shape(self, shape_id):
        """Select a shape and create its bounding box"""
        self.selected_shape = shape_id
        
        # Store original properties
        shape_type = self.canvas.type(shape_id)
        if shape_type == 'line':
            self.original_colors[shape_id] = self.canvas.itemcget(shape_id, 'fill')
            self.original_widths[shape_id] = self.canvas.itemcget(shape_id, 'width')
        else:
            self.original_colors[shape_id] = self.canvas.itemcget(shape_id, 'outline')
            self.original_fills[shape_id] = self.canvas.itemcget(shape_id, 'fill')
            self.original_widths[shape_id] = self.canvas.itemcget(shape_id, 'width')
        
        # Store original coordinates
        self.original_coords = list(self.canvas.coords(shape_id))
        
        # Highlight selected shape
        if shape_type == 'line':
            self.canvas.itemconfig(shape_id, fill='green', width=2)
        else:
            self.canvas.itemconfig(shape_id, outline='green', width=2)
        
        # Create bounding box
        self.create_bounding_box()
        
        # Update size entries with current dimensions
        self.update_size_entries()

    def create_bounding_box(self):
        """Create or update the bounding box around selected shape"""
        # Remove existing bounding box and handles
        if self.bounding_box:
            self.canvas.delete(self.bounding_box)
        for handle in self.scale_handles:
            self.canvas.delete(handle)
        self.scale_handles = []
        
        if not self.selected_shape:
            return
            
        # Get shape bounds
        bbox = self.canvas.bbox(self.selected_shape)
        if not bbox:
            return
            
        # Store original bbox
        self.original_bbox = bbox
        
        # Create dashed bounding box
        self.bounding_box = self.canvas.create_rectangle(
            bbox[0], bbox[1], bbox[2], bbox[3],
            outline='blue', dash=(2, 2),
            tags='bounding_box'
        )
        
        # Create scale handles
        handle_size = 6
        positions = [
            ('nw', bbox[0], bbox[1]),
            ('n', (bbox[0] + bbox[2])/2, bbox[1]),
            ('ne', bbox[2], bbox[1]),
            ('e', bbox[2], (bbox[1] + bbox[3])/2),
            ('se', bbox[2], bbox[3]),
            ('s', (bbox[0] + bbox[2])/2, bbox[3]),
            ('sw', bbox[0], bbox[3]),
            ('w', bbox[0], (bbox[1] + bbox[3])/2)
        ]
        
        for pos, x, y in positions:
            handle = self.canvas.create_rectangle(
                x - handle_size, y - handle_size,
                x + handle_size, y + handle_size,
                fill='white', outline='blue',
                tags=('scale_handle', f'handle_{pos}')
            )
            self.scale_handles.append(handle)

    def find_scale_handle(self, x, y):
        """Find which scale handle is under the given coordinates"""
        for handle in self.scale_handles:
            bbox = self.canvas.bbox(handle)
            if bbox[0] <= x <= bbox[2] and bbox[1] <= y <= bbox[3]:
                tags = self.canvas.gettags(handle)
                for tag in tags:
                    if tag.startswith('handle_'):
                        return tag[7:]  # Return handle position (nw, n, ne, etc.)
        return None

    def apply_scale(self, scale_x, scale_y):
        """Apply scaling to the selected shape"""
        if not self.selected_shape or not self.original_coords:
            return
            
        try:
            # Check if shape still exists
            self.canvas.coords(self.selected_shape)
            
            # Get shape center from original bbox
            if not self.original_bbox:
                return
                
            center_x = (self.original_bbox[0] + self.original_bbox[2]) / 2
            center_y = (self.original_bbox[1] + self.original_bbox[3]) / 2
            
            # Scale coordinates around center
            new_coords = []
            for i in range(0, len(self.original_coords), 2):
                x = self.original_coords[i]
                y = self.original_coords[i + 1]
                
                # Scale relative to center
                dx = x - center_x
                dy = y - center_y
                new_x = center_x + dx * scale_x
                new_y = center_y + dy * scale_y
                
                new_coords.extend([new_x, new_y])
            
            # Update shape coordinates
            self.canvas.coords(self.selected_shape, *new_coords)
            
            # Update bounding box
            self.create_bounding_box()
            
            # Update size entries with actual dimensions
            self.update_size_entries()
            
        except tk.TclError:
            # Shape no longer exists
            self.clear_selection()

    def clear_selection(self):
        """Clear current selection and reset transform state"""
        if self.selected_shape:
            # Restore original appearance
            shape_type = self.canvas.type(self.selected_shape)
            if shape_type == 'line':
                self.canvas.itemconfig(
                    self.selected_shape,
                    fill=self.original_colors.get(self.selected_shape, 'black'),
                    width=self.original_widths.get(self.selected_shape, 1)
                )
            else:
                self.canvas.itemconfig(
                    self.selected_shape,
                    outline=self.original_colors.get(self.selected_shape, 'black'),
                    fill=self.original_fills.get(self.selected_shape, ''),
                    width=self.original_widths.get(self.selected_shape, 1)
                )
        
        # Clear bounding box and handles
        if self.bounding_box:
            self.canvas.delete(self.bounding_box)
            self.bounding_box = None
        for handle in self.scale_handles:
            self.canvas.delete(handle)
        self.scale_handles = []
        
        # Reset state
        self.selected_shape = None
        self.original_coords = None
        self.original_bbox = None
        self.current_handle = None
        self.start_coords = None
        
        # Reset scale entries
        if self.scale_entry_x and self.scale_entry_y:
            self.scale_entry_x.delete(0, tk.END)
            self.scale_entry_x.insert(0, "0.0")
            self.scale_entry_y.delete(0, tk.END)
            self.scale_entry_y.insert(0, "0.0")

    def reset_shape(self):
        """Reset the selected shape to its original state"""
        if not self.selected_shape or not self.original_coords:
            return
            
        # Save state before reset
        try:
            save_canvas_state()
        except NameError:
            pass
            
        # Reset coordinates to original
        self.canvas.coords(self.selected_shape, *self.original_coords)
        
        # Update bounding box
        self.create_bounding_box()
        
        # Update size entries with original dimensions
        self.update_size_entries()
        
        # Save state after reset
        try:
            save_canvas_state()
        except NameError:
            pass

    def update_size_entries(self):
        """Update size entries with current shape dimensions in mm"""
        if not self.selected_shape or not self.original_bbox:
            return
            
        # Get current scale factor
        scale_factor = self.get_scale_factor()
        
        # Get current dimensions in pixels
        width_pixels = self.original_bbox[2] - self.original_bbox[0]
        height_pixels = self.original_bbox[3] - self.original_bbox[1]
        
        # Convert to millimeters (at 100% zoom, 1 pixel = 1 mm)
        width_mm = width_pixels / scale_factor
        height_mm = height_pixels / scale_factor
        
        print(f"DEBUG Size Measurement:")
        print(f"Scale factor: {scale_factor}")
        print(f"Dimensions in pixels: {width_pixels} x {height_pixels}")
        print(f"Dimensions in mm: {width_mm:.1f} x {height_mm:.1f}")
        
        # Force update entries with actual mm values
        if self.scale_entry_x and self.scale_entry_y:
            self.scale_entry_x.delete(0, tk.END)
            self.scale_entry_x.insert(0, f"{width_mm:.1f}")
            self.scale_entry_y.delete(0, tk.END)
            self.scale_entry_y.insert(0, f"{height_mm:.1f}")
            # Force update
            self.scale_entry_x.update()
            self.scale_entry_y.update()

    def on_shape_delete(self, event=None):
        """Handle shape deletion"""
        if self.selected_shape:
            try:
                # Check if shape still exists
                self.canvas.coords(self.selected_shape)
                # If no error, delete the shape
                self.canvas.delete(self.selected_shape)
            except tk.TclError:
                pass  # Shape already deleted
            finally:
                # Clean up selection
                self.clear_selection() 