from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from app.core.database import get_raya_db
from app.models.domain import DepartmentModel

router = APIRouter()

class DepartmentBase(BaseModel):
    name: str
    hindi_name: str
    description: Optional[str] = None
    icon: Optional[str] = "Stethoscope"
    color: Optional[str] = "text-teal-500"
    bg_color: Optional[str] = "bg-teal-500/10"

class DepartmentCreate(DepartmentBase):
    pass

class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    hindi_name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    bg_color: Optional[str] = None

class DepartmentResponse(DepartmentBase):
    id: int

    class Config:
        from_attributes = True

@router.get("/", response_model=List[DepartmentResponse])
def get_departments(db: Session = Depends(get_raya_db)):
    return db.query(DepartmentModel).all()

@router.post("/", response_model=DepartmentResponse)
def create_department(req: DepartmentCreate, db: Session = Depends(get_raya_db)):
    # Check if department already exists (case-insensitive checks)
    existing = db.query(DepartmentModel).filter(DepartmentModel.name.ilike(req.name)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Department with this name already exists")
    
    new_dept = DepartmentModel(
        name=req.name,
        hindi_name=req.hindi_name,
        description=req.description,
        icon=req.icon,
        color=req.color,
        bg_color=req.bg_color
    )
    db.add(new_dept)
    db.commit()
    db.refresh(new_dept)
    return new_dept

@router.put("/{id}", response_model=DepartmentResponse)
def update_department(id: int, req: DepartmentUpdate, db: Session = Depends(get_raya_db)):
    dept = db.query(DepartmentModel).filter(DepartmentModel.id == id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    
    update_data = req.model_dump(exclude_unset=True)
    
    # Check conflicting names
    if "name" in update_data and update_data["name"] != dept.name:
        existing = db.query(DepartmentModel).filter(DepartmentModel.name.ilike(update_data["name"])).first()
        if existing:
            raise HTTPException(status_code=400, detail="Department with this name already exists")
            
    for key, value in update_data.items():
        setattr(dept, key, value)
        
    db.commit()
    db.refresh(dept)
    return dept

@router.delete("/{id}")
def delete_department(id: int, db: Session = Depends(get_raya_db)):
    dept = db.query(DepartmentModel).filter(DepartmentModel.id == id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
        
    # Prevent deleting the last department
    total_depts = db.query(DepartmentModel).count()
    if total_depts <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete the last remaining department")
        
    db.delete(dept)
    db.commit()
    return {"message": "Department deleted successfully"}
