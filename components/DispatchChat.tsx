import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, Send, X, Minimize2, Maximize2, ArrowLeft, User, Search } from 'lucide-react';
import { useLogistics } from '../services/logisticsContext';
import { UserRole, Driver } from '../types';

interface DispatchChatProps {
  positioning?: string;
  buttonSize?: string;
  fullScreen?: boolean;
}

export const DispatchChat: React.FC<DispatchChatProps> = ({ 
  positioning = "fixed bottom-6 right-6",
  buttonSize = "w-14 h-14",
  fullScreen = false
}) => {
  const { user, messages, sendMessage, drivers, activeChatId, setActiveChatId, isChatOpen: isOpen, setIsChatOpen: setIsOpen, conversations } = useLogistics();
  const [isMinimized, setIsMinimized] = useState(false);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 1. Force Scroll to Bottom on Chat Entry or Switch
  useEffect(() => {
    if (isOpen && !isMinimized && activeChatId && scrollRef.current) {
      // Use a small timeout to ensure DOM is rendered with new messages
      const timer = setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          setShowJumpToBottom(false);
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [activeChatId, isOpen, isMinimized]);

  // 2. Intelligent Auto-Scroll for New Messages (when already in chat)
  const prevMessagesLength = useRef(messages.length);
  useEffect(() => {
    if (scrollRef.current && messages.length > 0) {
      const isNewMessage = messages.length > prevMessagesLength.current;
      const lastMessage = messages[messages.length - 1];
      const isMyMessage = lastMessage?.senderId === user?.id;

      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
      
      // Auto-scroll if it's my message OR if I'm already near bottom
      if (isNewMessage && (isNearBottom || isMyMessage)) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        setShowJumpToBottom(false);
      } else if (isNewMessage && !isNearBottom) {
        setShowJumpToBottom(true);
      }
    }
    prevMessagesLength.current = messages.length;
  }, [messages, user?.id]);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 50;
      if (isNearBottom) {
        setShowJumpToBottom(false);
      }
    }
  };

  const jumpToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
      setShowJumpToBottom(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text) return;
    
    setInputText('');
    await sendMessage(text);
  };

  const selectedDriver = drivers.find(d => d.id === activeChatId);
  const isMerchant = user?.role === UserRole.MERCHANT;
  const showChatList = isMerchant && !activeChatId;

  // Notification Logic
  const hasUnread = conversations.some(c => 
    isMerchant ? c.unreadMerchant : (c.unreadDriver && c.chatId === user?.id)
  );

  if (!user || user.role === UserRole.NONE) return null;

  const filteredDrivers = drivers.filter(d => 
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedDrivers = [...filteredDrivers].sort((a, b) => {
    // Primary: Unread status (Merchant cares about unread from drivers)
    const convA = conversations.find(c => c.chatId === a.id);
    const convB = conversations.find(c => c.chatId === b.id);
    
    const unreadA = convA?.unreadMerchant ? 1 : 0;
    const unreadB = convB?.unreadMerchant ? 1 : 0;
    if (unreadA !== unreadB) return unreadB - unreadA;

    // Secondary: Recency (Timestamp from conversations)
    const timeA = convA?.lastTimestamp || 0;
    const timeB = convB?.lastTimestamp || 0;
    
    if (timeA !== timeB) return timeB - timeA;

    // Tertiary: Online status
    if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
    
    // Lastly: Name
    return a.name.localeCompare(b.name);
  });

  return (
    <div className={fullScreen ? "" : `${positioning} z-[9999] flex flex-col items-end`}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={fullScreen ? { opacity: 0, x: '100%' } : { opacity: 0, y: 20, scale: 0.95 }}
            animate={fullScreen ? { 
              opacity: 1, 
              x: 0,
            } : { 
              opacity: 1, 
              y: 0, 
              scale: 1,
              height: isMinimized ? '48px' : '450px' 
            }}
            exit={fullScreen ? { opacity: 0, x: '100%' } : { opacity: 0, y: 20, scale: 0.95 }}
            className={`${fullScreen ? 'fixed inset-0 z-[10000]' : 'mb-4 w-80 md:w-96 rounded-xl border border-slate-700'} bg-slate-900 shadow-2xl overflow-hidden flex flex-col`}
          >
            {/* Header */}
            <div className={`bg-slate-800 p-4 flex items-center justify-between border-b border-slate-700 ${fullScreen ? 'safe-top' : ''}`}>
              <div className="flex items-center gap-3">
                {activeChatId && isMerchant && (
                  <button 
                    onClick={() => setActiveChatId(null)}
                    className="p-1 -ml-1 mr-1 hover:bg-slate-700 rounded-full text-slate-400 transition-colors"
                  >
                    <ArrowLeft size={20} />
                  </button>
                )}
                
                {selectedDriver ? (
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <img 
                        src={selectedDriver.avatar} 
                        alt={selectedDriver.name} 
                        className="w-10 h-10 rounded-full border-2 border-slate-700 object-cover"
                      />
                      <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-800 ${selectedDriver.isOnline ? 'bg-green-500' : 'bg-slate-500'}`} />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-sm text-white leading-tight">{selectedDriver.name}</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        {selectedDriver.isOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                    <span className="font-black text-sm text-white uppercase tracking-wider">
                      {isMerchant ? 'Active Chats' : 'Dispatch Center'}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {!fullScreen && (
                  <button 
                    onClick={() => setIsMinimized(!isMinimized)}
                    className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 transition-colors"
                  >
                    {isMinimized ? <Maximize2 size={18} /> : <Minimize2 size={18} />}
                  </button>
                )}
                <button 
                  onClick={() => {
                    setIsOpen(false);
                    setIsMinimized(false);
                  }}
                  className="p-2 hover:bg-red-500/20 hover:text-red-400 rounded-lg text-slate-400 transition-colors flex items-center gap-1"
                >
                  {fullScreen && <span className="text-[10px] font-bold">CLOSE</span>}
                  <X size={20} />
                </button>
              </div>
            </div>

            {(!isMinimized || fullScreen) && (
              <>
                {showChatList ? (
                  /* MERCHANT: Driver Chat List View */
                  <div className="flex-1 flex flex-col bg-slate-900">
                    <div className="p-3 border-b border-slate-800">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                        <input 
                          type="text" 
                          placeholder="Search drivers..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-all"
                        />
                      </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto">
                      {sortedDrivers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-10 opacity-30 text-center">
                          <User size={48} className="mb-4" />
                          <p className="text-sm font-bold">No drivers found</p>
                        </div>
                      ) : (
                      sortedDrivers.map(driver => {
                        const conversation = conversations.find(c => c.chatId === driver.id);
                        const isUnread = conversation?.unreadMerchant;
                        return (
                          <motion.button
                            layout
                            key={driver.id}
                            onClick={() => setActiveChatId(driver.id)}
                            className={`w-full p-4 flex items-center gap-4 hover:bg-slate-800 border-b border-slate-800/50 transition-colors text-left group ${isUnread ? 'bg-blue-600/5' : ''}`}
                          >
                            <div className="relative">
                              <img 
                                src={driver.avatar} 
                                alt={driver.name} 
                                className={`w-12 h-12 rounded-full object-cover border-2 group-hover:border-blue-500/50 transition-colors ${isUnread ? 'border-blue-500' : 'border-slate-700'}`}
                              />
                              <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${driver.isOnline ? 'bg-green-500' : 'bg-slate-500'}`} />
                              {isUnread && (
                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full border-2 border-slate-900 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-center mb-0.5">
                                <h3 className={`font-bold transition-colors truncate ${isUnread ? 'text-blue-400' : 'text-white group-hover:text-blue-400'}`}>
                                  {driver.name}
                                </h3>
                                <span className={`text-[10px] font-bold whitespace-nowrap ml-2 ${isUnread ? 'text-blue-400' : 'text-slate-500'}`}>
                                  {conversation 
                                    ? new Date(conversation.lastTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                    : driver.status.replace('_', ' ')}
                                </span>
                              </div>
                              <p className={`text-xs truncate flex items-center gap-1 ${isUnread ? 'text-blue-300 font-medium' : 'text-slate-400 opacity-80'}`}>
                                {conversation ? (
                                  <>
                                    <span className={`font-bold ${isUnread ? 'text-blue-400' : 'text-slate-500'}`}>{conversation.lastSenderName}:</span>
                                    <span className="truncate">{conversation.lastMessage}</span>
                                  </>
                                ) : (
                                  driver.isOnline ? 'Online' : 'Last active ' + new Date(driver.lastUpdate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                )}
                              </p>
                            </div>
                          </motion.button>
                        );
                      })
                      )}
                    </div>
                  </div>
                ) : (
                  /* CHAT VIEW: For either driver or merchant speaking to a driver */
                  <div className="flex-1 flex flex-col relative overflow-hidden">
                    <div 
                      ref={scrollRef}
                      onScroll={handleScroll}
                      className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-950/30 scroll-smooth"
                    >
                      {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-50">
                          <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                            <MessageSquare className="text-slate-600" size={32} />
                          </div>
                          <h3 className="text-white font-bold mb-1">No Messages Yet</h3>
                          <p className="text-slate-500 text-sm">
                            Direct line is open.
                          </p>
                        </div>
                      ) : (
                        messages.map((msg) => {
                          const isMe = msg.senderId === user.id;
                          const isDispatch = msg.role === UserRole.MERCHANT;
                          
                          return (
                            <div 
                              key={msg.id} 
                              className={`flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'} animate-in slide-in-from-bottom-2 duration-300`}
                            >
                              {!isMe && (
                                <img 
                                  src={msg.senderAvatar || (isDispatch ? 'https://api.dicebear.com/7.x/bottts/svg?seed=dispatch' : 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + msg.senderId)} 
                                  alt={msg.senderName} 
                                  className="w-8 h-8 rounded-full border border-slate-700 flex-shrink-0 mt-1"
                                />
                              )}
                              <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[80%]`}>
                                <div className="flex items-center gap-2 mb-1 px-1">
                                  {!isMe && (
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                      {msg.senderName}
                                    </span>
                                  )}
                                  {isDispatch && !isMe && (
                                    <span className="bg-blue-600/20 text-blue-400 text-[8px] px-1.5 py-0.5 rounded-sm font-black uppercase tracking-tighter border border-blue-500/30">
                                      Dispatch
                                    </span>
                                  )}
                                  {isMe && (
                                     <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">You</span>
                                  )}
                                </div>
                                <div 
                                  className={`p-3 rounded-2xl text-sm shadow-md leading-relaxed relative ${
                                    isMe 
                                      ? 'bg-blue-600 text-white rounded-tr-none' 
                                      : 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700/50'
                                  }`}
                                >
                                  {msg.text}
                                  <div className={`text-[9px] mt-1.5 font-bold ${isMe ? 'text-blue-100' : 'text-slate-500'} text-right`}>
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {showJumpToBottom && (
                      <button 
                        onClick={jumpToBottom}
                        className="absolute bottom-20 right-4 bg-blue-600 text-white p-2 rounded-full shadow-lg hover:bg-blue-500 animate-in fade-in zoom-in duration-200 z-10"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 112 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}

                    <form 
                      onSubmit={handleSend}
                      className="p-4 bg-slate-900 border-t border-slate-700/50 flex items-center gap-3"
                    >
                      <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-full px-5 py-3 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all placeholder-slate-600"
                      />
                      <button
                        type="submit"
                        disabled={!inputText.trim()}
                        className="w-11 h-11 flex items-center justify-center bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:hover:bg-blue-600 text-white rounded-full transition-all shadow-lg active:scale-90"
                      >
                        <Send size={18} fill="currentColor" />
                      </button>
                    </form>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => {
          setIsOpen(!isOpen);
          setIsMinimized(false);
        }}
        className={`${buttonSize} rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 relative ${
          isOpen ? 'bg-slate-800 text-slate-400 rotate-90' : 'bg-blue-600 text-white'
        }`}
      >
        {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
        {!isOpen && hasUnread && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-slate-950 animate-bounce shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
        )}
      </motion.button>
    </div>
  );
};
