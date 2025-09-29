import tkinter as tk
from tkinter import ttk
from PIL import Image, ImageTk
import keyboard

# Global variables
groups = {}  # Dictionary to store groups and their members
layer_items = {}  # Store layer widgets
visibility_states = {}  # Store visibility states
selected_items = set()  # Store selected items
group_counter = 0  # Counter for group names

class LayersWindow:
    def __init__(self, parent, canvas):
        self.window = tk.Toplevel(parent)
        self.window.title("Layers")
        self.window.geometry("200x400+1700+600")  # Moved down to 600 from 400
        self.window.configure(bg="#263d42")
        self.window.attributes('-topmost', True)  # Always on top
        
        # Make sure window stays on top even after losing focus
        self.window.bind('<FocusOut>', lambda e: self.window.lift())
        
        self.canvas = canvas
        self.selected_items = set()
        self.is_selecting = False
        self.selection_rect = None
        self.start_x = 0
        self.start_y = 0
        self.moved_items = {}
        self.is_moving = False
        self.previous_tool = None
        self.original_widths = {}  # Store original widths of shapes
        
        # Create main container frame
        container = tk.Frame(self.window, bg="#263d42")
        container.pack(fill='both', expand=True)
        
        # Create toolbar
        self.toolbar = tk.Frame(container, bg="#263d42")
        self.toolbar.pack(fill='x')
        
        # Add Grid and Snap checkboxes
        self.grid_var = tk.BooleanVar(value=False)
        self.snap_var = tk.BooleanVar(value=False)
        
        grid_cb = tk.Checkbutton(self.toolbar, text="Grid", variable=self.grid_var,
                                bg="#263d42", fg="white", selectcolor="#1a1a1a",
                                command=self.toggle_grid)
        grid_cb.pack(side='left', padx=2)
        
        snap_cb = tk.Checkbutton(self.toolbar, text="Snap", variable=self.snap_var,
                                bg="#263d42", fg="white", selectcolor="#1a1a1a")
        snap_cb.pack(side='left', padx=2)
        
        # Add selection tool button
        self.select_btn = tk.Button(self.toolbar, text="Select", command=self.toggle_selection_tool,
                                  bg="#263d42", fg="white", bd=1)
        self.select_btn.pack(side='left', padx=2)
        
        # Create delete button
        self.delete_btn = tk.Button(self.toolbar, text="Delete", command=self.delete_selected,
                                  bg="#263d42", fg="white", bd=1)
        self.delete_btn.pack(side='left', padx=2)
        
        # Create scrollable canvas
        self.canvas_frame = tk.Canvas(container, bg="#263d42", highlightthickness=0)
        self.scrollbar = tk.Scrollbar(container, orient="vertical", command=self.canvas_frame.yview)
        
        # Create frame for content
        self.scrollable_frame = tk.Frame(self.canvas_frame, bg="#263d42")
        
        # Configure scrolling
        self.scrollable_frame.bind(
            "<Configure>",
            lambda e: self.canvas_frame.configure(scrollregion=self.canvas_frame.bbox("all"))
        )
        
        # Create window in canvas
        self.canvas_frame.create_window((0, 0), window=self.scrollable_frame, anchor="nw", width=180)
        
        # Configure canvas scroll
        self.canvas_frame.configure(yscrollcommand=self.scrollbar.set)
        
        # Pack scrollbar and canvas
        self.scrollbar.pack(side="right", fill="y")
        self.canvas_frame.pack(side="left", fill="both", expand=True)
        
        # Configure canvas size
        self.canvas_frame.bind('<Configure>', lambda e: self.canvas_frame.configure(width=e.width-4))
        
        # Enable mousewheel scrolling
        self.scrollable_frame.bind('<Enter>', lambda e: self.canvas_frame.bind_all("<MouseWheel>", self._on_mousewheel))
        self.scrollable_frame.bind('<Leave>', lambda e: self.canvas_frame.unbind_all("<MouseWheel>"))
        
        # Initialize layer items dictionary
        self.layer_items = {}
        
        # Do initial update
        self.update_layers()
        
        # Bind to canvas events that modify shapes
        self.canvas.bind('<<ShapeAdded>>', self.on_shape_modified)
        self.canvas.bind('<<ShapeRemoved>>', self.on_shape_modified)
        self.canvas.bind('<<ShapeModified>>', self.on_shape_modified)
        self.canvas.bind('<<CanvasCleared>>', self.on_canvas_cleared)
        
        # Bind to delete key
        self.window.bind('<Delete>', lambda e: self.delete_selected())
        
        # Bind canvas events for selection
        self.canvas.tag_bind('all_lines', '<Button-1>', self.on_shape_click)
    
    def _on_mousewheel(self, event):
        self.canvas_frame.yview_scroll(int(-1*(event.delta/120)), "units")
    
    def on_shape_modified(self, event=None):
        try:
            self.update_layers()
        except Exception as e:
            print(f"Error in on_shape_modified: {e}")
            # If window is destroyed, remove callbacks
            if str(e).startswith('bad window'):
                self.canvas.unbind('<<ShapeModified>>')
    
    def update_layers(self):
        try:
            # Clear existing widgets first
            for widget in self.scrollable_frame.winfo_children():
                widget.destroy()
            
            # Clear layer items dictionary
            self.layer_items.clear()
            
            # Get all shapes
            shapes = self.canvas.find_all()
            
            # Create new layer entries
            for shape in shapes:
                try:
                    # Skip temporary shapes, crosshair, and machine position dot
                    tags = self.canvas.gettags(shape)
                    if not tags or 'temp' in tags or 'crosshair' in tags or 'machine_pos' in tags or 'grid_line' in tags:
                        continue
                    
                    # Get shape ID from tags
                    shape_id = next((tag for tag in tags if tag.startswith('shape_')), None)
                    if not shape_id:
                        continue
                    
                    # Skip if shape doesn't exist on canvas anymore
                    if not self.canvas.find_withtag(shape_id):
                        continue
                    
                    # Create frame for this layer
                    layer_frame = tk.Frame(self.scrollable_frame, bg="#263d42")
                    layer_frame.pack(fill='x', padx=5, pady=2)
                    
                    # Add visibility toggle
                    visible_var = tk.BooleanVar()
                    visibility_cb = tk.Checkbutton(layer_frame, variable=visible_var,
                                                 command=lambda s=shape_id, v=visible_var: self.toggle_visibility(s, v),
                                                 bg="#263d42", fg="white", selectcolor="#1a1a1a")
                    visibility_cb.pack(side='left')
                    
                    # Check current visibility state
                    current_state = self.canvas.itemcget(shape, 'state')
                    visible_var.set(current_state != 'hidden')
                    
                    # Add layer label with bold font for selected items
                    is_selected = shape_id in self.selected_items
                    label = tk.Label(layer_frame, text=f"Shape {shape}",
                                   bg="#263d42",
                                   fg="red" if is_selected else "white",
                                   font=('TkDefaultFont', 9, 'bold' if is_selected else 'normal'))
                    label.pack(side='left', padx=5)
                    
                    # Store widgets in layer items dictionary
                    self.layer_items[shape_id] = {
                        'frame': layer_frame,
                        'checkbox': visibility_cb,
                        'label': label,
                        'var': visible_var
                    }
                    
                    # Bind click events
                    for widget in (layer_frame, label):
                        widget.bind('<Button-1>', lambda e, s=shape_id: self.select_layer(s, e))
                        widget.bind('<Double-Button-1>', lambda e, s=shape_id: self.start_rename(layer_frame, label, s))
                    
                except Exception as e:
                    print(f"Error creating layer entry: {e}")
                    continue
                
        except Exception as e:
            print(f"Error updating layers: {e}")
    
    def create_layer_item(self, shape_id, is_group=False, group_name=None):
        frame = tk.Frame(self.scrollable_frame, bg="#263d42")
        frame.pack(fill='x', padx=5, pady=2)
        
        # Create visibility checkbox
        var = tk.BooleanVar(value=True)
        cb = tk.Checkbutton(frame, variable=var, bg="#263d42", fg="white", selectcolor="#1a1a1a",
                           command=lambda: self.toggle_visibility(shape_id, var.get()))
        cb.pack(side='left')
        
        # Create label with shape ID or group name
        display_name = group_name if is_group else f"Shape {shape_id.split('_')[1]}"
        label = tk.Label(frame, text=display_name, bg="#263d42", fg="white")
        label.pack(side='left', fill='x', expand=True)
        
        # Bind click events for selection
        frame.bind('<Button-1>', lambda e: self.select_layer(shape_id, e))
        label.bind('<Button-1>', lambda e: self.select_layer(shape_id, e))
        
        # Bind double click for renaming
        frame.bind('<Double-Button-1>', lambda e: self.start_rename(frame, label, shape_id))
        label.bind('<Double-Button-1>', lambda e: self.start_rename(frame, label, shape_id))
        
        return {'frame': frame, 'checkbox': cb, 'label': label, 'var': var}
    
    def toggle_visibility(self, shape_id, visible_var):
        """Toggle visibility of a shape"""
        # Get the current visibility state from the checkbox
        is_visible = visible_var.get()
        
        # Find all items with this shape_id
        items = self.canvas.find_withtag(shape_id)
        
        # Set visibility for all items with this shape_id
        for item in items:
            self.canvas.itemconfig(item, state='normal' if is_visible else 'hidden')
            
        # Update the checkbox state in the layer items dictionary
        if shape_id in self.layer_items:
            self.layer_items[shape_id]['var'].set(is_visible)
    
    def select_layer(self, shape_id, event):
        # If not holding Ctrl, clear previous selection
        if not event.state & 0x4:  # 0x4 is Ctrl key state
            self.selected_items.clear()
            for item_id in self.layer_items:
                self.layer_items[item_id]['frame'].configure(bg="#263d42")
                self.layer_items[item_id]['label'].configure(fg="white", font=('TkDefaultFont', 9, 'normal'))
        
        # Toggle selection
        if shape_id in self.selected_items:
            self.selected_items.remove(shape_id)
            self.layer_items[shape_id]['frame'].configure(bg="#263d42")
            self.layer_items[shape_id]['label'].configure(fg="white", font=('TkDefaultFont', 9, 'normal'))
        else:
            self.selected_items.add(shape_id)
            self.layer_items[shape_id]['frame'].configure(bg="#1a1a1a")
            self.layer_items[shape_id]['label'].configure(fg="red", font=('TkDefaultFont', 9, 'bold'))
        
        self.highlight_selected_shapes()
    
    def start_rename(self, frame, label, shape_id):
        current_text = label.cget("text")
        label.pack_forget()
        
        entry = tk.Entry(frame, bg="white", fg="black")
        entry.insert(0, current_text)
        entry.pack(side='left', fill='x', expand=True)
        entry.focus_set()
        entry.select_range(0, tk.END)
        
        def finish_rename():
            new_name = entry.get().strip()
            if new_name:
                label.configure(text=new_name)
                if shape_id in groups:
                    group_members = groups.pop(shape_id)
                    groups[new_name] = group_members
            
            entry.destroy()
            label.pack(side='left', fill='x', expand=True)
        
        entry.bind('<Return>', lambda e: finish_rename())
        entry.bind('<FocusOut>', lambda e: self.window.after(100, finish_rename))
    
    def highlight_selected_shapes(self):
        # Clean up any existing markers
        self.clean_temp_markers()
        
        # Store original widths if not already stored
        for item in self.canvas.find_withtag('all_lines'):
            if item not in self.original_widths:
                self.original_widths[item] = self.canvas.itemcget(item, 'width')
        
        # Reset all shapes to black with their original width
        for item in self.canvas.find_withtag('all_lines'):
            if self.canvas.type(item) == 'line':
                self.canvas.itemconfig(item, fill='black', width=self.original_widths[item])
            else:
                self.canvas.itemconfig(item, outline='black', width=self.original_widths[item])
        
        # Highlight selected ones in green with width 3
        for shape_id in self.selected_items:
            items = self.canvas.find_withtag(shape_id)
            for item in items:
                if self.canvas.type(item) == 'line':
                    self.canvas.itemconfig(item, fill='#00FF00', width=3)
                else:
                    self.canvas.itemconfig(item, outline='#00FF00', width=3)
    
    def delete_selected(self):
        # Store shapes to delete
        shapes_to_delete = list(self.selected_items)
        
        # Clear selection first
        self.selected_items.clear()
        
        # Delete shapes from canvas
        for shape_id in shapes_to_delete:
            items = self.canvas.find_withtag(shape_id)
            for item in items:
                self.canvas.delete(item)
            
            # Remove from layer items if it exists
            if shape_id in self.layer_items:
                if self.layer_items[shape_id]['frame'].winfo_exists():
                    self.layer_items[shape_id]['frame'].destroy()
                del self.layer_items[shape_id]
        
        # Clean up any temporary markers
        self.clean_temp_markers()
        
        # Force a complete refresh of the layers window
        self.update_layers()
        
        # Generate event to notify of shape removal
        self.canvas.event_generate('<<ShapeRemoved>>')
    
    def toggle_selection_tool(self):
        self.is_selecting = not self.is_selecting
        self.select_btn.configure(bg="#1a1a1a" if self.is_selecting else "#263d42")
        
        if self.is_selecting:
            self.previous_tool = None  # We don't need to track the previous tool in this module
            self.canvas.unbind('<Button-1>')
            self.canvas.unbind('<B1-Motion>')
            self.canvas.unbind('<ButtonRelease-1>')
            self.canvas.bind('<Button-1>', self.on_canvas_click)
            self.canvas.bind('<B1-Motion>', self.on_canvas_drag)
            self.canvas.bind('<ButtonRelease-1>', self.on_canvas_release)
        else:
            # Just restore default bindings when deselecting
            self.canvas.bind('<Button-1>', self.on_shape_click)
    
    def on_canvas_click(self, event):
        if not self.is_selecting:
            return
            
        self.start_x = self.canvas.canvasx(event.x)
        self.start_y = self.canvas.canvasy(event.y)
        
        # Increased tolerance for clicking (from 2 to 5 pixels)
        items = self.canvas.find_overlapping(
            self.start_x-5, self.start_y-5,
            self.start_x+5, self.start_y+5
        )
        
        clicked_shape = None
        for item in items:
            tags = self.canvas.gettags(item)
            shape_id = next((tag for tag in tags if tag.startswith('shape_')), None)
            if shape_id:
                clicked_shape = shape_id
                break
        
        if clicked_shape:
            # If clicking a shape, prepare for movement if it's selected
            if clicked_shape in self.selected_items or not event.state & 0x4:
                self.is_moving = True
                self.moved_items.clear()
                
                # If clicking unselected shape without Ctrl, clear selection and select it
                if clicked_shape not in self.selected_items and not event.state & 0x4:
                    self.selected_items.clear()
                    for item_id in self.layer_items:
                        self.layer_items[item_id]['frame'].configure(bg="#263d42")
                        self.layer_items[item_id]['label'].configure(fg="white", font=('TkDefaultFont', 9, 'normal'))
                    self.selected_items.add(clicked_shape)
                    self.layer_items[clicked_shape]['frame'].configure(bg="#1a1a1a")
                    self.layer_items[clicked_shape]['label'].configure(fg="red", font=('TkDefaultFont', 9, 'bold'))
                
                # Store initial positions for all selected shapes
                for shape_id in self.selected_items:
                    items = self.canvas.find_withtag(shape_id)
                    for item in items:
                        coords = self.canvas.coords(item)
                        if coords:
                            self.moved_items[item] = coords.copy()
                
                self.highlight_selected_shapes()
        else:
            # If clicking empty space, start selection rectangle
            self.is_moving = False
            if not event.state & 0x4:  # If Ctrl is not held
                self.selected_items.clear()
                for item_id in self.layer_items:
                    self.layer_items[item_id]['frame'].configure(bg="#263d42")
                    self.layer_items[item_id]['label'].configure(fg="white", font=('TkDefaultFont', 9, 'normal'))
                self.highlight_selected_shapes()
            
            if self.selection_rect:
                self.canvas.delete(self.selection_rect)
            self.selection_rect = self.canvas.create_rectangle(
                self.start_x, self.start_y,
                self.start_x, self.start_y,
                outline='#00ff00', width=1, dash=(2, 2)
            )
    
    def on_canvas_drag(self, event):
        if not self.is_selecting:
            return
            
        current_x = self.canvas.canvasx(event.x)
        current_y = self.canvas.canvasy(event.y)
        
        if self.is_moving and self.moved_items:
            # Move all selected items together
            dx = current_x - self.start_x
            dy = current_y - self.start_y
            
            for item, original_coords in self.moved_items.items():
                new_coords = []
                for i in range(0, len(original_coords), 2):
                    new_coords.append(original_coords[i] + dx)
                    new_coords.append(original_coords[i + 1] + dy)
                self.canvas.coords(item, *new_coords)
        elif self.selection_rect:
            # Update selection rectangle
            self.canvas.coords(self.selection_rect,
                             self.start_x, self.start_y,
                             current_x, current_y)
    
    def on_canvas_release(self, event):
        if not self.is_selecting:
            return
            
        if self.is_moving:
            self.is_moving = False
            self.moved_items.clear()
        elif self.selection_rect:
            # Get items in selection rectangle
            bbox = self.canvas.coords(self.selection_rect)
            if bbox:
                x1, y1, x2, y2 = bbox
                x1, x2 = min(x1, x2), max(x1, x2)
                y1, y2 = min(y1, y2), max(y1, y2)
                
                items = self.canvas.find_enclosed(x1, y1, x2, y2)
                
                if not items and abs(x2 - x1) < 3 and abs(y2 - y1) < 3:
                    # If clicking in empty space and not dragging, clear selection
                    self.selected_items.clear()
                    for item_id in self.layer_items:
                        self.layer_items[item_id]['frame'].configure(bg="#263d42")
                        self.layer_items[item_id]['label'].configure(fg="white", font=('TkDefaultFont', 9, 'normal'))
                else:
                    # Add found items to selection
                    for item in items:
                        tags = self.canvas.gettags(item)
                        shape_id = next((tag for tag in tags if tag.startswith('shape_')), None)
                        if shape_id and shape_id not in self.selected_items:
                            self.selected_items.add(shape_id)
                            self.layer_items[shape_id]['frame'].configure(bg="#1a1a1a")
                            self.layer_items[shape_id]['label'].configure(fg="red", font=('TkDefaultFont', 9, 'bold'))
            
            self.canvas.delete(self.selection_rect)
            self.selection_rect = None
            self.highlight_selected_shapes()
    
    def on_shape_click(self, event):
        if not self.is_selecting:
            return
            
        # Get clicked item
        clicked_item = event.widget.find_closest(event.x, event.y)[0]
        tags = event.widget.gettags(clicked_item)
        shape_id = next((tag for tag in tags if tag.startswith('shape_')), None)
        
        if shape_id:
            # If not holding Ctrl, clear previous selection
            if not event.state & 0x4:  # 0x4 is Ctrl key state
                self.selected_items.clear()
                for item_id in self.layer_items:
                    self.layer_items[item_id]['frame'].configure(bg="#263d42")
                    self.layer_items[item_id]['label'].configure(fg="white", font=('TkDefaultFont', 9, 'normal'))
            
            # Toggle selection
            if shape_id in self.selected_items:
                self.selected_items.remove(shape_id)
                self.layer_items[shape_id]['frame'].configure(bg="#263d42")
                self.layer_items[shape_id]['label'].configure(fg="white", font=('TkDefaultFont', 9, 'normal'))
            else:
                self.selected_items.add(shape_id)
                self.layer_items[shape_id]['frame'].configure(bg="#1a1a1a")
                self.layer_items[shape_id]['label'].configure(fg="red", font=('TkDefaultFont', 9, 'bold'))
            
            self.highlight_selected_shapes()
    
    def toggle_grid(self):
        """Toggle grid visibility"""
        if self.grid_var.get():
            # Draw grid
            self.canvas.delete('grid_line')
            # Creates all vertical lines
            for i in range(0, 1000, 50):
                self.canvas.create_line([(i, 0), (i, 1000)], tag='grid_line', fill='gray75')
            # Creates all horizontal lines
            for i in range(0, 1000, 50):
                self.canvas.create_line([(0, i), (1000, i)], tag='grid_line', fill='gray75')
        else:
            # Remove grid
            self.canvas.delete('grid_line')

    def on_canvas_cleared(self, event=None):
        """Handle canvas clear event"""
        # Clear all selections
        self.selected_items.clear()
        
        # Clear all temporary markers
        self.clean_temp_markers()
        
        # Update layers window
        self.update_layers()

    def clean_temp_markers(self):
        """Clean up all temporary markers on the canvas"""
        self.canvas.delete('temp_marker')
        self.canvas.delete('snap_point')
        self.canvas.delete('snap_line')
        self.canvas.delete('radius_marker')
        self.canvas.delete('center_marker')
        self.canvas.delete('temp')
        self.canvas.delete('guide_point')  # Add this for line tool dots
        self.canvas.delete('guide_line')   # Add this for line tool guides
