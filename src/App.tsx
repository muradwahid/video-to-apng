import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Editor from "./pages/Editor";
import { Dashboard } from "./pages/Dashboard";
import { ReviewPanel } from "./pages/ReviewPanel";
import { Auth } from "./pages/Auth";
import { supabase } from "./lib/supabase";
import { getLastProjectId } from "./lib/projectService";

function RootRedirect() {
  const [loading, setLoading] = useState(true);
  const [path, setPath] = useState('/auth');

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!mounted) return;
        if (user) {
          try {
            const lastId = await getLastProjectId();
            if (mounted) setPath(lastId ? `/editor/${lastId}` : '/dashboard');
          } catch (e) {
            if (mounted) setPath('/dashboard');
          }
        } else {
          if (mounted) setPath('/auth');
        }
      } catch (e) {
        console.error(e);
        if (mounted) setPath('/auth');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    init();
    return () => { mounted = false; };
  }, []);

  if (loading) return <div className="min-h-screen bg-[#0a0a0a]" />;
  return <Navigate to={path} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/editor/:id" element={<Editor />} />
        <Route path="/review/:id" element={<ReviewPanel />} />
      </Routes>
    </BrowserRouter>
  );
}
