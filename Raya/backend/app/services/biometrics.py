import base64
import json
import math
import cv2
import numpy as np
import os
import urllib.request

class FaceBiometricService:
    def __init__(self):
        # Hugging Face resolve URLs for pre-trained model files
        YUNET_URL = "https://huggingface.co/opencv/face_detection_yunet/resolve/main/face_detection_yunet_2023mar.onnx"
        SFACE_URL = "https://huggingface.co/opencv/face_recognition_sface/resolve/main/face_recognition_sface_2021dec.onnx"

        # Model storage paths inside backend root
        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        self.yunet_path = os.path.join(backend_dir, "face_detection_yunet_2023mar.onnx")
        self.sface_path = os.path.join(backend_dir, "face_recognition_sface_2021dec.onnx")

        self.use_deep_learning = False
        
        try:
            # Download model files in the background if they do not exist
            self._download_file(YUNET_URL, self.yunet_path)
            self._download_file(SFACE_URL, self.sface_path)
            
            # Initialize YuNet face detector
            self.detector = cv2.FaceDetectorYN.create(
                model=self.yunet_path,
                config='',
                input_size=(320, 320),
                score_threshold=0.9,
                nms_threshold=0.3,
                top_k=5000,
                backend_id=cv2.dnn.DNN_BACKEND_OPENCV,
                target_id=cv2.dnn.DNN_TARGET_CPU
            )
            
            # Initialize SFace face recognizer
            self.recognizer = cv2.FaceRecognizerSF.create(
                model=self.sface_path,
                config='',
                backend_id=cv2.dnn.DNN_BACKEND_OPENCV,
                target_id=cv2.dnn.DNN_TARGET_CPU
            )
            
            self.use_deep_learning = True
            print("SFace Face Biometric initialized successfully!")
        except Exception as e:
            print(f"Failed to load SFace deep learning model: {e}. Falling back to Haar Cascade.")
            # Setup cascade fallback in case of errors
            self.face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

    def _download_file(self, url: str, dest: str):
        if not os.path.exists(dest):
            print(f"Downloading biometric model file to {dest}...")
            # Set user agent headers to prevent HTTP 403 Forbidden errors
            opener = urllib.request.build_opener()
            opener.addheaders = [('User-Agent', 'Mozilla/5.0')]
            urllib.request.install_opener(opener)
            urllib.request.urlretrieve(url, dest)
            print(f"Downloaded model to {dest}")

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
            
        if self.use_deep_learning:
            try:
                h, w = image.shape[:2]
                self.detector.setInputSize((w, h))
                retval, faces = self.detector.detect(image)
                
                if not retval or faces is None or len(faces) == 0:
                    return None
                    
                # Align and crop face image
                face_aligned = self.recognizer.alignCrop(image, faces[0])
                # Extract 128-dimensional deep feature representation
                feature = self.recognizer.feature(face_aligned)
                return feature[0].tolist()
            except Exception as e:
                print(f"Deep learning embedding extraction failed: {e}. Retrying with fallback...")
                pass

        # Local fallback using Haar Cascade + 3D Color Histogram
        try:
            face_cascade = getattr(self, "face_cascade", None)
            if not face_cascade:
                self.face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
                face_cascade = self.face_cascade
                
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
            
            if len(faces) == 0:
                return None
                
            (x, y, w, h) = faces[0]
            face_roi = image[y:y+h, x:x+w]
            hist = cv2.calcHist([face_roi], [0, 1, 2], None, [8, 8, 8], [0, 256, 0, 256, 0, 256])
            vector = cv2.normalize(hist, hist).flatten().tolist()
            return vector
        except Exception as e:
            print(f"Biometric fallback extraction failed: {e}")
            return None

    def calculate_distance(self, emb1: list[float], emb2: list[float]) -> float:
        if not emb1 or not emb2:
            return 100.0
            
        if len(emb1) != len(emb2):
            # Guard logic for size-mismatch (e.g. comparing old 512-d histograms with new 128-d vectors)
            return 100.0
            
        if len(emb1) == 128:
            # SFace Embeddings: compute Cosine distance (1.0 - CosineSimilarity)
            sim = sum(a * b for a, b in zip(emb1, emb2))
            return 1.0 - sim
        else:
            # Color Histograms fallback: compute standard Euclidean distance
            return math.sqrt(sum((a - b)**2 for a, b in zip(emb1, emb2)))

# Singleton instance
biometrics = FaceBiometricService()
