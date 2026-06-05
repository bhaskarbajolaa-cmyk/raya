"use client";

import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { Printer, CheckCircle, Clock, Users } from "lucide-react";

import { Suspense } from "react";

function TokenContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tokenData, setTokenData] = useState<any>(null);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    const generateToken = async () => {
      const dept = searchParams.get('dept') || "General Medicine";
      const name = searchParams.get('name') || "Guest";
      const abha = searchParams.get('abha') || "";
      
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/tokens/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patient_name: name,
            symptoms: dept, // We pass dept as symptoms so backend classifies it correctly
            abha_number: abha
          })
        });
        
        if (res.ok) {
          const data = await res.json();
          setTokenData(data);
        }
      } catch (err) {
        console.error("Failed to generate token", err);
      }
    };
    
    generateToken();

    // Auto-return to home after 15 seconds

    const timeout = setTimeout(() => router.push('/'), 15000);
    return () => clearTimeout(timeout);
  }, [searchParams, router]);

  if (!tokenData) return <div className="min-h-screen flex items-center justify-center">Generating...</div>;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 relative bg-slate-50 text-slate-900">
      {/* Background */}
      <div className="absolute inset-0 bg-blue-900/5 blur-[150px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-panel p-10 w-full max-w-2xl relative overflow-hidden text-center border-t-8 border-t-emerald-600 shadow-xl"
      >
        <div className="bg-emerald-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
          <CheckCircle className="w-12 h-12 text-emerald-600" />
        </div>
        
        <h2 className="text-3xl font-bold mb-2 text-slate-900">Token Generated Successfully</h2>
        <p className="text-emerald-700 text-xl mb-8 font-medium">टोकन सफलतापूर्वक बन गया</p>

        <div className="bg-slate-50 rounded-3xl p-8 mb-8 border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-lg uppercase tracking-wider mb-2 font-medium">Your Token Number</p>
          <div className="text-6xl md:text-8xl font-black text-slate-900 tracking-tighter mb-4">
            {tokenData.token_number}
          </div>
          <div className="text-2xl text-blue-700 font-bold mb-6">
            {tokenData.department}
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-slate-200 pt-6">
            <div className="flex flex-col items-center">
              <Users className="text-slate-500 mb-2 w-8 h-8" />
              <p className="text-slate-600 font-medium">Queue Position</p>
              <p className="text-3xl font-bold text-slate-900">{tokenData.queue_position}</p>
            </div>
            <div className="flex flex-col items-center">
              <Clock className="text-slate-500 mb-2 w-8 h-8" />
              <p className="text-slate-600 font-medium">Est. Wait Time</p>
              <p className="text-3xl font-bold text-slate-900">{tokenData.estimated_wait_minutes} min</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 justify-center">
          <button 
            className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-8 py-4 rounded-xl text-lg font-bold flex items-center justify-center transition-colors shadow-sm"
            onClick={() => window.print()}
          >
            <Printer className="mr-2" /> Print Token / प्रिंट करें
          </button>
          <button 
            className="bg-blue-900 hover:bg-blue-800 text-white px-8 py-4 rounded-xl text-lg font-bold transition-colors shadow-md"
            onClick={() => router.push('/')}
          >
            Done / समाप्त
          </button>
        </div>
      </motion.div>
    </main>
  );
}

export default function TokenPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-900 font-medium">Loading token...</div>}>
      <TokenContent />
    </Suspense>
  );
}
