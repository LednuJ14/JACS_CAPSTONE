import React, { useEffect, useState } from 'react';
import { X, Loader2, MessageCircle, Send, User, Clock, Paperclip, Smile, Check, CheckCheck } from 'lucide-react';
import { apiService } from '../../../services/api';

const TenantChatsModal = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chats, setChats] = useState([]);
  const [currentChat, setCurrentChat] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [tenant, setTenant] = useState(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  // Search removed per requirements

  useEffect(() => {
    if (isOpen) {
      const fetchData = async () => {
        try {
          setLoading(true);
          setError(null);
          
          const myTenant = await apiService.getMyTenant();
          if (!myTenant) {
            setError('Tenant profile not found. Please contact management.');
            setLoading(false);
            return;
          }
          
          setTenant(myTenant);
          
          const chatsData = await apiService.getChats();
          const chatsList = Array.isArray(chatsData) ? chatsData : [];
          setChats(chatsList);
          
          // Automatically open/create a conversation
          if (chatsList.length > 0) {
            // If there are existing chats, open the first one (most recent)
            const firstChat = chatsList[0];
            // Ensure messages array exists
            if (!firstChat.messages) {
              firstChat.messages = [];
            }
            setCurrentChat(firstChat);
          } else {
            // If no chats exist, automatically create a new one
            // Backend will automatically use property manager's name as subject
            try {
              const newChat = await apiService.createChat({
                // Subject will be set by backend to property manager's name
              });
              // Ensure messages array exists
              if (!newChat.messages) {
                newChat.messages = [];
              }
              setCurrentChat(newChat);
              // Update chats list to include the new chat
              setChats([newChat]);
            } catch (createErr) {
              console.error('Failed to auto-create chat:', createErr);
              // Don't show error to user, just log it - they can manually create one
              // Create a placeholder chat object so UI doesn't break
              const placeholderChat = {
                id: null,
                subject: 'New Inquiry',
                messages: [],
                created_at: new Date().toISOString()
              };
              setCurrentChat(placeholderChat);
            }
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

  // Load messages when a chat is selected
  useEffect(() => {
    if (currentChat && currentChat.id) {
      const loadMessages = async () => {
        try {
          const chatData = await apiService.getChat(currentChat.id);
          if (chatData) {
            // Ensure messages array exists (even if empty)
            if (!chatData.messages) {
              chatData.messages = [];
            }
            setCurrentChat(chatData);
            // Update chat in chats list
            setChats(prev => prev.map(c => c.id === chatData.id ? chatData : c));
          }
        } catch (err) {
          console.error('Failed to load messages:', err);
          // If loading fails, ensure currentChat still has messages array
          if (currentChat && !currentChat.messages) {
            setCurrentChat({ ...currentChat, messages: [] });
          }
        }
      };
      
      // Only load if chat doesn't already have messages loaded
      if (!currentChat.messages || currentChat.messages.length === 0) {
        loadMessages();
      }
    }
  }, [currentChat?.id]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentChat || sendingMessage) return;

    try {
      setSendingMessage(true);
      setError(null);
      
      await apiService.sendMessage({
        chat_id: currentChat.id,
        content: newMessage
      });
      
      setNewMessage('');
      
      // Reload chat with messages
      const updatedChat = await apiService.getChat(currentChat.id);
      setCurrentChat(updatedChat);
      
      // Refresh chats list
      const chatsData = await apiService.getChats();
      setChats(Array.isArray(chatsData) ? chatsData : []);
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('Failed to send message. Please try again.');
    } finally {
      setSendingMessage(false);
    }
  };

  // Filter chats based on search
  const filteredChats = chats;

  // Force gray placeholder avatars (ignore profile photos)
  const getManagerAvatar = () => null;

  const getManagerName = (chatObj) => {
    return chatObj?.property?.manager?.name || chatObj?.subject || 'Management';
  };

  const getManagerInitials = (chatObj) => {
    const name = getManagerName(chatObj);
    if (!name) return 'PM';
    const parts = name.trim().split(' ');
    const first = parts[0]?.charAt(0) || '';
    const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
    return (first + last).toUpperCase() || 'PM';
  };

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
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Messages</h2>
              <p className="text-sm text-gray-500">Communicate with management</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
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
                            <div className="w-10 h-10 bg-gradient-to-br from-gray-300 to-gray-400 rounded-lg flex items-center justify-center flex-shrink-0 text-white font-semibold">
                              {getManagerInitials(chat)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <h3 className="font-medium text-gray-900 truncate text-sm">{getManagerName(chat)}</h3>
                                <span className="text-xs text-gray-500">
                                  {formatTime(chat.messages && chat.messages.length > 0 
                                    ? chat.messages[chat.messages.length - 1].created_at
                                    : chat.created_at
                                  )}
                                </span>
                              </div>
                              <p className="text-xs text-gray-600 truncate mb-1">
                                {chat.last_message?.content || (chat.messages && chat.messages.length > 0 
                                  ? chat.messages[chat.messages.length - 1].content
                                  : 'No messages yet')
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
                          <div className="w-10 h-10 bg-gradient-to-br from-gray-300 to-gray-400 rounded-lg flex items-center justify-center text-white font-semibold">
                            {getManagerInitials(currentChat)}
                          </div>
                          <div>
                            <h2 className="text-lg font-semibold text-gray-900">{getManagerName(currentChat)}</h2>
                            <p className="text-sm text-gray-500">Management Team</p>
                          </div>
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
