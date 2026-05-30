import base64
import json
import math
import cv2
import numpy as np
import os
import urllib.request
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

class FaceBiometricService:
    def __init__(self):
        MODEL_PATH = "face_landmarker.task"
        if not os.path.exists(MODEL_PATH):
            print("Downloading Face Landmarker model...")
            urllib.request.urlretrieve(
                "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task", 
                MODEL_PATH
            )
            
        base_options = python.BaseOptions(model_asset_path=MODEL_PATH)
        options = vision.FaceLandmarkerOptions(
            base_options=base_options,
            num_faces=1
        )
        self.detector = vision.FaceLandmarker.create_from_options(options)

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
            
        # Convert BGR to RGB for MediaPipe
        img_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        # Convert to MediaPipe Image
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=img_rgb)
        
        # Process using new Tasks API
        detection_result = self.detector.detect(mp_image)
        
        # IF NO FACE IS DETECTED, RETURN NONE
        if not detection_result.face_landmarks:
            return None 
            
        # Extract the first face's landmarks as a feature vector
        landmarks = detection_result.face_landmarks[0]
        
        # Flatten into a vector (x, y, z for each point)
        vector = []
        for lm in landmarks:
            vector.extend([lm.x, lm.y, lm.z])
            
        # Normalize the vector to handle distance scaling
        norm = math.sqrt(sum(v*v for v in vector))
        if norm > 0:
            vector = [v/norm for v in vector]
            
        return vector

    def calculate_distance(self, emb1: list[float], emb2: list[float]) -> float:
        if not emb1 or not emb2:
            return 100.0
        return math.sqrt(sum((a - b)**2 for a, b in zip(emb1, emb2)))

# Singleton instance
biometrics = FaceBiometricService()
