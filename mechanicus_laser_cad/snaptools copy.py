import math
from tkinter import Canvas
from typing import Tuple, List, Optional, Union

# Type aliases
Point = Tuple[float, float]
BoundingBox = Tuple[float, float, float, float]

def distance(p1: Point, p2: Point) -> float:
    """Calculate the distance between two points."""
    return math.sqrt((p2[0] - p1[0])**2 + (p2[1] - p1[1])**2)

def get_line_center(coords: List[float]) -> Point:
    """Get the center point of a line."""
    return ((coords[0] + coords[2]) / 2, (coords[1] + coords[3]) / 2)

def get_arc_center(coords: List[float]) -> Point:
    """Get the center point of an arc or circle."""
    return ((coords[0] + coords[2]) / 2, (coords[1] + coords[3]) / 2)

def get_arc_radius(coords: List[float]) -> Tuple[float, float]:
    """Get the X and Y radius of an arc or circle."""
    return (abs(coords[2] - coords[0]) / 2, abs(coords[3] - coords[1]) / 2)

def point_on_line(point: Point, line_start: Point, line_end: Point, tolerance: float = 5.0) -> bool:
    """Check if a point lies on a line segment within tolerance."""
    d = distance(line_start, line_end)
    if d == 0:
        return distance(point, line_start) <= tolerance
    
    t = ((point[0] - line_start[0]) * (line_end[0] - line_start[0]) +
         (point[1] - line_start[1]) * (line_end[1] - line_start[1])) / (d * d)
    
    if t < 0 or t > 1:
        return False
    
    proj_x = line_start[0] + t * (line_end[0] - line_start[0])
    proj_y = line_start[1] + t * (line_end[1] - line_start[1])
    
    return distance(point, (proj_x, proj_y)) <= tolerance

def snap_to_center(canvas: Canvas, x: float, y: float, tolerance: float = 10.0) -> Optional[Point]:
    """Snap to the center of lines, arcs, and circles."""
    closest_dist = tolerance
    snap_point = None
    
    for item in canvas.find_all():
        coords = canvas.coords(item)
        item_type = canvas.type(item)
        
        if item_type in ('line', 'arc', 'oval'):
            center = get_line_center(coords) if item_type == 'line' else get_arc_center(coords)
            dist = distance((x, y), center)
            
            if dist < closest_dist:
                closest_dist = dist
                snap_point = center
    
    return snap_point

def snap_to_middle(canvas: Canvas, x: float, y: float, tolerance: float = 10.0) -> Optional[Point]:
    """Snap to the midpoint of lines and arcs."""
    closest_dist = tolerance
    snap_point = None
    
    for item in canvas.find_all():
        coords = canvas.coords(item)
        item_type = canvas.type(item)
        
        if item_type in ('line', 'arc'):
            middle = get_line_center(coords)
            dist = distance((x, y), middle)
            
            if dist < closest_dist:
                closest_dist = dist
                snap_point = middle
    
    return snap_point

def snap_to_endpoint(canvas: Canvas, x: float, y: float, tolerance: float = 10.0) -> Optional[Point]:
    """Snap to endpoints of lines and arcs."""
    closest_dist = tolerance
    snap_point = None
    
    for item in canvas.find_all():
        coords = canvas.coords(item)
        item_type = canvas.type(item)
        
        if item_type in ('line', 'arc'):
            # Check both endpoints
            endpoints = [(coords[0], coords[1]), (coords[2], coords[3])]
            for endpoint in endpoints:
                dist = distance((x, y), endpoint)
                if dist < closest_dist:
                    closest_dist = dist
                    snap_point = endpoint
    
    return snap_point

def snap_to_grid(x: float, y: float, grid_size: float) -> Point:
    """Snap to the nearest grid intersection."""
    grid_x = round(x / grid_size) * grid_size
    grid_y = round(y / grid_size) * grid_size
    return (grid_x, grid_y)

def snap_to_geometric_center(canvas: Canvas, x: float, y: float, tolerance: float = 10.0) -> Optional[Point]:
    """Snap to the geometric center of closed shapes."""
    closest_dist = tolerance
    snap_point = None
    
    for item in canvas.find_all():
        tags = canvas.gettags(item)
        if 'closed' in tags:  # Assuming closed shapes are tagged with 'closed'
            bbox = canvas.bbox(item)
            if bbox:
                center = ((bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2)
                dist = distance((x, y), center)
                if dist < closest_dist:
                    closest_dist = dist
                    snap_point = center
    
    return snap_point

def snap_to_parallel(canvas: Canvas, line_start: Point, x: float, y: float, tolerance: float = 10.0) -> Optional[Point]:
    """Create a point that would form a line parallel to an existing line."""
    closest_dist = tolerance
    snap_point = None
    reference_line = None
    
    # Find the closest line to serve as reference
    for item in canvas.find_all():
        if canvas.type(item) == 'line':
            coords = canvas.coords(item)
            line_end = (coords[2], coords[3])
            dist = distance((x, y), line_end)
            
            if dist < closest_dist:
                closest_dist = dist
                reference_line = coords
                
    if reference_line:
        # Calculate the angle of the reference line
        ref_angle = math.atan2(reference_line[3] - reference_line[1],
                             reference_line[2] - reference_line[0])
        
        # Create a parallel line through the current point
        length = distance(line_start, (x, y))
        snap_x = line_start[0] + length * math.cos(ref_angle)
        snap_y = line_start[1] + length * math.sin(ref_angle)
        
        snap_point = (snap_x, snap_y)
    
    return snap_point

def snap_to_quadrant(canvas: Canvas, x: float, y: float, tolerance: float = 10.0) -> Optional[Point]:
    """Snap to 0°, 90°, 180°, and 270° points on circles and arcs."""
    closest_dist = tolerance
    snap_point = None
    
    for item in canvas.find_all():
        if canvas.type(item) in ('arc', 'oval'):
            coords = canvas.coords(item)
            center = get_arc_center(coords)
            rx, ry = get_arc_radius(coords)
            
            # Generate quadrant points
            quadrants = [
                (center[0] + rx, center[1]),      # 0°
                (center[0], center[1] - ry),      # 90°
                (center[0] - rx, center[1]),      # 180°
                (center[0], center[1] + ry)       # 270°
            ]
            
            for quad_point in quadrants:
                dist = distance((x, y), quad_point)
                if dist < closest_dist:
                    closest_dist = dist
                    snap_point = quad_point
    
    return snap_point

def snap_to_intersection(canvas: Canvas, x: float, y: float, tolerance: float = 10.0) -> Optional[Point]:
    """Find intersection points between objects."""
    closest_dist = tolerance
    snap_point = None
    
    objects = canvas.find_all()
    for i, obj1 in enumerate(objects):
        coords1 = canvas.coords(obj1)
        type1 = canvas.type(obj1)
        
        for obj2 in objects[i+1:]:
            coords2 = canvas.coords(obj2)
            type2 = canvas.type(obj2)
            
            # Handle line-line intersections
            if type1 == 'line' and type2 == 'line':
                intersection = line_line_intersection(coords1, coords2)
                if intersection:
                    dist = distance((x, y), intersection)
                    if dist < closest_dist:
                        closest_dist = dist
                        snap_point = intersection
    
    return snap_point

def line_line_intersection(line1: List[float], line2: List[float]) -> Optional[Point]:
    """Calculate the intersection point of two lines."""
    x1, y1, x2, y2 = line1
    x3, y3, x4, y4 = line2
    
    denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
    if denominator == 0:
        return None
    
    t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denominator
    if 0 <= t <= 1:
        x = x1 + t * (x2 - x1)
        y = y1 + t * (y2 - y1)
        return (x, y)
    
    return None

def snap_to_tangent(canvas: Canvas, x: float, y: float, tolerance: float = 10.0) -> Optional[Point]:
    """Find tangent points on circles and arcs."""
    closest_dist = tolerance
    snap_point = None
    
    for item in canvas.find_all():
        if canvas.type(item) in ('arc', 'oval'):
            coords = canvas.coords(item)
            center = get_arc_center(coords)
            rx, ry = get_arc_radius(coords)
            
            # Calculate angle from center to mouse point
            angle = math.atan2(y - center[1], x - center[0])
            
            # Tangent point
            tang_x = center[0] + rx * math.cos(angle)
            tang_y = center[1] + ry * math.sin(angle)
            
            dist = distance((x, y), (tang_x, tang_y))
            if dist < closest_dist:
                closest_dist = dist
                snap_point = (tang_x, tang_y)
    
    return snap_point 