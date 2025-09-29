import serial
import tkinter as tk
from tkinter import ttk
from tkinter import messagebox
from tkinter import filedialog
from tkinter import simpledialog
import threading

class CNCControlApp:
    def __init__(self, root):
        self.root = root
        self.root.title("CNC Control App")
        
        self.setup_serial()
        self.create_ui()
        
        self.relative_mode = False  # Initial mode is absolute
        self.step_size = 5.0  # Default step size in mm
        self.speed = 5000  # Default movement speed in units per minute
        self.current_x = 0.0  # Current X-axis position
        self.current_y = 0.0  # Current Y-axis position
        self.current_z = 0.0  # Current Z-axis position
        self.update_coordinate_label()


        # Bind arrow keys to control X and Y axes
        # Bind arrow keys to control X and Y axes
        self.root.bind("<Left>", lambda event: self.move("left"))
        self.root.bind("<Right>", lambda event: self.move("right"))
        self.root.bind("<Up>", lambda event: self.move("up"))
        self.root.bind("<Down>", lambda event: self.move("down"))


        # Bind Page_Up and Page_Down keys to Z-axis movement
        self.root.bind("<Home>", lambda event: self.move_z("Zup"))
        self.root.bind("<End>", lambda event: self.move_z("Zdown"))
        
        # Start the coordinate update loop
        # Start the coordinate update loop
        self.root.after(200, self.update_coordinates)  # Start the coordinate update loop


    def setup_serial(self):
        self.serial_port = serial.Serial('COM7', 115200)
        
    def send_gcode(self):
        gcode_line = self.gcode_entry.get()
        #self.send_command(gcode_line)
        threading.Thread(target=self.send_command, args=(gcode_line,)).start()

    def send_home(self):
        gcode_home = "G28"  # Marlin G-code for homing
        self.send_command(gcode_home)
        # After homing, reset coordinates to 0,0,0
        self.current_x = 0.0
        self.current_y = 0.0
        self.current_z = 0.0
        self.update_coordinate_label()
        
    def toggle_mode(self):
        self.relative_mode = not self.relative_mode
        mode_text = "Relative" if self.relative_mode else "Absolute"
        self.mode_button.config(text=f"Switch to {mode_text} Mode")

    def abort(self):
        self.send_command("M112")  # Send emergency stop command

    def send_command(self, gcode_line):
        if self.relative_mode:
            gcode_line = "G91\n" + gcode_line + "\nG90\n"  # Wrap the command with relative mode codes
        try:
            self.serial_port.write(gcode_line.encode() + b'\n')
            self.serial_port.flush()
            #messagebox.showinfo("Success", "Command sent successfully!")
        except serial.SerialException as e:
            messagebox.showerror("Error", f"Serial communication error: {e}")
            
            
    def open_gcode_file(self):
        file_path = filedialog.askopenfilename(filetypes=[("G-code Files", "*.gcode")])
        if file_path:
            try:
                with open(file_path, 'r') as f:
                    gcode_lines = f.readlines()
                    for line in gcode_lines:
                        self.send_command(line.strip())
            except Exception as e:
                messagebox.showerror("Error", f"Error opening or sending G-code file: {e}")

    def update_coordinates(self):
        gcode_query = "M114"  # G-code to request current position
        try:
            self.send_command(gcode_query)
        except serial.SerialException as e:
            print(f"Error sending coordinate request: {e}")
        self.root.after(200, self.update_coordinates)  # Schedule the next update

        
    def parse_coordinates(self, response):
        if "X:" in response and "Y:" in response and "Z:" in response:
            parts = response.split(" ")
            for part in parts:
                if part.startswith("X:"):
                    self.current_x = float(part[2:])
                elif part.startswith("Y:"):
                    self.current_y = float(part[2:])
                elif part.startswith("Z:"):
                    self.current_z = float(part[2:])
            self.update_coordinate_label()  # Update the coordinate label

    def update_coordinate_label(self):
            self.coordinate_label.config(text=f"Current Position: X={self.current_x:.2f} Y={self.current_y:.2f} Z={self.current_z:.2f}")



          
    def move(self, direction):
        gcode_command = ""
        if direction == "up":
            gcode_command = f"G1 Y{self.step_size} F{self.speed}"
            #new_y = self.current_y + self.step_size
        elif direction == "down":
            gcode_command = f"G1 Y-{self.step_size} F{self.speed}"
        elif direction == "left":
            gcode_command = f"G1 X-{self.step_size} F{self.speed}"
        elif direction == "right":
            gcode_command = f"G1 X{self.step_size} F{self.speed}"
    # Print the generated G-code command
        print("Generated G-code command:", gcode_command)
        self.send_command(gcode_command)
        

        
        self.update_coordinate_label()

    def set_step_size(self):
        new_step_size = simpledialog.askfloat("Step Size", "Enter step size in mm:")
        if new_step_size is not None:
            self.step_size = new_step_size

    def set_speed(self):
        new_speed = simpledialog.askinteger("Speed", "Enter movement speed (units per minute):")
        if new_speed is not None:
            self.speed = new_speed
    
    
    def move_z(self, direction):
        gcode_command = ""
        if direction == "Zup":
            gcode_command = f"G1 Z{self.step_size} F{self.speed}"
        elif direction == "Zdown":
            gcode_command = f"G1 Z-{self.step_size} F{self.speed}"
        self.send_command(gcode_command)
        self.update_coordinate_label()   


    def create_ui(self):
        self.coordinate_label = ttk.Label(self.root, text="Current Position: X=0.00 Y=0.00 Z=0.00")
        self.coordinate_label.pack(pady=10)
        self.gcode_label = ttk.Label(self.root, text="Enter G-code command:")
        self.gcode_entry = ttk.Entry(self.root, width=40)
        self.send_button = ttk.Button(self.root, text="Send G-code", command=self.send_gcode)
        self.home_button = ttk.Button(self.root, text="Home", command=self.send_home)
        self.mode_button = ttk.Button(self.root, text="Switch to Relative Mode", command=self.toggle_mode)
        self.open_file_button = ttk.Button(self.root, text="Open G-code File", command=self.open_gcode_file)
        self.step_button = ttk.Button(self.root, text="Set Step Size", command=self.set_step_size)
        self.speed_button = ttk.Button(self.root, text="Set Speed", command=self.set_speed)

        # Place all buttons in a consistent order
        self.open_file_button.pack(pady=5)
        self.gcode_label.pack(pady=10)
        self.gcode_entry.pack(pady=5)
        self.send_button.pack(pady=10)
        self.home_button.pack(pady=5)
        self.mode_button.pack(pady=5)

        self.up_button = ttk.Button(self.root, text="Y+Up", command=lambda: self.move("up"))
        self.down_button = ttk.Button(self.root, text="Y-Down", command=lambda: self.move("down"))
        self.left_button = ttk.Button(self.root, text="X-Left", command=lambda: self.move("left"))
        self.right_button = ttk.Button(self.root, text="X+Right", command=lambda: self.move("right"))
        self.abort_button = ttk.Button(self.root, text="Abort", command=self.abort)


        self.up_button.pack(pady=5)
        self.down_button.pack(pady=5)
        self.left_button.pack(pady=5)
        self.right_button.pack(pady=5)
        self.step_button.pack(pady=5)
        self.abort_button.pack(pady=5)
        self.speed_button.pack(pady=5)
        
        
        self.z_plus_button = ttk.Button(self.root, text="Z+", command=lambda: self.move_z("Zup"))
        self.z_minus_button = ttk.Button(self.root, text="Z-", command=lambda: self.move_z("Zdown"))
        
        self.z_plus_button.pack(pady=5)
        self.z_minus_button.pack(pady=5)



if __name__ == "__main__":
    root = tk.Tk()
    app = CNCControlApp(root)
    #app.update_coordinates()  # Start the coordinate update loop
    root.mainloop()


