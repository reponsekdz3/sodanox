import React, { useState, useRef, useEffect } from 'react';
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
} from 'lucide-react';
import { ChatConversation, Message, MessageReplyInfo, User, VoiceNoteMeta } from '../../types';
import { VoiceNotePlayer } from './VoiceNotePlayer';
import { VoiceRecorderBar } from './VoiceRecorderBar';
import { FileAttachmentCard } from './FileAttachmentCard';
import {
  subscribeToMessages,
  subscribeToUserConversations,
  sendChatMessage,
  markConversationAsRead,
  setTypingIndicator,
  getOrCreateConversation,
  getDeterministicConvId,
  addMessageReaction,
} from '../../services/chatService';
import { getAllUsers } from '../../services/userService';
import { auraAudio } from '../../utils/audioSynthesizer';

interface MessagesViewProps {
  currentUser: User;
  activeConversationId?: string;
  onSelectConversation?: (id: string) => void;
  onStartCall: (participant: User, type: 'audio' | 'video') => void;
  onOpenUserProfile: (user: User) => void;
  initialTargetUser?: User | null;
  onOpenAuth?: () => void;
}

export const MessagesView: React.FC<MessagesViewProps> = ({
  currentUser,
  activeConversationId: externalActiveId,
  onSelectConversation: externalOnSelect,
  onStartCall,
  onOpenUserProfile,
  initialTargetUser,
}) => {
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
  const [searchTerm, setSearchTerm] = useState('');
  const [inputText, setInputText] = useState('');
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState<boolean>(Boolean(initialTargetUser || externalActiveId));
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [searchUserQuery, setSearchUserQuery] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [activeReactionMessageId, setActiveReactionMessageId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messageInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageElementsRef = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Sync external conversation selection if provided
  useEffect(() => {
    if (externalActiveId && externalActiveId !== activeConvId) {
      setActiveConvId(externalActiveId);
      setMobileShowChat(true);
    }
  }, [externalActiveId]);

  // Handle initial target user to start a direct chat immediately
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

  // Subscribe in real-time to conversations involving the current user from Firestore
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

  // Fetch available community users for New Chat modal
  useEffect(() => {
    if (isNewChatModalOpen) {
      getAllUsers(currentUser.id).then((users) => {
        setAvailableUsers(users);
      });
    }
  }, [isNewChatModalOpen, currentUser.id]);

  // Subscribe in real-time to messages of the active conversation from Firestore
  useEffect(() => {
    if (!activeConvId) {
      setMessages([]);
      return;
    }

    // Mark messages as read in Firestore
    markConversationAsRead(activeConvId, currentUser.id).catch(() => {});

    const unsubscribe = subscribeToMessages(
      activeConvId,
      (msgs) => {
        setMessages(msgs);
        // If there are unread messages from the other user while we are looking, mark them read
        const hasUnreadFromOther = msgs.some(
          (m) => m.senderId !== currentUser.id && m.status !== 'read'
        );
        if (hasUnreadFromOther) {
          markConversationAsRead(activeConvId, currentUser.id).catch(() => {});
        }
      },
      (err) => console.error('Messages subscription error:', err)
    );

    return () => unsubscribe();
  }, [activeConvId, currentUser.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Clear typing indicator on unmount
  useEffect(() => {
    return () => {
      if (activeConvId && currentUser?.id) {
        setTypingIndicator(activeConvId, currentUser.id, false).catch(() => {});
      }
    };
  }, [activeConvId, currentUser?.id]);

  const activeConv: ChatConversation | undefined =
    conversations.find((c) => c.id === activeConvId) ||
    (targetParticipant && activeConvId
      ? {
          id: activeConvId,
          participant: {
            ...targetParticipant,
            isFollowing: targetParticipant.isFollowing || false,
            joinedDate: targetParticipant.joinedDate || '',
            followersCount: targetParticipant.followersCount || 0,
            followingCount: targetParticipant.followingCount || 0,
            bio: targetParticipant.bio || '',
          },
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
        }
      : undefined);

  const filteredConversations = conversations.filter(
    (c) =>
      c.participant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.participant.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectConv = (convId: string) => {
    auraAudio.playClick(600, 0.03);
    const selected = conversations.find((c) => c.id === convId);
    if (selected) {
      setTargetParticipant(selected.participant);
    }
    setActiveConvId(convId);
    setReplyingTo(null);
    if (externalOnSelect) externalOnSelect(convId);
    setMobileShowChat(true);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    if (!activeConvId || !currentUser?.id) return;

    // Real-time Firestore typing notification
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConvId || !activeConv) return;

    const sizeInMb = (file.size / (1024 * 1024)).toFixed(1);
    const sizeStr = `${sizeInMb} MB`;
    const isImage = file.type.startsWith('image/');

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

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) return;

      try {
        auraAudio.playClick(640, 0.05);
        if (isImage) {
          await sendChatMessage(
            activeConvId,
            {
              type: 'image',
              text: file.name,
              file: {
                name: file.name,
                size: sizeStr,
                type: file.type,
                url: dataUrl,
              },
            },
            currentUser,
            activeConv.participant.id,
            replyPayload
          );
        } else {
          await sendChatMessage(
            activeConvId,
            {
              type: 'file',
              file: {
                name: file.name,
                size: sizeStr,
                type: file.type,
                url: dataUrl,
              },
            },
            currentUser,
            activeConv.participant.id,
            replyPayload
          );
        }
      } catch (err) {
        console.error('Error sending file:', err);
      }
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
    <div className="w-full max-w-7xl mx-auto px-0 sm:px-4 md:px-6 py-0 sm:py-4 h-[calc(100dvh-60px)] md:h-[calc(100vh-88px)] flex flex-col">
      <div className="w-full h-full bg-[#FAFAF9] sm:border border-[#E2EAE4] sm:rounded-3xl shadow-sm sm:shadow-soft overflow-hidden grid grid-cols-1 md:grid-cols-12 flex-1">
        
        {/* ========================================================
            Conversations List Sidebar (Hidden on mobile when chat is open)
            ======================================================== */}
        <div
          className={`h-full border-r border-[#E6EDE9] flex flex-col md:col-span-4 lg:col-span-4 bg-[#FAFAF9] ${
            mobileShowChat ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Sidebar Header & Search */}
          <div className="p-3.5 sm:p-4 border-b border-[#E6EDE9] space-y-3 bg-white/60 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-[#1E2A23] tracking-tight">
                    Messages
                  </h2>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <span className="text-[11px] text-[#6A7B73] font-medium">Real-time sync</span>
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

            <div className="relative">
              <Search
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7A8A82]"
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search conversations..."
                className="w-full bg-[#F1F5F2] hover:bg-[#EAEFEA] rounded-2xl pl-9 pr-4 py-2 text-xs text-[#2D3732] placeholder-[#7A8A82] focus:outline-none focus:bg-white border border-transparent focus:border-[#4A6757] transition-all"
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
          </div>

          {/* Conversation List Items */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#F1F5F2]">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center space-y-3 flex flex-col items-center justify-center h-48">
                <div className="w-12 h-12 rounded-2xl bg-[#E6EDE9] flex items-center justify-center text-[#4A6757]">
                  <Smile size={22} />
                </div>
                <p className="text-xs text-[#7A8A82]">No conversations yet.</p>
                <button
                  onClick={() => setIsNewChatModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#2F4438] to-[#4A6757] text-white text-xs font-semibold hover:brightness-110 transition-all shadow-xs cursor-pointer"
                >
                  Start a conversation
                </button>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isActive = conv.id === activeConv?.id;
                return (
                  <button
                    key={conv.id}
                    onClick={() => handleSelectConv(conv.id)}
                    className={`w-full p-3.5 sm:p-4 flex items-center gap-3 text-left transition-colors cursor-pointer border-l-3 ${
                      isActive
                        ? 'bg-[#EBF1ED] border-[#4A6757]'
                        : 'border-transparent hover:bg-[#F4F7F5]'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <img
                        src={conv.participant.avatar}
                        alt={conv.participant.name}
                        className="w-12 h-12 rounded-full object-cover border border-[#2D3732]/10"
                      />
                      {conv.isOnline && (
                        <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs sm:text-sm font-bold text-[#1E2A23] truncate">
                          {conv.participant.name}
                        </span>
                        <span className="text-[11px] text-[#7A8A82] shrink-0 tabular-nums">
                          {conv.lastMessage?.timestamp || ''}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <p className="text-xs text-[#62736B] truncate max-w-[190px]">
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
            Active Conversation Chat Window (Full height mobile layout)
            ======================================================== */}
        {activeConv ? (
          <div
            className={`h-full flex flex-col md:col-span-8 lg:col-span-8 bg-[#FAFAF9] relative overflow-hidden ${
              mobileShowChat ? 'flex' : 'hidden md:flex'
            }`}
          >
            {/* Chat Top Bar Header */}
            <div className="h-16 px-3 sm:px-6 border-b border-[#E6EDE9] flex items-center justify-between shrink-0 bg-white/80 backdrop-blur-md z-10 shadow-2xs">
              <div className="flex items-center gap-2.5 sm:gap-3">
                {/* Back button on mobile */}
                <button
                  onClick={() => {
                    auraAudio.playClick(480, 0.03);
                    setMobileShowChat(false);
                  }}
                  className="md:hidden p-2 -ml-1 text-[#4A6757] hover:bg-[#F1F5F2] rounded-xl transition-colors cursor-pointer"
                  title="Back to conversations"
                >
                  <ArrowLeft size={20} className="stroke-[2.5]" />
                </button>

                <div
                  onClick={() => onOpenUserProfile(activeConv.participant)}
                  className="flex items-center gap-3 cursor-pointer group"
                >
                  <div className="relative shrink-0">
                    <img
                      src={activeConv.participant.avatar}
                      alt={activeConv.participant.name}
                      className="w-10 h-10 rounded-full object-cover ring-1 ring-[#2D3732]/10 group-hover:ring-2 group-hover:ring-[#4A6757] transition-all"
                    />
                    {activeConv.isOnline && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs sm:text-sm font-bold text-[#1E2A23] group-hover:text-[#4A6757] transition-colors truncate max-w-[130px] sm:max-w-xs">
                        {activeConv.participant.name}
                      </span>
                      {activeConv.participant.verified && (
                        <CheckCircle2 size={14} className="text-emerald-700 shrink-0" />
                      )}
                    </div>
                    <span className="text-[11px] block font-medium">
                      {activeConv.isTyping ? (
                        <span className="text-emerald-700 font-semibold animate-pulse flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block animate-ping" />
                          typing...
                        </span>
                      ) : activeConv.isOnline ? (
                        <span className="text-[#6A7B73]">Active now</span>
                      ) : (
                        <span className="text-[#8FA89B]">Offline</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Call and Profile Actions */}
              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  onClick={() => {
                    auraAudio.playClick(600, 0.04);
                    onStartCall(activeConv.participant, 'audio');
                  }}
                  className="p-2 sm:p-2.5 rounded-2xl text-[#4A6757] hover:bg-[#E6EDE9] transition-colors cursor-pointer"
                  title="Audio Call"
                >
                  <Phone size={18} className="stroke-[2]" />
                </button>
                <button
                  onClick={() => {
                    auraAudio.playClick(600, 0.04);
                    onStartCall(activeConv.participant, 'video');
                  }}
                  className="p-2 sm:p-2.5 rounded-2xl text-[#4A6757] hover:bg-[#E6EDE9] transition-colors cursor-pointer"
                  title="Video Call"
                >
                  <Video size={18} className="stroke-[2]" />
                </button>
                <button
                  onClick={() => {
                    auraAudio.playClick(500, 0.03);
                    onOpenUserProfile(activeConv.participant);
                  }}
                  className="p-2 sm:p-2.5 rounded-2xl text-[#6A7B73] hover:text-[#1E2A23] hover:bg-[#F1F5F2] transition-colors cursor-pointer"
                  title="View Profile"
                >
                  <UserIcon size={18} />
                </button>
              </div>
            </div>

            {/* Chat Messages Feed */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-3.5 bg-[#FAFAF9]">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-[#E6EDE9] flex items-center justify-center text-[#4A6757] mb-1">
                    <Smile size={24} />
                  </div>
                  <h3 className="text-sm font-bold text-[#1E2A23]">
                    Conversation with {activeConv.participant.name}
                  </h3>
                  <p className="text-xs text-[#7A8A82] max-w-xs">
                    Send a message, voice note, photo, or attach files. Direct messages sync live across all devices.
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
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
                      <div className="flex items-center gap-1.5 max-w-[88%] sm:max-w-[72%]">
                        {/* If self message, action icons appear on the left */}
                        {isSelf && (
                          <div
                            className={`flex items-center gap-1 transition-opacity ${
                              isHovered || activeReactionMessageId === msg.id
                                ? 'opacity-100'
                                : 'opacity-0 md:group-hover:opacity-100'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => handleInitiateReply(msg)}
                              className="p-1 rounded-lg text-[#7A8A82] hover:text-[#2D3732] hover:bg-[#E6EDE9] transition-colors cursor-pointer"
                              title="Reply"
                            >
                              <Reply size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setActiveReactionMessageId(
                                  activeReactionMessageId === msg.id ? null : msg.id
                                )
                              }
                              className="p-1 rounded-lg text-[#7A8A82] hover:text-[#2D3732] hover:bg-[#E6EDE9] transition-colors cursor-pointer"
                              title="React"
                            >
                              <Smile size={14} />
                            </button>
                          </div>
                        )}

                        {/* Reaction Picker Popover */}
                        {activeReactionMessageId === msg.id && (
                          <div
                            className={`absolute -top-9 z-20 bg-white border border-[#2D3732]/10 rounded-full px-2 py-1 shadow-lg flex items-center gap-1.5 animate-in fade-in zoom-in-95 ${
                              isSelf ? 'right-2' : 'left-2'
                            }`}
                          >
                            {['❤️', '👍', '🔥', '😂', '👏'].map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => handleReaction(msg.id, emoji)}
                                className="hover:scale-125 transition-transform text-sm p-1 cursor-pointer"
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

                          {/* Text Message */}
                          {msg.type === 'text' && (
                            <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words">
                              {msg.text}
                            </p>
                          )}

                          {/* Image Message */}
                          {msg.type === 'image' && msg.file && (
                            <div className="rounded-2xl overflow-hidden shadow-xs border border-white/20">
                              <img
                                src={msg.file.url}
                                alt={msg.file.name}
                                className="w-full max-h-72 object-cover rounded-2xl"
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

                          {/* Timestamp and Seen Read-receipt */}
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
                            className={`flex items-center gap-1 transition-opacity ${
                              isHovered || activeReactionMessageId === msg.id
                                ? 'opacity-100'
                                : 'opacity-0 md:group-hover:opacity-100'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => handleInitiateReply(msg)}
                              className="p-1 rounded-lg text-[#7A8A82] hover:text-[#2D3732] hover:bg-[#E6EDE9] transition-colors cursor-pointer"
                              title="Reply"
                            >
                              <Reply size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setActiveReactionMessageId(
                                  activeReactionMessageId === msg.id ? null : msg.id
                                )
                              }
                              className="p-1 rounded-lg text-[#7A8A82] hover:text-[#2D3732] hover:bg-[#E6EDE9] transition-colors cursor-pointer"
                              title="React"
                            >
                              <Smile size={14} />
                            </button>
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
            <div className="border-t border-[#E6EDE9] bg-white/95 backdrop-blur-md">
              {/* Replying To Banner */}
              {replyingTo && (
                <div className="px-4 py-2 bg-[#EBF1ED] border-b border-[#D8E4DC] flex items-center justify-between text-xs animate-in slide-in-from-bottom-2 duration-150">
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

              <div className="p-2.5 sm:p-3.5">
                {isRecordingVoice ? (
                  <VoiceRecorderBar
                    onCancel={() => setIsRecordingVoice(false)}
                    onSendVoiceNote={handleSendVoiceNote}
                  />
                ) : (
                  <form
                    onSubmit={handleSendText}
                    className="flex items-center gap-2 bg-[#F1F5F2] focus-within:bg-white rounded-2xl p-1.5 pl-3 border border-transparent focus-within:border-[#4A6757] transition-all shadow-xs"
                  >
                    {/* File Upload Hidden Input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,.pdf,.doc,.docx,.zip,.txt,.ts,.json"
                      onChange={handleFileUpload}
                      className="hidden"
                    />

                    {/* Attachment Icon Button */}
                    <button
                      type="button"
                      onClick={() => {
                        auraAudio.playClick(500, 0.03);
                        fileInputRef.current?.click();
                      }}
                      className="p-1.5 text-[#7A8A82] hover:text-[#1E2A23] transition-colors shrink-0 cursor-pointer"
                      title="Attach image or document"
                    >
                      <Paperclip size={18} />
                    </button>

                    {/* Text Input */}
                    <input
                      ref={messageInputRef}
                      type="text"
                      value={inputText}
                      onChange={handleTextChange}
                      placeholder={`Message ${activeConv.participant.name}...`}
                      className="flex-1 bg-transparent text-xs sm:text-sm text-[#1E2A23] placeholder-[#7A8A82] focus:outline-none px-1"
                    />

                    {/* Voice Note / Send Button */}
                    {inputText.trim().length > 0 ? (
                      <button
                        type="submit"
                        disabled={isSending}
                        className="p-2 sm:px-3 sm:py-2 rounded-xl bg-gradient-to-r from-[#2F4438] via-[#4A6757] to-[#719181] text-white hover:brightness-110 transition-all active:scale-95 shrink-0 shadow-soft cursor-pointer flex items-center gap-1.5 ring-1 ring-white/20"
                        title="Send message"
                      >
                        <Send size={15} className="stroke-[2.5]" />
                        <span className="hidden sm:inline text-xs font-semibold">Send</span>
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
          <div className="hidden md:flex md:col-span-8 lg:col-span-8 h-full flex-col items-center justify-center p-6 text-center bg-[#FAFAF9]">
            <div className="w-16 h-16 rounded-3xl bg-[#E6EDE9] flex items-center justify-center text-[#4A6757] mb-4">
              <Smile size={32} />
            </div>
            <h3 className="text-base font-bold text-[#1E2A23] mb-1">
              Select or Start a Conversation
            </h3>
            <p className="text-xs text-[#7A8A82] max-w-sm mb-4">
              Direct messages sync live in real-time with full support for replies, voice notes, photos, and files.
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
      </div>

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
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-10 h-10 rounded-full object-cover border border-[#2D3732]/10 shrink-0"
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
