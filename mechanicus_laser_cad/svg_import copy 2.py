import tkinter as tk
from tkinter import filedialog, messagebox
import xml.etree.ElementTree as ET
from svgpathtools import parse_path, Path, Line, Arc, CubicBezier, QuadraticBezier
import re
import math
import numpy as np
import time

class ShapeManager:
    def __init__(self):
        self.counter = 1
        self.highest_id = 0

    def get_next_id(self):
        """Get next available shape ID, ensuring it's higher than any existing ID"""
        # Update counter if needed to be higher than highest seen ID
        if self.counter <= self.highest_id:
            self.counter = self.highest_id + 1
        current = self.counter
        self.counter += 1
        # Add timestamp to ensure uniqueness
        timestamp = int(time.time() * 1000)  # millisecond timestamp
        return f"shape_{current}_{timestamp}"

    def update_highest_id(self, shape_id):
        """Update the highest ID seen so far"""
        try:
            # Extract numeric ID from shape tag (e.g. "shape_123_timestamp" -> 123)
            if isinstance(shape_id, str) and shape_id.startswith('shape_'):
                id_parts = shape_id.split('_')
                if len(id_parts) >= 2:
                    id_num = int(id_parts[1])  # Get the numeric part
                    self.highest_id = max(self.highest_id, id_num)
        except (ValueError, IndexError):
            pass

    def get_base_id(self, shape_id):
        """Extract the base numeric ID without timestamp"""
        try:
            if isinstance(shape_id, str) and shape_id.startswith('shape_'):
                id_parts = shape_id.split('_')
                if len(id_parts) >= 2:
                    return int(id_parts[1])
        except (ValueError, IndexError):
            pass
        return None

# Create global shape manager
shape_manager = ShapeManager()

def get_size_with_units(value):
    if value is None:
        return 100.0, "px"  # Default size if no value
        
    # First try to convert directly to float
    try:
        return float(value), "px"
    except ValueError:
        pass
        
    # Try to extract number and unit
    try:
        # Remove any spaces and handle decimal points
        value = str(value).strip().lower()
        number = ""
        unit = ""
        
        # Extract numbers (including decimal points)
        for char in value:
            if char.isdigit() or char == '.':
                number += char
            else:
                unit = value[len(number):].strip()
                break
                
        if number:
            return float(number), unit if unit else "px"
    except:
        pass
        
    # If all else fails, return defaults
    return 100.0, "px"

def convert_to_mm(value, unit):
    # Convert various units to mm
    conversions = {
        "mm": 1,
        "cm": 10,
        "in": 25.4,
        "px": 0.2645833333,  # 96 DPI = 1 inch = 25.4mm, so 1px = 25.4/96 ≈ 0.2645833333mm
        "pt": 0.3527777778,  # 1pt = 1/72 inch = 25.4/72mm
        "pc": 4.2333333333,  # 1pc = 12pt
        "": 0.2645833333  # Default to px conversion
    }
    
    try:
        return float(value) * conversions.get(unit.lower(), 1)
    except (ValueError, TypeError):
        return 100.0  # Default size in mm if conversion fails

def get_viewbox_dimensions(svg_root):
    """Get dimensions from viewBox if width/height are not available"""
    try:
        viewbox = svg_root.get('viewBox')
        if viewbox:
            parts = viewbox.split()
            if len(parts) == 4:
                return float(parts[2]), float(parts[3])
    except:
        pass
    return None, None

def parse_transform(transform_str):
    if not transform_str:
        return None
    
    transforms = []
    # Match transform functions like translate(x,y) or matrix(a,b,c,d,e,f)
    pattern = r'(\w+)\s*\(([-\d.,\s]+)\)'
    matches = re.findall(pattern, transform_str)
    
    for name, args in matches:
        args = [float(x) for x in args.replace(' ', '').split(',')]
        transforms.append((name, args))
    return transforms

def apply_transform(x, y, transform):
    if not transform:
        return x, y
    
    for name, args in transform:
        if name == 'translate':
            x += args[0]
            y += args[1] if len(args) > 1 else 0
        elif name == 'scale':
            sx = args[0]
            sy = args[1] if len(args) > 1 else sx
            x *= sx
            y *= sy
        elif name == 'rotate':
            angle = math.radians(args[0])
            if len(args) > 2:  # Rotation around point
                cx, cy = args[1], args[2]
                x -= cx
                y -= cy
                nx = x * math.cos(angle) - y * math.sin(angle)
                ny = x * math.sin(angle) + y * math.cos(angle)
                x = nx + cx
                y = ny + cy
            else:  # Rotation around origin
                nx = x * math.cos(angle) - y * math.sin(angle)
                ny = x * math.sin(angle) + y * math.cos(angle)
                x, y = nx, ny
        elif name == 'matrix':
            # [a c e]   [x]   [ax + cy + e]
            # [b d f] * [y] = [bx + dy + f]
            # [0 0 1]   [1]   [1]
            a, b, c, d, e, f = args
            nx = a * x + c * y + e
            ny = b * x + d * y + f
            x, y = nx, ny
    return x, y

def draw_path_on_canvas(canvas, path, transform, scale_x, scale_y, tags, brush_width=2, current_color='black'):
    points = []
    current_x, current_y = 0, 0
    
    # Update highest ID from existing canvas items
    for item in canvas.find_all():
        if canvas.type(item) == 'line':
            for tag in canvas.gettags(item):
                shape_manager.update_highest_id(tag)
    
    for segment in path:
        if isinstance(segment, Line):
            # Handle straight lines
            x1 = segment.start.real * scale_x
            y1 = segment.start.imag * scale_y
            x2 = segment.end.real * scale_x
            y2 = segment.end.imag * scale_y
            
            canvas.create_line(x1, y1, x2, y2, 
                             width=brush_width, 
                             fill=current_color,
                             tags=('all_lines', f'shape_{shape_manager.get_next_id()}'))
            
        elif isinstance(segment, Arc):
            # Get arc parameters directly from the segment
            start_x = segment.start.real * scale_x
            start_y = segment.start.imag * scale_y
            end_x = segment.end.real * scale_x
            end_y = segment.end.imag * scale_y
            
            # Get the radius and apply scaling
            rx = abs(segment.radius.real) * scale_x
            ry = abs(segment.radius.imag) * scale_y
            
            # Get the center point
            center = segment.center
            cx = center.real * scale_x
            cy = center.imag * scale_y
            
            # Calculate angles in radians, flipping Y coordinates for Tkinter's coordinate system
            # In Tkinter, Y increases downward, so we negate the Y differences
            start_angle = math.atan2(-(start_y - cy), start_x - cx)
            end_angle = math.atan2(-(end_y - cy), end_x - cx)
            
            # Convert to degrees
            start_degrees = math.degrees(start_angle)
            end_degrees = math.degrees(end_angle)
            
            # Calculate the sweep angle
            if segment.sweep:
                # For sweep=True (counter-clockwise)
                if end_degrees < start_degrees:
                    end_degrees += 360
                extent = end_degrees - start_degrees
            else:
                # For sweep=False (clockwise)
                if end_degrees > start_degrees:
                    end_degrees -= 360
                extent = end_degrees - start_degrees
            
            # Handle large arc flag
            if segment.large_arc != (abs(extent) > 180):
                if extent > 0:
                    extent -= 360
                else:
                    extent += 360
            
            # Create the arc
            canvas.create_arc(
                cx - rx, cy - ry,
                cx + rx, cy + ry,
                start=start_degrees,
                extent=extent,
                style='arc',
                width=brush_width,
                outline=current_color,
                tags=('all_lines', f'shape_{shape_manager.get_next_id()}')
            )
            
        elif isinstance(segment, (CubicBezier, QuadraticBezier)):
            # Handle curves with more points for smoother rendering
            steps = 50
            points = []
            for t in np.linspace(0, 1, steps):
                point = segment.point(t)
                x = point.real * scale_x
                y = point.imag * scale_y
                points.extend([x, y])
            
            if points:
                canvas.create_line(points, 
                                 width=brush_width, 
                                 fill=current_color,
                                 tags=('all_lines', f'shape_{shape_manager.get_next_id()}'),
                                 smooth=True)
            points = []

def import_svg(root, canvas):
    svg_path = filedialog.askopenfilename(filetypes=[('SVG files', '*.svg')])
    if not svg_path:
        return

    try:
        # Parse SVG file
        tree = ET.parse(svg_path)
        svg_root = tree.getroot()
        
        # Get SVG dimensions
        svg_width, svg_width_unit = get_size_with_units(svg_root.get('width'))
        svg_height, svg_height_unit = get_size_with_units(svg_root.get('height'))
        
        # Create import options dialog
        dialog = tk.Toplevel(root)
        dialog.title("Import Options")
        dialog.geometry("300x300")
        
        # Scale options
        tk.Label(dialog, text="Scale (%)").grid(row=0, column=0, padx=5, pady=5)
        scale_var = tk.StringVar(value="100")
        tk.Entry(dialog, textvariable=scale_var).grid(row=0, column=1, padx=5, pady=5)
        
        # Line width options
        tk.Label(dialog, text="Line Width").grid(row=1, column=0, padx=5, pady=5)
        width_var = tk.StringVar(value="2")
        tk.Entry(dialog, textvariable=width_var).grid(row=1, column=1, padx=5, pady=5)
        
        # Color options
        tk.Label(dialog, text="Color").grid(row=2, column=0, padx=5, pady=5)
        color_var = tk.StringVar(value="black")
        tk.Entry(dialog, textvariable=color_var).grid(row=2, column=1, padx=5, pady=5)
        
        def on_ok():
            try:
                # Get import options
                scale_percent = float(scale_var.get())
                brush_width = float(width_var.get())
                current_color = color_var.get()
                
                # Calculate scale factors based on canvas size
                canvas_width = canvas.winfo_width()
                canvas_height = canvas.winfo_height()
                scale_x = (scale_percent / 100.0) * (canvas_width / svg_width)
                scale_y = (scale_percent / 100.0) * (canvas_height / svg_height)
                
                # Update highest ID from existing canvas items before importing
                for item in canvas.find_all():
                    for tag in canvas.gettags(item):
                        shape_manager.update_highest_id(tag)
                
                # Draw SVG elements
                for elem in svg_root.iter():
                    try:
                        if elem.tag.endswith('path'):
                            d = elem.get('d', '')
                            if d:
                                try:
                                    path = parse_path(d)
                                    draw_path_on_canvas(canvas, path, None, scale_x, scale_y, 'all_lines', brush_width, current_color)
                                except Exception as e:
                                    print(f"Error parsing path: {e}")
                                    continue
                        
                        elif elem.tag.endswith('line'):
                            x1 = float(elem.get('x1', 0)) * scale_x
                            y1 = float(elem.get('y1', 0)) * scale_y
                            x2 = float(elem.get('x2', 0)) * scale_x
                            y2 = float(elem.get('y2', 0)) * scale_y
                            canvas.create_line(x1, y1, x2, y2, width=brush_width, fill=current_color,
                                             tags=('all_lines', f'shape_{shape_manager.get_next_id()}'))
                        
                        elif elem.tag.endswith('rect'):
                            x = float(elem.get('x', 0)) * scale_x
                            y = float(elem.get('y', 0)) * scale_y
                            w = float(elem.get('width', 0)) * scale_x
                            h = float(elem.get('height', 0)) * scale_y
                            canvas.create_rectangle(x, y, x+w, y+h, width=brush_width, outline=current_color,
                                                 tags=('all_lines', f'shape_{shape_manager.get_next_id()}'))
                        
                        elif elem.tag.endswith('circle'):
                            cx = float(elem.get('cx', 0)) * scale_x
                            cy = float(elem.get('cy', 0)) * scale_y
                            r = float(elem.get('r', 0)) * min(scale_x, scale_y)
                            canvas.create_oval(cx-r, cy-r, cx+r, cy+r, width=brush_width, outline=current_color,
                                             tags=('all_lines', f'shape_{shape_manager.get_next_id()}'))
                        
                        elif elem.tag.endswith('ellipse'):
                            cx = float(elem.get('cx', 0)) * scale_x
                            cy = float(elem.get('cy', 0)) * scale_y
                            rx = float(elem.get('rx', 0)) * scale_x
                            ry = float(elem.get('ry', 0)) * scale_y
                            canvas.create_oval(cx-rx, cy-ry, cx+rx, cy+ry, width=brush_width, outline=current_color,
                                             tags=('all_lines', f'shape_{shape_manager.get_next_id()}'))
                            
                    except (ValueError, TypeError) as e:
                        print(f"Error processing element {elem.tag}: {e}")
                        continue
                
                # Generate event to update layers window
                canvas.event_generate('<<ShapeAdded>>')
                dialog.destroy()
                        
            except ValueError as e:
                messagebox.showerror("Error", f"Invalid number format: {str(e)}")
            except Exception as e:
                messagebox.showerror("Error", f"An error occurred: {str(e)}")
        
        tk.Button(dialog, text="OK", command=on_ok).grid(row=6, column=0, columnspan=2, pady=20)
        dialog.transient(root)
        dialog.grab_set()
        
    except Exception as e:
        messagebox.showerror("Error", f"Failed to load SVG file: {str(e)}")

def on_shape_right_click(event, shape_id):
    canvas = event.widget
    # Get current color
    current_color = canvas.itemcget(shape_id, 'fill')
    if current_color == '' or current_color == 'black':
        current_color = canvas.itemcget(shape_id, 'outline')
    
    # Toggle selection
    if canvas.itemcget(shape_id, 'fill') == '#00FF00' or canvas.itemcget(shape_id, 'outline') == '#00FF00':
        # Deselect
        canvas.dtag(shape_id, 'selected')
        canvas.itemconfig(shape_id, fill=current_color if canvas.type(shape_id) == 'line' else '',
                         outline=current_color if canvas.type(shape_id) != 'line' else '')
    else:
        # Select
        canvas.addtag_withtag('selected', shape_id)
        canvas.itemconfig(shape_id, fill='#00FF00' if canvas.type(shape_id) == 'line' else '',
                         outline='#00FF00' if canvas.type(shape_id) != 'line' else '') 