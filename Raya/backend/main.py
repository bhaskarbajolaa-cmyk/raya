from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api import users, abha, tokens, face, departments
from app.core.database import abha_engine, raya_engine
from app.models import domain

# Create database tables if they don't exist
domain.Base.metadata.create_all(bind=abha_engine)
domain.Base.metadata.create_all(bind=raya_engine)

# Seed default departments if table is empty
def seed_default_departments():
    from app.core.database import SessionLocalRaya
    from app.models.domain import DepartmentModel
    db = SessionLocalRaya()
    try:
        if db.query(DepartmentModel).count() == 0:
            default_depts = [
                DepartmentModel(
                    name="Cardiology", 
                    hindi_name="हृदय रोग", 
                    description="For heart-related issues, chest pain, palpitations, cardiovascular problems, high/low blood pressure",
                    icon="HeartPulse",
                    color="text-rose-500",
                    bg_color="bg-rose-500/10"
                ),
                DepartmentModel(
                    name="Orthopaedics", 
                    hindi_name="हड्डी रोग", 
                    description="For bones, joints, knee pain, fractures, back pain, limb injuries, musculoskeletal issues",
                    icon="Bone",
                    color="text-amber-500",
                    bg_color="bg-amber-500/10"
                ),
                DepartmentModel(
                    name="Ophthalmology", 
                    hindi_name="नेत्र रोग", 
                    description="For eyes, vision, blurriness, cataracts, eye pain, eye redness",
                    icon="Eye",
                    color="text-blue-500",
                    bg_color="bg-blue-500/10"
                ),
                DepartmentModel(
                    name="Dermatology", 
                    hindi_name="त्वचा रोग", 
                    description="For skin, rashes, itching, acne, hair, nails, skin infections",
                    icon="Sparkles",
                    color="text-purple-500",
                    bg_color="bg-purple-500/10"
                ),
                DepartmentModel(
                    name="Pediatrics", 
                    hindi_name="बाल रोग", 
                    description="For infants, babies, children's health, child-specific issues",
                    icon="Baby",
                    color="text-emerald-500",
                    bg_color="bg-emerald-500/10"
                ),
                DepartmentModel(
                    name="General Medicine", 
                    hindi_name="सामान्य चिकित्सा", 
                    description="For general illness, fever, cough, stomach ache, headache, or anything that doesn't fit the above",
                    icon="Stethoscope",
                    color="text-teal-500",
                    bg_color="bg-teal-500/10"
                ),
            ]
            db.bulk_save_objects(default_depts)
            db.commit()
            print("Default departments seeded successfully!")
    except Exception as e:
        print(f"Error seeding default departments: {e}")
    finally:
        db.close()

seed_default_departments()

app = FastAPI(title=settings.PROJECT_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(abha.router, prefix="/api/abha", tags=["abha"])
app.include_router(tokens.router, prefix="/api/tokens", tags=["tokens"])
app.include_router(face.router, prefix="/api/face", tags=["face"])
app.include_router(departments.router, prefix="/api/departments", tags=["departments"])

@app.get("/")
def read_root():
    return {"message": f"Welcome to {settings.PROJECT_NAME} API"}
