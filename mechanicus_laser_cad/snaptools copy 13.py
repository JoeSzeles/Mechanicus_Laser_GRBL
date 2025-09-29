from tkinter import Canvas
from typing import Tuple, Optional

# Type alias for a point
Point = Tuple[float, float]

def snap_to_grid(x: float, y: float, grid_size: float) -> Point:
    """Snap to the nearest grid intersection."""
    grid_x = round(x / grid_size) * grid_size
    grid_y = round(y / grid_size) * grid_size
    return (grid_x, grid_y)


def snap_to_endpoints(canvas: Canvas, x: float, y: float, tolerance: float = 30.0) -> Optional[Point]:
    """Snap to the nearest endpoint of lines on the canvas."""
    closest_dist = tolerance
    snap_point = None

    # Check all items that could be lines
    for item in canvas.find_all():
        # Get the tags for this item
        tags = canvas.gettags(item)
        
        # Skip items that aren't actual shape lines
        if 'grid_lines' in tags or 'snap_indicator' in tags or 'snap_label' in tags or \
           'preview_line' in tags or 'start_marker' in tags or 'above_all' in tags:
            continue
            
        # Only snap to actual shape lines
        if 'all_lines' not in tags:
            continue
            
        # Check if it's a line
        if canvas.type(item) == 'line':
            coords = canvas.coords(item)
            if not coords:
                continue
                
            # Check both endpoints of the line
            endpoints = [(coords[0], coords[1]), (coords[2], coords[3])]
            for endpoint in endpoints:
                dist = ((x - endpoint[0]) ** 2 + (y - endpoint[1]) ** 2) ** 0.5
                if dist < closest_dist:
                    closest_dist = dist
                    snap_point = endpoint

    return snap_point


def snap_to_midpoints(canvas: Canvas, x: float, y: float, tolerance: float = 30.0) -> Optional[Point]:
    """Snap to the nearest midpoint of lines on the canvas."""
    closest_dist = tolerance
    snap_point = None

    # Check all items that could be lines
    for item in canvas.find_all():
        # Get the tags for this item
        tags = canvas.gettags(item)
        
        # Skip items that aren't actual shape lines
        if 'grid_lines' in tags or 'snap_indicator' in tags or 'snap_label' in tags or \
           'preview_line' in tags or 'start_marker' in tags or 'above_all' in tags or \
           'temp_freehand' in tags:
            continue
            
        # Only snap to actual shape lines
        if 'all_lines' not in tags:
            continue
            
        # Check if it's a line
        if canvas.type(item) == 'line':
            coords = canvas.coords(item)
            if not coords or len(coords) < 4:  # Make sure we have valid coordinates
                continue
                
            # Calculate midpoint
            midpoint = (
                (coords[0] + coords[2]) / 2,
                (coords[1] + coords[3]) / 2
            )
            
            # Check distance to midpoint
            dist = ((x - midpoint[0]) ** 2 + (y - midpoint[1]) ** 2) ** 0.5
            if dist < closest_dist:
                closest_dist = dist
                snap_point = midpoint

    return snap_point


def snap_to_centers(canvas: Canvas, x: float, y: float, tolerance: float = 30.0) -> Optional[Point]:
    """Snap to the center points of shapes (circles, rectangles, polygons, arcs) on the canvas."""
    closest_dist = tolerance
    snap_point = None

    # Check all items
    for item in canvas.find_all():
        # Get the tags for this item
        tags = canvas.gettags(item)
        
        # Skip items that aren't actual shapes
        if 'grid_lines' in tags or 'snap_indicator' in tags or 'snap_label' in tags or \
           'preview_line' in tags or 'start_marker' in tags or 'above_all' in tags or \
           'temp_freehand' in tags:
            continue
            
        # Only snap to actual shapes
        if 'all_lines' not in tags:
            continue
            
        shape_type = canvas.type(item)
        coords = canvas.coords(item)
        center = None
        
        if not coords:
            continue
            
        if shape_type in ['oval', 'rectangle', 'arc']:
            # For shapes defined by bounding box
            center = (
                (coords[0] + coords[2]) / 2,
                (coords[1] + coords[3]) / 2
            )
        elif shape_type == 'polygon':
            # For polygons, average all points
            x_coords = coords[::2]
            y_coords = coords[1::2]
            if x_coords and y_coords:
                center = (
                    sum(x_coords) / len(x_coords),
                    sum(y_coords) / len(y_coords)
                )
                
        if center:
            dist = ((x - center[0]) ** 2 + (y - center[1]) ** 2) ** 0.5
            if dist < closest_dist:
                closest_dist = dist
                snap_point = center

    return snap_point
