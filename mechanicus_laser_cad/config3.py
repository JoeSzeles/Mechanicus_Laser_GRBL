#!/usr/bin/env python
#config.py
import tkinter as tk
from tkinter import ttk
from tkinter import END
"""G-code emitted at the start of processing the SVG file"""
preamble = "G1 Z60"
"""G-code emitted at the end of processing the SVG file"""
postamble = "(postamble)"
"""G-code emitted before processing a SVG shape"""
shape_preamble = "G1 Z60"
#shape_preamble = "Z0"
"""G-code emitted after processing a SVG shape"""
shape_postamble = "G1 Z60"
#shape_postamble = "Z100)"
""" scale gcode to fit bed size"""
auto_scale = False
""" optimize path - slow for large files"""
optimise = True
"""
illustrator exports svg's in points, not mm
set to "mm" if you don't want to convert to mm
"""
Serial_connection = 'COM4'
Baud = 250000
coordinates='absolute'
units = "points"
line_speed = 2000
curve_speed = 2000
draw_speed = 2000
travel_speed = 2000
draw_height = 0
travel_height = 26
smoothness = 0.34
connect_tolerance = 0.001
laser_power = 1000
layer_height = 0.15
print_accel = 3000
travel_accel = 2000
max_jerk = 200
layers = 1
scaleF = 0.72
x_offset = 0
y_offset = 0
bed_max_x = 300 #410
bed_max_y = 300 #840
refill_pos = 150,10,20
zTravel = 3
zDraw = 0.0
zLift = 2
feed_rate = 3000
zrefill=20
refill_lenght= 200
Refill = False
zColor=18
z_start= 19
z_center=15
z_end=19
gradient_length_mm=8 #mm
#material_thickness = 19
