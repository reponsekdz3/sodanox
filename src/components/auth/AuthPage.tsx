import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { checkUsernameAvailable } from '../../services/userService';
import { AuraLogo } from '../common/AuraLogo';
import { auraAudio } from '../../utils/audioSynthesizer';
import { GoogleAuthModal } from './GoogleAuthModal';
import { ModernAvatar, MODERN_EMPTY_AVATAR_DATA_URI } from '../common/ModernAvatar';
import {
  Sparkles,
  Lock,
  Mail,
  User as UserIcon,
  ArrowRight,
  Eye,
  EyeOff,
  CheckCircle2,
  Upload,
  Globe,
  MapPin,
  Feather,
  Compass,
  Layers,
  Heart,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Zap,
} from 'lucide-react';

interface AuthPageProps {
  onSuccess?: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onSuccess }) => {
  const { signIn, signUp, signInWithGoogle, sendPasswordReset } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [website, setWebsite] = useState('');
  const [avatar, setAvatar] = useState(MODERN_EMPTY_AVATAR_DATA_URI);
  const [agreedToManifesto, setAgreedToManifesto] = useState(true);

  // Forgot password state
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  // Real Google Auth Modal state
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleModalTab, setGoogleModalTab] = useState<'signin' | 'origin-guide'>('signin');

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Username validation timeout
  const usernameTimeoutRef = useRef<any>(null);

  const handleUsernameChange = (val: string) => {
    const cleaned = val.toLowerCase().replace(/[^a-z0-9_.]/g, '');
    setUsername(cleaned);

    if (usernameTimeoutRef.current) clearTimeout(usernameTimeoutRef.current);
    if (!cleaned || cleaned.length < 3) {
      setUsernameStatus('idle');
      return;
    }

    setUsernameStatus('checking');
    usernameTimeoutRef.current = setTimeout(async () => {
      const isAvail = await checkUsernameAvailable(cleaned);
      setUsernameStatus(isAvail ? 'available' : 'taken');
    }, 400);
  };

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) {
        setError('Please choose an image under 3MB');
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

  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: '', color: '' };
    if (pass.length < 6) return { score: 1, label: 'Too short', color: 'bg-red-400' };
    let score = 1;
    if (pass.length >= 8) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;

    if (score <= 2) return { score: 2, label: 'Fair', color: 'bg-amber-400' };
    if (score === 3) return { score: 3, label: 'Good', color: 'bg-[#8FA89B]' };
    return { score: 4, label: 'Strong', color: 'bg-emerald-500' };
  };

  const strength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (mode === 'signin') {
        if (!email.trim() || !password) {
          throw new Error('Please enter your email and password');
        }
        await signIn(email.trim(), password);
        auraAudio.playChime();
        onSuccess?.();
      } else {
        if (!name.trim()) throw new Error('Please enter your full name');
        if (!username.trim() || username.length < 3) {
          throw new Error('Username must be at least 3 characters');
        }
        if (usernameStatus === 'taken') {
          throw new Error('This username is already taken. Please choose another.');
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters');
        }
        if (!agreedToManifesto) {
          throw new Error('Please agree to the slow social manifesto to join');
        }

        await signUp(email.trim(), password, {
          name: name.trim(),
          username: username.trim(),
          avatar,
          bio: bio.trim() || 'Aura creator & observer.',
          location: location.trim(),
          website: website.trim(),
        });
        auraAudio.playChime();
        onSuccess?.();
      }
    } catch (err: unknown) {
      const e = err as { message?: string; code?: string };
      if (e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password' || e.code === 'auth/user-not-found') {
        setError('Invalid email or password. Please verify your credentials.');
      } else if (e.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please sign in instead.');
      } else if (e.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else {
        setError(e.message || 'An error occurred during authentication.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    setResetError(null);
    try {
      await sendPasswordReset(resetEmail.trim());
      setResetSent(true);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setResetError(e.message || 'Failed to send password reset email.');
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#FAFAF9] flex flex-col lg:flex-row text-[#2D3732] antialiased selection:bg-[#8FA89B]/30">
      {/* Left Column: Atmospheric Brand Manifesto (Hidden on mobile to show login/register immediately) */}
      <div className="hidden lg:flex lg:w-5/12 bg-[#2D3732] text-[#FAFAF9] p-8 lg:p-16 flex-col justify-between relative overflow-hidden">
        {/* Subtle background ambient blur circles */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-[#8FA89B]/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-[#7A8A82]/20 blur-3xl pointer-events-none" />

        {/* Top: Logo & Title */}
        <div className="relative z-10">
          <div className="mb-8">
            <AuraLogo size="xl" variant="white" isInteractive={false} />
          </div>

          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-light leading-tight tracking-tight text-white mb-6">
            A quiet sanctuary for mindful creators.
          </h1>

          <p className="text-white/70 text-sm sm:text-base leading-relaxed max-w-md font-light">
            No dopamine feeds or endless noise. Share tactile stories, visual reflections, and purposeful conversations with creators across the globe.
          </p>
        </div>

        {/* Middle: Feature highlights */}
        <div className="relative z-10 my-10 space-y-4">
          <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
            <div className="p-2 rounded-xl bg-[#8FA89B]/20 text-[#8FA89B] shrink-0 mt-0.5">
              <Layers size={18} />
            </div>
            <div>
              <h2 className="text-sm font-medium text-white">Advanced Interactive Stories</h2>
              <p className="text-xs text-white/60 mt-0.5">
                Stickers, real polls, questions, custom color filters, and permanent profile highlights.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
            <div className="p-2 rounded-xl bg-[#8FA89B]/20 text-[#8FA89B] shrink-0 mt-0.5">
              <Feather size={18} />
            </div>
            <div>
              <h2 className="text-sm font-medium text-white">High-Fidelity Posts & Carousels</h2>
              <p className="text-xs text-white/60 mt-0.5">
                Multi-image media, location tagging, live audience voting, and threaded discussions.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
            <div className="p-2 rounded-xl bg-[#8FA89B]/20 text-[#8FA89B] shrink-0 mt-0.5">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h2 className="text-sm font-medium text-white">Real Creator Identity</h2>
              <p className="text-xs text-white/60 mt-0.5">
                Every profile is member-created with custom headers, creator bios, and direct messaging.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom: Genuine Member Guarantee & Developer Credit */}
        <div className="relative z-10 pt-6 border-t border-white/10 space-y-3">
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
            <div className="w-8 h-8 rounded-xl bg-[#8FA89B]/20 flex items-center justify-center shrink-0">
              <ShieldCheck size={18} className="text-[#8FA89B]" />
            </div>
            <div>
              <p className="text-xs font-medium text-white">Pure User-Generated Community</p>
              <p className="text-[11px] text-white/60">
                100% genuine member accounts. All stories, posts, and conversations are created in real time.
              </p>
            </div>
          </div>
          <div className="text-center">
            <p className="text-[11px] text-white/60 font-medium tracking-wide">
              app developed by reponsekdz · Aura
            </p>
          </div>
        </div>
      </div>

      {/* Right Column: Interactive Login & Register Forms (Primary on mobile & desktop) */}
      <div className="w-full lg:w-7/12 flex items-center justify-center p-4 sm:p-8 lg:p-16 overflow-y-auto">
        <div className="w-full max-w-xl">
          {/* Mobile Logo on small screens */}
          <div className="lg:hidden mb-6 flex items-center justify-center">
            <AuraLogo size="lg" variant="sage" isInteractive={false} />
          </div>

          {/* Segmented Mode Switcher */}
          <div className="p-1 bg-[#F1F5F2] rounded-2xl flex items-center mb-8 border border-[#2D3732]/10 shadow-inner">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError(null);
              }}
              className={`flex-1 py-3 text-xs sm:text-sm font-medium rounded-xl transition-all ${
                mode === 'signin'
                  ? 'bg-white text-[#2D3732] shadow-sm font-semibold'
                  : 'text-[#7A8A82] hover:text-[#2D3732]'
              }`}
            >
              Sign In to Your Space
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError(null);
              }}
              className={`flex-1 py-3 text-xs sm:text-sm font-medium rounded-xl transition-all ${
                mode === 'signup'
                  ? 'bg-white text-[#2D3732] shadow-sm font-semibold'
                  : 'text-[#7A8A82] hover:text-[#2D3732]'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Form Header */}
          <div className="mb-6">
            <h2 className="font-serif text-2xl sm:text-3xl font-light text-[#2D3732]">
              {mode === 'signin' ? 'Welcome back to Aura' : 'Begin your creative journey'}
            </h2>
            <p className="text-xs sm:text-sm text-[#7A8A82] mt-1">
              {mode === 'signin'
                ? 'Enter your credentials to enter your quiet feed.'
                : 'Craft your profile, set your handle, and start posting stories and projects.'}
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex flex-col gap-2.5 animate-fade-in">
              <div className="flex items-start gap-3">
                <AlertCircle size={18} className="shrink-0 mt-0.5 text-red-500" />
                <div className="flex-1 leading-relaxed">{error}</div>
              </div>
              {(error.includes('No account found') || error.includes('Create one now')) && mode === 'signin' && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setError(null);
                    if (!name && email) {
                      setName(email.split('@')[0]);
                    }
                    if (!username && email) {
                      setUsername(email.split('@')[0].toLowerCase().replace(/[^a-z0-9_.]/g, ''));
                    }
                  }}
                  className="self-start text-xs font-medium px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white transition-colors shadow-sm ml-7 cursor-pointer"
                >
                  Create account with {email || 'this email'} →
                </button>
              )}
            </div>
          )}

          {/* 1-Click Google Sign In & Instant Studio Pass */}
          <div className="space-y-3 mb-6">
            <button
              type="button"
              onClick={async () => {
                setError(null);
                setIsSubmitting(true);
                try {
                  const targetEmail = email.trim() || undefined;
                  const targetName = name.trim() || undefined;
                  if (targetEmail) {
                    await signInWithGoogle({ email: targetEmail, name: targetName });
                  } else {
                    await signInWithGoogle();
                  }
                  auraAudio.playChime();
                  onSuccess?.();
                } catch (err: unknown) {
                  const e = err as { message?: string; code?: string };
                  const isOriginError =
                    e.message?.includes('origin_mismatch') ||
                    e.message?.includes('unauthorized') ||
                    e.code === 'auth/unauthorized-domain';
                  setGoogleModalTab(isOriginError ? 'origin-guide' : 'signin');
                  setShowGoogleModal(true);
                } finally {
                  setIsSubmitting(false);
                }
              }}
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-2xl bg-white border border-[#2D3732]/15 hover:bg-[#F1F5F2] text-xs sm:text-sm font-medium text-[#2D3732] shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
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

            <div className="flex items-center justify-between px-1 text-[11px] text-[#7A8A82]">
              <button
                type="button"
                onClick={() => {
                  setGoogleModalTab('signin');
                  setShowGoogleModal(true);
                }}
                className="hover:text-[#5E7C6E] underline cursor-pointer"
              >
                1-Click Google Pass
              </button>
              <button
                type="button"
                onClick={() => {
                  setGoogleModalTab('origin-guide');
                  setShowGoogleModal(true);
                }}
                className="hover:text-[#5E7C6E] underline cursor-pointer flex items-center gap-1"
              >
                <span>Fix Error 400 (origin_mismatch)</span>
              </button>
            </div>
          </div>

          <div className="relative flex py-2 items-center mb-6">
            <div className="flex-grow border-t border-[#2D3732]/10"></div>
            <span className="flex-shrink mx-4 text-[11px] uppercase tracking-wider text-[#7A8A82] font-mono">
              Or with email & password
            </span>
            <div className="flex-grow border-t border-[#2D3732]/10"></div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                {/* Profile Photo Selection */}
                <div className="p-4 rounded-2xl bg-[#F1F5F2]/60 border border-[#2D3732]/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#2D3732] uppercase tracking-wider">
                      Profile Avatar
                    </span>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-[#8FA89B] hover:text-[#7e9689] font-medium flex items-center gap-1.5"
                    >
                      <Upload size={13} />
                      <span>Upload Custom Photo</span>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarFile}
                    />
                  </div>

                  <div className="flex items-center gap-4">
                    <ModernAvatar
                      src={avatar}
                      size="xl"
                      ring
                      className="border-2 border-white shadow-md"
                    />
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-[#2D3732] mb-0.5">
                        Modern Empty Avatar
                      </div>
                      <div className="text-[11px] text-[#7A8A82] leading-snug">
                        Minimalist geometric aesthetic default. You can also upload your own picture anytime.
                      </div>
                      {avatar !== MODERN_EMPTY_AVATAR_DATA_URI && (
                        <button
                          type="button"
                          onClick={() => setAvatar(MODERN_EMPTY_AVATAR_DATA_URI)}
                          className="mt-1.5 text-[11px] text-[#5E7C6E] hover:underline font-medium cursor-pointer"
                        >
                          Reset to default Modern Avatar
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Name & Username Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#2D3732] mb-1">
                      Full Name *
                    </label>
                    <div className="relative">
                      <UserIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7A8A82]" />
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Elena Rostova"
                        className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white border border-[#2D3732]/15 text-xs sm:text-sm text-[#2D3732] focus:outline-none focus:border-[#8FA89B]"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-[#2D3732]">
                        Username *
                      </label>
                      {usernameStatus === 'checking' && (
                        <span className="text-[10px] text-[#7A8A82]">Checking...</span>
                      )}
                      {usernameStatus === 'available' && (
                        <span className="text-[10px] text-emerald-600 font-medium">Available</span>
                      )}
                      {usernameStatus === 'taken' && (
                        <span className="text-[10px] text-red-500 font-medium">Taken</span>
                      )}
                    </div>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-[#7A8A82]">
                        @
                      </span>
                      <input
                        type="text"
                        required
                        value={username}
                        onChange={(e) => handleUsernameChange(e.target.value)}
                        placeholder="elenarostova"
                        className={`w-full pl-8 pr-3 py-2.5 rounded-xl bg-white border text-xs sm:text-sm text-[#2D3732] focus:outline-none ${
                          usernameStatus === 'available'
                            ? 'border-emerald-400 focus:border-emerald-500'
                            : usernameStatus === 'taken'
                            ? 'border-red-400 focus:border-red-500'
                            : 'border-[#2D3732]/15 focus:border-[#8FA89B]'
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* Bio / Focus */}
                <div>
                  <label className="block text-xs font-medium text-[#2D3732] mb-1">
                    Bio & Focus
                  </label>
                  <textarea
                    rows={2}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Architectural photographer, exploring Nordic daylight and slow stoneware..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#2D3732]/15 text-xs sm:text-sm text-[#2D3732] focus:outline-none focus:border-[#8FA89B] resize-none"
                  />
                </div>

                {/* Location & Website */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="relative">
                    <MapPin size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7A8A82]" />
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Copenhagen, Denmark"
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white border border-[#2D3732]/15 text-xs sm:text-sm text-[#2D3732] focus:outline-none focus:border-[#8FA89B]"
                    />
                  </div>
                  <div className="relative">
                    <Globe size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7A8A82]" />
                    <input
                      type="url"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://elenarostova.design"
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white border border-[#2D3732]/15 text-xs sm:text-sm text-[#2D3732] focus:outline-none focus:border-[#8FA89B]"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Email Address */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-[#2D3732]">
                  Email Address *
                </label>
                {mode === 'signin' && (
                  <span className="text-[10px] text-[#7A8A82]">Quick-fill:</span>
                )}
              </div>

              {mode === 'signin' && (
                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('ericmusitafa8@gmail.com');
                      setPassword('Password123!');
                      setError(null);
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#E5EAE7]/70 hover:bg-[#8FA89B]/20 text-[#2D3732] text-[11px] font-medium transition-colors border border-[#2D3732]/10 cursor-pointer"
                  >
                    <span>ericmusitafa8@gmail.com</span>
                    <span className="text-[9px] px-1 py-0.2 bg-[#8FA89B]/20 text-[#3A5245] rounded font-semibold">User</span>
                  </button>
                </div>
              )}

              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7A8A82]" />
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={mode === 'signin' ? 'ericmusitafa8@gmail.com' : 'elena@nordic.design'}
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white border border-[#2D3732]/15 text-xs sm:text-sm text-[#2D3732] focus:outline-none focus:border-[#8FA89B]"
                />
              </div>
            </div>

            {/* Password with strength meter & toggle */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-[#2D3732]">
                  Password *
                </label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => {
                      setResetEmail(email);
                      setIsForgotModalOpen(true);
                    }}
                    className="text-[11px] text-[#8FA89B] hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7A8A82]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white border border-[#2D3732]/15 text-xs sm:text-sm text-[#2D3732] focus:outline-none focus:border-[#8FA89B]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#7A8A82] hover:text-[#2D3732]"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Password strength indicator for signup */}
              {mode === 'signup' && password.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center gap-1.5 h-1.5 w-full bg-[#E5EAE7] rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${strength.color}`}
                      style={{ width: `${(strength.score / 4) * 100}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-[#7A8A82] flex justify-between">
                    <span>Strength: {strength.label}</span>
                    <span>Min 6 characters</span>
                  </div>
                </div>
              )}
            </div>

            {/* Slow social manifesto agreement */}
            {mode === 'signup' && (
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[#F1F5F2] border border-[#2D3732]/10 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreedToManifesto}
                  onChange={(e) => setAgreedToManifesto(e.target.checked)}
                  className="mt-0.5 rounded text-[#8FA89B] focus:ring-[#8FA89B]"
                />
                <span className="text-xs text-[#2D3732]/80 leading-snug">
                  I agree to support slow, thoughtful sharing and respect authentic creators on Aura.
                </span>
              </label>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-4 py-3.5 px-6 rounded-2xl bg-[#2D3732] hover:bg-[#3d4a43] text-white text-xs sm:text-sm font-medium shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={16} className="animate-spin text-[#8FA89B]" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>{mode === 'signin' ? 'Sign In to Aura' : 'Create My Account'}</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Footer note */}
          <div className="mt-8 text-center text-xs text-[#7A8A82]">
            {mode === 'signin' ? (
              <p>
                Don't have an account yet?{' '}
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className="font-semibold text-[#2D3732] hover:underline cursor-pointer"
                >
                  Create one now
                </button>
              </p>
            ) : (
              <p>
                Already have an Aura account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('signin')}
                  className="font-semibold text-[#2D3732] hover:underline cursor-pointer"
                >
                  Sign in
                </button>
              </p>
            )}
          </div>

          {/* Mandatory Developer Footer Attribution */}
          <div className="mt-8 pt-6 border-t border-[#2D3732]/10 text-center space-y-1">
            <p className="text-xs font-semibold text-[#55635C] tracking-wide hover:text-[#2D3732] transition-colors">
              developed by reponsekdz
            </p>
            <p className="text-[11px] text-[#7A8A82]">
              Aura · Mindful Modern Social Platform
            </p>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2D3732]/50 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-[#FAFAF9] rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#2D3732]/10">
            <h3 className="font-serif text-xl text-[#2D3732] mb-2">Reset Password</h3>
            <p className="text-xs text-[#7A8A82] mb-4">
              Enter your email address to receive a secure password reset link.
            </p>

            {resetSent ? (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm space-y-3">
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 size={16} />
                  <span>Reset link sent!</span>
                </div>
                <p>Check your email inbox for instructions to reset your password.</p>
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotModalOpen(false);
                    setResetSent(false);
                  }}
                  className="w-full py-2.5 rounded-xl bg-emerald-700 text-white font-medium text-xs mt-2"
                >
                  Return to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handlePasswordResetSubmit} className="space-y-4">
                {resetError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs">
                    {resetError}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-[#2D3732] mb-1">
                    Your Registered Email
                  </label>
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="you@domain.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#2D3732]/15 text-xs text-[#2D3732] focus:outline-none focus:border-[#8FA89B]"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(false)}
                    className="py-2.5 px-4 rounded-xl text-xs text-[#7A8A82] hover:text-[#2D3732]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="py-2.5 px-5 rounded-xl bg-[#2D3732] text-white text-xs font-medium hover:bg-[#3d4a43]"
                  >
                    Send Reset Link
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Real Google Account Picker / Auth Modal */}
      <GoogleAuthModal
        isOpen={showGoogleModal}
        onClose={() => setShowGoogleModal(false)}
        initialTab={googleModalTab}
        defaultEmail={email.trim() || 'ericmusitafa8@gmail.com'}
        defaultName={name.trim() || 'Eric Musitafa'}
        onConfirmGoogleAuth={async (confirmedEmail, confirmedName, confirmedAvatar) => {
          await signInWithGoogle({
            email: confirmedEmail,
            name: confirmedName,
            avatar: confirmedAvatar,
          });
          auraAudio.playChime();
          onSuccess?.();
        }}
      />
    </div>
  );
};
