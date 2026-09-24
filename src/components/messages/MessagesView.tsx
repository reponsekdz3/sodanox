import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Phone,
  Video,
  Paperclip,
  Mic,
  Send,
  Search,
  Check,
  CheckCheck,
  CheckCircle2,
  FileText,
  Smile,
  ArrowLeft,
  X,
  User as UserIcon,
  Reply,
  Heart,
  ThumbsUp,
  Flame,
  Laugh,
  Plus,
  Info,
  Trash2,
  Copy,
  Download,
  Image as ImageIcon,
  Volume2,
  MoreVertical,
  Calendar,
  MapPin,
  ExternalLink,
  PanelLeft,
  Globe,
} from 'lucide-react';
import { ChatConversation, Message, MessageReplyInfo, User, VoiceNoteMeta } from '../../types';
import { VoiceNotePlayer } from './VoiceNotePlayer';
import { VoiceRecorderBar } from './VoiceRecorderBar';
import { FileAttachmentCard } from './FileAttachmentCard';
import { LinkPreviewCard, extractUrls } from './LinkPreviewCard';
import { sendBrowserNotification } from '../../services/browserNotificationService';
import {
  subscribeToMessages,
  subscribeToUserConversations,
  sendChatMessage,
  markConversationAsRead,
  setTypingIndicator,
  getOrCreateConversation,
  getDeterministicConvId,
  addMessageReaction,
  deleteChatMessage,
  clearConversationMessages,
} from '../../services/chatService';
import { getAllUsers } from '../../services/userService';
import { auraAudio } from '../../utils/audioSynthesizer';
import { ModernAvatar } from '../common/ModernAvatar';

interface MessagesViewProps {
  currentUser: User;
  activeConversationId?: string;
  onSelectConversation?: (id: string) => void;
  onStartCall: (participant: User, type: 'audio' | 'video') => void;
  onOpenUserProfile: (user: User) => void;
  initialTargetUser?: User | null;
  onOpenAuth?: () => void;
  onMobileChatActiveChange?: (isActive: boolean) => void;
  onNavigateTab?: (tab: 'feed' | 'reels' | 'messages' | 'explore' | 'profile') => void;
}

export const MessagesView: React.FC<MessagesViewProps> = ({
  currentUser,
  activeConversationId: externalActiveId,
  onSelectConversation: externalOnSelect,
  onStartCall,
  onOpenUserProfile,
  initialTargetUser,
  onMobileChatActiveChange,
  onNavigateTab,
}) => {
  // -------------------------------------------------------------
  // State: Conversations & Active Chat
  // -------------------------------------------------------------
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [targetParticipant, setTargetParticipant] = useState<User | null>(initialTargetUser || null);
  const [activeConvId, setActiveConvId] = useState<string>(() => {
    if (externalActiveId) return externalActiveId;
    if (initialTargetUser && currentUser?.id) {
      return getDeterministicConvId(currentUser.id, initialTargetUser.id);
    }
    return '';
  });
  const [messages, setMessages] = useState<Message[]>([]);

  // Navigation & Responsiveness
  const [mobileShowChat, setMobileShowChat] = useState<boolean>(Boolean(initialTargetUser || externalActiveId));

  useEffect(() => {
    onMobileChatActiveChange?.(mobileShowChat);
  }, [mobileShowChat, onMobileChatActiveChange]);
  const [showChatInfo, setShowChatInfo] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [convFilter, setConvFilter] = useState<'all' | 'unread' | 'online'>('all');

  // Staged File/Image Attachment & Drag-and-Drop
  const [stagedAttachment, setStagedAttachment] = useState<{
    file: File;
    name: string;
    size: string;
    type: string;
    dataUrl: string;
    isImage: boolean;
  } | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInChatQuery, setSearchInChatQuery] = useState('');
  const [isSearchingInChat, setIsSearchingInChat] = useState(false);

  // Input & Messaging
  const [inputText, setInputText] = useState('');
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  // Message Interaction States
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [activeReactionMessageId, setActiveReactionMessageId] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);

  // Modals
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [searchUserQuery, setSearchUserQuery] = useState('');
  const [confirmClearChat, setConfirmClearChat] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const messageInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageElementsRef = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // -------------------------------------------------------------
  // Effects: Sync external conversation ID
  // -------------------------------------------------------------
  useEffect(() => {
    if (externalActiveId && externalActiveId !== activeConvId) {
      setActiveConvId(externalActiveId);
      setMobileShowChat(true);
    }
  }, [externalActiveId]);

  // Handle direct message launch to a specific target user
  useEffect(() => {
    if (initialTargetUser && initialTargetUser.id !== currentUser.id) {
      setTargetParticipant(initialTargetUser);
      const convId = getDeterministicConvId(currentUser.id, initialTargetUser.id);
      setActiveConvId(convId);
      setMobileShowChat(true);
      getOrCreateConversation(currentUser, initialTargetUser)
        .then((createdId) => {
          setActiveConvId(createdId);
          setMobileShowChat(true);
        })
        .catch((e) => console.error('Direct chat open error:', e));
    }
  }, [initialTargetUser, currentUser.id]);

  // Real-time conversations subscription
  useEffect(() => {
    if (!currentUser?.id) {
      setConversations([]);
      return;
    }

    const unsubscribe = subscribeToUserConversations(
      currentUser.id,
      (convs) => {
        setConversations(convs);
        setActiveConvId((prev) => {
          if (prev && convs.some((c) => c.id === prev)) return prev;
          return convs[0]?.id || '';
        });
      },
      (err) => console.error('Convs subscription error:', err)
    );

    return () => unsubscribe();
  }, [currentUser?.id]);

  // Fetch community users for New Chat modal
  useEffect(() => {
    if (isNewChatModalOpen) {
      getAllUsers(currentUser.id).then((users) => {
        setAvailableUsers(users);
      });
    }
  }, [isNewChatModalOpen, currentUser.id]);

  // Real-time messages subscription
  useEffect(() => {
    if (!activeConvId) {
      setMessages([]);
      return;
    }

    markConversationAsRead(activeConvId, currentUser.id).catch(() => {});

    const unsubscribe = subscribeToMessages(
      activeConvId,
      (msgs) => {
        setMessages(msgs);
        const hasUnreadFromOther = msgs.some(
          (m) => m.senderId !== currentUser.id && m.status !== 'read'
        );
        if (hasUnreadFromOther) {
          markConversationAsRead(activeConvId, currentUser.id).catch(() => {});
        }

        // Trigger browser notification if page is backgrounded or user is viewing another tab
        const lastMsg = msgs[msgs.length - 1];
        if (
          lastMsg &&
          lastMsg.senderId !== currentUser.id &&
          typeof document !== 'undefined' &&
          document.hidden
        ) {
          sendBrowserNotification(activeConv?.participant.name || 'New Message', {
            body:
              lastMsg.text ||
              (lastMsg.type === 'image'
                ? 'Sent a photo'
                : lastMsg.type === 'file'
                ? `Sent file: ${lastMsg.file?.name}`
                : 'Sent a voice note'),
            icon: activeConv?.participant.avatar,
            tag: `msg_${lastMsg.id}`,
            onClick: () => {
              window.focus();
            },
          });
        }
      },
      (err) => console.error('Messages subscription error:', err)
    );

    return () => unsubscribe();
  }, [activeConvId, currentUser.id]);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom('smooth');
  }, [messages.length]);

  useEffect(() => {
    return () => {
      if (activeConvId && currentUser?.id) {
        setTypingIndicator(activeConvId, currentUser.id, false).catch(() => {});
      }
    };
  }, [activeConvId, currentUser?.id]);

  // -------------------------------------------------------------
  // Computed Data
  // -------------------------------------------------------------
  const activeConv: ChatConversation | undefined = useMemo(() => {
    const existing = conversations.find((c) => c.id === activeConvId);
    if (existing) return existing;
    if (targetParticipant && activeConvId) {
      return {
        id: activeConvId,
        participant: targetParticipant,
        lastMessage: {
          id: 'init',
          senderId: currentUser.id,
          timestamp: 'Just now',
          type: 'text',
          text: 'Conversation started',
          status: 'read',
        },
        unreadCount: 0,
        isOnline: true,
        isTyping: false,
        messages: [],
      };
    }
    return undefined;
  }, [conversations, activeConvId, targetParticipant, currentUser]);

  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      const matchesSearch =
        c.participant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.participant.username.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;
      if (convFilter === 'unread') return c.unreadCount > 0;
      if (convFilter === 'online') return c.isOnline;
      return true;
    });
  }, [conversations, searchTerm, convFilter]);

  const displayedMessages = useMemo(() => {
    if (!searchInChatQuery.trim()) return messages;
    const query = searchInChatQuery.toLowerCase();
    return messages.filter(
      (m) =>
        m.text?.toLowerCase().includes(query) ||
        m.file?.name?.toLowerCase().includes(query)
    );
  }, [messages, searchInChatQuery]);

  // Media gallery shared in this conversation
  const sharedMedia = useMemo(() => {
    return messages.filter((m) => m.type === 'image' && m.file?.url);
  }, [messages]);

  const sharedDocuments = useMemo(() => {
    return messages.filter((m) => m.type === 'file' && m.file?.url);
  }, [messages]);

  // -------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------
  const handleSelectConv = (convId: string) => {
    auraAudio.playClick(600, 0.03);
    const selected = conversations.find((c) => c.id === convId);
    if (selected) {
      setTargetParticipant(selected.participant);
    }
    setActiveConvId(convId);
    setReplyingTo(null);
    setIsSearchingInChat(false);
    setSearchInChatQuery('');
    if (externalOnSelect) externalOnSelect(convId);
    setMobileShowChat(true);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    if (!activeConvId || !currentUser?.id) return;

    setTypingIndicator(activeConvId, currentUser.id, true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setTypingIndicator(activeConvId, currentUser.id, false);
    }, 2200);
  };

  const handleInitiateReply = (msg: Message) => {
    auraAudio.playClick(720, 0.03);
    setReplyingTo(msg);
    setActiveReactionMessageId(null);
    messageInputRef.current?.focus();
  };

  const handleCancelReply = () => {
    auraAudio.playClick(440, 0.02);
    setReplyingTo(null);
  };

  const handleScrollToMessage = (targetMsgId: string) => {
    const el = messageElementsRef.current[targetMsgId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-[#5E7C6E]', 'transition-all');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-[#5E7C6E]');
      }, 1500);
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!activeConvId) return;
    auraAudio.playClick(800, 0.04);
    setActiveReactionMessageId(null);
    await addMessageReaction(activeConvId, messageId, emoji);
  };

  const handleCopyMessage = (msg: Message) => {
    if (!msg.text) return;
    navigator.clipboard.writeText(msg.text);
    auraAudio.playClick(900, 0.03);
    setCopiedMessageId(msg.id);
    setTimeout(() => setCopiedMessageId(null), 1800);
  };

  const handleDeleteMessage = async (msgId: string) => {
    if (!activeConvId) return;
    auraAudio.playClick(400, 0.04);
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
    await deleteChatMessage(activeConvId, msgId);
  };

  const handleClearHistory = async () => {
    if (!activeConvId) return;
    auraAudio.playClick(400, 0.04);
    setMessages([]);
    setConfirmClearChat(false);
    await clearConversationMessages(activeConvId);
  };

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeConvId || !activeConv || isSending) return;

    const textToSend = inputText.trim();
    setInputText('');
    setIsSending(true);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setTypingIndicator(activeConvId, currentUser.id, false);

    const replyPayload: MessageReplyInfo | undefined = replyingTo
      ? {
          id: replyingTo.id,
          senderId: replyingTo.senderId,
          senderName:
            replyingTo.senderId === currentUser.id
              ? 'You'
              : replyingTo.senderName || activeConv.participant.name,
          text:
            replyingTo.type === 'voice'
              ? '🎙️ Voice note'
              : replyingTo.type === 'image'
              ? '📷 Photo'
              : replyingTo.type === 'file'
              ? `📎 ${replyingTo.file?.name || 'File'}`
              : replyingTo.text,
          type: replyingTo.type,
        }
      : undefined;

    setReplyingTo(null);

    // If an image or file is staged, send it (with caption if provided)
    if (stagedAttachment) {
      const isImg = stagedAttachment.isImage;
      const fileToSend = stagedAttachment;
      const caption = inputText.trim();
      setStagedAttachment(null);
      setInputText('');
      setIsSending(true);

      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const tempMsgId = `msg_opt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const optimisticMsg: Message = {
        id: tempMsgId,
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderAvatar: currentUser.avatar,
        timestamp: nowTime,
        type: isImg ? 'image' : 'file',
        text: caption || fileToSend.name,
        file: {
          name: fileToSend.name,
          size: fileToSend.size,
          type: fileToSend.type,
          url: fileToSend.dataUrl,
        },
        status: 'sent',
        replyTo: replyPayload,
      };

      setMessages((prev) => [...prev, optimisticMsg]);
      setTimeout(() => scrollToBottom('smooth'), 40);

      try {
        auraAudio.playClick(640, 0.05);
        await sendChatMessage(
          activeConvId,
          {
            type: isImg ? 'image' : 'file',
            text: caption || fileToSend.name,
            file: {
              name: fileToSend.name,
              size: fileToSend.size,
              type: fileToSend.type,
              url: fileToSend.dataUrl,
            },
          },
          currentUser,
          activeConv.participant.id,
          replyPayload
        );
      } catch (err) {
        console.error('Error sending file/image message:', err);
      } finally {
        setIsSending(false);
      }
      return;
    }

    if (!textToSend) return;

    // Instant optimistic render
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const tempMsgId = `msg_opt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const optimisticMsg: Message = {
      id: tempMsgId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      timestamp: nowTime,
      type: 'text',
      text: textToSend,
      status: 'sent',
      replyTo: replyPayload,
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(() => scrollToBottom('smooth'), 40);

    try {
      auraAudio.playClick(640, 0.05);
      await sendChatMessage(
        activeConvId,
        {
          type: 'text',
          text: textToSend,
        },
        currentUser,
        activeConv.participant.id,
        replyPayload
      );
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const stageFile = (file: File) => {
    if (!file || !activeConvId || !activeConv) return;
    const sizeInMb = (file.size / (1024 * 1024)).toFixed(1);
    const sizeStr = `${sizeInMb} MB`;
    const isImage = file.type.startsWith('image/');

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) return;
      setStagedAttachment({
        file,
        name: file.name,
        size: sizeStr,
        type: file.type,
        dataUrl,
        isImage,
      });
      auraAudio.playClick(580, 0.04);
    };
    reader.readAsDataURL(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    stageFile(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    stageFile(file);
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      stageFile(file);
    }
  };

  const handleSendVoiceNote = async (voiceMeta: VoiceNoteMeta) => {
    if (!activeConvId || !activeConv) return;
    setIsRecordingVoice(false);
    const replyPayload: MessageReplyInfo | undefined = replyingTo
      ? {
          id: replyingTo.id,
          senderId: replyingTo.senderId,
          senderName:
            replyingTo.senderId === currentUser.id
              ? 'You'
              : replyingTo.senderName || activeConv.participant.name,
          text: replyingTo.text,
          type: replyingTo.type,
        }
      : undefined;

    setReplyingTo(null);

    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const tempMsgId = `msg_opt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const optimisticMsg: Message = {
      id: tempMsgId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      timestamp: nowTime,
      type: 'voice',
      voice: voiceMeta,
      status: 'sent',
      replyTo: replyPayload,
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(() => scrollToBottom('smooth'), 40);

    try {
      auraAudio.playClick(640, 0.05);
      await sendChatMessage(
        activeConvId,
        {
          type: 'voice',
          voice: voiceMeta,
        },
        currentUser,
        activeConv.participant.id,
        replyPayload
      );
    } catch (err) {
      console.error('Error sending voice note:', err);
    }
  };

  const handleStartChatWithUser = async (targetUser: User) => {
    setIsNewChatModalOpen(false);
    setTargetParticipant(targetUser);
    const convId = getDeterministicConvId(currentUser.id, targetUser.id);
    setActiveConvId(convId);
    setMobileShowChat(true);
    if (externalOnSelect) externalOnSelect(convId);
    try {
      await getOrCreateConversation(currentUser, targetUser);
    } catch (err) {
      console.error('Start chat error:', err);
    }
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden min-h-0">
      <div className="w-full h-full bg-[#FAFAF9] overflow-hidden grid grid-cols-1 md:grid-cols-12 flex-1 min-h-0">
        
        {/* ========================================================
            COLUMN 1: Conversations List Sidebar
            Visible on Desktop/Tablet, collapsible on Tablet/PC
            ======================================================== */}
        <div
          className={`h-full border-r border-[#E6EDE9] flex flex-col transition-all duration-200 bg-[#FAFAF9] overflow-hidden min-h-0 ${
            mobileShowChat ? 'hidden md:flex' : 'flex'
          } ${
            isSidebarCollapsed ? 'hidden' : 'md:col-span-5 lg:col-span-4 xl:col-span-4'
          }`}
        >
          {/* Sidebar Header & Filters */}
          <div className="p-3 sm:p-4 border-b border-[#E6EDE9] space-y-2.5 bg-white/80 backdrop-blur-md shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {onNavigateTab && (
                  <button
                    type="button"
                    onClick={() => {
                      auraAudio.playClick(480, 0.03);
                      onNavigateTab('feed');
                    }}
                    className="md:hidden p-1.5 -ml-1 rounded-xl text-[#4A6757] hover:bg-[#EBF1ED] transition-colors cursor-pointer"
                    title="Back to Feed"
                  >
                    <ArrowLeft size={18} className="stroke-[2.5]" />
                  </button>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-[#1E2A23] tracking-tight">
                      Messages
                    </h2>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                  <span className="text-[11px] text-[#6A7B73] font-medium">Real-time sync</span>
                </div>
              </div>
              <button
                onClick={() => {
                  auraAudio.playClick(600, 0.04);
                  setIsNewChatModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#2F4438] to-[#4A6757] text-white hover:brightness-110 text-xs font-semibold transition-all shadow-sm active:scale-95 cursor-pointer ring-1 ring-white/20"
                title="Start new direct conversation"
              >
                <Plus size={14} className="stroke-[2.5]" />
                <span>New Chat</span>
              </button>
            </div>

            {/* Search conversations */}
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7A8A82]"
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search conversations..."
                className="w-full bg-[#F1F5F2] hover:bg-[#EAEFEA] rounded-2xl pl-9 pr-8 py-2 text-xs text-[#2D3732] placeholder-[#7A8A82] focus:outline-none focus:bg-white border border-transparent focus:border-[#4A6757] transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7A8A82] hover:text-[#2D3732]"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Filter Pills: All / Unread / Online */}
            <div className="flex items-center gap-1.5 pt-0.5">
              <button
                onClick={() => setConvFilter('all')}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  convFilter === 'all'
                    ? 'bg-[#2F4438] text-white shadow-xs'
                    : 'bg-[#EBF1ED] text-[#4A6757] hover:bg-[#DEE7E1]'
                }`}
              >
                All ({conversations.length})
              </button>
              <button
                onClick={() => setConvFilter('unread')}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  convFilter === 'unread'
                    ? 'bg-[#2F4438] text-white shadow-xs'
                    : 'bg-[#EBF1ED] text-[#4A6757] hover:bg-[#DEE7E1]'
                }`}
              >
                Unread
              </button>
              <button
                onClick={() => setConvFilter('online')}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  convFilter === 'online'
                    ? 'bg-[#2F4438] text-white shadow-xs'
                    : 'bg-[#EBF1ED] text-[#4A6757] hover:bg-[#DEE7E1]'
                }`}
              >
                Online
              </button>
            </div>
          </div>

          {/* Conversation List Items */}
          <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-[#EAEFEA] overscroll-contain touch-pan-y scroll-smooth pb-20 md:pb-4">
            {filteredConversations.length === 0 ? (
              <div className="p-4 space-y-4">
                <div className="text-center py-4 space-y-2">
                  <p className="text-xs font-semibold text-[#1E2A23]">Start a Conversation</p>
                  <p className="text-[11px] text-[#7A8A82]">Select a creator below to begin real-time messaging:</p>
                </div>
                <div className="space-y-1">
                  {availableUsers.slice(0, 6).map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleStartChatWithUser(user)}
                      className="w-full p-2.5 flex items-center gap-3 rounded-2xl hover:bg-[#EBF1ED] text-left transition-all cursor-pointer border border-transparent hover:border-[#8FA89B]/30"
                    >
                      <ModernAvatar
                        src={user.avatar}
                        alt={user.name}
                        size="md"
                        status="online"
                        className="shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-[#1E2A23] truncate">{user.name}</span>
                          {user.verified && <CheckCircle2 size={12} className="text-emerald-700" />}
                        </div>
                        <p className="text-[11px] text-[#7A8A82] truncate">@{user.username}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isActive = conv.id === activeConv?.id;
                return (
                  <button
                    key={conv.id}
                    onClick={() => handleSelectConv(conv.id)}
                    className={`w-full p-3 sm:p-3.5 md:p-4 flex items-center gap-2.5 sm:gap-3 text-left transition-colors cursor-pointer border-l-3 ${
                      isActive
                        ? 'bg-[#EBF1ED] border-[#4A6757]'
                        : 'border-transparent hover:bg-[#F4F7F5]'
                    }`}
                  >
                    <ModernAvatar
                      src={conv.participant.avatar}
                      alt={conv.participant.name}
                      size="md"
                      status={conv.isOnline ? 'online' : undefined}
                      className="shrink-0"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs sm:text-sm font-bold text-[#1E2A23] truncate">
                          {conv.participant.name}
                        </span>
                        <span className="text-[10px] text-[#7A8A82] shrink-0 tabular-nums">
                          {conv.lastMessage?.timestamp || ''}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <p className="text-xs text-[#62736B] truncate max-w-[180px]">
                          {conv.isTyping ? (
                            <span className="text-emerald-700 font-semibold animate-pulse flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block animate-ping" />
                              typing...
                            </span>
                          ) : conv.lastMessage?.type === 'voice' ? (
                            '🎙️ Voice Note'
                          ) : conv.lastMessage?.type === 'file' ? (
                            `📎 ${conv.lastMessage.file?.name || 'File attachment'}`
                          ) : conv.lastMessage?.type === 'image' ? (
                            '📷 Photo'
                          ) : (
                            conv.lastMessage?.text || 'No messages yet'
                          )}
                        </p>

                        {conv.unreadCount > 0 && (
                          <span className="min-w-5 h-5 px-1.5 rounded-full bg-[#4A6757] text-white text-[10px] font-bold flex items-center justify-center shrink-0 shadow-xs">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ========================================================
            COLUMN 2: Main Active Chat Window
            Responsive Tablet / PC layout with drag & drop upload
            ======================================================== */}
        {activeConv ? (
          <div
            className={`h-full flex flex-col bg-[#FAFAF9] relative overflow-hidden min-h-0 transition-all duration-200 ${
              isSidebarCollapsed
                ? showChatInfo
                  ? 'md:col-span-12 lg:col-span-9 xl:col-span-9'
                  : 'md:col-span-12 lg:col-span-12 xl:col-span-12'
                : showChatInfo
                ? 'md:col-span-7 lg:col-span-5 xl:col-span-5'
                : 'md:col-span-7 lg:col-span-8 xl:col-span-8'
            } ${mobileShowChat ? 'flex' : 'hidden md:flex'}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {/* Drag & Drop Visual Backdrop */}
            {isDraggingOver && (
              <div className="absolute inset-0 z-40 bg-[#1E2A23]/85 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-white border-2 border-dashed border-emerald-400 m-3 rounded-3xl animate-fadeIn pointer-events-none">
                <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mb-3">
                  <Paperclip size={32} className="animate-bounce text-emerald-300" />
                </div>
                <h3 className="text-base font-bold">Drop files here to share</h3>
                <p className="text-xs text-white/80 mt-1">Photos, audio, or documents up to 25 MB</p>
              </div>
            )}

            {/* Top Chat Bar Header */}
            <div className="h-14 sm:h-16 px-3 sm:px-5 border-b border-[#E6EDE9] flex items-center justify-between shrink-0 bg-white/90 backdrop-blur-md z-20 shadow-2xs">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                {/* Back button on mobile */}
                <button
                  onClick={() => {
                    auraAudio.playClick(480, 0.03);
                    setMobileShowChat(false);
                  }}
                  className="md:hidden p-2 -ml-1 text-[#4A6757] hover:bg-[#F1F5F2] rounded-xl transition-colors cursor-pointer shrink-0"
                  title="Back to conversations"
                >
                  <ArrowLeft size={20} className="stroke-[2.5]" />
                </button>

                {/* Sidebar toggle button on tablet and desktop */}
                <button
                  type="button"
                  onClick={() => {
                    auraAudio.playClick(500, 0.02);
                    setIsSidebarCollapsed(!isSidebarCollapsed);
                  }}
                  className="hidden md:flex p-2 text-[#4A6757] hover:bg-[#F1F5F2] rounded-xl transition-colors cursor-pointer shrink-0"
                  title={isSidebarCollapsed ? 'Show conversations sidebar' : 'Expand chat window'}
                >
                  <PanelLeft size={18} />
                </button>

                {/* Participant Identity */}
                <div
                  onClick={() => onOpenUserProfile(activeConv.participant)}
                  className="flex items-center gap-2.5 sm:gap-3 cursor-pointer group min-w-0"
                >
                  <ModernAvatar
                    src={activeConv.participant.avatar}
                    alt={activeConv.participant.name}
                    size="md"
                    status={activeConv.isOnline ? 'online' : undefined}
                    ring
                    className="shrink-0 group-hover:ring-[#4A6757] transition-all"
                  />

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs sm:text-sm font-bold text-[#1E2A23] group-hover:text-[#4A6757] transition-colors truncate">
                        {activeConv.participant.name}
                      </span>
                      {activeConv.participant.verified && (
                        <CheckCircle2 size={14} className="text-emerald-700 shrink-0" />
                      )}
                    </div>
                    <span className="text-[11px] block font-medium truncate">
                      {activeConv.isTyping ? (
                        <span className="text-emerald-700 font-semibold animate-pulse flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block animate-ping" />
                          typing...
                        </span>
                      ) : activeConv.isOnline ? (
                        <span className="text-emerald-700 font-medium">Active now</span>
                      ) : (
                        <span className="text-[#8FA89B]">Offline</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Chat Actions: Call, Search in Chat, Toggle Info */}
              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                {/* Search In Chat Toggle */}
                <button
                  onClick={() => {
                    auraAudio.playClick(500, 0.03);
                    setIsSearchingInChat(!isSearchingInChat);
                  }}
                  className={`p-2 sm:p-2.5 rounded-2xl transition-colors cursor-pointer ${
                    isSearchingInChat
                      ? 'bg-[#4A6757] text-white'
                      : 'text-[#6A7B73] hover:text-[#1E2A23] hover:bg-[#F1F5F2]'
                  }`}
                  title="Search inside this chat"
                >
                  <Search size={17} />
                </button>

                {/* Audio Call */}
                <button
                  onClick={() => {
                    auraAudio.playClick(600, 0.04);
                    onStartCall(activeConv.participant, 'audio');
                  }}
                  className="p-2 sm:p-2.5 rounded-2xl text-[#4A6757] hover:bg-[#E6EDE9] transition-colors cursor-pointer"
                  title="Start Audio Call"
                >
                  <Phone size={17} className="stroke-[2.2]" />
                </button>

                {/* Video Call */}
                <button
                  onClick={() => {
                    auraAudio.playClick(600, 0.04);
                    onStartCall(activeConv.participant, 'video');
                  }}
                  className="p-2 sm:p-2.5 rounded-2xl text-[#4A6757] hover:bg-[#E6EDE9] transition-colors cursor-pointer"
                  title="Start Video Call"
                >
                  <Video size={17} className="stroke-[2.2]" />
                </button>

                {/* Info Panel Toggle */}
                <button
                  onClick={() => {
                    auraAudio.playClick(500, 0.03);
                    setShowChatInfo(!showChatInfo);
                  }}
                  className={`p-2 sm:p-2.5 rounded-2xl transition-colors cursor-pointer ${
                    showChatInfo
                      ? 'bg-[#E6EDE9] text-[#2F4438]'
                      : 'text-[#6A7B73] hover:text-[#1E2A23] hover:bg-[#F1F5F2]'
                  }`}
                  title="Chat Details & Shared Media"
                >
                  <Info size={17} />
                </button>
              </div>
            </div>

            {/* In-Chat Search Bar Drawer */}
            {isSearchingInChat && (
              <div className="px-4 py-2 bg-[#F1F5F2] border-b border-[#E6EDE9] flex items-center gap-2 animate-in slide-in-from-top duration-150 shrink-0">
                <Search size={14} className="text-[#7A8A82]" />
                <input
                  type="text"
                  value={searchInChatQuery}
                  onChange={(e) => setSearchInChatQuery(e.target.value)}
                  placeholder="Find in conversation..."
                  className="flex-1 bg-transparent text-xs text-[#1E2A23] placeholder-[#7A8A82] focus:outline-none"
                  autoFocus
                />
                {searchInChatQuery && (
                  <span className="text-[10px] text-[#7A8A82]">
                    {displayedMessages.length} found
                  </span>
                )}
                <button
                  onClick={() => {
                    setIsSearchingInChat(false);
                    setSearchInChatQuery('');
                  }}
                  className="text-[#7A8A82] hover:text-[#1E2A23] p-1 cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Chat Messages Feed */}
            <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 md:p-5 space-y-3 sm:space-y-3.5 bg-[#FAFAF9] overscroll-contain touch-pan-y scroll-smooth">
              {displayedMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2.5">
                  <div className="w-14 h-14 rounded-3xl bg-[#E6EDE9] flex items-center justify-center text-[#4A6757] shadow-xs">
                    <Smile size={26} />
                  </div>
                  <h3 className="text-sm font-bold text-[#1E2A23]">
                    {searchInChatQuery
                      ? 'No matching messages found'
                      : `Conversation with ${activeConv.participant.name}`}
                  </h3>
                  <p className="text-xs text-[#7A8A82] max-w-xs leading-relaxed">
                    {searchInChatQuery
                      ? 'Try searching with different keywords.'
                      : 'Send a message, voice note, photo, or document. Messages sync live across all devices.'}
                  </p>
                </div>
              ) : (
                displayedMessages.map((msg) => {
                  const isSelf = msg.senderId === currentUser.id;
                  const isHovered = hoveredMessageId === msg.id;

                  return (
                    <div
                      key={msg.id}
                      ref={(el) => {
                        messageElementsRef.current[msg.id] = el;
                      }}
                      onMouseEnter={() => setHoveredMessageId(msg.id)}
                      onMouseLeave={() => setHoveredMessageId(null)}
                      className={`group relative flex flex-col ${
                        isSelf ? 'items-end' : 'items-start'
                      }`}
                    >
                      {/* Message Bubble + Action Buttons Container */}
                      <div className="flex items-center gap-1.5 max-w-[90%] sm:max-w-[76%]">
                        {/* If self message, action icons appear on the left */}
                        {isSelf && (
                          <div
                            className={`flex items-center gap-0.5 transition-opacity ${
                              isHovered || activeReactionMessageId === msg.id
                                ? 'opacity-100'
                                : 'opacity-0 md:group-hover:opacity-100'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => handleInitiateReply(msg)}
                              className="p-1.5 rounded-lg text-[#7A8A82] hover:text-[#2D3732] hover:bg-[#E6EDE9] transition-colors cursor-pointer"
                              title="Reply"
                            >
                              <Reply size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setActiveReactionMessageId(
                                  activeReactionMessageId === msg.id ? null : msg.id
                                )
                              }
                              className="p-1.5 rounded-lg text-[#7A8A82] hover:text-[#2D3732] hover:bg-[#E6EDE9] transition-colors cursor-pointer"
                              title="React"
                            >
                              <Smile size={13} />
                            </button>
                            {msg.text && (
                              <button
                                type="button"
                                onClick={() => handleCopyMessage(msg)}
                                className="p-1.5 rounded-lg text-[#7A8A82] hover:text-[#2D3732] hover:bg-[#E6EDE9] transition-colors cursor-pointer"
                                title="Copy text"
                              >
                                {copiedMessageId === msg.id ? (
                                  <Check size={13} className="text-emerald-700" />
                                ) : (
                                  <Copy size={13} />
                                )}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteMessage(msg.id)}
                              className="p-1.5 rounded-lg text-[#7A8A82] hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                              title="Delete message"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}

                        {/* Reaction Picker Popover */}
                        {activeReactionMessageId === msg.id && (
                          <div
                            className={`absolute -top-9 z-20 bg-white border border-[#2D3732]/10 rounded-full px-2.5 py-1 shadow-lg flex items-center gap-1.5 animate-in fade-in zoom-in-95 ${
                              isSelf ? 'right-2' : 'left-2'
                            }`}
                          >
                            {['❤️', '👍', '🔥', '😂', '👏', '😮'].map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => handleReaction(msg.id, emoji)}
                                className="hover:scale-125 transition-transform text-sm p-0.5 cursor-pointer"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Bubble Content Body */}
                        <div
                          className={`relative space-y-1 shadow-xs transition-all ${
                            isSelf
                              ? 'bg-gradient-to-r from-[#2F4438] via-[#3B5446] to-[#4A6757] text-white rounded-3xl rounded-tr-xs p-3 sm:p-3.5'
                              : 'bg-white text-[#1E2A23] border border-[#E2EAE4] rounded-3xl rounded-tl-xs p-3 sm:p-3.5'
                          }`}
                        >
                          {/* Replied Quote Card */}
                          {msg.replyTo && (
                            <div
                              onClick={() => handleScrollToMessage(msg.replyTo!.id)}
                              className={`p-2 rounded-xl mb-1.5 text-[11px] cursor-pointer border-l-3 transition-colors ${
                                isSelf
                                  ? 'bg-white/10 border-white/70 text-white/90 hover:bg-white/15'
                                  : 'bg-[#F1F5F2] border-[#4A6757] text-[#334239] hover:bg-[#E6EDE9]'
                              }`}
                            >
                              <div className="flex items-center gap-1 font-semibold text-[10px] mb-0.5 opacity-90">
                                <Reply size={11} className="stroke-[2.5]" />
                                <span>{msg.replyTo.senderName || 'Replied Message'}</span>
                              </div>
                              <p className="line-clamp-2 italic text-[11px] leading-tight">
                                {msg.replyTo.text || 'Original message'}
                              </p>
                            </div>
                          )}

                          {/* Text Message with Link Previews */}
                          {msg.type === 'text' && (
                            <div>
                              <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words select-text">
                                {msg.text}
                              </p>
                              {extractUrls(msg.text || '').map((url, idx) => (
                                <LinkPreviewCard key={idx} url={url} isSelf={isSelf} />
                              ))}
                            </div>
                          )}

                          {/* Image Message */}
                          {msg.type === 'image' && msg.file && (
                            <div className="rounded-2xl overflow-hidden shadow-xs border border-white/20 group/img relative">
                              <img
                                src={msg.file.url}
                                alt={msg.file.name}
                                onClick={() => setLightboxImageUrl(msg.file!.url)}
                                className="w-full max-h-72 object-cover rounded-2xl cursor-pointer hover:opacity-95 transition-opacity"
                              />
                              {msg.text && msg.text !== msg.file.name && (
                                <p className="p-2 text-xs opacity-90">{msg.text}</p>
                              )}
                            </div>
                          )}

                          {/* File Attachment Message */}
                          {msg.type === 'file' && msg.file && (
                            <FileAttachmentCard file={msg.file} isSelf={isSelf} />
                          )}

                          {/* Voice Note Message */}
                          {msg.type === 'voice' && msg.voice && (
                            <VoiceNotePlayer voiceMeta={msg.voice} isSelf={isSelf} />
                          )}

                          {/* Message Reactions Badge */}
                          {msg.reaction && (
                            <div
                              className={`absolute -bottom-2.5 ${
                                isSelf ? 'left-2' : 'right-2'
                              } px-1.5 py-0.5 rounded-full bg-white border border-[#2D3732]/10 text-xs shadow-xs`}
                            >
                              {msg.reaction}
                            </div>
                          )}

                          {/* Timestamp and Real-Time Delivery Receipt */}
                          <div
                            className={`flex items-center gap-1.5 text-[10px] pt-0.5 ${
                              isSelf ? 'justify-end text-white/80' : 'justify-start text-[#7A8A82]'
                            }`}
                          >
                            <span className="tabular-nums font-mono">{msg.timestamp}</span>

                            {isSelf && (
                              <span className="flex items-center gap-1">
                                {msg.status === 'read' ? (
                                  <span className="flex items-center gap-0.5 text-emerald-300 font-semibold" title="Seen by recipient">
                                    <CheckCheck size={14} className="stroke-[2.5]" />
                                    <span className="text-[9px] uppercase tracking-wider">Seen</span>
                                  </span>
                                ) : msg.status === 'delivered' ? (
                                  <span title="Delivered to device">
                                    <CheckCheck size={14} className="opacity-70" />
                                  </span>
                                ) : (
                                  <span title="Sent">
                                    <Check size={13} className="opacity-70" />
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* If received message, action icons appear on the right */}
                        {!isSelf && (
                          <div
                            className={`flex items-center gap-0.5 transition-opacity ${
                              isHovered || activeReactionMessageId === msg.id
                                ? 'opacity-100'
                                : 'opacity-0 md:group-hover:opacity-100'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => handleInitiateReply(msg)}
                              className="p-1.5 rounded-lg text-[#7A8A82] hover:text-[#2D3732] hover:bg-[#E6EDE9] transition-colors cursor-pointer"
                              title="Reply"
                            >
                              <Reply size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setActiveReactionMessageId(
                                  activeReactionMessageId === msg.id ? null : msg.id
                                )
                              }
                              className="p-1.5 rounded-lg text-[#7A8A82] hover:text-[#2D3732] hover:bg-[#E6EDE9] transition-colors cursor-pointer"
                              title="React"
                            >
                              <Smile size={13} />
                            </button>
                            {msg.text && (
                              <button
                                type="button"
                                onClick={() => handleCopyMessage(msg)}
                                className="p-1.5 rounded-lg text-[#7A8A82] hover:text-[#2D3732] hover:bg-[#E6EDE9] transition-colors cursor-pointer"
                                title="Copy text"
                              >
                                {copiedMessageId === msg.id ? (
                                  <Check size={13} className="text-emerald-700" />
                                ) : (
                                  <Copy size={13} />
                                )}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}

              {/* Real-time typing bubble inside message stream */}
              {activeConv.isTyping && (
                <div className="flex items-center gap-2 text-xs text-[#7A8A82] animate-in fade-in duration-200">
                  <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-[#2D3732]/10">
                    <img
                      src={activeConv.participant.avatar}
                      alt={activeConv.participant.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="px-3.5 py-2.5 bg-white border border-[#E2EAE4] rounded-2xl rounded-tl-xs flex items-center gap-1.5 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#4A6757] animate-bounce" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#4A6757] animate-bounce [animation-delay:0.2s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#4A6757] animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* ========================================================
                Chat Input Bar & Replying Banner
                ======================================================== */}
            <div className="border-t border-[#E6EDE9] bg-white/95 backdrop-blur-md shrink-0 sticky bottom-0 z-30 pb-safe shadow-lg">
              <div className="p-2 sm:p-3 md:p-3.5 w-full bg-white/90 backdrop-blur-sm">
                {/* Replying To Banner */}
                {replyingTo && (
                  <div className="mb-2 px-3 py-1.5 bg-[#EBF1ED] border border-[#D8E4DC] rounded-xl flex items-center justify-between text-xs animate-in slide-in-from-bottom-2 duration-150">
                    <div className="flex items-center gap-2 min-w-0">
                      <Reply size={14} className="text-[#4A6757] shrink-0 stroke-[2.5]" />
                      <div className="truncate">
                        <span className="font-semibold text-[#1E2A23]">
                          Replying to{' '}
                          {replyingTo.senderId === currentUser.id
                            ? 'yourself'
                            : replyingTo.senderName || activeConv.participant.name}
                          :
                        </span>{' '}
                        <span className="text-[#62736B] italic">
                          {replyingTo.text || (replyingTo.type === 'voice' ? 'Voice note' : 'Attachment')}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleCancelReply}
                      className="p-1 rounded-full text-[#62736B] hover:text-[#1E2A23] hover:bg-black/5 cursor-pointer shrink-0"
                      title="Cancel reply"
                    >
                      <X size={15} />
                    </button>
                  </div>
                )}

                {/* Staged Attachment Preview Card */}
                {stagedAttachment && (
                  <div className="mb-2 p-2.5 bg-[#EBF1ED] border border-[#C6D8CE] rounded-2xl flex items-center justify-between gap-3 shadow-xs animate-in slide-in-from-bottom-2 duration-150">
                    <div className="flex items-center gap-3 min-w-0">
                      {stagedAttachment.isImage ? (
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-black/10 shrink-0 border border-white/60">
                          <img
                            src={stagedAttachment.dataUrl}
                            alt={stagedAttachment.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-11 h-11 rounded-xl bg-[#2F4438] text-white flex items-center justify-center shrink-0">
                          <FileText size={20} />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-[#1E2A23] truncate">
                            {stagedAttachment.name}
                          </span>
                          <span className="px-1.5 py-0.5 rounded-md bg-white/70 text-[10px] font-mono text-[#4A6757] font-semibold uppercase shrink-0">
                            {stagedAttachment.size}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#62736B] truncate">
                          {stagedAttachment.isImage
                            ? 'Photo ready · Press send or add a caption'
                            : 'Document ready · Press send or add a caption'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        auraAudio.playClick(400, 0.03);
                        setStagedAttachment(null);
                      }}
                      className="p-1.5 rounded-xl text-[#62736B] hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer shrink-0"
                      title="Discard attachment"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}

                {isRecordingVoice ? (
                  <VoiceRecorderBar
                    onCancel={() => setIsRecordingVoice(false)}
                    onSendVoiceNote={handleSendVoiceNote}
                  />
                ) : (
                  <form
                    onSubmit={handleSendText}
                    className="flex items-center gap-1.5 sm:gap-2 bg-[#F1F5F2] focus-within:bg-white rounded-2xl p-1.5 pl-2 sm:pl-2.5 border border-[#DDE6E1] focus-within:border-[#4A6757] transition-all shadow-xs"
                  >
                    {/* Hidden Image Input */}
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />

                    {/* Hidden Document / File Upload Input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.zip,.rar,.tar.gz,.txt,.ts,.tsx,.json,.xlsx,.csv"
                      onChange={handleFileUpload}
                      className="hidden"
                    />

                    {/* Image Attachment Button */}
                    <button
                      type="button"
                      onClick={() => {
                        auraAudio.playClick(500, 0.03);
                        imageInputRef.current?.click();
                      }}
                      className="p-1.5 text-[#55635C] hover:text-[#1E2A23] hover:bg-white rounded-xl transition-colors shrink-0 cursor-pointer"
                      title="Send photo / image"
                    >
                      <ImageIcon size={18} />
                    </button>

                    {/* Document Attachment Button */}
                    <button
                      type="button"
                      onClick={() => {
                        auraAudio.playClick(500, 0.03);
                        fileInputRef.current?.click();
                      }}
                      className="p-1.5 text-[#55635C] hover:text-[#1E2A23] hover:bg-white rounded-xl transition-colors shrink-0 cursor-pointer"
                      title="Attach document / file"
                    >
                      <Paperclip size={18} />
                    </button>

                    {/* Text Input */}
                    <input
                      ref={messageInputRef}
                      type="text"
                      value={inputText}
                      onChange={handleTextChange}
                      placeholder={
                        stagedAttachment
                          ? `Add caption for ${stagedAttachment.isImage ? 'photo' : 'file'}...`
                          : `Message ${activeConv.participant.name}...`
                      }
                      className="flex-1 bg-transparent text-xs sm:text-sm text-[#1E2A23] placeholder-[#7A8A82] focus:outline-none px-1"
                    />

                    {/* Voice Note / Send Button */}
                    {inputText.trim().length > 0 || stagedAttachment !== null ? (
                      <button
                        type="submit"
                        disabled={isSending}
                        className="p-2 sm:px-3 sm:py-2 rounded-xl bg-gradient-to-r from-[#2F4438] via-[#4A6757] to-[#719181] text-white hover:brightness-110 transition-all active:scale-95 shrink-0 shadow-soft cursor-pointer flex items-center gap-1.5 ring-1 ring-white/20"
                        title="Send message"
                      >
                        <Send size={15} className="stroke-[2.5]" />
                        <span className="hidden sm:inline text-xs font-semibold">
                          {stagedAttachment ? (stagedAttachment.isImage ? 'Send Photo' : 'Send File') : 'Send'}
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          auraAudio.playClick(600, 0.04);
                          setIsRecordingVoice(true);
                        }}
                        className="p-2 text-[#4A6757] hover:text-[#1E2A23] hover:bg-white rounded-xl transition-colors shrink-0 cursor-pointer"
                        title="Record voice note"
                      >
                        <Mic size={18} className="stroke-[2]" />
                      </button>
                    )}
                  </form>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="hidden md:flex md:col-span-7 lg:col-span-8 xl:col-span-8 h-full flex-col items-center justify-center p-6 text-center bg-[#FAFAF9]">
            <div className="w-16 h-16 rounded-3xl bg-[#E6EDE9] flex items-center justify-center text-[#4A6757] mb-4 shadow-xs">
              <Smile size={32} />
            </div>
            <h3 className="text-base font-bold text-[#1E2A23] mb-1">
              Select or Start a Conversation
            </h3>
            <p className="text-xs text-[#7A8A82] max-w-sm mb-4 leading-relaxed">
              Direct messages sync live in real-time with full support for replies, voice notes, photos, and file transfers.
            </p>
            <button
              onClick={() => {
                auraAudio.playClick(600, 0.04);
                setIsNewChatModalOpen(true);
              }}
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#2F4438] to-[#4A6757] text-white text-xs font-semibold hover:brightness-110 transition-all shadow-soft cursor-pointer ring-1 ring-white/20"
            >
              Start New Chat
            </button>
          </div>
        )}

        {/* ========================================================
            COLUMN 3: Participant Info & Shared Media Drawer
            Slide-over drawer on Mobile/Tablet, docked on Desktop
            ======================================================== */}
        {showChatInfo && activeConv && (
          <>
            {/* Tablet & Mobile Slide-over Backdrop */}
            <div
              className="lg:hidden fixed inset-0 z-40 bg-[#1E2A23]/40 backdrop-blur-2xs transition-opacity animate-in fade-in duration-200"
              onClick={() => setShowChatInfo(false)}
            />
            <div className="fixed inset-y-0 right-0 z-50 w-80 max-w-[85vw] shadow-2xl lg:shadow-none lg:static lg:z-auto lg:flex lg:col-span-3 xl:col-span-3 h-full border-l border-[#E6EDE9] bg-white flex flex-col overflow-y-auto overscroll-contain animate-in slide-in-from-right duration-200">
              {/* Header */}
              <div className="p-4 border-b border-[#E6EDE9] flex items-center justify-between">
                <h3 className="text-xs font-bold text-[#1E2A23] uppercase tracking-wider">Chat Details</h3>
                <button
                  onClick={() => setShowChatInfo(false)}
                  className="p-1.5 rounded-xl text-[#7A8A82] hover:text-[#1E2A23] hover:bg-[#F1F5F2] cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

            {/* Profile Overview */}
            <div className="p-5 flex flex-col items-center text-center border-b border-[#E6EDE9]">
              <div className="mb-3">
                <ModernAvatar
                  src={activeConv.participant.avatar}
                  alt={activeConv.participant.name}
                  size="xl"
                  status={activeConv.isOnline ? 'online' : undefined}
                  ring
                />
              </div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <h4 className="text-sm font-bold text-[#1E2A23]">{activeConv.participant.name}</h4>
                {activeConv.participant.verified && (
                  <CheckCircle2 size={14} className="text-emerald-700" />
                )}
              </div>
              <p className="text-xs text-[#7A8A82] mb-3">@{activeConv.participant.username}</p>

              {activeConv.participant.bio && (
                <p className="text-xs text-[#4E5F56] max-w-xs leading-relaxed mb-4">
                  {activeConv.participant.bio}
                </p>
              )}

              {/* Quick Action Buttons */}
              <div className="flex items-center gap-2 w-full pt-1">
                <button
                  onClick={() => {
                    auraAudio.playClick(600, 0.04);
                    onStartCall(activeConv.participant, 'audio');
                  }}
                  className="flex-1 py-2 rounded-xl bg-[#F1F5F2] hover:bg-[#E6EDE9] text-[#2F4438] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Phone size={14} />
                  <span>Call</span>
                </button>
                <button
                  onClick={() => {
                    auraAudio.playClick(600, 0.04);
                    onStartCall(activeConv.participant, 'video');
                  }}
                  className="flex-1 py-2 rounded-xl bg-[#F1F5F2] hover:bg-[#E6EDE9] text-[#2F4438] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Video size={14} />
                  <span>Video</span>
                </button>
                <button
                  onClick={() => onOpenUserProfile(activeConv.participant)}
                  className="p-2 rounded-xl bg-[#F1F5F2] hover:bg-[#E6EDE9] text-[#2F4438] transition-colors cursor-pointer"
                  title="View full profile"
                >
                  <ExternalLink size={15} />
                </button>
              </div>
            </div>

            {/* Shared Media Gallery */}
            <div className="p-4 border-b border-[#E6EDE9] flex-1">
              <div className="flex items-center justify-between mb-3">
                <h5 className="text-xs font-bold text-[#1E2A23] flex items-center gap-1.5">
                  <ImageIcon size={14} className="text-[#4A6757]" />
                  <span>Shared Photos ({sharedMedia.length})</span>
                </h5>
              </div>

              {sharedMedia.length === 0 ? (
                <p className="text-xs text-[#7A8A82] py-4 text-center">No photos shared yet</p>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {sharedMedia.slice(0, 9).map((m) => (
                    <img
                      key={m.id}
                      src={m.file!.url}
                      alt={m.file!.name}
                      onClick={() => setLightboxImageUrl(m.file!.url)}
                      className="w-full aspect-square object-cover rounded-xl cursor-pointer hover:opacity-80 transition-opacity border border-black/5"
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Shared Documents */}
            {sharedDocuments.length > 0 && (
              <div className="p-4 border-b border-[#E6EDE9]">
                <h5 className="text-xs font-bold text-[#1E2A23] mb-2 flex items-center gap-1.5">
                  <FileText size={14} className="text-[#4A6757]" />
                  <span>Shared Files ({sharedDocuments.length})</span>
                </h5>
                <div className="space-y-1.5">
                  {sharedDocuments.slice(0, 4).map((d) => (
                    <a
                      key={d.id}
                      href={d.file!.url}
                      download={d.file!.name}
                      className="flex items-center gap-2 p-2 rounded-xl bg-[#F8FAF9] hover:bg-[#EBF1ED] text-xs text-[#2D3732] truncate transition-colors"
                    >
                      <FileText size={13} className="text-[#4A6757] shrink-0" />
                      <span className="truncate flex-1">{d.file!.name}</span>
                      <Download size={12} className="text-[#7A8A82] shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Conversation Settings */}
            <div className="p-4 space-y-2 mt-auto">
              {confirmClearChat ? (
                <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-center space-y-2">
                  <p className="text-xs font-semibold text-red-800">Clear chat history?</p>
                  <p className="text-[11px] text-red-600">All messages will be removed permanently.</p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={handleClearHistory}
                      className="flex-1 py-1.5 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 cursor-pointer"
                    >
                      Yes, Clear
                    </button>
                    <button
                      onClick={() => setConfirmClearChat(false)}
                      className="flex-1 py-1.5 rounded-xl bg-white text-gray-700 text-xs font-semibold hover:bg-gray-50 border border-gray-200 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmClearChat(true)}
                  className="w-full py-2.5 px-3 rounded-2xl text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Trash2 size={14} />
                  <span>Clear Conversation History</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}
      </div>

      {/* ========================================================
          Image Lightbox Modal
          ======================================================== */}
      {lightboxImageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setLightboxImageUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setLightboxImageUrl(null)}
              className="absolute -top-12 right-0 p-2 text-white/80 hover:text-white cursor-pointer"
            >
              <X size={24} />
            </button>
            <img
              src={lightboxImageUrl}
              alt="Preview"
              className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* ========================================================
          New Chat Modal: Search and initiate chat with any user
          ======================================================== */}
      {isNewChatModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#1E2A23]/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#FAFAF9] rounded-3xl border border-[#2D3732]/10 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-[#E6EDE9] flex items-center justify-between bg-white">
              <div>
                <h3 className="text-sm font-bold text-[#1E2A23]">New Direct Message</h3>
                <p className="text-[11px] text-[#7A8A82]">Choose a creator to start chatting in real-time</p>
              </div>
              <button
                onClick={() => setIsNewChatModalOpen(false)}
                className="p-1.5 rounded-xl text-[#7A8A82] hover:text-[#1E2A23] hover:bg-[#F1F5F2] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3 border-b border-[#E6EDE9] bg-[#FAFAF9]">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-2.5 text-[#7A8A82]" />
                <input
                  type="text"
                  value={searchUserQuery}
                  onChange={(e) => setSearchUserQuery(e.target.value)}
                  placeholder="Search creators by name or @username..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-[#2D3732]/10 text-xs text-[#1E2A23] focus:outline-none focus:border-[#4A6757]"
                  autoFocus
                />
              </div>
            </div>

            <div className="p-2 overflow-y-auto divide-y divide-[#2D3732]/5 flex-1 bg-white">
              {availableUsers
                .filter(
                  (u) =>
                    u.name.toLowerCase().includes(searchUserQuery.toLowerCase()) ||
                    u.username.toLowerCase().includes(searchUserQuery.toLowerCase())
                )
                .map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleStartChatWithUser(user)}
                    className="w-full p-3 flex items-center gap-3 rounded-2xl hover:bg-[#F4F7F5] text-left transition-colors cursor-pointer"
                  >
                    <ModernAvatar
                      src={user.avatar}
                      alt={user.name}
                      size="md"
                      className="shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-[#1E2A23] truncate">
                          {user.name}
                        </span>
                        {user.verified && (
                          <CheckCircle2 size={13} className="text-emerald-700" />
                        )}
                      </div>
                      <p className="text-[11px] text-[#7A8A82] truncate">@{user.username}</p>
                      {user.bio && (
                        <p className="text-[10px] text-[#7A8A82]/80 truncate mt-0.5">
                          {user.bio}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
