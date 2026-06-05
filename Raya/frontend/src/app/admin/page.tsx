"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, Users, List, RefreshCw, CheckCircle, Trash2, Filter } from "lucide-react";

export default function AdminDashboard() {
  const [tokens, setTokens] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tokenRes, userRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/tokens/queue?t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/users/?t=${Date.now()}`, { cache: 'no-store' })
      ]);
      if (tokenRes.ok) setTokens(await tokenRes.json());
      if (userRes.ok) setUsers(await userRes.json());
    } catch (err) {
      console.error("Failed to fetch admin data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Auto-refresh every 5 seconds
    const interval = setInterval(() => {
      fetchData();
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const handleCompleteToken = async (token_number: string) => {
    // This will mark the token as COMPLETED, removing it from the active WAITING queue.
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/tokens/queue/${token_number}/complete`, { method: "PUT" });
      fetchData();
    } catch (err) {
      console.error("Failed to complete token", err);
    }
  };

  const handleDeleteToken = async (token_number: string) => {
    if (!confirm("Are you sure you want to permanently delete this token?")) return;
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/tokens/queue/${token_number}`, { method: "DELETE" });
      fetchData();
    } catch (err) {
      console.error("Failed to delete token", err);
    }
  };

  const handleDeleteUser = async (user_id: number) => {
    if (!confirm("Are you sure you want to delete this enrolled biometric profile?")) return;
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/users/${user_id}`, { method: "DELETE" });
      fetchData();
    } catch (err) {
      console.error("Failed to delete user", err);
    }
  };

  // Fixed list of departments
  const ALL_DEPARTMENTS = ["Cardiology", "Orthopaedics", "Ophthalmology", "Dermatology", "Pediatrics", "General Medicine"];
  
  // Filter tokens based on selected department
  const filteredTokens = selectedDept 
    ? tokens.filter(t => t.department === selectedDept)
    : tokens;

  return (
    <main className="min-h-screen p-10 bg-slate-50 text-slate-900">
      <div className="flex justify-between items-center mb-10 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-4xl font-bold flex items-center gap-4 text-slate-900">
            <Activity className="text-blue-900 w-10 h-10" /> 
            RAYA Admin Dashboard
          </h1>
          <p className="text-slate-600 mt-2 font-medium">Live view of local RAYA and ABHA interactions</p>
        </div>
        <button 
          onClick={fetchData}
          className="bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 shadow-sm p-3 rounded-full transition-colors flex items-center"
          title="Refresh Data"
        >
          <RefreshCw className={`w-6 h-6 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
        
        {/* Token Queue */}
        <div className="glass-panel p-6 border-t-4 border-t-blue-600 flex flex-col max-h-[800px] overflow-hidden">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 shrink-0">
            <h2 className="text-2xl font-semibold flex items-center gap-3 text-slate-900">
              <List className="text-blue-700" /> Live OPD Queue
            </h2>
            
            {/* Department Filter Buttons */}
            <div className="flex flex-wrap gap-2 items-center">
              <Filter className="w-4 h-4 text-slate-500 mr-2" />
              <button
                onClick={() => setSelectedDept(null)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  selectedDept === null 
                  ? "bg-blue-900 text-white shadow-sm" 
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-300"
                }`}
              >
                All
              </button>
              {ALL_DEPARTMENTS.map(dept => (
                <button
                  key={dept}
                  onClick={() => setSelectedDept(dept)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    selectedDept === dept 
                    ? "bg-blue-900 text-white shadow-sm" 
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-300"
                  }`}
                >
                  {dept}
                </button>
              ))}
            </div>
          </div>
          
          <div className="overflow-y-auto flex-1 pr-2">
            {filteredTokens.length === 0 ? (
              <div className="text-center text-slate-500 py-10 font-medium">No active tokens in queue.</div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="text-slate-500 text-sm border-b border-slate-200">
                    <th className="pb-3 font-medium">Token</th>
                    <th className="pb-3 font-medium">Time</th>
                    <th className="pb-3 font-medium">Patient</th>
                    <th className="pb-3 font-medium">Department</th>
                    <th className="pb-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTokens.map((t: any, idx: number) => (
                    <motion.tr 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      key={t.token_number} 
                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    >
                      <td className="py-4 font-mono font-bold text-blue-700">{t.token_number}</td>
                      <td className="py-4 text-slate-500 text-sm font-medium">
                        {t.created_at ? new Date(t.created_at + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                      </td>
                      <td className="py-4 font-semibold text-slate-900">{t.patient_name}</td>
                      <td className="py-4 text-slate-600 font-medium">{t.department}</td>
                      <td className="py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {t.status !== 'COMPLETED' && (
                            <button 
                              onClick={() => handleCompleteToken(t.token_number)}
                              className="px-3 py-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border border-emerald-200 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium shadow-sm"
                              title="End Meeting & Remove from Queue"
                            >
                              <CheckCircle className="w-4 h-4" /> End Meeting
                            </button>
                          )}
                          <button 
                            onClick={() => handleDeleteToken(t.token_number)}
                            className="p-2 bg-red-100 text-red-700 hover:bg-red-200 border border-red-200 rounded-lg transition-colors shadow-sm"
                            title="Delete Token"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Local RAYA Users (Biometric DB) */}
        <div className="glass-panel p-6 border-t-4 border-t-emerald-600 flex flex-col max-h-[800px] overflow-hidden">
          <h2 className="text-2xl font-semibold mb-6 flex items-center gap-3 shrink-0 text-slate-900">
            <Users className="text-emerald-600" /> Local Enrolled Profiles (RAYA DB)
          </h2>
          
          <div className="overflow-y-auto flex-1 pr-2">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-sm">
                  <th className="pb-3 font-medium">ID</th>
                  <th className="pb-3 font-medium">Full Name</th>
                  <th className="pb-3 font-medium">Linked ABHA</th>
                  <th className="pb-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-500 font-medium">No locally enrolled users.</td>
                  </tr>
                ) : (
                  users.map((u, idx) => (
                    <motion.tr 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      key={u.id} 
                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    >
                      <td className="py-4 text-slate-500 font-medium">#{u.id}</td>
                      <td className="py-4 font-semibold text-slate-900">{u.full_name}</td>
                      <td className="py-4 font-mono font-bold text-emerald-700">{u.abha_number || "Unlinked"}</td>
                      <td className="py-4 text-right">
                        <button 
                          onClick={() => handleDeleteUser(u.id)}
                          className="p-2 bg-red-100 text-red-700 hover:bg-red-200 border border-red-200 rounded-lg transition-colors shadow-sm"
                          title="Delete User"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </main>
  );
}
