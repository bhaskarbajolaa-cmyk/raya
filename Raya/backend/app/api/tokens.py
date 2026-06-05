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
from app.models.domain import Base, DepartmentModel

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

def classify_symptoms(symptoms: str, db: Session) -> str:
    symptoms = symptoms.lower().strip()
    departments = db.query(DepartmentModel).all()
    
    # 1. Direct name match (case-insensitive)
    for d in departments:
        if d.name.lower() in symptoms or d.hindi_name in symptoms:
            return d.name
            
    # 2. Local symptom matches (fallback rules for default departments)
    if any(word in symptoms for word in ['heart', 'chest', 'bp', 'blood pressure', 'dil', 'chhati', 'dhadkan', 'saans', 'seene']):
        if any(d.name == "Cardiology" for d in departments):
            return "Cardiology"
    if any(word in symptoms for word in ['bone', 'fracture', 'joint', 'knee', 'back', 'haddi', 'ghutne', 'kamar', 'jod', 'pair', 'haath', 'chot']):
        if any(d.name == "Orthopaedics" for d in departments):
            return "Orthopaedics"
    if any(word in symptoms for word in ['eye', 'vision', 'blur', 'aankh', 'nazar', 'dikhta', 'dekhne']):
        if any(d.name == "Ophthalmology" for d in departments):
            return "Ophthalmology"
    if any(word in symptoms for word in ['skin', 'rash', 'itch', 'acne', 'khujli', 'daane', 'tvacha', 'chaala', 'daag']):
        if any(d.name == "Dermatology" for d in departments):
            return "Dermatology"
    if any(word in symptoms for word in ['child', 'baby', 'kid', 'bacha', 'bache', 'shishu']):
        if any(d.name == "Pediatrics" for d in departments):
            return "Pediatrics"
            
    # 3. Fallback check based on description keywords matching
    best_match = None
    max_matches = 0
    for d in departments:
        if not d.description:
            continue
        desc_words = [w.strip(",.() ").lower() for w in d.description.split() if len(w) > 4]
        matches = sum(1 for w in desc_words if w in symptoms)
        if matches > max_matches:
            max_matches = matches
            best_match = d.name
            
    if best_match and max_matches > 0:
        return best_match
        
    # 4. Final fallback to "General Medicine" if present, else first department
    for d in departments:
        if d.name == "General Medicine":
            return d.name
    return departments[0].name if departments else "General Medicine"

def check_emergency(symptoms: str) -> bool:
    symptoms = symptoms.lower()
    emergencies = ['heart attack', 'breath', 'unconscious', 'stroke', 'severe bleeding', 'accident']
    return any(word in symptoms for word in emergencies)

def classify_symptoms_with_gemini(symptoms: str, db: Session) -> dict:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return {"department": "General Medicine", "is_emergency": False, "fallback": True}
        
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    
    # Query departments dynamically
    departments = db.query(DepartmentModel).all()
    if not departments:
        return {"department": "General Medicine", "is_emergency": False, "fallback": True}
        
    # Build list of departments and descriptions
    dept_descriptions = []
    dept_names = []
    for d in departments:
        dept_names.append(d.name)
        desc_str = f" ({d.description})" if d.description else ""
        dept_descriptions.append(f"- {d.name}{desc_str}")
        
    depts_list_str = "\n".join(dept_descriptions)
    valid_depts_str = ", ".join([f'"{name}"' for name in dept_names])
    
    prompt = f"""You are a triage assistant for a hospital kiosk.
Analyze the following patient symptom/problem description (which may be in English, Hindi, or Hinglish):
"{symptoms}"

Classify this problem into one of the following available departments:
{depts_list_str}

Also determine if this is an EMERGENCY situation (e.g. chest pain, heart attack, unconsciousness, severe difficulty breathing, stroke, severe active bleeding, major accident).

Respond strictly in JSON format with two keys:
"department": must be one of the exact strings: {valid_depts_str}
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
            dept = data.get("department", "").strip()
            is_emergency = data.get("is_emergency", False)
            
            # Match back to database casing
            matched_dept = None
            for d in departments:
                if d.name.lower() == dept.lower():
                    matched_dept = d.name
                    break
                    
            if not matched_dept:
                for d in departments:
                    if d.name == "General Medicine":
                        matched_dept = d.name
                        break
                if not matched_dept:
                    matched_dept = departments[0].name
                    
            return {"department": matched_dept, "is_emergency": is_emergency, "fallback": False}
        else:
            return {"department": "General Medicine", "is_emergency": False, "fallback": True}
    except Exception as e:
        print(f"Gemini API error: {e}")
        return {"department": "General Medicine", "is_emergency": False, "fallback": True}

@router.post("/classify", response_model=ClassifyResponse)
def classify_symptoms_endpoint(req: ClassifyRequest, db: Session = Depends(get_raya_db)):
    # Check for direct department matches first to save API calls
    symptoms_lower = req.symptoms.strip().lower()
    departments = db.query(DepartmentModel).all()
    for d in departments:
        if d.name.lower() == symptoms_lower or d.hindi_name == symptoms_lower:
            return ClassifyResponse(
                department=d.name,
                is_emergency=False
            )
            
    # Try Gemini classification
    result = classify_symptoms_with_gemini(req.symptoms, db)
    
    if result.get("fallback", False):
        # Local classification fallback
        dept = classify_symptoms(req.symptoms, db)
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
        
    department = classify_symptoms(req.symptoms, db)
    
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
