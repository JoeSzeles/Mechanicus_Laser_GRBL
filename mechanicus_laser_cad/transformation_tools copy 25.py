import tkinter as tk
from tkinter import ttk, messagebox
import math
import time

# Import undo/redo functions if available
try:
    from undoredo import save_canvas_state, set_canvas, init_canvas_history, set_grid_var, set_scale_var, set_grid_size_var
except ImportError:
    print("Warning: Undo/redo functionality not available")
    
class TransformationTools:
    def __init__(self, parent_window, canvas):
        self.parent = parent_window
        self.canvas = canvas
        
        # Set up undo/redo system
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
        
        # Tool states
        self.active_tool = None  # Current active tool: 'select', 'mirror', 'clone', None
        self.selection_mode = False
        self.mirror_mode = False
        self.clone_mode = False
        self.mirror_axis = None
        self.create_copy = tk.BooleanVar(value=True)
        self.mirror_preview = None
        self.mirror_preview_axis = None
        
        # Clone tool variables
        self.clone_preview = None
        self.clone_drag_start = None
        self.alt_pressed = False
        
        # Bind to canvas deletion events
        self.canvas.bind('<Delete>', self.on_shape_delete)
        # Bind Alt key events for clone tool
        self.canvas.bind('<Alt_L>', self.on_alt_press)
        self.canvas.bind('<KeyRelease-Alt_L>', self.on_alt_release)

    def show_tools_window(self):
        """Display the transformation tools window"""
        # Re-initialize undo/redo system when tools window is opened
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
            self.tools_window.title("Transform Tools")
            self.tools_window.geometry("240x400")
            self.tools_window.resizable(False, False)
            self.tools_window.configure(bg="#263d42")
            self.tools_window.attributes('-topmost', True)
            
            # Create notebook for tabs
            style = ttk.Style()
            style.configure('Custom.TNotebook', background='#263d42')
            style.configure('Custom.TNotebook.Tab', 
                          background='#808080',  # Light gray for unselected tabs
                          foreground='#000000',  # Black text for unselected
                          borderwidth=0,
                          focuscolor='#263d42',
                          padding=[10, 2])  # Add padding for better visibility
            style.map('Custom.TNotebook.Tab',
                     background=[('selected', '#2b2b2b'), ('!selected', '#808080')],  # Dark gray for selected, light gray for unselected
                     foreground=[('selected', '#000000'), ('!selected', '#000000')])  # Black text for both states
            
            # Configure other styles
            style.configure('Custom.TFrame', background='#263d42')
            style.configure('Custom.TLabel', background='#263d42', foreground='white')
            
            # Configure entry style
            style.configure('Custom.TEntry', 
                          fieldbackground='#2b2b2b',
                          foreground='white',
                          insertcolor='white')
            
            notebook = ttk.Notebook(self.tools_window, style='Custom.TNotebook')
            notebook.pack(fill='both', expand=True, padx=5, pady=5)
            
            # Scale tab
            scale_frame = ttk.Frame(notebook, style='Custom.TFrame')
            notebook.add(scale_frame, text='Scale')
            
            # Mirror tab
            mirror_frame = ttk.Frame(notebook, style='Custom.TFrame')
            notebook.add(mirror_frame, text='Mirror')
            
            # Clone tab
            clone_frame = ttk.Frame(notebook, style='Custom.TFrame')
            notebook.add(clone_frame, text='Clone')
            
            # Rotate tab
            rotate_frame = ttk.Frame(notebook, style='Custom.TFrame')
            notebook.add(rotate_frame, text='Rotate')
            
            # Setup tools in each tab
            self.setup_scale_tools(scale_frame)
            self.setup_mirror_tools(mirror_frame)
            self.setup_clone_tools(clone_frame)
            self.setup_rotate_tools(rotate_frame)
            
            # Handle window close
            self.tools_window.protocol("WM_DELETE_WINDOW", self.on_window_close)

    def setup_scale_tools(self, parent):
        """Setup the scale tools UI"""
        # Main label
        label = tk.Label(parent, text="Resize Shape", 
                        fg="white", bg="#263d42")
        label.pack(pady=10)
        
        # Button frame for aligned buttons
        button_frame = ttk.Frame(parent, style='Custom.TFrame')
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
        
        # Apply button
        apply_btn = tk.Button(button_frame, text="Apply",
                            command=self.apply_manual_scale,
                            fg='white', bg='#263d42',
                            activebackground='#2ecc71',
                            activeforeground='white',
                            width=6)
        apply_btn.pack(side='left', padx=2)
        
        # Keep aspect ratio checkbox
        aspect_cb = tk.Checkbutton(parent, text="Keep Aspect Ratio", 
                                    variable=self.keep_aspect_ratio,
                                    command=self.on_aspect_ratio_change,
                                    fg="white", bg="#263d42",
                                    selectcolor="#263d42",
                                    activebackground="#263d42",
                                    activeforeground="white")
        aspect_cb.pack(pady=5)
        
        # Manual size input frame
        scale_frame = ttk.Frame(parent, style='Custom.TFrame')
        scale_frame.pack(pady=10, padx=5, fill='x')
        
        # X size
        ttk.Label(scale_frame, text="Size X (mm):", 
                style='Custom.TLabel').grid(row=0, column=0, padx=5)
        self.scale_entry_x = ttk.Entry(scale_frame, width=8)
        self.scale_entry_x.insert(0, "0.0")
        self.scale_entry_x.grid(row=0, column=1, padx=5)
        self.scale_entry_x.bind('<KeyRelease>', self.on_size_entry_change)
        
        # Y size
        ttk.Label(scale_frame, text="Size Y (mm):", 
                style='Custom.TLabel').grid(row=1, column=0, padx=5, pady=5)
        self.scale_entry_y = ttk.Entry(scale_frame, width=8)
        self.scale_entry_y.insert(0, "0.0")
        self.scale_entry_y.grid(row=1, column=1, padx=5, pady=5)
        self.scale_entry_y.bind('<KeyRelease>', self.on_size_entry_change)

    def setup_mirror_tools(self, parent):
        """Setup the mirror tools UI"""
        # Main label
        label = tk.Label(parent, text="Mirror Shape", 
                        fg="white", bg="#263d42")
        label.pack(pady=10)
        
        # Button frame for aligned buttons
        button_frame = ttk.Frame(parent, style='Custom.TFrame')
        button_frame.pack(pady=5, padx=5, fill='x')
        
        # Select button
        self.mirror_select_btn = tk.Button(button_frame, text="Select",
                                         command=self.toggle_mirror_selection,
                                         fg='white', bg='#263d42',
                                         activebackground='#2ecc71',
                                         activeforeground='white',
                                         width=6)
        self.mirror_select_btn.pack(side='left', padx=2)
        
        # Select Axis button
        self.axis_select_btn = tk.Button(button_frame, text="Axis",
                                       command=self.toggle_axis_selection,
                                       fg='white', bg='#263d42',
                                       activebackground='#2ecc71',
                                       activeforeground='white',
                                       width=6)
        self.axis_select_btn.pack(side='left', padx=2)
        
        # Deselect button
        deselect_btn = tk.Button(button_frame, text="Deselect",
                                command=self.clear_mirror_selection,
                                fg='white', bg='#263d42',
                                activebackground='#2ecc71',
                                activeforeground='white',
                                width=6)
        deselect_btn.pack(side='left', padx=2)
        
        # Reset button
        reset_btn = tk.Button(button_frame, text="Reset",
                             command=self.reset_mirrored_shape,
                             fg='white', bg='#263d42',
                             activebackground='#2ecc71',
                             activeforeground='white',
                             width=6)
        reset_btn.pack(side='left', padx=2)
        
        # Quick mirror buttons frame
        quick_mirror_frame = ttk.Frame(parent, style='Custom.TFrame')
        quick_mirror_frame.pack(pady=10, padx=5, fill='x')
        
        # Flip Horizontal button
        flip_h_btn = tk.Button(quick_mirror_frame, text="Flip Horizontal",
                              command=self.flip_horizontal,
                              fg='white', bg='#263d42',
                              activebackground='#2ecc71',
                              activeforeground='white')
        flip_h_btn.pack(side='left', padx=2, expand=True)
        
        # Flip Vertical button
        flip_v_btn = tk.Button(quick_mirror_frame, text="Flip Vertical",
                              command=self.flip_vertical,
                              fg='white', bg='#263d42',
                              activebackground='#2ecc71',
                              activeforeground='white')
        flip_v_btn.pack(side='left', padx=2, expand=True)
        
        # Create copy checkbox
        copy_cb = tk.Checkbutton(parent, text="Create Copy", 
                                variable=self.create_copy,
                                fg="white", bg="#263d42",
                                selectcolor="#263d42",
                                activebackground="#263d42",
                                activeforeground="white")
        copy_cb.pack(pady=5)

    def setup_clone_tools(self, parent):
        """Setup the clone tools UI"""
        # Main label
        label = tk.Label(parent, text="Clone Shape", 
                        fg="white", bg="#263d42")
        label.pack(pady=10)
        
        # Button frame for aligned buttons
        button_frame = ttk.Frame(parent, style='Custom.TFrame')
        button_frame.pack(pady=5, padx=5, fill='x')
        
        # Select button
        self.clone_select_btn = tk.Button(button_frame, text="Select",
                                        command=self.toggle_clone_selection,
                                        fg='white', bg='#263d42',
                                        activebackground='#2ecc71',
                                        activeforeground='white',
                                        width=6)
        self.clone_select_btn.pack(side='left', padx=2)
        
        # Clone button
        clone_btn = tk.Button(button_frame, text="Clone",
                            command=self.create_adjacent_clone,
                            fg='white', bg='#263d42',
                            activebackground='#2ecc71',
                            activeforeground='white',
                            width=6)
        clone_btn.pack(side='left', padx=2)
        
        # Deselect button
        deselect_btn = tk.Button(button_frame, text="Deselect",
                                command=self.clear_selection,
                                fg='white', bg='#263d42',
                                activebackground='#2ecc71',
                                activeforeground='white',
                                width=6)
        deselect_btn.pack(side='left', padx=2)
        
        # Delete button
        delete_btn = tk.Button(button_frame, text="Delete",
                             command=self.delete_selected_shape,
                             fg='white', bg='#263d42',
                             activebackground='#2ecc71',
                             activeforeground='white',
                             width=6)
        delete_btn.pack(side='left', padx=2)
        
        # Instructions label
        instructions = tk.Label(parent, 
                              text="Quick Clone:\nAlt + Left Click & Drag",
                              fg="white", bg="#263d42",
                              justify=tk.LEFT)
        instructions.pack(pady=10, padx=5, anchor='w')

    def setup_rotate_tools(self, parent):
        """Setup the rotate tools UI"""
        # Main label
        label = tk.Label(parent, text="Rotate Shape", 
                        fg="white", bg="#263d42")
        label.pack(pady=10)
        
        # Button frame for aligned buttons
        button_frame = ttk.Frame(parent, style='Custom.TFrame')
        button_frame.pack(pady=5, padx=5, fill='x')
        
        # Select button
        self.rotate_select_btn = tk.Button(button_frame, text="Select",
                                         command=self.toggle_rotate_selection,
                                         fg='white', bg='#263d42',
                                         activebackground='#2ecc71',
                                         activeforeground='white',
                                         width=6)
        self.rotate_select_btn.pack(side='left', padx=2)
        
        # Set Center button
        self.center_select_btn = tk.Button(button_frame, text="Center",
                                         command=self.set_rotation_center,
                                         fg='white', bg='#263d42',
                                         activebackground='#2ecc71',
                                         activeforeground='white',
                                         width=6)
        self.center_select_btn.pack(side='left', padx=2)
        
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
                             command=self.reset_rotation,
                             fg='white', bg='#263d42',
                             activebackground='#2ecc71',
                             activeforeground='white',
                             width=6)
        reset_btn.pack(side='left', padx=2)
        
        # Angle snap checkbox
        self.angle_snap = tk.BooleanVar(value=True)
        angle_snap_cb = tk.Checkbutton(parent, text="Snap to 5°", 
                                      variable=self.angle_snap,
                                      fg="white", bg="#263d42",
                                      selectcolor="#263d42",
                                      activebackground="#263d42",
                                      activeforeground="white")
        angle_snap_cb.pack(pady=5)
        
        # Quick rotate buttons frame
        quick_rotate_frame = ttk.Frame(parent, style='Custom.TFrame')
        quick_rotate_frame.pack(pady=10, padx=5, fill='x')
        
        # Rotate CCW button
        rotate_ccw_btn = tk.Button(quick_rotate_frame, text="Rotate -90°",
                                  command=lambda: self.quick_rotate(-90),
                                  fg='white', bg='#263d42',
                                  activebackground='#2ecc71',
                                  activeforeground='white')
        rotate_ccw_btn.pack(side='left', padx=2, expand=True)
        
        # Rotate CW button
        rotate_cw_btn = tk.Button(quick_rotate_frame, text="Rotate +90°",
                                 command=lambda: self.quick_rotate(90),
                                 fg='white', bg='#263d42',
                                 activebackground='#2ecc71',
                                 activeforeground='white')
        rotate_cw_btn.pack(side='left', padx=2, expand=True)

    def toggle_selection(self):
        """Toggle selection mode"""
        if self.active_tool == 'select':
            # Deactivate selection mode
            self.selection_mode = False
            self.active_tool = None
            self.select_btn.configure(relief='raised', bg='#263d42')
            self.canvas.config(cursor="arrow")
            self.unbind_all_events()
            self.clear_selection()
        else:
            # Deactivate other tools first
            self.deactivate_all_tools()
            
            # Activate selection mode
            self.selection_mode = True
            self.active_tool = 'select'
            self.select_btn.configure(relief='sunken', bg='#2ecc71')
            self.canvas.config(cursor="crosshair")
            self.bind_selection_events()

    def toggle_mirror_selection(self):
        """Toggle mirror selection mode"""
        if self.active_tool == 'mirror':
            # Deactivate mirror mode
            self.mirror_mode = False
            self.active_tool = None
            self.mirror_select_btn.configure(relief='raised', bg='#263d42')
            self.canvas.config(cursor="arrow")
            self.unbind_all_events()
            self.clear_mirror_selection()
        else:
            # Deactivate other tools first
            self.deactivate_all_tools()
            
            # Activate mirror mode
            self.mirror_mode = True
            self.active_tool = 'mirror'
            self.mirror_select_btn.configure(relief='sunken', bg='#2ecc71')
            self.canvas.config(cursor="crosshair")
            self.bind_mirror_events()

    def toggle_clone_selection(self):
        """Toggle clone selection mode"""
        if self.active_tool == 'clone':
            # Deactivate clone mode
            self.clone_mode = False
            self.active_tool = None
            self.clone_select_btn.configure(relief='raised', bg='#263d42')
            self.canvas.config(cursor="arrow")
            self.unbind_all_events()
            self.clear_selection()
        else:
            # Deactivate other tools first
            self.deactivate_all_tools()
            
            # Activate clone mode
            self.clone_mode = True
            self.active_tool = 'clone'
            self.clone_select_btn.configure(relief='sunken', bg='#2ecc71')
            self.canvas.config(cursor="crosshair")
            self.bind_clone_events()

    def toggle_rotate_selection(self):
        """Toggle rotation selection mode"""
        if self.active_tool == 'rotate':
            # Deactivate rotation mode
            self.rotate_mode = False
            self.active_tool = None
            self.rotate_select_btn.configure(relief='raised', bg='#263d42')
            self.canvas.config(cursor="arrow")
            self.unbind_all_events()
            self.clear_selection()
            self.clear_rotation_markers()
        else:
            # Deactivate other tools first
            self.deactivate_all_tools()
            
            # Activate rotation mode
            self.rotate_mode = True
            self.active_tool = 'rotate'
            self.rotate_select_btn.configure(relief='sunken', bg='#2ecc71')
            self.canvas.config(cursor="crosshair")
            self.bind_rotate_events()
            
            # Initialize rotation state
            self.rotate_state = 'select_shape'
            self.rotation_point = None
            self.original_coords = None
            self.start_angle = None
            self.cumulative_angle = 0

    def deactivate_all_tools(self):
        """Deactivate all tools and reset their states"""
        # Reset selection tool
        self.selection_mode = False
        if hasattr(self, 'select_btn'):
            self.select_btn.configure(relief='raised', bg='#263d42')
            
        # Reset mirror tool
        self.mirror_mode = False
        if hasattr(self, 'mirror_select_btn'):
            self.mirror_select_btn.configure(relief='raised', bg='#263d42')
        if hasattr(self, 'axis_select_btn'):
            self.axis_select_btn.configure(relief='raised', bg='#263d42')
            
        # Reset clone tool
        self.clone_mode = False
        if hasattr(self, 'clone_select_btn'):
            self.clone_select_btn.configure(relief='raised', bg='#263d42')
        
        # Clear selections and previews
        self.clear_selection()
        self.clear_mirror_selection()
        self.clear_clone_preview()
        
        # Reset tool state
        self.active_tool = None
        
        # Reset cursor
        self.canvas.config(cursor="arrow")
        
        # Unbind all events
        self.unbind_all_events()

    def bind_selection_events(self):
        """Bind events for selection mode"""
        self.unbind_all_events()
        self.canvas.bind('<Button-1>', self.on_canvas_click)
        self.canvas.bind('<B1-Motion>', self.on_canvas_drag)
        self.canvas.bind('<ButtonRelease-1>', self.on_canvas_release)

    def bind_mirror_events(self):
        """Bind events for mirror mode"""
        self.unbind_all_events()
        self.canvas.bind('<Button-1>', self.on_mirror_click)

    def bind_clone_events(self):
        """Bind events for clone mode"""
        self.unbind_all_events()
        self.canvas.bind('<Button-1>', self.on_canvas_click)
        # Use separate bindings for Alt key and mouse events
        self.canvas.bind('<Alt-Button-1>', self.on_alt_click)
        self.canvas.bind('<Alt-B1-Motion>', self.on_clone_drag)
        self.canvas.bind('<Alt-ButtonRelease-1>', self.on_clone_release)

    def bind_rotate_events(self):
        """Bind events for rotation mode"""
        self.unbind_all_events()
        self.canvas.bind('<Button-1>', self.on_rotate_click)
        self.canvas.bind('<B1-Motion>', self.on_rotate_drag)
        self.canvas.bind('<ButtonRelease-1>', self.on_rotate_release)
        self.canvas.bind('<Motion>', self.on_rotate_motion)

    def unbind_all_events(self):
        """Unbind all tool-related events"""
        self.canvas.unbind('<Button-1>')
        self.canvas.unbind('<B1-Motion>')
        self.canvas.unbind('<ButtonRelease-1>')
        self.canvas.unbind('<Motion>')

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
            
            if not self.selected_shape:
                raise ValueError("No shape selected")
                
            # Verify shape still exists
            try:
                self.canvas.coords(self.selected_shape)
            except tk.TclError:
                self.clear_selection()
                raise ValueError("Shape no longer exists")
                
            if not self.original_bbox:
                raise ValueError("Invalid bounding box")
                
            # Get current dimensions in pixels from original bbox
            current_width_pixels = self.original_bbox[2] - self.original_bbox[0]
            current_height_pixels = self.original_bbox[3] - self.original_bbox[1]
            
            # Convert target mm to pixels (at 100% zoom, 1mm = 1px)
            target_width_pixels = target_width_mm
            target_height_pixels = target_height_mm
            
            # Calculate scale factors directly from pixel values
            scale_x = target_width_pixels / current_width_pixels
            scale_y = target_height_pixels / current_height_pixels
            
            print(f"DEBUG Scale Application:")
            print(f"Current size (px): {current_width_pixels} x {current_height_pixels}")
            print(f"Target size (px): {target_width_pixels} x {target_height_pixels}")
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
        self.deactivate_all_tools()
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
            # Click in empty space - clear selection and deactivate selection mode
            self.clear_selection()
            if self.selection_mode:
                self.toggle_selection()  # This will reset the button and deactivate selection mode

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
        # Clear any previous selection first
        self.clear_selection()
        
        self.selected_shape = shape_id
        
        # Store original properties
        shape_type = self.canvas.type(shape_id)
        tags = self.canvas.gettags(shape_id)
        
        # Check if this is a converted shape
        for tag in tags:
            if tag.startswith('converted_'):
                shape_type = tag.split('_')[1]
                break
        
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
            # Save state before scaling
            save_canvas_state()
            
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
            
            # Save state after scaling
            save_canvas_state()
            
        except tk.TclError:
            # Shape no longer exists
            self.clear_selection()

    def clear_selection(self):
        """Clear current selection and remove bounding box"""
        if self.selected_shape:
            try:
                self.canvas.itemconfig(self.selected_shape, fill=self.original_fills.get(self.selected_shape, ''))
                if self.canvas.type(self.selected_shape) == 'line':
                    self.canvas.itemconfig(self.selected_shape, fill=self.original_colors.get(self.selected_shape, 'black'))
                else:
                    self.canvas.itemconfig(self.selected_shape, outline=self.original_colors.get(self.selected_shape, 'black'))
            except tk.TclError:
                pass  # Shape might have been deleted
        
        # Clear bounding box and handles
        if self.bounding_box:
            self.canvas.delete(self.bounding_box)
            self.bounding_box = None
        for handle in self.scale_handles:
            self.canvas.delete(handle)
        self.scale_handles = []
        
        # Clear all items with bounding_box or scale_handle tags
        for item in self.canvas.find_withtag('bounding_box'):
            self.canvas.delete(item)
        for item in self.canvas.find_withtag('scale_handle'):
            self.canvas.delete(item)
        
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
        save_canvas_state()
            
        # Reset coordinates to original
        self.canvas.coords(self.selected_shape, *self.original_coords)
        
        # Update bounding box
        self.create_bounding_box()
        
        # Update size entries with original dimensions
        self.update_size_entries()
        
        # Save state after reset
        save_canvas_state()

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
            except tk.TclError:
                # Shape was deleted, clean up selection
                self.clear_selection()
                return
                
        # Also check for any line editor bounding boxes
        for item in self.canvas.find_withtag('bounding_box'):
            self.canvas.delete(item)
        for item in self.canvas.find_withtag('scale_handle'):
            self.canvas.delete(item) 

    def toggle_axis_selection(self):
        """Toggle axis selection mode"""
        if not self.selected_shape:
            messagebox.showerror("Error", "Please select a shape first")
            return
            
        self.axis_select_btn.configure(relief='sunken', bg='#2ecc71')
        self.canvas.config(cursor="crosshair")
        self.canvas.bind('<Button-1>', self.on_axis_click)
        self.canvas.bind('<Motion>', self.on_axis_motion)

    def on_mirror_click(self, event):
        """Handle shape selection for mirroring"""
        x = self.canvas.canvasx(event.x)
        y = self.canvas.canvasy(event.y)
        
        items = self.canvas.find_overlapping(x-5, y-5, x+5, y+5)
        shapes = [item for item in items if self.canvas.type(item) in 
                 ['line', 'arc', 'oval', 'polygon', 'rectangle']]
        
        if shapes:
            if self.selected_shape and self.selected_shape != shapes[0]:
                self.clear_mirror_selection()
            self.select_shape(shapes[0])
        else:
            self.clear_mirror_selection()

    def on_axis_click(self, event):
        """Handle axis line selection"""
        x = self.canvas.canvasx(event.x)
        y = self.canvas.canvasy(event.y)
        
        items = self.canvas.find_overlapping(x-5, y-5, x+5, y+5)
        lines = [item for item in items if self.canvas.type(item) == 'line' and 
                'grid_lines' not in self.canvas.gettags(item)]  # Explicitly exclude grid lines
        
        if lines:
            self.mirror_axis = lines[0]
            self.axis_select_btn.configure(relief='raised', bg='#263d42')
            self.canvas.config(cursor="arrow")
            self.canvas.unbind('<Button-1>')
            self.canvas.unbind('<Motion>')
            self.clear_preview()
            self.mirror_along_line()

    def on_axis_motion(self, event):
        """Preview the mirror axis"""
        x = self.canvas.canvasx(event.x)
        y = self.canvas.canvasy(event.y)
        
        items = self.canvas.find_overlapping(x-5, y-5, x+5, y+5)
        lines = [item for item in items if self.canvas.type(item) == 'line' and 
                'grid_lines' not in self.canvas.gettags(item)]  # Explicitly exclude grid lines
        
        # Clear any existing preview
        self.clear_preview()
        
        # Only proceed if we found a valid line
        if lines:
            try:
                coords = self.canvas.coords(lines[0])
                # Make sure we have all 4 coordinates needed for a line
                if len(coords) == 4:
                    self.mirror_preview_axis = self.canvas.create_line(
                        coords[0], coords[1], coords[2], coords[3],
                        fill='green', width=2, dash=(5,5)
                    )
                    # Preview the mirrored shape
                    self.preview_mirror_along_line(lines[0])
            except (IndexError, tk.TclError):
                # Handle any errors gracefully
                pass

    def clear_preview(self):
        """Clear mirror preview elements"""
        if self.mirror_preview:
            self.canvas.delete(self.mirror_preview)
            self.mirror_preview = None
        if self.mirror_preview_axis:
            self.canvas.delete(self.mirror_preview_axis)
            self.mirror_preview_axis = None

    def clear_mirror_selection(self):
        """Clear mirror selection and reset state"""
        self.clear_selection()
        self.mirror_axis = None
        self.clear_preview()
        self.mirror_select_btn.configure(relief='raised', bg='#263d42')
        self.axis_select_btn.configure(relief='raised', bg='#263d42')
        self.canvas.config(cursor="arrow")
        self.canvas.unbind('<Button-1>')
        self.canvas.unbind('<Motion>')

    def mirror_along_line(self):
        """Mirror the selected shape along the selected line"""
        if not self.selected_shape or not self.mirror_axis:
            return
            
        # Save state before mirroring
        save_canvas_state()
            
        # Get line coordinates
        line_coords = self.canvas.coords(self.mirror_axis)
        x1_line, y1_line, x2_line, y2_line = line_coords
        
        # Get shape type and convert to points
        shape_type = self.canvas.type(self.selected_shape)
        shape_points = self.shape_to_points(self.selected_shape)
        
        # Reflect all points
        mirrored_coords = self.calculate_mirrored_coords(shape_points, x1_line, y1_line, x2_line, y2_line)
        
        # Use stored original colors instead of current colors
        if shape_type == 'line':
            original_fill = self.original_colors.get(self.selected_shape, 'black')
            original_width = self.original_widths.get(self.selected_shape, 1)
            kwargs = {
                'fill': original_fill,
                'width': original_width
            }
        else:
            original_outline = self.original_colors.get(self.selected_shape, 'black')
            original_fill = self.original_fills.get(self.selected_shape, '')
            original_width = self.original_widths.get(self.selected_shape, 1)
            kwargs = {
                'fill': original_fill,
                'outline': original_outline,
                'width': original_width
            }
        
        if self.create_copy.get():
            # Create a new mirrored shape
            new_shape_id = f"shape_{int(time.time() * 1000)}"
            original_tags = [tag for tag in self.canvas.gettags(self.selected_shape) 
                            if not tag.startswith('shape_') and 
                            tag not in ['current', 'selected', 'bounding_box', 'scale_handle']]
            original_tags.append(new_shape_id)
            
            # For rectangles and ovals, create as polygon but add a special tag
            if shape_type in ('rectangle', 'oval'):
                original_tags.append('converted_' + shape_type)
                new_shape = self.canvas.create_polygon(
                    *mirrored_coords,
                    tags=original_tags,
                    **kwargs
                )
            else:
                new_shape = getattr(self.canvas, f'create_{shape_type}')(
                    *mirrored_coords,
                    tags=original_tags,
                    **kwargs
                )
            
            # Store original colors for the new shape BEFORE selecting it
            if shape_type == 'line':
                self.original_colors[new_shape] = kwargs['fill']
                self.original_widths[new_shape] = kwargs['width']
            else:
                self.original_colors[new_shape] = kwargs['outline']
                self.original_fills[new_shape] = kwargs['fill']
                self.original_widths[new_shape] = kwargs['width']
            
            self.clear_selection()
            self.select_shape(new_shape)
        else:
            # For non-copy case, ensure consistent color handling
            if shape_type in ('line', 'polygon'):
                self.canvas.coords(self.selected_shape, *mirrored_coords)
            else:
                # Replace original oval/rectangle with a polygon
                old_tags = self.canvas.gettags(self.selected_shape)
                self.canvas.delete(self.selected_shape)
                new_shape_id = f"shape_{int(time.time() * 1000)}"
                original_tags = [tag for tag in old_tags 
                               if not tag.startswith('shape_') and 
                               tag not in ['current', 'selected', 'bounding_box', 'scale_handle']]
                original_tags.extend([new_shape_id, 'converted_' + shape_type])
                
                self.selected_shape = self.canvas.create_polygon(
                    *mirrored_coords,
                    tags=original_tags,
                    **kwargs
                )
                
                # Store original colors for the converted shape
                self.original_colors[self.selected_shape] = kwargs['outline']
                self.original_fills[self.selected_shape] = kwargs['fill']
                self.original_widths[self.selected_shape] = kwargs['width']
                self.original_coords = shape_points
        
        # Save state after mirroring
        save_canvas_state()

    def calculate_mirrored_coords(self, coords, x1, y1, x2, y2):
        """Calculate mirrored coordinates for a point across a line"""
        # Convert line to vector form
        dx = x2 - x1
        dy = y2 - y1
        line_length = (dx*dx + dy*dy)**0.5
        
        if line_length == 0:
            return coords
            
        # Normalize direction vector
        dx /= line_length
        dy /= line_length
        
        # Calculate normal vector (perpendicular to line)
        nx = -dy  # Normal x component
        ny = dx   # Normal y component
        
        # Get current scale factor
        scale_factor = self.get_scale_factor()
        
        # Calculate line center
        center_x = (x1 + x2) / 2
        center_y = (y1 + y2) / 2
        
        mirrored = []
        for i in range(0, len(coords), 2):
            px, py = coords[i], coords[i+1]
            
            # Convert point relative to line center
            rx = px - center_x
            ry = py - center_y
            
            # Project onto normal vector to get signed distance from line
            dist = rx*nx + ry*ny
            
            # Mirror point by reversing its normal component
            mx = px - 2*dist*nx
            my = py - 2*dist*ny
            
            mirrored.extend([mx, my])
            
        return mirrored

    def preview_mirror_along_line(self, line):
        """Preview mirrored shape"""
        if not self.selected_shape:
            return
            
        line_coords = self.canvas.coords(line)
        x1, y1, x2, y2 = line_coords
        
        shape_points = self.shape_to_points(self.selected_shape)
        mirrored_coords = self.calculate_mirrored_coords(shape_points, x1, y1, x2, y2)
        
        shape_type = self.canvas.type(self.selected_shape)
        if self.mirror_preview:
            self.canvas.coords(self.mirror_preview, *mirrored_coords)
        else:
            if shape_type == 'line':
                self.mirror_preview = self.canvas.create_line(
                    *mirrored_coords,
                    fill='green', width=2, dash=(5,5)
                )
            else:
                self.mirror_preview = self.canvas.create_polygon(
                    *mirrored_coords,
                    fill='', outline='green', width=2, dash=(5,5)
                )

    def flip_horizontal(self):
        """Quick flip around vertical center line"""
        if not self.selected_shape:
            return
            
        # Save state before flip
        save_canvas_state()
            
        bbox = self.canvas.bbox(self.selected_shape)
        if not bbox:
            return
            
        # Create vertical center line
        center_x = (bbox[0] + bbox[2]) / 2
        self.mirror_axis = self.canvas.create_line(
            center_x, bbox[1], center_x, bbox[3],
            state='hidden'
        )
        
        # Mirror the shape
        self.mirror_along_line()
        
        # Clean up temporary line
        self.canvas.delete(self.mirror_axis)
        self.mirror_axis = None
        
        # Save state after flip
        save_canvas_state()

    def flip_vertical(self):
        """Quick flip around horizontal center line"""
        if not self.selected_shape:
            return
            
        # Save state before flip
        save_canvas_state()
            
        bbox = self.canvas.bbox(self.selected_shape)
        if not bbox:
            return
            
        # Create horizontal center line
        center_y = (bbox[1] + bbox[3]) / 2
        self.mirror_axis = self.canvas.create_line(
            bbox[0], center_y, bbox[2], center_y,
            state='hidden'
        )
        
        # Mirror the shape
        self.mirror_along_line()
        
        # Clean up temporary line
        self.canvas.delete(self.mirror_axis)
        self.mirror_axis = None
        
        # Save state after flip
        save_canvas_state()

    def reset_mirrored_shape(self):
        """Reset shape to original position"""
        if not self.selected_shape or not self.original_coords:
            return
            
        # Save state before reset
        save_canvas_state()
            
        # Reset to original coordinates
        self.canvas.coords(self.selected_shape, *self.original_coords)
        
        # Save state after reset
        save_canvas_state()

    def shape_to_points(self, shape_id):
        """Convert a shape to a list of vertex points."""
        shape_type = self.canvas.type(shape_id)
        coords = list(self.canvas.coords(shape_id))
        
        if shape_type == 'line' or shape_type == 'polygon':
            return coords
        
        elif shape_type == 'oval':
            # Extract center and radii
            x1, y1, x2, y2 = coords
            cx = (x1 + x2) / 2
            cy = (y1 + y2) / 2
            rx = (x2 - x1) / 2
            ry = (y2 - y1) / 2
            
            # Generate points along the oval (32 points for smoothness)
            points = []
            for i in range(32):
                theta = 2 * math.pi * i / 32
                x = cx + rx * math.cos(theta)
                y = cy + ry * math.sin(theta)
                points.extend([x, y])
            return points
        
        elif shape_type == 'rectangle':
            # Convert bounding box to four corners
            x1, y1, x2, y2 = coords
            return [x1, y1, x2, y1, x2, y2, x1, y2]
        
        return coords  # Fallback

    def on_alt_press(self, event):
        """Handle Alt key press"""
        self.alt_pressed = True

    def on_alt_release(self, event):
        """Handle Alt key release"""
        self.alt_pressed = False
        self.clear_clone_preview()

    def on_alt_click(self, event):
        """Handle Alt + click for clone dragging"""
        if not self.selected_shape:
            return
            
        x = self.canvas.canvasx(event.x)
        y = self.canvas.canvasy(event.y)
        self.clone_drag_start = (x, y)
        self.create_clone_preview()

    def on_clone_drag(self, event):
        """Handle clone dragging"""
        if not self.clone_preview:
            return
            
        x = self.canvas.canvasx(event.x)
        y = self.canvas.canvasy(event.y)
        
        # Calculate offset from start position
        dx = x - self.clone_drag_start[0]
        dy = y - self.clone_drag_start[1]
        
        # Get original coordinates and shape type
        shape_type = self.canvas.type(self.selected_shape)
        
        # Check for converted shapes
        for tag in self.canvas.gettags(self.selected_shape):
            if tag.startswith('converted_'):
                shape_type = tag.split('_')[1]
                break
        
        # Handle different shape types
        if shape_type == 'arc':
            # For arcs, just move the bounding box
            orig_coords = list(self.canvas.coords(self.selected_shape))
            new_coords = [
                orig_coords[0] + dx, orig_coords[1] + dy,
                orig_coords[2] + dx, orig_coords[3] + dy
            ]
            self.canvas.coords(self.clone_preview, *new_coords)
            
        elif shape_type == 'oval':
            # Generate new oval points
            orig_coords = list(self.canvas.coords(self.selected_shape))
            x1, y1, x2, y2 = orig_coords
            cx = (x1 + x2) / 2 + dx
            cy = (y1 + y2) / 2 + dy
            rx = (x2 - x1) / 2
            ry = (y2 - y1) / 2
            points = []
            for i in range(64):
                theta = 2 * math.pi * i / 64
                x = cx + rx * math.cos(theta)
                y = cy + ry * math.sin(theta)
                points.extend([x, y])
            self.canvas.coords(self.clone_preview, *points)
            
        elif shape_type == 'rectangle':
            # Move rectangle points
            orig_coords = list(self.canvas.coords(self.selected_shape))
            x1, y1, x2, y2 = orig_coords
            points = [
                x1 + dx, y1 + dy,
                x2 + dx, y1 + dy,
                x2 + dx, y2 + dy,
                x1 + dx, y2 + dy
            ]
            self.canvas.coords(self.clone_preview, *points)
            
        else:
            # For lines and polygons, move all points
            orig_coords = list(self.canvas.coords(self.selected_shape))
            new_coords = []
            for i in range(0, len(orig_coords), 2):
                new_coords.extend([orig_coords[i] + dx, orig_coords[i + 1] + dy])
            self.canvas.coords(self.clone_preview, *new_coords)

    def on_clone_release(self, event):
        """Handle clone release to create the clone"""
        if not self.clone_preview:
            return
            
        # Get the preview coordinates
        new_coords = list(self.canvas.coords(self.clone_preview))
        
        # Create the actual clone
        self.create_clone_at_position(new_coords)
        
        # Clean up
        self.clear_clone_preview()
        self.clone_drag_start = None

    def create_clone_preview(self):
        """Create a preview of the cloned shape"""
        if not self.selected_shape:
            return
            
        # Clear any existing preview
        self.clear_clone_preview()
        
        # Get shape properties
        coords = list(self.canvas.coords(self.selected_shape))
        shape_type = self.canvas.type(self.selected_shape)
        
        # Check for converted shapes
        for tag in self.canvas.gettags(self.selected_shape):
            if tag.startswith('converted_'):
                shape_type = tag.split('_')[1]
                break
        
        # Create preview with dashed outline
        if shape_type == 'line':
            self.clone_preview = self.canvas.create_line(
                *coords,
                fill='green',
                width=2,
                dash=(5, 5)
            )
        elif shape_type == 'arc':
            start = float(self.canvas.itemcget(self.selected_shape, 'start'))
            extent = float(self.canvas.itemcget(self.selected_shape, 'extent'))
            self.clone_preview = self.canvas.create_arc(
                *coords,
                start=start,
                extent=extent,
                outline='green',
                fill='',
                width=2,
                dash=(5, 5)
            )
        elif shape_type == 'oval':
            # Generate oval points (64 points for smoother preview)
            x1, y1, x2, y2 = coords
            cx = (x1 + x2) / 2
            cy = (y1 + y2) / 2
            rx = (x2 - x1) / 2
            ry = (y2 - y1) / 2
            points = []
            for i in range(64):
                theta = 2 * math.pi * i / 64
                x = cx + rx * math.cos(theta)
                y = cy + ry * math.sin(theta)
                points.extend([x, y])
            self.clone_preview = self.canvas.create_polygon(
                *points,
                fill='',
                outline='green',
                width=2,
                dash=(5, 5)
            )
        elif shape_type == 'rectangle':
            x1, y1, x2, y2 = coords
            points = [x1, y1, x2, y1, x2, y2, x1, y2]
            self.clone_preview = self.canvas.create_polygon(
                *points,
                fill='',
                outline='green',
                width=2,
                dash=(5, 5)
            )
        else:
            # For all other shapes
            self.clone_preview = self.canvas.create_polygon(
                *coords,
                fill='',
                outline='green',
                width=2,
                dash=(5, 5)
            )

    def clear_clone_preview(self):
        """Clear the clone preview"""
        if self.clone_preview:
            self.canvas.delete(self.clone_preview)
            self.clone_preview = None

    def create_adjacent_clone(self):
        """Create a clone next to the selected shape"""
        if not self.selected_shape:
            messagebox.showerror("Error", "No shape selected")
            return
            
        # Save state before cloning
        save_canvas_state()
        
        # Get original shape's bounding box
        bbox = self.canvas.bbox(self.selected_shape)
        if not bbox:
            return
            
        # Calculate offset (shape width)
        offset = bbox[2] - bbox[0]
        
        # Get original coordinates
        coords = list(self.canvas.coords(self.selected_shape))
        
        # Create new coordinates with offset
        new_coords = []
        for i in range(0, len(coords), 2):
            new_coords.extend([coords[i] + offset, coords[i + 1]])
        
        # Create the clone
        self.create_clone_at_position(new_coords)
        
        # Save state after cloning
        save_canvas_state()

    def create_clone_at_position(self, coords):
        """Create a clone at the specified coordinates"""
        if not self.selected_shape:
            return
            
        # Get shape properties
        shape_type = self.canvas.type(self.selected_shape)
        
        # Create unique timestamp-based ID
        new_shape_id = f"shape_{int(time.time() * 1000)}"
        
        # Get original tags, preserving important ones
        original_tags = []
        for tag in self.canvas.gettags(self.selected_shape):
            # Keep all tags except those we explicitly want to exclude
            if not tag.startswith('shape_') and \
               tag not in ['current', 'selected', 'bounding_box', 'scale_handle']:
                original_tags.append(tag)
        original_tags.append(new_shape_id)
        
        # Check for converted shapes
        converted_type = None
        for tag in self.canvas.gettags(self.selected_shape):
            if tag.startswith('converted_'):
                converted_type = tag.split('_')[1]
                shape_type = converted_type
                break
        
        # Get original appearance
        if shape_type == 'line':
            kwargs = {
                'fill': self.canvas.itemcget(self.selected_shape, 'fill'),
                'width': self.canvas.itemcget(self.selected_shape, 'width')
            }
        else:
            kwargs = {
                'outline': self.canvas.itemcget(self.selected_shape, 'outline'),
                'fill': self.canvas.itemcget(self.selected_shape, 'fill'),
                'width': self.canvas.itemcget(self.selected_shape, 'width')
            }
        
        # Create the clone based on shape type
        if shape_type == 'arc':
            # For arcs, preserve the start and extent angles
            start = float(self.canvas.itemcget(self.selected_shape, 'start'))
            extent = float(self.canvas.itemcget(self.selected_shape, 'extent'))
            new_shape = self.canvas.create_arc(
                *coords,
                start=start,
                extent=extent,
                tags=original_tags,
                **kwargs
            )
        elif shape_type in ('rectangle', 'oval'):
            # For rectangles and ovals, we need to handle them differently based on
            # whether they're being created as native shapes or converted to polygons
            if len(coords) == 4:  # Original shape coordinates (x1,y1,x2,y2)
                if converted_type:  # Convert to polygon
                    if shape_type == 'rectangle':
                        x1, y1, x2, y2 = coords
                        points = [x1, y1, x2, y1, x2, y2, x1, y2]
                    else:  # oval
                        x1, y1, x2, y2 = coords
                        cx = (x1 + x2) / 2
                        cy = (y1 + y2) / 2
                        rx = (x2 - x1) / 2
                        ry = (y2 - y1) / 2
                        points = []
                        for i in range(64):
                            theta = 2 * math.pi * i / 64
                            x = cx + rx * math.cos(theta)
                            y = cy + ry * math.sin(theta)
                            points.extend([x, y])
                    
                    # Add converted tag if not already present
                    if not any(tag.startswith('converted_') for tag in original_tags):
                        original_tags.append('converted_' + shape_type)
                    
                    new_shape = self.canvas.create_polygon(
                        *points,
                        tags=original_tags,
                        **kwargs
                    )
                else:  # Create as native shape
                    new_shape = getattr(self.canvas, f'create_{shape_type}')(
                        *coords,
                        tags=original_tags,
                        **kwargs
                    )
            else:  # Already converted to polygon points
                new_shape = self.canvas.create_polygon(
                    *coords,
                    tags=original_tags,
                    **kwargs
                )
        else:
            # For lines and polygons
            new_shape = getattr(self.canvas, f'create_{shape_type}')(
                *coords,
                tags=original_tags,
                **kwargs
            )
        
        # Store original properties for the new shape
        if shape_type == 'line':
            self.original_colors[new_shape] = kwargs['fill']
            self.original_widths[new_shape] = kwargs['width']
        else:
            self.original_colors[new_shape] = kwargs['outline']
            self.original_fills[new_shape] = kwargs['fill']
            self.original_widths[new_shape] = kwargs['width']
        
        # Store original coordinates
        self.original_coords = coords
        
        # Select the new shape (clear old selection first)
        self.clear_selection()
        self.select_shape(new_shape)

    def delete_selected_shape(self):
        """Delete the currently selected shape"""
        if self.selected_shape:
            try:
                # Save state before deletion
                save_canvas_state()
                
                # Delete the shape
                self.canvas.delete(self.selected_shape)
                
                # Clear selection
                self.clear_selection()
                
                # Save state after deletion
                save_canvas_state()
                
            except tk.TclError:
                # Shape might have already been deleted
                self.clear_selection()

    def on_rotate_click(self, event):
        """Handle clicks for rotation tool"""
        x = self.canvas.canvasx(event.x)
        y = self.canvas.canvasy(event.y)
        
        if self.rotate_state == 'select_shape':
            # Find shapes under click
            items = self.canvas.find_overlapping(x-5, y-5, x+5, y+5)
            shapes = [item for item in items if self.canvas.type(item) in 
                     ['line', 'arc', 'oval', 'polygon', 'rectangle']]
            
            if shapes:
                # Clear any previous selection
                self.clear_selection()
                
                # Select the shape
                self.select_shape(shapes[0])
                
                # Set initial rotation point at shape center
                center = self.get_shape_center(shapes[0])
                self.set_rotation_point(*center)
                
                # Move to rotation state
                self.rotate_state = 'rotate'
        
        elif self.rotate_state == 'set_center':
            # Try to snap to various points
            from snaptools import snap_to_endpoints, snap_to_midpoints, snap_to_centers
            
            # Check all possible snap points
            snap_point = snap_to_endpoints(self.canvas, x, y) or \
                        snap_to_midpoints(self.canvas, x, y) or \
                        snap_to_centers(self.canvas, x, y)
            
            # If we found a snap point, use it
            if snap_point:
                x, y = snap_point
            
            # Set new rotation center point
            self.set_rotation_point(x, y)
            self.rotate_state = 'rotate'
            self.center_select_btn.configure(relief='raised', bg='#263d42')
            self.canvas.config(cursor="arrow")

    def on_rotate_drag(self, event):
        """Handle dragging for rotation"""
        if self.rotate_state == 'rotate' and self.selected_shape and self.rotation_point:
            # Calculate current angle
            current_angle = self.get_current_angle(event)
            
            if self.start_angle is None:
                self.start_angle = current_angle
                return
            
            # Calculate rotation angle
            delta_angle = current_angle - self.start_angle
            
            # If angle snap is enabled, snap to nearest 5 degrees
            if self.angle_snap.get():
                delta_angle = round(delta_angle / 5.0) * 5.0
            
            # Update cumulative angle
            self.cumulative_angle += delta_angle
            
            # Rotate the shape
            self.rotate_shape_around_point(
                self.selected_shape,
                self.rotation_point[0],
                self.rotation_point[1],
                delta_angle
            )
            
            # Update the angle label
            self.update_angle_label(event.x, event.y, self.cumulative_angle)
            
            # Update start angle for next drag
            self.start_angle = current_angle

    def on_rotate_release(self, event):
        """Handle release after rotation"""
        if self.rotate_state == 'rotate':
            # Save state for undo/redo
            try:
                save_canvas_state()
            except NameError:
                pass
            
            # Clear angle label
            self.clear_angle_label()

    def set_rotation_point(self, x, y):
        """Set the rotation point at the specified coordinates"""
        # Clear any existing rotation markers
        self.clear_rotation_markers()
        
        # Store rotation point
        self.rotation_point = (x, y)
        
        # Create rotation point markers
        self.create_rotation_markers(x, y)
        
        # Reset angle tracking
        self.start_angle = None
        self.cumulative_angle = 0

    def set_rotation_center(self):
        """Activate rotation center selection mode"""
        if not self.selected_shape:
            messagebox.showerror("Error", "Please select a shape first")
            return
        
        self.rotate_state = 'set_center'
        self.center_select_btn.configure(relief='sunken', bg='#2ecc71')
        self.canvas.config(cursor="crosshair")

    def create_rotation_markers(self, x, y):
        """Create visual markers for the rotation point"""
        size = 5
        self.rotation_markers = []
        
        # Create crosshair
        self.rotation_markers.append(self.canvas.create_line(
            x - size, y, x + size, y,
            fill='blue', width=2, tags='rotation_marker'
        ))
        self.rotation_markers.append(self.canvas.create_line(
            x, y - size, x, y + size,
            fill='blue', width=2, tags='rotation_marker'
        ))
        
        # Create circle
        self.rotation_markers.append(self.canvas.create_oval(
            x - size, y - size, x + size, y + size,
            outline='blue', width=2, tags='rotation_marker'
        ))

    def clear_rotation_markers(self):
        """Clear rotation point markers"""
        if hasattr(self, 'rotation_markers'):
            for marker in self.rotation_markers:
                self.canvas.delete(marker)
            self.rotation_markers = []

    def rotate_shape_around_point(self, shape_id, cx, cy, angle):
        """Rotate a shape around a point by the specified angle"""
        # Convert angle to radians
        angle_rad = math.radians(angle)
        cos_a = math.cos(angle_rad)
        sin_a = math.sin(angle_rad)
        
        shape_type = self.canvas.type(shape_id)
        coords = list(self.canvas.coords(shape_id))
        
        # Check for converted shapes
        for tag in self.canvas.gettags(shape_id):
            if tag.startswith('converted_'):
                shape_type = tag.split('_')[1]
                break
        
        if shape_type in ['rectangle', 'oval', 'arc']:
            # For shapes defined by bounding box, check if already converted to polygon
            if len(coords) > 4:  # Already a polygon
                points = []
                for i in range(0, len(coords), 2):
                    x, y = coords[i], coords[i+1]
                    dx = x - cx
                    dy = y - cy
                    new_x = cx + (dx * cos_a - dy * sin_a)
                    new_y = cy + (dx * sin_a + dy * cos_a)
                    points.extend([new_x, new_y])
                self.canvas.coords(shape_id, *points)
            else:
                # Original shape with 4 coordinates
                x1, y1, x2, y2 = coords
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
                
                # For arcs, preserve start and extent angles
                if shape_type == 'arc':
                    start = float(self.canvas.itemcget(shape_id, 'start'))
                    extent = float(self.canvas.itemcget(shape_id, 'extent'))
                    self.canvas.coords(shape_id, *rotated_points[:4])
                    self.canvas.itemconfig(shape_id, start=start + angle, extent=extent)
                else:
                    # For rectangles and ovals, convert to polygon if not already
                    tags = list(self.canvas.gettags(shape_id))
                    tags.append('converted_' + shape_type)
                    self.canvas.delete(shape_id)
                    self.selected_shape = self.canvas.create_polygon(
                        *rotated_points,
                        fill=self.original_fills.get(shape_id, ''),
                        outline=self.original_colors.get(shape_id, 'black'),
                        width=self.original_widths.get(shape_id, 1),
                        tags=tags
                    )
        else:
            # For lines and polygons, rotate all points
            new_coords = []
            for i in range(0, len(coords), 2):
                x = coords[i]
                y = coords[i + 1]
                dx = x - cx
                dy = y - cy
                new_x = cx + (dx * cos_a - dy * sin_a)
                new_y = cy + (dx * sin_a + dy * cos_a)
                new_coords.extend([new_x, new_y])
            
            self.canvas.coords(shape_id, *new_coords)

    def get_current_angle(self, event):
        """Calculate current angle relative to rotation point"""
        if not self.rotation_point:
            return 0
        y = self.canvas.canvasy(event.y)
        x = self.canvas.canvasx(event.x)
        return math.degrees(math.atan2(
            y - self.rotation_point[1],
            x - self.rotation_point[0]
        ))

    def update_angle_label(self, x, y, angle):
        """Display the current rotation angle"""
        # Clear any existing angle label
        self.clear_angle_label()
        
        # Create new label
        self.angle_label = self.canvas.create_text(
            x + 20, y - 20,
            text=f"{angle:.1f}°",
            fill='blue',
            tags='angle_label'
        )

    def clear_angle_label(self):
        """Clear the angle display label"""
        if hasattr(self, 'angle_label'):
            self.canvas.delete(self.angle_label)
            self.angle_label = None

    def reset_rotation(self):
        """Reset the selected shape to its original orientation"""
        if not self.selected_shape or not self.original_coords:
            return
            
        # Save state before reset
        save_canvas_state()
            
        # Reset coordinates to original
        self.canvas.coords(self.selected_shape, *self.original_coords)
        
        # Reset cumulative angle
        self.cumulative_angle = 0
        
        # Save state after reset
        save_canvas_state()

    def quick_rotate(self, angle):
        """Quickly rotate the selected shape by a specific angle"""
        if not self.selected_shape:
            messagebox.showerror("Error", "No shape selected")
            return
            
        # Save state before rotation
        save_canvas_state()
        
        # If no rotation point is set, use shape center
        if not self.rotation_point:
            center = self.get_shape_center(self.selected_shape)
            self.set_rotation_point(*center)
        
        # Perform rotation
        self.rotate_shape_around_point(
            self.selected_shape,
            self.rotation_point[0],
            self.rotation_point[1],
            angle
        )
        
        # Update cumulative angle
        self.cumulative_angle += angle
        
        # Save state after rotation
        save_canvas_state()

    def on_rotate_motion(self, event):
        """Show snap points while moving in center selection mode"""
        if self.rotate_state != 'set_center':
            return
        
        x = self.canvas.canvasx(event.x)
        y = self.canvas.canvasy(event.y)
        
        # Clear previous snap indicators
        self.clear_snap_indicators()
        
        # Try to snap to various points
        from snaptools import snap_to_endpoints, snap_to_midpoints, snap_to_centers
        
        # Check all possible snap points
        snap_point = snap_to_endpoints(self.canvas, x, y) or \
                    snap_to_midpoints(self.canvas, x, y) or \
                    snap_to_centers(self.canvas, x, y)
        
        # If we found a snap point, show indicator
        if snap_point:
            self.show_snap_indicator(*snap_point)

    def clear_snap_indicators(self):
        """Clear any existing snap point indicators"""
        for item in self.canvas.find_withtag('snap_indicator'):
            self.canvas.delete(item)

    def show_snap_indicator(self, x, y):
        """Show a visual indicator for a snap point"""
        size = 5
        # Create crosshair
        self.canvas.create_line(
            x - size, y, x + size, y,
            fill='red', width=1, tags='snap_indicator'
        )
        self.canvas.create_line(
            x, y - size, x, y + size,
            fill='red', width=1, tags='snap_indicator'
        )
        # Create circle
        self.canvas.create_oval(
            x - size, y - size, x + size, y + size,
            outline='red', width=1, tags='snap_indicator'
        )