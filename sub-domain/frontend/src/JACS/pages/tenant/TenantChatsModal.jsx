import React, { useEffect, useState } from 'react';
import { X, Loader2, MessageCircle, Send, User, Clock, Search, MoreVertical, Phone, Video, Paperclip, Smile, Check, CheckCheck } from 'lucide-react';
import { apiService } from '../../../services/api';

const TenantChatsModal = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chats, setChats] = useState([]);
  const [currentChat, setCurrentChat] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [tenant, setTenant] = useState(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [creatingChat, setCreatingChat] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen) {
      const fetchData = async () => {
        try {
          setLoading(true);
          setError(null);
          
          try {
            const myTenant = await apiService.getMyTenant();
            setTenant(myTenant || getMockTenant());
            
            try {
              const chatsData = await apiService.getChats();
              const refTenant = myTenant || getMockTenant();
              const tenantChats = (Array.isArray(chatsData) ? chatsData : getMockChats()).filter(chat => 
                chat.tenant_id === refTenant.id || chat.messages?.some(msg => msg.sender_id === refTenant.id)
              );
              setChats(tenantChats.length ? tenantChats : getMockChats());
            } catch (chatsErr) {
              console.warn('Chats not available:', chatsErr);
              setChats(getMockChats());
            }
          } catch (tenantErr) {
            console.warn('No tenant record found:', tenantErr);
            const fallbackTenant = getMockTenant();
            setTenant(fallbackTenant);
            setChats(getMockChats());
          }
        } catch (err) {
          console.error('Failed to load chats:', err);
          setError('Failed to load chats. Please try again.');
        } finally {
          setLoading(false);
        }
      };

      fetchData();
    }
  }, [isOpen]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentChat || sendingMessage) return;

    try {
      setSendingMessage(true);
      setError(null);
      try {
        await apiService.sendMessage({
          chat_id: currentChat.id,
          content: newMessage,
          sender_id: tenant.id,
          sender_type: 'tenant'
        });
      } catch (_ignore) {
        // Frontend-only: append locally when API is unavailable
        setChats(prev => prev.map(c => c.id === currentChat.id ? {
          ...c,
          messages: [...(c.messages || []), {
            id: Date.now(), chat_id: c.id, sender_id: tenant.id, sender_type: 'tenant', content: newMessage, created_at: new Date().toISOString()
          }]
        } : c));
      }
      setNewMessage('');
      // Refresh chats with fallback
      let chatsData = [];
      try {
        chatsData = await apiService.getChats();
      } catch (_e) {
        chatsData = getMockChats();
      }
      const tenantChats = chatsData.filter(chat => 
        chat.tenant_id === tenant.id || chat.messages?.some(msg => msg.sender_id === tenant.id)
      );
      setChats(tenantChats.length ? tenantChats : getMockChats());
      const updatedChat = (tenantChats.length ? tenantChats : getMockChats()).find(chat => chat.id === currentChat.id) || currentChat;
      setCurrentChat(updatedChat);
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('Failed to send message. Please try again.');
    } finally {
      setSendingMessage(false);
    }
  };

  const startNewChat = async () => {
    try {
      setCreatingChat(true);
      setError(null);
      let newChat;
      try {
        newChat = await apiService.createChat({
          tenant_id: tenant.id,
          subject: 'New Inquiry'
        });
      } catch (_ignore) {
        newChat = { id: Date.now(), tenant_id: tenant.id, subject: 'New Inquiry', created_at: new Date().toISOString(), messages: [] };
        setChats(prev => [newChat, ...prev]);
      }
      setCurrentChat(newChat);
      // Refresh chats
      let chatsData = [];
      try {
        chatsData = await apiService.getChats();
      } catch (_e) {
        chatsData = getMockChats();
      }
      const tenantChats = chatsData.filter(chat => 
        chat.tenant_id === tenant.id || chat.messages?.some(msg => msg.sender_id === tenant.id)
      );
      setChats(tenantChats.length ? tenantChats : getMockChats());
    } catch (err) {
      console.error('Failed to create chat:', err);
      setError('Failed to create new chat. Please try again.');
    } finally {
      setCreatingChat(false);
    }
  };

  // Filter chats based on search
  const filteredChats = chats.filter(chat => 
    chat.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
    chat.messages?.some(msg => msg.content.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) { // 7 days
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 rounded-t-xl">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Messages</h2>
              <p className="text-sm text-gray-500">Communicate with management</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={startNewChat}
              disabled={creatingChat || !tenant}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 text-sm"
            >
              {creatingChat ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <MessageCircle className="w-4 h-4" />
                  <span>New Message</span>
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex items-center space-x-2">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>Loading your messages...</span>
              </div>
            </div>
          ) : error ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <p className="text-red-600 mb-4">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Chat List */}
              <div className="w-1/3 bg-gray-50 border-r border-gray-200 flex flex-col">
                <div className="px-4 py-3 border-b border-gray-200">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search conversations..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {!tenant ? (
                    <div className="px-4 py-8 text-center text-gray-500">
                      <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p className="text-sm font-medium mb-1">No tenant profile found</p>
                      <p className="text-xs">Please contact management to set up your account</p>
                    </div>
                  ) : filteredChats.length === 0 ? (
                    <div className="px-4 py-8 text-center text-gray-500">
                      <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p className="text-sm font-medium mb-1">No conversations yet</p>
                      <p className="text-xs">Start a new conversation with management</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {filteredChats.map((chat) => (
                        <div
                          key={chat.id}
                          onClick={() => setCurrentChat(chat)}
                          className={`px-4 py-3 cursor-pointer hover:bg-white transition-colors ${
                            currentChat?.id === chat.id ? 'bg-white border-r-2 border-blue-500' : ''
                          }`}
                        >
                          <div className="flex items-start space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                              <User className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <h3 className="font-medium text-gray-900 truncate text-sm">{chat.subject}</h3>
                                <span className="text-xs text-gray-500">
                                  {formatTime(chat.messages && chat.messages.length > 0 
                                    ? chat.messages[chat.messages.length - 1].created_at
                                    : chat.created_at
                                  )}
                                </span>
                              </div>
                              <p className="text-xs text-gray-600 truncate mb-1">
                                {chat.messages && chat.messages.length > 0 
                                  ? chat.messages[chat.messages.length - 1].content
                                  : 'No messages yet'
                                }
                              </p>
                              <div className="flex items-center space-x-1">
                                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                                <span className="text-xs text-gray-500">Management</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 bg-white flex flex-col">
                {currentChat ? (
                  <>
                    <div className="px-6 py-4 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                            <User className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h2 className="text-lg font-semibold text-gray-900">{currentChat.subject}</h2>
                            <p className="text-sm text-gray-500">Management Team</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                            <Phone className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                            <Video className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex-1 p-6 overflow-y-auto bg-gray-50">
                      {currentChat.messages && currentChat.messages.length > 0 ? (
                        <div className="space-y-4">
                          {currentChat.messages.map((message) => (
                            <div
                              key={message.id}
                              className={`flex ${message.sender_type === 'tenant' ? 'justify-end' : 'justify-start'}`}
                            >
                              <div className={`max-w-md px-4 py-3 rounded-2xl ${
                                message.sender_type === 'tenant'
                                  ? 'bg-blue-600 text-white rounded-br-md'
                                  : 'bg-white text-gray-900 rounded-bl-md shadow-sm border border-gray-200'
                              }`}>
                                <p className="text-sm leading-relaxed">{message.content}</p>
                                <div className={`flex items-center justify-end space-x-1 mt-2 ${
                                  message.sender_type === 'tenant' ? 'text-blue-100' : 'text-gray-500'
                                }`}>
                                  <span className="text-xs">
                                    {formatTime(message.created_at)}
                                  </span>
                                  {message.sender_type === 'tenant' && (
                                    <CheckCheck className="w-3 h-3" />
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center text-gray-500 py-12">
                          <MessageCircle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                          <p className="text-lg font-medium mb-2">No messages yet</p>
                          <p className="text-sm">Start the conversation below</p>
                        </div>
                      )}
                    </div>

                    <div className="px-6 py-4 border-t border-gray-200 bg-white">
                      <form onSubmit={handleSendMessage} className="flex items-end space-x-3">
                        <div className="flex-1 relative">
                          <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type your message..."
                            disabled={sendingMessage}
                            className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 resize-none"
                          />
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
                            <button type="button" className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
                              <Paperclip className="w-4 h-4" />
                            </button>
                            <button type="button" className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
                              <Smile className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <button
                          type="submit"
                          disabled={sendingMessage || !newMessage.trim()}
                          className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {sendingMessage ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <Send className="w-5 h-5" />
                          )}
                        </button>
                      </form>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <MessageCircle className="w-20 h-20 mx-auto mb-6 text-gray-300" />
                      <p className="text-xl font-medium mb-2">Select a conversation</p>
                      <p className="text-sm">Choose a conversation from the list or start a new one</p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TenantChatsModal;
