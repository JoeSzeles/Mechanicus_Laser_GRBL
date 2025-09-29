from tkinter import ROUND, TRUE

def start_freehand(event, cv, lastx, lasty, linecount, hexstr, ser, laser_active_var, z_axis_active_var):
    x = cv.canvasx(event.x)
    y = cv.canvasy(event.y)
    lastx, lasty = x, y
    current_shape_id = f"shape_{linecount}"
    current_line_points = [(x, y)]
    print(f"Starting new freehand shape {current_shape_id} at x:{x:.3f}, y:{y:.3f}")
    return lastx, lasty, current_shape_id

def update_freehand(event, cv, lastx, lasty, current_shape_id, hexstr, brush, ser):
    if lastx is not None and lasty is not None:
        x = cv.canvasx(event.x)
        y = cv.canvasy(event.y)
        print(f"Adding to shape {current_shape_id}: from ({lastx:.3f}, {lasty:.3f}) to ({x:.3f}, {y:.3f})")
        
        # Create line segment as part of the current shape
        cv.create_line(
            lastx, lasty, x, y,
            fill=hexstr,
            width=int(brush.get("1.0", "end-1c")),
            capstyle=ROUND,
            tags=('all_lines', current_shape_id)
        )
        
        lastx, lasty = x, y
        return lastx, lasty

def finish_freehand(event, cv, lastx, lasty, current_shape_id, hexstr, brush, linecount, ser, laser_active_var, z_axis_active_var):
    if lastx is not None and lasty is not None:
        x = cv.canvasx(event.x)
        y = cv.canvasy(event.y)
        print(f"Finishing freehand shape {current_shape_id}")
        
        # Create final line segment
        cv.create_line(
            lastx, lasty, x, y,
            fill=hexstr,
            width=int(brush.get("1.0", "end-1c")),
            capstyle=ROUND,
            tags=('all_lines', current_shape_id)
        )
        
        linecount += 1
        lastx = None
        lasty = None
        return linecount, lastx, lasty 