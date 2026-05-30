import base64
import json
import math
import cv2
import numpy as np

class FaceBiometricService:
    def __init__(self):
        # We use OpenCV's built-in Haar Cascade because it requires NO external dependencies or OpenGL (libGLESv2)
        self.face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

    def base64_to_image(self, base64_str: str):
        if ',' in base64_str:
            base64_str = base64_str.split(',')[1]
        img_data = base64.b64decode(base64_str)
        nparr = np.frombuffer(img_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return img

    def extract_embedding(self, image) -> list[float]:
        if image is None:
            return None
            
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Detect face
        faces = self.face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
        
        # IF NO FACE DETECTED, RETURN NONE (Solves the "stepping away" bug)
        if len(faces) == 0:
            return None 
            
        # Extract the first face
        (x, y, w, h) = faces[0]
        face_roi = image[y:y+h, x:x+w]
        
        # Compute a 3D Color Histogram of the face as a lightweight PoC embedding
        hist = cv2.calcHist([face_roi], [0, 1, 2], None, [8, 8, 8], [0, 256, 0, 256, 0, 256])
        vector = cv2.normalize(hist, hist).flatten().tolist()
            
        return vector

    def calculate_distance(self, emb1: list[float], emb2: list[float]) -> float:
        if not emb1 or not emb2:
            return 100.0
        return math.sqrt(sum((a - b)**2 for a, b in zip(emb1, emb2)))

# Singleton instance
biometrics = FaceBiometricService()
