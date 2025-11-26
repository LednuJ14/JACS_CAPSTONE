import React, { useEffect, useState } from 'react';
import { X, Search, Plus, Send, MessageSquare, Users, Phone, Video, MoreVertical, CheckCheck, Clock, User } from 'lucide-react';

// UI-only Staff Chats Modal (no backend dependency)
const StaffChatsModal = ({ isOpen, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    // Provide a safe default list for UI preview
    const list = getStaffContacts();
    setContacts(Array.isArray(list) && list.length ? list : [{ id: 1, name: 'Property Manager', email: 'pm@example.com' }]);
  }, [isOpen]);

  const filteredContacts = contacts.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const loadContacts = async () => {
    setLoading(true);
    // Simulate delay and refresh contact list from mocks
    setTimeout(() => {
      const list = getStaffContacts();
      setContacts(Array.isArray(list) && list.length ? list : contacts);
      setLoading(false);
    }, 500);
  };

  const handleContactSelect = (contact) => {
    setSelectedContact(contact);
    // Mock first message
    setMessages([
      {
        id: 1,
        content: 'Hi! How can I assist you today?',
        sender_type: 'contact',
        created_at: new Date().toISOString(),
      },
    ]);
  };

  const handleSend = () => {
    if (!messageText.trim()) return;
    const newMsg = {
      id: Date.now(),
      content: messageText,
      sender_type: 'user',
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, newMsg]);
    setMessageText('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 rounded-t-xl">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Staff Messages</h2>
              <p className="text-sm text-gray-500">Chat with manager</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Contacts */}
          <div className="w-72 bg-gray-50 border-r flex flex-col">
            <div className="px-4 py-3 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="px-4 py-3 border-b">
              <button
                onClick={loadContacts}
                disabled={loading}
                className="w-full bg-blue-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin" /> Loading...
                  </>
                ) : (
                  <>
                    <Users className="w-4 h-4" /> Load Contacts
                  </>
                )}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto divide-y">
              {filteredContacts.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500">
                  <MessageSquare className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">No contacts</p>
                </div>
              ) : (
                filteredContacts.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => handleContactSelect(c)}
                    className={`px-4 py-3 cursor-pointer hover:bg-white ${selectedContact?.id === c.id ? 'bg-white' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                        <User className="w-4 h-4 text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                        <p className="text-xs text-gray-500 truncate">{c.email}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Chat Area */}
          <div className="flex-1 bg-white flex flex-col">
            {selectedContact ? (
              <>
                <div className="px-6 py-4 border-b flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{selectedContact.name}</h3>
                      <p className="text-xs text-gray-500">Online</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><Phone className="w-4 h-4" /></button>
                    <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><Video className="w-4 h-4" /></button>
                    <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><MoreVertical className="w-4 h-4" /></button>
                  </div>
                </div>

                <div className="flex-1 p-6 overflow-y-auto bg-gray-50">
                  {messages.length === 0 ? (
                    <div className="text-center text-gray-500 py-12">
                      <MessageSquare className="w-14 h-14 mx-auto mb-4 text-gray-300" />
                      <p className="text-sm">No messages yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {messages.map((m) => {
                        const isOutgoing = m.sender_type === 'user';
                        const time = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        return (
                          <div key={m.id} className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-md px-4 py-3 rounded-2xl ${isOutgoing ? 'bg-blue-600 text-white rounded-br-md' : 'bg-white text-gray-900 rounded-bl-md shadow border border-gray-200'}`}>
                              <p className="text-sm">{m.content}</p>
                              <div className={`mt-2 flex items-center gap-1 justify-end ${isOutgoing ? 'text-blue-100' : 'text-gray-500'}`}>
                                <span className="text-xs">{time}</span>
                                {isOutgoing && <CheckCheck className="w-3 h-3" />}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="px-6 py-4 border-t bg-white">
                  <div className="flex items-end gap-3">
                    <div className="flex-1 relative">
                      <input
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Type your message..."
                        className="w-full px-4 py-3 pr-12 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <button className="p-1 text-gray-400 hover:text-gray-600"><Plus className="w-4 h-4" /></button>
                      </div>
                    </div>
                    <button onClick={handleSend} disabled={!messageText.trim()} className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 disabled:opacity-50">
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-medium text-gray-900 mb-1">Select a conversation</h3>
                  <p className="text-sm text-gray-500">Choose a contact to start messaging</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffChatsModal;


