import math
import cairo

def text_to_outlines(text_elem):
    try:
        import cairo
        surface = cairo.SVGSurface(None, 1000, 1000)
        ctx = cairo.Context(surface)
        ctx.select_font_face(text_elem['font'], cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_NORMAL)
        ctx.set_font_size(text_elem['size'])
        ctx.move_to(0, 0)
        ctx.text_path(text_elem['text'])
        path_data = []
        for type, points in ctx.copy_path():
            if type == cairo.PATH_MOVE_TO:
                path_data.append(f"M {points[0]:.1f},{points[1]:.1f}")
            elif type == cairo.PATH_LINE_TO:
                path_data.append(f"L {points[0]:.1f},{points[1]:.1f}")
            elif type == cairo.PATH_CURVE_TO:
                path_data.append(f"C {points[0]:.1f},{points[1]:.1f} {points[2]:.1f},{points[3]:.1f} {points[4]:.1f},{points[5]:.1f}")
            elif type == cairo.PATH_CLOSE_PATH:
                path_data.append("Z")
        path_element = f'<path d="{" ".join(path_data)}" fill="{text_elem["color"]}" stroke="none"/>'
        surface.finish()
        return path_element
    except Exception as e:
        print(f"Error converting text to path: {e}")
        return None

def save_as_svg(cv, filename, text_elements):
    # Get canvas dimensions and scale factor
    canvas_width = cv.winfo_width()
    canvas_height = cv.winfo_height()
    scale = cv.scale_factor
    
    # Create SVG file
    with open(filename, 'w', encoding='utf-8') as f:
        # Write SVG header with unscaled dimensions
        f.write('<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n')
        f.write(f'<svg width="{canvas_width}" height="{canvas_height}" xmlns="http://www.w3.org/2000/svg">\n')
        f.write('  <rect width="100%" height="100%" fill="white"/>\n')
        
        # Process all canvas items
        for item in cv.find_all():
            item_type = cv.type(item)
            tags = cv.gettags(item)
            
            # Skip utility items, grid lines, and temporary elements
            if any(tag in ['grid_lines', 'below_all', 'above_all', 'snap_point', 'snap_line', 
                          'temp_marker', 'radius_marker', 'center_marker', 'temp', 
                          'guide_point', 'guide_line', 'crosshair', 'machine_pos'] for tag in tags):
                continue
            
            # Get item properties - don't scale coordinates
            coords = cv.coords(item)
            
            # Skip if no coordinates
            if not coords:
                continue
                
            # Get color - try fill first, then outline
            color = cv.itemcget(item, 'fill')
            if not color or color == '':
                color = cv.itemcget(item, 'outline')
            if not color or color == '':
                color = '#000000'
            
            # Get width but don't scale it
            try:
                width = float(cv.itemcget(item, 'width'))
            except:
                width = 1.0
            
            if len(coords) >= 2:  # Make sure we have at least one point
                if item_type == 'arc':
                    # Handle arcs properly
                    x1, y1, x2, y2 = coords
                    cx = (x1 + x2) / 2
                    cy = (y1 + y2) / 2
                    rx = abs(x2 - x1) / 2
                    ry = abs(y2 - y1) / 2
                    
                    # Get start and extent angles
                    try:
                        start = float(cv.itemcget(item, 'start'))
                        extent = float(cv.itemcget(item, 'extent'))
                    except:
                        start = 0
                        extent = 90
                    
                    # Convert to SVG arc format
                    start_rad = math.radians(start)
                    end_rad = math.radians(start + extent)
                    
                    # Calculate start and end points
                    start_x = cx + rx * math.cos(start_rad)
                    start_y = cy - ry * math.sin(start_rad)  # SVG Y coordinates are inverted
                    end_x = cx + rx * math.cos(end_rad)
                    end_y = cy - ry * math.sin(end_rad)  # SVG Y coordinates are inverted
                    
                    # Determine if arc should be drawn in positive or negative direction
                    large_arc = 1 if abs(extent) > 180 else 0
                    sweep = 0 if extent > 0 else 1  # SVG Y coordinates are inverted
                    
                    # Create SVG arc path
                    path = f"M {start_x:.2f},{start_y:.2f} "
                    path += f"A {rx:.2f},{ry:.2f} 0 {large_arc} {sweep} {end_x:.2f},{end_y:.2f}"
                    
                    f.write(f'  <path d="{path}" fill="none" '
                           f'stroke="{color}" stroke-width="{width:.2f}" '
                           f'stroke-linecap="round" stroke-linejoin="round"/>\n')
                    continue
                
                elif item_type == 'oval':
                    # Handle ovals separately
                    x1, y1, x2, y2 = coords
                    w = abs(x2 - x1)
                    h = abs(y2 - y1)
                    cx = (x1 + x2) / 2
                    cy = (y1 + y2) / 2
                    
                    if abs(w - h) < 1:  # It's a circle
                        r = w / 2
                        f.write(f'  <circle cx="{cx:.2f}" cy="{cy:.2f}" r="{r:.2f}" '
                               f'fill="none" stroke="{color}" stroke-width="{width:.2f}"/>\n')
                    else:  # It's an ellipse
                        rx = w / 2
                        ry = h / 2
                        f.write(f'  <ellipse cx="{cx:.2f}" cy="{cy:.2f}" rx="{rx:.2f}" ry="{ry:.2f}" '
                               f'fill="none" stroke="{color}" stroke-width="{width:.2f}"/>\n')
                    continue
                
                elif item_type == 'rectangle':
                    x1, y1, x2, y2 = coords
                    w = abs(x2 - x1)
                    h = abs(y2 - y1)
                    x = min(x1, x2)
                    y = min(y1, y2)
                    f.write(f'  <rect x="{x:.2f}" y="{y:.2f}" width="{w:.2f}" height="{h:.2f}" '
                           f'fill="none" stroke="{color}" stroke-width="{width:.2f}"/>\n')
                    continue
                
                # For all other shapes (lines, freehand, live carving, etc.)
                points = [f"M {coords[0]:.2f},{coords[1]:.2f}"]
                for i in range(2, len(coords), 2):
                    points.append(f"L {coords[i]:.2f},{coords[i+1]:.2f}")
                
                # Close the path if it's a polygon
                if item_type == 'polygon':
                    points.append(f"L {coords[0]:.2f},{coords[1]:.2f}")
                    points.append("Z")
                
                # Write the path
                f.write(f'  <path d="{" ".join(points)}" fill="none" '
                       f'stroke="{color}" stroke-width="{width:.2f}" '
                       f'stroke-linecap="round" stroke-linejoin="round"/>\n')
        
        # Handle text elements
        import cairo
        surface = cairo.SVGSurface(None, 1000, 1000)
        ctx = cairo.Context(surface)
        
        for text_elem in text_elements:
            x = text_elem['base_x'] / scale
            y = text_elem['base_y'] / scale
            size = text_elem['size'] * 1.33 / scale
            color = text_elem['color']
            font = text_elem['font']
            text = text_elem['text']
            
            ctx.select_font_face(font, cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_NORMAL)
            ctx.set_font_size(size)
            baseline_offset = ctx.font_extents()[0]
            y_adjusted = y + baseline_offset
            
            ctx.new_path()
            ctx.move_to(0, 0)
            ctx.text_path(text)
            
            path_data = []
            for type, points in ctx.copy_path():
                if type == cairo.PATH_MOVE_TO:
                    path_data.append(f"M {points[0]:.1f},{points[1]:.1f}")
                elif type == cairo.PATH_LINE_TO:
                    path_data.append(f"L {points[0]:.1f},{points[1]:.1f}")
                elif type == cairo.PATH_CURVE_TO:
                    path_data.append(f"C {points[0]:.1f},{points[1]:.1f} {points[2]:.1f},{points[3]:.1f} {points[4]:.1f},{points[5]:.1f}")
                elif type == cairo.PATH_CLOSE_PATH:
                    path_data.append("Z")
            
            f.write(f'  <path transform="translate({x},{y_adjusted})" '
                   f'd="{" ".join(path_data)}" fill="{color}" stroke="none"/>\n')
        
        surface.finish()
        f.write('</svg>') 