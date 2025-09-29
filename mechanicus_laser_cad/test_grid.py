import tkinter as tk

class LineSnapTool:
    def __init__(self, master):
        self.master = master
        self.master.title("Line Snap Tool on Grid")
        self.canvas = tk.Canvas(self.master, width=800, height=600, bg="black")
        self.canvas.pack(fill=tk.BOTH, expand=True)
        
        # Grid parameters
        self.grid_size = 20  # Size of each grid square
        
        # Bind events
        self.canvas.bind("<Button-1>", self.start_drawing)
        self.canvas.bind("<B1-Motion>", self.draw)
        self.canvas.bind("<ButtonRelease-1>", self.stop_drawing)
        
        self.drawing = False
        self.start_pos = None
        self.line = None
        
        self.draw_grid()

    def draw_grid(self):
        for x in range(0, 800, self.grid_size):
            self.canvas.create_line(x, 0, x, 600, fill="white")
        for y in range(0, 600, self.grid_size):
            self.canvas.create_line(0, y, 800, y, fill="white")

    def snap_to_grid(self, pos):
        """Snap the given position to the nearest grid point."""
        x, y = pos
        return (x // self.grid_size * self.grid_size, y // self.grid_size * self.grid_size)

    def start_drawing(self, event):
        self.drawing = True
        self.start_pos = self.snap_to_grid((event.x, event.y))

    def draw(self, event):
        if self.drawing:
            if self.line:
                self.canvas.delete(self.line)
            end_pos = self.snap_to_grid((event.x, event.y))
            self.line = self.canvas.create_line(self.start_pos[0], self.start_pos[1], 
                                                end_pos[0], end_pos[1], fill="red", width=2)

    def stop_drawing(self, event):
        self.drawing = False
        # If you want to keep the line drawn, you might want to handle this differently, 
        # perhaps by storing all lines in a list to redraw them later.

if __name__ == "__main__":
    root = tk.Tk()
    app = LineSnapTool(root)
    root.mainloop()