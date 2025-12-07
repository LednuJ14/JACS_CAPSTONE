import React, { useState, useEffect } from 'react';
import { X, Search, Send, MessageSquare, MoreVertical, CheckCheck, User, Loader2 } from 'lucide-react';
import { apiService } from '../../../services/api';

const ChatsModal = ({ isOpen, onClose }) => {
  const [chats, setChats] = useState([]);
  const [currentChat, setCurrentChat] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      const fetchChats = async () => {
        try {
          setLoading(true);
          setError(null);
          const chatsData = await apiService.getChats();
          // Handle both array response and object with chats property
          const chatsList = Array.isArray(chatsData) 
            ? chatsData 
            : (chatsData?.chats || []);
          setChats(chatsList);
        } catch (err) {
          console.error('Failed to load chats:', err);
          setError('Failed to load chats. Please try again.');
        } finally {
          setLoading(false);
        }
      };
      fetchChats();
    }
  }, [isOpen]);

  // Load messages when a chat is selected
  useEffect(() => {
    if (currentChat && currentChat.id) {
      const loadMessages = async () => {
        try {
          const chatData = await apiService.getChat(currentChat.id);
          if (chatData) {
            // Ensure messages array exists
            if (!chatData.messages) {
              chatData.messages = [];
            }
            console.log('Loaded chat data:', { 
              id: chatData.id, 
              messagesCount: chatData.messages?.length || 0,
              messages: chatData.messages 
            });
            setCurrentChat(chatData);
            // Update chat in chats list
            setChats(prev => prev.map(c => c.id === chatData.id ? chatData : c));
          }
        } catch (err) {
          console.error('Failed to load messages:', err);
        }
      };
      loadMessages();
    }
  }, [currentChat?.id]);

  const filteredChats = chats.filter(chat =>
    chat.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.tenant?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleChatSelect = (chat) => {
    setCurrentChat(chat);
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!messageText.trim() || !currentChat || sendingMessage) return;

    try {
      setSendingMessage(true);
      setError(null);
      
      await apiService.sendMessage({
        chat_id: currentChat.id,
        content: messageText
      });
      
      setMessageText('');
      
      // Reload chat with messages
      const updatedChat = await apiService.getChat(currentChat.id);
      // Ensure messages array exists
      if (!updatedChat.messages) {
        updatedChat.messages = [];
      }
      setCurrentChat(updatedChat);
      
      // Refresh chats list
      const chatsData = await apiService.getChats();
      // Handle both array response and object with chats property
      const chatsList = Array.isArray(chatsData) 
        ? chatsData 
        : (chatsData?.chats || []);
      setChats(chatsList);
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('Failed to send message. Please try again.');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
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
              <MessageSquare className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Messages</h2>
              <p className="text-sm text-gray-500">Communicate with tenants</p>
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
                <span>Loading conversations...</span>
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
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {filteredChats.length === 0 ? (
                    <div className="px-4 py-8 text-center text-gray-500">
                      <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p className="text-sm font-medium mb-1">No conversations yet</p>
                      <p className="text-xs">Tenants can start conversations with you</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {filteredChats.map((chat) => (
                        <div
                          key={chat.id}
                          onClick={() => handleChatSelect(chat)}
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
                                <h3 className="font-medium text-gray-900 truncate text-sm">
                                  {chat.tenant?.name || chat.tenant?.user?.first_name + ' ' + chat.tenant?.user?.last_name || chat.subject || 'Tenant'}
                                </h3>
                                {chat.unread_count > 0 && (
                                  <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                    {chat.unread_count}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-600 truncate mb-1">
                                {chat.last_message?.content || (chat.messages && chat.messages.length > 0
                                  ? chat.messages[chat.messages.length - 1].content
                                  : 'No messages yet')}
                              </p>
                              <span className="text-xs text-gray-500">
                                {formatTime(chat.last_message_at || chat.created_at)}
                              </span>
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
                            <h2 className="text-lg font-semibold text-gray-900">
                              {currentChat.tenant?.name || 
                               (currentChat.tenant?.user?.first_name && currentChat.tenant?.user?.last_name 
                                ? `${currentChat.tenant.user.first_name} ${currentChat.tenant.user.last_name}`.trim()
                                : currentChat.tenant?.user?.email?.split('@')[0] || currentChat.subject || 'Tenant')}
                            </h2>
                            <p className="text-sm text-gray-500">Tenant Conversation</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
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
                              className={`flex ${message.sender_type === 'property_manager' ? 'justify-end' : 'justify-start'}`}
                            >
                              <div className={`max-w-md px-4 py-3 rounded-2xl ${
                                message.sender_type === 'property_manager'
                                  ? 'bg-blue-600 text-white rounded-br-md'
                                  : 'bg-white text-gray-900 rounded-bl-md shadow-sm border border-gray-200'
                              }`}>
                                <p className="text-sm leading-relaxed">{message.content}</p>
                                <div className={`flex items-center justify-end space-x-1 mt-2 ${
                                  message.sender_type === 'property_manager' ? 'text-blue-100' : 'text-gray-500'
                                }`}>
                                  <span className="text-xs">
                                    {formatTime(message.created_at)}
                                  </span>
                                  {message.sender_type === 'property_manager' && (
                                    <CheckCheck className="w-3 h-3" />
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center text-gray-500 py-12">
                          <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
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
                            value={messageText}
                            onChange={(e) => setMessageText(e.target.value)}
                            placeholder="Type your message..."
                            disabled={sendingMessage}
                            onKeyPress={handleKeyPress}
                            className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 resize-none"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={sendingMessage || !messageText.trim()}
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
                      <MessageSquare className="w-20 h-20 mx-auto mb-6 text-gray-300" />
                      <p className="text-xl font-medium mb-2">Select a conversation</p>
                      <p className="text-sm">Choose a conversation from the list</p>
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

export default ChatsModal;
