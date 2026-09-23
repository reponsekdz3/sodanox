import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { X, Upload, Sparkles, Lock, Mail, User as UserIcon, ArrowRight, CheckCircle2 } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'signup';
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, initialMode = 'signin' }) => {
  const { signIn, signUp, signInWithGoogle, quickDemoLogin, currentUser, signOutUser } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState('https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError('Please choose an image under 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setAvatar(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (mode === 'signin') {
        await signIn(email, password);
      } else {
        if (!name.trim()) throw new Error('Please enter your full name');
        if (!username.trim()) throw new Error('Please choose a username');
        await signUp(email, password, {
          name: name.trim(),
          username: username.trim().toLowerCase().replace(/[^a-z0-9_.]/g, ''),
          bio: bio.trim(),
          avatar,
        });
      }
      onClose();
    } catch (err: unknown) {
      const e = err as { message?: string; code?: string };
      if (e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password') {
        setError('Invalid email or password. Please check your credentials.');
      } else if (e.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists. Try signing in.');
      } else if (e.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else {
        setError(e.message || 'Authentication error. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoSwitch = async (role: 'marcus' | 'clara' | 'soren' | 'guest') => {
    setError(null);
    setIsSubmitting(true);
    try {
      await quickDemoLogin(role);
      onClose();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Error switching demo account');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2D3732]/40 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-[#FAFAF9] rounded-3xl border border-[#2D3732]/10 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header banner */}
        <div className="px-8 pt-8 pb-6 border-b border-[#2D3732]/10 bg-gradient-to-b from-[#F1F5F2] to-[#FAFAF9] flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#8FA89B]" />
              <span className="text-xs uppercase tracking-widest font-mono text-[#7A8A82]">Aura Network</span>
            </div>
            <h2 className="text-2xl font-serif text-[#2D3732]">
              {mode === 'signin' ? 'Welcome Back' : 'Create Your Profile'}
            </h2>
            <p className="text-xs text-[#7A8A82] mt-1">
              {mode === 'signin'
                ? 'Sign in to access real-time direct messages and quiet community feeds.'
                : 'Join the community of creators, architects, and makers.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#7A8A82] hover:text-[#2D3732] hover:bg-[#2D3732]/5 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <div className="px-8 py-6 overflow-y-auto space-y-6">
          {/* Quick Demo Personas - great for testing multi-user direct messaging! */}
          <div className="p-4 rounded-2xl bg-[#F1F5F2] border border-[#2D3732]/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-[#2D3732] flex items-center gap-1.5">
                <Sparkles size={14} className="text-[#8FA89B]" />
                1-Click Persona Testing
              </span>
              <span className="text-[10px] text-[#7A8A82]">Test 2-way chat live</span>
            </div>
            <p className="text-xs text-[#7A8A82] mb-3">
              Switch between creators to immediately send and receive real-time messages:
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleDemoSwitch('guest')}
                disabled={isSubmitting}
                className="flex items-center gap-2 p-2 rounded-xl bg-[#FAFAF9] border border-[#2D3732]/10 hover:border-[#8FA89B] text-left transition-colors cursor-pointer"
              >
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&q=80"
                  alt="Elena"
                  className="w-7 h-7 rounded-lg object-cover"
                />
                <div className="overflow-hidden">
                  <div className="text-[11px] font-medium text-[#2D3732] truncate">Elena R.</div>
                  <div className="text-[9px] text-[#7A8A82]">Architect</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleDemoSwitch('marcus')}
                disabled={isSubmitting}
                className="flex items-center gap-2 p-2 rounded-xl bg-[#FAFAF9] border border-[#2D3732]/10 hover:border-[#8FA89B] text-left transition-colors cursor-pointer"
              >
                <img
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=80&q=80"
                  alt="Marcus"
                  className="w-7 h-7 rounded-lg object-cover"
                />
                <div className="overflow-hidden">
                  <div className="text-[11px] font-medium text-[#2D3732] truncate">Marcus L.</div>
                  <div className="text-[9px] text-[#7A8A82]">Acoustics</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleDemoSwitch('clara')}
                disabled={isSubmitting}
                className="flex items-center gap-2 p-2 rounded-xl bg-[#FAFAF9] border border-[#2D3732]/10 hover:border-[#8FA89B] text-left transition-colors cursor-pointer"
              >
                <img
                  src="https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=80&q=80"
                  alt="Clara"
                  className="w-7 h-7 rounded-lg object-cover"
                />
                <div className="overflow-hidden">
                  <div className="text-[11px] font-medium text-[#2D3732] truncate">Clara C.</div>
                  <div className="text-[9px] text-[#7A8A82]">Ceramicist</div>
                </div>
              </button>
            </div>
          </div>

          {/* Google Sign In Button */}
          <button
            type="button"
            onClick={async () => {
              setError(null);
              setIsSubmitting(true);
              try {
                await signInWithGoogle();
                onClose();
              } catch (err: unknown) {
                const e = err as { message?: string };
                setError(e.message || 'Google sign in failed');
              } finally {
                setIsSubmitting(false);
              }
            }}
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-2xl bg-white border border-[#2D3732]/15 hover:bg-[#F1F5F2] text-xs font-medium text-[#2D3732] shadow-sm transition-all cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-[#2D3732]/10"></div>
            <span className="flex-shrink mx-4 text-[11px] uppercase tracking-wider text-[#7A8A82]">
              or sign {mode === 'signin' ? 'in' : 'up'} with credentials
            </span>
            <div className="flex-grow border-t border-[#2D3732]/10"></div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                {/* Profile Picture Upload & Display */}
                <div className="flex items-center gap-4 p-3 rounded-2xl bg-[#F1F5F2] border border-[#2D3732]/10">
                  <div className="relative group">
                    <img
                      src={avatar}
                      alt="Avatar Preview"
                      className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-sm"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white"
                      title="Upload custom photo"
                    >
                      <Upload size={18} />
                    </button>
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-medium text-[#2D3732]">Profile Picture</div>
                    <div className="text-[11px] text-[#7A8A82] mb-1.5">
                      Upload any photo from your device.
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs font-medium text-[#8FA89B] hover:text-[#2D3732] underline"
                    >
                      Choose file
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#2D3732] mb-1">
                      Full Name
                    </label>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-3 text-[#7A8A82]" size={16} />
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Maya Lin"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white border border-[#2D3732]/15 text-sm text-[#2D3732] focus:outline-none focus:border-[#8FA89B]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#2D3732] mb-1">
                      Username
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs text-[#7A8A82]">@</span>
                      <input
                        type="text"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="mayalin"
                        className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-white border border-[#2D3732]/15 text-sm text-[#2D3732] focus:outline-none focus:border-[#8FA89B]"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#2D3732] mb-1">
                    Short Bio
                  </label>
                  <textarea
                    rows={2}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell the community about your craft, studio, or passions..."
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#2D3732]/15 text-sm text-[#2D3732] focus:outline-none focus:border-[#8FA89B] resize-none"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-[#2D3732] mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 text-[#7A8A82]" size={16} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@domain.com"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white border border-[#2D3732]/15 text-sm text-[#2D3732] focus:outline-none focus:border-[#8FA89B]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#2D3732] mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 text-[#7A8A82]" size={16} />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white border border-[#2D3732]/15 text-sm text-[#2D3732] focus:outline-none focus:border-[#8FA89B]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl bg-[#2D3732] text-[#FAFAF9] font-medium text-sm hover:bg-[#8FA89B] transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Processing...</span>
              ) : mode === 'signin' ? (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={16} />
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  <span>Create Account</span>
                </>
              )}
            </button>
          </form>

          {/* Toggle mode */}
          <div className="text-center pt-2">
            {mode === 'signin' ? (
              <p className="text-xs text-[#7A8A82]">
                New to Aura?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setMode('signup');
                  }}
                  className="font-medium text-[#2D3732] underline hover:text-[#8FA89B]"
                >
                  Create an account
                </button>
              </p>
            ) : (
              <p className="text-xs text-[#7A8A82]">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setMode('signin');
                  }}
                  className="font-medium text-[#2D3732] underline hover:text-[#8FA89B]"
                >
                  Sign in
                </button>
              </p>
            )}
          </div>

          {currentUser && (
            <div className="pt-2 border-t border-[#2D3732]/10 flex justify-between items-center text-xs text-[#7A8A82]">
              <span>Currently signed in as: {currentUser.email || 'Demo User'}</span>
              <button
                type="button"
                onClick={signOutUser}
                className="text-red-600 hover:underline font-medium"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
