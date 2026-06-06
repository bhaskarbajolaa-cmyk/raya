"use client";

import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, User, Mic, MicOff, Loader2, Camera, X, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import * as Icons from "lucide-react";

import { useEffect, useRef, useState } from "react";
import { useVoice } from "../../hooks/useVoice";
import { Suspense } from "react";


function DepartmentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const patientName = searchParams.get('name') || "Guest_Patient";
  const abha = searchParams.get('abha') || "";
  
  const { isListening, transcript, startListening, stopListening, resetTranscript, speak } = useVoice();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);

  // States for face ID update modal
  const [showFaceModal, setShowFaceModal] = useState(false);
  const [faceModalLoading, setFaceModalLoading] = useState(false);
  const [faceModalError, setFaceModalError] = useState("");
  const [faceModalSuccess, setFaceModalSuccess] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const faceVideoRef = useRef<HTMLVideoElement>(null);

  // Camera handler for Face ID update modal
  useEffect(() => {
    let activeStream: MediaStream | null = null;

    const startFaceCamera = async () => {
      if (!showFaceModal) return;
      
      setFaceModalError("");
      setFaceModalSuccess(false);
      setFaceModalLoading(false);
      setCountdown(3);

      try {
        activeStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        setCameraStream(activeStream);
        if (faceVideoRef.current) {
          faceVideoRef.current.srcObject = activeStream;
        }
      } catch (err) {
        console.error("Camera access failed:", err);
        setFaceModalError("Unable to access camera. Please check permissions. / कैमरा एक्सेस नहीं मिला।");
        setCountdown(null);
      }
    };

    startFaceCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
      setCameraStream(null);
    };
  }, [showFaceModal]);

  // Countdown timer effect
  useEffect(() => {
    if (countdown === null || countdown <= 0 || !cameraStream) return;

    const timer = setTimeout(() => {
      setCountdown(prev => {
        if (prev === 1) {
          captureFaceImage();
          return 0;
        }
        return prev !== null ? prev - 1 : null;
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, cameraStream]);

  const captureFaceImage = async () => {
    if (!faceVideoRef.current || !abha) return;

    setFaceModalLoading(true);
    setFaceModalError("");

    try {
      const canvas = document.createElement("canvas");
      canvas.width = faceVideoRef.current.videoWidth || 640;
      canvas.height = faceVideoRef.current.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      
      if (!ctx) {
        throw new Error("Could not initialize canvas context");
      }

      ctx.drawImage(faceVideoRef.current, 0, 0, canvas.width, canvas.height);
      const base64Image = canvas.toDataURL("image/jpeg");

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/api/face/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          abha_number: abha,
          image_base64: base64Image
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to update Face ID");
      }

      setFaceModalSuccess(true);
      speak("Aapka face ID update ho gaya hai.");
      
      // Auto close after 2 seconds
      setTimeout(() => {
        closeFaceModal();
      }, 2000);

    } catch (err: any) {
      console.error("Failed to register face:", err);
      setFaceModalError(err.message || "Failed to update Face ID. Please try again. / फेस आईडी अपडेट करने में विफल।");
      setCountdown(null); // Stop countdown
    } finally {
      setFaceModalLoading(false);
    }
  };

  const closeFaceModal = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
    }
    setCameraStream(null);
    setShowFaceModal(false);
    setCountdown(null);
    setFaceModalSuccess(false);
    setFaceModalError("");
    setFaceModalLoading(false);
  };

  const retryCapture = () => {
    setFaceModalError("");
    setFaceModalSuccess(false);
    setFaceModalLoading(false);
    setCountdown(3);
  };

  const DEFAULT_DEPARTMENTS = [
    { id: 1, name: "Cardiology", hindi_name: "हृदय रोग", icon: "HeartPulse", color: "text-rose-500", bg_color: "bg-rose-500/10", description: "For heart-related issues, chest pain, palpitations, cardiovascular problems, high/low blood pressure" },
    { id: 2, name: "Orthopaedics", hindi_name: "हड्डी रोग", icon: "Bone", color: "text-amber-500", bg_color: "bg-amber-500/10", description: "For bones, joints, knee pain, fractures, back pain, limb injuries, musculoskeletal issues" },
    { id: 3, name: "Ophthalmology", hindi_name: "नेत्र रोग", icon: "Eye", color: "text-blue-500", bg_color: "bg-blue-500/10", description: "For eyes, vision, blurriness, cataracts, eye pain, eye redness" },
    { id: 4, name: "Dermatology", hindi_name: "त्वचा रोग", icon: "Sparkles", color: "text-purple-500", bg_color: "bg-purple-500/10", description: "For skin, rashes, itching, acne, hair, nails, skin infections" },
    { id: 5, name: "Pediatrics", hindi_name: "बाल रोग", icon: "Baby", color: "text-emerald-500", bg_color: "bg-emerald-500/10", description: "For infants, babies, children's health, child-specific issues" },
    { id: 6, name: "General Medicine", hindi_name: "सामान्य चिकित्सा", icon: "Stethoscope", color: "text-teal-500", bg_color: "bg-teal-500/10", description: "For general illness, fever, cough, stomach ache, headache, or anything that doesn't fit the above" },
  ];

  const [departments, setDepartments] = useState<any[]>(DEFAULT_DEPARTMENTS);

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const res = await fetch(`${apiUrl}/api/departments`);
        if (res.ok) {
          const data = await res.json();
          setDepartments(data);
        }
      } catch (err) {
        console.error("Failed to fetch departments:", err);
      }
    };
    fetchDepartments();
  }, []);

  // 30-second idle timeout for touch UI
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetTimeout = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      router.push('/');
    }, 60000); 
  };

  useEffect(() => {
    resetTimeout();
    window.addEventListener('mousemove', resetTimeout);
    window.addEventListener('keydown', resetTimeout);
    window.addEventListener('touchstart', resetTimeout);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      window.removeEventListener('mousemove', resetTimeout);
      window.removeEventListener('keydown', resetTimeout);
      window.removeEventListener('touchstart', resetTimeout);
    };
  }, [router]);

  const handleSelect = (dept: string) => {
    router.push(`/token?dept=${dept}&name=${patientName}&abha=${abha}`);
  };

  const getLocalClassification = (text: string) => {
    const symptoms = text.toLowerCase().trim();
    
    // 1. Direct name match
    for (const d of departments) {
      if (symptoms.includes(d.name.toLowerCase()) || symptoms.includes(d.hindi_name.toLowerCase())) {
        return d.name;
      }
    }
    
    // 2. Default keywords fallback
    const keywords: Record<string, string[]> = {
      "Cardiology": ["heart", "dil", "cardio", "chest", "chest pain", "chhati", "bp", "blood pressure", "seene", "dhadkan", "saans"],
      "Orthopaedics": ["bone", "haddi", "ortho", "joint", "knee", "pair", "haath", "kamar", "jod", "chot", "fracture"],
      "Ophthalmology": ["eye", "aankh", "vision", "blur", "nazar", "dikhta", "dekhne"],
      "Dermatology": ["skin", "twacha", "rash", "itch", "khujli", "derma", "acne", "daane", "daag"],
      "Pediatrics": ["child", "baby", "bachcha", "pediatric", "kid", "bache", "shishu"]
    };
    for (const [deptName, words] of Object.entries(keywords)) {
      if (words.some(word => symptoms.includes(word))) {
        if (departments.some(d => d.name === deptName)) {
          return deptName;
        }
      }
    }
    
    // 3. Fallback description keywords matching
    let bestMatch = null;
    let maxMatches = 0;
    for (const d of departments) {
      if (!d.description) continue;
      const descWords = d.description.toLowerCase().split(/\s+/).filter((w: string) => w.length > 4);
      const matches = descWords.filter((w: string) => symptoms.includes(w)).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        bestMatch = d.name;
      }
    }
    if (bestMatch && maxMatches > 0) return bestMatch;
    
    // 4. Default fallback to General Medicine
    const genMed = departments.find(d => d.name === "General Medicine");
    return genMed ? genMed.name : (departments[0]?.name || "General Medicine");
  };

  const getLocalEmergencyCheck = (text: string) => {
    const symptoms = text.toLowerCase();
    const emergencies = ['heart attack', 'breath', 'unconscious', 'stroke', 'severe bleeding', 'accident'];
    return emergencies.some(word => symptoms.includes(word));
  };

  const handleRecordToggle = async () => {
    if (isListening) {
      stopListening();
      if (transcript.length > 3) {
        setIsProcessing(true);
        speak("Aapki samasya process ho rahi hai.");
        
        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
          const res = await fetch(`${apiUrl}/api/tokens/classify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symptoms: transcript })
          });
          
          if (res.ok) {
            const data = await res.json();
            setIsProcessing(false);
            if (data.is_emergency) {
              speak("Emergency detected. Please proceed to the Emergency Room immediately.");
              setShowEmergencyModal(true);
            } else {
              router.push(`/token?dept=${data.department}&name=${patientName}&abha=${abha}`);
            }
          } else {
            throw new Error("Failed backend classification");
          }
        } catch (err) {
          console.error("Gemini classification failed, falling back locally:", err);
          // Fallback locally
          const isEmergency = getLocalEmergencyCheck(transcript);
          setIsProcessing(false);
          if (isEmergency) {
            speak("Emergency detected. Please proceed to the Emergency Room immediately.");
            setShowEmergencyModal(true);
          } else {
            const bestDept = getLocalClassification(transcript);
            router.push(`/token?dept=${bestDept}&name=${patientName}&abha=${abha}`);
          }
        }
      } else {
        speak("Aapki aawaz theek se sunai nahi di. Phir try karein.");
        resetTranscript();
      }
    } else {
      resetTranscript();
      startListening();
    }
  };

  return (
    <main className="relative min-h-screen flex flex-col items-center py-10 px-6 overflow-hidden">
      
      {/* Top Header with Back button and User Info */}
      <div className="w-full max-w-5xl flex justify-between items-center mb-10 z-10">
        <button 
          onClick={() => router.back()}
          className="flex items-center text-slate-500 hover:text-blue-900 transition-colors font-medium"
        >
          <ArrowLeft className="mr-2" /> Back / वापस जाएँ
        </button>

        <div className="flex items-center gap-4">
          {abha && (
            <button
              onClick={() => setShowFaceModal(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3 px-5 rounded-2xl border border-emerald-500/20 shadow-md transition-all hover:scale-105 active:scale-95"
            >
              <Camera className="w-5 h-5" />
              <span>Update Face ID / फेस आईडी बदलें</span>
            </button>
          )}

          {/* User Indication Top Right */}
          <div className="flex items-center bg-white px-5 py-3 rounded-2xl border border-slate-200 shadow-sm">
            <User className="w-8 h-8 text-emerald-600 mr-3" />
            <div className="flex flex-col text-left">
              <span className="text-slate-900 font-medium text-sm">
                Welcome, <span className="text-emerald-700 text-base">{patientName}</span>
              </span>
              {abha && (
                <span className="text-slate-500 text-xs font-mono mt-0.5 tracking-wider">
                  ABHA: {abha}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="text-center mb-10 relative z-10">
        <h2 className="text-3xl font-bold mb-2 text-slate-900">Select Department or Record Symptoms</h2>
        <p className="text-blue-700 font-medium">विभाग चुनें या अपनी समस्या रिकॉर्ड करें</p>
      </div>

      {/* Manual Department Grid */}
      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-32 z-10">
        {departments.map((dept, idx) => {
          const IconComponent = (Icons as any)[dept.icon] || Icons.Stethoscope;
          return (
            <motion.div
              key={dept.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSelect(dept.name)}
              className="glass-panel p-6 cursor-pointer hover:border-blue-600 hover:shadow-md transition-all group flex flex-col items-center text-center"
            >
              <div className={`${dept.bg_color || "bg-teal-500/10"} ${dept.color || "text-teal-500"} p-4 rounded-2xl mb-4 group-hover:scale-110 transition-transform`}>
                <IconComponent className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold mb-1 text-slate-900">{dept.name}</h3>
              <h4 className="text-lg text-slate-600 font-medium">{dept.hindi_name}</h4>
            </motion.div>
          );
        })}
      </div>

      {/* Floating Push-to-Talk Record Button */}
      <div className="fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-md border-t border-slate-200 p-6 flex flex-col items-center z-50 shadow-lg">
        <div className="flex items-center justify-center gap-6">
          <button
            onClick={handleRecordToggle}
            className={`relative flex items-center justify-center w-20 h-20 rounded-full transition-all duration-300 shadow-md ${
              isListening ? 'bg-rose-100 border-4 border-rose-500 animate-pulse' : 'bg-emerald-600 hover:bg-emerald-500'
            }`}
          >
            {isProcessing ? (
               <Loader2 className="w-8 h-8 text-white animate-spin" />
            ) : isListening ? (
               <Mic className="w-10 h-10 text-rose-600" />
            ) : (
               <Mic className="w-10 h-10 text-white" />
            )}
          </button>
          
          <div className="flex flex-col">
             <span className="text-xl font-bold text-slate-900">
               {isListening ? "Listening..." : "Or Tap to Explain Your Problem"}
             </span>
             <span className="text-slate-600 italic">
               {isListening && transcript ? `"${transcript}"` : (isListening ? "Speak now, tap again to stop..." : "Bataein aapko kya samasya hai")}
             </span>
          </div>
        </div>
      </div>

      {/* Emergency Modal */}
      {showEmergencyModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-3xl p-8 max-w-lg w-full text-center border-t-8 border-t-rose-600 shadow-2xl relative"
          >
            <div className="bg-rose-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
              <span className="text-4xl">🚨</span>
            </div>
            
            <h3 className="text-3xl font-black text-rose-600 mb-2 tracking-tight">EMERGENCY DETECTED</h3>
            <h4 className="text-xl font-bold text-slate-800 mb-6">आपातकालीन स्थिति</h4>
            
            <div className="bg-rose-50 text-rose-900 rounded-2xl p-6 text-left border border-rose-100 mb-8">
              <p className="font-bold text-lg mb-2 text-rose-800">Please proceed immediately to the Emergency Room (ER).</p>
              <p className="text-rose-700 font-medium">कृपया तुरंत अस्पताल के आपातकालीन कक्ष (Emergency Room) में जाएँ।</p>
            </div>
            
            <button
              onClick={() => {
                setShowEmergencyModal(false);
                router.push('/');
              }}
              className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-4 px-6 rounded-2xl transition-all shadow-md hover:shadow-lg text-lg"
            >
              Go to Home / वापस जाएँ
            </button>
          </motion.div>
        </div>
      )}

      {/* Update Face ID Modal */}
      {showFaceModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-3xl p-8 max-w-md w-full text-center border-t-8 border-t-emerald-600 shadow-2xl relative"
          >
            <button
              onClick={closeFaceModal}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-full hover:bg-slate-100"
            >
              <X className="w-6 h-6" />
            </button>

            <h3 className="text-2xl font-bold text-slate-900 mb-1">Update Face ID</h3>
            <p className="text-emerald-700 font-medium text-sm mb-6">अपना फेस आईडी अपडेट करें</p>

            <div className="w-72 h-72 rounded-2xl border-4 border-emerald-500/50 overflow-hidden relative mx-auto mb-6 bg-slate-950 shadow-inner">
              {cameraStream ? (
                <>
                  <video
                    ref={faceVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
                  />
                  {/* Scanning line animation */}
                  {!faceModalSuccess && !faceModalError && (
                    <div className="absolute w-full h-1 bg-emerald-500 shadow-[0_0_15px_#10b981] animate-[scan_2.5s_ease-in-out_infinite] z-10" />
                  )}
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 p-4">
                  {faceModalError ? (
                    <AlertCircle className="w-12 h-12 text-rose-500 mb-2" />
                  ) : (
                    <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mb-2" />
                  )}
                  <p className="text-sm font-medium">
                    {faceModalError ? "Camera Access Failed" : "Starting camera..."}
                  </p>
                </div>
              )}

              {/* Countdown Overlay */}
              {countdown !== null && countdown > 0 && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-20">
                  <motion.span
                    key={countdown}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1.2, opacity: 1 }}
                    exit={{ scale: 1.5, opacity: 0 }}
                    className="text-white text-7xl font-extrabold"
                  >
                    {countdown}
                  </motion.span>
                </div>
              )}

              {/* Success Overlay */}
              {faceModalSuccess && (
                <div className="absolute inset-0 bg-emerald-950/80 backdrop-blur-sm flex flex-col items-center justify-center z-20 p-4">
                  <CheckCircle className="w-16 h-16 text-emerald-400 mb-2 animate-bounce" />
                  <p className="text-white font-bold text-lg">Face ID Updated!</p>
                  <p className="text-emerald-200 text-sm">सफलतापूर्वक अपडेट किया गया</p>
                </div>
              )}
            </div>

            {/* Error Message & Controls */}
            {faceModalError ? (
              <div className="mb-6">
                <p className="text-rose-600 font-semibold text-sm mb-4 bg-rose-50 p-3 rounded-xl border border-rose-100">
                  {faceModalError}
                </p>
                <button
                  onClick={retryCapture}
                  className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-md active:scale-95"
                >
                  <RefreshCw className="w-5 h-5" />
                  Retry / पुनः प्रयास करें
                </button>
              </div>
            ) : faceModalLoading ? (
              <div className="flex flex-col items-center justify-center gap-2 mb-6">
                <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
                <p className="text-slate-700 font-medium text-sm">Processing image & updating... / प्रोसेस किया जा रहा है...</p>
              </div>
            ) : !faceModalSuccess ? (
              <p className="text-slate-500 text-sm mb-6">
                Please look directly into the camera. We will take a photo automatically.
              </p>
            ) : (
              <p className="text-emerald-700 font-semibold text-sm mb-6">
                Closing window...
              </p>
            )}

            <button
              onClick={closeFaceModal}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3.5 px-6 rounded-2xl transition-all"
            >
              Cancel / रद्द करें
            </button>
          </motion.div>
        </div>
      )}
      
    </main>
  );
}

export default function DepartmentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-900 text-xl font-medium">Loading department...</div>}>
      <DepartmentContent />
    </Suspense>
  );
}
