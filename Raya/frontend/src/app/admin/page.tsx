"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, Users, List, RefreshCw, CheckCircle, Trash2, Filter, Edit, Plus, X } from "lucide-react";
import * as Icons from "lucide-react";

export default function AdminDashboard() {
  const [tokens, setTokens] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);

  const [editingDeptId, setEditingDeptId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    hindi_name: "",
    description: "",
    icon: "Stethoscope",
    themeIndex: 5,
  });

  const COLOR_THEMES = [
    { name: "Rose", color: "text-rose-500", bg: "bg-rose-500/10" },
    { name: "Amber", color: "text-amber-500", bg: "bg-amber-500/10" },
    { name: "Blue", color: "text-blue-500", bg: "bg-blue-500/10" },
    { name: "Purple", color: "text-purple-500", bg: "bg-purple-500/10" },
    { name: "Emerald", color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { name: "Teal", color: "text-teal-500", bg: "bg-teal-500/10" },
    { name: "Indigo", color: "text-indigo-500", bg: "bg-indigo-500/10" },
    { name: "Orange", color: "text-orange-500", bg: "bg-orange-500/10" },
    { name: "Red", color: "text-red-500", bg: "bg-red-500/10" },
  ];

  const ICONS = ["HeartPulse", "Bone", "Eye", "Sparkles", "Baby", "Stethoscope", "Activity", "Brain", "ShieldAlert", "Ear", "Pill", "Thermometer", "Syringe", "Microscope", "Heart"];

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tokenRes, userRes, deptRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/tokens/queue?t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/users/?t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/departments?t=${Date.now()}`, { cache: 'no-store' })
      ]);
      if (tokenRes.ok) setTokens(await tokenRes.json());
      if (userRes.ok) setUsers(await userRes.json());
      if (deptRes.ok) setDepartments(await deptRes.json());
    } catch (err) {
      console.error("Failed to fetch admin data", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.hindi_name) {
      alert("Name and Hindi Name are required.");
      return;
    }
    
    const theme = COLOR_THEMES[formData.themeIndex];
    const payload = {
      name: formData.name,
      hindi_name: formData.hindi_name,
      description: formData.description,
      icon: formData.icon,
      color: theme.color,
      bg_color: theme.bg,
    };
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      let res;
      if (editingDeptId) {
        res = await fetch(`${apiUrl}/api/departments/${editingDeptId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`${apiUrl}/api/departments/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      
      if (res.ok) {
        setEditingDeptId(null);
        setFormData({
          name: "",
          hindi_name: "",
          description: "",
          icon: "Stethoscope",
          themeIndex: 5,
        });
        fetchData();
      } else {
        const errData = await res.json();
        alert(errData.detail || "Failed to save department");
      }
    } catch (err) {
      console.error("Error saving department", err);
    }
  };

  const handleEditClick = (dept: any) => {
    setEditingDeptId(dept.id);
    let matchedThemeIndex = 5; // default to Teal
    COLOR_THEMES.forEach((t, idx) => {
      if (t.color === dept.color) matchedThemeIndex = idx;
    });
    setFormData({
      name: dept.name,
      hindi_name: dept.hindi_name,
      description: dept.description || "",
      icon: dept.icon || "Stethoscope",
      themeIndex: matchedThemeIndex,
    });
  };

  const handleDeleteDept = async (id: number) => {
    if (!confirm("Are you sure you want to permanently delete this department? Any tokens assigned to this department will remain but the department option will be removed.")) return;
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/api/departments/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchData();
      } else {
        const errData = await res.json();
        alert(errData.detail || "Failed to delete department");
      }
    } catch (err) {
      console.error("Failed to delete department", err);
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

  // Dynamic list of departments from DB
  const ALL_DEPARTMENTS = departments.map(d => d.name);
  
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

      {/* Manage Departments Section */}
      <div className="mt-10">
        <div className="glass-panel p-8 border-t-4 border-t-purple-600">
          <h2 className="text-2xl font-semibold mb-6 flex items-center gap-3 text-slate-900 border-b border-slate-200 pb-4">
            <Icons.Settings className="text-purple-600 w-8 h-8" /> 
            Manage Hospital Departments
          </h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            {/* Departments List */}
            <div className="lg:col-span-2 overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-sm">
                    <th className="pb-3 font-medium">Icon / Color</th>
                    <th className="pb-3 font-medium">Department Name</th>
                    <th className="pb-3 font-medium">Hindi Name</th>
                    <th className="pb-3 font-medium">Description (AI Prompt Block)</th>
                    <th className="pb-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {departments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-500 font-medium">No departments configured.</td>
                    </tr>
                  ) : (
                    departments.map((dept) => {
                      const IconComp = (Icons as any)[dept.icon] || Icons.Stethoscope;
                      return (
                        <tr key={dept.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="py-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${dept.bg_color || "bg-teal-500/10"} ${dept.color || "text-teal-500"}`}>
                              <IconComp className="w-6 h-6" />
                            </div>
                          </td>
                          <td className="py-4 font-bold text-slate-900">{dept.name}</td>
                          <td className="py-4 font-semibold text-blue-700">{dept.hindi_name}</td>
                          <td className="py-4 text-slate-500 text-sm max-w-xs truncate" title={dept.description}>
                            {dept.description || <span className="italic text-slate-400">No description provided</span>}
                          </td>
                          <td className="py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button 
                                onClick={() => handleEditClick(dept)}
                                className="p-2 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors shadow-sm"
                                title="Edit Department"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDeleteDept(dept.id)}
                                className="p-2 bg-red-100 text-red-700 hover:bg-red-200 border border-red-200 rounded-lg transition-colors shadow-sm"
                                title="Delete Department"
                                disabled={departments.length <= 1}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Add/Edit Form */}
            <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 shadow-sm">
              <h3 className="text-xl font-bold mb-4 text-slate-900 flex items-center gap-2">
                {editingDeptId ? (
                  <>
                    <Edit className="w-5 h-5 text-blue-700" /> Edit Department
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5 text-emerald-600" /> Add New Department
                  </>
                )}
              </h3>
              
              <form onSubmit={handleSaveDepartment} className="space-y-4">
                <div>
                  <label className="block text-slate-700 text-sm font-semibold mb-1">English Name</label>
                  <input 
                    type="text" 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="e.g. Neurology"
                    className="w-full bg-white text-slate-950 border border-slate-300 rounded-xl p-3 text-sm focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-slate-700 text-sm font-semibold mb-1">Hindi Name (kiosk display)</label>
                  <input 
                    type="text" 
                    value={formData.hindi_name}
                    onChange={(e) => setFormData({...formData, hindi_name: e.target.value})}
                    placeholder="e.g. तंत्रिका विज्ञान"
                    className="w-full bg-white text-slate-950 border border-slate-300 rounded-xl p-3 text-sm focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 text-sm font-semibold mb-1">
                    AI Description Block <span className="text-xs font-normal text-slate-500">(Not visible to users)</span>
                  </label>
                  <textarea 
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Describe symptoms triaged here (e.g. For brain, spinal cord, nerves, paralysis, chronic headaches, numbness, seizures)"
                    rows={3}
                    className="w-full bg-white text-slate-950 border border-slate-300 rounded-xl p-3 text-sm focus:border-blue-500 focus:outline-none resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-700 text-sm font-semibold mb-1">Lucide Icon</label>
                    <select
                      value={formData.icon}
                      onChange={(e) => setFormData({...formData, icon: e.target.value})}
                      className="w-full bg-white text-slate-950 border border-slate-300 rounded-xl p-3 text-sm focus:border-blue-500 focus:outline-none"
                    >
                      {ICONS.map(i => (
                        <option key={i} value={i}>{i}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-slate-700 text-sm font-semibold mb-1">Color Theme</label>
                    <select
                      value={formData.themeIndex}
                      onChange={(e) => setFormData({...formData, themeIndex: parseInt(e.target.value)})}
                      className="w-full bg-white text-slate-950 border border-slate-300 rounded-xl p-3 text-sm focus:border-blue-500 focus:outline-none"
                    >
                      {COLOR_THEMES.map((theme, idx) => (
                        <option key={theme.name} value={idx}>{theme.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button 
                    type="submit"
                    className="flex-1 py-3 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-xl transition-colors shadow-sm text-sm"
                  >
                    {editingDeptId ? "Update Department" : "Add Department"}
                  </button>
                  {editingDeptId && (
                    <button 
                      type="button"
                      onClick={() => {
                        setEditingDeptId(null);
                        setFormData({
                          name: "",
                          hindi_name: "",
                          description: "",
                          icon: "Stethoscope",
                          themeIndex: 5,
                        });
                      }}
                      className="p-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-colors border border-slate-300 flex items-center"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
      
    </main>
  );
}
