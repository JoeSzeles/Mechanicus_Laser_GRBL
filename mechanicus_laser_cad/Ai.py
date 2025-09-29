import requests
import json
import tkinter as tk
from tkinter import ttk, scrolledtext

# HuggingFace API configuration
API_TOKEN = "your token here"
API_URL = "https://api-inference.huggingface.co/models/HuggingFaceH4/zephyr-7b-beta"
headers = {"Authorization": f"Bearer {API_TOKEN}"}

class ChatApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Mechanicus AI Chat")
        self.root.geometry("800x600")
        self.root.configure(bg="#263d42")
        
        # Chat display
        self.chat_display = scrolledtext.ScrolledText(root, wrap=tk.WORD, 
                                                    width=70, height=30,
                                                    bg="#1a1a1a", fg="#00ff00",
                                                    font=("Courier", 10))
        self.chat_display.pack(padx=10, pady=10)
        
        # Input frame
        input_frame = tk.Frame(root, bg="#263d42")
        input_frame.pack(fill=tk.X, padx=10, pady=5)
        
        # Message entry
        self.message_entry = tk.Entry(input_frame, width=60, bg="#1a1a1a", 
                                    fg="white", font=("Courier", 10))
        self.message_entry.pack(side=tk.LEFT, padx=5)
        self.message_entry.bind("<Return>", self.send_message)
        
        # Send button
        send_button = tk.Button(input_frame, text="Send", command=self.send_message,
                              bg="#263d42", fg="white", width=10)
        send_button.pack(side=tk.LEFT, padx=5)
        
        # Welcome message
        self.chat_display.insert(tk.END, "Welcome to Mechanicus AI Chat!\n")
        self.chat_display.insert(tk.END, "Using Zephyr-7B for intelligent conversations\n")
        self.chat_display.insert(tk.END, "-" * 50 + "\n\n")
        
        # Conversation history
        self.conversation_history = []
        
    def send_message(self, event=None):
        message = self.message_entry.get()
        if message:
            # Display user message
            self.chat_display.insert(tk.END, "You: " + message + "\n\n")
            self.chat_display.see(tk.END)
            
            # Get and display AI's response
            response = self.query(message)
            self.chat_display.insert(tk.END, "AI: " + response + "\n\n")
            self.chat_display.see(tk.END)
            
            # Clear input
            self.message_entry.delete(0, tk.END)
    
    def query(self, message):
        try:
            # Add the message to conversation history
            self.conversation_history.append(message)
            
            # Keep only last 5 messages for context
            if len(self.conversation_history) > 5:
                self.conversation_history = self.conversation_history[-5:]
            
            # Format the prompt for Zephyr
            prompt = f"""<|system|>You are a helpful AI assistant for the Mechanicus CNC application. You help users with CNC machining, G-code, and general manufacturing questions.</s>
<|user|>{message}</s>
<|assistant|>"""
            
            payload = {
                "inputs": prompt,
                "parameters": {
                    "max_new_tokens": 200,
                    "temperature": 0.7,
                    "top_p": 0.95,
                    "return_full_text": False
                }
            }
            
            response = requests.post(API_URL, headers=headers, json=payload)
            
            if response.status_code == 200:
                response_text = response.json()[0].get('generated_text', '')
                # Clean up the response
                cleaned_response = response_text.split('</s>')[0].strip()
                return cleaned_response if cleaned_response else "Sorry, I could not generate a response."
            else:
                return f"Error: {response.status_code} - {response.text}"
        except Exception as e:
            return f"Error: {str(e)}"

if __name__ == "__main__":
    root = tk.Tk()
    app = ChatApp(root)
    root.mainloop()