import os
import json
import random
import requests
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from app.core.database import get_raya_db
from sqlalchemy import Column, Integer, String, DateTime
from app.models.domain import Base

router = APIRouter()

# --- Define the Model dynamically here for simplicity, or we can move it to domain.py ---
class TokenModel(Base):
    __tablename__ = "hospital_tokens"
    
    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    token_number = Column(String, unique=True, index=True)
    department = Column(String, nullable=False)
    patient_name = Column(String, nullable=False)
    abha_number = Column(String, nullable=True)
    status = Column(String, default="WAITING") # WAITING, IN_PROGRESS, COMPLETED
    created_at = Column(DateTime, default=datetime.utcnow)

# Ensure the table is created
from app.core.database import raya_engine
Base.metadata.create_all(bind=raya_engine)

class TokenCreateRequest(BaseModel):
    patient_name: str
    symptoms: str
    abha_number: Optional[str] = None

class ClassifyRequest(BaseModel):
    symptoms: str

class ClassifyResponse(BaseModel):
    department: str
    is_emergency: bool


class TokenResponse(BaseModel):
    token_number: str
    department: str
    patient_name: str
    queue_position: int
    estimated_wait_minutes: int
    status: str
    created_at: Optional[datetime] = None

def classify_symptoms(symptoms: str) -> str:
    symptoms = symptoms.lower()
    
    # Direct Department matches (e.g. when passed from Touch UI)
    valid_depts = ["cardiology", "orthopaedics", "ophthalmology", "dermatology", "pediatrics", "general medicine"]
    for dept in valid_depts:
        if dept in symptoms:
            return dept.title() if dept != "general medicine" else "General Medicine"

    # Symptom-based matches (English + Hinglish)
    if any(word in symptoms for word in ['heart', 'chest', 'bp', 'blood pressure', 'dil', 'chhati', 'dhadkan', 'saans', 'seene']):
        return "Cardiology"
    if any(word in symptoms for word in ['bone', 'fracture', 'joint', 'knee', 'back', 'haddi', 'ghutne', 'kamar', 'jod', 'pair', 'haath', 'chot']):
        return "Orthopaedics"
    if any(word in symptoms for word in ['eye', 'vision', 'blur', 'aankh', 'nazar', 'dikhta', 'dekhne']):
        return "Ophthalmology"
    if any(word in symptoms for word in ['skin', 'rash', 'itch', 'acne', 'khujli', 'daane', 'tvacha', 'chaala', 'daag']):
        return "Dermatology"
    if any(word in symptoms for word in ['child', 'baby', 'kid', 'bacha', 'bache', 'shishu']):
        return "Pediatrics"
        
    return "General Medicine"

def check_emergency(symptoms: str) -> bool:
    symptoms = symptoms.lower()
    emergencies = ['heart attack', 'breath', 'unconscious', 'stroke', 'severe bleeding', 'accident']
    return any(word in symptoms for word in emergencies)

def classify_symptoms_with_gemini(symptoms: str) -> dict:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return {"department": "General Medicine", "is_emergency": False, "fallback": True}
        
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    
    prompt = f"""You are a triage assistant for a hospital kiosk.
Analyze the following patient symptom/problem description (which may be in English, Hindi, or Hinglish):
"{symptoms}"

Classify this problem into one of these 6 departments:
1. Cardiology (for heart-related issues, chest pain, palpitations, cardiovascular problems, high/low blood pressure)
2. Orthopaedics (for bones, joints, knee pain, fractures, back pain, limb injuries, musculoskeletal issues)
3. Ophthalmology (for eyes, vision, blurriness, cataracts, eye pain, eye redness)
4. Dermatology (for skin, rashes, itching, acne, hair, nails, skin infections)
5. Pediatrics (for infants, babies, children's health, child-specific issues)
6. General Medicine (for general illness, fever, cough, stomach ache, headache, or anything that doesn't fit the above)

Also determine if this is an EMERGENCY situation (e.g. chest pain, heart attack, unconsciousness, severe difficulty breathing, stroke, severe active bleeding, major accident).

Respond strictly in JSON format with two keys:
"department": must be one of the exact strings: "Cardiology", "Orthopaedics", "Ophthalmology", "Dermatology", "Pediatrics", "General Medicine"
"is_emergency": boolean value (true or false)
Do not include any markdown formatting or backticks like ```json. Just raw JSON.
"""

    payload = {
        "contents": [{
            "parts": [{"text": prompt}]
        }]
    }
    
    headers = {"Content-Type": "application/json"}
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=8)
        if response.status_code == 200:
            res_json = response.json()
            text = res_json['candidates'][0]['content']['parts'][0]['text'].strip()
            
            if text.startswith("```"):
                text = text.split("```", 1)[1]
                if text.startswith("json"):
                    text = text[4:]
                if "```" in text:
                    text = text.split("```", 1)[0]
            text = text.strip()
            
            data = json.loads(text)
            dept = data.get("department", "General Medicine")
            is_emergency = data.get("is_emergency", False)
            
            valid_depts = ["Cardiology", "Orthopaedics", "Ophthalmology", "Dermatology", "Pediatrics", "General Medicine"]
            if dept not in valid_depts:
                dept = "General Medicine"
                
            return {"department": dept, "is_emergency": is_emergency, "fallback": False}
        else:
            return {"department": "General Medicine", "is_emergency": False, "fallback": True}
    except Exception as e:
        print(f"Gemini API error: {e}")
        return {"department": "General Medicine", "is_emergency": False, "fallback": True}

@router.post("/classify", response_model=ClassifyResponse)
def classify_symptoms_endpoint(req: ClassifyRequest):
    # Check for direct department matches first to save API calls
    symptoms_lower = req.symptoms.strip().lower()
    valid_depts = ["cardiology", "orthopaedics", "ophthalmology", "dermatology", "pediatrics", "general medicine"]
    for d in valid_depts:
        if d == symptoms_lower:
            return ClassifyResponse(
                department=d.title() if d != "general medicine" else "General Medicine",
                is_emergency=False
            )
            
    # Try Gemini classification
    result = classify_symptoms_with_gemini(req.symptoms)
    
    if result.get("fallback", False):
        # Local classification fallback
        dept = classify_symptoms(req.symptoms)
        is_emergency = check_emergency(req.symptoms)
    else:
        dept = result.get("department", "General Medicine")
        is_emergency = result.get("is_emergency", False) or check_emergency(req.symptoms)
        
    return ClassifyResponse(department=dept, is_emergency=is_emergency)

@router.post("/generate", response_model=TokenResponse)
def generate_token(req: TokenCreateRequest, db: Session = Depends(get_raya_db)):
    if check_emergency(req.symptoms):
        raise HTTPException(
            status_code=400, 
            detail="EMERGENCY_DETECTED: Please proceed immediately to the Emergency Room."
        )
        
    department = classify_symptoms(req.symptoms)
    
    token_num = f"TK-{department[:3].upper()}-{random.randint(1000, 9999)}"
    
    new_token = TokenModel(
        token_number=token_num,
        department=department,
        patient_name=req.patient_name,
        abha_number=req.abha_number
    )
    
    db.add(new_token)
    db.commit()
    db.refresh(new_token)
    
    # Calculate queue position
    queue_pos = db.query(TokenModel).filter(
        TokenModel.department == department,
        TokenModel.status == "WAITING"
    ).count()
    
    return TokenResponse(
        token_number=token_num,
        department=department,
        patient_name=req.patient_name,
        queue_position=queue_pos,
        estimated_wait_minutes=queue_pos * 15, # 15 mins per patient
        status="WAITING",
        created_at=datetime.utcnow()
    )

@router.get("/queue", response_model=List[TokenResponse])
def get_queue(db: Session = Depends(get_raya_db)):
    tokens = db.query(TokenModel).filter(TokenModel.status == "WAITING").all()
    res = []
    for t in tokens:
        res.append(TokenResponse(
            token_number=t.token_number,
            department=t.department,
            patient_name=t.patient_name,
            queue_position=0,
            estimated_wait_minutes=0,
            status=t.status,
            created_at=t.created_at
        ))
    return res

@router.put("/queue/{token_number}/complete", response_model=TokenResponse)
def complete_token(token_number: str, db: Session = Depends(get_raya_db)):
    token = db.query(TokenModel).filter(TokenModel.token_number == token_number).first()
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    
    token.status = "COMPLETED"
    db.commit()
    db.refresh(token)
    
    return TokenResponse(
        token_number=token.token_number,
        department=token.department,
        patient_name=token.patient_name,
        queue_position=0,
        estimated_wait_minutes=0,
        status=token.status,
        created_at=token.created_at
    )

@router.delete("/queue/{token_number}")
def delete_token(token_number: str, db: Session = Depends(get_raya_db)):
    token = db.query(TokenModel).filter(TokenModel.token_number == token_number).first()
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    
    db.delete(token)
    db.commit()
    return {"message": "Token deleted successfully"}
