import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export function Auth() {
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) navigate('/dashboard');
      } catch (err) {
        console.error(err);
      }
    };
    checkUser();
  }, [navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
       const { error } = await supabase.auth.signInWithPassword({ email, password });
       if (error) setError(error.message);
       else navigate('/dashboard');
    } catch (err: any) {
       setError(err.message || 'An error occurred during sign in');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) setError(error.message);
      else setMessage("Check your email to confirm your account");
    } catch (err: any) {
      setError(err.message || 'An error occurred during sign up');
    }
  };

  const handleReset = async () => {
    if (!email) {
      setError("Please enter your email to reset password");
      return;
    }
    setError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/auth?view=sign-in' // Redirect back to sign-in
      });
      if (error) setError(error.message);
      else setMessage("Reset link sent — check your inbox");
    } catch (err: any) {
      setError(err.message || "An error occurred during password reset");
    }
  };

  const handleOAuth = async (provider: 'google') => {
    try {
      await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin + '/dashboard' }
      });
    } catch (e: any) {
      console.error(e);
      setError(e.message || "OAuth failed");
    }
  };

  return (
    <div className="flex bg-[#0a0a0a] min-h-screen items-center justify-center relative overflow-hidden" 
         style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22 opacity=%220.05%22/%3E%3C/svg%3E")' }}>
      <div className="w-full max-w-md p-8 bg-[#111111] border border-[#222222] shadow-2xl rounded-xl z-10">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white tracking-tight">Cortex Editor</h1>
          <p className="text-gray-500 text-sm mt-1">Sign in to your workspace</p>
        </div>

        <div className="flex mb-6 border-b border-[#2a2a2a]">
          <button 
            className={`flex-1 pb-2 text-sm font-medium transition-colors ${activeTab === 'signin' ? 'text-white border-b-2 border-white' : 'text-gray-500 hover:text-gray-300'}`}
            onClick={() => { setActiveTab('signin'); setError(null); setMessage(null); }}
          >
            Sign In
          </button>
          <button 
            className={`flex-1 pb-2 text-sm font-medium transition-colors ${activeTab === 'signup' ? 'text-white border-b-2 border-white' : 'text-gray-500 hover:text-gray-300'}`}
            onClick={() => { setActiveTab('signup'); setError(null); setMessage(null); }}
          >
            Create Account
          </button>
        </div>

        {error && <div className="p-3 mb-4 text-xs text-red-400 bg-red-950/20 border border-red-900/50 rounded">{error}</div>}
        {message && <div className="p-3 mb-4 text-xs text-green-400 bg-green-950/20 border border-green-900/50 rounded">{message}</div>}

        <form onSubmit={activeTab === 'signin' ? handleSignIn : handleSignUp} className="space-y-4">
          {activeTab === 'signup' && (
            <div>
              <input type="text" placeholder="Full Name" required value={fullName} onChange={e => setFullName(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-white px-4 py-2.5 rounded text-sm focus:outline-none focus:border-red-500 transition-colors" />
            </div>
          )}
          <div>
            <input type="email" placeholder="Email" required value={email} onChange={e => setEmail(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-white px-4 py-2.5 rounded text-sm focus:outline-none focus:border-red-500 transition-colors" />
          </div>
          <div>
            <input type="password" placeholder="Password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-white px-4 py-2.5 rounded text-sm focus:outline-none focus:border-red-500 transition-colors" />
          </div>
          {activeTab === 'signup' && (
            <div>
              <input type="password" placeholder="Confirm Password" required minLength={8} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-white px-4 py-2.5 rounded text-sm focus:outline-none focus:border-red-500 transition-colors" />
            </div>
          )}

          {activeTab === 'signin' && (
            <div className="flex justify-end">
              <button type="button" onClick={handleReset} className="text-xs text-gray-400 hover:text-white transition-colors">Forgot password?</button>
            </div>
          )}

          <button type="submit" className="w-full bg-white text-black font-semibold py-2.5 rounded text-sm hover:bg-gray-200 transition-colors">
            {activeTab === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#2a2a2a]"></div></div>
            <div className="relative flex justify-center text-xs"><span className="px-2 bg-[#111111] text-gray-500">Or continue with</span></div>
          </div>
          <button onClick={() => handleOAuth('google')} className="mt-4 w-full flex items-center justify-center gap-2 bg-[#1a1a1a] text-white py-2.5 rounded border border-[#2a2a2a] hover:bg-[#222] transition-colors text-sm font-medium">
            <svg viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Google
          </button>
        </div>
      </div>
    </div>
  );
}
