import tkinter as tk
from tkinter import filedialog, ttk
from PIL import Image, ImageTk
import os

class ImageImportWindow:
    def __init__(self, parent, canvas):
        self.parent = parent
        self.canvas = canvas
        # Initialize linecount if not present
        if not hasattr(self.canvas, 'linecount'):
            self.canvas.linecount = 0
        
        # Get scale_var from parent window
        self.scale_var = None
        for var in self.parent.children.values():
            if isinstance(var, ttk.Combobox) and var.cget("values"):
                self.scale_var = var
                break
        
        self.window = tk.Toplevel(parent)
        self.window.title("Import Image")
        self.window.geometry("400x500")
        self.window.configure(bg="#263d42")
        
        # Store the original image and its dimensions
        self.original_image = None
        self.image_width = 0
        self.image_height = 0
        self.image_aspect_ratio = 1
        self.preview_photo = None
        self.canvas_image = None
        
        # Create main container
        self.main_frame = tk.Frame(self.window, bg="#263d42")
        self.main_frame.pack(fill='both', expand=True, padx=10, pady=10)
        
        # Create preview frame
        self.preview_frame = tk.Frame(self.main_frame, bg="#263d42")
        self.preview_frame.pack(fill='both', expand=True, pady=10)
        
        # Create preview canvas
        self.preview_canvas = tk.Canvas(self.preview_frame, bg="#263d42", highlightthickness=0)
        self.preview_canvas.pack(fill='both', expand=True)
        
        # Create controls frame
        self.controls_frame = tk.Frame(self.main_frame, bg="#263d42")
        self.controls_frame.pack(fill='x', pady=10)
        
        # Width entry
        tk.Label(self.controls_frame, text="Width (mm):", bg="#263d42", fg="white").pack(side='left', padx=5)
        self.width_var = tk.StringVar(value="100")
        self.width_entry = tk.Entry(self.controls_frame, textvariable=self.width_var, width=10)
        self.width_entry.pack(side='left', padx=5)
        self.width_var.trace('w', self.on_width_change)
        
        # Height entry
        tk.Label(self.controls_frame, text="Height (mm):", bg="#263d42", fg="white").pack(side='left', padx=5)
        self.height_var = tk.StringVar(value="100")
        self.height_entry = tk.Entry(self.controls_frame, textvariable=self.height_var, width=10)
        self.height_entry.pack(side='left', padx=5)
        self.height_var.trace('w', self.on_height_change)
        
        # Maintain aspect ratio checkbox
        self.maintain_aspect = tk.BooleanVar(value=True)
        tk.Checkbutton(self.controls_frame, text="Maintain Aspect Ratio", 
                      variable=self.maintain_aspect, bg="#263d42", fg="white",
                      selectcolor="#1a1a1a", command=self.update_preview).pack(pady=5)
        
        # Add flag to prevent recursive updates
        self.updating = False
        
        # Opacity slider
        tk.Label(self.main_frame, text="Opacity:", bg="#263d42", fg="white").pack(pady=(10,0))
        self.opacity_var = tk.IntVar(value=100)
        self.opacity_slider = ttk.Scale(self.main_frame, from_=0, to=100, 
                                      orient='horizontal', variable=self.opacity_var,
                                      command=self.update_preview)
        self.opacity_slider.pack(fill='x', padx=10, pady=5)
        
        # Buttons frame
        buttons_frame = tk.Frame(self.main_frame, bg="#263d42")
        buttons_frame.pack(fill='x', pady=10)
        
        # Create buttons
        tk.Button(buttons_frame, text="Select Image", command=self.select_image,
                 bg="#263d42", fg="white").pack(side='left', padx=5)
        tk.Button(buttons_frame, text="Place Image", command=self.place_image,
                 bg="#263d42", fg="white").pack(side='right', padx=5)
    
    def select_image(self):
        file_path = filedialog.askopenfilename(
            filetypes=[
                ("Image files", "*.png *.jpg *.jpeg *.gif *.bmp"),
                ("All files", "*.*")
            ]
        )
        
        if file_path:
            # Load and store original image
            self.original_image = Image.open(file_path)
            self.image_width = self.original_image.width
            self.image_height = self.original_image.height
            self.image_aspect_ratio = self.image_width / self.image_height
            
            # Set initial dimensions while maintaining aspect ratio
            base_size = 100  # 100mm base size
            if self.image_width > self.image_height:
                self.width_var.set(str(base_size))
                self.height_var.set(str(round(base_size / self.image_aspect_ratio)))
            else:
                self.height_var.set(str(base_size))
                self.width_var.set(str(round(base_size * self.image_aspect_ratio)))
            
            self.update_preview()
    
    def update_preview(self, *args):
        if not self.original_image:
            return
        
        try:
            width = float(self.width_var.get())
            height = float(self.height_var.get())
            opacity = self.opacity_var.get() / 100.0
            
            # Calculate preview size to fit the preview canvas
            preview_width = self.preview_canvas.winfo_width()
            preview_height = self.preview_canvas.winfo_height()
            
            if preview_width <= 1 or preview_height <= 1:
                preview_width = 300
                preview_height = 300
            
            # Scale image to fit preview while maintaining aspect ratio
            preview_ratio = preview_width / preview_height
            image_ratio = width / height
            
            if image_ratio > preview_ratio:
                display_width = preview_width
                display_height = int(preview_width / image_ratio)
            else:
                display_height = preview_height
                display_width = int(preview_height * image_ratio)
            
            # Resize image for preview
            preview_image = self.original_image.copy()
            preview_image = preview_image.resize((display_width, display_height), Image.Resampling.LANCZOS)
            
            # Apply opacity
            if preview_image.mode in ('RGBA', 'LA') or (preview_image.mode == 'P' and 'transparency' in preview_image.info):
                if preview_image.mode != 'RGBA':
                    preview_image = preview_image.convert('RGBA')
            else:
                preview_image = preview_image.convert('RGBA')
            
            # Apply opacity to alpha channel
            alpha = preview_image.split()[3].point(lambda x: int(x * opacity))
            preview_image.putalpha(alpha)
            
            # Create PhotoImage and store reference
            self.preview_photo = ImageTk.PhotoImage(preview_image)
            
            # Clear previous preview and create new one
            self.preview_canvas.delete("all")
            self.preview_canvas.create_image(
                preview_width//2, preview_height//2,
                image=self.preview_photo,
                anchor="center"
            )
            
        except (ValueError, AttributeError):
            pass
    
    def on_width_change(self, *args):
        if not self.original_image or not self.maintain_aspect.get() or self.updating:
            return
        try:
            width = float(self.width_var.get())
            self.updating = True
            self.height_var.set(str(round(width / self.image_aspect_ratio, 2)))
            self.updating = False
            self.update_preview()
        except ValueError:
            pass
    
    def on_height_change(self, *args):
        if not self.original_image or not self.maintain_aspect.get() or self.updating:
            return
        try:
            height = float(self.height_var.get())
            self.updating = True
            self.width_var.set(str(round(height * self.image_aspect_ratio, 2)))
            self.updating = False
            self.update_preview()
        except ValueError:
            pass
    
    def place_image(self):
        if not self.original_image:
            return
        
        try:
            # Get dimensions in mm - these are the absolute print dimensions
            width_mm = float(self.width_var.get())
            height_mm = float(self.height_var.get())
            opacity = self.opacity_var.get() / 100.0
            
            # Get current zoom scale for DISPLAY ONLY
            zoom_scale = 1.0  # Default to 1.0
            if self.scale_var:
                scale_text = self.scale_var.get()
                if scale_text:
                    zoom_scale = float(scale_text.rstrip('%')) / 100.0
                    print(f"Current zoom scale: {zoom_scale}")
            
            # Store the absolute size in mm and calculate display size
            display_width = int(width_mm * zoom_scale)
            display_height = int(height_mm * zoom_scale)
            
            print(f"Absolute size: {width_mm}x{height_mm}mm")
            print(f"Display size with zoom {zoom_scale}: {display_width}x{display_height} pixels")
            
            # Create the display version of the image
            resized_image = self.original_image.copy()
            resized_image = resized_image.resize((display_width, display_height), Image.Resampling.LANCZOS)
            
            # Apply opacity
            if resized_image.mode != 'RGBA':
                resized_image = resized_image.convert('RGBA')
            alpha = resized_image.split()[3].point(lambda x: int(x * opacity))
            resized_image.putalpha(alpha)
            
            # Create PhotoImage for canvas
            self.canvas_image = ImageTk.PhotoImage(resized_image)
            
            # Calculate center position
            canvas_width = self.canvas.winfo_width()
            canvas_height = self.canvas.winfo_height()
            x = canvas_width // 2
            y = canvas_height // 2
            
            # Create unique ID for this image
            image_id = f"shape_{self.canvas.linecount}"
            
            # Store image data with ABSOLUTE dimensions
            if not hasattr(self.canvas, 'image_data'):
                self.canvas.image_data = {}
            
            self.canvas.image_data[image_id] = {
                'original_image': self.original_image,
                'width_mm': width_mm,  # Store absolute size
                'height_mm': height_mm,  # Store absolute size
                'opacity': opacity,
                'x': x,
                'y': y
            }
            
            # Create the image on canvas
            self.canvas.create_image(x, y, image=self.canvas_image, anchor="center",
                                   tags=('all_lines', image_id, 'scalable_image'))
            
            # Store the PhotoImage reference
            if not hasattr(self.canvas, 'image_references'):
                self.canvas.image_references = {}
            self.canvas.image_references[image_id] = self.canvas_image
            
            # Define scale_images as a proper method of the canvas
            def scale_images_method(self=self.canvas):
                print("scale_images called")
                try:
                    # Get current zoom scale for DISPLAY ONLY
                    zoom_scale = 1.0  # Default to 1.0
                    for child in self.master.winfo_children():
                        if isinstance(child, ttk.Combobox) and child.cget("values"):
                            scale_text = child.get()
                            if scale_text:
                                zoom_scale = float(scale_text.rstrip('%')) / 100.0
                                print(f"Current zoom scale in scale_images: {zoom_scale}")
                                break
                    
                    # Scale each image based on absolute size * zoom
                    for image_id, data in self.image_data.items():
                        try:
                            # Calculate display dimensions from absolute size * zoom
                            new_width = int(data['width_mm'] * zoom_scale)
                            new_height = int(data['height_mm'] * zoom_scale)
                            print(f"Scaling {image_id} for display: {new_width}x{new_height}")
                            
                            # Create display version
                            resized = data['original_image'].copy()
                            resized = resized.resize((new_width, new_height), Image.Resampling.LANCZOS)
                            
                            # Apply opacity
                            if resized.mode != 'RGBA':
                                resized = resized.convert('RGBA')
                            alpha = resized.split()[3].point(lambda x: int(x * data['opacity']))
                            resized.putalpha(alpha)
                            
                            # Update PhotoImage
                            photo = ImageTk.PhotoImage(resized)
                            self.image_references[image_id] = photo
                            
                            # Update canvas display
                            for item in self.find_withtag(image_id):
                                self.itemconfig(item, image=photo)
                                
                        except Exception as e:
                            print(f"Error scaling image {image_id}: {e}")
                            
                except Exception as e:
                    print(f"Error in scale_images: {e}")
            
            # Attach the method to the canvas if it doesn't exist
            if not hasattr(self.canvas, 'scale_images'):
                self.canvas.scale_images = scale_images_method.__get__(self.canvas)
            
            # Increment linecount
            self.canvas.linecount += 1
            
            # Save canvas state if the method exists
            if hasattr(self.canvas, 'save_canvas_state'):
                self.canvas.save_canvas_state()
            
            # Close window
            self.window.destroy()
            
        except Exception as e:
            print(f"Error placing image: {e}")

def import_image(parent, canvas):
    """Create and show the image import window"""
    # Initialize linecount if not present
    if not hasattr(canvas, 'linecount'):
        canvas.linecount = 0
    return ImageImportWindow(parent, canvas) 