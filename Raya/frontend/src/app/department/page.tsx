"use client";

import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, HeartPulse, Bone, Eye, Sparkles, Stethoscope, Baby } from "lucide-react";

const DEPARTMENTS = [
  { id: "Cardiology", name: "Cardiology", hindi: "हृदय रोग", icon: HeartPulse, color: "text-rose-500", bg: "bg-rose-500/10" },
  { id: "Orthopaedics", name: "Orthopaedics", hindi: "हड्डी रोग", icon: Bone, color: "text-amber-500", bg: "bg-amber-500/10" },
  { id: "Ophthalmology", name: "Ophthalmology", hindi: "नेत्र रोग", icon: Eye, color: "text-blue-500", bg: "bg-blue-500/10" },
  { id: "Dermatology", name: "Dermatology", hindi: "त्वचा रोग", icon: Sparkles, color: "text-purple-500", bg: "bg-purple-500/10" },
  { id: "Pediatrics", name: "Pediatrics", hindi: "बाल रोग", icon: Baby, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  { id: "General Medicine", name: "General Medicine", hindi: "सामान्य चिकित्सा", icon: Stethoscope, color: "text-teal-500", bg: "bg-teal-500/10" },
];

import { useEffect, useRef, useState } from "react";
import { User, Mic, MicOff, Loader2 } from "lucide-react";
import { useVoice } from "../../hooks/useVoice";

import { Suspense } from "react";

function DepartmentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const patientName = searchParams.get('name') || "Guest_Patient";
  const abha = searchParams.get('abha') || "";
  
  const { isListening, transcript, startListening, stopListening, resetTranscript, speak } = useVoice();
  const [isProcessing, setIsProcessing] = useState(false);

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

  const handleRecordToggle = async () => {
    if (isListening) {
      stopListening();
      if (transcript.length > 3) {
        setIsProcessing(true);
        speak("Aapki samasya process ho rahi hai.");
        // Find best department based on symptoms locally
        const text = transcript.toLowerCase();
        let bestDept = "General Medicine";
        const keywords: Record<string, string[]> = {
          "Cardiology": ["heart", "dil", "cardio", "chest", "chest pain", "chhati", "dard"],
          "Orthopaedics": ["bone", "haddi", "ortho", "joint", "knee", "pair", "haath"],
          "Ophthalmology": ["eye", "aankh", "vision", "blur"],
          "Dermatology": ["skin", "twacha", "rash", "itch", "khujli", "derma"],
          "Pediatrics": ["child", "baby", "bachcha", "pediatric"]
        };
        for (const [dept, words] of Object.entries(keywords)) {
          if (words.some(word => text.includes(word))) {
            bestDept = dept;
            break;
          }
        }
        
        // Pass it to the token screen (it handles generating and printing)
        router.push(`/token?dept=${bestDept}&name=${patientName}&abha=${abha}`);
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

      <div className="text-center mb-10 relative z-10">
        <h2 className="text-3xl font-bold mb-2 text-slate-900">Select Department or Record Symptoms</h2>
        <p className="text-blue-700 font-medium">विभाग चुनें या अपनी समस्या रिकॉर्ड करें</p>
      </div>

      {/* Manual Department Grid */}
      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-32 z-10">
        {DEPARTMENTS.map((dept, idx) => {
          const Icon = dept.icon;
          return (
              <motion.div
              key={dept.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSelect(dept.id)}
              className="glass-panel p-6 cursor-pointer hover:border-blue-600 hover:shadow-md transition-all group flex flex-col items-center text-center"
            >
              <div className={`${dept.bg} ${dept.color} p-4 rounded-2xl mb-4 group-hover:scale-110 transition-transform`}>
                <Icon className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold mb-1 text-slate-900">{dept.name}</h3>
              <h4 className="text-lg text-slate-600 font-medium">{dept.hindi}</h4>
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
