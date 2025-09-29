from tkinter import messagebox
import time
import math

# Global variables
cv = None  # Canvas
ser = None  # Serial connection
active_tool = None

# UI Elements
draw_speed_input = None
laser_power_input = None
layers_input = None
z_axis_active_var = None
laser_active_var = None

def set_globals(canvas, serial, tool):
    global cv, ser, active_tool
    cv = canvas
    ser = serial
    active_tool = tool

def set_ui_elements(speed_input, power_input, layer_input, z_active, laser_active):
    global draw_speed_input, laser_power_input, layers_input, z_axis_active_var, laser_active_var
    draw_speed_input = speed_input
    laser_power_input = power_input
    layers_input = layer_input
    z_axis_active_var = z_active
    laser_active_var = laser_active

def send_command(serial, cmd, wait_time=0):
    """Send a single command and wait for completion"""
    if not cmd.endswith('\n'):
        cmd += '\n'
    
    # Clear any pending responses
    while serial.in_waiting:
        serial.readline()
    
    # Send the command
    serial.write(cmd.encode())
    serial.flush()
    
    # Wait for and verify response
    response = serial.readline().decode().strip()
    if not response:
        # If no response, try waiting a bit longer
        time.sleep(0.1)
        response = serial.readline().decode().strip()
    
    print(f"Sent: {cmd.strip()}, Received: {response}")
    
    # Add extra wait time for certain commands at low speeds
    if wait_time > 0:
        time.sleep(wait_time)
    
    return response == 'ok'

def send_buffered_commands(serial, commands, draw_speed):
    """Send a batch of commands with proper buffering and flow control"""
    buffer_size = 0
    max_buffer = 8  # Reduced buffer size for better control
    
    for cmd in commands:
        # Wait if buffer is full
        while buffer_size >= max_buffer:
            response = serial.readline().decode().strip()
            if response == 'ok':
                buffer_size -= 1
            elif response:
                print(f"Received: {response}")
        
        # Send command
        if not cmd.endswith('\n'):
            cmd += '\n'
        serial.write(cmd.encode())
        buffer_size += 1
    
    # Wait for remaining commands to complete
    while buffer_size > 0:
        response = serial.readline().decode().strip()
        if response == 'ok':
            buffer_size -= 1
        elif response:
            print(f"Received: {response}")

def generate_shape_commands(shape_type, coords, canvas_width, canvas_height, bed_max_x, bed_max_y, 
                          draw_speed, laser_power, z_Draw, z_Travel, laser_active, z_active, canvas=None, first_obj=None):
    """Generate commands for a shape without sending them"""
    commands = []
    
    # Always start with laser off and Z up for safety
    commands.append("M5")
    if z_active:
        commands.append(f"G1 Z{z_Travel} F{draw_speed}")
    
    if shape_type == 'line' or shape_type == 'polygon' or shape_type == 'rectangle':
        # For rectangle, convert the two points into four corners
        if shape_type == 'rectangle':
            x1, y1, x2, y2 = coords
            coords = [
                x1, y1,  # Top-left
                x2, y1,  # Top-right
                x2, y2,  # Bottom-right
                x1, y2   # Bottom-left
            ]
        
        # Convert all points first
        points = []
        for i in range(0, len(coords), 2):
            x = (coords[i] * bed_max_x) / canvas_width
            y = bed_max_y - ((coords[i+1] * bed_max_y) / canvas_height)
            points.append((x, y))
        
        # Move to start
        x, y = points[0]
        commands.append(f"G0 X{x:.3f} Y{y:.3f} F{draw_speed}")
        
        # Lower Z and turn on laser
        if z_active:
            commands.append(f"G1 Z{z_Draw} F{draw_speed}")
        if laser_active:
            commands.append(f"M3 S{laser_power}")
        
        # Draw all points
        for x, y in points[1:]:
            commands.append(f"G1 X{x:.3f} Y{y:.3f} F{draw_speed}")
            
        # If it's a polygon or rectangle, close the shape by returning to start point
        if (shape_type == 'polygon' or shape_type == 'rectangle') and len(points) > 2:
            x, y = points[0]  # Get the starting point
            commands.append(f"G1 X{x:.3f} Y{y:.3f} F{draw_speed}")
    
    elif shape_type == 'oval':
        # Calculate circle parameters
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
        
        # Move to start
        start_x = machine_center_x + machine_radius_x
        start_y = machine_center_y
        commands.append(f"G0 X{start_x:.3f} Y{start_y:.3f} F{draw_speed}")
        
        # Lower Z and turn on laser
        if z_active:
            commands.append(f"G1 Z{z_Draw} F{draw_speed}")
        if laser_active:
            commands.append(f"M3 S{laser_power}")
        
        # Generate circle points
        num_segments = 72
        for i in range(num_segments + 1):
            angle = 2 * math.pi * i / num_segments
            x = machine_center_x + machine_radius_x * math.cos(angle)
            y = machine_center_y + machine_radius_y * math.sin(angle)
            commands.append(f"G1 X{x:.3f} Y{y:.3f} F{draw_speed}")
    
    elif shape_type == 'arc':
        # Get arc properties
        x1, y1, x2, y2 = coords
        start_angle = float(canvas.itemcget(first_obj, 'start'))
        extent = float(canvas.itemcget(first_obj, 'extent'))
        
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
        
        # Calculate start position
        start_angle_rad = math.radians(start_angle)
        start_x = machine_center_x + machine_radius_x * math.cos(start_angle_rad)
        start_y = machine_center_y + machine_radius_y * math.sin(start_angle_rad)
        
        # Move to start position
        commands.append(f"G0 X{start_x:.3f} Y{start_y:.3f} F{draw_speed}")
        
        # Lower Z if active
        if z_active:
            commands.append(f"G1 Z{z_Draw} F{draw_speed}")
        
        # Turn on laser
        if laser_active:
            commands.append(f"M3 S{laser_power}")
        
        # Draw arc using small segments with proper waits
        num_segments = max(36, int(abs(extent) / 5))  # Use 36 segments for small arcs
        for i in range(num_segments + 1):
            angle_rad = math.radians(start_angle + (extent * i / num_segments))
            x = machine_center_x + machine_radius_x * math.cos(angle_rad)
            y = machine_center_y + machine_radius_y * math.sin(angle_rad)
            commands.append(f"G1 X{x:.3f} Y{y:.3f} F{draw_speed}")
        
        # Turn off laser and raise Z
        commands.append("M5")
        if z_active:
            commands.append(f"G1 Z{z_Travel} F{draw_speed}")
    
    # Always end with laser off and Z up
    commands.append("M5")
    if z_active:
        commands.append(f"G1 Z{z_Travel} F{draw_speed}")
    
    return commands

def home_machine(serial, z_active=False, z_travel=None):
    """Home the machine safely"""
    if not serial or not serial.is_open:
        return False
    
    # Ensure laser is off
    send_command(serial, "M5")
    
    # If Z is active, move it to safe height first
    if z_active and z_travel is not None:
        send_command(serial, f"G1 Z{z_travel} F1000", 0.2)
    
    # Return to origin
    send_command(serial, "G0 X0 Y0 F1000", 0.1)
    return True

def Engrave(cv=None, ser=None, draw_speed_input=None, laser_power_input=None, layers_input=None, 
            laser_active_var=None, z_axis_active_var=None):
    # Use parameters if provided, otherwise use globals
    canvas = cv if cv is not None else globals()['cv']
    serial = ser if ser is not None else globals()['ser']
    speed_input = draw_speed_input if draw_speed_input is not None else globals()['draw_speed_input']
    power_input = laser_power_input if laser_power_input is not None else globals()['laser_power_input']
    layer_input = layers_input if layers_input is not None else globals()['layers_input']
    laser_active = laser_active_var.get() if laser_active_var is not None else globals()['laser_active_var'].get()
    z_active = z_axis_active_var.get() if z_axis_active_var is not None else globals()['z_axis_active_var'].get()
    
    if not serial or not serial.is_open:
        messagebox.showerror("Error", "Please connect to the machine first")
        return
    
    # Get machine settings
    from config3 import bed_max_x, bed_max_y, zDraw as z_Draw, zLift as z_Lift, zTravel as z_Travel
    
    try:
        draw_speed = int(speed_input.get("1.0", "end-1c")) if speed_input.get("1.0", "end-1c").strip() else 1000
        laser_power = int(power_input.get("1.0", "end-1c")) if power_input.get("1.0", "end-1c").strip() else 1000
        layers = int(layer_input.get("1.0", "end-1c"))
        
        # Calculate wait times based on speed
        movement_wait = 0.05 if draw_speed < 500 else 0
        z_wait = 0.2 if draw_speed < 500 else 0.1
        laser_wait = 0.1 if draw_speed < 500 else 0
        
    except ValueError:
        messagebox.showerror("Error", "Please enter valid numbers for speed, power and layers")
        return

    print("Starting engraving process...")
    
    # Initialize machine with proper waits
    send_command(serial, "M5")  # Ensure laser is off
    send_command(serial, "G21")  # Set units to mm
    send_command(serial, "G90")  # Absolute positioning
    send_command(serial, "G92 X0 Y0")  # Set current position as origin
    send_command(serial, f"G1 F{draw_speed}")  # Set feed rate
    if z_active:
        send_command(serial, f"G1 Z{z_Travel}", z_wait)  # Move to safe height
    
    # Get canvas dimensions
    canvas_width = canvas.winfo_width()
    canvas_height = canvas.winfo_height()
    
    # Get all objects with all_lines tag
    all_objects = canvas.find_withtag('all_lines')
    
    if not all_objects:
        print("No objects found to engrave")
        # Home the machine before returning
        home_machine(serial, z_active, z_Travel)
        messagebox.showwarning("Warning", "No objects found to engrave")
        return
    
    # Group objects by shape_id
    shapes = {}
    for obj in all_objects:
        tags = canvas.gettags(obj)
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
            shapes[f"single_{obj}"] = [obj]
    
    # Process each layer
    for layer in range(layers):
        print(f"\nProcessing layer {layer + 1}/{layers}")
        
        # Process each shape
        for shape_id, objects in shapes.items():
            print(f"\nProcessing shape {shape_id}")
            
            # Get first object to determine shape type
            first_obj = objects[0]
            shape_type = canvas.type(first_obj)
            
            # Ensure laser is off and Z is up before moving to new shape
            send_command(serial, "M5")
            if z_active:
                send_command(serial, f"G1 Z{z_Travel}", z_wait)
            
            if shape_type in ['line', 'polygon', 'rectangle']:
                # For lines and polygons, we need to process all objects in order
                all_coords = []
                for obj in objects:
                    coords = canvas.coords(obj)
                    if not coords:
                        continue
                    
                    # For the first point of each object after the first,
                    # check if it connects to the last point of the previous object
                    if all_coords:
                        last_x, last_y = all_coords[-2:]
                        curr_x1, curr_y1 = coords[0], coords[1]
                        curr_x2, curr_y2 = coords[2], coords[3]
                        
                        # If the start point is closer to the last point, use coords as is
                        # Otherwise, reverse the coordinates
                        dist_start = math.sqrt((curr_x1 - last_x)**2 + (curr_y1 - last_y)**2)
                        dist_end = math.sqrt((curr_x2 - last_x)**2 + (curr_y2 - last_y)**2)
                        
                        if dist_end < dist_start:
                            coords = [curr_x2, curr_y2, curr_x1, curr_y1]
                    
                    all_coords.extend(coords)
                
                if all_coords:
                    commands = generate_shape_commands(
                        shape_type, all_coords, canvas_width, canvas_height,
                        bed_max_x, bed_max_y, draw_speed, laser_power,
                        z_Draw, z_Travel, laser_active, z_active
                    )
                    
                    # Send each command with appropriate waits
                    for cmd in commands:
                        if cmd.startswith('G0'):  # Rapid move
                            send_command(serial, cmd, movement_wait)
                        elif cmd.startswith('G1 Z'):  # Z movement
                            send_command(serial, cmd, z_wait)
                        elif cmd.startswith('M3'):  # Laser on
                            send_command(serial, cmd, laser_wait)
                        elif cmd.startswith('M5'):  # Laser off
                            send_command(serial, cmd)
                        else:  # Regular movement
                            send_command(serial, cmd, movement_wait)
            
            else:  # For other shapes (oval, arc), process each object individually
                for obj in objects:
                    coords = canvas.coords(obj)
                    if not coords:
                        continue
                    
                    commands = generate_shape_commands(
                        shape_type, coords, canvas_width, canvas_height,
                        bed_max_x, bed_max_y, draw_speed, laser_power,
                        z_Draw, z_Travel, laser_active, z_active,
                        canvas=canvas, first_obj=obj
                    )
                    
                    # Send each command with appropriate waits
                    for cmd in commands:
                        if cmd.startswith('G0'):  # Rapid move
                            send_command(serial, cmd, movement_wait)
                        elif cmd.startswith('G1 Z'):  # Z movement
                            send_command(serial, cmd, z_wait)
                        elif cmd.startswith('M3'):  # Laser on
                            send_command(serial, cmd, laser_wait)
                        elif cmd.startswith('M5'):  # Laser off
                            send_command(serial, cmd)
                        else:  # Regular movement
                            send_command(serial, cmd, movement_wait)

    # Return to origin with proper waits
    send_command(serial, "M5")
    if z_active:
        send_command(serial, f"G1 Z{z_Travel}", z_wait)
    send_command(serial, f"G0 X0 Y0", movement_wait)
    
    print("Engraving completed successfully")
    messagebox.showinfo("Success", f"Completed {layers} layers")