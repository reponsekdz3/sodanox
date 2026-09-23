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
  MoreVertical,
  Plus,
  X,
  User as UserIcon,
} from 'lucide-react';
import { ChatConversation, Message, User, VoiceNoteMeta } from '../../types';
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
} from '../../services/chatService';
import { getAllUsers } from '../../services/userService';

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
  const [activeConvId, setActiveConvId] = useState<string>(externalActiveId || '');
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [inputText, setInputText] = useState('');
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [searchUserQuery, setSearchUserQuery] = useState('');
  const [isSending, setIsSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync external conversation selection if provided
  useEffect(() => {
    if (externalActiveId && externalActiveId !== activeConvId) {
      setActiveConvId(externalActiveId);
    }
  }, [externalActiveId]);

  // Handle initial target user to start a direct chat
  useEffect(() => {
    if (initialTargetUser && initialTargetUser.id !== currentUser.id) {
      getOrCreateConversation(currentUser, initialTargetUser).then((convId) => {
        setActiveConvId(convId);
        setMobileShowChat(true);
      });
    }
  }, [initialTargetUser, currentUser.id]);

  // Subscribe in real-time to conversations involving the current user
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
      (err) => console.warn('Convs error:', err)
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

  // Subscribe in real-time to messages of the active conversation
  useEffect(() => {
    if (!activeConvId) {
      setMessages([]);
      return;
    }

    // Mark as read
    markConversationAsRead(activeConvId, currentUser.id).catch(() => {});

    const unsubscribe = subscribeToMessages(
      activeConvId,
      (msgs) => {
        setMessages(msgs);
      },
      (err) => console.warn('Messages error:', err)
    );

    return () => unsubscribe();
  }, [activeConvId, currentUser.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const activeConv = conversations.find((c) => c.id === activeConvId);

  const filteredConversations = conversations.filter(
    (c) =>
      c.participant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.participant.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectConv = (convId: string) => {
    setActiveConvId(convId);
    if (externalOnSelect) externalOnSelect(convId);
    setMobileShowChat(true);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    if (!activeConvId) return;

    // Real-time typing notification
    setTypingIndicator(activeConvId, currentUser.id, true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setTypingIndicator(activeConvId, currentUser.id, false);
    }, 2000);
  };

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeConvId || !activeConv || isSending) return;

    const textToSend = inputText.trim();
    setInputText('');
    setIsSending(true);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setTypingIndicator(activeConvId, currentUser.id, false);

    try {
      await sendChatMessage(
        activeConvId,
        {
          type: 'text',
          text: textToSend,
        },
        currentUser,
        activeConv.participant.id
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

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) return;

      try {
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
            activeConv.participant.id
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
            activeConv.participant.id
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
    try {
      await sendChatMessage(
        activeConvId,
        {
          type: 'voice',
          voice: voiceMeta,
        },
        currentUser,
        activeConv.participant.id
      );
    } catch (err) {
      console.error('Error sending voice note:', err);
    }
  };

  const handleStartChatWithUser = async (targetUser: User) => {
    setIsNewChatModalOpen(false);
    const convId = await getOrCreateConversation(currentUser, targetUser);
    setActiveConvId(convId);
    setMobileShowChat(true);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-2 sm:px-6 py-2 sm:py-6 h-[calc(100vh-80px)] sm:h-[calc(100vh-100px)] min-h-[500px]">
      <div className="w-full h-full bg-[#FAFAF9] border border-[#F1F5F2] rounded-3xl shadow-soft overflow-hidden grid grid-cols-1 md:grid-cols-12">
        {/* Conversations List Sidebar */}
        <div
          className={`h-full border-r border-[#F1F5F2] flex flex-col md:col-span-4 lg:col-span-4 bg-[#FAFAF9] ${
            mobileShowChat ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Sidebar Header & Search */}
          <div className="p-4 border-b border-[#F1F5F2] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-[#2D3732]">
                  Direct Messages
                </h2>
                <span className="text-[11px] text-[#7A8A82]">Real-time encrypted sync</span>
              </div>
              <button
                onClick={() => setIsNewChatModalOpen(true)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#8FA89B] text-white hover:bg-[#7e9689] text-xs font-medium transition-colors shadow-soft cursor-pointer"
                title="Start new direct conversation"
              >
                <Plus size={14} />
                <span>New Chat</span>
              </button>
            </div>

            <div className="relative">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7A8A82]"
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search conversations..."
                className="w-full bg-[#F1F5F2] rounded-2xl pl-9 pr-4 py-2 text-xs text-[#2D3732] placeholder-[#7A8A82] focus:outline-none focus:bg-[#FAFAF9] border border-transparent focus:border-[#8FA89B]"
              />
            </div>
          </div>

          {/* Conversation List Items */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#F1F5F2]/60">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <p className="text-xs text-[#7A8A82]">No conversations yet.</p>
                <button
                  onClick={() => setIsNewChatModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-[#8FA89B] text-white text-xs font-medium hover:bg-[#7e9689] transition-colors"
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
                    className={`w-full p-4 flex items-center gap-3.5 text-left transition-colors cursor-pointer ${
                      isActive ? 'bg-[#F1F5F2]' : 'hover:bg-[#F1F5F2]/50'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <img
                        src={conv.participant.avatar}
                        alt={conv.participant.name}
                        className="w-12 h-12 rounded-full object-cover border border-[#2D3732]/10"
                      />
                      {conv.isOnline && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#8FA89B] border-2 border-white" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs sm:text-sm font-semibold text-[#2D3732] truncate">
                          {conv.participant.name}
                        </span>
                        <span className="text-[11px] text-[#7A8A82] shrink-0 tabular-nums">
                          {conv.lastMessage?.timestamp || ''}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <p className="text-xs text-[#7A8A82] truncate max-w-[180px]">
                          {conv.isTyping ? (
                            <span className="text-[#8FA89B] font-medium animate-pulse">
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
                          <span className="w-5 h-5 rounded-full bg-[#8FA89B] text-white text-[11px] font-semibold flex items-center justify-center shrink-0">
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

        {/* Active Conversation Chat Window */}
        {activeConv ? (
          <div
            className={`h-full flex flex-col md:col-span-8 lg:col-span-8 bg-[#FAFAF9] ${
              mobileShowChat ? 'flex' : 'hidden md:flex'
            }`}
          >
            {/* Chat Top Bar */}
            <div className="h-16 px-4 sm:px-6 border-b border-[#F1F5F2] flex items-center justify-between shrink-0 bg-[#FAFAF9]/80 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setMobileShowChat(false)}
                  className="md:hidden p-1.5 -ml-1 text-[#7A8A82] hover:text-[#2D3732]"
                >
                  <ArrowLeft size={18} />
                </button>

                <div
                  onClick={() => onOpenUserProfile(activeConv.participant)}
                  className="flex items-center gap-3 cursor-pointer group"
                >
                  <div className="relative shrink-0">
                    <img
                      src={activeConv.participant.avatar}
                      alt={activeConv.participant.name}
                      className="w-10 h-10 rounded-full object-cover group-hover:ring-2 group-hover:ring-[#8FA89B] transition-all"
                    />
                    {activeConv.isOnline && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#8FA89B] border-2 border-white" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs sm:text-sm font-semibold text-[#2D3732] group-hover:text-[#8FA89B] transition-colors">
                        {activeConv.participant.name}
                      </span>
                      {activeConv.participant.verified && (
                        <CheckCircle2 size={14} className="text-[#8FA89B]" />
                      )}
                    </div>
                    <span className="text-[11px] text-[#7A8A82] block">
                      {activeConv.isTyping ? (
                        <span className="text-[#8FA89B] font-medium animate-pulse">
                          typing...
                        </span>
                      ) : activeConv.isOnline ? (
                        'Active in studio'
                      ) : (
                        'Offline'
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Call and Info Action Icons */}
              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  onClick={() => onStartCall(activeConv.participant, 'audio')}
                  className="p-2 rounded-2xl text-[#7A8A82] hover:text-[#2D3732] hover:bg-[#F1F5F2] transition-colors"
                  title="Audio Call"
                >
                  <Phone size={18} />
                </button>
                <button
                  onClick={() => onStartCall(activeConv.participant, 'video')}
                  className="p-2 rounded-2xl text-[#7A8A82] hover:text-[#2D3732] hover:bg-[#F1F5F2] transition-colors"
                  title="Video Call"
                >
                  <Video size={18} />
                </button>
                <button
                  onClick={() => onOpenUserProfile(activeConv.participant)}
                  className="p-2 rounded-2xl text-[#7A8A82] hover:text-[#2D3732] hover:bg-[#F1F5F2] transition-colors"
                  title="View Profile"
                >
                  <UserIcon size={18} />
                </button>
              </div>
            </div>

            {/* Chat Messages Feed */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-[#E6EDE9] flex items-center justify-center text-[#8FA89B]">
                    <Smile size={24} />
                  </div>
                  <h3 className="text-sm font-semibold text-[#2D3732]">
                    Quiet conversation with {activeConv.participant.name}
                  </h3>
                  <p className="text-xs text-[#7A8A82] max-w-xs">
                    Send a message, attach an architectural draft or photo, or record a voice note.
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isSelf = msg.senderId === currentUser.id;

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}
                    >
                      {/* Message Content Bubble */}
                      <div className="max-w-[85%] sm:max-w-[70%] space-y-1">
                        {/* Text Message */}
                        {msg.type === 'text' && (
                          <div
                            className={`p-3.5 rounded-3xl text-xs sm:text-sm leading-relaxed shadow-soft ${
                              isSelf
                                ? 'bg-[#8FA89B] text-white rounded-tr-sm'
                                : 'bg-[#F1F5F2] text-[#2D3732] rounded-tl-sm'
                            }`}
                          >
                            {msg.text}
                          </div>
                        )}

                        {/* Image Message */}
                        {msg.type === 'image' && msg.file && (
                          <div className="rounded-3xl overflow-hidden shadow-soft border border-[#F1F5F2]">
                            <img
                              src={msg.file.url}
                              alt={msg.file.name}
                              className="w-full max-h-72 object-cover rounded-3xl"
                            />
                            {msg.text && msg.text !== msg.file.name && (
                              <p className="p-2 text-xs bg-[#F1F5F2] text-[#2D3732]">
                                {msg.text}
                              </p>
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

                        {/* Timestamp & Delivery Status */}
                        <div
                          className={`flex items-center gap-1 text-[10px] text-[#7A8A82] px-1 ${
                            isSelf ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          <span className="tabular-nums">{msg.timestamp}</span>
                          {isSelf && (
                            <span>
                              {msg.status === 'read' ? (
                                <CheckCheck size={13} className="text-[#8FA89B]" />
                              ) : msg.status === 'delivered' ? (
                                <CheckCheck size={13} className="text-[#7A8A82]" />
                              ) : (
                                <Check size={13} className="text-[#7A8A82]" />
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Typing indicator inside active chat */}
              {activeConv.isTyping && (
                <div className="flex items-center gap-2 text-xs text-[#7A8A82]">
                  <div className="w-8 h-8 rounded-full overflow-hidden shrink-0">
                    <img
                      src={activeConv.participant.avatar}
                      alt={activeConv.participant.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-3 bg-[#F1F5F2] rounded-2xl rounded-tl-sm flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#8FA89B] animate-bounce" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#8FA89B] animate-bounce [animation-delay:0.2s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#8FA89B] animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input Bar */}
            <div className="p-3 sm:p-4 border-t border-[#F1F5F2] bg-[#FAFAF9]">
              {isRecordingVoice ? (
                <VoiceRecorderBar
                  onCancel={() => setIsRecordingVoice(false)}
                  onSendVoiceNote={handleSendVoiceNote}
                />
              ) : (
                <form
                  onSubmit={handleSendText}
                  className="flex items-center gap-2 bg-[#F1F5F2] rounded-2xl p-1.5 pl-3 border border-transparent focus-within:border-[#8FA89B] transition-colors"
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
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1.5 text-[#7A8A82] hover:text-[#2D3732] transition-colors shrink-0"
                    title="Attach image or document"
                  >
                    <Paperclip size={18} />
                  </button>

                  {/* Text Input */}
                  <input
                    type="text"
                    value={inputText}
                    onChange={handleTextChange}
                    placeholder={`Message ${activeConv.participant.name}...`}
                    className="flex-1 bg-transparent text-xs sm:text-sm text-[#2D3732] placeholder-[#7A8A82] focus:outline-none px-1"
                  />

                  {/* Voice Note / Send Button */}
                  {inputText.trim().length > 0 ? (
                    <button
                      type="submit"
                      disabled={isSending}
                      className="p-2 rounded-xl bg-[#8FA89B] text-white hover:bg-[#7e9689] transition-all active:scale-95 shrink-0 shadow-soft cursor-pointer"
                      title="Send message"
                    >
                      <Send size={16} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsRecordingVoice(true)}
                      className="p-2 text-[#7A8A82] hover:text-[#2D3732] hover:bg-white rounded-xl transition-colors shrink-0 cursor-pointer"
                      title="Record voice note"
                    >
                      <Mic size={18} />
                    </button>
                  )}
                </form>
              )}
            </div>
          </div>
        ) : (
          <div className="hidden md:flex md:col-span-8 lg:col-span-8 h-full flex-col items-center justify-center p-6 text-center bg-[#FAFAF9]">
            <div className="w-16 h-16 rounded-3xl bg-[#F1F5F2] flex items-center justify-center text-[#8FA89B] mb-4">
              <Smile size={32} />
            </div>
            <h3 className="text-base font-semibold text-[#2D3732] mb-1">
              Select or Start a Conversation
            </h3>
            <p className="text-xs text-[#7A8A82] max-w-sm mb-4">
              Direct messages sync live in real-time with full support for voice notes, photos, and files.
            </p>
            <button
              onClick={() => setIsNewChatModalOpen(true)}
              className="px-5 py-2.5 rounded-2xl bg-[#8FA89B] text-white text-xs font-medium hover:bg-[#7e9689] transition-all shadow-soft"
            >
              Start New Chat
            </button>
          </div>
        )}
      </div>

      {/* New Chat Modal: Search and initiate chat with any registered user */}
      {isNewChatModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#2D3732]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#FAFAF9] rounded-3xl border border-[#2D3732]/10 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-[#2D3732]/10 flex items-center justify-between bg-[#F1F5F2]">
              <div>
                <h3 className="text-sm font-semibold text-[#2D3732]">New Direct Message</h3>
                <p className="text-[11px] text-[#7A8A82]">Choose a creator to start chatting in real-time</p>
              </div>
              <button
                onClick={() => setIsNewChatModalOpen(false)}
                className="p-1.5 rounded-xl text-[#7A8A82] hover:text-[#2D3732]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3 border-b border-[#2D3732]/10">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-2.5 text-[#7A8A82]" />
                <input
                  type="text"
                  value={searchUserQuery}
                  onChange={(e) => setSearchUserQuery(e.target.value)}
                  placeholder="Search creators by name or @username..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-[#2D3732]/10 text-xs text-[#2D3732] focus:outline-none focus:border-[#8FA89B]"
                  autoFocus
                />
              </div>
            </div>

            <div className="p-2 overflow-y-auto divide-y divide-[#2D3732]/5 flex-1">
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
                    className="w-full p-3 flex items-center gap-3 rounded-2xl hover:bg-[#F1F5F2] text-left transition-colors cursor-pointer"
                  >
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-10 h-10 rounded-full object-cover border border-[#2D3732]/10 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-[#2D3732] truncate">
                          {user.name}
                        </span>
                        {user.verified && (
                          <CheckCircle2 size={13} className="text-[#8FA89B]" />
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
