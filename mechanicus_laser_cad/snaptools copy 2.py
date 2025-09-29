from tkinter import Canvas
from typing import Tuple, Optional

# Type alias for a point
Point = Tuple[float, float]

def snap_to_grid(x: float, y: float, grid_size: float) -> Point:
    """Snap to the nearest grid intersection."""
    grid_x = round(x / grid_size) * grid_size
    grid_y = round(y / grid_size) * grid_size
    return (grid_x, grid_y)


def snap_to_endpoints(canvas: Canvas, x: float, y: float, tolerance: float = 20.0) -> Optional[Point]:
    """Snap to the nearest endpoint of lines on the canvas."""
    closest_dist = tolerance
    snap_point = None

    # Check all items that could be lines
    for item in canvas.find_all():
        # Skip grid lines and snap indicators
        tags = canvas.gettags(item)
        if 'grid_lines' in tags or 'snap_point' in tags or 'snap_label' in tags:
            continue
            
        # Include both permanent lines and preview lines
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
