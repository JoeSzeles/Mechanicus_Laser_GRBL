import cv2
import tkinter as tk
from tkinter import ttk
from tkinter import messagebox
import threading
from queue import Queue, Empty
import time
from PIL import Image, ImageTk
import numpy as np

class WebcamFeed:
    def __init__(self, parent):
        self.parent = parent
        self.window = tk.Toplevel(parent)
        self.window.title("Live Feed")
        self.window.geometry("640x480")
        self.window.configure(bg="#263d42")
        self.window.attributes('-topmost', True)
        
        # Make window resizable
        self.window.resizable(True, True)
        
        # Create control frame
        self.control_frame = tk.Frame(self.window, bg="#263d42")
        self.control_frame.pack(fill='x', padx=5, pady=5)
        
        # Create dropdown for camera selection
        self.selected_camera = tk.IntVar(value=0)
        self.camera_selection = ttk.Combobox(self.control_frame, textvariable=self.selected_camera, width=20)
        self.camera_selection['values'] = self.get_available_cameras()
        self.camera_selection.pack(side='left', padx=5)
        
        # Create connect button
        self.connect_btn = tk.Button(self.control_frame, text="Connect", 
                                   command=self.start_feed,
                                   bd=2, height=1, width=10, 
                                   fg="white", bg="#263d42")
        self.connect_btn.pack(side='left', padx=5)

        # Create canvas frame that will expand
        self.canvas_frame = tk.Frame(self.window, bg="#263d42")
        self.canvas_frame.pack(fill='both', expand=True, padx=5, pady=5)
        
        # Create canvas for video feed
        self.canvas = tk.Canvas(self.canvas_frame, bg="#1a1a1a", highlightthickness=0)
        self.canvas.pack(fill='both', expand=True)
        
        # Initialize components
        self.frame_queue = Queue(maxsize=2)
        self.running = False
        self.capture_thread = None
        self.display_thread = None
        self.cap = None
        self.current_size = (640, 480)
        
        # Bind resize event
        self.window.bind('<Configure>', self.on_window_resize)
        
        # Bind window close event
        self.window.protocol("WM_DELETE_WINDOW", self.close_feed)

    def get_available_cameras(self):
        available_cameras = []
        for i in range(5):
            cap = cv2.VideoCapture(i)
            if cap.read()[0]:
                available_cameras.append(i)
            cap.release()
        return available_cameras

    def capture_frames(self):
        while self.running:
            if self.cap and self.cap.isOpened():
                ret, frame = self.cap.read()
                if ret:
                    frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    frame = cv2.resize(frame, self.current_size)
                    
                    if self.frame_queue.full():
                        try:
                            self.frame_queue.get_nowait()
                        except Empty:
                            pass
                    self.frame_queue.put(frame)
                else:
                    self.running = False
                    break
            time.sleep(0.001)

    def display_frames(self):
        last_update = 0
        update_interval = 1000 // 30  # Target 30 FPS

        while self.running:
            current_time = time.time() * 1000
            if current_time - last_update >= update_interval:
                try:
                    if not self.frame_queue.empty():
                        frame = self.frame_queue.get_nowait()
                        image = Image.fromarray(frame)
                        photo = ImageTk.PhotoImage(image=image)
                        self.window.after_idle(lambda p=photo: self.update_canvas(p))
                        last_update = current_time
                except Empty:
                    pass
                except Exception as e:
                    print(f"Error in display thread: {str(e)}")
            time.sleep(0.001)

    def update_canvas(self, photo):
        if self.running:
            try:
                self.canvas.delete("all")
                self.canvas.create_image(0, 0, anchor=tk.NW, image=photo)
                self.canvas.image = photo
            except Exception as e:
                print(f"Error updating canvas: {str(e)}")

    def start_feed(self):
        self.stop_feed()
        
        try:
            camera_id = self.selected_camera.get()
            self.cap = cv2.VideoCapture(camera_id)
            
            if self.cap.isOpened():
                self.running = True
                
                # Start capture thread
                self.capture_thread = threading.Thread(target=self.capture_frames)
                self.capture_thread.daemon = True
                self.capture_thread.start()
                
                # Start display thread
                self.display_thread = threading.Thread(target=self.display_frames)
                self.display_thread.daemon = True
                self.display_thread.start()
                
                self.connect_btn.config(bg="green", text="Connected")
            else:
                messagebox.showerror("Error", "Failed to connect to camera")
                self.connect_btn.config(bg="#263d42", text="Connect")
                
        except Exception as e:
            messagebox.showerror("Error", f"Failed to start camera: {str(e)}")
            self.connect_btn.config(bg="#263d42", text="Connect")

    def stop_feed(self):
        self.running = False
        
        if self.capture_thread:
            self.capture_thread.join(timeout=1.0)
        if self.display_thread:
            self.display_thread.join(timeout=1.0)
            
        if self.cap:
            self.cap.release()
            self.cap = None
        
        # Clear the queue
        while not self.frame_queue.empty():
            try:
                self.frame_queue.get_nowait()
            except Empty:
                pass

    def on_window_resize(self, event):
        if event.widget == self.window:
            width = event.width - 10
            height = event.height - 50
            
            if width > 0 and height > 0:
                self.current_size = (width, height)
                self.canvas.config(width=width, height=height)

    def close_feed(self):
        self.stop_feed()
        self.window.destroy() 