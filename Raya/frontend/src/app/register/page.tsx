"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, User, Calendar, Phone, CheckCircle, Camera } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [otpStep, setOtpStep] = useState(false);
  const [expectedOtp, setExpectedOtp] = useState("");
  const [enteredOtp, setEnteredOtp] = useState("");
  const [isFallback, setIsFallback] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [formData, setFormData] = useState({
    full_name: "",
    aadhaar_number: "",
    gender: "M",
    mobile_number: "",
    preferred_address_prefix: ""
  });

  // Start webcam
  useEffect(() => {
    let stream: MediaStream | null = null;
    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Camera permission denied", err);
      }
    };
    startCamera();
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, []);

  const handleChange = (e: any) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/abha/send_otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile_number: formData.mobile_number })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to send OTP");
      
      setExpectedOtp(data.otp);
      setIsFallback(data.is_demo_fallback || false);
      setOtpStep(true);
    } catch (error: any) {
      setErrorMsg(error.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const verifyOTPAndRegister = async () => {
    if (enteredOtp !== expectedOtp) {
      setErrorMsg("Invalid OTP. Please try again.");
      return;
    }
    
    setLoading(true);
    setErrorMsg("");

    try {
      // 1. Register ABHA Profile
      const abhaRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/abha/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      
      if (!abhaRes.ok) throw new Error("Failed to create ABHA profile");
      const abhaData = await abhaRes.json();
      
      // 2. Capture face frame
      let base64Image = "";
      if (videoRef.current) {
        const canvas = document.createElement("canvas");
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          base64Image = canvas.toDataURL("image/jpeg");
        }
      }

      // 3. Register Face Biometrics in RAYA
      if (base64Image) {
        const faceRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/face/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            abha_number: abhaData.abha_number,
            image_base64: base64Image
          })
        });
        if (!faceRes.ok) console.warn("Failed to enroll biometrics, but ABHA was created");
      }

      setSuccess(true);
      setTimeout(() => {
        router.push(`/department?name=${encodeURIComponent(abhaData.full_name)}&abha=${encodeURIComponent(abhaData.abha_number)}`);
      }, 2000);
      
    } catch (error: any) {
      setErrorMsg(error.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-slate-50 text-slate-900">
        <CheckCircle className="w-24 h-24 text-emerald-500 mb-6" />
        <h2 className="text-3xl font-bold mb-4">Registration Successful!</h2>
        <p className="text-slate-600 text-xl">Routing you to department selection...</p>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen flex flex-col items-center py-10 px-6 overflow-y-auto bg-slate-50">
      <div className="w-full max-w-5xl flex justify-between items-center mb-10">
        <button 
          onClick={() => router.back()}
          className="flex items-center text-slate-500 hover:text-blue-900 transition-colors font-medium"
        >
          <ArrowLeft className="mr-2" /> Back / वापस जाएँ
        </button>
        <h2 className="text-2xl font-bold text-slate-900">New Patient Registration</h2>
      </div>

      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-10">
        
        {/* Left Side: Form */}
        <div className="glass-panel p-10 border-t-4 border-t-blue-600 relative">
          {!otpStep ? (
            <>
              <h3 className="text-2xl font-semibold mb-6 text-slate-900">Create ABHA ID</h3>
              <form onSubmit={handleSendOTP} className="flex flex-col gap-4">
            <div>
              <label className="block text-slate-700 mb-1 font-medium text-sm">Full Name</label>
              <input type="text" name="full_name" required onChange={handleChange} className="w-full bg-white border border-slate-300 rounded-lg p-3 text-slate-900 shadow-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" placeholder="John Doe" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-700 mb-1 font-medium text-sm">Aadhaar Number</label>
                <input type="text" name="aadhaar_number" required onChange={handleChange} className="w-full bg-white border border-slate-300 rounded-lg p-3 text-slate-900 shadow-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" placeholder="12-digit Aadhaar" />
              </div>
              <div>
                <label className="block text-slate-700 mb-1 font-medium text-sm">Gender</label>
                <select name="gender" onChange={handleChange} className="w-full bg-white border border-slate-300 rounded-lg p-3 text-slate-900 shadow-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600">
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                  <option value="O">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 mb-1 font-medium text-sm">Mobile Number</label>
              <input type="tel" name="mobile_number" required onChange={handleChange} className="w-full bg-white border border-slate-300 rounded-lg p-3 text-slate-900 shadow-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" placeholder="10-digit number" />
            </div>

            <div>
              <label className="block text-slate-700 mb-1 font-medium text-sm">Preferred ABHA Address (e.g. john)</label>
              <div className="flex shadow-sm rounded-lg">
                <input type="text" name="preferred_address_prefix" required onChange={handleChange} className="flex-1 bg-white border border-slate-300 rounded-l-lg p-3 text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" placeholder="johndoe" />
                <div className="bg-slate-100 border border-slate-300 border-l-0 rounded-r-lg p-3 text-slate-600 font-medium">@abdm</div>
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full bg-blue-900 hover:bg-blue-800 text-white font-bold py-4 rounded-xl text-lg mt-4 transition-all shadow-md">
              {loading ? "Sending OTP..." : "Send OTP to Mobile"}
            </button>
            {errorMsg && <p className="text-red-500 text-center font-medium text-sm">{errorMsg}</p>}
          </form>
          </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <h3 className="text-2xl font-semibold mb-4 text-slate-900">Enter OTP</h3>
              
              {isFallback ? (
                <div className="bg-amber-100 border border-amber-300 text-amber-800 p-4 rounded-xl mb-6 text-left w-full max-w-sm">
                  <p className="font-semibold mb-1 flex items-center gap-2">⚠️ Demo Mode Active</p>
                  <p className="text-sm">This number is not verified with Twilio. For the demo, please enter OTP: <span className="font-bold text-lg text-amber-900 ml-2">{expectedOtp}</span></p>
                </div>
              ) : (
                <p className="text-slate-600 font-medium mb-6">An OTP has been sent to {formData.mobile_number}</p>
              )}
              
              <input 
                type="text" 
                maxLength={6}
                value={enteredOtp}
                onChange={(e) => setEnteredOtp(e.target.value)} 
                className="w-full max-w-[200px] text-center bg-white border border-slate-300 shadow-sm rounded-lg p-4 text-slate-900 text-2xl tracking-widest focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 mb-6" 
                placeholder="000000" 
              />
              <button 
                onClick={verifyOTPAndRegister}
                disabled={loading || enteredOtp.length !== 6} 
                className="w-full max-w-[200px] bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-4 rounded-xl text-lg transition-all shadow-md"
              >
                {loading ? "Verifying..." : "Verify & Register"}
              </button>
              {errorMsg && <p className="text-red-500 font-medium text-center text-sm mt-4">{errorMsg}</p>}
            </div>
          )}
        </div>

        {/* Right Side: Face Capture */}
        <div className="glass-panel p-10 flex flex-col items-center justify-center text-center border-t-4 border-t-emerald-500">
          <h3 className="text-2xl font-semibold mb-2 text-slate-900">Face Enrollment</h3>
          <p className="text-slate-600 mb-8 text-sm">We will securely save a mathematical representation of your face so you can skip manual login next time.</p>
          
          <div className="w-64 h-64 rounded-2xl border-2 border-emerald-500/50 mb-6 overflow-hidden relative bg-emerald-50">
            <video 
              ref={videoRef}
              autoPlay 
              playsInline 
              muted 
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 border-4 border-transparent border-t-emerald-500/50 rounded-2xl animate-spin" style={{ animationDuration: '3s' }} />
          </div>
          
          <div className="flex items-center text-emerald-600 text-sm font-medium">
            <Camera className="w-4 h-4 mr-2" />
            Camera Active
          </div>
        </div>

      </div>
    </main>
  );
}
