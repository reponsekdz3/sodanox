import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Video,
  Music,
  Tag,
  Sparkles,
  Upload,
  Play,
  Volume2,
  VolumeX,
  Image as ImageIcon,
  CheckCircle2,
  Film,
  AlertCircle,
  Clock,
  RotateCcw,
  Camera,
  RefreshCw,
  Square,
  Circle,
  Link as LinkIcon,
} from 'lucide-react';
import { User } from '../../types';
import { auraAudio } from '../../utils/audioSynthesizer';

interface CreateReelModalProps {
  currentUser: User;
  onClose: () => void;
  onSubmitReel: (data: {
    videoUrl: string;
    posterUrl: string;
    caption: string;
    tags: string[];
    audioTitle: string;
    audioArtist: string;
  }) => Promise<void> | void;
}

const AMBIENT_AUDIO_PRESETS = [
  { title: 'Quiet Wheel Ambience', artist: 'Aura Soundscapes' },
  { title: 'Morning Coffee Acoustic', artist: 'Nordic Series' },
  { title: 'Ocean & Stone Reverberation', artist: 'Field Archives' },
  { title: 'Analog Tape Drift', artist: 'Slow Craft' },
  { title: 'Felt & Acoustic Wood', artist: 'Quiet Resonance' },
];

function generateModernPosterSvg(title: string, authorName: string): string {
  const cleanTitle = (title || 'Aura Reel').slice(0, 32);
  const cleanAuthor = authorName || 'Creator';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280" viewBox="0 0 720 1280">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1E2A23" />
        <stop offset="50%" stop-color="#2D3E33" />
        <stop offset="100%" stop-color="#121814" />
      </linearGradient>
    </defs>
    <rect width="720" height="1280" fill="url(#bg)" />
    <circle cx="360" cy="560" r="110" fill="#8FA89B" fill-opacity="0.12" />
    <circle cx="360" cy="560" r="75" fill="#8FA89B" fill-opacity="0.2" />
    <polygon points="340,515 405,560 340,605" fill="#FAFAF9" opacity="0.9" />
    <text x="360" y="740" font-family="serif" font-size="34" fill="#FAFAF9" text-anchor="middle" font-weight="500">${cleanTitle}</text>
    <text x="360" y="790" font-family="sans-serif" font-size="20" fill="#8FA89B" text-anchor="middle">@${cleanAuthor}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const CreateReelModal: React.FC<CreateReelModalProps> = ({
  currentUser,
  onClose,
  onSubmitReel,
}) => {
  // Creation Mode: 'upload' | 'camera' | 'url'
  const [sourceMode, setSourceMode] = useState<'upload' | 'camera' | 'url'>('upload');

  // Video source state
  const [localVideoFile, setLocalVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [posterUrl, setPosterUrl] = useState<string>('');
  const [customVideoUrl, setCustomVideoUrl] = useState('');

  // Live Camera recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [cameraActive, setCameraActive] = useState(false);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<number | null>(null);

  // Player state in modal
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [videoDuration, setVideoDuration] = useState<number>(0);

  // Content details
  const [caption, setCaption] = useState('');
  const [customTags, setCustomTags] = useState('');
  const [audioSourceType, setAudioSourceType] = useState<'video' | 'ambient' | 'custom'>('video');
  const [audioTitle, setAudioTitle] = useState('Original Sound');
  const [audioArtist, setAudioArtist] = useState(currentUser.name);

  // Status & loading
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingPoster, setIsGeneratingPoster] = useState(false);

  const videoInputRef = useRef<HTMLInputElement>(null);
  const posterInputRef = useRef<HTMLInputElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  // Cleanup object URLs & streams when component unmounts
  useEffect(() => {
    return () => {
      stopCameraStream();
      if (videoUrl && videoUrl.startsWith('blob:')) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  // Stop camera helper
  const stopCameraStream = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setCameraActive(false);
    setIsRecording(false);
  };

  // Start camera stream for live recording
  const startCameraStream = async () => {
    stopCameraStream();
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: cameraFacing,
          width: { ideal: 720 },
          height: { ideal: 1280 },
        },
        audio: true,
      });
      cameraStreamRef.current = stream;
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
        cameraVideoRef.current.play().catch(() => {});
      }
      setCameraActive(true);
    } catch (err: unknown) {
      console.warn('Camera stream error:', err);
      setError('Could not access camera or microphone. Please check device permissions.');
      setCameraActive(false);
    }
  };

  // Toggle camera active when mode switches to 'camera'
  useEffect(() => {
    if (sourceMode === 'camera' && !videoUrl) {
      startCameraStream();
    } else {
      stopCameraStream();
    }
    return () => stopCameraStream();
  }, [sourceMode, cameraFacing]);

  // Flip camera facing mode
  const handleFlipCamera = () => {
    setCameraFacing((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  // Start Live Recording
  const handleStartRecording = () => {
    if (!cameraStreamRef.current) return;
    setError(null);
    setRecordedChunks([]);
    setRecordingSeconds(0);

    try {
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : 'video/mp4';

      const recorder = new MediaRecorder(cameraStreamRef.current, { mimeType });
      mediaRecorderRef.current = recorder;
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const fullBlob = new Blob(chunks, { type: mimeType });
        const objectUrl = URL.createObjectURL(fullBlob);
        setVideoUrl(objectUrl);
        setAudioTitle('Live Camera Reel');
        setAudioArtist(currentUser.name);
        extractPosterFromObjectUrl(objectUrl);
        stopCameraStream();
      };

      recorder.start(250);
      setIsRecording(true);

      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 60) {
            handleStopRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.warn('MediaRecorder error:', err);
      setError('Could not start video recording on this device.');
    }
  };

  // Stop Live Recording
  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
  };

  // Auto extract poster from video object URL
  const extractPosterFromObjectUrl = (objectUrl: string) => {
    setIsGeneratingPoster(true);
    const tempVideo = document.createElement('video');
    tempVideo.src = objectUrl;
    tempVideo.crossOrigin = 'anonymous';
    tempVideo.muted = true;
    tempVideo.currentTime = 0.5;

    tempVideo.onloadeddata = () => {
      tempVideo.currentTime = Math.min(1.0, (tempVideo.duration || 2) / 2);
    };

    tempVideo.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = tempVideo.videoWidth || 720;
        canvas.height = tempVideo.videoHeight || 1280;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setPosterUrl(dataUrl);
        }
      } catch (err) {
        console.warn('Could not auto-generate video poster frame:', err);
        setPosterUrl(generateModernPosterSvg(caption || 'Aura Reel', currentUser.name));
      } finally {
        setIsGeneratingPoster(false);
      }
    };

    tempVideo.onerror = () => {
      setIsGeneratingPoster(false);
      setPosterUrl(generateModernPosterSvg(caption || 'Aura Reel', currentUser.name));
    };
  };

  // Handle local video upload from user's storage
  const handleLocalVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 100 * 1024 * 1024) {
      setError('Video file exceeds 100MB limit. Please choose a smaller video.');
      return;
    }

    setError(null);
    setLocalVideoFile(file);
    setCustomVideoUrl('');

    const objectUrl = URL.createObjectURL(file);
    setVideoUrl(objectUrl);
    setAudioTitle(file.name.replace(/\.[^/.]+$/, ''));
    setAudioArtist(currentUser.name);
    extractPosterFromObjectUrl(objectUrl);
  };

  // Handle custom poster upload from local storage
  const handleCustomPosterUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError('Cover image exceeds 10MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setPosterUrl(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleApplyCustomVideoUrl = () => {
    if (!customVideoUrl.trim()) return;
    setError(null);
    setLocalVideoFile(null);
    setVideoUrl(customVideoUrl.trim());
    setAudioTitle('Web Video Reel');
    setAudioArtist(currentUser.name);
    extractPosterFromObjectUrl(customVideoUrl.trim());
  };

  const handleVideoLoadedMetadata = () => {
    if (previewVideoRef.current) {
      setVideoDuration(previewVideoRef.current.duration);
    }
  };

  const toggleModalPlayback = () => {
    if (!previewVideoRef.current) return;
    if (previewVideoRef.current.paused) {
      previewVideoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      previewVideoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleResetVideo = () => {
    if (videoUrl && videoUrl.startsWith('blob:')) {
      URL.revokeObjectURL(videoUrl);
    }
    setVideoUrl('');
    setPosterUrl('');
    setLocalVideoFile(null);
    setCustomVideoUrl('');
    setIsPlaying(false);
    if (sourceMode === 'camera') {
      startCameraStream();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoUrl) {
      setError('Please record or upload a video file for your reel.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const tagsArray = customTags
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean);

      let finalPoster = posterUrl;
      // If no poster was generated, attempt extract or fallback to dynamic SVG
      if (!finalPoster && previewVideoRef.current) {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = previewVideoRef.current.videoWidth || 720;
          canvas.height = previewVideoRef.current.videoHeight || 1280;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(previewVideoRef.current, 0, 0, canvas.width, canvas.height);
            finalPoster = canvas.toDataURL('image/jpeg', 0.85);
          }
        } catch {
          finalPoster = generateModernPosterSvg(caption || 'Aura Reel', currentUser.name);
        }
      }

      if (!finalPoster) {
        finalPoster = generateModernPosterSvg(caption || 'Aura Reel', currentUser.name);
      }

      await onSubmitReel({
        videoUrl,
        posterUrl: finalPoster,
        caption: caption.trim() || 'A quiet moment shared on Aura.',
        tags: tagsArray,
        audioTitle: audioTitle.trim() || 'Original Sound',
        audioArtist: audioArtist.trim() || currentUser.name,
      });

      auraAudio.playChime();
      onClose();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to publish reel. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#2D3732]/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in select-none">
      <div className="w-full max-w-4xl bg-[#FAFAF9] rounded-3xl shadow-2xl overflow-hidden border border-[#2D3732]/10 flex flex-col max-h-[92vh]">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2D3732]/10 bg-[#F1F5F2]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#8FA89B]/20 flex items-center justify-center text-[#5E7C6E]">
              <Film size={18} />
            </div>
            <div>
              <h2 className="text-base font-serif font-medium text-[#2D3732]">
                Create Real Reel
              </h2>
              <p className="text-[11px] text-[#7A8A82]">
                Record live or upload your authentic video moment to the community
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-[#7A8A82] hover:text-[#2D3732] hover:bg-[#E6EDE9] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 rounded-2xl bg-red-50 text-red-700 text-xs border border-red-200 flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Live Reel Video Preview Player (Aspect 9:16) */}
            <div className="lg:col-span-5 flex flex-col items-center">
              <div className="relative w-full max-w-[280px] aspect-[9/16] rounded-3xl overflow-hidden bg-black shadow-xl border border-neutral-800 flex items-center justify-center group select-none">
                {videoUrl ? (
                  <>
                    <video
                      ref={previewVideoRef}
                      src={videoUrl}
                      poster={posterUrl}
                      muted={isMuted}
                      loop
                      playsInline
                      onLoadedMetadata={handleVideoLoadedMetadata}
                      onClick={toggleModalPlayback}
                      className="w-full h-full object-cover cursor-pointer"
                    />

                    {/* Play/Pause Overlay */}
                    {!isPlaying && (
                      <div
                        onClick={toggleModalPlayback}
                        className="absolute inset-0 bg-black/30 flex items-center justify-center cursor-pointer transition-opacity"
                      >
                        <div className="w-14 h-14 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white">
                          <Play size={24} className="ml-0.5 fill-white" />
                        </div>
                      </div>
                    )}

                    {/* Bottom overlay pills */}
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] text-white/90 z-20 pointer-events-none">
                      <div className="px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-md flex items-center gap-1.5 font-mono">
                        <Clock size={11} className="text-[#8FA89B]" />
                        <span>{videoDuration ? formatDuration(videoDuration) : '0:15'}</span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsMuted(!isMuted);
                        }}
                        className="p-2 rounded-full bg-black/50 backdrop-blur-md pointer-events-auto hover:bg-black/70 cursor-pointer"
                      >
                        {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                      </button>
                    </div>

                    {/* Reset video pill */}
                    <button
                      type="button"
                      onClick={handleResetVideo}
                      className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 text-white/90 hover:bg-black/80 text-[11px] flex items-center gap-1 backdrop-blur-md cursor-pointer z-30"
                      title="Discard and select new video"
                    >
                      <RotateCcw size={13} />
                    </button>
                  </>
                ) : sourceMode === 'camera' && cameraActive ? (
                  <div className="relative w-full h-full bg-black flex flex-col justify-between p-3">
                    <video
                      ref={cameraVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className={`w-full h-full object-cover absolute inset-0 ${
                        cameraFacing === 'user' ? '-scale-x-100' : ''
                      }`}
                    />

                    {/* Live Camera Controls */}
                    <div className="relative z-20 flex items-center justify-between">
                      {isRecording ? (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600/90 text-white text-xs font-mono font-medium animate-pulse">
                          <Circle size={8} className="fill-white" />
                          <span>0:{recordingSeconds < 10 ? `0${recordingSeconds}` : recordingSeconds}</span>
                        </div>
                      ) : (
                        <div className="px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-md text-white/80 text-[11px]">
                          Ready to record
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={handleFlipCamera}
                        className="p-2 rounded-full bg-black/50 backdrop-blur-md text-white hover:bg-black/70 cursor-pointer"
                        title="Flip Camera"
                      >
                        <RefreshCw size={14} />
                      </button>
                    </div>

                    {/* Center or Bottom Record Trigger */}
                    <div className="relative z-20 flex items-center justify-center pb-2">
                      {isRecording ? (
                        <button
                          type="button"
                          onClick={handleStopRecording}
                          className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center bg-red-600 shadow-lg active:scale-95 transition-transform cursor-pointer"
                          title="Finish Recording"
                        >
                          <Square size={22} className="fill-white text-white" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleStartRecording}
                          className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center bg-red-500 shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
                          title="Start Video Recording"
                        >
                          <div className="w-8 h-8 rounded-full bg-white" />
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 text-center text-neutral-400">
                    <Video size={36} className="mb-2 text-[#8FA89B]/60 animate-pulse" />
                    <p className="text-xs font-medium text-neutral-300">No video selected</p>
                    <p className="text-[10px] text-neutral-500 mt-1">Upload from device or record live</p>
                  </div>
                )}

                {isGeneratingPoster && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center text-white text-xs gap-2 z-30">
                    <RotateCcw size={16} className="animate-spin text-[#8FA89B]" />
                    <span>Extracting thumbnail...</span>
                  </div>
                )}
              </div>

              {/* Cover thumbnail upload helper */}
              <div className="w-full max-w-[280px] mt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => posterInputRef.current?.click()}
                  className="w-full text-center py-2 px-3 rounded-xl bg-[#F1F5F2] hover:bg-[#E6EDE9] text-[#2D3732] text-xs font-medium border border-[#2D3732]/10 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ImageIcon size={13} className="text-[#8FA89B]" />
                  <span>Customize Cover Poster</span>
                </button>
                <input
                  ref={posterInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleCustomPosterUpload}
                  className="hidden"
                />
              </div>
            </div>

            {/* Right Column: Upload Source & Parameters */}
            <div className="lg:col-span-7 space-y-5">
              {/* Source Mode Tabs */}
              <div className="flex items-center gap-2 p-1 bg-[#F1F5F2] rounded-2xl border border-[#2D3732]/10">
                <button
                  type="button"
                  onClick={() => setSourceMode('upload')}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    sourceMode === 'upload'
                      ? 'bg-white text-[#2D3732] shadow-xs'
                      : 'text-[#7A8A82] hover:text-[#2D3732]'
                  }`}
                >
                  <Upload size={14} />
                  <span>Upload File</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSourceMode('camera');
                    if (!videoUrl) startCameraStream();
                  }}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    sourceMode === 'camera'
                      ? 'bg-white text-[#2D3732] shadow-xs'
                      : 'text-[#7A8A82] hover:text-[#2D3732]'
                  }`}
                >
                  <Camera size={14} />
                  <span>Record Camera</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSourceMode('url')}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    sourceMode === 'url'
                      ? 'bg-white text-[#2D3732] shadow-xs'
                      : 'text-[#7A8A82] hover:text-[#2D3732]'
                  }`}
                >
                  <LinkIcon size={14} />
                  <span>Video URL</span>
                </button>
              </div>

              {/* Source Mode 1: File Upload */}
              {sourceMode === 'upload' && (
                <div className="p-5 rounded-3xl bg-white border-2 border-dashed border-[#8FA89B]/40 hover:border-[#8FA89B] transition-all text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-12 h-12 rounded-2xl bg-[#8FA89B]/15 flex items-center justify-center text-[#5E7C6E]">
                      <Upload size={22} />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-semibold text-[#2D3732]">
                        Choose Video from Your Device
                      </p>
                      <p className="text-[11px] text-[#7A8A82] mt-0.5">
                        Supports MP4, WebM, QuickTime, or OGG up to 100MB
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => videoInputRef.current?.click()}
                      className="mt-2 px-5 py-2.5 rounded-2xl bg-[#2D3732] hover:bg-[#3d4a43] text-white text-xs font-medium transition-all shadow-sm active:scale-95 cursor-pointer flex items-center gap-2"
                    >
                      <Video size={14} />
                      <span>Browse Files</span>
                    </button>

                    <input
                      ref={videoInputRef}
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime,video/ogg"
                      onChange={handleLocalVideoUpload}
                      className="hidden"
                    />

                    {localVideoFile && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
                        <CheckCircle2 size={13} />
                        <span className="truncate max-w-[240px] font-mono">{localVideoFile.name}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Source Mode 2: Camera Recorder Info */}
              {sourceMode === 'camera' && (
                <div className="p-4 rounded-3xl bg-[#F1F5F2] border border-[#2D3732]/10 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#2D3732]">
                    <Camera size={16} className="text-[#8FA89B]" />
                    <span>Live Reel Studio</span>
                  </div>
                  <p className="text-xs text-[#7A8A82] leading-relaxed">
                    Use your front or back camera directly to record high-definition vertical video. Tap the circular record button on the viewfinder to capture up to 60 seconds.
                  </p>
                </div>
              )}

              {/* Source Mode 3: Direct Link */}
              {sourceMode === 'url' && (
                <div className="p-4 rounded-3xl bg-white border border-[#2D3732]/10 space-y-3">
                  <label className="block text-xs font-semibold text-[#2D3732]">
                    Paste Video Direct URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={customVideoUrl}
                      onChange={(e) => setCustomVideoUrl(e.target.value)}
                      placeholder="https://example.com/video.mp4"
                      className="flex-1 bg-[#FAFAF9] border border-[#2D3732]/15 rounded-2xl px-3.5 py-2 text-xs text-[#2D3732] focus:outline-none focus:border-[#8FA89B]"
                    />
                    <button
                      type="button"
                      onClick={handleApplyCustomVideoUrl}
                      className="px-4 py-2 bg-[#2D3732] text-white text-xs font-medium rounded-2xl hover:bg-[#3d4a43] transition-colors cursor-pointer"
                    >
                      Load
                    </button>
                  </div>
                </div>
              )}

              {/* Caption */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-[#2D3732]">
                    Caption & Reflections
                  </label>
                  <span className="text-[11px] text-[#7A8A82] font-mono">
                    {caption.length}/300
                  </span>
                </div>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Describe the rhythm, process, or atmosphere of this moment..."
                  rows={2}
                  maxLength={300}
                  className="w-full bg-white border border-[#2D3732]/15 focus:border-[#8FA89B] rounded-2xl p-3.5 text-xs sm:text-sm text-[#2D3732] placeholder-[#7A8A82] transition-all focus:outline-none resize-none shadow-xs"
                />
              </div>

              {/* Soundtrack & Audio Attribution */}
              <div className="p-3.5 rounded-2xl bg-[#F1F5F2] border border-[#2D3732]/10 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#2D3732] flex items-center gap-1.5">
                    <Music size={13} className="text-[#8FA89B]" />
                    <span>Soundtrack Selection</span>
                  </label>
                  <div className="flex items-center gap-1 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setAudioSourceType('video')}
                      className={`px-2 py-0.5 rounded-lg cursor-pointer ${
                        audioSourceType === 'video'
                          ? 'bg-[#2D3732] text-white font-medium'
                          : 'text-[#7A8A82] hover:text-[#2D3732]'
                      }`}
                    >
                      Original
                    </button>
                    <button
                      type="button"
                      onClick={() => setAudioSourceType('ambient')}
                      className={`px-2 py-0.5 rounded-lg cursor-pointer ${
                        audioSourceType === 'ambient'
                          ? 'bg-[#2D3732] text-white font-medium'
                          : 'text-[#7A8A82] hover:text-[#2D3732]'
                      }`}
                    >
                      Soundscapes
                    </button>
                  </div>
                </div>

                {audioSourceType === 'ambient' && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    {AMBIENT_AUDIO_PRESETS.map((t) => (
                      <button
                        key={t.title}
                        type="button"
                        onClick={() => {
                          setAudioTitle(t.title);
                          setAudioArtist(t.artist);
                        }}
                        className={`px-2.5 py-1 rounded-xl text-[11px] whitespace-nowrap border transition-colors cursor-pointer ${
                          audioTitle === t.title
                            ? 'bg-[#8FA89B] text-white border-transparent'
                            : 'bg-white text-[#55635C] border-[#2D3732]/10 hover:border-[#8FA89B]'
                        }`}
                      >
                        {t.title}
                      </button>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <input
                      type="text"
                      value={audioTitle}
                      onChange={(e) => setAudioTitle(e.target.value)}
                      placeholder="Audio title"
                      className="w-full bg-white rounded-xl px-3 py-2 text-xs text-[#2D3732] border border-[#2D3732]/15 focus:outline-none focus:border-[#8FA89B]"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={audioArtist}
                      onChange={(e) => setAudioArtist(e.target.value)}
                      placeholder="Audio artist"
                      className="w-full bg-white rounded-xl px-3 py-2 text-xs text-[#2D3732] border border-[#2D3732]/15 focus:outline-none focus:border-[#8FA89B]"
                    />
                  </div>
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-xs font-medium text-[#2D3732] mb-1.5 flex items-center gap-1.5">
                  <Tag size={12} className="text-[#8FA89B]" />
                  <span>Discovery Tags</span>
                </label>
                <input
                  type="text"
                  value={customTags}
                  onChange={(e) => setCustomTags(e.target.value)}
                  placeholder="e.g. Craft, SlowLiving, Nature, Design"
                  className="w-full bg-white rounded-2xl px-4 py-2.5 text-xs text-[#2D3732] border border-[#2D3732]/15 focus:outline-none focus:border-[#8FA89B] shadow-xs"
                />
              </div>
            </div>
          </div>

          {/* Footer Submit Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#2D3732]/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-[#7A8A82] hover:text-[#2D3732] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !videoUrl}
              className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-[#8FA89B] hover:bg-[#7e9689] text-white text-xs font-medium transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Sparkles size={14} />
              <span>{isSubmitting ? 'Uploading & Publishing...' : 'Publish Reel'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
