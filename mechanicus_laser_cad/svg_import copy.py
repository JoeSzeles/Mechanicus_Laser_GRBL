import tkinter as tk
from tkinter import filedialog, messagebox
import xml.etree.ElementTree as ET
from svg.path import parse_path, Line, Arc, CubicBezier, QuadraticBezier
import re
import math

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
        "px": 0.264583,  # Standard 96 DPI conversion
        "pt": 0.352778,
        "pc": 4.23333,
        "": 0.264583  # Default to px conversion if no unit
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

def draw_path_on_canvas(canvas, path, transform, scale_x, scale_y, tags):
    points = []
    current_x, current_y = 0, 0
    
    for segment in path:
        if isinstance(segment, Line):
            x1, y1 = segment.start.real * scale_x, segment.start.imag * scale_y
            x2, y2 = segment.end.real * scale_x, segment.end.imag * scale_y
            
            if transform:
                x1, y1 = apply_transform(x1, y1, transform)
                x2, y2 = apply_transform(x2, y2, transform)
            
            canvas.create_line(x1, y1, x2, y2, tags=tags)
            current_x, current_y = x2, y2
            
        elif isinstance(segment, (CubicBezier, QuadraticBezier)):
            # Approximate curves with multiple line segments
            steps = 20
            for i in range(steps):
                t = i / steps
                point = segment.point(t)
                x, y = point.real * scale_x, point.imag * scale_y
                
                if transform:
                    x, y = apply_transform(x, y, transform)
                
                points.append((x, y))
                
            if points:
                canvas.create_line(*[coord for point in points for coord in point], tags=tags)
            points = []
            current_x, current_y = x, y
            
        elif isinstance(segment, Arc):
            # Convert SVG arc to canvas arc
            start_angle = math.degrees(math.atan2(segment.start.imag, segment.start.real))
            end_angle = math.degrees(math.atan2(segment.end.imag, segment.end.real))
            
            # Calculate bounding box
            rx, ry = segment.radius.real * scale_x, segment.radius.imag * scale_y
            cx = (segment.start.real + segment.end.real) * scale_x / 2
            cy = (segment.start.imag + segment.end.imag) * scale_y / 2
            
            if transform:
                cx, cy = apply_transform(cx, cy, transform)
            
            canvas.create_arc(
                cx - rx, cy - ry,
                cx + rx, cy + ry,
                start=start_angle,
                extent=end_angle - start_angle,
                tags=tags
            )

def import_svg(root, canvas):
    svg_path = filedialog.askopenfilename(filetypes=[('SVG files', '*.svg')])
    if not svg_path:
        return
    
    try:
        tree = ET.parse(svg_path)
        svg_root = tree.getroot()
        
        # Get SVG namespace
        ns = {'svg': 'http://www.w3.org/2000/svg'}
        
        # Try to get dimensions from viewBox first for proper scaling
        vb_width, vb_height = get_viewbox_dimensions(svg_root)
        if vb_width and vb_height:
            width_val, height_val = vb_width, vb_height
            width_unit = height_unit = "px"
        else:
            # Fallback to width/height attributes
            width_val, width_unit = get_size_with_units(svg_root.get('width'))
            height_val, height_unit = get_size_with_units(svg_root.get('height'))
        
        # Convert to mm
        width_mm = convert_to_mm(width_val, width_unit)
        height_mm = convert_to_mm(height_val, height_unit)
        
        # Create size dialog
        dialog = tk.Toplevel()
        dialog.title("SVG Import Options")
        dialog.geometry("300x200")
        
        # Add size labels and entries
        tk.Label(dialog, text="Original size:").grid(row=0, column=0, columnspan=2, pady=5)
        tk.Label(dialog, text=f"Width: {width_mm:.2f}mm").grid(row=1, column=0, columnspan=2)
        tk.Label(dialog, text=f"Height: {height_mm:.2f}mm").grid(row=2, column=0, columnspan=2)
        
        tk.Label(dialog, text="New size (mm):").grid(row=3, column=0, columnspan=2, pady=10)
        tk.Label(dialog, text="Width:").grid(row=4, column=0)
        width_var = tk.StringVar(value=f"{width_mm:.2f}")
        tk.Entry(dialog, textvariable=width_var).grid(row=4, column=1)
        
        tk.Label(dialog, text="Height:").grid(row=5, column=0)
        height_var = tk.StringVar(value=f"{height_mm:.2f}")
        tk.Entry(dialog, textvariable=height_var).grid(row=5, column=1)
        
        def on_ok():
            try:
                new_width = float(width_var.get())
                new_height = float(height_var.get())
                dialog.destroy()
                
                # Get canvas dimensions and scale factor
                canvas_height = int(canvas.cget('height'))
                canvas_scale = float(canvas.scale_factor)  # Get current canvas scale
                
                # Calculate scale factors (1 unit = 1 mm, adjusted by canvas scale)
                scale_x = (new_width / width_mm) * canvas_scale if width_mm != 0 else canvas_scale
                scale_y = (new_height / height_mm) * canvas_scale if height_mm != 0 else canvas_scale
                
                # Draw SVG elements
                for elem in svg_root.iter():
                    try:
                        if elem.tag.endswith('path'):
                            d = elem.get('d', '')
                            if d:
                                path = parse_path(d)
                                for curve in path:
                                    if isinstance(curve, Line):
                                        x1 = curve.start.real * scale_x
                                        y1 = canvas_height - curve.start.imag * scale_y
                                        x2 = curve.end.real * scale_x
                                        y2 = canvas_height - curve.end.imag * scale_y
                                        canvas.create_line(x1, y1, x2, y2, tags='all_lines')
                        
                        elif elem.tag.endswith('line'):
                            x1 = float(elem.get('x1', 0)) * scale_x
                            y1 = canvas_height - float(elem.get('y1', 0)) * scale_y
                            x2 = float(elem.get('x2', 0)) * scale_x
                            y2 = canvas_height - float(elem.get('y2', 0)) * scale_y
                            canvas.create_line(x1, y1, x2, y2, tags='all_lines')
                        
                        elif elem.tag.endswith('rect'):
                            x = float(elem.get('x', 0)) * scale_x
                            y = float(elem.get('y', 0)) * scale_y
                            w = float(elem.get('width', 0)) * scale_x
                            h = float(elem.get('height', 0)) * scale_y
                            # Position from bottom left
                            y = canvas_height - (y + h)
                            canvas.create_rectangle(x, y, x+w, y+h, tags='all_lines')
                        
                        elif elem.tag.endswith('circle'):
                            cx = float(elem.get('cx', 0)) * scale_x
                            cy = float(elem.get('cy', 0)) * scale_y
                            r = float(elem.get('r', 0)) * min(scale_x, scale_y)
                            # Position from bottom left
                            cy = canvas_height - cy
                            canvas.create_oval(cx-r, cy-r, cx+r, cy+r, tags='all_lines')
                    except (ValueError, TypeError) as e:
                        print(f"Error processing element {elem.tag}: {e}")
                        continue
                        
            except ValueError as e:
                messagebox.showerror("Error", f"Invalid number format: {str(e)}")
            except Exception as e:
                messagebox.showerror("Error", f"An error occurred: {str(e)}")
        
        tk.Button(dialog, text="OK", command=on_ok).grid(row=6, column=0, columnspan=2, pady=20)
        dialog.transient(root)
        dialog.grab_set()
        
    except Exception as e:
        messagebox.showerror("Error", f"Failed to load SVG file: {str(e)}") 