from tkinter import filedialog
from PIL import Image, ImageTk
import os

class ImageHandler:
    def __init__(self, canvas):
        self.canvas = canvas
        self.image_items = {}  # Dictionary to store image items and their data {id: {'image': PIL_Image, 'photo': PhotoImage, 'scale': float}}
        self.current_image = None
        self.current_photo = None
        self.base_scale = 1.0

    def open_image(self):
        """Open a file dialog to select an image file"""
        filetypes = (
            ('Image files', '*.png *.jpg *.jpeg *.gif *.bmp'),
            ('All files', '*.*')
        )
        
        filename = filedialog.askopenfilename(
            title='Select an image',
            filetypes=filetypes
        )
        
        if filename:
            return self.load_image(filename)
        return None

    def load_image(self, image_path):
        """Load an image from the given path"""
        try:
            # Open and convert image to RGB mode to ensure compatibility
            image = Image.open(image_path).convert('RGBA')
            self.current_image = image
            # Create PhotoImage for canvas
            self.current_photo = ImageTk.PhotoImage(image)
            return True
        except Exception as e:
            print(f"Error loading image: {e}")
            return False

    def place_image(self, x, y, scale=1.0):
        """Place the currently loaded image on the canvas at specified coordinates"""
        if self.current_photo:
            # Create canvas image item
            image_item = self.canvas.create_image(
                x, y,
                image=self.current_photo,
                anchor='nw',
                tags=('image', 'selectable')
            )
            # Store the image data
            self.image_items[image_item] = {
                'image': self.current_image,
                'photo': self.current_photo,
                'scale': scale,
                'original_width': self.current_image.width,
                'original_height': self.current_image.height
            }
            return image_item
        return None

    def scale_image(self, image_id, scale_factor):
        """Scale a specific image by the given factor"""
        if image_id in self.image_items:
            image_data = self.image_items[image_id]
            original_image = image_data['image']
            
            # Calculate new dimensions
            new_width = int(image_data['original_width'] * scale_factor)
            new_height = int(image_data['original_height'] * scale_factor)
            
            # Resize the image
            resized_image = original_image.resize((new_width, new_height), Image.Resampling.LANCZOS)
            new_photo = ImageTk.PhotoImage(resized_image)
            
            # Update the canvas item
            self.canvas.itemconfig(image_id, image=new_photo)
            
            # Update stored data
            image_data['photo'] = new_photo
            image_data['scale'] = scale_factor
            
            return True
        return False

    def remove_image(self, image_id):
        """Remove an image from the canvas"""
        if image_id in self.image_items:
            self.canvas.delete(image_id)
            del self.image_items[image_id]
            return True
        return False

    def scale_all_images(self, scale_factor):
        """Scale all images on canvas by the given factor"""
        for image_id in list(self.image_items.keys()):
            self.scale_image(image_id, scale_factor)

    def get_image_bounds(self, image_id):
        """Get the bounding box of an image"""
        if image_id in self.image_items:
            return self.canvas.bbox(image_id)
        return None 