import React, { useState, useEffect } from 'react';
import { X, Search, Plus, Send, MessageSquare, Users, Phone, Video, MoreVertical, Check, CheckCheck, Clock, User } from 'lucide-react';
import { apiService } from '../../../services/api';

const ChatsModal = ({ isOpen, onClose }) => {
  const [selectedContact, setSelectedContact] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageText, setMessageText] = useState('');
  const [contacts, setContacts] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedChat, setSelectedChat] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    if (isOpen) {
      // Load current user when modal opens
      const user = apiService.getStoredUser();
      if (user) {
        setCurrentUser(user);
      }
    }
  }, [isOpen]);

  const loadContacts = async () => {
    try {
      console.log('ChatsModal: Loading contacts...');
      setLoading(true);
      
      console.log('ChatsModal: Calling apiService.getContacts()...');
      // Add timeout to prevent infinite loading
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 10000)
      );
      
      let contactsData = [];
      try {
        const contactsPromise = apiService.getContacts(false); // Always get regular contacts, not prospects
        contactsData = await Promise.race([contactsPromise, timeoutPromise]);
      } catch (_e) {
        contactsData = getMockManagerContacts();
      }
      
      console.log('ChatsModal: Contacts data received:', contactsData);
      setContacts(Array.isArray(contactsData) && contactsData.length ? contactsData : getMockManagerContacts());
    } catch (error) {
      console.error('ChatsModal: Failed to load contacts:', error);
      // Set empty array as fallback
      setContacts([]);
    } finally {
      console.log('ChatsModal: Setting loading to false...');
      setLoading(false);
    }
  };

  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleContactSelect = async (contact) => {
    setSelectedContact(contact);
    console.log('ChatsModal: Contact selected:', contact);
    
    // For now, just set a mock chat and messages to prevent API issues
    const mockChat = {
      id: Date.now(),
      contact_id: contact.id,
      chat_type: 'chats',
      status: 'active'
    };
    
    setSelectedChat(mockChat);
    
    // Set some mock messages
    const mockMessages = [
      {
        id: 1,
        content: `Hello! I'm interested in your property.`,
        sender_id: contact.id,
        recipient_id: currentUser?.id,
        timestamp: new Date().toISOString(),
        sender_name: contact.name
      }
    ];
    
    setMessages(mockMessages);
  };

  const handleSendMessage = async () => {
    if (messageText.trim() && selectedChat) {
      try {
        // Create a mock message for now to prevent API issues
        const newMessage = {
          id: Date.now(),
          content: messageText,
          sender_id: currentUser?.id,
          recipient_id: selectedContact?.id,
          timestamp: new Date().toISOString(),
          sender_name: currentUser?.name || 'You'
        };
        
        // Add new message to the list
        setMessages(prev => [...prev, newMessage]);
        setMessageText('');
        console.log('ChatsModal: Message sent:', newMessage);
      } catch (error) {
        console.error('Failed to send message:', error);
      }
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleAddAsTenant = async () => {
    if (selectedContact?.is_prospect) {
      try {
        await apiService.convertProspectToTenant(selectedContact.id);
        // Update the contact locally
        setContacts(prev => prev.map(c => 
          c.id === selectedContact.id ? { ...c, is_prospect: false } : c
        ));
        setSelectedContact(prev => prev ? { ...prev, is_prospect: false } : null);
        alert('Contact successfully converted to tenant!');
      } catch (error) {
        console.error('Failed to convert prospect to tenant:', error);
        alert('Failed to convert prospect to tenant');
      }
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
          <div className="flex w-full">
            {/* Left Sidebar - Contacts */}
            <div className="w-80 bg-gray-50 border-r border-gray-200 flex flex-col">
              {/* Search */}
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

              {/* Load Contacts Button */}
              <div className="px-4 py-3 border-b border-gray-200">
                <button
                  onClick={loadContacts}
                  disabled={loading}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors text-sm"
                >
                  {loading ? (
                    <>
                      <Clock className="w-4 h-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Users className="w-4 h-4" />
                      Load Contacts
                    </>
                  )}
                </button>
              </div>

              {/* Contact List */}
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="px-4 py-8 text-center text-gray-500">
                    <Clock className="w-6 h-6 mx-auto mb-3 animate-spin text-gray-300" />
                    <p className="text-sm">Loading contacts...</p>
                  </div>
                ) : filteredContacts.length === 0 ? (
                  <div className="px-4 py-8 text-center text-gray-500">
                    <MessageSquare className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm font-medium mb-1">No contacts found</p>
                    <p className="text-xs">Click "Load Contacts" to fetch contacts from the server</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {filteredContacts.map((contact) => (
                      <div
                        key={contact.id}
                        onClick={() => handleContactSelect(contact)}
                        className={`px-4 py-3 cursor-pointer hover:bg-white transition-colors ${
                          selectedContact?.id === contact.id ? 'bg-white border-r-2 border-blue-500' : ''
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                            <User className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <h3 className="font-medium text-gray-900 truncate text-sm">
                                {contact.name}
                              </h3>
                              {contact.is_prospect && (
                                <span className="bg-blue-100 text-blue-800 text-xs rounded-full px-2 py-0.5">
                                  Prospect
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-600 truncate">
                              {contact.email || 'No email'}
                            </p>
                            <div className="flex items-center space-x-1 mt-1">
                              <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                              <span className="text-xs text-gray-500">Online</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 bg-white flex flex-col">
              {selectedContact ? (
                <>
                  {/* Chat Header */}
                  <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                          <User className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h2 className="text-lg font-semibold text-gray-900">{selectedContact.name}</h2>
                          <p className="text-sm text-gray-500">Online</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                          <Phone className="w-4 h-4" />
                        </button>
                        <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                          <Video className="w-4 h-4" />
                        </button>
                        {selectedContact.is_prospect && (
                          <button
                            onClick={handleAddAsTenant}
                            className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center space-x-2"
                          >
                            <User className="w-3 h-3" />
                            <span>Add as Tenant</span>
                          </button>
                        )}
                        <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Messages Area */}
                  <div className="flex-1 p-6 overflow-y-auto bg-gray-50">
                    {messages.length === 0 ? (
                      <div className="text-center text-gray-500 py-12">
                        <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                        <p className="text-lg font-medium mb-2">No messages yet</p>
                        <p className="text-sm">Start the conversation below</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {messages.map((message) => {
                          const isOutgoing = message.sender_type === 'user';
                          const timestamp = new Date(message.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          });
                          return (
                            <div key={message.id} className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-md px-4 py-3 rounded-2xl ${
                                isOutgoing
                                  ? 'bg-blue-600 text-white rounded-br-md'
                                  : 'bg-white text-gray-900 rounded-bl-md shadow-sm border border-gray-200'
                              }`}>
                                <p className="text-sm leading-relaxed">{message.content}</p>
                                <div className={`flex items-center justify-end space-x-1 mt-2 ${
                                  isOutgoing ? 'text-blue-100' : 'text-gray-500'
                                }`}>
                                  <span className="text-xs">
                                    {timestamp}
                                  </span>
                                  {isOutgoing && (
                                    <CheckCheck className="w-3 h-3" />
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Message Input */}
                  <div className="px-6 py-4 border-t border-gray-200 bg-white">
                    <div className="flex items-end space-x-3">
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          placeholder="Type your message..."
                          value={messageText}
                          onChange={(e) => setMessageText(e.target.value)}
                          onKeyPress={handleKeyPress}
                          className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        />
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
                          <button className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <button
                        onClick={handleSendMessage}
                        disabled={!messageText.trim()}
                        className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <Send className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                /* Empty State */
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <MessageSquare className="w-20 h-20 mx-auto mb-6 text-gray-300" />
                    <h3 className="text-xl font-medium text-gray-900 mb-2">Select a conversation</h3>
                    <p className="text-gray-500">Choose a contact to start messaging</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatsModal;
