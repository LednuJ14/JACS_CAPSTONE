import React, { useState } from 'react';
import { X, HelpCircle, MessageSquare, Phone, Mail, FileText, Search, ChevronDown, ChevronRight, ExternalLink, Clock, MapPin, Users, CreditCard, Home, Wrench, Bell, AlertTriangle, CheckCircle, Info } from 'lucide-react';

const TenantHelpModal = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('faq');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [contactForm, setContactForm] = useState({
    subject: '',
    category: '',
    priority: 'medium',
    message: '',
    contactMethod: 'email'
  });

  const faqCategories = {
    'billing': {
      title: 'Billing & Payments',
      icon: CreditCard,
      questions: [
        {
          question: 'How do I pay my rent online?',
          answer: 'You can pay your rent through the Bills section in your dashboard. Click on "View Bills" and select the payment method you prefer. We accept credit cards, bank transfers, and digital wallets.'
        },
        {
          question: 'When is my rent due?',
          answer: 'Your rent is typically due on the 1st of each month. You can check your specific due date in the Bills section. Late fees may apply after the grace period.'
        },
        {
          question: 'Can I set up automatic payments?',
          answer: 'Yes! You can set up automatic payments in your account settings. This ensures your rent is paid on time every month without manual intervention.'
        },
        {
          question: 'What payment methods are accepted?',
          answer: 'We accept major credit cards (Visa, MasterCard, American Express), bank transfers, GCash, PayMaya, and other digital payment methods available in the Philippines.'
        }
      ]
    },
    'maintenance': {
      title: 'Maintenance & Repairs',
      icon: Wrench,
      questions: [
        {
          question: 'How do I submit a maintenance request?',
          answer: 'Go to the "My Requests" section and click "New Request". Fill out the form with details about the issue, select the appropriate category, and submit. You\'ll receive updates on the status.'
        },
        {
          question: 'What constitutes an emergency maintenance request?',
          answer: 'Emergency requests include: no water, no electricity, gas leaks, broken locks, flooding, or any issue that poses a safety risk. Call our emergency line immediately for these issues.'
        },
        {
          question: 'How long does it take to resolve maintenance requests?',
          answer: 'Non-emergency requests are typically addressed within 24-48 hours. Emergency requests are handled immediately. You can track the progress in your requests dashboard.'
        },
        {
          question: 'Can I request maintenance for my appliances?',
          answer: 'Yes, you can request maintenance for provided appliances. However, personal appliances are your responsibility unless they\'re part of the rental agreement.'
        }
      ]
    },
    'account': {
      title: 'Account & Profile',
      icon: Users,
      questions: [
        {
          question: 'How do I update my personal information?',
          answer: 'Click on your profile dropdown and select "Edit Profile". You can update your contact information, emergency contacts, and notification preferences.'
        },
        {
          question: 'How do I change my password?',
          answer: 'Go to Settings > Security and click "Change Password". You\'ll need to enter your current password and create a new one that meets our security requirements.'
        },
        {
          question: 'Can I access my account from multiple devices?',
          answer: 'Yes, you can access your tenant portal from any device with internet access. Your data is securely synced across all devices.'
        },
        {
          question: 'What should I do if I forget my password?',
          answer: 'Click "Forgot Password" on the login page and enter your email address. You\'ll receive a password reset link within a few minutes.'
        }
      ]
    },
    'announcements': {
      title: 'Announcements & Communication',
      icon: Bell,
      questions: [
        {
          question: 'How do I stay updated with property announcements?',
          answer: 'Check the Announcements section regularly. You can also enable notifications in your settings to receive alerts for new announcements.'
        },
        {
          question: 'How do I contact property management?',
          answer: 'Use the Chats section to send messages directly to management. For urgent matters, call our office during business hours or use the emergency contact number.'
        },
        {
          question: 'Can I communicate with other tenants?',
          answer: 'Yes, you can use the community chat feature to communicate with other tenants about community events, shared spaces, or general discussions.'
        },
        {
          question: 'How do I report noise complaints?',
          answer: 'You can submit a complaint through the Chats section or call our office. Please provide specific details about the time, location, and nature of the disturbance.'
        }
      ]
    }
  };

  const contactMethods = [
    {
      type: 'phone',
      title: 'Phone Support',
      description: 'Call us for immediate assistance',
      contact: '+63 32 123 4567',
      hours: 'Mon-Fri: 8:00 AM - 6:00 PM',
      icon: Phone,
      color: 'bg-green-100 text-green-600'
    },
    {
      type: 'email',
      title: 'Email Support',
      description: 'Send us an email for detailed inquiries',
      contact: 'support@jacs.com',
      hours: 'Response within 24 hours',
      icon: Mail,
      color: 'bg-blue-100 text-blue-600'
    },
    {
      type: 'chat',
      title: 'Live Chat',
      description: 'Chat with our support team',
      contact: 'Available in dashboard',
      hours: 'Mon-Fri: 9:00 AM - 5:00 PM',
      icon: MessageSquare,
      color: 'bg-purple-100 text-purple-600'
    },
    {
      type: 'emergency',
      title: 'Emergency Line',
      description: 'For urgent maintenance issues',
      contact: '+63 32 911 0000',
      hours: '24/7 Emergency Service',
      icon: AlertTriangle,
      color: 'bg-red-100 text-red-600'
    }
  ];

  const handleFaqToggle = (index) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  const handleContactFormChange = (field, value) => {
    setContactForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleContactSubmit = (e) => {
    e.preventDefault();
    // TODO: Implement contact form submission
    console.log('Contact form submitted:', contactForm);
    alert('Your message has been sent! We\'ll get back to you soon.');
    setContactForm({
      subject: '',
      category: '',
      priority: 'medium',
      message: '',
      contactMethod: 'email'
    });
  };

  const filteredFaqs = Object.entries(faqCategories).reduce((acc, [categoryKey, category]) => {
    const filteredQuestions = category.questions.filter(q => 
      q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.answer.toLowerCase().includes(searchQuery.toLowerCase())
    );
    if (filteredQuestions.length > 0) {
      acc[categoryKey] = { ...category, questions: filteredQuestions };
    }
    return acc;
  }, {});

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <HelpCircle className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Help & Support</h2>
                <p className="text-sm text-gray-500">Get help with your tenant account and property services</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 bg-white">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'faq', name: 'FAQ', icon: FileText },
              { id: 'contact', name: 'Contact Us', icon: MessageSquare },
              { id: 'resources', name: 'Resources', icon: ExternalLink },
              { id: 'emergency', name: 'Emergency', icon: AlertTriangle }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* FAQ Tab */}
          {activeTab === 'faq' && (
            <div className="space-y-6">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search FAQ..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* FAQ Categories */}
              <div className="space-y-6">
                {Object.entries(filteredFaqs).map(([categoryKey, category]) => {
                  const Icon = category.icon;
                  return (
                    <div key={categoryKey} className="bg-gray-50 rounded-xl p-6">
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Icon className="w-4 h-4 text-blue-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">{category.title}</h3>
                      </div>
                      <div className="space-y-3">
                        {category.questions.map((faq, index) => (
                          <div key={index} className="bg-white rounded-lg border border-gray-200">
                            <button
                              onClick={() => handleFaqToggle(`${categoryKey}-${index}`)}
                              className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
                            >
                              <span className="font-medium text-gray-900">{faq.question}</span>
                              {expandedFaq === `${categoryKey}-${index}` ? (
                                <ChevronDown className="w-5 h-5 text-gray-400" />
                              ) : (
                                <ChevronRight className="w-5 h-5 text-gray-400" />
                              )}
                            </button>
                            {expandedFaq === `${categoryKey}-${index}` && (
                              <div className="px-4 pb-4">
                                <p className="text-gray-600 leading-relaxed">{faq.answer}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Contact Tab */}
          {activeTab === 'contact' && (
            <div className="space-y-8">
              {/* Contact Methods */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Methods</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {contactMethods.map((method, index) => {
                    const Icon = method.icon;
                    return (
                      <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex items-start space-x-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${method.color}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{method.title}</h4>
                            <p className="text-sm text-gray-600 mb-2">{method.description}</p>
                            <p className="text-sm font-medium text-gray-900">{method.contact}</p>
                            <p className="text-xs text-gray-500">{method.hours}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Contact Form */}
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Send us a Message</h3>
                <form onSubmit={handleContactSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Subject
                      </label>
                      <input
                        type="text"
                        value={contactForm.subject}
                        onChange={(e) => handleContactFormChange('subject', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Brief description of your inquiry"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Category
                      </label>
                      <select
                        value={contactForm.category}
                        onChange={(e) => handleContactFormChange('category', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      >
                        <option value="">Select a category</option>
                        <option value="billing">Billing & Payments</option>
                        <option value="maintenance">Maintenance & Repairs</option>
                        <option value="account">Account Issues</option>
                        <option value="general">General Inquiry</option>
                        <option value="complaint">Complaint</option>
                        <option value="suggestion">Suggestion</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Priority
                      </label>
                      <select
                        value={contactForm.priority}
                        onChange={(e) => handleContactFormChange('priority', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Preferred Contact Method
                      </label>
                      <select
                        value={contactForm.contactMethod}
                        onChange={(e) => handleContactFormChange('contactMethod', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="email">Email</option>
                        <option value="phone">Phone</option>
                        <option value="chat">Live Chat</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Message
                    </label>
                    <textarea
                      value={contactForm.message}
                      onChange={(e) => handleContactFormChange('message', e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Please provide detailed information about your inquiry..."
                      required
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                    >
                      <Mail className="w-4 h-4" />
                      <span>Send Message</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Resources Tab */}
          {activeTab === 'resources' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
                  <div className="flex items-center space-x-3 mb-4">
                    <FileText className="w-6 h-6 text-blue-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Tenant Handbook</h3>
                  </div>
                  <p className="text-gray-600 mb-4">Complete guide to living in our property, including rules, policies, and procedures.</p>
                  <button className="text-blue-600 hover:text-blue-700 font-medium flex items-center space-x-2">
                    <span>Download PDF</span>
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>

                <div className="bg-green-50 rounded-xl p-6 border border-green-200">
                  <div className="flex items-center space-x-3 mb-4">
                    <Home className="w-6 h-6 text-green-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Property Rules</h3>
                  </div>
                  <p className="text-gray-600 mb-4">Important rules and regulations for all tenants to ensure a pleasant living environment.</p>
                  <button className="text-green-600 hover:text-green-700 font-medium flex items-center space-x-2">
                    <span>View Rules</span>
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>

                <div className="bg-purple-50 rounded-xl p-6 border border-purple-200">
                  <div className="flex items-center space-x-3 mb-4">
                    <CreditCard className="w-6 h-6 text-purple-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Payment Guide</h3>
                  </div>
                  <p className="text-gray-600 mb-4">Step-by-step guide on how to make payments and manage your billing account.</p>
                  <button className="text-purple-600 hover:text-purple-700 font-medium flex items-center space-x-2">
                    <span>View Guide</span>
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>

                <div className="bg-orange-50 rounded-xl p-6 border border-orange-200">
                  <div className="flex items-center space-x-3 mb-4">
                    <Wrench className="w-6 h-6 text-orange-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Maintenance Guide</h3>
                  </div>
                  <p className="text-gray-600 mb-4">Learn how to submit maintenance requests and what to expect during the process.</p>
                  <button className="text-orange-600 hover:text-orange-700 font-medium flex items-center space-x-2">
                    <span>View Guide</span>
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Emergency Tab */}
          {activeTab === 'emergency' && (
            <div className="space-y-6">
              <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                  <h3 className="text-lg font-semibold text-red-900">Emergency Contacts</h3>
                </div>
                <p className="text-red-700 mb-4">For immediate assistance with emergency situations, contact:</p>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-red-200">
                    <div>
                      <p className="font-medium text-gray-900">Emergency Maintenance</p>
                      <p className="text-sm text-gray-600">24/7 Emergency Service</p>
                    </div>
                    <a href="tel:+63329110000" className="text-red-600 font-bold text-lg">+63 32 911 0000</a>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-red-200">
                    <div>
                      <p className="font-medium text-gray-900">Fire Department</p>
                      <p className="text-sm text-gray-600">Emergency Fire Response</p>
                    </div>
                    <a href="tel:911" className="text-red-600 font-bold text-lg">911</a>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-red-200">
                    <div>
                      <p className="font-medium text-gray-900">Police</p>
                      <p className="text-sm text-gray-600">Emergency Police Response</p>
                    </div>
                    <a href="tel:911" className="text-red-600 font-bold text-lg">911</a>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <Info className="w-6 h-6 text-yellow-600" />
                  <h3 className="text-lg font-semibold text-yellow-900">What Constitutes an Emergency?</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Immediate Emergency (Call 911):</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• Fire or smoke</li>
                      <li>• Gas leaks</li>
                      <li>• Medical emergencies</li>
                      <li>• Break-ins or security threats</li>
                      <li>• Flooding or water damage</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Property Emergency (Call Maintenance):</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• No electricity</li>
                      <li>• No water</li>
                      <li>• Broken locks</li>
                      <li>• Heating/cooling failure</li>
                      <li>• Plumbing emergencies</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 rounded-b-xl">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-500">
              Need immediate help? Call our emergency line: <span className="font-medium text-gray-900">+63 32 911 0000</span>
            </div>
            <button
              onClick={onClose}
              className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TenantHelpModal;
