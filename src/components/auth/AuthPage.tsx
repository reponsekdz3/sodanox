import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { checkUsernameAvailable } from '../../services/userService';
import { AuraLogo } from '../common/AuraLogo';
import { auraAudio } from '../../utils/audioSynthesizer';
import { GoogleAuthModal } from './GoogleAuthModal';
import { ModernAvatar, MODERN_EMPTY_AVATAR_DATA_URI } from '../common/ModernAvatar';
import { compressImage } from '../../services/mediaCompressionService';
import { UploadProgressBar } from '../common/UploadProgressBar';
import {
  Lock,
  Mail,
  Phone,
  User as UserIcon,
  ArrowRight,
  Eye,
  EyeOff,
  CheckCircle2,
  Upload,
  Feather,
  Layers,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

interface AuthPageProps {
  onSuccess?: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onSuccess }) => {
  const { signIn, signUp, signInWithGoogle, sendPasswordReset } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [avatar, setAvatar] = useState(MODERN_EMPTY_AVATAR_DATA_URI);
  const [agreedToManifesto, setAgreedToManifesto] = useState(true);

  // Dynamic phone vs email detection
  const isPhoneInput = React.useMemo(() => {
    const trimmed = identifier.trim();
    if (trimmed.includes('@')) return false;
    return /^[+]?[0-9\s\-().]+$/.test(trimmed) && trimmed.replace(/\D/g, '').length >= 3;
  }, [identifier]);

  // Avatar upload progress
  const [avatarProgress, setAvatarProgress] = useState<number | null>(null);
  const [avatarStatus, setAvatarStatus] = useState<string>('');

  // Forgot password state
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  // Real Google Auth Modal state
  const [showGoogleModal, setShowGoogleModal] = useState(false);

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

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setError(null);
      setAvatarProgress(10);
      setAvatarStatus('Preparing avatar...');
      try {
        const compressed = await compressImage(file, {
          maxDimension: 512,
          quality: 0.88,
          onProgress: (p, status) => {
            setAvatarProgress(p);
            setAvatarStatus(status);
          },
        });
        setAvatar(compressed.dataUrl);
        setAvatarProgress(100);
        setTimeout(() => setAvatarProgress(null), 800);
      } catch {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            setAvatar(event.target.result as string);
          }
          setAvatarProgress(null);
        };
        reader.readAsDataURL(file);
      }
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
    if (score === 3) return { score: 3, label: 'Good', color: 'bg-[#059669]' };
    return { score: 4, label: 'Strong', color: 'bg-[#10B981]' };
  };

  const strength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (mode === 'signin') {
        if (!identifier.trim() || !password) {
          throw new Error('Please enter your email or phone number and password');
        }
        await signIn(identifier.trim(), password);
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
        if (!identifier.trim()) {
          throw new Error('Please enter your email or phone number');
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters');
        }
        if (!agreedToManifesto) {
          throw new Error('Please agree to the slow social manifesto to join');
        }

        await signUp(identifier.trim(), password, {
          name: name.trim(),
          username: username.trim(),
          avatar,
        });
        auraAudio.playChime();
        onSuccess?.();
      }
    } catch (err: unknown) {
      const e = err as { message?: string; code?: string };
      if (e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password' || e.code === 'auth/user-not-found') {
        setError('Invalid phone, email, or password. Please verify your credentials.');
      } else if (e.code === 'auth/email-already-in-use') {
        setError('This email or phone number is already registered. Please sign in instead.');
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
    <div className="min-h-screen w-full bg-[#F8FAF9] flex flex-col lg:flex-row text-[#022C22] antialiased selection:bg-[#059669]/20">
      {/* Left Column: Atmospheric Brand Manifesto */}
      <div className="hidden lg:flex lg:w-5/12 bg-gradient-to-br from-[#022C22] via-[#064E3B] to-[#033B2B] text-white p-8 lg:p-16 flex-col justify-between relative overflow-hidden">
        {/* Subtle background ambient blur circles */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-[#10B981]/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-[#059669]/20 blur-3xl pointer-events-none" />

        {/* Top: Logo & Title */}
        <div className="relative z-10">
          <div className="mb-8">
            <AuraLogo size="xl" variant="white" isInteractive={false} />
          </div>

          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-light leading-tight tracking-tight text-white mb-6">
            A quiet sanctuary for mindful creators.
          </h1>

          <p className="text-[#D1E2D9] text-sm sm:text-base leading-relaxed max-w-md font-light">
            No dopamine manipulation or endless noise. Share tactile stories, high-resolution visual reflections, and purposeful direct conversations in Dark Modern Green elegance.
          </p>
        </div>

        {/* Middle: Feature highlights */}
        <div className="relative z-10 my-10 space-y-4">
          <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
            <div className="p-2 rounded-xl bg-[#059669]/20 text-[#34D399] shrink-0 mt-0.5">
              <Layers size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Interactive Stories & Highlights</h2>
              <p className="text-xs text-white/70 mt-0.5">
                Live interactive story creator, permanent highlights, percentage progress uploads, and question stickers.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
            <div className="p-2 rounded-xl bg-[#059669]/20 text-[#34D399] shrink-0 mt-0.5">
              <Feather size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">High-Fidelity Resolution Presets</h2>
              <p className="text-xs text-white/70 mt-0.5">
                4K UHD, 1080p, and multi-aspect ratio compression with live line-and-percent progress indicators.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
            <div className="p-2 rounded-xl bg-[#059669]/20 text-[#34D399] shrink-0 mt-0.5">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Direct Chat & Deep Link Sharing</h2>
              <p className="text-xs text-white/70 mt-0.5">
                Share posts directly into encrypted chats with rich cards, voice notes, and real-time audio/video calls.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom: Genuine Member Guarantee & Developer Credit */}
        <div className="relative z-10 pt-6 border-t border-white/10 space-y-3">
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
            <div className="w-8 h-8 rounded-xl bg-[#059669]/25 flex items-center justify-center shrink-0">
              <Sparkles size={18} className="text-[#34D399]" />
            </div>
            <div>
              <p className="text-xs font-semibold text-white">Pure User-Generated Community</p>
              <p className="text-[11px] text-[#D1E2D9]">
                100% genuine member accounts. All stories, posts, and conversations persist in real time.
              </p>
            </div>
          </div>
          <div className="text-center">
            <p className="text-[11px] text-white/60 font-medium tracking-wide">
              app developed by reponsekdz · AuraChats
            </p>
          </div>
        </div>
      </div>

      {/* Right Column: Interactive Login & Register Forms */}
      <div className="w-full lg:w-7/12 flex items-center justify-center p-4 sm:p-8 lg:p-16 overflow-y-auto">
        <div className="w-full max-w-xl">
          {/* Mobile Logo on small screens */}
          <div className="lg:hidden mb-6 flex items-center justify-center">
            <AuraLogo size="lg" variant="sage" isInteractive={false} />
          </div>

          {/* Segmented Mode Switcher */}
          <div className="p-1.5 bg-[#EDF3F0] rounded-2xl flex items-center mb-8 border border-[#D1E2D9] shadow-inner">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError(null);
              }}
              className={`flex-1 py-3 text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer ${
                mode === 'signin'
                  ? 'bg-white text-[#064E3B] shadow-sm'
                  : 'text-[#4B6358] hover:text-[#022C22]'
              }`}
            >
              Sign In to AuraChats
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError(null);
              }}
              className={`flex-1 py-3 text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer ${
                mode === 'signup'
                  ? 'bg-white text-[#064E3B] shadow-sm'
                  : 'text-[#4B6358] hover:text-[#022C22]'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Form Header */}
          <div className="mb-6">
            <h2 className="font-serif text-2xl sm:text-3xl font-light text-[#022C22]">
              {mode === 'signin' ? 'Welcome back to AuraChats' : 'Begin your creative journey'}
            </h2>
            <p className="text-xs sm:text-sm text-[#4B6358] mt-1">
              {mode === 'signin'
                ? 'Enter your credentials to enter your curated mindful feed.'
                : 'Craft your profile, set your unique handle, and start posting stories and projects.'}
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm flex flex-col gap-2.5 animate-fade-in">
              <div className="flex items-start gap-3">
                <AlertCircle size={18} className="shrink-0 mt-0.5 text-rose-600" />
                <div className="flex-1 leading-relaxed">{error}</div>
              </div>
              {(error.includes('No account found') || error.includes('Create one now')) && mode === 'signin' && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setError(null);
                    if (!name && identifier) {
                      setName(identifier.includes('@') ? identifier.split('@')[0] : `Member ${identifier.slice(-4)}`);
                    }
                    if (!username && identifier) {
                      const userSeed = identifier.includes('@') ? identifier.split('@')[0] : `user_${identifier.replace(/\D/g, '').slice(-6)}`;
                      setUsername(userSeed.toLowerCase().replace(/[^a-z0-9_.]/g, ''));
                    }
                  }}
                  className="self-start text-xs font-semibold px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition-colors shadow-sm ml-7 cursor-pointer"
                >
                  Create account with {identifier || 'this credential'} →
                </button>
              )}
            </div>
          )}

          {/* Google Sign In */}
          <div className="space-y-3 mb-6">
            <button
              type="button"
              onClick={async () => {
                setError(null);
                setIsSubmitting(true);
                try {
                  await signInWithGoogle();
                  auraAudio.playChime();
                  onSuccess?.();
                } catch (err: any) {
                  console.info('Google sign-in popup notice:', err?.message);
                  setShowGoogleModal(true);
                } finally {
                  setIsSubmitting(false);
                }
              }}
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-2xl bg-white border border-[#D1E2D9] hover:bg-[#EDF3F0] text-xs sm:text-sm font-semibold text-[#022C22] shadow-sm transition-all cursor-pointer disabled:opacity-50"
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
          </div>

          <div className="relative flex py-2 items-center mb-6">
            <div className="flex-grow border-t border-[#D1E2D9]"></div>
            <span className="flex-shrink mx-4 text-[11px] uppercase tracking-wider text-[#4B6358] font-mono font-medium">
              Or with phone, email & password
            </span>
            <div className="flex-grow border-t border-[#D1E2D9]"></div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                {/* Profile Photo Selection */}
                <div className="p-4 rounded-2xl bg-white border border-[#D1E2D9] shadow-soft space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#022C22] uppercase tracking-wider">
                      Profile Avatar
                    </span>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-[#059669] hover:text-[#064E3B] font-semibold flex items-center gap-1.5 cursor-pointer"
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
                      className="border-2 border-white shadow-md ring-2 ring-[#059669]/30"
                    />
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-[#022C22] mb-0.5">
                        Interactive Avatar
                      </div>
                      <div className="text-[11px] text-[#4B6358] leading-snug">
                        Instant compression with live progress. You can also customize your avatar anytime in settings.
                      </div>
                      {avatar !== MODERN_EMPTY_AVATAR_DATA_URI && (
                        <button
                          type="button"
                          onClick={() => setAvatar(MODERN_EMPTY_AVATAR_DATA_URI)}
                          className="mt-1.5 text-[11px] text-[#059669] hover:underline font-semibold cursor-pointer"
                        >
                          Reset to default Modern Avatar
                        </button>
                      )}
                    </div>
                  </div>

                  {avatarProgress !== null && (
                    <UploadProgressBar
                      progress={avatarProgress}
                      statusText={avatarStatus}
                    />
                  )}
                </div>

                {/* Name & Username Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#022C22] mb-1">
                      Full Name *
                    </label>
                    <div className="relative">
                      <UserIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4B6358]" />
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Elena Rostova"
                        className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white border border-[#D1E2D9] text-xs sm:text-sm text-[#022C22] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-[#022C22]">
                        Username *
                      </label>
                      {usernameStatus === 'checking' && (
                        <span className="text-[10px] text-[#4B6358]">Checking...</span>
                      )}
                      {usernameStatus === 'available' && (
                        <span className="text-[10px] text-emerald-600 font-semibold">Available</span>
                      )}
                      {usernameStatus === 'taken' && (
                        <span className="text-[10px] text-rose-500 font-semibold">Taken</span>
                      )}
                    </div>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-[#4B6358]">
                        @
                      </span>
                      <input
                        type="text"
                        required
                        value={username}
                        onChange={(e) => handleUsernameChange(e.target.value)}
                        placeholder="elenarostova"
                        className={`w-full pl-8 pr-3 py-2.5 rounded-xl bg-white border text-xs sm:text-sm text-[#022C22] focus:outline-none ${
                          usernameStatus === 'available'
                            ? 'border-emerald-400 focus:border-emerald-500'
                            : usernameStatus === 'taken'
                            ? 'border-rose-400 focus:border-rose-500'
                            : 'border-[#D1E2D9] focus:border-[#059669] focus:ring-1 focus:ring-[#059669]'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Phone Number or Email Address */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-[#022C22]">
                  Email or Phone Number *
                </label>
                {isPhoneInput ? (
                  <span className="text-[10px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full font-medium border border-emerald-200 flex items-center gap-1">
                    <Phone size={10} />
                    Phone Number
                  </span>
                ) : identifier.includes('@') ? (
                  <span className="text-[10px] text-teal-800 bg-teal-50 px-2 py-0.5 rounded-full font-medium border border-teal-200 flex items-center gap-1">
                    <Mail size={10} />
                    Email Address
                  </span>
                ) : null}
              </div>

              <div className="relative">
                {isPhoneInput ? (
                  <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-700 transition-colors" />
                ) : (
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4B6358] transition-colors" />
                )}
                <input
                  type={isPhoneInput ? 'tel' : 'text'}
                  autoComplete="username email tel"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="name@example.com or +250 788 123 456"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white border border-[#D1E2D9] text-xs sm:text-sm text-[#022C22] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]"
                />
              </div>
            </div>

            {/* Password with strength meter & toggle */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-[#022C22]">
                  Password *
                </label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => {
                      setResetEmail(identifier);
                      setIsForgotModalOpen(true);
                    }}
                    className="text-[11px] text-[#059669] hover:underline font-semibold cursor-pointer"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4B6358]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white border border-[#D1E2D9] text-xs sm:text-sm text-[#022C22] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#4B6358] hover:text-[#022C22]"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Password strength indicator for signup */}
              {mode === 'signup' && password.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center gap-1.5 h-1.5 w-full bg-[#EDF3F0] rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${strength.color}`}
                      style={{ width: `${(strength.score / 4) * 100}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-[#4B6358] flex justify-between">
                    <span>Strength: {strength.label}</span>
                    <span>Min 6 characters</span>
                  </div>
                </div>
              )}
            </div>

            {/* Slow social manifesto agreement */}
            {mode === 'signup' && (
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[#EDF3F0] border border-[#D1E2D9] cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreedToManifesto}
                  onChange={(e) => setAgreedToManifesto(e.target.checked)}
                  className="mt-0.5 rounded text-[#064E3B] focus:ring-[#059669]"
                />
                <span className="text-xs text-[#022C22]/80 leading-snug">
                  I agree to support slow, thoughtful sharing and respect authentic creators on AuraChats.
                </span>
              </label>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-4 py-3.5 px-6 rounded-2xl bg-[#064E3B] hover:bg-[#022C22] text-white text-xs sm:text-sm font-semibold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={16} className="animate-spin text-[#34D399]" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>{mode === 'signin' ? 'Sign In to AuraChats' : 'Create My Account'}</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Footer note */}
          <div className="mt-8 text-center text-xs text-[#4B6358]">
            {mode === 'signin' ? (
              <p>
                Don't have an account yet?{' '}
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className="font-bold text-[#064E3B] hover:underline cursor-pointer"
                >
                  Create one now
                </button>
              </p>
            ) : (
              <p>
                Already have an AuraChats account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('signin')}
                  className="font-bold text-[#064E3B] hover:underline cursor-pointer"
                >
                  Sign in
                </button>
              </p>
            )}
          </div>

          {/* Mandatory Developer Footer Attribution */}
          <div className="mt-8 pt-6 border-t border-[#D1E2D9] text-center space-y-1">
            <p className="text-xs font-semibold text-[#064E3B] tracking-wide hover:text-[#022C22] transition-colors">
              developed by reponsekdz
            </p>
            <p className="text-[11px] text-[#4B6358]">
              AuraChats · Mindful Modern Social Platform
            </p>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#D1E2D9]">
            <h3 className="font-serif text-xl font-medium text-[#022C22] mb-2">Reset Password</h3>
            <p className="text-xs text-[#4B6358] mb-4">
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
                  className="w-full py-2.5 rounded-xl bg-[#064E3B] hover:bg-[#022C22] text-white font-semibold text-xs mt-2"
                >
                  Return to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handlePasswordResetSubmit} className="space-y-4">
                {resetError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs">
                    {resetError}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-[#022C22] mb-1">
                    Your Registered Email or Phone Number
                  </label>
                  <input
                    type="text"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="you@domain.com or +250 788 123 456"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#D1E2D9] text-xs text-[#022C22] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(false)}
                    className="py-2.5 px-4 rounded-xl text-xs text-[#4B6358] hover:text-[#022C22]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="py-2.5 px-5 rounded-xl bg-[#064E3B] text-white text-xs font-semibold hover:bg-[#022C22]"
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
        onSuccess={() => {
          auraAudio.playChime();
          onSuccess?.();
        }}
      />
    </div>
  );
};
