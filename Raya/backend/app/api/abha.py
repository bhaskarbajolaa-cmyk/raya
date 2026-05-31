import random
import json
import requests
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_abha_db
from app.models import domain
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

router = APIRouter()

class OTPSendRequest(BaseModel):
    mobile_number: str

class ABHARegisterRequest(BaseModel):
    full_name: str
    aadhaar_number: str
    gender: str
    mobile_number: str
    preferred_address_prefix: str

class ABHAProfileResponse(BaseModel):
    abha_number: str
    abha_address: str
    full_name: str
    aadhaar_number: str
    gender: str
    mobile_number: str
    
class ConsentRequest(BaseModel):
    abha_number: str
    consent_id: str

@router.post("/send_otp")
def send_otp(req: OTPSendRequest):
    otp_code = str(random.randint(100000, 999999))
    
    # Clean mobile number: remove spaces, +91, etc. Just keep last 10 digits
    clean_num = ''.join(filter(str.isdigit, req.mobile_number))
    if len(clean_num) > 10:
        clean_num = clean_num[-10:]
        
    import os
    TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
    TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
    TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER")
    
    if not TWILIO_ACCOUNT_SID:
        raise HTTPException(status_code=500, detail="Twilio credentials not configured")
        
    url = f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}/Messages.json"
    payload = {
        "Body": f"Your RAYA ABHA verification OTP is {otp_code}. Do not share this with anyone.",
        "From": TWILIO_PHONE_NUMBER,
        "To": f"+91{clean_num}"  # Prepending +91 since this is for India
    }
    
    try:
        response = requests.post(url, data=payload, auth=(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN))
        res_json = response.json()
        
        # Twilio returns 201 Created on success
        if response.status_code in [200, 201]:
            return {"success": True, "otp": otp_code, "message": "OTP sent successfully", "is_demo_fallback": False}
        else:
            # Fallback for PoC: if Twilio fails (e.g. unverified number on free tier),
            # silently return a master OTP (123456) so the demo can continue.
            err_msg = res_json.get('message', response.text)
            print(f"Twilio failed, falling back to dummy OTP. Error: {err_msg}")
            return {"success": True, "otp": "123456", "message": "OTP fallback active", "is_demo_fallback": True}
    except Exception as e:
        # Catch network errors and also fallback
        print(f"Network error, falling back to dummy OTP. Error: {str(e)}")
        return {"success": True, "otp": "123456", "message": "OTP fallback active", "is_demo_fallback": True}

@router.get("/profile/{abha_number}", response_model=ABHAProfileResponse)
def get_patient_profile(abha_number: str, db: Session = Depends(get_abha_db)):
    clean_num = abha_number.replace("-", "").strip()
    if len(clean_num) != 14 or not clean_num.isdigit():
        raise HTTPException(status_code=400, detail="ABHA number must be exactly 14 digits.")
        
    patient = db.query(domain.ABHAPatientModel).filter(domain.ABHAPatientModel.abha_number == abha_number).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")
    return patient

@router.get("/profile/address/{abha_address}", response_model=ABHAProfileResponse)
def get_patient_profile_by_address(abha_address: str, db: Session = Depends(get_abha_db)):
    if "@" not in abha_address:
        raise HTTPException(status_code=400, detail="Invalid ABHA address format.")
        
    patient = db.query(domain.ABHAPatientModel).filter(domain.ABHAPatientModel.abha_address == abha_address).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")
    return patient

@router.post("/register", response_model=ABHAProfileResponse)
def register_new_abha(req: ABHARegisterRequest, db: Session = Depends(get_abha_db)):
    part1 = f"{random.randint(10, 99)}"
    part2 = f"{random.randint(1000, 9999)}"
    part3 = f"{random.randint(1000, 9999)}"
    part4 = f"{random.randint(1000, 9999)}"
    
    abha_number = f"{part1}-{part2}-{part3}-{part4}"
    base_address = req.preferred_address_prefix.lower().replace(' ', '_')
    abha_address = f"{base_address}@abdm"
    
    existing = db.query(domain.ABHAPatientModel).filter(domain.ABHAPatientModel.abha_address == abha_address).first()
    if existing:
        abha_address = f"{base_address}{random.randint(100, 999)}@abdm"

    new_patient = domain.ABHAPatientModel(
        abha_number=abha_number,
        abha_address=abha_address,
        full_name=req.full_name,
        aadhaar_number=req.aadhaar_number,
        gender=req.gender,
        mobile_number=req.mobile_number,
        health_records=json.dumps([])
    )
    db.add(new_patient)
    db.commit()
    db.refresh(new_patient)
    return new_patient

@router.post("/consent")
def verify_consent_and_fetch_records(req: ConsentRequest, db: Session = Depends(get_abha_db)):
    patient = db.query(domain.ABHAPatientModel).filter(domain.ABHAPatientModel.abha_number == req.abha_number).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Simulate consent approval
    records = json.loads(patient.health_records) if patient.health_records else []
    return {"status": "CONSENT_GRANTED", "records": records}
