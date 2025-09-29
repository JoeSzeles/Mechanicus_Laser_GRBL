import tkinter as tk
from tkinter import ttk, messagebox
import math
import time

# Import undo/redo functions if available
try:
    from undoredo import save_canvas_state, set_canvas, init_canvas_history, set_grid_var, set_scale_var, set_grid_size_var
except ImportError:
    print("Warning: Undo/redo functionality not available")

class GroupTools:
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
        self.tools_window = None
        self.selection_mode = False
        self.selected_shapes = []
        self.selection_rect = None
        self.start_x = None
        self.start_y = None
        self.original_colors = {}
        self.original_fills = {}
        self.original_widths = {}
        self.group_data = {}  # Store group information

        # Store original canvas bindings
        self.original_bindings = {
            '<Button-1>': None,
            '<B1-Motion>': None,
            '<ButtonRelease-1>': None
        }
        self.store_original_bindings()
        
    def store_original_bindings(self):
        """Store the original canvas bindings"""
        for event in self.original_bindings:
            bound_functions = self.canvas.bind(event)
            if bound_functions:
                self.original_bindings[event] = bound_functions

    def restore_original_bindings(self):
        """Restore the original canvas bindings"""
        for event, func in self.original_bindings.items():
            if func:
                self.canvas.bind(event, func)
            else:
                self.canvas.unbind(event)
                
    def show_tools_window(self):
        """Display the group tools window"""
        if self.tools_window is None or not tk.Toplevel.winfo_exists(self.tools_window):
            self.tools_window = tk.Toplevel(self.parent)
            self.tools_window.title("Group Tools")
            self.tools_window.geometry("240x400")
            self.tools_window.resizable(False, False)
            self.tools_window.configure(bg="#263d42")
            self.tools_window.attributes('-topmost', True)
            
            # Create notebook for tabs
            style = ttk.Style()
            style.configure('Custom.TNotebook', background='#263d42')
            style.configure('Custom.TNotebook.Tab', 
                          background='#808080',
                          foreground='#000000',
                          borderwidth=0,
                          focuscolor='#263d42',
                          padding=[10, 2])
            style.map('Custom.TNotebook.Tab',
                     background=[('selected', '#2b2b2b'), ('!selected', '#808080')],
                     foreground=[('selected', '#000000'), ('!selected', '#000000')])
            
            # Configure other styles
            style.configure('Custom.TFrame', background='#263d42')
            style.configure('Custom.TLabel', background='#263d42', foreground='white')
            
            notebook = ttk.Notebook(self.tools_window, style='Custom.TNotebook')
            notebook.pack(fill='both', expand=True, padx=5, pady=5)
            
            # Group Operations tab
            group_frame = ttk.Frame(notebook, style='Custom.TFrame')
            notebook.add(group_frame, text='Group')
            
            # Setup tools
            self.setup_group_tools(group_frame)
            
            # Handle window close
            self.tools_window.protocol("WM_DELETE_WINDOW", self.on_window_close)
            
    def setup_group_tools(self, parent):
        """Setup the group tools UI"""
        # Main label
        label = tk.Label(parent, text="Group Operations", 
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
        
        # Group button
        group_btn = tk.Button(button_frame, text="Group",
                            command=self.group_shapes,
                            fg='white', bg='#263d42',
                            activebackground='#2ecc71',
                            activeforeground='white',
                            width=6)
        group_btn.pack(side='left', padx=2)
        
        # Ungroup button
        ungroup_btn = tk.Button(button_frame, text="Ungroup",
                              command=self.ungroup_shapes,
                              fg='white', bg='#263d42',
                              activebackground='#2ecc71',
                              activeforeground='white',
                              width=6)
        ungroup_btn.pack(side='left', padx=2)
        
        # Deselect button
        deselect_btn = tk.Button(button_frame, text="Deselect",
                                command=self.clear_selection,
                                fg='white', bg='#263d42',
                                activebackground='#2ecc71',
                                activeforeground='white',
                                width=6)
        deselect_btn.pack(side='left', padx=2)
        
        # Second row of buttons
        button_frame2 = ttk.Frame(parent, style='Custom.TFrame')
        button_frame2.pack(pady=5, padx=5, fill='x')
        
        # Polyline button
        polyline_btn = tk.Button(button_frame2, text="Polyline",
                               command=self.create_polyline,
                               fg='white', bg='#263d42',
                               activebackground='#2ecc71',
                               activeforeground='white',
                               width=8)
        polyline_btn.pack(side='left', padx=2)
        
        # Expand button
        expand_btn = tk.Button(button_frame2, text="Expand",
                             command=self.expand_shapes,
                             fg='white', bg='#263d42',
                             activebackground='#2ecc71',
                             activeforeground='white',
                             width=8)
        expand_btn.pack(side='left', padx=2)
        
    def toggle_selection(self):
        """Toggle selection mode"""
        if self.selection_mode:
            # Deactivate selection mode
            self.selection_mode = False
            self.select_btn.configure(relief='raised', bg='#263d42')
            self.canvas.config(cursor="arrow")
            self.restore_original_bindings()
            self.clear_selection()
        else:
            # Deactivate other tools if they exist
            if hasattr(self.parent, 'active_tool'):
                self.parent.active_tool = None
            if hasattr(self.parent, 'transform_tools'):
                self.parent.transform_tools.deactivate_all_tools()
            
            # Activate selection mode
            self.selection_mode = True
            self.select_btn.configure(relief='sunken', bg='#2ecc71')
            self.canvas.config(cursor="crosshair")
            self.bind_events()
            
    def bind_events(self):
        """Bind selection events"""
        # Store current bindings before overriding
        self.store_original_bindings()
        
        # Bind our events
        self.canvas.bind('<Button-1>', self.on_mouse_down)
        self.canvas.bind('<B1-Motion>', self.on_mouse_drag)
        self.canvas.bind('<ButtonRelease-1>', self.on_mouse_release)
        
    def unbind_events(self):
        """Unbind selection events"""
        self.restore_original_bindings()
        
    def on_mouse_down(self, event):
        """Handle mouse down for selection rectangle"""
        if not self.selection_mode:
            return
            
        self.start_x = self.canvas.canvasx(event.x)
        self.start_y = self.canvas.canvasy(event.y)
        
        # Create selection rectangle
        if self.selection_rect:
            self.canvas.delete(self.selection_rect)
        self.selection_rect = self.canvas.create_rectangle(
            self.start_x, self.start_y, self.start_x, self.start_y,
            outline='blue', dash=(2, 2), tags='temp'
        )
        
    def on_mouse_drag(self, event):
        """Handle mouse drag for selection rectangle"""
        if not self.selection_mode or not self.selection_rect:
            return
            
        # Update selection rectangle
        current_x = self.canvas.canvasx(event.x)
        current_y = self.canvas.canvasy(event.y)
        self.canvas.coords(self.selection_rect,
                         self.start_x, self.start_y,
                         current_x, current_y)
        
        # Find and highlight shapes under selection
        self.update_selection(self.start_x, self.start_y, current_x, current_y)
        
    def on_mouse_release(self, event):
        """Handle mouse release for selection rectangle"""
        if not self.selection_mode:
            return
            
        if self.selection_rect:
            self.canvas.delete(self.selection_rect)
            self.selection_rect = None
            
    def update_selection(self, x1, y1, x2, y2):
        """Update selected shapes based on selection rectangle"""
        # Normalize coordinates
        left = min(x1, x2)
        right = max(x1, x2)
        top = min(y1, y2)
        bottom = max(y1, y2)
        
        # Clear current selection
        self.clear_selection()
        
        # Find shapes that intersect with selection rectangle
        items = self.canvas.find_overlapping(left, top, right, bottom)
        
        # Filter out utility elements
        exclude_tags = ['grid_lines', 'below_all', 'above_all', 'snap_point', 'snap_line', 
                       'temp_marker', 'radius_marker', 'center_marker', 'temp', 
                       'guide_point', 'guide_line', 'crosshair', 'machine_pos']
        
        for item in items:
            if self.canvas.type(item) in ['line', 'arc', 'oval', 'polygon', 'rectangle']:
                tags = self.canvas.gettags(item)
                if not any(tag in tags for tag in exclude_tags):
                    self.select_shape(item)
                    
    def select_shape(self, shape_id):
        """Select a shape and store its properties"""
        if shape_id in self.selected_shapes:
            return
            
        self.selected_shapes.append(shape_id)
        
        # Store original properties
        shape_type = self.canvas.type(shape_id)
        if shape_type == 'line':
            self.original_colors[shape_id] = self.canvas.itemcget(shape_id, 'fill')
            self.original_widths[shape_id] = self.canvas.itemcget(shape_id, 'width')
            self.canvas.itemconfig(shape_id, fill='green', width=2)
        else:
            self.original_colors[shape_id] = self.canvas.itemcget(shape_id, 'outline')
            self.original_fills[shape_id] = self.canvas.itemcget(shape_id, 'fill')
            self.original_widths[shape_id] = self.canvas.itemcget(shape_id, 'width')
            self.canvas.itemconfig(shape_id, outline='green', width=2)
            
    def clear_selection(self):
        """Clear current selection"""
        for shape_id in self.selected_shapes:
            try:
                shape_type = self.canvas.type(shape_id)
                if shape_type == 'line':
                    self.canvas.itemconfig(shape_id,
                        fill=self.original_colors.get(shape_id, 'black'),
                        width=self.original_widths.get(shape_id, 1))
                else:
                    self.canvas.itemconfig(shape_id,
                        outline=self.original_colors.get(shape_id, 'black'),
                        fill=self.original_fills.get(shape_id, ''),
                        width=self.original_widths.get(shape_id, 1))
            except tk.TclError:
                pass  # Shape might have been deleted
                
        self.selected_shapes = []
        self.original_colors = {}
        self.original_fills = {}
        self.original_widths = {}
        
    def group_shapes(self):
        """Group selected shapes together"""
        if len(self.selected_shapes) < 2:
            messagebox.showerror("Error", "Select at least two shapes to group")
            return
            
        # Save state before grouping
        save_canvas_state()
        
        # Create unique group ID
        group_id = f"group_{int(time.time() * 1000)}"
        
        # Store group information
        self.group_data[group_id] = {
            'shapes': self.selected_shapes.copy(),
            'properties': {}
        }
        
        # Store properties for each shape
        for shape_id in self.selected_shapes:
            shape_type = self.canvas.type(shape_id)
            coords = list(self.canvas.coords(shape_id))
            tags = list(self.canvas.gettags(shape_id))
            
            # Add group tag to shape
            self.canvas.addtag_withtag(group_id, shape_id)
            
            # Store shape properties
            self.group_data[group_id]['properties'][shape_id] = {
                'type': shape_type,
                'coords': coords,
                'tags': tags,
                'fill': self.canvas.itemcget(shape_id, 'fill'),
                'outline': self.canvas.itemcget(shape_id, 'outline') if shape_type != 'line' else None,
                'width': self.canvas.itemcget(shape_id, 'width')
            }
            
            # For arcs, store additional properties
            if shape_type == 'arc':
                self.group_data[group_id]['properties'][shape_id].update({
                    'start': float(self.canvas.itemcget(shape_id, 'start')),
                    'extent': float(self.canvas.itemcget(shape_id, 'extent'))
                })
                
        # Clear selection after grouping
        self.clear_selection()
        
        # Save state after grouping
        save_canvas_state()
        
    def ungroup_shapes(self):
        """Ungroup selected shapes"""
        if not self.selected_shapes:
            messagebox.showerror("Error", "Select a group to ungroup")
            return
            
        # Save state before ungrouping
        save_canvas_state()
        
        # Find groups in selection
        for shape_id in self.selected_shapes:
            tags = self.canvas.gettags(shape_id)
            for tag in tags:
                if tag.startswith('group_') and tag in self.group_data:
                    # Remove group tag from all shapes
                    for member_id in self.group_data[tag]['shapes']:
                        try:
                            self.canvas.dtag(member_id, tag)
                        except tk.TclError:
                            continue
                    
                    # Remove group data
                    del self.group_data[tag]
                    
        # Clear selection after ungrouping
        self.clear_selection()
        
        # Save state after ungrouping
        save_canvas_state()
        
    def create_polyline(self):
        """Combine selected lines into a continuous polyline"""
        if not self.selected_shapes:
            messagebox.showerror("Error", "Select lines to combine")
            return
            
        # Verify all selected shapes are lines
        if not all(self.canvas.type(shape) == 'line' for shape in self.selected_shapes):
            messagebox.showerror("Error", "Can only combine lines into a polyline")
            return
            
        # Save state before creating polyline
        save_canvas_state()
        
        # Collect all points
        points = []
        for shape_id in self.selected_shapes:
            coords = list(self.canvas.coords(shape_id))
            points.extend(coords)
            
        # Create new polyline
        new_shape_id = f"shape_{int(time.time() * 1000)}"
        polyline = self.canvas.create_line(*points,
                                         fill=self.original_colors.get(self.selected_shapes[0], 'black'),
                                         width=self.original_widths.get(self.selected_shapes[0], 1),
                                         tags=new_shape_id)
        
        # Delete original lines
        for shape_id in self.selected_shapes:
            self.canvas.delete(shape_id)
            
        # Clear selection
        self.clear_selection()
        
        # Save state after creating polyline
        save_canvas_state()
        
    def expand_shapes(self):
        """Break down selected shapes into individual segments"""
        if not self.selected_shapes:
            messagebox.showerror("Error", "Select shapes to expand")
            return
            
        # Save state before expanding
        save_canvas_state()
        
        for shape_id in self.selected_shapes:
            shape_type = self.canvas.type(shape_id)
            coords = list(self.canvas.coords(shape_id))
            
            if shape_type in ['polygon', 'line']:
                # Create individual line segments
                for i in range(0, len(coords)-2, 2):
                    new_shape_id = f"shape_{int(time.time() * 1000)}_{i}"
                    self.canvas.create_line(
                        coords[i], coords[i+1],
                        coords[i+2], coords[i+3],
                        fill=self.original_colors.get(shape_id, 'black'),
                        width=self.original_widths.get(shape_id, 1),
                        tags=new_shape_id
                    )
                
                # For polygons, connect last point to first point
                if shape_type == 'polygon' and len(coords) >= 4:
                    new_shape_id = f"shape_{int(time.time() * 1000)}_last"
                    self.canvas.create_line(
                        coords[-2], coords[-1],
                        coords[0], coords[1],
                        fill=self.original_colors.get(shape_id, 'black'),
                        width=self.original_widths.get(shape_id, 1),
                        tags=new_shape_id
                    )
                
                # Delete original shape
                self.canvas.delete(shape_id)
                
        # Clear selection
        self.clear_selection()
        
        # Save state after expanding
        save_canvas_state()
        
    def on_window_close(self):
        """Handle tools window closing"""
        self.selection_mode = False
        if hasattr(self, 'select_btn'):
            self.select_btn.configure(relief='raised', bg='#263d42')
        self.canvas.config(cursor="arrow")
        self.restore_original_bindings()
        self.clear_selection()
        if self.tools_window:
            self.tools_window.destroy()
            self.tools_window = None 