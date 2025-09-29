import tkinter as tk
import math
from snaptools import snap_to_endpoints, snap_to_midpoints, snap_to_centers

class DrawingTools:
    def __init__(self, root, canvas, brush, hexstr_var, snap_vars, grid_vars, serial_conn=None):
        self.root = root
        self.cv = canvas
        self.brush = brush
        self.hexstr = hexstr_var
        self.ser = serial_conn
        
        # Snap and grid variables
        self.snap_var = snap_vars['snap_var']
        self.snap_to_endpoints_var = snap_vars['snap_to_endpoints_var']
        self.snap_to_midpoints_var = snap_vars['snap_to_midpoints_var']
        self.snap_to_centers_var = snap_vars['snap_to_centers_var']
        self.grid_var = grid_vars['grid_var']
        self.grid_size_var = grid_vars['grid_size_var']
        
        # Tool state
        self.active_tool = None
        self.tool_buttons = {}
        self.current_shape_id = "shape_0"
        self.linecount = 0
        self.lastx = None
        self.lasty = None
        self.current_line = None
        self.current_circle = None
        self.current_rectangle = None
        self.current_polygon = None
        self.current_arc = None
        self.current_line_points = []
        
        # Selection state
        self.selected_line_id = None
        self.move_start_x = 0
        self.move_start_y = 0
        
        # Bindings
        self.cv.bind('<Motion>', self.update_snap_indicator)

    def get_snap_point(self, x, y, is_final=False):
        x = self.cv.canvasx(x)
        y = self.cv.canvasy(y)
        snap_x, snap_y = x, y
        found_snap = False
        
        if not found_snap and self.grid_var.get() and self.snap_var.get():
            try:
                scale_text = self.root.scale_var.get().rstrip('%')
                current_scale = float(scale_text) / 100.0
            except:
                current_scale = 1.0
            
            base_spacing = float(self.grid_size_var.get())
            scaled_spacing = base_spacing * current_scale
            
            snap_x = round(x / scaled_spacing) * scaled_spacing
            snap_y = round(y / scaled_spacing) * scaled_spacing
            found_snap = True
        
        return snap_x, snap_y

    def toggle_tool(self, tool_name):
        self.cv.delete('preview_line', 'snap_indicator', 'snap_label', 'start_marker')
        self.current_shape = None
        
        for btn_text, btn in self.tool_buttons.items():
            btn.configure(bg="#263d42")
        
        if tool_name == self.active_tool:
            self.active_tool = None
            self.unbind_all()
            return
        
        self.tool_buttons[tool_name].configure(bg="#00FF00")
        self.select_tool(tool_name.lower())

    def unbind_all(self):
        self.cv.unbind('<Button-1>')
        self.cv.unbind('<B1-Motion>')
        self.cv.unbind('<ButtonRelease-1>')

    def select_tool(self, tool_name):
        self.active_tool = tool_name
        self.unbind_all()
        
        if tool_name == 'line':
            self.cv.bind('<Button-1>', self.start_line)
            self.cv.bind('<B1-Motion>', self.update_line)
            self.cv.bind('<ButtonRelease-1>', self.end_line)
        elif tool_name == 'circle':
            self.cv.bind('<Button-1>', self.start_circle)
            self.cv.bind('<B1-Motion>', self.update_circle)
            self.cv.bind('<ButtonRelease-1>', self.finish_circle)
        elif tool_name == 'rectangle':
            self.cv.bind('<Button-1>', self.start_rectangle)
            self.cv.bind('<B1-Motion>', self.update_rectangle)
            self.cv.bind('<ButtonRelease-1>', self.finish_rectangle)
        elif tool_name == 'polygon':
            self.cv.bind('<Button-1>', self.start_polygon)
            self.cv.bind('<B1-Motion>', self.update_polygon)
            self.cv.bind('<ButtonRelease-1>', self.finish_polygon)
        elif tool_name == 'arc':
            self.cv.bind('<Button-1>', self.start_arc)
            self.cv.bind('<B1-Motion>', self.update_arc)
            self.cv.bind('<ButtonRelease-1>', self.finish_arc)
        elif tool_name == 'freehand':
            self.cv.bind('<Button-1>', self.start_freehand)
            self.cv.bind('<B1-Motion>', self.update_freehand)
            self.cv.bind('<ButtonRelease-1>', self.finish_freehand)

    def start_line(self, event):
        x, y = self.cv.canvasx(event.x), self.cv.canvasy(event.y)
        snap_x, snap_y = x, y
        snap_found = False
        
        if self.snap_to_endpoints_var.get():
            endpoint = snap_to_endpoints(self.cv, x, y, tolerance=40.0)
            if endpoint:
                snap_x, snap_y = endpoint
                snap_found = True
                self.show_snap_indicator(snap_x, snap_y, "Endpoint", 'red')
        
        if not snap_found and self.snap_to_midpoints_var.get():
            midpoint = snap_to_midpoints(self.cv, x, y, tolerance=40.0)
            if midpoint:
                snap_x, snap_y = midpoint
                snap_found = True
                self.show_snap_indicator(snap_x, snap_y, "Midpoint", '#0088FF')
        
        if not snap_found and self.snap_to_centers_var.get():
            center = snap_to_centers(self.cv, x, y, tolerance=40.0)
            if center:
                snap_x, snap_y = center
                snap_found = True
                self.show_snap_indicator(snap_x, snap_y, "Center", '#0088FF')
        
        if not snap_found and self.snap_var.get() and self.grid_var.get():
            snap_x, snap_y = self.get_snap_point(x, y, is_final=False)
            self.show_snap_indicator(snap_x, snap_y, "Grid", 'green')
        
        self.lastx, self.lasty = snap_x, snap_y
        self.current_shape_id = f"shape_{self.linecount}"
        
        self.cv.create_polygon(snap_x-6, snap_y+6, snap_x+6, snap_y+6, snap_x, snap_y-6,
                              fill='green', outline='white',
                              tags=('start_marker', 'above_all'))
        
        self.current_line = self.cv.create_line(snap_x, snap_y, snap_x, snap_y,
                                                fill='gray', dash=(4, 4),
                                                tags=('preview_line', 'above_all'))
        self.cv.tag_raise('above_all')

    def update_line(self, event):
        if self.lastx is not None and self.lasty is not None:
            x, y = self.cv.canvasx(event.x), self.cv.canvasy(event.y)
            snap_x, snap_y = x, y
            snap_found = False
            
            self.cv.delete('snap_indicator', 'preview_line')
            
            if self.snap_to_endpoints_var.get():
                endpoint = snap_to_endpoints(self.cv, x, y, tolerance=40.0)
                if endpoint:
                    snap_x, snap_y = endpoint
                    snap_found = True
                    self.show_snap_indicator(snap_x, snap_y, "Endpoint", 'red')
            
            if not snap_found and self.snap_to_midpoints_var.get():
                midpoint = snap_to_midpoints(self.cv, x, y, tolerance=40.0)
                if midpoint:
                    snap_x, snap_y = midpoint
                    snap_found = True
                    self.show_snap_indicator(snap_x, snap_y, "Midpoint", '#0088FF')
            
            if not snap_found and self.snap_to_centers_var.get():
                center = snap_to_centers(self.cv, x, y, tolerance=40.0)
                if center:
                    snap_x, snap_y = center
                    snap_found = True
                    self.show_snap_indicator(snap_x, snap_y, "Center", '#0088FF')
            
            if not snap_found and self.snap_var.get() and self.grid_var.get():
                snap_x, snap_y = self.get_snap_point(x, y, is_final=False)
            
            self.current_line = self.cv.create_line(self.lastx, self.lasty, snap_x, snap_y,
                                                    fill=self.hexstr.get(),
                                                    width=int(self.brush.get("1.0", "end-1c")),
                                                    tags='preview_line')
            self.cv.tag_raise('preview_line')
            self.cv.tag_raise('snap_indicator')
            self.cv.tag_raise('start_marker')

    def end_line(self, event):
        if self.lastx is not None and self.lasty is not None:
            x, y = self.cv.canvasx(event.x), self.cv.canvasy(event.y)
            snap_x, snap_y = x, y
            snap_found = False
            
            if self.snap_to_endpoints_var.get():
                endpoint = snap_to_endpoints(self.cv, x, y, tolerance=30.0)
                if endpoint:
                    snap_x, snap_y = endpoint
                    snap_found = True
            
            if not snap_found and self.snap_to_midpoints_var.get():
                midpoint = snap_to_midpoints(self.cv, x, y, tolerance=30.0)
                if midpoint:
                    snap_x, snap_y = midpoint
                    snap_found = True
            
            if not snap_found and self.snap_to_centers_var.get():
                center = snap_to_centers(self.cv, x, y, tolerance=30.0)
                if center:
                    snap_x, snap_y = center
                    snap_found = True
            
            if not snap_found and self.snap_var.get() and self.grid_var.get():
                snap_x, snap_y = self.get_snap_point(x, y, is_final=True)
            
            self.cv.create_line(self.lastx, self.lasty, snap_x, snap_y,
                                fill=self.hexstr.get(),
                                width=int(self.brush.get("1.0", "end-1c")),
                                tags=('all_lines', self.current_shape_id),
                                capstyle=tk.ROUND)
            
            self.cv.delete('preview_line', 'start_marker', 'snap_indicator')
            self.lastx = None
            self.lasty = None
            self.current_line = None
            self.linecount += 1
            self.root.save_canvas_state()

    def start_circle(self, event):
        x, y = self.cv.canvasx(event.x), self.cv.canvasy(event.y)
        if self.snap_to_endpoints_var.get():
            endpoint = snap_to_endpoints(self.cv, x, y, tolerance=20.0)
            if endpoint:
                x, y = endpoint
        elif self.snap_var.get() and self.grid_var.get():
            x, y = self.get_snap_point(x, y, is_final=True)
        
        self.lastx, self.lasty = x, y
        self.current_shape_id = f"shape_{self.linecount}"
        
        self.cv.create_oval(x-4, y-4, x+4, y+4,
                            fill='#00FF00', outline='white',
                            tags=('center_marker', 'above_all'))
        
        self.current_circle = self.cv.create_oval(x, y, x, y,
                                                  outline=self.hexstr.get(),
                                                  width=int(self.brush.get("1.0", "end-1c")),
                                                  tags=('all_lines', self.current_shape_id))
        self.cv.tag_raise('above_all')

    def update_circle(self, event):
        if self.current_circle:
            x, y = self.cv.canvasx(event.x), self.cv.canvasy(event.y)
            snap_x, snap_y = x, y
            
            if self.snap_to_endpoints_var.get():
                endpoint = snap_to_endpoints(self.cv, x, y, tolerance=20.0)
                if endpoint:
                    snap_x, snap_y = endpoint
                    self.show_snap_indicator(snap_x, snap_y, "Endpoint", 'red')
            
            if self.snap_var.get() and self.grid_var.get():
                snap_x, snap_y = self.get_snap_point(x, y, is_final=False)
            
            radius = ((snap_x - self.lastx) ** 2 + (snap_y - self.lasty) ** 2) ** 0.5
            self.cv.coords(self.current_circle,
                           self.lastx - radius, self.lasty - radius,
                           self.lastx + radius, self.lasty + radius)
            
            self.cv.delete('radius_marker')
            self.cv.create_oval(snap_x-4, snap_y-4, snap_x+4, snap_y+4,
                                fill='#FF0000', outline='white',
                                tags=('radius_marker', 'above_all'))
            self.cv.tag_raise('above_all')

    def finish_circle(self, event):
        if self.current_circle:
            x, y = self.cv.canvasx(event.x), self.cv.canvasy(event.y)
            snap_x, snap_y = x, y
            
            if self.snap_to_endpoints_var.get():
                endpoint = snap_to_endpoints(self.cv, x, y, tolerance=20.0)
                if endpoint:
                    snap_x, snap_y = endpoint
            elif self.snap_var.get() and self.grid_var.get():
                snap_x, snap_y = self.get_snap_point(x, y, is_final=True)
            
            radius = ((snap_x - self.lastx) ** 2 + (snap_y - self.lasty) ** 2) ** 0.5
            self.cv.coords(self.current_circle,
                           self.lastx - radius, self.lasty - radius,
                           self.lastx + radius, self.lasty + radius)
            
            self.cv.delete('radius_marker', 'center_marker', 'snap_indicator')
            self.linecount += 1
            self.current_circle = None
            self.root.save_canvas_state()

    def start_rectangle(self, event):
        x, y = self.cv.canvasx(event.x), self.cv.canvasy(event.y)
        if self.snap_to_endpoints_var.get():
            endpoint = snap_to_endpoints(self.cv, x, y, tolerance=20.0)
            if endpoint:
                x, y = endpoint
        elif self.snap_var.get() and self.grid_var.get():
            x, y = self.get_snap_point(x, y, is_final=True)
        
        self.lastx, self.lasty = x, y
        self.current_shape_id = f"shape_{self.linecount}"
        
        self.cv.create_oval(x-4, y-4, x+4, y+4,
                            fill='#00FF00', outline='white',
                            tags=('start_marker', 'above_all'))
        
        self.current_rectangle = self.cv.create_rectangle(x, y, x, y,
                                                          outline=self.hexstr.get(),
                                                          width=int(self.brush.get("1.0", "end-1c")),
                                                          tags=('all_lines', self.current_shape_id))
        self.cv.tag_raise('above_all')

    def update_rectangle(self, event):
        if self.current_rectangle:
            x, y = self.cv.canvasx(event.x), self.cv.canvasy(event.y)
            snap_x, snap_y = x, y
            
            if self.snap_to_endpoints_var.get():
                endpoint = snap_to_endpoints(self.cv, x, y, tolerance=20.0)
                if endpoint:
                    snap_x, snap_y = endpoint
                    self.show_snap_indicator(snap_x, snap_y, "Endpoint", 'red')
            
            if self.snap_var.get() and self.grid_var.get():
                snap_x, snap_y = self.get_snap_point(x, y, is_final=False)
            
            self.cv.coords(self.current_rectangle, self.lastx, self.lasty, snap_x, snap_y)
            self.cv.tag_raise('above_all')

    def finish_rectangle(self, event):
        if self.current_rectangle:
            x, y = self.cv.canvasx(event.x), self.cv.canvasy(event.y)
            snap_x, snap_y = x, y
            
            if self.snap_to_endpoints_var.get():
                endpoint = snap_to_endpoints(self.cv, x, y, tolerance=20.0)
                if endpoint:
                    snap_x, snap_y = endpoint
            elif self.snap_var.get() and self.grid_var.get():
                snap_x, snap_y = self.get_snap_point(x, y, is_final=True)
            
            self.cv.coords(self.current_rectangle, self.lastx, self.lasty, snap_x, snap_y)
            self.cv.delete('start_marker', 'snap_indicator')
            self.linecount += 1
            self.current_rectangle = None
            self.root.save_canvas_state()

    def start_polygon(self, event):
        x, y = self.cv.canvasx(event.x), self.cv.canvasy(event.y)
        if self.snap_to_endpoints_var.get():
            endpoint = snap_to_endpoints(self.cv, x, y, tolerance=20.0)
            if endpoint:
                x, y = endpoint
        elif self.snap_var.get() and self.grid_var.get():
            x, y = self.get_snap_point(x, y, is_final=True)
        
        self.lastx, self.lasty = x, y
        self.current_shape_id = f"shape_{self.linecount}"
        
        self.cv.create_oval(x-4, y-4, x+4, y+4,
                            fill='#00FF00', outline='white',
                            tags=('start_marker', 'above_all'))
        
        self.current_polygon = self.cv.create_polygon([x, y, x, y],
                                                      outline=self.hexstr.get(),
                                                      fill='',
                                                      width=int(self.brush.get("1.0", "end-1c")),
                                                      tags=('all_lines', self.current_shape_id))
        self.cv.tag_raise('above_all')

    def update_polygon(self, event):
        if self.current_polygon:
            x, y = self.cv.canvasx(event.x), self.cv.canvasy(event.y)
            snap_x, snap_y = x, y
            
            if self.snap_to_endpoints_var.get():
                endpoint = snap_to_endpoints(self.cv, x, y, tolerance=20.0)
                if endpoint:
                    snap_x, snap_y = endpoint
                    self.show_snap_indicator(snap_x, snap_y, "Endpoint", 'red')
            
            if self.snap_var.get() and self.grid_var.get():
                snap_x, snap_y = self.get_snap_point(x, y, is_final=False)
            
            radius = ((snap_x - self.lastx) ** 2 + (snap_y - self.lasty) ** 2) ** 0.5
            points = []
            sides = 6
            for i in range(sides):
                angle = 2 * math.pi * i / sides - math.pi/2
                px = self.lastx + radius * math.cos(angle)
                py = self.lasty + radius * math.sin(angle)
                points.extend([px, py])
            
            self.cv.coords(self.current_polygon, *points)
            self.cv.tag_raise('above_all')

    def finish_polygon(self, event):
        if self.current_polygon:
            x, y = self.cv.canvasx(event.x), self.cv.canvasy(event.y)
            snap_x, snap_y = x, y
            
            if self.snap_to_endpoints_var.get():
                endpoint = snap_to_endpoints(self.cv, x, y, tolerance=40.0)
                if endpoint:
                    snap_x, snap_y = endpoint
            elif self.snap_var.get() and self.grid_var.get():
                snap_x, snap_y = self.get_snap_point(x, y, is_final=True)
            
            radius = ((snap_x - self.lastx) ** 2 + (snap_y - self.lasty) ** 2) ** 0.5
            points = []
            sides = 6
            for i in range(sides):
                angle = 2 * math.pi * i / sides - math.pi/2
                px = self.lastx + radius * math.cos(angle)
                py = self.lasty + radius * math.sin(angle)
                points.extend([px, py])
            
            self.cv.coords(self.current_polygon, *points)
            self.cv.delete('start_marker', 'snap_indicator')
            self.linecount += 1
            self.current_polygon = None
            self.root.save_canvas_state()

    def start_arc(self, event):
        x, y = self.cv.canvasx(event.x), self.cv.canvasy(event.y)
        if self.snap_to_endpoints_var.get():
            endpoint = snap_to_endpoints(self.cv, x, y, tolerance=20.0)
            if endpoint:
                x, y = endpoint
        elif self.snap_var.get() and self.grid_var.get():
            x, y = self.get_snap_point(x, y, is_final=True)
        
        self.lastx, self.lasty = x, y
        self.current_shape_id = f"shape_{self.linecount}"
        
        self.cv.create_oval(x-4, y-4, x+4, y+4,
                            fill='#00FF00', outline='white',
                            tags=('start_marker', 'above_all'))
        
        self.current_arc = self.cv.create_arc(x, y, x, y,
                                              start=0, extent=90,
                                              outline=self.hexstr.get(),
                                              width=int(self.brush.get("1.0", "end-1c")),
                                              tags=('all_lines', self.current_shape_id))
        self.cv.tag_raise('above_all')

    def update_arc(self, event):
        if self.current_arc:
            x, y = self.cv.canvasx(event.x), self.cv.canvasy(event.y)
            snap_x, snap_y = x, y
            
            if self.snap_to_endpoints_var.get():
                endpoint = snap_to_endpoints(self.cv, x, y, tolerance=20.0)
                if endpoint:
                    snap_x, snap_y = endpoint
                    self.show_snap_indicator(snap_x, snap_y, "Endpoint", 'red')
            
            if self.snap_var.get() and self.grid_var.get():
                snap_x, snap_y = self.get_snap_point(x, y, is_final=False)
            
            radius = ((snap_x - self.lastx) ** 2 + (snap_y - self.lasty) ** 2) ** 0.5
            angle = math.degrees(math.atan2(snap_y - self.lasty, snap_x - self.lastx))
            
            self.cv.coords(self.current_arc,
                           self.lastx - radius, self.lasty - radius,
                           self.lastx + radius, self.lasty + radius)
            self.cv.itemconfig(self.current_arc, start=angle, extent=90)
            self.cv.tag_raise('above_all')

    def finish_arc(self, event):
        if self.current_arc:
            x, y = self.cv.canvasx(event.x), self.cv.canvasy(event.y)
            snap_x, snap_y = x, y
            
            if self.snap_to_endpoints_var.get():
                endpoint = snap_to_endpoints(self.cv, x, y, tolerance=20.0)
                if endpoint:
                    snap_x, snap_y = endpoint
            elif self.snap_var.get() and self.grid_var.get():
                snap_x, snap_y = self.get_snap_point(x, y, is_final=True)
            
            radius = ((snap_x - self.lastx) ** 2 + (snap_y - self.lasty) ** 2) ** 0.5
            angle = math.degrees(math.atan2(snap_y - self.lasty, snap_x - self.lastx))
            
            self.cv.coords(self.current_arc,
                           self.lastx - radius, self.lasty - radius,
                           self.lastx + radius, self.lasty + radius)
            self.cv.itemconfig(self.current_arc, start=angle, extent=90)
            
            self.cv.delete('start_marker', 'snap_indicator')
            self.linecount += 1
            self.current_arc = None
            self.root.save_canvas_state()

    def start_freehand(self, event):
        x, y = self.cv.canvasx(event.x), self.cv.canvasy(event.y)
        if self.snap_to_endpoints_var.get():
            endpoint = snap_to_endpoints(self.cv, x, y, tolerance=20.0)
            if endpoint:
                x, y = endpoint
        elif self.snap_var.get() and self.grid_var.get():
            x, y = self.get_snap_point(x, y, is_final=True)
        
        self.lastx, self.lasty = x, y
        self.current_shape_id = f"shape_{self.linecount}"
        self.current_line_points = [(x, y)]
        
        self.cv.create_oval(x-4, y-4, x+4, y+4,
                            fill='#00FF00', outline='white',
                            tags=('start_marker', 'above_all'))
        self.cv.tag_raise('above_all')

    def update_freehand(self, event):
        if self.lastx is not None and self.lasty is not None:
            x, y = self.cv.canvasx(event.x), self.cv.canvasy(event.y)
            snap_x, snap_y = x, y
            
            if self.snap_to_endpoints_var.get():
                endpoint = snap_to_endpoints(self.cv, x, y, tolerance=20.0)
                if endpoint:
                    snap_x, snap_y = endpoint
                    self.show_snap_indicator(snap_x, snap_y, "Endpoint", 'red')
            
            if self.snap_var.get() and self.grid_var.get():
                snap_x, snap_y = self.get_snap_point(x, y, is_final=False)
            
            self.current_line_points.append((snap_x, snap_y))
            
            if len(self.current_line_points) > 1:
                self.cv.delete("temp_freehand")
                points = [coord for point in self.current_line_points for coord in point]
                self.cv.create_line(*points,
                                    fill=self.hexstr.get(),
                                    width=int(self.brush.get("1.0", "end-1c")),
                                    capstyle=tk.ROUND,
                                    tags=('temp_freehand',))
            
            self.lastx, self.lasty = snap_x, snap_y
            self.cv.tag_raise('above_all')

    def finish_freehand(self, event):
        if self.lastx is not None and self.lasty is not None:
            x, y = self.cv.canvasx(event.x), self.cv.canvasy(event.y)
            snap_x, snap_y = x, y
            
            if self.snap_to_endpoints_var.get():
                endpoint = snap_to_endpoints(self.cv, x, y, tolerance=20.0)
                if endpoint:
                    snap_x, snap_y = endpoint
            elif self.snap_var.get() and self.grid_var.get():
                snap_x, snap_y = self.get_snap_point(x, y, is_final=True)
            
            self.current_line_points.append((snap_x, snap_y))
            self.cv.delete("temp_freehand")
            
            if len(self.current_line_points) > 1:
                points = [coord for point in self.current_line_points for coord in point]
                self.cv.create_line(*points,
                                    fill=self.hexstr.get(),
                                    width=int(self.brush.get("1.0", "end-1c")),
                                    capstyle=tk.ROUND,
                                    tags=('all_lines', self.current_shape_id))
            
            self.cv.delete('start_marker', 'snap_indicator')
            self.linecount += 1
            self.lastx = None
            self.lasty = None
            self.current_line_points = []
            self.root.save_canvas_state()

    def show_snap_indicator(self, x, y, label, color):
        self.cv.delete('snap_indicator')
        self.cv.create_polygon(x-6, y+6, x+6, y+6, x, y-6,
                              fill=color, outline='white',
                              tags=('snap_indicator', 'above_all'))
        self.cv.create_text(x, y-15, text=label,
                            fill=color, font=('Arial', 8, 'bold'),
                            tags=('snap_indicator', 'above_all'))

    def update_snap_indicator(self, event):
        if not self.active_tool or self.active_tool not in ['line', 'rectangle', 'circle', 'polygon', 'arc', 'freehand']:
            return
        
        x, y = self.cv.canvasx(event.x), self.cv.canvasy(event.y)
        snap_x, snap_y = x, y
        snap_found = False
        
        self.cv.delete('snap_indicator', 'snap_label')
        
        if self.snap_to_endpoints_var.get():
            endpoint = snap_to_endpoints(self.cv, x, y, tolerance=40.0)
            if endpoint:
                snap_x, snap_y = endpoint
                snap_found = True
                self.cv.create_polygon(snap_x-6, snap_y+6, snap_x+6, snap_y+6, snap_x, snap_y-6,
                                      fill='red', outline='white',
                                      tags=('snap_indicator', 'above_all'))
                self.cv.create_text(snap_x, snap_y-15, text="Endpoint",
                                   fill='red', font=('Arial', 8, 'bold'),
                                   tags=('snap_label', 'above_all'))
        
        if not snap_found and self.snap_to_midpoints_var.get():
            midpoint = snap_to_midpoints(self.cv, x, y, tolerance=40.0)
            if midpoint:
                snap_x, snap_y = midpoint
                snap_found = True
                self.cv.create_polygon(snap_x-6, snap_y+6, snap_x+6, snap_y+6, snap_x, snap_y-6,
                                      fill='#0088FF', outline='white',
                                      tags=('snap_indicator', 'above_all'))
                self.cv.create_text(snap_x, snap_y-15, text="Midpoint",
                                   fill='#0088FF', font=('Arial', 8, 'bold'),
                                   tags=('snap_label', 'above_all'))
        
        if not snap_found and self.snap_to_centers_var.get():
            center = snap_to_centers(self.cv, x, y, tolerance=40.0)
            if center:
                snap_x, snap_y = center
                snap_found = True
                self.cv.create_polygon(snap_x-6, snap_y+6, snap_x+6, snap_y+6, snap_x, snap_y-6,
                                      fill='#0088FF', outline='white',
                                      tags=('snap_indicator', 'above_all'))
                self.cv.create_text(snap_x, snap_y-15, text="Center",
                                   fill='#0088FF', font=('Arial', 8, 'bold'),
                                   tags=('snap_label', 'above_all'))
        
        if not snap_found and self.snap_var.get() and self.grid_var.get():
            snap_x, snap_y = self.get_snap_point(x, y, is_final=False)
            self.cv.create_polygon(snap_x-6, snap_y+6, snap_x+6, snap_y+6, snap_x, snap_y-6,
                                  fill='green', outline='white',
                                  tags=('snap_indicator', 'above_all'))
            self.cv.create_text(snap_x, snap_y-15, text="Grid",
                               fill='green', font=('Arial', 8, 'bold'),
                               tags=('snap_label', 'above_all'))
        
        self.cv.tag_raise('above_all')

    def open_drawing_tools_window(self):
        tools_window = tk.Toplevel(self.root)
        tools_window.title("Drawing Tools")
        tools_window.geometry("200x500+1700+0")
        tools_window.configure(bg="#263d42")
        tools_window.attributes('-topmost', True)
        
        buttons = ["Line", "Circle", "Rectangle", "Polygon", "Arc", "Freehand"]
        for btn_text in buttons:
            btn = tk.Button(tools_window, text=btn_text, bd=2, height=2, width=15,
                           fg="white", bg="#263d42",
                           command=lambda t=btn_text: self.toggle_tool(t))
            btn.pack(pady=5)
            self.tool_buttons[btn_text] = btn
        
        def on_window_close():
            tools_window.destroy()
        
        tools_window.protocol("WM_DELETE_WINDOW", on_window_close)
        return tools_window