import tkinter as tk
from tkinter import ttk
from tkinter import CENTER, Canvas, filedialog, Text, messagebox
from turtle import left, right
from PIL import ImageTk
import os
import winsound  # Add winsound import
from PIL import ImageDraw
from PIL import ImageFont
from click import open_file
from tkinter import END
from tkcolorpicker import askcolor
from pyrsistent import b
from tkinter import *
from tkinter.filedialog import asksaveasfilename as saveAs
from PIL import Image, ImageDraw
import serial
from serial import *
import time
import os
from datetime import time
from PIL import Image
import matplotlib.pyplot as plt
from config import *
from utils import *
import json  # Add json import for config file reading
import gcodegenerator
import matplotlib.pyplot as plt
import importlib
import config3
from Mechanicus_Config import *
from Mechanicus_shape_detection_image_working import*
from Spiral import*
import math
import keyboard
import numpy as np
import cv2
from layers_window import LayersWindow
import xml.etree.ElementTree as ET
from svg.path import parse_path, Line
import threading
import queue
from svg_import import import_svg  # Add this import
from webcam_feed import WebcamFeed
from line_editor import LineEditor
import cairo
import svg_export  # Import the new SVG export module
import engrave
from snaptools import snap_to_grid, snap_to_endpoints
# Add these global variables near the start of the file, after the root window creation but before any function definitions
root = tk.Tk()
root.title("MECHANICUS V.0.1 Beta. (c)Reservoir Frogs 2023")
root.configure(bg="#263d42", borderwidth=0)
root.iconphoto(True, tk.PhotoImage(file='icon/icon.png'))
root.geometry('324x1000+0+0')

# Add snap tool button
snap_tool_button = tk.Button(root, text="Snap Tools", bd=2, height=1, width=14, 
                           fg="white", bg="#263d42", command=lambda: open_snap_tool_window())
snap_tool_button.place(x=1020, y=24)

# Global variables for drawing tools
active_tool = None
tool_buttons = {}
tools_window = None  # Track the drawing tools window
current_line_points = []  # Store points for current line
current_line_segments = []  # Store line segment IDs
start_marker = None  # Store the start marker ID
current_circle = None  # Store the current circle being drawn
circle_center_marker = None  # Store the circle's center marker
current_rectangle = None  # Store the current rectangle being drawn
rectangle_start_marker = None  # Store the rectangle's start marker
current_polygon = None  # Store the current polygon being drawn
polygon_center_marker = None  # Store the polygon's center marker
lastx, lasty = None, None
linecount = 0
hexstr = "#000000"
rgb = (0, 0, 0)
selected_line_id = None  # Global variable for line selection
selected_text_index = None  # For text selection
move_start_x = 0  # Initialize movement coordinates
move_start_y = 0
# Global variables for grid and snap functionality
grid_var = tk.BooleanVar(value=False)
snap_var = tk.BooleanVar(value=False)
snap_to_endpoints_var = tk.BooleanVar(value=True)  # Default to True for endpoint snapping
grid_size_var = tk.StringVar(value="5.0")  # Default grid size 5mm
# Global serial connection
ser = None

# Add at the top with other global variables
recorded_moves = []  # Store moves as [x, y, laser_on, is_start] tuples
layers_window = None  # Store reference to layers window
drawing_tools_window = None  # Store reference to drawing tools window

# Selection tool variables
is_selecting = False
selection_rect = None
start_x = 0
start_y = 0
moved_items = {}
is_moving = False
previous_tool = None
current_tool = None  # Add this line
original_widths = {}
selected_items = set()  # Store selected items

# Add after imports but before window creation
# Global variables for shape management
current_line = None
current_circle = None
current_rectangle = None
current_polygon = None
current_arc = None
current_shape_id = "shape_0"
linecount = 0
lastx = None
lasty = None

# Initialize canvas history
canvas_history = []
current_history_index = -1
max_history = 50
snap_indicator = None


def init_canvas_history():
    global current_history_index, canvas_history, current_shape_id, linecount
    canvas_history = []
    current_history_index = -1
    current_shape_id = f"shape_0"
    linecount = 0
    save_canvas_state()  # Save initial empty state

def save_canvas_state():
    global canvas_history, current_history_index
    # Get all canvas items and their properties
    state = []
    for item in cv.find_all():
        try:
            item_type = cv.type(item)
            coords = cv.coords(item)
            tags = cv.gettags(item)
            
            # Skip temporary items, grid lines, and crosshair elements
            if any(tag in ['start_marker', 'preview_line', 'radius_marker', 'center_marker', 
                          'grid_lines', 'above_all', 'below_all', 'crosshair', 'machine_pos'] for tag in tags):
                continue
                
            config = {
                'type': item_type,
                'coords': coords,
                'fill': cv.itemcget(item, 'fill'),
                'width': cv.itemcget(item, 'width'),
                'tags': [tag for tag in tags if not tag in ['above_all', 'below_all']]  # Filter out special tags
            }
            
            # Add type-specific properties
            if item_type == 'arc':
                config['start'] = float(cv.itemcget(item, 'start'))
                config['extent'] = float(cv.itemcget(item, 'extent'))
                config['outline'] = cv.itemcget(item, 'outline')
                config['style'] = cv.itemcget(item, 'style')
            elif item_type in ['oval', 'rectangle', 'polygon']:
                config['outline'] = cv.itemcget(item, 'outline')
            
            state.append(config)
        except Exception as e:
            print(f"Error saving item: {e}")
    
    # Remove any redo states and append new state
    canvas_history = canvas_history[:current_history_index + 1]
    canvas_history.append(state)
    current_history_index = len(canvas_history) - 1
    
    # Limit history size
    if len(canvas_history) > max_history:
        canvas_history = canvas_history[-max_history:]
        current_history_index = len(canvas_history) - 1
        
    # Generate event to update layers window
    cv.event_generate('<<ShapeAdded>>')

def undo():
    global current_history_index
    if current_history_index > 0:
        current_history_index -= 1
        was_grid_visible = grid_var.get()  # Store grid state
        restore_canvas_state(canvas_history[current_history_index])
        if was_grid_visible:  # Restore grid if it was visible
            create_grid()

def redo():
    global current_history_index
    if current_history_index < len(canvas_history) - 1:
        current_history_index += 1
        was_grid_visible = grid_var.get()  # Store grid state
        restore_canvas_state(canvas_history[current_history_index])
        if was_grid_visible:  # Restore grid if it was visible
            create_grid()

def restore_canvas_state(state):
    # Store grid visibility
    was_grid_visible = grid_var.get()
    
    # Clear canvas except grid and crosshair
    for item in cv.find_all():
        if not any(tag in cv.gettags(item) for tag in ['grid_lines', 'crosshair', 'machine_pos']):
            cv.delete(item)
    
    # Get current scale factor
    try:
        scale_str = scale_var.get().rstrip('%')
        current_scale = float(scale_str) / 100.0
    except:
        current_scale = 1.0
    
    # Restore items
    for item in state:
        try:
            item_type = item['type']
            coords = list(item['coords'])  # Convert to list for modification
            
            # Apply current scale to coordinates
            for i in range(len(coords)):
                coords[i] = coords[i] * current_scale
                
            tags = item['tags']
            fill = item['fill']
            width = float(item['width'])  # Don't scale the width
            
            if item_type == 'line':
                cv.create_line(coords, 
                             fill=fill, 
                             width=width,
                             tags=tags,
                             capstyle=ROUND)
            elif item_type == 'oval':
                cv.create_oval(coords,
                             outline=item.get('outline', fill),
                             width=width,
                             tags=tags)
            elif item_type == 'rectangle':
                cv.create_rectangle(coords,
                                outline=item.get('outline', fill),
                                width=width,
                                tags=tags)
            elif item_type == 'polygon':
                cv.create_polygon(coords,
                              fill='',
                              outline=item.get('outline', fill),
                              width=width,
                              tags=tags)
            elif item_type == 'arc':
                cv.create_arc(coords,
                          start=float(item.get('start', 0)),
                          extent=float(item.get('extent', 90)),
                          fill='',
                          outline=item.get('outline', fill),
                          width=width,
                          style=item.get('style', 'arc'),
                          tags=tags)
        except Exception as e:
            print(f"Error restoring item: {e}")
    
    # Make sure grid stays on top if it was visible
    if was_grid_visible:
        cv.tag_raise('grid_lines')
        cv.tag_lower('below_all')
    
    # Recreate crosshair to ensure it's working properly
    create_crosshair()
    cv.tag_raise('crosshair')
    cv.tag_raise('machine_pos')  # Keep machine position dot on top

def create_grid():
    if grid_var.get():
        # Get current scale factor
        try:
            scale_text = scale_var.get().rstrip('%')
            current_scale = float(scale_text) / 100.0
        except:
            current_scale = 1.0
        
        # Get base grid spacing and adjust for scale
        base_spacing = float(grid_size_var.get())
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

def get_snap_point(x, y, is_final=False):
    """Get the nearest grid point for snapping"""
    x = cv.canvasx(x)
    y = cv.canvasy(y)
    
    # Remove any existing snap markers and labels
    cv.delete('snap_point')
    cv.delete('snap_label')
    
    # Initialize variables
    snap_x, snap_y = x, y
    found_snap = False
    snap_type = None
    
    # Check for endpoint snapping first if enabled
    if snap_to_endpoints_var.get():
        endpoint = snap_to_endpoints(cv, x, y, tolerance=10.0)
        if endpoint:
            snap_x, snap_y = endpoint
            found_snap = True
            snap_type = "Endpoint"
            # Create green marker and label for endpoint snap
            cv.create_oval(snap_x-4, snap_y-4, snap_x+4, snap_y+4,
                         fill='#00FF00', outline='white', tags='snap_point')
            cv.create_text(snap_x, snap_y-15, text=snap_type, 
                         fill='#0088FF', font=('Arial', 8), tags='snap_label')
    
    # Only snap to grid if grid is visible and grid snap is enabled
    if not found_snap and grid_var.get() and snap_var.get():
        try:
            scale_text = scale_var.get().rstrip('%')
            current_scale = float(scale_text) / 100.0
        except:
            current_scale = 1.0
        
        try:
            base_spacing = float(grid_size_var.get())
            if base_spacing <= 0:
                base_spacing = 50
        except:
            base_spacing = 50
        
        scaled_spacing = base_spacing * current_scale
        
        # Calculate nearest grid points
        snap_x = round(x / scaled_spacing) * scaled_spacing
        snap_y = round(y / scaled_spacing) * scaled_spacing
        found_snap = True
    
    return snap_x, snap_y

def on_grid_toggle():
    create_grid()

def on_grid_size_change(*args):
    if grid_var.get():
        create_grid()

# Function to open the layers window
def open_layers_window():
    global layers_window
    if not layers_window:
        layers_window = LayersWindow(root, cv)

def toggle_select():
    global is_selecting, previous_tool, active_tool
    is_selecting = not is_selecting
    
    if is_selecting:
        # Deactivate line editor selection if active
        if hasattr(win, 'line_editor') and win.line_editor:
            win.line_editor.deactivate_selection()
            
        # Store current tool and deactivate it
        previous_tool = active_tool
        active_tool = None
        
        # Clear any existing selection
        clear_selection()
        
        # Reset all tool buttons to default color
        for btn in tool_buttons.values():
            btn.configure(bg="#263d42")
            
        # Set select button to green
        Selectbutton.configure(bg="#00FF00")
        
        # Change cursor to crosshair for selection
        cv.configure(cursor="crosshair")
        
        # Unbind all existing events
        cv.unbind('<Button-1>')
        cv.unbind('<B1-Motion>')
        cv.unbind('<ButtonRelease-1>')
        
        # Bind selection events
        cv.bind('<Button-1>', on_canvas_click)
        cv.bind('<B1-Motion>', on_canvas_drag)
        cv.bind('<ButtonRelease-1>', on_canvas_release)
    else:
        # Reset select button color
        Selectbutton.configure(bg="#263d42")
        
        # Reset cursor
        cv.configure(cursor="")
        
        # Clear any existing selection
        clear_selection()
        
        # Restore previous tool bindings if there was one
        if previous_tool:
            select_tool(previous_tool)
        else:
            # If no previous tool, just unbind events
            cv.unbind('<Button-1>')
            cv.unbind('<B1-Motion>')
            cv.unbind('<ButtonRelease-1>')

def on_canvas_click(event):
    global start_x, start_y, is_moving, moved_items, selection_rect
    if not is_selecting:
        return
        
    start_x = cv.canvasx(event.x)
    start_y = cv.canvasy(event.y)
    
    # Check for clicked items with increased tolerance
    items = cv.find_overlapping(
        start_x-5, start_y-5,
        start_x+5, start_y+5
    )
    
    clicked_shape = None
    for item in items:
        tags = cv.gettags(item)
        shape_id = next((tag for tag in tags if tag.startswith('shape_')), None)
        if shape_id:
            clicked_shape = shape_id
            break
    
    if clicked_shape:
        # If clicking a shape, prepare for movement if it's selected
        if clicked_shape in selected_items or not event.state & 0x4:
            is_moving = True
            moved_items.clear()
            
            # If clicking unselected shape without Ctrl, clear selection
            if clicked_shape not in selected_items and not event.state & 0x4:
                selected_items.clear()
                selected_items.add(clicked_shape)
            
            # Store initial positions for all selected shapes
            for shape_id in selected_items:
                items = cv.find_withtag(shape_id)
                for item in items:
                    coords = cv.coords(item)
                    if coords:
                        moved_items[item] = coords.copy()
            
            highlight_selected_shapes()
    else:
        # If clicking empty space, start selection rectangle
        is_moving = False
        if not event.state & 0x4:  # If Ctrl is not held
            selected_items.clear()
            highlight_selected_shapes()
        
        if selection_rect:
            cv.delete(selection_rect)
        selection_rect = cv.create_rectangle(
            start_x, start_y,
            start_x, start_y,
            outline='#00ff00', width=1, dash=(2, 2)
        )

def on_canvas_drag(event):
    global selection_rect
    if not is_selecting:
        return
        
    current_x = cv.canvasx(event.x)
    current_y = cv.canvasy(event.y)
    
    if is_moving and moved_items:
        # Move all selected items together
        dx = current_x - start_x
        dy = current_y - start_y
        
        for item, original_coords in moved_items.items():
            new_coords = []
            for i in range(0, len(original_coords), 2):
                new_coords.append(original_coords[i] + dx)
                new_coords.append(original_coords[i + 1] + dy)
            cv.coords(item, *new_coords)
    elif selection_rect:
        # Update selection rectangle
        cv.coords(selection_rect,
                 start_x, start_y,
                 current_x, current_y)

def on_canvas_release(event):
    global is_moving, moved_items, selection_rect
    if not is_selecting:
        return
        
    if is_moving:
        is_moving = False
        moved_items.clear()
    elif selection_rect:
        # Get items in selection rectangle
        bbox = cv.coords(selection_rect)
        if bbox:
            x1, y1, x2, y2 = bbox
            x1, x2 = min(x1, x2), max(x1, x2)
            y1, y2 = min(y1, y2), max(y1, y2)
            
            items = cv.find_enclosed(x1, y1, x2, y2)
            
            if not items and abs(x2 - x1) < 3 and abs(y2 - y1) < 3:
                # If clicking in empty space and not dragging, clear selection
                selected_items.clear()
            else:
                # Add found items to selection
                for item in items:
                    tags = cv.gettags(item)
                    shape_id = next((tag for tag in tags if tag.startswith('shape_')), None)
                    if shape_id and shape_id not in selected_items:
                        selected_items.add(shape_id)
        
        cv.delete(selection_rect)
        selection_rect = None
        highlight_selected_shapes()

def highlight_selected_shapes():
    # Store original widths if not already stored
    for item in cv.find_withtag('all_lines'):
        if item not in original_widths:
            original_widths[item] = cv.itemcget(item, 'width')
    
    # Reset all shapes to black with their original width
    for item in cv.find_withtag('all_lines'):
        if cv.type(item) == 'line':
            cv.itemconfig(item, fill='black', width=original_widths[item])
        else:
            cv.itemconfig(item, outline='black', width=original_widths[item])
    
    # Highlight selected ones in green with width 3
    for shape_id in selected_items:
        items = cv.find_withtag(shape_id)
        for item in items:
            if cv.type(item) == 'line':
                cv.itemconfig(item, fill='#00FF00', width=3)
            elif cv.type(item) == 'text':
                cv.itemconfig(item, fill='#00FF00')
            else:
                cv.itemconfig(item, outline='#00FF00', width=3)
                cv.itemconfig(item, fill='')  # Ensure fill is empty for shapes

# Global variables for drawing tools
active_tool = None
tool_buttons = {}
current_line_points = []  # Store points for current line
current_line_segments = []  # Store line segment IDs
start_marker = None  # Store the start marker ID
current_circle = None  # Store the current circle being drawn
circle_center_marker = None  # Store the circle's center marker
current_rectangle = None  # Store the current rectangle being drawn
rectangle_start_marker = None  # Store the rectangle's start marker
current_polygon = None  # Store the current polygon being drawn
polygon_center_marker = None  # Store the polygon's center marker
lastx, lasty = None, None
linecount = 0
hexstr = "#000000"
rgb = (0, 0, 0)
selected_line_id = None  # Global variable for line selection
selected_text_index = None  # For text selection
move_start_x = 0  # Initialize movement coordinates
move_start_y = 0

# Global serial connection
ser = None

# Add at the top with other global variables
recorded_moves = []  # Store moves as [x, y, laser_on, is_start] tuples


def open_layers_window():
    """Create and show the layers window"""
    from layers_window import LayersWindow
    return LayersWindow(root, cv)

# Function to connect to the machine
def connect_machine():
    global ser
    try:
        com_port = get_com_port()
        baud_rate = get_baud_rate()
        print(f"Attempting to connect to {com_port} at {baud_rate} baud")
        
        if ser is not None and ser.is_open:
            print("Closing existing connection")
            ser.close()
        
        ser = serial.Serial(com_port, baud_rate, timeout=1)
        print("Serial connection established")
        
        # Change button color to green
        connect_btn.config(bg="green")
        
        # Play a sound
        winsound.Beep(1000, 500)  # Frequency 1000 Hz, Duration 500 ms
        
        # Initialize crosshair after connection
        print("Initializing crosshair")
        create_crosshair()
        update_machine_position()
        print("Crosshair initialized and position updates started")
        
        # Query initial position
        ser.write(b'M114\n')
        time.sleep(0.1)
        while ser.in_waiting:
            response = ser.readline().decode('utf-8').strip()
            print(f"Machine response: {response}")
            if 'X:' in response:
                print(f"Initial position: {response}")
                break
        
        # Initialize engrave module with globals
        engrave.set_globals(cv, ser, active_tool)
        engrave.set_ui_elements(draw_speed_input, laser_power_input, layers_input, z_axis_active_var, laser_active_var)
        
        return True
    except Exception as e:
        print(f"Error connecting to machine: {e}")
        if ser is not None and ser.is_open:
            ser.close()
        return False

# Initialize global variables
gcode = ""
global job_id
global xt, yt


# Get screen dimensions
x1 = str(root.winfo_screenwidth())
y1 = str(root.winfo_screenheight())
x4 = (int(x1)/3)
y4 = (int(y1)/3)
width = root.winfo_screenwidth()
height = root.winfo_screenheight()
laser_active_var = tk.BooleanVar()

# Add Z-axis checkbox near laser checkbox
z_axis_active_var = tk.BooleanVar()

# Function to convert text to path outlines using Cairo
def text_to_outlines(text_elem):
    return svg_export.text_to_outlines(text_elem)

# Function to save the current canvas drawing as SVG
def save_as_svg(filename):
    svg_export.save_as_svg(cv, filename, text_elements)

def save_svg():
    file_path = filedialog.asksaveasfilename(defaultextension='.svg', filetypes=[('SVG files', '*.svg')])
    if not file_path:
        return
    save_as_svg(file_path)
    messagebox.showinfo("Success", f"Drawing saved as SVG to {file_path}")

# Function to activate Paint Gcode
def activate_Paint_Gcode(event):
    global gcode
    if laser_active_var.get():
        # Turn on laser
        ser.write(f"M3 S{laser_power_input.get('1.0', 'end-1c')}\n".encode())
        ser.flush()
    # Start drawing line
    Paint_Gcode(event, gcode)

# Function to activate text tool
def activate_text(e):
    global lastx, lasty
    win.unbind('<1>')
    win.unbind('<3>')
    cv.unbind('<B1-Motion>')
    cv.unbind('<B3-Motion>')
    cv.unbind('<ButtonRelease-1>')
    cv.unbind('<ButtonRelease-3>')
    win.unbind('<Delete>')
    cv.bind('<Button-1>', select_text)
    cv.bind('<B1-Motion>', move_text)
    cv.bind('<ButtonRelease-1>', on_mouse_release)
    cv.bind('<Button-3>', place_text)
    win.bind('<Delete>', delete_text)
    lastx, lasty = cv.canvasx(e.x), cv.canvasy(e.y)

# Function to paint Gcode line
def Paint_Gcodeline(e):
    global lastx, lasty
    x, y = e.x, e.y
    cv.create_line((lastx, lasty, x, y), width=3, tags='tag1')
    draw.line((lastx, lasty, x, y), fill='red', width=1)
    lastx, lasty = x, y

# Function to clear canvas
def clear():
    global recorded_moves, linecount, grid_var, snap_var
    
    # Store current states
    was_grid_enabled = grid_var.get()
    was_snap_enabled = snap_var.get()
    current_grid_size = grid_size_var.get()
    current_scale = scale_var.get()
    
    # Clear canvas
    cv.delete('all_lines')
    recorded_moves = []
    linecount = 0
    
    # Recreate the grid if it was visible
    if was_grid_enabled:
        create_grid()
        grid_var.set(True)
    
    # Restore snap state and variables
    if was_snap_enabled:
        snap_var.set(True)
    grid_size_var.set(current_grid_size)
    scale_var.set(current_scale)
    
    # Notify layers window that canvas was cleared
    cv.event_generate('<<CanvasCleared>>')
    
    # Save the cleared state
    save_canvas_state()
    print("Canvas and recorded moves cleared")
    
    # Delete all items on canvas
    for item in cv.find_all():
        tags = cv.gettags(item)
        if 'guide' in tags or 'marker' in tags or 'center_point' in tags:
            cv.delete(item)
    
    # Clear any stored guides or markers in the markers window if it exists
    if hasattr(win, 'markers_window'):
        win.markers_window.guides.clear()
        win.markers_window.center_points.clear()

# Function to exit application
def exitt():
    exit()

# Function to change paint Gcode color
def Paint_Gcodecolor():
    global hexstr
    (triple, hexstr) = askcolor()
    if hexstr:
        print(str(hexstr))
    cv.itemconfigure(draw, fill=hexstr)
    Paint_Gcodebutton.config(text='Pick Color')
    Paint_Gcodebutton["background"] = hexstr

# Function to paint Gcode with oil
def Oil_Paint_Gcode(e, gcode):
    global linecount
    global hexstr
    global bsize
    global lastx, lasty
    global stroke_length
    canvas_width = cv.winfo_width()
    canvas_height = cv.winfo_height()
    from config3 import bed_max_x, bed_max_y
    bed_height = bed_max_y
    bed_width = bed_max_x
    img2 = ImageTk.PhotoImage(Image.open("temp2.png"))
    cv.bind('<B1-Motion>', lambda event: Paint_Gcode(event, gcode))
    bsize = brush.get(1.0, "end-1c")
    x, y = e.x, e.y
    bed_x = x * (bed_width / canvas_width)
    bed_y = (canvas_height - y) * (bed_height / canvas_height)
    if lastx is not None and lasty is not None:
        cv.create_line(lastx, lasty, x, y, fill=hexstr, width=int(bsize), capstyle=ROUND, smooth=TRUE, splinesteps=120, tags=('all_lines', f"'{linecount}'"))
        draw.line((lastx, lasty, x, y), fill='green', width=4)
        print(f"create line '{linecount}' from ({lastx},{lasty}) to ({x},{y}) with brush size {bsize} and color {hexstr}")
        gcode_line = f"G1 X{bed_x:.2f} Y{bed_y:.2f} Z5 F{3000}\n"
        print(f"G-code command: {gcode_line}")
        send_gcode(gcode_line)
        stroke_length += ((bed_x - last_bed_x)**2 + (bed_y - last_bed_y)**2)**0.5
        last_bed_x, last_bed_y = bed_x, bed_y
        if stroke_length >= 30:
            Gbrush_refill(None)
            stroke_length = 0
        linecount += 1
    else:
        last_bed_x, last_bed_y = bed_x, bed_y
    
    lastx, lasty = x, y

    def key_released(e):
        send_gcode("G1 Z10")
        cv.bind('<ButtonRelease-1>', key_released)
        global linecount
        print(f"end line '{linecount}' at ({lastx},{lasty})")
        linecount += 1

    cv.bind('<ButtonRelease-1>', key_released)
    
def activate_gcode():
    global ser
    if ser is None or not ser.is_open:
        if not connect_machine():
            return

    # Get z_Travel from config
    from config3 import zTravel
    
    # Send G-code commands to the plotter
    gcode_commands = [
        "G21\n",   # Set units to millimeters
        "G90\n",   # Set absolute positioning
        "M82\n",   # Set extruder to absolute mode
        "M107\n",  # Turn off fan
        "G28\n",   # Home all axes
        "G92 E0\n",  # Reset extruder position
        f"G1 Z{zTravel} F3000\n",  # Move to travel height
        "G1 X0.0 Y0.0 F9000\n",  # Move to origin
        "G92 E0\n",  # Reset extruder position
        "G1 F1400\n"  # Set movement speed
    ]
    for command in gcode_commands:
        ser.write(str.encode(command))
        with open('gcode_test.gcode', 'a') as f:
            f.write(command)

    # Set the feedrate
    ser.write(str.encode("G01 F8000\n"))

def Paint_Gcode(e, gcode):
    global linecount, lastx, lasty, ser, recorded_moves
    current_move = []  # Store commands for current move
    
    # Get canvas coordinates
    x = cv.canvasx(e.x)
    y = cv.canvasy(e.y)
    
    # Get machine settings
    from config3 import bed_max_x, bed_max_y, zDraw as z_Draw, zLift as z_Lift, zTravel as z_Travel
    
    # Transform coordinates
    canvas_width = cv.winfo_width()
    canvas_height = cv.winfo_height()
    bed_x = (x * bed_max_x) / canvas_width
    bed_y = bed_max_y - ((y * bed_max_y) / canvas_height)
    
    # Get speeds from inputs
    draw_speed = int(draw_speed_input.get("1.0", "end-1c")) if draw_speed_input.get("1.0", "end-1c").strip() else 1000
    
    if lastx is not None and lasty is not None:
        cv.create_line(lastx, lasty, x, y, 
                      fill=hexstr,
                      width=int(brush.get("1.0", "end-1c")),
                      capstyle=ROUND,
                      tags=('all_lines', f"'{linecount}'"))
        
        # Send G-code if connected
        if ser is not None and ser.is_open:
            # Move to position at drawing height
            if z_axis_active_var.get():
                z_cmd = f"G1 Z{z_Draw} F{draw_speed}"
                current_move.append(z_cmd)
                send_gcode(z_cmd + "\n")
                time.sleep(0.1)  # Extra delay for Z movement
            
            # Move to position
            move_cmd = f"G1 X{bed_x:.3f} Y{bed_y:.3f} F{draw_speed}"
            current_move.append(move_cmd)
            send_gcode(move_cmd + "\n")
            
            # Activate laser if checkbox is checked
            if laser_active_var.get():
                laser_power = laser_power_input.get("1.0", "end-1c").strip()
                laser_cmd = f"M3 S{laser_power}"
                current_move.append(laser_cmd)
                send_gcode(laser_cmd + "\n")
        linecount += 1
    else:
        # First point of new line - move to position at travel height first
        if ser is not None and ser.is_open:
            # Move to travel height first
            if z_axis_active_var.get():
                travel_z_cmd = f"G1 Z{z_Travel} F{draw_speed}"
                current_move.append(travel_z_cmd)
                send_gcode(travel_z_cmd + "\n")
                time.sleep(0.1)  # Extra delay for Z movement
            
            # Move to new position
            travel_cmd = f"G0 X{bed_x:.3f} Y{bed_y:.3f} F{draw_speed}"
            current_move.append(travel_cmd)
            send_gcode(travel_cmd + "\n")
            
            # Lower to drawing height if mouse button is held
            if e.state & 0x0100:  # Left mouse button held
                if z_axis_active_var.get():
                    draw_z_cmd = f"G1 Z{z_Draw} F{draw_speed}"
                    current_move.append(draw_z_cmd)
                    send_gcode(draw_z_cmd + "\n")
                    time.sleep(0.1)  # Extra delay for Z movement
                
                if laser_active_var.get():
                    laser_power = laser_power_input.get("1.0", "end-1c").strip()
                    laser_cmd = f"M3 S{laser_power}"
                    current_move.append(laser_cmd)
                    send_gcode(laser_cmd + "\n")
    
    lastx, lasty = x, y
    
    # Add the current move sequence to recorded_moves if not empty
    if current_move:
        recorded_moves.append(current_move)
    
    def key_released(e):
        global lastx, lasty
        if ser is not None and ser.is_open:
            # Turn off laser and move to travel height when done drawing
            end_move = []
            end_move.append("M5")  # Turn off laser
            
            if z_axis_active_var.get():
                end_z_cmd = f"G1 Z{z_Travel} F{draw_speed}"
                end_move.append(end_z_cmd)
                send_gcode(end_z_cmd + "\n")
                time.sleep(0.1)  # Extra delay for Z movement
            
            recorded_moves.append(end_move)  # Record end move
            send_gcode("M5\n")
        lastx = None
        lasty = None
    
    cv.bind('<ButtonRelease-1>', key_released)

def send_gcode(gcode_line):
    global ser
    if ser is not None and ser.is_open:
        ser.write(str.encode(gcode_line + '\n'))
        response = ser.readline().decode().strip()
        print(f"Sent: {gcode_line}, Received: {response}")
    else:
        print("Serial communication error: Port not open")


    
def Gbrush_refill(event):
    # Get current mouse position
    x, y = event.x, event.y
    
    # Move the print head to Z10, stop, then go to (10, 10)
    gcode_line = "G1 Z10 F1000\n"
    send_gcode(gcode_line)

    send_gcode("G1 X10 Y10 F1000\n")
    time.sleep(0.001)
    # Move the print head to Z5, wait for 1 second, then move to Z10
    send_gcode("G1 Z3 F1000\n")

    send_gcode("G1 Z10 F1000\n")
  

    # Convert coordinates to bed size
    canvas_width = cv.winfo_width()
    canvas_height = cv.winfo_height()
    from config3 import bed_max_x,bed_max_y
    bed_width= bed_max_x
    bed_height =  bed_max_y
    bed_x = x * (bed_width / canvas_width)
    bed_y = (canvas_height - y) * (bed_height / canvas_height)

    # Move the print head back to the original position and send G-code command
    gcode_line = f"G1 X{bed_x:.2f} Y{bed_y:.2f} Z5 F{3000}\n"
    send_gcode(gcode_line)



def convert_and_print():
    # Load the image
    canvas_width = cv.winfo_width()
    canvas_height = cv.winfo_height()
    from config3 import bed_max_x,bed_max_y
    bed_size_x = bed_max_x 
    bed_size_y = bed_max_y
    feedrate=8000
    print_height=5
    line_start = None  # Coordinates of the start of the current line
    line_end = None  # Coordinates of the end of the current line

    # Load the image
    img = Image.open('temp2.png').convert('L')

    # Get the image dimensions in pixels
    img_width, img_height = img.size
    print('Image dimensions:', img_width, 'x', img_height)
    # Calculate the scaling factor
    # Calculate the scaling factors
    scaling_factor_x = bed_size_x / img_width
    scaling_factor_y = bed_size_y / img_height

    # Use the larger scaling factor to fill the bed in either X or Y direction
    scaling_factor = max(scaling_factor_x, scaling_factor_y)
    # Calculate the scaled dimensions
    scaled_width = int(img_width * scaling_factor)
    scaled_height = int(img_height * scaling_factor)
    print('Image dimensions:', scaled_width, 'x', scaled_height)

    # Scale the image
    img = img.resize((scaled_width, scaled_height), Image.ANTIALIAS)

    # Convert the image to G-code
    gcode_str = ''  # Initialize G-code string
    gcode_str += 'G21 ; Set units to millimeters\n'  # Set units to millimeters
    gcode_str += 'G90 ; Set absolute positioning\n'  # Set absolute positioning
    gcode_str += 'G28 ; Home all axes\n'  # Home all axes
    gcode_str += 'G1 Z10 F{} ; Move up 5mm\n'.format(feedrate)  # Move up 5mm
    gcode_str += 'G1 X0 Y0 F{} ; Move to bottom left corner\n'.format(feedrate)  # Move to bottom left corner
    gcode_str += 'G1 Z5 F{} ; Move down to print\n'.format(feedrate)  # Move down to print

    # Initialize starting position and line state
    x_pos = 0
    y_pos = 0
    line_state = False

    is_printing = False  # A flag to keep track of whether the print head is currently down
    last_pos = None  # The last position where the print head was down
    for y in range(img.size[1]):
        x_pos = bed_size_x   # Scale the X-coordinate
        y_pos = bed_size_y - y   # Invert and scale the Y-coordinate
        gcode_str += 'G1 Y{:.3f} F{} ; Move to next row\n'.format(y_pos, feedrate)
        for x in range(img.size[0]):
            pixel_value = img.getpixel((x, y))
            if pixel_value > 50:  # Check if the pixel value is greater than 128 (white)
                if is_printing:
                    # If the print head is currently down, lift it up
                    gcode_str += 'G1 Z{} F{} ; Move up\n'.format(print_height, feedrate)
                    gcode_str += 'G1 Z7 F{} ; Lift print head\n'.format(feedrate)
                    is_printing = False
            else:  # Pixel is black
                if not is_printing:
                    # If the print head is currently up, move to the start position of the new line
                    x_pos = x  # Scale the X-coordinate
                    gcode_str += 'G1 X{:.3f} F{} ; Move to print\n'.format(x_pos, feedrate)
                    gcode_str += 'G1 Z5 F{} ; Move down to print\n'.format(feedrate)
                    last_pos = (x_pos, y_pos)
                    is_printing = True
                else:
                    # If the print head is already down, continue the line
                    x_pos = x  # Scale the X-coordinate
                    if (x_pos - last_pos[0]) ** 2 + (y_pos - last_pos[1]) ** 2 >= 0.5 ** 2:
                        # If the next pixel is more than 0.5mm away from the current position, lift the print head and move to the new position
                        gcode_str += 'G1 Z{} F{} ; Move up\n'.format(print_height, feedrate)
                        gcode_str += 'G1 X{:.3f} Y{:.3f} F{} ; Move to new line\n'.format(x_pos, y_pos, feedrate)
                        gcode_str += 'G1 Z5 F{} ; Move down to print\n'.format(feedrate)
                        last_pos = (x_pos, y_pos)
                    else:
                        # If the next pixel is less than 0.5mm away from the current position, just continue the line
                        gcode_str += 'G1 X{:.3f} F{} ; Continue line\n'.format(x_pos, feedrate)
                        last_pos = (x_pos, y_pos)
    # If the last pixel of the image is not white, lift the print head
    if is_printing:
        gcode_str += 'G1 Z{} F{} ; Move up\n'.format(print_height, feedrate)
        gcode_str += 'G1 Z7 F{} ; Lift print head\n'.format(feedrate)

    # Finish the G-code
    gcode_str += 'G1 Z7 F{} ; Move up 5mm\n'.format(feedrate)
    gcode_str += 'G1 X0 Y0 F{} ; Move to bottom left corner\n'.format(feedrate)
    gcode_str += 'M84 ; Turn off motors\n'

    # Save the G-code to    
    # Save the G-code to a file
    gcode_file= filedialog.asksaveasfilename(defaultextension='.gcode', filetypes=[('G-code files', '*.gcode')])
    with open(gcode_file, 'w') as f:
        f.write(gcode_str)
    
    print('G-code saved to:', gcode_file)
    plot_gcode('gcode_output7.gcode')



def plot_gcode(gcode_file):
    x_coords = []
    y_coords = []
    with open(gcode_file, 'r') as f:
        for line in f:
            if line.startswith('G1 '):
                if 'X' in line and 'Y' in line:
                    x_coords.append(float(line.split('X')[1].split()[0]))
                    y_coords.append(float(line.split('Y')[1].split()[0]))
    print(x_coords)
    print(y_coords)
    fig, ax = plt.subplots(figsize=(9, 9))
    ax.plot(x_coords, y_coords)
    plt.show()


def smooth_print():
    # Load the image
    canvas_width = cv.winfo_width()
    canvas_height = cv.winfo_height()
    
    from config3 import bed_max_x,bed_max_y
    bed_size_x = bed_max_x 
    bed_size_y = bed_max_y
    feedrate=8000
    print_height=5
    line_start = None  # Coordinates of the start of the current line
    line_end = None  # Coordinates of the end of the current line

    # Load the image
    img = Image.open('temp2.png').convert('L')

    # Get the image dimensions in pixels
    img_width, img_height = img.size
    print('Image dimensions:', img_width, 'x', img_height)
    # Calculate the scaling factor
    # Calculate the scaling factors
    scaling_factor_x = bed_size_x / img_width
    scaling_factor_y = bed_size_y / img_height

    # Use the larger scaling factor to fill the bed in either X or Y direction
    scaling_factor = max(scaling_factor_x, scaling_factor_y)
    # Calculate the scaled dimensions
    scaled_width = int(img_width * scaling_factor)
    scaled_height = int(img_height * scaling_factor)
    print('Image dimensions:', scaled_width, 'x', scaled_height)

    # Scale the image
    img = img.resize((scaled_width, scaled_height), Image.ANTIALIAS)

    # Convert the image to G-code
    gcode_str = ''  # Initialize G-code string
    gcode_str += 'G21 ; Set units to millimeters\n'  # Set units to millimeters
    gcode_str += 'G90 ; Set absolute positioning\n'  # Set absolute positioning
    gcode_str += 'G28 ; Home all axes\n'  # Home all axes
    gcode_str += 'G1 Z10 F{} ; Move up 5mm\n'.format(feedrate)  # Move up 5mm
    gcode_str += 'G1 X0 Y0 F{} ; Move to bottom left corner\n'.format(feedrate)  # Move to bottom left corner
    gcode_str += 'G1 Z5 F{} ; Move down to print\n'.format(feedrate)  # Move down to print



    is_printing = False  # A flag to keep track of whether the print head is currently down
    last_pos = None  # The last position where the print head was down
    zigzag_direction = 1  # The direction of the zigzag motion (1 for right, -1 for left)
    for y in range(img.size[1]):
        x_pos = bed_size_x   # Scale the X-coordinate
        y_pos = bed_size_y - y   # Invert and scale the Y-coordinate
        gcode_str += 'G1 Y{:.3f} F{} ; Move to next row\n'.format(y_pos, feedrate)
        for x in range(img.size[0]):
            pixel_value = img.getpixel((x, y))
            if pixel_value > 128:  # Check if the pixel value is greater than 128 (white)
                if is_printing:
                    # If the print head is currently down, lift it up
                    gcode_str += 'G1 Z{} F{} ; Move up\n'.format(print_height, feedrate)
                    gcode_str += 'G1 Z8 F{} ; Lift print head\n'.format(feedrate)
                    is_printing = False
            else:  # Pixel is black
                if not is_printing:
                    # If the print head is currently up, move to the start position of the new line
                    x_pos = x  # Scale the X-coordinate
                    gcode_str += 'G1 X{:.3f} F{} ; Move to print\n'.format(x_pos, feedrate)
                    gcode_str += 'G1 Z5 F{} ; Move down to print\n'.format(feedrate)
                    last_pos = (x_pos, y_pos)
                    is_printing = True
                else:
                    # If the print head is already down, continue the line
                    x_pos = x + zigzag_direction * 3  # Scale the X-coordinate and add zigzag motion
                    y_pos = y_pos + 3  # Add zigzag motion in the Y-axis
                    if (x_pos - last_pos[0]) ** 2 + (y_pos - last_pos[1]) ** 2 >= 0.5 ** 2:
                        # If the next pixel is more than 0.5mm away from the current position, lift the print head and move to the new position
                        gcode_str += 'G1 Z{} F{} ; Move up\n'.format(print_height, feedrate)
                        gcode_str += 'G1 X{:.3f} Y{:.3f} F{} ; Move to new line\n'.format(x_pos, y_pos, feedrate)
                        gcode_str += 'G1 Z5 F{} ; Move down to print\n'.format(feedrate)
                        last_pos = (x_pos, y_pos)
                        zigzag_direction = -zigzag_direction  # Reverse the direction of the zigzag motion
                    else:
                        # If the next pixel is less than 0.5mm away from the current position, just continue the line
                        gcode_str += 'G1 X{:.3f} Y{:.3f} F{} ; Continue line\n'.format(x_pos, y_pos, feedrate)
                        last_pos = (x_pos, y_pos)
                # If the last pixel of the image is not white, lift the print head
                if is_printing:
                    gcode_str += 'G1 Z{} F{} ; Move up\n'.format(print_height, feedrate)
                    gcode_str += 'G1 Z8 F{} ; Lift print head\n'.format(feedrate)

        # Finish the G-code
        gcode_str += 'G1 Z10 F{} ; Move up 5mm\n'.format(feedrate)
        gcode_str += 'G1 X0 Y0 F{} ; Move to bottom left corner\n'.format(feedrate)
        gcode_str += 'M84 ; Turn off motors\n'
    
    # Save the G-code to    
    # Save the G-code to a file
    gcode_file= 'gcode_output3'  + '.gcode'
    with open(gcode_file, 'w') as f:
        f.write(gcode_str)
    
    print('G-code saved to:', gcode_file)
    plot_gcode('gcode_output3.gcode')
    
def zigzag_print():
    # Load the image
    canvas_width = cv.winfo_width()
    canvas_height = cv.winfo_height()
    from config3 import bed_max_x,bed_max_y
    bed_size_x = bed_max_x 
    bed_size_y = bed_max_y
    feedrate=8000
    print_height=5
    line_start = None  # Coordinates of the start of the current line
    line_end = None  # Coordinates of the end of the current line

    # Load the image
    img = Image.open('temp2.png').convert('L')

    # Get the image dimensions in pixels
    img_width, img_height = img.size
    print('Image dimensions:', img_width, 'x', img_height)
    # Calculate the scaling factor
    # Calculate the scaling factors
    scaling_factor_x = bed_size_x / img_width
    scaling_factor_y = bed_size_y / img_height

    # Use the larger scaling factor to fill the bed in either X or Y direction
    scaling_factor = max(scaling_factor_x, scaling_factor_y)
    # Calculate the scaled dimensions
    scaled_width = int(img_width * scaling_factor)
    scaled_height = int(img_height * scaling_factor)
    print('Image dimensions:', scaled_width, 'x', scaled_height)

    # Scale the image
    img = img.resize((scaled_width, scaled_height), Image.ANTIALIAS)

    # Convert the image to G-code
    gcode_str = ''  # Initialize G-code string
    gcode_str += 'G21 ; Set units to millimeters\n'  # Set units to millimeters
    gcode_str += 'G90 ; Set absolute positioning\n'  # Set absolute positioning
    gcode_str += 'G28 ; Home all axes\n'  # Home all axes
    gcode_str += 'G1 Z6 F{} ; Move up 5mm\n'.format(feedrate)  # Move up 5mm
    gcode_str += 'G1 X0 Y0 F{} ; Move to bottom left corner\n'.format(feedrate)  # Move to bottom left corner
    gcode_str += 'G1 Z5 F{} ; Move down to print\n'.format(feedrate)  # Move down to print



    is_printing = False  # A flag to keep track of whether the print head is currently down
    last_pos = None  # The last position where the print head was down
    zigzag_direction = 1  # The direction of the zigzag motion (1 for up, -1 for down)
    for y in range(img.size[1]):
        x_pos = bed_size_x   # Scale the X-coordinate
        y_pos = bed_size_y - y   # Invert and scale the Y-coordinate
        gcode_str += 'G1 Y{:.3f} F{} ; Move to next row\n'.format(y_pos, feedrate)
        for x in range(img.size[0]):
            pixel_value = img.getpixel((x, y))
            if pixel_value > 128:  # Check if the pixel value is greater than 128 (white)
                if is_printing:
                    # If the print head is currently down, lift it up
                    gcode_str += 'G1 Z{} F{} ; Move up\n'.format(print_height, feedrate)
                    gcode_str += 'G1 Z6 F{} ; Lift print head\n'.format(feedrate)
                    is_printing = False
            else:  # Pixel is black
                if not is_printing:
                    # If the print head is currently up, move to the start position of the new line
                    x_pos = x  # Scale the X-coordinate
                    gcode_str += 'G1 X{:.3f} F{} ; Move to print\n'.format(x_pos, feedrate)
                    gcode_str += 'G1 Z5 F{} ; Move down to print\n'.format(feedrate)
                    last_pos = (x_pos, y_pos)
                    is_printing = True
                else:
                    # If the print head is already down, continue the line
                    y_pos = y_pos + zigzag_direction * 3  # Scale the Y-coordinate and add zigzag motion
                    x_pos = x  # Scale the X-coordinate
                    if (x_pos - last_pos[0]) ** 2 + (y_pos - last_pos[1]) ** 2 >= 0.5 ** 2:
                        # If the next pixel is more than 0.5mm away from the current position, lift the print head and move to the new position
                        gcode_str += 'G1 Z{} F{} ; Move up\n'.format(print_height, feedrate)
                        gcode_str += 'G1 X{:.3f} Y{:.3f} F{} ; Move to new line\n'.format(x_pos, y_pos, feedrate)
                        gcode_str += 'G1 Z5 F{} ; Move down to print\n'.format(feedrate)
                        last_pos = (x_pos, y_pos)
                        zigzag_direction = -zigzag_direction  # Reverse the direction of the zigzag motion
                    else:
                        # If the next pixel is less than 0.5mm away from the current position, just continue the line
                        gcode_str += 'G1 X{:.3f} Y{:.3f} F{} ; Continue line\n'.format(x_pos, y_pos, feedrate)
                        last_pos = (x_pos, y_pos)

                        
                        
                        
                        
            # If the last pixel of the image is not white, lift the print head
            if is_printing:
                gcode_str += 'G1 Z{} F{} ; Move up\n'.format(print_height, feedrate)
                gcode_str += 'G1 Z6 F{} ; Lift print head\n'.format(feedrate)
    
    # Finish the G-code
    gcode_str += 'G1 Z10 F{} ; Move up 5mm\n'.format(feedrate)
    gcode_str += 'G1 X0 Y0 F{} ; Move to bottom left corner\n'.format(feedrate)
    gcode_str += 'M84 ; Turn off motors\n'
    
    # Save the G-code to    
    # Save the G-code to a file
    gcode_file= 'gcode_output6'  + '.gcode'
    with open(gcode_file, 'w') as f:
        f.write(gcode_str)
    
    print('G-code saved to:', gcode_file)
    plot_gcode('gcode_output6.gcode')        


def select_svg_file():
    # Create a pop-up window to select the SVG file

    root = tk.Tk()
    root.withdraw()
    importlib.reload(config3)
    svg_path = filedialog.askopenfilename(filetypes=[('SVG files', '*.svg')])
    root.destroy()

    # Pass the SVG file path to the load_svg() function
    load_svg(svg_path, cv, z_start, z_center, z_end, gradient_length_mm)


from config3 import *

def load_svg(svg_path, cv, z_start, z_center, z_end, gradient_length_percentage):
    # Set the path to the output GCode file
    gcode_path = os.path.splitext(svg_path)[0] + '.gcode'
    
    # Generate G-code from SVG
    gcodegenerator.generate_gcode(svg_path, gcode_path)  # Remove extra parameters
    
    # Plot the generated G-code
    plot_gcode(gcode_path)

def print_gcode_paths():
    print("generating G-code...")
    import time
    # Set the path and file name for the output G-code file
    gcode_path = 'temp.gcode'
    if not gcode_path:
        return

    # Prompt the user to select a G-code file
    gcode_file_path = filedialog.askopenfilename(filetypes=[('G-code files', '*.gcode')])
    if not gcode_file_path:
        return

    # Load the G-code file
    with open(gcode_file_path, 'r') as f:
        gcode_lines = f.readlines()

    # Send G-code line-by-line
    for line in gcode_lines:
        send_gcode(line)



def open_gcode_file():
    # Open a file dialog to select the gcode file
    file_path = filedialog.askopenfilename(filetypes=[('G-code files', '*.gcode')])
    if not file_path:
        return

    # Load the gcode file and extract the paths
    paths = []
    with open(file_path, 'r') as f:
        for line in f:
            if line.startswith('G1'):
                coords = line.split()[1:]
                if coords[0][1:] and coords[1][1:]:
                    x, y = float(coords[0][1:]), float(coords[1][1:])
                    paths.append((x, y))

    # Find the maximum x and y coordinates to determine the size of the image
    max_x, max_y = max(paths, key=lambda p: p[0])[0], max(paths, key=lambda p: p[1])[1]

    # Set the scale factor to adjust the size of the image
    scale_factor = 5

    # Create a new PIL Image and draw the paths
    img = Image.new('RGB', (int(max_x * scale_factor) + 1, int(max_y * scale_factor) + 1), (255, 255, 255))
    draw = ImageDraw.Draw(img)
    scaled_paths = [(x * scale_factor, y * scale_factor) for x, y in paths]
    draw.line(scaled_paths, fill='black', width=1)

    # Display the image
    img.show()


#### PAINT TOOL ACTIVE############
def key_released(e):
    global linecount
    linecount = linecount + 1
    print('linecount' + str(linecount))

def Paint_Realtimet(e):
    global linecount
    global lastx, lasty
    global hexstr
    global bsize
    bsize = brush.get(1.0, "end-1c")
    x, y = cv.canvasx(e.x), cv.canvasy(e.y)
    cv.create_line((lastx, lasty, x, y),fill=hexstr,width=int(bsize),capstyle=ROUND, smooth=TRUE, splinesteps=120, tags=('all_lines' , "'"+str(linecount)+"'"))
    draw.line((lastx, lasty, x, y), fill='green', width=4)
    print('create line'+"'"+str(linecount)+"'")
    lastx, lasty = x, y

def activate_paint(e):
    global linecount
    global lastx, lasty
    
    
    img2=ImageTk.PhotoImage(Image.open("temp2.png"))
    cv.bind('<B3-Motion>', Paint_Realtimet)
    lastx, lasty = cv.canvasx(e.x), cv.canvasy(e.y)
      #cv.canvasx(e.x), cv.canvasy(e.y)



def place_text(e):
    global lastx, lasty, text_elements
    
    textbox = text_edit.get("1.0", END).strip()
    if not textbox:
        return
        
    try:
        text_size = int(txtsize.get("1.0", "end-1c"))
    except ValueError:
        text_size = 50

    # Get coordinates in canvas space
    x = cv.canvasx(e.x)
    y = cv.canvasy(e.y)
    
    # Get selected font
    selected_font = font_var.get()
    
    # Convert rgb tuple to hex color format
    color = f'#{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}'
    
    # Store base coordinates
    base_x = x / cv.scale_factor
    base_y = y / cv.scale_factor
    
    # Create text on canvas
    text_id = cv.create_text(
        x, y,
        text=textbox,
        font=(selected_font, text_size),
        tags="text",
        anchor='nw',
        fill=color
    )
    
    # Store text element data
    text_elements.append({
        'id': text_id,
        'text': textbox,
        'x': x,
        'y': y,
        'base_x': base_x,
        'base_y': base_y,
        'size': text_size,  # Original input size
        'color': color,
        'font': selected_font
    })
    
    # Clear text input
    text_edit.delete("1.0", END)

def Fillcolor():
    global rgb
    
    (rgb,hexstrfill) = askcolor() 
    if rgb:
        print(('rgb=')+str(rgb))
    #cv.itemconfigure(draw, fill=hexstr)
    Fillbutton.config( text = 'FILL Color')
    Fillbutton["background"] = hexstrfill

    

def Configwindow():
   
    Config()
    
def Imagevectorbutton():
    
    Imagevector()
    
def Spiralbutton():
     Spirals()

# Delete functionality
def delete_selected():
    global selected_line_id, selected_text_index, selected_items
    
    # Handle individual line/text selections
    if selected_line_id is not None:
        cv.delete(selected_line_id)
        selected_line_id = None
    if selected_text_index is not None:
        cv.delete(text_elements[selected_text_index]['id'])
        text_elements.pop(selected_text_index)
        selected_text_index = None
        
    # Handle scale tool selections
    if selected_items:
        for shape_id in list(selected_items):
            # Delete all items with this shape ID
            for item in cv.find_withtag(shape_id):
                cv.delete(item)
        selected_items.clear()
    
    # Generate event to update layers window
    cv.event_generate('<<ShapeRemoved>>')

def delete_text(event):
    delete_selected()

def select_line(event):
    global selected_line_id, move_start_x, move_start_y
    x = cv.canvasx(event.x)
    y = cv.canvasy(event.y)
    
    # Clear previous selection
    if selected_line_id is not None:
        if cv.type(selected_line_id) in ['oval', 'rectangle', 'polygon', 'arc']:
            cv.itemconfig(selected_line_id, outline=hexstr)
        else:
            cv.itemconfig(selected_line_id, fill=hexstr)
        selected_line_id = None
        move_start_x = None
        move_start_y = None
    
    # Find items at click position
    items = cv.find_overlapping(x-5, y-5, x+5, y+5)
    
    # Filter for items with 'all_lines' tag
    for item in items:
        if 'all_lines' in cv.gettags(item):
            selected_line_id = item
            move_start_x = x
            move_start_y = y
            
            # Highlight based on item type
            if cv.type(item) in ['oval', 'rectangle', 'polygon', 'arc']:
                cv.itemconfig(item, outline='red')
            else:
                cv.itemconfig(item, fill='red')
            break

def do_move(event):
    global move_start_x, move_start_y
    if selected_line_id is not None and move_start_x is not None and move_start_y is not None:
        # Get current mouse position
        x = cv.canvasx(event.x)
        y = cv.canvasy(event.y)
        
        # Calculate movement delta
        dx = x - move_start_x
        dy = y - move_start_y
        
        # Move only the selected shape
        tags = cv.gettags(selected_line_id)
        shape_tag = None
        for tag in tags:
            if tag.startswith('shape_'):
                shape_tag = tag
                break
        
        if shape_tag:
            # Move all items with the same shape tag
            for item in cv.find_withtag(shape_tag):
                coords = list(cv.coords(item))
                for i in range(0, len(coords), 2):
                    coords[i] += dx
                    coords[i+1] += dy
                cv.coords(item, *coords)
        else:
            # Move just the selected item
            coords = list(cv.coords(selected_line_id))
            for i in range(0, len(coords), 2):
                coords[i] += dx
                coords[i+1] += dy
            cv.coords(selected_line_id, *coords)
        
        # Update start position for next movement
        move_start_x = x
        move_start_y = y
        save_canvas_state()  # Save state after moving objects

def start_move(event):
    global move_start_x, move_start_y
    if selected_line_id is not None:
        move_start_x = event.x
        move_start_y = event.y

def toggle_tool(tool_name):
    global active_tool, current_shape_id, linecount, lastx, lasty, current_line_points
    
    # Clear any existing selection when switching tools
    clear_selection()
    
    # Clean up any temporary markers first
    cv.delete('temp_marker')
    cv.delete('snap_point')
    cv.delete('snap_line')
    cv.delete('radius_marker')
    cv.delete('center_marker')
    cv.delete('temp')
    cv.delete('guide_point')
    cv.delete('guide_line')
    
    # Reset drawing state
    lastx = None
    lasty = None
    current_line_points = []
    
    # Unbind all events first
    cv.unbind('<Button-1>')
    cv.unbind('<B1-Motion>')
    cv.unbind('<ButtonRelease-1>')
    cv.unbind('<Button-3>')
    cv.unbind('<B3-Motion>')
    cv.unbind('<ButtonRelease-3>')
    
    # Reset all tool buttons to default color
    for btn_text, btn in tool_buttons.items():
        btn.configure(bg="#263d42")
    
    if tool_name == active_tool:
        active_tool = None
        return
    
    active_tool = tool_name
    tool_buttons[tool_name].configure(bg="#00FF00")  # Set active tool button to green
    current_shape_id = f"shape_{linecount}"
    
    if tool_name == "Line":
        cv.bind('<Button-1>', start_line)
        cv.bind('<B1-Motion>', update_line)
        cv.bind('<ButtonRelease-1>', end_line)
    elif tool_name == "Circle":
        cv.bind('<Button-1>', start_circle)
        cv.bind('<B1-Motion>', update_circle)
        cv.bind('<ButtonRelease-1>', finish_circle)
    elif tool_name == "Rectangle":
        cv.bind('<Button-1>', start_rectangle)
        cv.bind('<B1-Motion>', update_rectangle)
        cv.bind('<ButtonRelease-1>', finish_rectangle)
    elif tool_name == "Polygon":
        cv.bind('<Button-1>', start_polygon)
        cv.bind('<B1-Motion>', update_polygon)
        cv.bind('<ButtonRelease-1>', finish_polygon)
    elif tool_name == "Freehand":
        cv.bind('<Button-1>', start_freehand)
        cv.bind('<B1-Motion>', update_freehand)
        cv.bind('<ButtonRelease-1>', finish_freehand)
    elif tool_name == "Arc":
        cv.bind('<Button-1>', start_arc)
        cv.bind('<B1-Motion>', update_arc)
        cv.bind('<ButtonRelease-1>', finish_arc)
    elif tool_name == "Text":
        cv.bind('<Button-1>', activate_text)
    elif tool_name == "Live Carving":
        cv.bind('<Button-1>', activate_Paint_Gcode)
        cv.bind('<B1-Motion>', lambda event: Paint_Gcode(event, gcode))
        cv.bind('<ButtonRelease-1>', key_released)
    
    # Add right-click selection and movement for all tools
    cv.bind('<Button-3>', select_line)
    cv.bind('<B3-Motion>', do_move)
    cv.bind('<ButtonRelease-3>', start_move)

def handle_freehand_start(event):
    global lastx, lasty, current_shape_id
    from freehand_tool import start_freehand
    lastx, lasty, current_shape_id = start_freehand(event, cv, lastx, lasty, linecount, hexstr, ser, laser_active_var, z_axis_active_var)

def handle_freehand_update(event):
    global lastx, lasty
    from freehand_tool import update_freehand
    if lastx is not None and lasty is not None:
        lastx, lasty = update_freehand(event, cv, lastx, lasty, current_shape_id, hexstr, brush, ser)

def handle_freehand_finish(event):
    global lastx, lasty, linecount
    from freehand_tool import finish_freehand
    if lastx is not None and lasty is not None:
        linecount, lastx, lasty = finish_freehand(event, cv, lastx, lasty, current_shape_id, hexstr, brush, linecount, ser, laser_active_var, z_axis_active_var)

def start_circle(event):
    global lastx, lasty, current_circle, current_shape_id, linecount
    lastx = cv.canvasx(event.x)
    lasty = cv.canvasy(event.y)
    
    # Get snap point if enabled
    if snap_var.get():
        lastx, lasty = get_snap_point(lastx, lasty, True)
    
    # Create center marker
    cv.create_oval(lastx-4, lasty-4, lastx+4, lasty+4,
                  fill='#00FF00', outline='white',
                  tags=('center_marker', 'above_all'))
    
    # Create initial circle with proper shape ID
    current_shape_id = f"shape_{linecount}"
    current_circle = cv.create_oval(lastx, lasty, lastx, lasty,
                                  outline=hexstr,
                                  width=int(brush.get("1.0", "end-1c")),
                                  tags=('all_lines', current_shape_id))
    cv.tag_raise('above_all')

def update_circle(event):
    global current_circle
    if current_circle:
        x = cv.canvasx(event.x)
        y = cv.canvasy(event.y)
        
        # Get snap point if enabled
        if snap_var.get():
            x, y = get_snap_point(x, y)
        
        # Calculate radius
        radius = ((x - lastx) ** 2 + (y - lasty) ** 2) ** 0.5
        
        # Update circle
        cv.coords(current_circle,
                 lastx - radius, lasty - radius,
                 lastx + radius, lasty + radius)
        
        # Update radius marker
        cv.delete('radius_marker')
        cv.create_oval(x-4, y-4, x+4, y+4,
                      fill='#FF0000', outline='white',
                      tags=('radius_marker', 'above_all'))
        cv.tag_raise('above_all')

def finish_circle(event):
    global current_circle, linecount
    if current_circle:
        # Get final mouse position for radius
        x = cv.canvasx(event.x)
        y = cv.canvasy(event.y)
        
        # Get snap point for final radius
        if snap_var.get():
            x, y = get_snap_point(x, y, True)
        
        # Calculate final radius and update circle one last time
        radius = ((x - lastx) ** 2 + (y - lasty) ** 2) ** 0.5
        cv.coords(current_circle,
                 lastx - radius, lasty - radius,
                 lastx + radius, lasty + radius)
        
        # Clean up any temporary markers
        cv.delete('radius_marker')
        cv.delete('center_marker')
        
        linecount += 1
        current_circle = None
        save_canvas_state()  # Save state after circle is completed

def start_rectangle(event):
    global lastx, lasty, current_rectangle, rectangle_start_marker, current_shape_id, linecount
    x = cv.canvasx(event.x)
    y = cv.canvasy(event.y)
    
    # Get snap point for first corner
    x, y = get_snap_point(x, y, True)
    lastx, lasty = x, y
    
    # Initialize rectangle with 0 size
    current_shape_id = f"shape_{linecount}"
    current_rectangle = cv.create_rectangle(
        x, y, x, y,
        outline=hexstr,
        width=int(brush.get("1.0", "end-1c")),
        tags=('all_lines', current_shape_id)
    )

def update_rectangle(event):
    global current_rectangle, lastx, lasty
    if current_rectangle:
        x = cv.canvasx(event.x)
        y = cv.canvasy(event.y)
        
        # Get snap point for second corner
        x, y = get_snap_point(x, y, False)
        
        # Update rectangle coordinates
        cv.coords(current_rectangle, lastx, lasty, x, y)

def start_polygon(event):
    global lastx, lasty, current_polygon, current_shape_id, linecount
    x = cv.canvasx(event.x)
    y = cv.canvasy(event.y)
    
    # Get snap point for center
    x, y = get_snap_point(x, y, True)
    lastx, lasty = x, y
    
    # Initialize polygon with center point
    current_shape_id = f"shape_{linecount}"
    current_polygon = cv.create_polygon(
        [x, y, x, y],  # Initial two points to avoid errors
        outline=hexstr,
        fill='',
        width=int(brush.get("1.0", "end-1c")),
        tags=('all_lines', current_shape_id)
    )
    
    # Bind mouse wheel for vertex count
    cv.bind('<MouseWheel>', update_polygon_vertices)

def update_polygon_vertices(event):
    global current_polygon, lastx, lasty
    if current_polygon:
        # Get current mouse position for radius
        x = cv.canvasx(event.x)
        y = cv.canvasy(event.y)
        
        # Get snap point for radius
        x, y = get_snap_point(x, y, False)
        
        # Calculate radius and number of vertices
        radius = ((x - lastx) ** 2 + (y - lasty) ** 2) ** 0.5
        
        # Update number of vertices based on wheel direction (minimum 3, maximum 12)
        delta = 1 if event.delta < 0 else -1  # Reversed to feel more natural
        current_vertices = len(cv.coords(current_polygon)) // 2
        new_vertices = max(3, min(12, current_vertices + delta))
        
        # Calculate polygon points
        points = []
        for i in range(new_vertices):
            angle = 2 * math.pi * i / new_vertices - math.pi/2  # Start from top
            px = lastx + radius * math.cos(angle)
            py = lasty + radius * math.sin(angle)
            points.extend([px, py])
        
        # Update polygon
        cv.coords(current_polygon, *points)

def update_polygon(event):
    global current_polygon, lastx, lasty
    if current_polygon:
        # Get current mouse position for radius
        x = cv.canvasx(event.x)
        y = cv.canvasy(event.y)
        
        # Get snap point for radius
        x, y = get_snap_point(x, y, False)
        
        # Calculate radius and points
        radius = ((x - lastx) ** 2 + (y - lasty) ** 2) ** 0.5
        points = []
        sides = 6  # Hexagon
        for i in range(sides):
            angle = 2 * math.pi * i / sides - math.pi/2  # Start from top
            px = lastx + radius * math.cos(angle)
            py = lasty + radius * math.sin(angle)
            points.extend([px, py])
        
        # Update polygon
        cv.coords(current_polygon, *points)

def start_line(event):
    global lastx, lasty, current_line, current_shape_id, linecount
    x = cv.canvasx(event.x)
    y = cv.canvasy(event.y)
    
    # Always check for endpoint snapping first, then grid if enabled
    if snap_to_endpoints_var.get():
        endpoint = snap_to_endpoints(cv, x, y, tolerance=20.0)  # Use same tolerance as indicator
        if endpoint:
            x, y = endpoint
    elif snap_var.get() and grid_var.get():
        x, y = get_snap_point(x, y, is_final=True)
    
    lastx, lasty = x, y
    current_shape_id = f"shape_{linecount}"
    
    # Create start point marker
    cv.create_oval(lastx-4, lasty-4, lastx+4, lasty+4,
                  fill='#00FF00', outline='white',
                  tags=('start_marker', 'above_all'))
    cv.tag_raise('above_all')

def update_line(event):
    global current_line
    if lastx is not None and lasty is not None:
        x = cv.canvasx(event.x)
        y = cv.canvasy(event.y)
        
        # Always check for endpoint snapping first, then grid if enabled
        snap_x, snap_y = x, y
        
        # Check endpoint snapping only if enabled and grid snap is disabled
        if snap_to_endpoints_var.get():
            endpoint = snap_to_endpoints(cv, x, y, tolerance=20.0)
            if endpoint:
                snap_x, snap_y = endpoint
                # Show red indicator for snap point
                cv.delete('snap_indicator')
                cv.create_oval(snap_x-4, snap_y-4, snap_x+4, snap_y+4,
                             fill='red', outline='white',
                             tags=('snap_indicator', 'above_all'))
                cv.create_text(snap_x, snap_y-15, text="Endpoint", 
                             fill='#0088FF', font=('Arial', 8),
                             tags=('snap_indicator', 'above_all'))
        
        # Check grid snapping if enabled
        if snap_var.get() and grid_var.get():
            snap_x, snap_y = get_snap_point(x, y, is_final=False)
            # Show red indicator for grid snap point
            cv.delete('snap_indicator')
            cv.create_oval(snap_x-4, snap_y-4, snap_x+4, snap_y+4,
                         fill='red', outline='white',
                         tags=('snap_indicator', 'above_all'))
        
        # Delete previous preview line
        cv.delete('preview_line')
        
        # Create new preview line using snapped coordinates
        current_line = cv.create_line(lastx, lasty, snap_x, snap_y,
                                    fill=hexstr,
                                    width=int(brush.get("1.0", "end-1c")),
                                    tags='preview_line')
        cv.tag_raise('above_all')

def end_line(event):
    global lastx, lasty, current_line, linecount
    if lastx is not None and lasty is not None:
        x = cv.canvasx(event.x)
        y = cv.canvasy(event.y)
        
        # Always check for endpoint snapping first, then grid if enabled
        snap_x, snap_y = x, y
        
        # Check endpoint snapping only if enabled and grid snap is disabled
        if snap_to_endpoints_var.get():
            endpoint = snap_to_endpoints(cv, x, y, tolerance=20.0)
            if endpoint:
                snap_x, snap_y = endpoint
        
        # Check grid snapping if enabled
        if snap_var.get() and grid_var.get():
            snap_x, snap_y = get_snap_point(x, y, is_final=True)
        
        # Create the final line using snapped coordinates
        cv.create_line(lastx, lasty, snap_x, snap_y,
                      fill=hexstr,
                      width=int(brush.get("1.0", "end-1c")),
                      tags=('all_lines', current_shape_id),
                      capstyle=ROUND)
        
        # Clean up
        cv.delete('preview_line')
        cv.delete('start_marker')
        cv.delete('snap_indicator')  # Clean up snap indicators
        
        # Reset state
        lastx = None
        lasty = None
        current_line = None
        linecount += 1
        
        # Save state
        save_canvas_state()

def start_freehand(event):
    global lastx, lasty, current_shape_id, linecount, current_line_points
    x = cv.canvasx(event.x)
    y = cv.canvasy(event.y)
    
    # Snap to grid if enabled
    if snap_var.get():
        x, y = get_snap_point(x, y, is_final=True)
    
    lastx = x
    lasty = y
    current_shape_id = f"shape_{linecount}"
    current_line_points = [(x, y)]  # Store points for creating a single continuous path

def update_freehand(event):
    global lastx, lasty, current_line_points
    if lastx is not None and lasty is not None:
        x = cv.canvasx(event.x)
        y = cv.canvasy(event.y)
        
        # Snap to grid if enabled
        if snap_var.get():
            x, y = get_snap_point(x, y)
        
        # Add point to the list instead of creating individual segments
        current_line_points.append((x, y))
        
        # Update preview of the path
        if len(current_line_points) > 1:
            # Remove previous preview
            cv.delete("temp_freehand")
            
            # Draw the entire path as one continuous line
            points = [coord for point in current_line_points for coord in point]
            cv.create_line(
                *points,
                fill=hexstr,
                width=int(brush.get("1.0", "end-1c")),
                capstyle=ROUND,
                tags=('temp_freehand',)
            )
        
        lastx, lasty = x, y

def finish_freehand(event):
    global lastx, lasty, linecount, current_line_points
    if lastx is not None and lasty is not None:
        x = cv.canvasx(event.x)
        y = cv.canvasy(event.y)
        
        # Snap to grid if enabled
        if snap_var.get():
            x, y = get_snap_point(x, y, is_final=True)
        
        # Add final point
        current_line_points.append((x, y))
        
        # Remove preview
        cv.delete("temp_freehand")
        
        # Create the final path as one continuous line
        if len(current_line_points) > 1:
            points = [coord for point in current_line_points for coord in point]
            cv.create_line(
                *points,
                fill=hexstr,
                width=int(brush.get("1.0", "end-1c")),
                capstyle=ROUND,
                tags=('all_lines', current_shape_id)
            )
        
        # Reset variables
        linecount += 1
        lastx = None
        lasty = None
        current_line_points = []
        
        # Notify layers window of new shape
        cv.event_generate('<<ShapeAdded>>')
        
        # Save canvas state
        save_canvas_state()

def start_freehand_z(event):
    global lastx, lasty, current_shape_id, linecount, current_line_points
    x = cv.canvasx(event.x)
    y = cv.canvasy(event.y)
    lastx, lasty = x, y
    current_shape_id = f"shape_{linecount}"
    current_line_points = []
    
    # Move to start position at travel height
    if ser is not None and ser.is_open:
        from config3 import zTravel, zDraw
        draw_speed = int(draw_speed_input.get("1.0", "end-1c"))
        ser.write(f"G1 Z{zTravel} F{draw_speed}\n".encode())
        time.sleep(0.1)
        ser.write(f"G1 Z{zDraw} F{draw_speed}\n".encode())
        time.sleep(0.1)
    
    # Create first point
    cv.create_line(
        x, y, x, y,
        fill=hexstr,
        width=int(brush.get("1.0", "end-1c")),
        capstyle=ROUND,
        tags=('all_lines', current_shape_id)
    )

def update_freehand_z(event):
    global lastx, lasty
    if lastx is not None and lasty is not None:
        x = cv.canvasx(event.x)
        y = cv.canvasy(event.y)
        
        # Create connected line segment
        cv.create_line(
            lastx, lasty, x, y,
            fill=hexstr,
            width=int(brush.get("1.0", "end-1c")),
            capstyle=ROUND,
            tags=('all_lines', current_shape_id)
        )
        
        lastx, lasty = x, y

def finish_freehand_z(event):
    global lastx, lasty, linecount
    if lastx is not None and lasty is not None:
        x = cv.canvasx(event.x)
        y = cv.canvasy(event.y)
        
        # Create final line segment
        cv.create_line(
            lastx, lasty, x, y,
            fill=hexstr,
            width=int(brush.get("1.0", "end-1c")),
            capstyle=ROUND,
            tags=('all_lines', current_shape_id)
        )
        
        # Move to travel height when done
        if ser is not None and ser.is_open:
            from config3 import zTravel
            draw_speed = int(draw_speed_input.get("1.0", "end-1c"))
            ser.write(f"G1 Z{zTravel} F{draw_speed}\n".encode())
            time.sleep(0.1)
        
        linecount += 1
        lastx = None
        lasty = None

def open_drawing_tools():
    global tool_buttons, tools_window
    
    # If window already exists, just lift it
    if 'tools_window' in globals() and tools_window is not None:
        try:
            tools_window.lift()
            tools_window.focus_force()
            return
        except:
            pass  # Window was probably destroyed
    
    tools_window = tk.Toplevel(win)
    tools_window.title("Drawing Tools")
    tools_window.geometry("200x600+1700+0")
    tools_window.configure(bg="#263d42")
    tools_window.attributes('-topmost', True)  # Make window always on top
    tools_window.bind('<FocusOut>', lambda e: tools_window.lift())  # Keep on top even after losing focus
     
    buttons = ["Line", "Circle", "Rectangle", "Polygon", "Arc", "Freehand", "Live Carving"]
    for btn_text in buttons:
        btn = Button(tools_window, text=btn_text, bd=2, height=2, width=15,
                    fg="white", bg="#263d42", 
                    command=lambda t=btn_text: toggle_tool(t))
        btn.pack(pady=5)
        tool_buttons[btn_text] = btn
    
    # Modified checkbox configuration for both laser and Z-axis
    laser_active_checkbox = tk.Checkbutton(
        tools_window, 
        text="Laser Active", 
        variable=laser_active_var,
        bg="#263d42",
        fg="white",
        selectcolor="black",
        activebackground="#263d42",
        activeforeground="white"
    )
    laser_active_checkbox.pack(pady=5)
    
    z_axis_checkbox = tk.Checkbutton(
        tools_window, 
        text="Z-Axis Active", 
        variable=z_axis_active_var,
        bg="#263d42",
        fg="white",
        selectcolor="black",
        activebackground="#263d42",
        activeforeground="white"
    )
    z_axis_checkbox.pack(pady=5)
    
    # Handle window close
    def on_window_close():
        global tools_window
        tools_window = None
        tools_window.destroy()
    
    tools_window.protocol("WM_DELETE_WINDOW", on_window_close)

# Add Import SVG button to root window
import_svg_btn = tk.Button(root, text="Import SVG", bd=2, height=2, width=14, fg="white", bg="#263d42", command=lambda: import_svg(root, cv))
import_svg_btn.place(x=0, y=80)  # Place it near the top of the root window

with Image.open('temp2.png') as img:
    width6, height6 = img.size

    
#START WINDOW###################################################################################################
win = tk.Toplevel(root,height=0 , width=0, bg="#263d42",cursor="circle", borderwidth=0)
win.geometry(f"{1370}x{980}+324+0")  
win.attributes('-alpha', 1)
#win.wm_attributes("-alpha", 0.5)
#laser active checkbox



bg=ImageTk.PhotoImage(Image.open("icon//bg3.png")) 
label2 = tk.Label(win,text= "Hello World", image = bg,anchor= CENTER) 
label2.place(x=0,y=0)

container = ttk.Frame(win, borderwidth=0)




lastx, lasty = None, None
linecount=0
hexstr=("#000000")
bsize=5
seed = (0, 0)
# Initialize rgb as a tuple instead of a list to match the format from askcolor
rgb = (0, 0, 0)  # Black as initial color
text_elements = []  # Initialize text elements list
selected_text_index = None  # For text selection

header1=Frame(win, height=53, width=x4*10,borderwidth=0)
header1.pack(side="top")
header1.config(bg="#263d42")

with Image.open('temp2.png') as img7:
    width8, height8 = img7.size


# Create ruler canvases first
h_ruler = tk.Canvas(win, height=20, width=1900, bg='#263d42')
v_ruler = tk.Canvas(win, height=1700, width=20, bg='#263d42')

# Pack rulers first to ensure they stay on top
h_ruler.pack(side='top', padx=(20, 0), fill='x')
v_ruler.pack(side='left', fill='y')

# Create main scrollable frame
main_frame = tk.Frame(win)
main_frame.pack(expand=True, fill='both', padx=20, pady=(20, 0))  # Add top padding to account for ruler

# Create canvas for scrolling with specific width
scroll_canvas = tk.Canvas(main_frame, width=1200)
scroll_canvas.grid(row=0, column=0, sticky='nsew')

# Add scrollbars
style = ttk.Style()
style.configure("Custom.Horizontal.TScrollbar", 
                background="#263d42", 
                troughcolor="#1a1a1a",
                bordercolor="#263d42",
                arrowcolor="white")
style.configure("Custom.Vertical.TScrollbar",
                background="#263d42",
                troughcolor="#1a1a1a",
                bordercolor="#263d42",
                arrowcolor="white")

h_scroll = ttk.Scrollbar(main_frame, orient='horizontal', command=scroll_canvas.xview, style="Custom.Horizontal.TScrollbar")
v_scroll = ttk.Scrollbar(main_frame, orient='vertical', command=scroll_canvas.yview, style="Custom.Vertical.TScrollbar")
h_scroll.grid(row=1, column=0, sticky='ew')
v_scroll.grid(row=0, column=1, sticky='ns')

# Configure scroll canvas
scroll_canvas.configure(
    xscrollcommand=lambda *args: [h_scroll.set(*args), on_scroll()],
    yscrollcommand=lambda *args: [v_scroll.set(*args), on_scroll()]
)

# Configure main_frame grid
main_frame.grid_rowconfigure(0, weight=1)
main_frame.grid_columnconfigure(0, weight=1)

# Create frame inside canvas for content
content_frame = tk.Frame(scroll_canvas)
scroll_canvas.create_window((0, 0), window=content_frame, anchor='nw')

# Create canvas frame with border
canvas_frame = tk.Frame(content_frame, bg='#1a1a1a', padx=2, pady=2)
canvas_frame.pack(expand=True, padx=50, pady=10, fill='both')

# Get canvas dimensions from JSON
with open('machine_profiles/last_used.json', 'r') as f:
    config = json.load(f)
    bed_x = int(config.get('bed_max_x', 370))
    bed_y = int(config.get('bed_max_y', 600))

# Create drawing canvas
cv = tk.Canvas(canvas_frame, bg='white', borderwidth=0, highlightthickness=0, width=bed_x, height=bed_y)
cv.pack(expand=True, fill='both')

# Initialize drawing context
image1 = Image.new('RGBA', (width8, height8), (0,0,0,0))
draw = ImageDraw.Draw(image1)

# Initialize scale variables
cv.scale_factor = 1.0
# Call update_rulers initially


def update_rulers(scale_factor=1.0):
    # Clear existing ruler markings
    h_ruler.delete('all')
    v_ruler.delete('all')
    
    # Get base dimensions
    with open('machine_profiles/last_used.json', 'r') as f:
        config = json.load(f)
        bed_x = int(config.get('bed_max_x', 370))
        bed_y = int(config.get('bed_max_y', 600))
    
    # Get scroll position
    x_scroll = scroll_canvas.xview()[0]
    y_scroll = scroll_canvas.yview()[0]
    
    # Calculate visible area offset
    x_offset = x_scroll * bed_x * scale_factor
    y_offset = y_scroll * bed_y * scale_factor
    
    # Account for canvas padding and position
    canvas_x = 50  # padx from canvas_frame.pack
    canvas_y = 10  # pady from canvas_frame.pack
    
    # Calculate step size based on scale
    step = 50 if scale_factor <= 1 else int(50 / scale_factor)
    
    # Draw horizontal ruler (left to right)
    for i in range(0, bed_x + step, step):
        x_pos = (i * scale_factor) + canvas_x + 20 - x_offset
        h_ruler.create_line(x_pos, 0, x_pos, 10, fill='white')
        h_ruler.create_text(x_pos, 15, text=str(i), fill='white', font=('Arial', 7))

    
    # Draw vertical ruler (bottom to top)
    v_height = bed_y * scale_factor
    for i in range(0, bed_y + step, step):
        y_pos = v_height - (i * scale_factor) + canvas_y - y_offset
        v_ruler.create_line(10, y_pos, 20, y_pos, fill='white')
        v_ruler.create_text(5, y_pos, text=str(i), fill='white', font=('Arial', 7), angle=90)

def on_scale_change(*args):
    # Convert percentage string to float scale factor (e.g., "150%" -> 1.5)
    scale_str = scale_var.get().rstrip('%')
    scale_factor = float(scale_str) / 100
    
    # Reset drawing state before scaling
    global lastx, lasty
    lastx = None
    lasty = None
    
    # If Live Carving is active, turn off laser and lift Z
    if active_tool == "Live Carving" and ser is not None and ser.is_open:
        ser.write("M5\n".encode())
        ser.write(b"G1 Z20 F3000\n")
        ser.flush()
    
    apply_scale(scale_factor)

def on_scroll(*args):
    # Reset drawing state before scrolling
    global lastx, lasty
    lastx = None
    lasty = None
    
    # If Live Carving is active, turn off laser and lift Z
    if active_tool == "Live Carving" and ser is not None and ser.is_open:
        ser.write("M5\n".encode())
        ser.write(b"G1 Z20 F3000\n")
        ser.flush()
    
    update_rulers(cv.scale_factor)

def apply_scale(new_scale):
    global text_elements
    current_scale = cv.scale_factor
    cv.scale_factor = new_scale
    
    # Get base dimensions from JSON
    with open('machine_profiles/last_used.json', 'r') as f:
        config = json.load(f)
        base_bed_x = int(config.get('bed_max_x', 370))
        base_bed_y = int(config.get('bed_max_y', 600))
    
    # Calculate new dimensions
    new_width = int(base_bed_x * new_scale)
    new_height = int(base_bed_y * new_scale)
    
    # Update canvas size
    cv.config(width=new_width, height=new_height)
    canvas_frame.config(width=new_width + 4, height=new_height + 4)
    
    # Scale all non-text canvas elements
    scale_factor = new_scale / current_scale
    for item in cv.find_all():
        if "text" not in cv.gettags(item):
            cv.scale(item, 0, 0, scale_factor, scale_factor)
    
    # Clear existing text
    cv.delete("text")
    
    # Redraw text elements with scaled size
    for text_elem in text_elements:
        scaled_x = text_elem['base_x'] * new_scale
        scaled_y = text_elem['base_y'] * new_scale
        scaled_size = int(text_elem['size'] * new_scale)
        
        text_id = cv.create_text(
            scaled_x, scaled_y,
            text=text_elem['text'],
            font=(text_elem['font'], scaled_size),
            tags="text",
            anchor='nw',
            fill=text_elem['color']
        )
        
        text_elem['x'] = scaled_x
        text_elem['y'] = scaled_y
        text_elem['current_size'] = scaled_size
        text_elem['id'] = text_id
    
    # Update scroll region to include full width
    content_frame.update_idletasks()
    bbox = scroll_canvas.bbox("all")
    if bbox:
        # Ensure scroll region is at least as wide as the viewport
        min_width = scroll_canvas.winfo_width()
        scroll_width = max(min_width, bbox[2] - bbox[0] + 100)  # Add padding
        scroll_canvas.configure(scrollregion=(0, 0, scroll_width, bbox[3]))
    
    # Force geometry updates
    canvas_frame.update_idletasks()
    main_frame.update_idletasks()
    


# Add this dropdown menu instead
scale_values = [f"{i}%" for i in range(50, 1001, 50)]  # Creates list from 50% to 1000%
scale_var = tk.StringVar(win)
scale_var.set('100%')  # Default value
grid_size_var.trace('w', on_grid_size_change)
def on_scale_change(*args):
    # Convert percentage string to float scale factor (e.g., "150%" -> 1.5)
    scale_str = scale_var.get().rstrip('%')
    scale_factor = float(scale_str) / 100
    
    # Reset drawing state before scaling
    global lastx, lasty
    lastx = None
    lasty = None
    
    # If Live Carving is active, turn off laser and lift Z
    if active_tool == "Live Carving" and ser is not None and ser.is_open:
        ser.write("M5\n".encode())
        ser.write(b"G1 Z20 F3000\n")
        ser.flush()
    
    apply_scale(scale_factor)

scale_menu = tk.OptionMenu(win, scale_var, *scale_values)
scale_menu.config(width=4, bg="#263d42", fg="white")
scale_menu.place(x=510, y=24)
scale_var.trace('w', on_scale_change)

# Scale, zoom
scale_label = tk.Label(win, text="Zoom:", fg="white", bg="#263d42")
scale_label.place(x=510, y=0)


# Add grid checkbox
grid_cb = tk.Checkbutton(win, text="Grid", variable=grid_var,
                        bg="#263d42", fg="white", selectcolor="#1a1a1a",
                        command=on_grid_toggle)
grid_cb.place(x=600, y=0)

# Add grid size dropdown
grid_size_label = tk.Label(win, text="Grid Size:", fg="white", bg="#263d42")
grid_size_label.place(x=665, y=0)

grid_sizes = [f"{i/5:.1f}" for i in range(1, 51)]  # 0.2 to 10 mm in 0.2mm intervals
grid_size_dropdown = ttk.Combobox(win, textvariable=grid_size_var, values=grid_sizes, width=5)
grid_size_dropdown.place(x=720, y=0)

# Add snap checkbox
snap_cb = tk.Checkbutton(win, text="Snap", variable=snap_var,
                        bg="#263d42", fg="white", selectcolor="#1a1a1a")
snap_cb.place(x=600, y=24)

text_edit = Text(win, width=21, height=1, wrap=CHAR, bd=2, bg="#808080", fg="white")
text_edit.place(x=330, y=0)

# Fix the Text button - remove command and only use bind
Textbutton = Button(win, text="Add Text", bd=2, height=1, width=6, fg="white", bg="#263d42")
Textbutton.place(x=450, y=24)
Textbutton.bind('<1>', activate_text)

txtsize = tk.Text(win,height =1,width = 3) 
txtsize.insert(END, '50')
txtsize.place(x=420, y=24)

#COM
def get_com_port():
    return machine_com.get("1.0", "end-1c")


save_svg_btn = Button(win, text="Save SVG", bd=2, height=1, width=10, fg="white", bg="#263d42", command=save_svg)
save_svg_btn.place(x=0, y=0)

save_svg_btn = Button(win, text="Drawing Tools", bd=2, height=1, width=10, fg="white", bg="#263d42", command=open_drawing_tools)
save_svg_btn.place(x=0, y=24)

Paint_Gcodebutton= Button(win,text="Line Color",bd=2,height=1, width=10, fg="white", bg=hexstr, command=Paint_Gcodecolor)
Paint_Gcodebutton.place(x=160,y=0)

### Paint_Gcode Bucket settings
Fillbutton= Button(win,text="Fill Color",bd=2,height=1, width=10, fg="white", bg=hexstr , command=Fillcolor)
Fillbutton.place(x=160,y=24)

ftres = tk.Text(win,height =1,width = 2) 
ftres.insert(END, '70')
ftres.place(x=300, y=25)
text = Label(win, text="Treshold",height=1, width=6,fg="#B2C3C7",bg="#263d42")
text.place(x=240,y=24)

# Add quick settings input boxes
draw_speed_label = Label(root, text="Draw Speed:", height=1, width=10, fg="#B2C3C7", bg="#263d42")
draw_speed_label.place(x=0, y=125)
draw_speed_input = tk.Text(root, height=1, width=5)
draw_speed_input.insert('1.0', '1000')  # Set default value to 1000
draw_speed_input.place(x=80, y=125)

laser_power_label = Label(root, text="Laser Power:", height=1, width=10, fg="#B2C3C7", bg="#263d42")
laser_power_label.place(x=0, y=155)
laser_power_input = tk.Text(root, height=1, width=5)
laser_power_input.insert('1.0', '1000')  # Set default value to 1000
laser_power_input.place(x=80, y=155)

layers_label = Label(root, text="Layers:", height=1, width=10, fg="#B2C3C7", bg="#263d42")
layers_label.place(x=0, y=185)
layers_input = tk.Text(root, height=1, width=5)
layers_input.insert(END, '1')
layers_input.place(x=80, y=185)



# Update Engrave button
Engravebutton = Button(win, text="Engrave", bd=2, height=1, width=14, fg="white", bg="#263d42", 
                      command=lambda: engrave.Engrave())  # Changed to call without arguments since we use globals now
Engravebutton.place(x=780, y=0)

###RESET
reset1=Button(win,text='Clear Lines',bd=2,height=1, width=10, fg="white", bg="#263d42" ,command=clear)
reset1.place(x=80,y=0)

# Move Replicate button creation after the Replicate function definition
def Replicate():
    """Replay recorded movements exactly as they were sent"""
    global ser, recorded_moves
    
    if not ser or not ser.is_open:
        messagebox.showerror("Error", "Please connect to the machine first")
        return
        
    if not recorded_moves:
        messagebox.showwarning("Warning", "No recorded moves to replicate")
        return
    
    try:
        # Get number of layers
        layers = int(layers_input.get("1.0", "end-1c")) if layers_input.get("1.0", "end-1c").strip() else 1
        
        # Initialize machine
        init_commands = [
            "G21",  # Set units to mm
            "G90",  # Absolute positioning
            "G28",  # Home all axes
        ]
        
        # Add Z movement only if Z-axis is active
        if z_axis_active_var.get():
            from config3 import zTravel
            init_commands.append(f"G1 Z{zTravel} F3000")  # Use travel speed for initial Z lift
        
        init_commands.extend([
            "G92 X0 Y0",  # Set current position as origin
            "M5"  # Ensure laser is off
        ])
        
        # Send initialization commands
        for cmd in init_commands:
            ser.write(f"{cmd}\n".encode())
            ser.flush()
            time.sleep(0.1)  # Longer delay during initialization
        
        # Process each layer
        for layer in range(layers):
            print(f"Layer {layer + 1}/{layers}")
            
            # Replay each recorded command sequence exactly
            for commands in recorded_moves:
                for cmd in commands:
                    # Check if command contains Z movement
                    if 'Z' in cmd and not z_axis_active_var.get():
                        # Skip Z commands if Z-axis is not active
                        continue
                        
                    # Send command exactly as recorded
                    ser.write(f"{cmd}\n".encode())
                    ser.flush()
                    
                    # Add longer delay for Z movements
                    if 'Z' in cmd:
                        time.sleep(0.1)  # Longer delay for Z movements
                    else:
                        time.sleep(0.02)  # Normal delay for other movements
            
            # End layer
            ser.write("M5\n".encode())
            ser.flush()
            time.sleep(0.1)  # Longer delay between layers
        
        # Return to origin
        ser.write("M5\n".encode())
        ser.flush()
        time.sleep(0.05)
        
        # Handle Z return based on Z-axis active state
        if z_axis_active_var.get():
            from config3 import zTravel
            ser.write(f"G1 Z{zTravel} F3000\n".encode())
            ser.flush()
            time.sleep(0.1)
            
        ser.write("G0 X0 Y0 F3000\n".encode())
        ser.flush()
        time.sleep(0.1)
        
        messagebox.showinfo("Success", f"Completed {layers} layers")
        
    except Exception as e:
        # Emergency stop
        ser.write("M5\n".encode())
        ser.flush()
        messagebox.showerror("Error", f"Failed to replicate: {str(e)}")

# Add Replicate button after function definition
ReplicateButton = Button(win, text="Replicate", bd=2, height=1, width=14, fg="white", bg="#263d42", command=Replicate)
ReplicateButton.place(x=780, y=24)  # Place below Engrave button

### Paint Brush settings
Selectbutton = Button(win, text="Select", bd=2, height=1, width=10, fg="white", bg="#263d42", command=toggle_select)
Selectbutton.place(x=660, y=24)  # Select Button 






##Line thickness parameters:
brush = tk.Text(win,height =1,width = 2) 
brush.insert(END, '2')
brush.place(x=300, y=0)
text = Label(win, text="Line size",height=1, width=8,fg="#B2C3C7",bg="#263d42")
text.place(x=240,y=0)

# Initialize crosshair and machine position dot variables
crosshair_h = None
crosshair_v = None
machine_position_dot = None

def create_crosshair():
    global crosshair_h, crosshair_v, machine_position_dot
    
    # Delete existing crosshair and dot if they exist
    if crosshair_h:
        cv.delete(crosshair_h)
    if crosshair_v:
        cv.delete(crosshair_v)
    if machine_position_dot:
        cv.delete(machine_position_dot)
        
    # Create horizontal and vertical lines for crosshair (initially hidden)
    crosshair_h = cv.create_line(0, 0, cv.winfo_width(), 0, fill='red', width=1, dash=(4, 4), tags='crosshair')
    crosshair_v = cv.create_line(0, 0, 0, cv.winfo_height(), fill='red', width=1, dash=(4, 4), tags='crosshair')
    # Create machine position dot at bottom left (initially)
    machine_position_dot = cv.create_oval(0, cv.winfo_height()-6, 6, cv.winfo_height(), fill='red', outline='white', tags='machine_pos')
    cv.tag_raise('machine_pos')  # Ensure dot is on top

def update_machine_position():
    global crosshair_h, crosshair_v
    try:
        # Only update crosshair position based on mouse
        canvas_width = cv.winfo_width()
        canvas_height = cv.winfo_height()
        mouse_x = cv.winfo_pointerx() - cv.winfo_rootx()
        mouse_y = cv.winfo_pointery() - cv.winfo_rooty()
        
        # Keep coordinates within canvas bounds
        mouse_x = max(0, min(mouse_x, canvas_width))
        mouse_y = max(0, min(mouse_y, canvas_height))
        
        # Update crosshair
        cv.coords(crosshair_h, 0, mouse_y, canvas_width, mouse_y)
        cv.coords(crosshair_v, mouse_x, 0, mouse_x, canvas_height)
        cv.tag_raise('crosshair')  # Bring crosshair to front
    except Exception as e:
        print(f"Error updating crosshair: {e}")
    finally:
        # Schedule next update with a longer interval
        root.after(100, update_machine_position)  # Reduced update frequency

def update_machine_dot_position():
    global machine_position_dot
    if ser is not None and ser.is_open:
        try:
            # Clear input buffer first
            ser.reset_input_buffer()
            
            # Send position query
            ser.write(b'?\n')
            time.sleep(0.1)  # Short delay for response
            
            if ser.in_waiting:
                response = ser.readline().decode('utf-8').strip()
                # Parse machine coordinates from response
                try:
                    # Extract MPos value from response like '<Run|MPos:13.825' or '<Idle|MPos:50.000'
                    if 'MPos:' in response:
                        pos_str = response.split('MPos:')[1]
                        # Split X and Y if they exist
                        coords = pos_str.split(',')
                        if coords:
                            # Get current scale factor
                            try:
                                scale_str = scale_var.get().rstrip('%')
                                scale_factor = float(scale_str) / 100.0
                            except:
                                scale_factor = 1.0
                            
                            # Apply scaling to coordinates
                            x = float(coords[0]) * scale_factor
                            y = float(coords[1]) if len(coords) > 1 else x
                            y = y * scale_factor
                            
                            # Get canvas height for Y inversion
                            canvas_height = cv.winfo_height()
                            # Invert Y coordinate (canvas 0,0 is top-left, machine 0,0 is bottom-left)
                            y = canvas_height - y
                            
                            # Update dot position
                            cv.coords(machine_position_dot, x-6, y-6, x+6, y+6)
                            cv.tag_raise('machine_pos')  # Make sure dot stays on top
                except Exception as e:
                    print(f"Error parsing machine position: {e}")
        except Exception as e:
            print(f"Error reading machine position: {e}")
    
    # Schedule next update
    root.after(250, update_machine_dot_position)  # Update every 0.25 seconds

# Create and start updating crosshair and machine position
create_crosshair()
update_machine_position()
update_machine_dot_position()

menubar = Menu(win)
menubar.add_command(label="Exit", command=root.quit)
win.config(menu=menubar)
win.grid() 

open_drawing_tools()  
## END READ RGB MOUSE #######################################

menubar = Menu(root)

# File Menu
filemenu = Menu(menubar, tearoff=0)
menubar.add_cascade(label="File", menu=filemenu)
filemenu.add_command(label="New File", command=clear)
filemenu.add_command(label="Save SVG", command=save_svg)
filemenu.add_command(label="Import SVG", command=select_svg_file)
filemenu.add_separator()
filemenu.add_command(label="Exit", command=root.quit)

# Edit Menu
editmenu = Menu(menubar, tearoff=0)
menubar.add_cascade(label="Edit", menu=editmenu)
editmenu.add_command(label="Undo", command=undo)
editmenu.add_command(label="Redo", command=redo)

# Select Menu
selectmenu = Menu(menubar, tearoff=0)
menubar.add_cascade(label="Select", menu=selectmenu)
selectmenu.add_command(label="Select", command=toggle_select)
selectmenu.add_command(label="De-Select", command=lambda: toggle_select())
selectmenu.add_command(label="Clear Lines", command=clear)

# Windows Menu
windowsmenu = Menu(menubar, tearoff=0)
menubar.add_cascade(label="Windows", menu=windowsmenu)
windowsmenu.add_command(label="Drawing Tools", command=open_drawing_tools)
windowsmenu.add_command(label="Layers", command=open_layers_window)
#windowsmenu.add_command(label="Settings", command=load_last_used_settings)
#windowsmenu.add_command(label="AI Window", command=open_ai_window)

root.config(menu=menubar)



#### BUTTONS ####################################################################################################################################################
undo_button = tk.Button(root, text="Undo", bd=2, height=1, width=8, fg="white", bg="#263d42", command=undo)
undo_button.place(x=0, y=0)

redo_button = tk.Button(root, text="Redo", bd=2, height=1, width=8, fg="white", bg="#263d42", command=redo)
redo_button.place(x=80, y=0)

loadimagebt= tk.Button(root, text="Vectorimage",bd=2,height=2, width=14, fg="white", bg="#0075d0" , command=Imagevector).place(x=216, y=0)

# Red buttons moved to top
loadimagebt= tk.Button(root, text="IMG to GCODE",bd=2,height=2, width=14, fg="white", bg="red" , command=convert_and_print).place(x=0, y=40)
loadimagebt= tk.Button(root, text="PaintBrush GCODE",bd=2,height=2, width=14, fg="white", bg="red" , command=smooth_print).place(x=108, y=40)
loadimagebt= tk.Button(root, text="ZIGZAG GCODE",bd=2,height=2, width=14, fg="white", bg="red" , command=zigzag_print).place(x=216, y=40)
loadimagebt= tk.Button(root, text="SVG to GCODE",bd=2,height=2, width=14, fg="white", bg="red" , command=select_svg_file).place(x=216, y=80)
loadimagebt= tk.Button(root, text="Print GCODE Paths",bd=2,height=2, width=14, fg="white", bg="red" , command=print_gcode_paths).place(x=108, y=80)
randomfrogb= tk.Button(root, text="HOME",bd=1,height=1, width=8, fg="white", bg="red" , command=activate_gcode).place(x=260, y=832)



# COM and Machine Settings window ###############################
def load_last_used_settings():
    """Load last used settings at startup"""
    import json
    import os
    
    profiles_dir = 'machine_profiles'
    last_used_path = os.path.join(profiles_dir, 'last_used.json')
    
    if os.path.exists(last_used_path):
        with open(last_used_path, 'r') as f:
            try:
                settings = json.load(f)
                # Update config3 with saved settings
                for name, value in settings.items():
                    try:
                        if hasattr(config3, name):
                            if isinstance(getattr(config3, name), float):
                                value = float(value)
                            elif isinstance(getattr(config3, name), int):
                                value = int(value)
                            setattr(config3, name, value)
                    except (ValueError, AttributeError):
                        pass
                return settings.get('Serial_connection', 'COM3'), settings.get('baud_rate', '115200')
            except json.JSONDecodeError:
                return 'COM3', '115200'
    return 'COM3', '115200'

# Load settings first
last_com_port, last_baud = load_last_used_settings()

# Create COM port input
machine_com = tk.Text(root,height=1,width=5)
machine_com.insert(END, last_com_port)
machine_com.place(x=0, y=860)
tk.Label(root, text="COM Port:", fg="white", bg="#263d42").place(x=50, y=860)

# Create baud rate dropdown with last used value
baud_rates = ['4800', '9600', '19200', '38400', '57600', '115200', '230400', '250000', '460800', '921600']
baud_var = tk.StringVar(root)
baud_var.set(last_baud)  # Set to last used value
baud_menu = tk.OptionMenu(root, baud_var, *baud_rates)
baud_menu.config(width=7, bg="#263d42", fg="white")
baud_menu.place(x=130, y=860)
tk.Label(root, text="Baud:", fg="white", bg="#263d42").place(x=220, y=860)

def get_baud_rate():
    return int(baud_var.get())

def save_last_used_settings(config_vars):
    """Save current settings as last used"""
    import json
    import os
    
    # Get all current settings
    settings = {name: var.get() for name, var in config_vars.items()}
    
    # Always include current baud rate and COM port
    settings['baud_rate'] = baud_var.get()
    settings['Serial_connection'] = machine_com.get("1.0", "end-1c").strip()
    
    # Save to last_used.json
    profiles_dir = 'machine_profiles'
    if not os.path.exists(profiles_dir):
        os.makedirs(profiles_dir)
        
    with open(os.path.join(profiles_dir, 'last_used.json'), 'w') as f:
        json.dump(settings, f, indent=4)

def save_new_profile(config_vars):
    """Save current settings as a new profile"""
    import json
    import os
    from tkinter import simpledialog
    
    profile_name = simpledialog.askstring("New Profile", "Enter profile name:")
    if profile_name:
        settings = {name: var.get() for name, var in config_vars.items()}
        settings['baud_rate'] = baud_var.get()  # Explicitly save baud rate
        settings['Serial_connection'] = machine_com.get("1.0", "end-1c").strip()
        
        profiles_dir = 'machine_profiles'
        if not os.path.exists(profiles_dir):
            os.makedirs(profiles_dir)
            
        with open(os.path.join(profiles_dir, f'{profile_name}.json'), 'w') as f:
            json.dump(settings, f, indent=4)
            
        # Also save as last used settings
        with open(os.path.join(profiles_dir, 'last_used.json'), 'w') as f:
            json.dump(settings, f, indent=4)
        
        messagebox.showinfo("Success", f"Profile '{profile_name}' saved successfully!")

def update_profile(profile_name, config_vars):
    """Update existing profile with current settings"""
    import json
    import os
    
    if profile_name and profile_name != 'Last Used':
        # Get current settings
        settings = {name: var.get() for name, var in config_vars.items()}
        settings['baud_rate'] = baud_var.get()
        settings['Serial_connection'] = machine_com.get("1.0", "end-1c").strip()
        
        profiles_dir = 'machine_profiles'
        profile_path = os.path.join(profiles_dir, f'{profile_name}.json')
        
        # Save to profile file
        with open(profile_path, 'w') as f:
            json.dump(settings, f, indent=4)
        
        # Also update last_used.json
        with open(os.path.join(profiles_dir, 'last_used.json'), 'w') as f:
            json.dump(settings, f, indent=4)
        
        messagebox.showinfo("Success", f"Profile '{profile_name}' updated successfully!")

def load_profile_values(profile_name, config_vars):
    """Load settings from selected profile"""
    profiles = load_profiles()
    if profile_name in profiles:
        settings = profiles[profile_name]
        
        # Update all settings
        for name, value in settings.items():
            if name in config_vars:
                config_vars[name].set(value)
                try:
                    if isinstance(getattr(config3, name), float):
                        value = float(value)
                    elif isinstance(getattr(config3, name), int):
                        value = int(value)
                    setattr(config3, name, value)
                except (ValueError, AttributeError):
                    pass
        
        # Update UI elements
        if 'baud_rate' in settings:
            baud_var.set(settings['baud_rate'])
        if 'Serial_connection' in settings:
            machine_com.delete("1.0", END)
            machine_com.insert(END, settings['Serial_connection'])
        
        # Save these settings as last used
        save_last_used_settings(config_vars)
        
        messagebox.showinfo("Success", f"Profile '{profile_name}' loaded successfully!")

# Baud rate dropdown
baud_rates = ['4800', '9600', '19200', '38400', '57600', '115200', '230400', '250000', '460800', '921600']
baud_var = tk.StringVar(root)
baud_var.set('115200')
baud_menu = tk.OptionMenu(root, baud_var, *baud_rates)
baud_menu.config(width=7, bg="#263d42", fg="white")
baud_menu.place(x=130, y=860)
tk.Label(root, text="Baud:", fg="white", bg="#263d42").place(x=220, y=860)

# Connect button
connect_btn = tk.Button(root, text="Connect", height=1, width=8, fg="white", bg="red", command=connect_machine)
connect_btn.place(x=260, y=860)

## END MACHINE SETTINGS ################## 

root.bind("<Return>")


# Initialize without any drawing bindings
win.unbind('<1>')
win.unbind('<3>')
cv.unbind('<B1-Motion>')
cv.unbind('<B3-Motion>')
cv.unbind('<ButtonRelease-1>')
cv.unbind('<ButtonRelease-3>')

def select_text(event):
    global selected_text_index
    x, y = event.x, event.y
    
    # Find the clicked text element
    found_text = False
    for i, text_elem in enumerate(text_elements):
        tx, ty = text_elem['x'], text_elem['y']
        size = text_elem['size']
        # Check if click is within text bounds (with padding)
        if abs(x - tx) < size + 20 and abs(y - ty) < size + 20:
            # If clicking the same text that's already selected, deselect it
            if selected_text_index == i:
                cv.itemconfig(text_elem['id'], fill=text_elem['color'])
                selected_text_index = None
            else:
                # Reset previous selection if any
                if selected_text_index is not None:
                    cv.itemconfig(text_elements[selected_text_index]['id'], 
                                fill=text_elements[selected_text_index]['color'])
                # Select new text
                selected_text_index = i
                cv.itemconfig(text_elem['id'], fill='red')
            found_text = True
            break
    
    # If we clicked empty space, deselect current text
    if not found_text and selected_text_index is not None:
        cv.itemconfig(text_elements[selected_text_index]['id'], 
                     fill=text_elements[selected_text_index]['color'])
        selected_text_index = None

def move_text(event):
    if selected_text_index is not None:
        x, y = event.x, event.y
        text_elem = text_elements[selected_text_index]
        
        # Move the canvas text object
        cv.coords(text_elem['id'], x, y)
        
        # Update stored coordinates
        text_elem['x'] = x
        text_elem['y'] = y
        text_elem['base_x'] = x / cv.scale_factor
        text_elem['base_y'] = y / cv.scale_factor
        
        # Keep text selected (red) while moving
        cv.itemconfig(text_elem['id'], fill='red')
def on_mouse_release(event):
    # Don't reset the color on release anymore
    pass

def activate_text(e):
    global lastx, lasty
    # Unbind other tools first
    win.unbind('<1>')
    win.unbind('<3>')
    cv.unbind('<B1-Motion>')
    cv.unbind('<B3-Motion>')
    cv.unbind('<ButtonRelease-1>')
    win.unbind('<Delete>')
    
    # Enable text selection and movement
    cv.bind('<Button-1>', select_text)
    cv.bind('<B1-Motion>', move_text)
    cv.bind('<ButtonRelease-1>', on_mouse_release)
    cv.bind('<Button-3>', place_text)
    win.bind('<Delete>', delete_text)
    lastx, lasty = cv.canvasx(e.x), cv.canvasy(e.y)

def redraw_canvas():

    
    # Create a separate layer for selection highlight
    highlight_layer = Image.new('RGBA', imgA.size, (0, 0, 0, 0))
    highlight_draw = ImageDraw.Draw(highlight_layer)
    
    # Clear all text from canvas
    cv.delete("text")
    
    # Redraw all text elements
    for i, text_elem in enumerate(text_elements):
        # Use the stored font and color for each text element
        stored_font = text_elem.get('font', 'Impact')  # Default to Impact if font not stored
        myFont = get_font(stored_font, text_elem['size'])
        color = text_elem['color']  # Use stored color directly
        
        # Draw text on both canvas and image
        cv.create_text(
            text_elem['x'], text_elem['y'],
            text=text_elem['text'],
            font=(stored_font, text_elem['size']),
            tags="text",
            anchor='nw',
            fill=color
        )

        
        # Draw selection box if this text is selected
        if i == selected_text_index:
            text_width = len(text_elem['text']) * text_elem['size'] * 0.6
            text_height = text_elem['size']
            
            # Draw dotted rectangle outline
            box_coords = [
                text_elem['x'],  # left
                text_elem['y'],  # top
                text_elem['x'] + text_width,  # right
                text_elem['y'] + text_height  # bottom
            ]
            
            # Draw dotted box
            draw_dotted_box(highlight_draw, box_coords)
    
    # Composite the highlight layer onto the main image
    imgA = Image.alpha_composite(imgA, highlight_layer)

# Add at the top with other imports
import time

# Add to the initialization section at the bottom of the file
selected_text_index = None

def draw_dotted_box(highlight_draw, box_coords):
    """Draw a dotted rectangle with all sides visible"""
    dash_length = 5
    dash_gap = 5
    
    # Draw horizontal lines (top and bottom)
    for i in range(0, int(box_coords[2] - box_coords[0]), dash_length + dash_gap):
        # Top line
        highlight_draw.line(
            [(box_coords[0] + i, box_coords[1]), 
             (box_coords[0] + min(i + dash_length, box_coords[2] - box_coords[0]), box_coords[1])],
            fill=(0, 0, 255, 255),
            width=1
        )
        # Bottom line
        highlight_draw.line(
            [(box_coords[0] + i, box_coords[3]), 
             (box_coords[0] + min(i + dash_length, box_coords[2] - box_coords[0]), box_coords[3])],
            fill=(0, 0, 255, 255),
            width=1
        )
    
    
    # Draw vertical lines (left and right)
    for i in range(0, int(box_coords[3] - box_coords[1]), dash_length + dash_gap):
        # Left line
        highlight_draw.line(
            [(box_coords[0], box_coords[1] + i), 
             (box_coords[0], box_coords[1] + min(i + dash_length, box_coords[3] - box_coords[1]))],
            fill=(0, 0, 255, 255),
            width=1
        )
        # Right line
        highlight_draw.line(
            [(box_coords[2], box_coords[1] + i), 
             (box_coords[2], box_coords[1] + min(i + dash_length, box_coords[3] - box_coords[1]))],
            fill=(0, 0, 255, 255),
            width=1
        )

# Add after other imports
from tkinter import font as tkfont

# Add after other initializations
available_fonts = list(tkfont.families())
available_fonts.sort()
font_var = tk.StringVar(win)
font_var.set('Impact')


# Add this helper function at the top level
def get_font(font_name, size):
    """Helper function to load fonts from Windows Fonts directory"""
    try:
        # Try to find the font file in Windows Fonts directory
        font_path = f"C:\\Windows\\Fonts\\{font_name}.ttf"
        return ImageFont.truetype(font_path, size)
    except:
        try:
            # Try alternate extensions
            font_path = f"C:\\Windows\\Fonts\\{font_name}.TTF"
            return ImageFont.truetype(font_path, size)
        except:
            print(f"Failed to load font {font_name}, falling back to Impact")
            return ImageFont.truetype('\\font\\impact.ttf', size)

def get_compatible_fonts():
    """Get list of fonts that can be successfully loaded"""
    compatible_fonts = []
    for font_name in tkfont.families():
        try:
            # Try TTF extension
            font_path = f"C:\\Windows\\Fonts\\{font_name}.ttf"
            ImageFont.truetype(font_path, 50)  # Test with size 50
            compatible_fonts.append(font_name)
            continue
        except:
            try:
                # Try TTF extension
                font_path = f"C:\\Windows\\Fonts\\{font_name}.TTF"
                ImageFont.truetype(font_path, 50)  # Test with size 50
                compatible_fonts.append(font_name)
                continue
            except:
                pass  # Font is not compatible, skip it
    return sorted(compatible_fonts)

# Add after other initializations
available_fonts = get_compatible_fonts()
font_var = tk.StringVar(win)
font_var.set('Impact')
font_dropdown = tk.OptionMenu(win, font_var, *available_fonts)
font_dropdown.config(width=6, bg="#263d42", fg="white")
font_dropdown.place(x=330, y=24)

# Replace the font dropdown initialization with a list of known compatible fonts
available_fonts = [
    'Arial',
    'Arial Black',
    'Calibri',
    'Cambria',
    'Comic Sans MS',
    'Courier New',
    'Georgia',
    'Impact',
    'Segoe UI',
    'Tahoma',
    'Times New Roman',
    'Trebuchet MS',
    'Verdana'
]


# Add panning functionality
def start_pan(event):
    global last_x, last_y
    widget = event.widget
    widget.configure(cursor="fleur")
    last_x = event.x
    last_y = event.y

def do_pan(event):
    global last_x, last_y
    delta_x = event.x - last_x
    delta_y = event.y - last_y
    
    # Move the scroll region instead of the canvas contents
    scroll_canvas.xview_scroll(-delta_x, "units")
    scroll_canvas.yview_scroll(-delta_y, "units")
    
    last_x = event.x
    last_y = event.y

def stop_pan(event):
    widget = event.widget
    widget.configure(cursor="")

def update_snap_indicator(event):
    """Update the snap indicator when mouse moves"""
    x = cv.canvasx(event.x)
    y = cv.canvasy(event.y)
    
    # Remove any existing snap markers and labels
    cv.delete('snap_point')
    cv.delete('snap_label')
    
    # Check for endpoint snapping first if enabled
    if snap_to_endpoints_var.get():
        endpoint = snap_to_endpoints(cv, x, y, tolerance=20.0)  # Increased tolerance
        if endpoint:
            snap_x, snap_y = endpoint
            # Show green marker and label for endpoint snap
            cv.create_oval(snap_x-4, snap_y-4, snap_x+4, snap_y+4,
                         fill='#00FF00', outline='white', tags='snap_point')
            cv.create_text(snap_x, snap_y-15, text="Endpoint", 
                         fill='#0088FF', font=('Arial', 8), tags='snap_label')

# Bind mouse motion to update snap indicator
cv.bind('<Motion>', update_snap_indicator)






# Bind middle mouse button for selection and Delete key for deletion
cv.bind('<Button-2>', lambda e: None)  # Disable middle mouse selection
win.bind('<Delete>', delete_text)
# Bind panning only to the scroll_canvas, not the drawing canvas
scroll_canvas.bind("<ButtonPress-2>", start_pan)
scroll_canvas.bind("<B2-Motion>", do_pan)
scroll_canvas.bind("<ButtonRelease-2>", stop_pan)

# Remove the cv bindings
# cv.unbind("<ButtonPress-2>")
# cv.unbind("<B2-Motion>")
# cv.unbind("<ButtonRelease-2>")

# Add AI button to root window
aibutton = tk.Button(root, text="AI Assistant", bd=2, height=2, width=14, fg="white", bg="#263d42", command=lambda: open_ai_window())
aibutton.place(x=0, y=920)

def open_ai_window():
    import Ai
    ai_root = tk.Toplevel(root)
    app = Ai.ChatApp(ai_root)
    ai_root.mainloop()

def preview_gcode_path():
    """Preview the G-code path before engraving"""
    preview_window = Toplevel(root)
    preview_window.title("G-code Path Preview")
    preview_window.geometry("600x600")
    
    preview_canvas = Canvas(preview_window, width=500, height=500, bg='white')
    preview_canvas.pack(pady=10)
    
    # Get machine dimensions
    with open('machine_profiles/last_used.json', 'r') as f:
        config = json.load(f)
        bed_width = int(config.get('bed_max_x', 300))
        bed_height = int(config.get('bed_max_y', 300))
    
    # Scale factor for preview
    scale = min(480/bed_width, 480/bed_height)
    
    def draw_preview():
        preview_canvas.delete('all')
        # Draw bed outline
        preview_canvas.create_rectangle(10, 10, 10+bed_width*scale, 10+bed_height*scale, outline='gray')
        
        # Get all objects and their G-code paths
        objects = cv.find_withtag("all_lines")
        if not objects:
            return
        
        # Draw each object's path
        for obj in objects:
            coords = cv.coords(obj)
            if not coords:
                continue
            
            # Transform coordinates
            machine_coords = []
            for i in range(0, len(coords), 2):
                x = coords[i]
                y = coords[i + 1]
                machine_x = (x * bed_width) / cv.winfo_width()
                machine_y = bed_height - ((y * bed_height) / cv.winfo_height())
                # Scale for preview
                preview_x = 10 + machine_x * scale
                preview_y = 10 + machine_y * scale
                machine_coords.extend([preview_x, preview_y])
            
            # Draw path
            if cv.type(obj) == 'oval':
                x1, y1, x2, y2 = machine_coords
                preview_canvas.create_oval(x1, y1, x2, y2, outline='blue')
            else:
                preview_canvas.create_line(machine_coords, fill='blue', width=2)
    
    draw_preview()
    Button(preview_window, text="Close", command=preview_window.destroy).pack(pady=5)

def send_gcode_buffered(gcode_lines):
    """Send G-code commands with proper buffering and acknowledgment"""
    if not ser or not ser.is_open:
        return False
        
    try:
        buffer_size = 0
        max_buffer = 127  # Maximum buffer size for most controllers
        
        for i, command in enumerate(gcode_lines):
            # Wait if buffer is full
            while buffer_size >= max_buffer:
                response = ser.readline().decode().strip()
                if response == 'ok':
                    buffer_size -= 1
                    
            # Send command
            print(f"Sending ({i+1}/{len(gcode_lines)}): {command}")
            ser.write((command + "\n").encode())
            buffer_size += 1
            
            # Add small delay every 10 commands
            if i % 10 == 0:
                time.sleep(0.05)
        
        # Wait for remaining commands to complete
        while buffer_size > 0:
            response = ser.readline().decode().strip()
            if response == 'ok':
                buffer_size -= 1
                
        return True
    except Exception as e:
        print(f"Error sending G-code: {str(e)}")
        return False

def finish_rectangle(event):
    global current_rectangle, linecount
    if current_rectangle:
        # Get final mouse position
        x = cv.canvasx(event.x)
        y = cv.canvasy(event.y)
        
        # Get snap point for final position
        x, y = get_snap_point(x, y, True)
        
        # Update rectangle with final coordinates
        cv.coords(current_rectangle, lastx, lasty, x, y)
        
        # Clean up any temporary markers
        cv.delete('start_marker')
        
        linecount += 1
        current_rectangle = None
        save_canvas_state()  # Save state after rectangle is completed

def finish_polygon(event):
    global current_polygon, linecount
    if current_polygon:
        # Get final mouse position for radius
        x = cv.canvasx(event.x)
        y = cv.canvasy(event.y)
        
        # Get snap point for final radius
        x, y = get_snap_point(x, y, True)
        
        # Calculate final radius and points
        radius = ((x - lastx) ** 2 + (y - lasty) ** 2) ** 0.5
        points = []
        sides = 6  # Hexagon
        for i in range(sides):
            angle = 2 * math.pi * i / sides - math.pi/2  # Start from top
            px = lastx + radius * math.cos(angle)
            py = lasty + radius * math.sin(angle)
            points.extend([px, py])
        
        # Update polygon with final points
        cv.coords(current_polygon, *points)
        
        # Clean up any temporary markers
        cv.delete('center_marker')
        
        linecount += 1
        current_polygon = None
        save_canvas_state()  # Save state after polygon is completed

def get_connected_segments(segment_id):
    """Find all line segments that are connected to the given segment."""
    try:
        # Get the tags of the segment
        tags = cv.gettags(segment_id)
        if not tags:
            return [segment_id]
            
        # Check for shape tag
        shape_tag = None
        for tag in tags:
            if tag.startswith('shape_'):
                shape_tag = tag
                break
                
        # If it has a shape tag, return all segments with that tag
        if shape_tag:
            return list(cv.find_withtag(shape_tag))
            
        # If no shape tag found, return just this segment
        return [segment_id]
        
    except TclError:
        return []

def start_freehand(event):
    global lastx, lasty, current_shape_id, linecount, current_line_points
    x = cv.canvasx(event.x)
    y = cv.canvasy(event.y)
    
    # Snap to grid if enabled
    if snap_var.get():
        x, y = get_snap_point(x, y, is_final=True)
    
    lastx = x
    lasty = y
    current_shape_id = f"shape_{linecount}"
    current_line_points = [(x, y)]  # Store points for creating a single continuous path

def update_freehand(event):
    global lastx, lasty, current_line_points
    if lastx is not None and lasty is not None:
        x = cv.canvasx(event.x)
        y = cv.canvasy(event.y)
        
        # Snap to grid if enabled
        if snap_var.get():
            x, y = get_snap_point(x, y)
        
        # Add point to the list instead of creating individual segments
        current_line_points.append((x, y))
        
        # Update preview of the path
        if len(current_line_points) > 1:
            # Remove previous preview
            cv.delete("temp_freehand")
            
            # Draw the entire path as one continuous line
            points = [coord for point in current_line_points for coord in point]
            cv.create_line(
                *points,
                fill=hexstr,
                width=int(brush.get("1.0", "end-1c")),
                capstyle=ROUND,
                tags=('temp_freehand',)
            )
        
        lastx, lasty = x, y

def finish_freehand(event):
    global lastx, lasty, linecount, current_line_points
    if lastx is not None and lasty is not None:
        x = cv.canvasx(event.x)
        y = cv.canvasy(event.y)
        
        # Snap to grid if enabled
        if snap_var.get():
            x, y = get_snap_point(x, y, is_final=True)
        
        # Add final point
        current_line_points.append((x, y))
        
        # Remove preview
        cv.delete("temp_freehand")
        
        # Create the final path as one continuous line
        if len(current_line_points) > 1:
            points = [coord for point in current_line_points for coord in point]
            cv.create_line(
                *points,
                fill=hexstr,
                width=int(brush.get("1.0", "end-1c")),
                capstyle=ROUND,
                tags=('all_lines', current_shape_id)
            )
         
        # Reset variables
        linecount += 1
        lastx = None
        lasty = None
        current_line_points = []
        
        # Notify layers window of new shape
        cv.event_generate('<<ShapeAdded>>')
        
        # Save canvas state
        save_canvas_state()

def load_profiles():
    """Load all saved profiles from the profiles directory"""
    import json
    import os
    
    profiles = {}
    profiles_dir = 'machine_profiles'
    
    # Create profiles directory if it doesn't exist
    if not os.path.exists(profiles_dir):
        os.makedirs(profiles_dir)
    
    # Load all profiles first
    for filename in os.listdir(profiles_dir):
        if filename.endswith('.json'):
            profile_name = filename[:-5]  # Remove .json extension
            with open(os.path.join(profiles_dir, filename), 'r') as f:
                try:
                    profiles[profile_name] = json.load(f)
                except json.JSONDecodeError:
                    continue
    
    return profiles

def update_profile(profile_name, config_vars):
    """Update existing profile with current settings"""
    import json
    import os
    
    if profile_name and profile_name != 'Last Used':
        # Get current settings
        settings = {name: var.get() for name, var in config_vars.items()}
        settings['baud_rate'] = baud_var.get()
        settings['Serial_connection'] = machine_com.get("1.0", "end-1c").strip()
        
        profiles_dir = 'machine_profiles'
        profile_path = os.path.join(profiles_dir, f'{profile_name}.json')
        
        # Save to profile file
        with open(profile_path, 'w') as f:
            json.dump(settings, f, indent=4)
        
        # Also update last_used.json
        with open(os.path.join(profiles_dir, 'last_used.json'), 'w') as f:
            json.dump(settings, f, indent=4)
        
        messagebox.showinfo("Success", f"Profile '{profile_name}' updated successfully!")

def load_profile_values(profile_name, config_vars):
    """Load settings from selected profile"""
    profiles = load_profiles()
    if profile_name in profiles:
        settings = profiles[profile_name]
        
        # Update all settings
        for name, value in settings.items():
            if name in config_vars:
                config_vars[name].set(value)
                try:
                    if isinstance(getattr(config3, name), float):
                        value = float(value)
                    elif isinstance(getattr(config3, name), int):
                        value = int(value)
                    setattr(config3, name, value)
                except (ValueError, AttributeError):
                    pass
        
        # Update UI elements
        if 'baud_rate' in settings:
            baud_var.set(settings['baud_rate'])
        if 'Serial_connection' in settings:
            machine_com.delete("1.0", END)
            machine_com.insert(END, settings['Serial_connection'])
        
        # Save these settings as last used
        save_last_used_settings(config_vars)
        
        messagebox.showinfo("Success", f"Profile '{profile_name}' loaded successfully!")

# Create settings button
settings_button = tk.Button(root, text="Settings", bd=2, height=1, width=8, fg="white", bg="red", command=lambda: open_settings_window())
settings_button.place(x=260, y=890)

def open_settings_window():
    settings = tk.Toplevel(root)
    settings.title("Mechanicus Settings")
    settings.configure(bg="#263d42")
    settings.geometry("500x900")
    
    settings_frame = ttk.Frame(settings)
    settings_frame.pack(fill='both', expand=True, padx=10, pady=10)
    
    profile_frame = ttk.LabelFrame(settings_frame, text="Profile Management")
    profile_frame.grid(row=0, column=0, columnspan=2, padx=5, pady=5, sticky='ew')
    
    profile_var = tk.StringVar()
    profiles = load_profiles()
    if profiles:
        profile_var.set(list(profiles.keys())[0])
    profile_menu = ttk.Combobox(profile_frame, textvariable=profile_var, values=list(profiles.keys()))
    profile_menu.grid(row=0, column=0, padx=5, pady=5)
    
    
    ttk.Button(profile_frame, text="Load Profile", command=lambda: load_profile_values(profile_var.get(), config_vars)).grid(row=0, column=1, padx=5, pady=5)
    ttk.Button(profile_frame, text="Save As New", command=lambda: save_new_profile(config_vars)).grid(row=0, column=2, padx=5, pady=5)
    ttk.Button(profile_frame, text="Update Current", command=lambda: update_profile(profile_var.get(), config_vars)).grid(row=0, column=3, padx=5, pady=5)
    
    config_vars = {}
    
    canvas = tk.Canvas(settings_frame, height=700)
    scrollbar = ttk.Scrollbar(settings_frame, orient="vertical", command=canvas.yview)
    scrollable_frame = ttk.Frame(canvas)

    scrollable_frame.bind(
        "<Configure>",
        lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
    )

    canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
    canvas.configure(yscrollcommand=scrollbar.set)
    
    # Load last used settings
    last_used_settings = {}
    profiles_dir = 'machine_profiles'
    last_used_path = os.path.join(profiles_dir, 'last_used.json')
    if os.path.exists(last_used_path):
        with open(last_used_path, 'r') as f:
            try:
                last_used_settings = json.load(f)
            except json.JSONDecodeError:
                pass
    
    
    row = 1
    for var_name, default_value in [
        ('Serial_connection', machine_com.get("1.0", "end-1c").strip()),
        ('baud_rate', baud_var.get()),
        ('line_speed', 2000),
        ('curve_speed', 2000),
        ('draw_speed', 2000),
        ('travel_speed', 2000),
        ('draw_height', 0),
        ('travel_height', 26),
        ('smoothness', 0.34),
        ('connect_tolerance', 0.001),
        ('laser_power', 1000),
        ('layer_height', 0.15),
        ('print_accel', 3000),
        ('travel_accel', 2000),
        ('max_jerk', 200),
        ('layers', 1),
        ('scaleF', 0.72),
        ('x_offset', 0),
        ('y_offset', 0),
        ('bed_max_x', 300),
        ('bed_max_y', 300),
        ('zTravel', 3),
        ('zDraw', 0.0),
        ('zLift', 2),
        ('feed_rate', 3000)
    ]:
        ttk.Label(scrollable_frame, text=f"{var_name}:").grid(row=row, column=0, padx=5, pady=2, sticky='w')
        
        # Use last used value if available, otherwise use default
        value = last_used_settings.get(var_name, default_value)
        var = tk.StringVar(value=str(value))
        config_vars[var_name] = var
        
        if var_name == 'baud_rate':
            entry = ttk.Combobox(scrollable_frame, textvariable=var, values=baud_rates)
        else:
            entry = ttk.Entry(scrollable_frame, textvariable=var)
        entry.grid(row=row, column=1, padx=5, pady=2, sticky='ew')
        
        def make_callback(name):
            def callback(*args):
                try:
                    value = config_vars[name].get()
                    if name == 'baud_rate':
                        baud_var.set(value)
                    elif name == 'Serial_connection':
                        machine_com.delete(1.0, END)
                        machine_com.insert(END, value)
                    else:
                        if isinstance(getattr(config3, name, None), float):
                            value = float(value)
                        elif isinstance(getattr(config3, name, None), int):
                            value = int(value)
                        setattr(config3, name, value)
                    save_last_used_settings(config_vars)
                except (ValueError, AttributeError):
                    pass
            return callback
        
        var.trace_add('write', make_callback(var_name))
        row += 1
    
    settings_frame.grid_columnconfigure(1, weight=1)
    canvas.grid(row=1, column=0, columnspan=2, sticky='nsew')
    scrollbar.grid(row=1, column=2, sticky='ns')
    settings.transient(root)
    settings.grab_set()

# Initialize baud rate dropdown with last used value
last_com_port, last_baud = load_last_used_settings()
baud_var.set(last_baud)  # Set the dropdown to last used value

# Add Layers Window button
layers_window_btn = tk.Button(win, text="Layers", bd=2, height=1, width=10, 
                            fg="white", bg="#263d42", command=open_layers_window)
layers_window_btn.place(x=80, y=24)  # Place below Drawing Tools button

# Initialize arc-related variables
current_arc = None
arc_center_marker = None

def start_arc(event):
    global lastx, lasty, current_arc, arc_center_marker, current_shape_id, linecount
    x = cv.canvasx(event.x)
    y = cv.canvasy(event.y)
    
    # Snap center point to grid
    if snap_var.get():
        x, y = get_snap_point(x, y, is_final=True)
    
    lastx = x
    lasty = y
    current_shape_id = f"shape_{linecount}"
    
    # Delete any existing temporary items
    cv.delete('center_marker')
    cv.delete('radius_marker')
    if current_arc:
        cv.delete(current_arc)
    
    current_arc = cv.create_arc(
        x-1, y-1, x+1, y+1,
        outline=hexstr,
        width=int(brush.get("1.0", "end-1c")),
        start=0, extent=90,
        tags=('all_lines', current_shape_id)
    )
    
    # Create center marker
    cv.create_oval(
        x-4, y-4, x+4, y+4,
        fill='#00FF00', outline='white',
        tags=('center_marker', 'above_all')
    )

def update_arc(event):
    global current_arc
    if current_arc:
        x = cv.canvasx(event.x)
        y = cv.canvasy(event.y)
        
        # Get snap point for preview
        if snap_var.get():
            x, y = get_snap_point(x, y)
        
        # Calculate radius and angle
        radius = ((x - lastx) ** 2 + (y - lasty) ** 2) ** 0.5
        angle = math.degrees(math.atan2(y - lasty, x - lastx))
        if angle < 0:
            angle += 360
            
        # Update arc preview
        cv.coords(current_arc,
            lastx - radius, lasty - radius,
            lastx + radius, lasty + radius
        )
        cv.itemconfig(current_arc, start=0, extent=angle)

def finish_arc(event):
    global current_arc, arc_center_marker, linecount
    if current_arc:
        x = cv.canvasx(event.x)
        y = cv.canvasy(event.y)
        
        # Get snap point for final position
        if snap_var.get():
            x, y = get_snap_point(x, y, is_final=True)
        
        # Calculate final radius and angle
        radius = ((x - lastx) ** 2 + (y - lasty) ** 2) ** 0.5
        angle = math.degrees(math.atan2(y - lasty, x - lastx))
        if angle < 0:
            angle += 360
            
        # Update arc one last time with snapped position
        cv.coords(current_arc,
            lastx - radius, lasty - radius,
            lastx + radius, lasty + radius
        )
        cv.itemconfig(current_arc, start=0, extent=angle)
        
        # Clean up temporary markers
        cv.delete('radius_marker')
        cv.delete('center_marker')
        
        # Save state and increment linecount
        linecount += 1
        current_arc = None
        save_canvas_state()

# Initialize the canvas history
init_canvas_history()  # Now call it after the function is defined

def open_snap_tool_window():
    snap_window = tk.Toplevel(win)
    snap_window.title("Snap Tools")
    snap_window.configure(bg="#263d42")
    
    # Create checkboxes for different snap options
    tk.Checkbutton(snap_window, text="Grid Snap", variable=snap_var, bg="#263d42", 
                  fg="white", selectcolor="#263d42").pack(anchor=W)
    tk.Checkbutton(snap_window, text="Endpoint Snap", variable=snap_to_endpoints_var, 
                  bg="#263d42", fg="white", selectcolor="#263d42").pack(anchor=W)
    
    # Position window near the snap tool button
    snap_window.geometry(f"+{1020}+{50}")
    
    # Make window stay on top
    snap_window.attributes('-topmost', True)

# Rename the existing snap checkbox to 'Grid Snap'
grid_snap_checkbox = tk.Checkbutton(win, text="Grid Snap", variable=grid_var, bg="#263d42", fg="white", selectcolor="#263d42")
grid_snap_checkbox.place(x=0, y=0)  # Adjust position as needed

# Add a button to open the snap tool window
snap_tool_button = tk.Button(win, text="Snap Tools", bd=2, height=1, width=14, fg="white", bg="#263d42", command=open_snap_tool_window)
snap_tool_button.place(x=1020, y=24)



# Add Live Feed button
live_feed_button = tk.Button(win, text="Live Feed", bd=2, height=1, width=14, fg="white", bg="#263d42", command=lambda: WebcamFeed(win))
live_feed_button.place(x=900, y=0)  # Adjust the position as needed

# Add Markers button next to Live Feed
markers_button = tk.Button(win, text="Markers", bd=2, height=1, width=14, fg="white", bg="#263d42", command=lambda: open_markers_window())
markers_button.place(x=1020, y=0)  # Positioned next to Live Feed button

# Add Line Editor button
cv.linecount = linecount  # Make linecount accessible to canvas
win.linecount = linecount  # Make linecount accessible to window
win.line_editor = LineEditor(win, cv)  # Store the instance
line_editor_button = tk.Button(win, text="Line Editor", bd=2, height=1, width=14, fg="white", bg="#263d42", 
                             command=lambda: win.line_editor.show_tools_window())
line_editor_button.place(x=900, y=24)  # Positioned below Live Feed button

def open_markers_window():
    from markers import MarkersWindow
    win.markers_window = MarkersWindow(win, cv)  # Store the instance in win

def clear_selection():
    global selected_items
    selected_items.clear()
    highlight_selected_shapes()

def select_tool(tool_name):
    global active_tool, current_shape_id, linecount, lastx, lasty, current_line_points
    
    # Clear any existing selection when switching tools
    clear_selection()
    
    # Clean up any temporary markers first
    cv.delete('temp_marker')
    cv.delete('snap_point')
    cv.delete('snap_line')
    cv.delete('radius_marker')
    cv.delete('center_marker')
    cv.delete('temp')
    cv.delete('guide_point')
    cv.delete('guide_line')
    
    # Reset drawing state
    lastx = None
    lasty = None
    current_line_points = []
    
    # Unbind all events first
    cv.unbind('<Button-1>')
    cv.unbind('<B1-Motion>')
    cv.unbind('<ButtonRelease-1>')
    cv.unbind('<Button-3>')
    cv.unbind('<B3-Motion>')
    cv.unbind('<ButtonRelease-3>')
    
    # Reset all tool buttons to default color
    for btn_text, btn in tool_buttons.items():
        btn.configure(bg="#263d42")
    
    if tool_name == active_tool:
        active_tool = None
        return
    
    active_tool = tool_name
    tool_buttons[tool_name].configure(bg="#00FF00")  # Set active tool button to green
    current_shape_id = f"shape_{linecount}"

# Remove the initialize_windows call and just keep mainloop
root.mainloop()  # Keep this as the last line








