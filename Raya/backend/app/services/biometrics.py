import base64
import json
import math
import cv2
import numpy as np
import mediapipe as mp

class FaceBiometricService:
    def __init__(self):
        self.mp_face_mesh = mp.solutions.face_mesh
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            static_image_mode=True,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5
        )

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
        results = self.face_mesh.process(img_rgb)
        
        # IF NO FACE IS DETECTED, RETURN NONE
        if not results.multi_face_landmarks:
            return None 
            
        # Extract the first face's landmarks as a feature vector
        landmarks = results.multi_face_landmarks[0].landmark
        
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
