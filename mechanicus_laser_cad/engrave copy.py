import math
import time
from tkinter import messagebox
import serial

def Engrave(cv=None, ser=None, draw_speed_input=None, laser_power_input=None, layers_input=None, 
            laser_active_var=None, z_axis_active_var=None):
    if cv is None or ser is None:
        messagebox.showerror("Error", "Canvas or serial connection not initialized")
        return
    
    if not ser or not ser.is_open:
        messagebox.showerror("Error", "Please connect to the machine first")
        return
    
    # Get machine settings
    from config3 import bed_max_x, bed_max_y, zDraw as z_Draw, zLift as z_Lift, zTravel as z_Travel
    
    try:
        draw_speed = int(draw_speed_input.get("1.0", "end-1c")) if draw_speed_input.get("1.0", "end-1c").strip() else 1000
        laser_power = int(laser_power_input.get("1.0", "end-1c")) if laser_power_input.get("1.0", "end-1c").strip() else 1000
        layers = int(layers_input.get("1.0", "end-1c"))
    except ValueError:
        messagebox.showerror("Error", "Please enter valid numbers for speed, power and layers")
        return

    print("Starting engraving process...")
    
    # Initialize machine
    commands = [
        "G21",  # Set units to mm
        "G90",  # Absolute positioning
        "G28",  # Home all axes
        f"G1 Z{z_Travel} F{draw_speed}",  # Move to travel height
        "G92 X0 Y0",  # Set current position as origin
        "M5"  # Ensure laser is off
    ]
    
    # Send initialization commands
    for cmd in commands:
        print(f"Sending init command: {cmd}")
        ser.write(f"{cmd}\n".encode())
        ser.flush()
        response = ser.readline().decode().strip()
        print(f"Received: {response}")
        time.sleep(0.1)
    
    # Get canvas dimensions
    canvas_width = cv.winfo_width()
    canvas_height = cv.winfo_height()
    
    # Process each layer
    for layer in range(layers):
        print(f"\nStarting layer {layer + 1}/{layers}")
        
        # Get all objects with all_lines tag
        all_objects = cv.find_withtag('all_lines')
        
        # Group objects by shape_id
        shapes = {}
        for obj in all_objects:
            tags = cv.gettags(obj)
            shape_id = None
            for tag in tags:
                if tag.startswith('shape_'):
                    shape_id = tag
                    break
            
            if shape_id:
                if shape_id not in shapes:
                    shapes[shape_id] = []
                shapes[shape_id].append(obj)
            else:
                # For objects without shape_id, treat each as its own shape
                shapes[f"single_{obj}"] = [obj]
        
        # Process each shape
        for shape_id, objects in shapes.items():
            print(f"\nProcessing shape {shape_id}")
            
            # Get first object to determine shape type
            first_obj = objects[0]
            shape_type = cv.type(first_obj)
            coords = cv.coords(first_obj)
            
            if not coords:
                continue
            
            # Move to travel height first
            cmd = f"G1 Z{z_Travel} F{draw_speed}\n"
            ser.write(cmd.encode())
            ser.flush()
            response = ser.readline().decode().strip()
            print(f"Sent: {cmd.strip()}, Received: {response}")
            time.sleep(0.1)
            
            if shape_type == 'oval':  # Circle/Oval
                # Get center and radius
                x1, y1, x2, y2 = coords
                center_x = (x1 + x2) / 2
                center_y = (y1 + y2) / 2
                radius_x = abs(x2 - x1) / 2
                radius_y = abs(y2 - y1) / 2
                
                # Convert to machine coordinates
                machine_center_x = (center_x * bed_max_x) / canvas_width
                machine_center_y = bed_max_y - ((center_y * bed_max_y) / canvas_height)
                machine_radius_x = (radius_x * bed_max_x) / canvas_width
                machine_radius_y = (radius_y * bed_max_y) / canvas_height
                
                # Move to start position
                start_x = machine_center_x + machine_radius_x
                start_y = machine_center_y
                cmd = f"G0 X{start_x:.3f} Y{start_y:.3f} F{draw_speed}\n"
                ser.write(cmd.encode())
                ser.flush()
                response = ser.readline().decode().strip()
                print(f"Sent: {cmd.strip()}, Received: {response}")
                
                # Lower Z if active
                if z_axis_active_var.get():
                    cmd = f"G1 Z{z_Draw} F{draw_speed}\n"
                    ser.write(cmd.encode())
                    ser.flush()
                    response = ser.readline().decode().strip()
                    print(f"Sent: {cmd.strip()}, Received: {response}")
                
                # Turn on laser
                if laser_active_var.get():
                    cmd = f"M3 S{laser_power}\n"
                    ser.write(cmd.encode())
                    ser.flush()
                    response = ser.readline().decode().strip()
                    print(f"Sent: {cmd.strip()}, Received: {response}")
                
                # Draw circle using small segments
                num_segments = 72  # More segments for smoother circle
                # Move to start position first
                angle = 0
                x = machine_center_x + machine_radius_x * math.cos(angle)
                y = machine_center_y + machine_radius_y * math.sin(angle)
                
                # Move to start with laser off
                cmd = f"G0 X{x:.3f} Y{y:.3f} F{draw_speed}\n"
                ser.write(cmd.encode())
                ser.flush()
                response = ser.readline().decode().strip()
                print(f"Sent: {cmd.strip()}, Received: {response}")
                
                # Turn on laser only if laser is active
                if laser_active_var.get():
                    cmd = f"M3 S{laser_power}\n"
                    ser.write(cmd.encode())
                    ser.flush()
                    response = ser.readline().decode().strip()
                    print(f"Sent: {cmd.strip()}, Received: {response}")
                
                # Draw the circle
                for i in range(num_segments + 1):
                    angle = 2 * math.pi * i / num_segments
                    x = machine_center_x + machine_radius_x * math.cos(angle)
                    y = machine_center_y + machine_radius_y * math.sin(angle)
                    cmd = f"G1 X{x:.3f} Y{y:.3f} F{draw_speed}\n"
                    ser.write(cmd.encode())
                    ser.flush()
                    response = ser.readline().decode().strip()
                    print(f"Sent: {cmd.strip()}, Received: {response}")
                    time.sleep(0.02)
                
                # Turn off laser if it was turned on
                if laser_active_var.get():
                    cmd = "M5\n"
                    ser.write(cmd.encode())
                    ser.flush()
                    response = ser.readline().decode().strip()
                    print(f"Sent: {cmd.strip()}, Received: {response}")
                
                # Raise Z if active
                if z_axis_active_var.get():
                    cmd = f"G1 Z{z_Travel} F{draw_speed}\n"
                    ser.write(cmd.encode())
                    ser.flush()
                    response = ser.readline().decode().strip()
                    print(f"Sent: {cmd.strip()}, Received: {response}")
                    time.sleep(0.1)
            
            elif shape_type == 'rectangle':
                # Get corners
                x1, y1, x2, y2 = coords
                # Convert to machine coordinates
                machine_x1 = (x1 * bed_max_x) / canvas_width
                machine_y1 = bed_max_y - ((y1 * bed_max_y) / canvas_height)
                machine_x2 = (x2 * bed_max_x) / canvas_width
                machine_y2 = bed_max_y - ((y2 * bed_max_y) / canvas_height)
                
                # Move to first corner
                cmd = f"G0 X{machine_x1:.3f} Y{machine_y1:.3f} F{draw_speed}\n"
                ser.write(cmd.encode())
                ser.flush()
                response = ser.readline().decode().strip()
                print(f"Sent: {cmd.strip()}, Received: {response}")
                
                # Lower Z if active
                if z_axis_active_var.get():
                    cmd = f"G1 Z{z_Draw} F{draw_speed}\n"
                    ser.write(cmd.encode())
                    ser.flush()
                    response = ser.readline().decode().strip()
                    print(f"Sent: {cmd.strip()}, Received: {response}")
                    time.sleep(0.1)
                
                # Turn on laser
                if laser_active_var.get():
                    cmd = f"M3 S{laser_power}\n"
                    ser.write(cmd.encode())
                    ser.flush()
                    response = ser.readline().decode().strip()
                    print(f"Sent: {cmd.strip()}, Received: {response}")
                
                # Draw rectangle (4 lines)
                corners = [
                    (machine_x2, machine_y1),  # Top right
                    (machine_x2, machine_y2),  # Bottom right
                    (machine_x1, machine_y2),  # Bottom left
                    (machine_x1, machine_y1)   # Back to start
                ]
                
                for x, y in corners:
                    cmd = f"G1 X{x:.3f} Y{y:.3f} F{draw_speed}\n"
                    ser.write(cmd.encode())
                    ser.flush()
                    response = ser.readline().decode().strip()
                    print(f"Sent: {cmd.strip()}, Received: {response}")
                    time.sleep(0.05)
                
            elif shape_type == 'polygon':
                # Get all points
                points = []
                for i in range(0, len(coords), 2):
                    x = (coords[i] * bed_max_x) / canvas_width
                    y = bed_max_y - ((coords[i+1] * bed_max_y) / canvas_height)
                    points.append((x, y))
                
                # Move to first point
                first_x, first_y = points[0]
                cmd = f"G0 X{first_x:.3f} Y{first_y:.3f} F{draw_speed}\n"
                ser.write(cmd.encode())
                ser.flush()
                response = ser.readline().decode().strip()
                print(f"Sent: {cmd.strip()}, Received: {response}")
                
                # Lower Z if active
                if z_axis_active_var.get():
                    cmd = f"G1 Z{z_Draw} F{draw_speed}\n"
                    ser.write(cmd.encode())
                    ser.flush()
                    response = ser.readline().decode().strip()
                    print(f"Sent: {cmd.strip()}, Received: {response}")
                    time.sleep(0.1)
                
                # Turn on laser
                if laser_active_var.get():
                    cmd = f"M3 S{laser_power}\n"
                    ser.write(cmd.encode())
                    ser.flush()
                    response = ser.readline().decode().strip()
                    print(f"Sent: {cmd.strip()}, Received: {response}")
                
                # Draw all sides including closing the shape
                for point in points[1:] + [points[0]]:  # Add first point again to close the shape
                    x, y = point
                    cmd = f"G1 X{x:.3f} Y{y:.3f} F{draw_speed}\n"
                    ser.write(cmd.encode())
                    ser.flush()
                    response = ser.readline().decode().strip()
                    print(f"Sent: {cmd.strip()}, Received: {response}")
                    time.sleep(0.05)
                
            elif len(objects) > 1 and shape_type == 'line':  # Freehand shapes
                # Collect all points first
                points = []
                for obj in objects:
                    coords = cv.coords(obj)
                    if not points:  # First point
                        x = (coords[0] * bed_max_x) / canvas_width
                        y = bed_max_y - ((coords[1] * bed_max_y) / canvas_height)
                        points.append((x, y))
                    # Add end point of each segment
                    x = (coords[2] * bed_max_x) / canvas_width
                    y = bed_max_y - ((coords[3] * bed_max_y) / canvas_height)
                    points.append((x, y))
                
                if not points:
                    continue
                
                # Move to start position with laser off
                start_x, start_y = points[0]
                cmd = f"G0 X{start_x:.3f} Y{start_y:.3f} F{draw_speed}\n"
                ser.write(cmd.encode())
                ser.flush()
                response = ser.readline().decode().strip()
                print(f"Sent: {cmd.strip()}, Received: {response}")
                
                # Lower Z if active
                if z_axis_active_var.get():
                    cmd = f"G1 Z{z_Draw} F{draw_speed}\n"
                    ser.write(cmd.encode())
                    ser.flush()
                    response = ser.readline().decode().strip()
                    print(f"Sent: {cmd.strip()}, Received: {response}")
                    time.sleep(0.1)
                
                # Turn on laser
                if laser_active_var.get():
                    cmd = f"M3 S{laser_power}\n"
                    ser.write(cmd.encode())
                    ser.flush()
                    response = ser.readline().decode().strip()
                    print(f"Sent: {cmd.strip()}, Received: {response}")
                
                # Draw all points in one continuous motion
                # Buffer all movement commands first
                movement_commands = []
                for x, y in points[1:]:
                    movement_commands.append(f"G1 X{x:.3f} Y{y:.3f} F{draw_speed}\n")
                
                # Send all movement commands in quick succession
                for cmd in movement_commands:
                    ser.write(cmd.encode())
                    ser.flush()
                    ser.readline()  # Read response but don't process it to maintain speed
                
                # Turn off laser
                if laser_active_var.get():
                    cmd = "M5\n"
                    ser.write(cmd.encode())
                    ser.flush()
                    response = ser.readline().decode().strip()
                    print(f"Sent: {cmd.strip()}, Received: {response}")
                
                # Raise Z if active
                if z_axis_active_var.get():
                    cmd = f"G1 Z{z_Travel} F{draw_speed}\n"
                    ser.write(cmd.encode())
                    ser.flush()
                    response = ser.readline().decode().strip()
                    print(f"Sent: {cmd.strip()}, Received: {response}")
                    time.sleep(0.1)
            
            elif shape_type == 'arc':
                # Get arc properties
                x1, y1, x2, y2 = coords
                start_angle = float(cv.itemcget(first_obj, 'start'))
                extent = float(cv.itemcget(first_obj, 'extent'))
                
                # Calculate center and radius
                center_x = (x1 + x2) / 2
                center_y = (y1 + y2) / 2
                radius_x = abs(x2 - x1) / 2
                radius_y = abs(y2 - y1) / 2
                
                # Convert to machine coordinates
                machine_center_x = (center_x * bed_max_x) / canvas_width
                machine_center_y = bed_max_y - ((center_y * bed_max_y) / canvas_height)
                machine_radius_x = (radius_x * bed_max_x) / canvas_width
                machine_radius_y = (radius_y * bed_max_y) / canvas_height
                
                # Move to start position
                start_angle_rad = math.radians(start_angle)
                start_x = machine_center_x + machine_radius_x * math.cos(start_angle_rad)
                start_y = machine_center_y + machine_radius_y * math.sin(start_angle_rad)
                
                cmd = f"G0 X{start_x:.3f} Y{start_y:.3f} F{draw_speed}\n"
                ser.write(cmd.encode())
                ser.flush()
                response = ser.readline().decode().strip()
                print(f"Sent: {cmd.strip()}, Received: {response}")
                
                # Lower Z if active
                if z_axis_active_var.get():
                    cmd = f"G1 Z{z_Draw} F{draw_speed}\n"
                    ser.write(cmd.encode())
                    ser.flush()
                    response = ser.readline().decode().strip()
                    print(f"Sent: {cmd.strip()}, Received: {response}")
                    time.sleep(0.1)
                
                # Turn on laser
                if laser_active_var.get():
                    cmd = f"M3 S{laser_power}\n"
                    ser.write(cmd.encode())
                    ser.flush()
                    response = ser.readline().decode().strip()
                    print(f"Sent: {cmd.strip()}, Received: {response}")
                
                # Draw arc using small segments
                num_segments = max(36, int(abs(extent) / 5))  # More segments for larger arcs
                
                # Move to start position first with laser off
                angle_rad = math.radians(start_angle)
                x = machine_center_x + machine_radius_x * math.cos(angle_rad)
                y = machine_center_y + machine_radius_y * math.sin(angle_rad)
                
                # Move to start
                cmd = f"G0 X{x:.3f} Y{y:.3f} F{draw_speed}\n"
                ser.write(cmd.encode())
                ser.flush()
                response = ser.readline().decode().strip()
                print(f"Sent: {cmd.strip()}, Received: {response}")
                
                # Turn on laser only if laser is active
                if laser_active_var.get():
                    cmd = f"M3 S{laser_power}\n"
                    ser.write(cmd.encode())
                    ser.flush()
                    response = ser.readline().decode().strip()
                    print(f"Sent: {cmd.strip()}, Received: {response}")
                
                # Draw the arc
                for i in range(num_segments + 1):
                    angle_rad = math.radians(start_angle + (extent * i / num_segments))
                    x = machine_center_x + machine_radius_x * math.cos(angle_rad)
                    y = machine_center_y + machine_radius_y * math.sin(angle_rad)
                    cmd = f"G1 X{x:.3f} Y{y:.3f} F{draw_speed}\n"
                    ser.write(cmd.encode())
                    ser.flush()
                    response = ser.readline().decode().strip()
                    print(f"Sent: {cmd.strip()}, Received: {response}")
                    time.sleep(0.02)
                
                # Turn off laser if it was turned on
                if laser_active_var.get():
                    cmd = "M5\n"
                    ser.write(cmd.encode())
                    ser.flush()
                    response = ser.readline().decode().strip()
                    print(f"Sent: {cmd.strip()}, Received: {response}")
                
                # Raise Z if active
                if z_axis_active_var.get():
                    cmd = f"G1 Z{z_Travel} F{draw_speed}\n"
                    ser.write(cmd.encode())
                    ser.flush()
                    response = ser.readline().decode().strip()
                    print(f"Sent: {cmd.strip()}, Received: {response}")
                    time.sleep(0.1)
            
            else:  # Single line or other shape
                # For lines and other shapes, move to each point
                for i in range(0, len(coords), 2):
                    x = (coords[i] * bed_max_x) / canvas_width
                    y = bed_max_y - ((coords[i+1] * bed_max_y) / canvas_height)  # Y is inverted
                    
                    # First point: move quickly without laser
                    if i == 0:
                        cmd = f"G0 X{x:.3f} Y{y:.3f} F{draw_speed}\n"
                        ser.write(cmd.encode())
                        ser.flush()
                        response = ser.readline().decode().strip()
                        print(f"Sent: {cmd.strip()}, Received: {response}")
                        
                        # Lower Z if active
                        if z_axis_active_var.get():
                            cmd = f"G1 Z{z_Draw} F{draw_speed}\n"
                            ser.write(cmd.encode())
                            ser.flush()
                            response = ser.readline().decode().strip()
                            print(f"Sent: {cmd.strip()}, Received: {response}")
                            time.sleep(0.1)
                        
                        # Turn on laser
                        if laser_active_var.get():
                            cmd = f"M3 S{laser_power}\n"
                            ser.write(cmd.encode())
                            ser.flush()
                            response = ser.readline().decode().strip()
                            print(f"Sent: {cmd.strip()}, Received: {response}")
                    else:
                        # Draw line to next point
                        cmd = f"G1 X{x:.3f} Y{y:.3f} F{draw_speed}\n"
                        ser.write(cmd.encode())
                        ser.flush()
                        response = ser.readline().decode().strip()
                        print(f"Sent: {cmd.strip()}, Received: {response}")
                        time.sleep(0.05)
            
            # Turn off laser and lift Z after shape
            cmd = "M5\n"
            ser.write(cmd.encode())
            ser.flush()
            response = ser.readline().decode().strip()
            print(f"Sent: {cmd.strip()}, Received: {response}")
            
            if z_axis_active_var.get():
                cmd = f"G1 Z{z_Travel} F{draw_speed}\n"
                ser.write(cmd.encode())
                ser.flush()
                response = ser.readline().decode().strip()
                print(f"Sent: {cmd.strip()}, Received: {response}")
                time.sleep(0.1)
    
    # Return to origin
    cmd = "M5\n"
    ser.write(cmd.encode())
    ser.flush()
    response = ser.readline().decode().strip()
    print(f"Sent: {cmd.strip()}, Received: {response}")
    
    if z_axis_active_var.get():
        cmd = f"G1 Z{z_Travel} F{draw_speed}\n"
        ser.write(cmd.encode())
        ser.flush()
        response = ser.readline().decode().strip()
        print(f"Sent: {cmd.strip()}, Received: {response}")
        time.sleep(0.1)
    
    cmd = f"G0 X0 Y0 F{draw_speed}\n"
    ser.write(cmd.encode())
    ser.flush()
    response = ser.readline().decode().strip()
    print(f"Sent: {cmd.strip()}, Received: {response}")
    
    print("Engraving completed successfully")
    messagebox.showinfo("Success", f"Completed {layers} layers")