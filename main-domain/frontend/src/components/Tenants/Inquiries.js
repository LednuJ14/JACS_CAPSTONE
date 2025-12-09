import React, { useEffect, useMemo, useRef, useState, useCallback, memo } from 'react';
import api from '../../services/api';
import { getImageUrl } from '../../config/api';
import defaultProfile from '../../assets/images/default_profile.png';

/**
 * Inquiries Component - Tenant Chat Interface
 * 
 * Features:
 * - View and manage property inquiries
 * - Send messages to property managers
 * - Upload and view attachments (images, videos, documents)
 * - Real-time chat interface
 * 
 * Props:
 * - onClose: Function to close the modal
 * - initialChat: { id?, managerName, property, unitId, propertyId } - Optional initial chat to open
 */
const Inquiries = ({ onClose, initialChat = null }) => {
  // Core State
  const [chats, setChats] = useState([]);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // File Upload State
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  
  // Attachments State
  const [attachments, setAttachments] = useState({}); // {inquiryId: [attachments]}
  const [mediaUrls, setMediaUrls] = useState({}); // {attachmentId: blobUrl}
  const [lightboxImage, setLightboxImage] = useState(null);
  
  // Refs for cleanup and tracking
  const mountedRef = useRef(true);
  const messageInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const blobUrlCleanupRef = useRef(new Set()); // Track blob URLs for cleanup
  const failedAttachmentsRef = useRef(new Set()); // Track failed attachments
  const loadingAttachmentsRef = useRef(new Set()); // Track loading attachments
  const attachmentPromisesRef = useRef(new Map()); // Track ongoing attachment requests
  const processedInitialChatRef = useRef(null); // Track processed initial chat
  const creatingInquiryRef = useRef(false); // Track if we're currently creating an inquiry
  const chatsRef = useRef([]); // Track latest chats to avoid stale closures
  const pollingIntervalRef = useRef(null);
  const isPollingRef = useRef(false);
  const messagesEndRef = useRef(null);
  const lastAttachmentPollRef = useRef({}); // Track last attachment poll time per inquiry
  const attachmentPollBackoffRef = useRef({}); // Track backoff time for 429 errors per inquiry
  const selectedChatIdRef = useRef(selectedChatId);
  const deduplicatingRef = useRef(false);
  
  // Initialize component
  useEffect(() => {
    mountedRef.current = true;
    processedInitialChatRef.current = null; // Reset on mount
    loadInquiries();
    
    return () => {
      mountedRef.current = false;
      processedInitialChatRef.current = null; // Reset on unmount
      // Clear polling
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      isPollingRef.current = false;
      // Cleanup all blob URLs to prevent memory leaks
      blobUrlCleanupRef.current.forEach(url => {
        try {
          window.URL.revokeObjectURL(url);
        } catch (e) {
          // Ignore cleanup errors
        }
      });
      blobUrlCleanupRef.current.clear();
    };
  }, []);

  // Update ref when selectedChatId changes
  useEffect(() => {
    selectedChatIdRef.current = selectedChatId;
  }, [selectedChatId]);

  // Final safeguard: Ensure chats state never has duplicates
  useEffect(() => {
    if (chats.length > 0 && !deduplicatingRef.current) {
      const seenIds = new Set();
      let hasDuplicates = false;
      const unique = chats.filter(chat => {
        if (!chat.id) return false;
        if (seenIds.has(chat.id)) {
          hasDuplicates = true;
          console.warn(`Duplicate chat detected and removed: ${chat.id}`);
          return false;
        }
        seenIds.add(chat.id);
        return true;
      });
      
      // Only update if we actually found duplicates to prevent infinite loops
      if (hasDuplicates && unique.length !== chats.length) {
        deduplicatingRef.current = true;
        // Removed duplicate chats (logging disabled in production)
        setChats(unique);
        // Reset flag after state update
        setTimeout(() => {
          deduplicatingRef.current = false;
        }, 100);
      }
    }
  }, [chats]);

  // Handle initial chat selection
  useEffect(() => {
    if (!initialChat?.propertyId) {
      processedInitialChatRef.current = null;
      return;
    }
    
    // Create a unique key for this initial chat
    const initialChatKey = `${initialChat.propertyId}-${initialChat.unitId || 'no-unit'}`;
    
    // Skip if we've already processed this exact initial chat
    if (processedInitialChatRef.current === initialChatKey) {
      return;
    }
    
    // Skip if we're currently creating an inquiry
    if (creatingInquiryRef.current) {
      return;
    }
    
    const handleInitialChat = async () => {
      // If still loading, wait for it to complete
      if (loading) {
        return; // Will retry when loading becomes false
      }
      
      // Use ref to get latest chats to avoid stale closure
      const currentChats = chatsRef.current.length > 0 ? chatsRef.current : chats;
      
      // Find matching chat
      const matchingChat = currentChats.find(c => Number(c.propertyId) === Number(initialChat.propertyId));
      
      if (matchingChat) {
        // Chat exists - select it and pre-fill message
        processedInitialChatRef.current = initialChatKey;
        setSelectedChatId(matchingChat.id);
        if (matchingChat.messages && matchingChat.messages.length > 0) {
          // Existing conversation - offer to continue
          setMessage(`Hello! I'm still interested in ${initialChat.unitName || initialChat.property || 'this unit'}. Could you please provide an update?`);
        } else {
          // New chat with no messages yet - ready to send first message
          setMessage(`Hello! I'm interested in ${initialChat.unitName || initialChat.property || 'this unit'}. Please provide more information about availability, viewing options, and pricing details. Thank you!`);
        }
        // Focus the message input after a brief delay to ensure it's rendered
        setTimeout(() => {
          if (messageInputRef.current) {
            messageInputRef.current.focus();
          }
        }, 100);
      } else if (!loading && !creatingInquiryRef.current) {
        // Chat doesn't exist and we've finished loading - create it
        processedInitialChatRef.current = initialChatKey;
        creatingInquiryRef.current = true;
        try {
          await createInquiry(initialChat);
        } finally {
          creatingInquiryRef.current = false;
        }
      }
    };
    
    handleInitialChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialChat?.propertyId, initialChat?.unitId]); // Removed chats and loading from dependencies

  /**
   * Load inquiries from the backend
   */
  const loadInquiries = useCallback(async () => {
    if (!mountedRef.current) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Check authentication
      const token = localStorage.getItem('access_token') || localStorage.getItem('token');
      if (!token) {
        setError('Please log in to view your inquiries.');
        setLoading(false);
        return;
      }
      
      const response = await api.getTenantInquiries();
      
      if (!mountedRef.current) return;
      
      if (response && response.inquiries) {
        const processedChats = processInquiries(response.inquiries);
        setChats(processedChats);
        chatsRef.current = processedChats; // Update ref with latest chats
        
        // Load attachments for all inquiries (non-blocking)
        loadAttachmentsForInquiries(processedChats).catch(err => {
          console.warn('Some attachments failed to load:', err);
        });
        
        // Return processed chats for use in createInquiry
        return processedChats;
      } else {
        setChats([]);
        chatsRef.current = []; // Update ref
        return [];
      }
    } catch (err) {
      if (!mountedRef.current) return;
      
      console.error('Failed to load inquiries:', err);
      if (err.status === 401) {
        setError('Please log in to view your inquiries.');
      } else {
        setError('Failed to load inquiries. Please try again.');
      }
      return [];
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  /**
   * Process raw inquiries into chat format
   */
  const processInquiries = useCallback((inquiries) => {
    if (!Array.isArray(inquiries)) return [];
    
    const processed = inquiries.map(inquiry => {
      const messages = parseMessages(inquiry);
      
      // Get manager profile picture
      const managerProfileImage = inquiry.property_manager?.profile_image_url 
        ? getImageUrl(inquiry.property_manager.profile_image_url) 
        : null;
      const managerInitials = inquiry.property_manager?.first_name && inquiry.property_manager?.last_name
        ? `${inquiry.property_manager.first_name[0]}${inquiry.property_manager.last_name[0]}`.toUpperCase()
        : inquiry.property_manager?.first_name?.[0]?.toUpperCase() || 'PM';
      
      return {
        id: inquiry.id,
        managerName: `${inquiry.property_manager?.first_name || 'Property'} ${inquiry.property_manager?.last_name || 'Manager'}`,
        property: inquiry.property?.title || inquiry.property?.building_name || 'Property',
        propertyId: inquiry.property_id,
        unitId: inquiry.unit_id || inquiry.property_id,
        unitName: inquiry.unit_name || inquiry.property?.title || 'Property',
        avatar: managerProfileImage || null,
        avatarInitials: managerInitials,
        status: inquiry.status || 'pending',
        messages,
        inquiry
      };
    });
    
    // Aggressive deduplication by inquiry ID to prevent same inquiry appearing multiple times
    // But allow multiple different inquiries for the same property/unit
    const uniqueById = [];
    const seenIds = new Set();
    const seenKeys = new Set(); // Also check for duplicate keys
    
    processed.forEach(chat => {
      const id = chat.id;
      const key = `chat-${id}`;
      
      // Only add if we haven't seen this ID before
      if (id && !seenIds.has(id) && !seenKeys.has(key)) {
        seenIds.add(id);
        seenKeys.add(key);
        uniqueById.push(chat);
      }
    });
    
    return uniqueById;
  }, []);

  /**
   * Parse messages from inquiry (handles both new and old format)
   */
  const parseMessages = useCallback((inquiry) => {
    const messages = [];
    
    // New format: messages from inquiry_messages table
    if (inquiry.messages && Array.isArray(inquiry.messages)) {
      inquiry.messages.forEach(msg => {
        messages.push({
          id: `msg-${msg.id}`,
          sender: msg.sender || (msg.sender_id === inquiry.tenant_id ? 'tenant' : 'manager'),
          text: msg.message || msg.text || '',
          time: formatTime(msg.created_at),
          created_at: msg.created_at
        });
      });
    }
    
    // Old format: parse from message field
    if (inquiry.message) {
      const tenantMessages = parseOldFormatMessages(inquiry.message, inquiry.id, 'tenant');
      messages.push(...tenantMessages);
    }
    
    // Old format: parse from response_message field
    if (inquiry.response_message) {
      const managerMessages = parseOldFormatMessages(inquiry.response_message, inquiry.id, 'manager');
      messages.push(...managerMessages);
    }
    
    // Sort by timestamp
    messages.sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return timeA - timeB;
    });
    
    // Remove duplicates
    const unique = [];
    const seen = new Set();
    messages.forEach(msg => {
      const key = `${msg.sender}-${msg.text}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(msg);
      }
    });
    
    return unique;
  }, []);

  /**
   * Parse old format messages with separators
   */
  const parseOldFormatMessages = useCallback((text, inquiryId, sender) => {
    if (!text) return [];
    
    const messages = [];
    const regex = /\n\n--- (?:New Message|Manager Reply)(?: \[(\d{10,})\])? ---\n/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      const before = text.slice(lastIndex, match.index).trim();
      if (before) {
        parts.push({ text: before, timestamp: null });
      }
      parts.push({ text: null, timestamp: match[1] ? Number(match[1]) : null });
      lastIndex = match.index + match[0].length;
    }
    
    const tail = text.slice(lastIndex).trim();
    if (tail) {
      parts.push({ text: tail, timestamp: null });
    }
    
    let pendingTimestamp = null;
    parts.forEach((part, idx) => {
      if (part.text === null) {
        pendingTimestamp = part.timestamp;
      } else {
        const cleanText = part.text
          .replace(/^---\s*(?:New\s*Message|Manager\s*Reply)\s*\[?\d*\]?\s*---\s*/gi, '')
          .replace(/\s*---\s*(?:New\s*Message|Manager\s*Reply)\s*\[?\d*\]?\s*---\s*$/gi, '')
          .trim();
        
        if (cleanText && !isPlaceholderMessage(cleanText)) {
          const timestamp = pendingTimestamp || Date.now() - (parts.length - idx) * 60000;
          messages.push({
            id: `${inquiryId}-${sender}-${idx}`,
            sender,
            text: cleanText,
            time: formatTime(new Date(timestamp)),
            created_at: new Date(timestamp).toISOString()
          });
        }
        pendingTimestamp = null;
      }
    });
    
    return messages;
  }, []);

  /**
   * Check if message is a placeholder
   */
  const isPlaceholderMessage = (text) => {
    const placeholders = [/^inquiry\s+started$/i, /^placeholder$/i, /^init$/i];
    return placeholders.some(pattern => pattern.test(text));
  };

  /**
   * Format time for display
   */
  const formatTime = useCallback((dateString) => {
    if (!dateString) return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    
    try {
      let date;
      if (dateString instanceof Date) {
        date = dateString;
      } else if (typeof dateString === 'string') {
        // Handle ISO strings
        let normalized = dateString.trim();
        if (!normalized.endsWith('Z') && !normalized.includes('+') && !normalized.includes('-', 10)) {
          normalized = normalized + 'Z';
        }
        date = new Date(normalized);
      } else {
        date = new Date(dateString);
      }
      
      if (isNaN(date.getTime())) {
        return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      }
      
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch (err) {
      return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
  }, []);

  /**
   * Load attachments for all inquiries (non-blocking)
   */
  const loadAttachmentsForInquiries = useCallback(async (chatList) => {
    if (!Array.isArray(chatList)) return;
    
    const attachmentPromises = chatList.map(async (chat) => {
      try {
        const attData = await api.getInquiryAttachments(chat.id);
        if (attData && attData.attachments && Array.isArray(attData.attachments)) {
          if (mountedRef.current) {
            setAttachments(prev => ({
              ...prev,
              [chat.id]: attData.attachments
            }));
          }
        }
      } catch (err) {
        console.warn(`Failed to load attachments for inquiry ${chat.id}:`, err);
        // Don't throw - continue with other inquiries
      }
    });
    
    await Promise.allSettled(attachmentPromises);
  }, []);

  /**
   * Get media URL for attachment (with caching and error handling)
   * Handles missing files gracefully - marks as failed immediately on 404
   */
  const getMediaUrl = useCallback(async (attachmentId) => {
    if (!attachmentId) return null;
    
    // Return cached URL if available
    if (mediaUrls[attachmentId]) {
      return mediaUrls[attachmentId];
    }
    
    // Check if already failed - don't retry
    if (failedAttachmentsRef.current.has(attachmentId)) {
      return null;
    }
    
    // Check if already loading - wait for existing promise
    if (loadingAttachmentsRef.current.has(attachmentId)) {
      const existingPromise = attachmentPromisesRef.current.get(attachmentId);
      if (existingPromise) {
        return existingPromise;
      }
    }
    
    // Create new loading promise
    loadingAttachmentsRef.current.add(attachmentId);
    const promise = (async () => {
      try {
        const blob = await api.downloadInquiryAttachment(attachmentId);
        
        if (!mountedRef.current) return null;
        
        // Handle 404 (missing file) gracefully - mark as failed immediately
        if (!blob || !(blob instanceof Blob)) {
          // File doesn't exist - mark as failed and don't retry
          failedAttachmentsRef.current.add(attachmentId);
          return null;
        }
        
        const url = window.URL.createObjectURL(blob);
        blobUrlCleanupRef.current.add(url);
        
        if (mountedRef.current) {
          setMediaUrls(prev => ({ ...prev, [attachmentId]: url }));
        }
        
        return url;
      } catch (err) {
        if (!mountedRef.current) return null;
        
        // Handle 404 and other errors gracefully
        const is404 = err?.status === 404 || 
                      err?.response?.status === 404 ||
                      err?.statusCode === 404 ||
                      (err?.message && (
                        err.message.includes('404') || 
                        err.message.includes('not found') ||
                        err.message.includes('NOT FOUND') ||
                        err.message.toLowerCase().includes('attachment not found') ||
                        err.message.toLowerCase().includes('file not found')
                      ));
        
        // Mark as failed immediately for 404s - these are permanent failures
        if (is404) {
          failedAttachmentsRef.current.add(attachmentId);
          // Don't log 404s - they're expected when files are missing
          return null;
        }
        
        // Log other errors in development only
        if (process.env.NODE_ENV === 'development') {
          console.warn('Failed to load attachment:', err);
        }
        
        // For non-404 errors, also mark as failed to prevent infinite retries
        failedAttachmentsRef.current.add(attachmentId);
        return null;
      } finally {
        loadingAttachmentsRef.current.delete(attachmentId);
        attachmentPromisesRef.current.delete(attachmentId);
      }
    })();
    
    attachmentPromisesRef.current.set(attachmentId, promise);
    return promise;
  }, [mediaUrls]);

  /**
   * Create new inquiry
   */
  const createInquiry = useCallback(async (chatData) => {
    if (!chatData?.propertyId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Check if inquiry already exists before creating (use ref to get latest)
      const currentChats = chatsRef.current.length > 0 ? chatsRef.current : chats;
      const existingChat = currentChats.find(c => Number(c.propertyId) === Number(chatData.propertyId));
      if (existingChat) {
        // Chat already exists - select it instead of creating
        setSelectedChatId(existingChat.id);
        if (existingChat.messages && existingChat.messages.length > 0) {
          setMessage(`Hello! I'm still interested in ${chatData.unitName || chatData.property || 'this unit'}. Could you please provide an update?`);
        } else {
          setMessage(`Hello! I'm interested in ${chatData.unitName || chatData.property || 'this unit'}. Please provide more information about availability, viewing options, and pricing details. Thank you!`);
        }
        setTimeout(() => {
          if (messageInputRef.current) {
            messageInputRef.current.focus();
          }
        }, 100);
        setLoading(false);
        return;
      }
      
      // Use a placeholder message to create the inquiry
      const placeholderMessage = "Inquiry started";
      const response = await api.startTenantInquiry(
        chatData.propertyId,
        placeholderMessage,
        chatData.unitId || null
      );
      
      if (!mountedRef.current) return;
      
      if (response && response.inquiry) {
        // Reload inquiries to get the new one
        const updatedChats = await loadInquiries();
        
        if (!mountedRef.current) return;
        
        // Find the new chat from the updated list
        const newChat = updatedChats?.find(c => c.id === response.inquiry.id) ||
                       updatedChats?.find(c => Number(c.propertyId) === Number(chatData.propertyId));
        
        if (newChat) {
          setSelectedChatId(newChat.id);
          // Pre-fill message ready to send
          setMessage(`Hello! I'm interested in ${chatData.unitName || chatData.property || 'this unit'}. Please provide more information about availability, viewing options, and pricing details. Thank you!`);
          // Focus the message input after a brief delay to ensure it's rendered
          setTimeout(() => {
            if (messageInputRef.current) {
              messageInputRef.current.focus();
            }
          }, 100);
        }
      } else if (response && response.message === 'Inquiry already exists' && response.inquiry) {
        // Inquiry already exists, reload and select it
        const updatedChats = await loadInquiries();
        
        if (!mountedRef.current) return;
        
        const existingChat = updatedChats?.find(c => Number(c.propertyId) === Number(chatData.propertyId));
        if (existingChat) {
          setSelectedChatId(existingChat.id);
          // Pre-fill message based on whether there are existing messages
          if (existingChat.messages && existingChat.messages.length > 0) {
            setMessage(`Hello! I'm still interested in ${chatData.unitName || chatData.property || 'this unit'}. Could you please provide an update?`);
          } else {
            setMessage(`Hello! I'm interested in ${chatData.unitName || chatData.property || 'this unit'}. Please provide more information about availability, viewing options, and pricing details. Thank you!`);
          }
          // Focus the message input after a brief delay to ensure it's rendered
          setTimeout(() => {
            if (messageInputRef.current) {
              messageInputRef.current.focus();
            }
          }, 100);
        }
      }
    } catch (err) {
      if (!mountedRef.current) return;
      
      console.error('Failed to create inquiry:', err);
      if (err.status === 401) {
        setError('Please log in to create an inquiry.');
      } else {
        setError('Failed to create inquiry. Please try again.');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [loadInquiries, chats]);

  /**
   * Send message
   */
  const handleSendMessage = useCallback(async () => {
    const selectedChat = chats.find(c => c.id === selectedChatId);
    if (!message.trim() || !selectedChat) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const messageText = message.trim();
      const response = await api.sendTenantMessage(selectedChat.id, messageText);
      
      if (!mountedRef.current) return;
      
      if (response && response.success) {
        // Optimistically add message
        setChats(prev => prev.map(c => 
          c.id === selectedChat.id 
            ? {
                ...c,
                messages: [...c.messages, {
                  id: `temp-${Date.now()}`,
                  sender: 'tenant',
                  text: messageText,
                  time: formatTime(new Date()),
                  created_at: new Date().toISOString()
                }]
              }
            : c
        ));
        
        setMessage('');
        
        // Reload to get updated data
        await loadInquiries();
        
        // Re-select chat
        if (mountedRef.current) {
          setSelectedChatId(selectedChat.id);
        }
      } else {
        setError('Failed to send message. Please try again.');
      }
    } catch (err) {
      if (!mountedRef.current) return;
      
      console.error('Failed to send message:', err);
      setError('Failed to send message. Please try again.');
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [message, selectedChatId, chats, loadInquiries, formatTime]);

  /**
   * Handle file selection
   */
  const handleFileSelect = useCallback((e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setSelectedFiles(files);
    }
  }, []);

  /**
   * Handle file upload
   */
  const handleFileUpload = useCallback(async () => {
    const selectedChat = chats.find(c => c.id === selectedChatId);
    if (!selectedFiles.length || !selectedChat) return;
    
    try {
      setUploadingFiles(true);
      setError(null);
      
      const response = await api.uploadInquiryAttachments(selectedChat.id, selectedFiles);
      
      if (!mountedRef.current) return;
      
      if (response && response.attachments) {
        // Update attachments state
        setAttachments(prev => ({
          ...prev,
          [selectedChat.id]: [...(prev[selectedChat.id] || []), ...response.attachments]
        }));
        
        // Clear selected files
        setSelectedFiles([]);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        
        // Reload inquiries in background
        loadInquiries().catch(err => {
          console.warn('Failed to reload after upload:', err);
        });
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      if (!mountedRef.current) return;
      
      console.error('Failed to upload files:', err);
      setError(err.message || 'Failed to upload files. Please try again.');
    } finally {
      if (mountedRef.current) {
        setUploadingFiles(false);
      }
    }
  }, [selectedFiles, selectedChatId, chats, loadInquiries]);

  /**
   * Handle attachment download
   */
  const handleDownloadAttachment = useCallback(async (attachmentId, fileName) => {
    try {
      const blob = await api.downloadInquiryAttachment(attachmentId);
      
      if (!blob || !(blob instanceof Blob)) {
        setError('File not available for download.');
        return;
      }
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || 'attachment';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download attachment:', err);
      setError('Failed to download file. Please try again.');
    }
  }, []);

  /**
   * Helper functions for file types
   */
  const isImage = useCallback((mimeType, fileType) => {
    return (mimeType && mimeType.startsWith('image/')) || 
           (fileType && ['image', 'jpg', 'jpeg', 'png', 'gif', 'webp'].includes(String(fileType).toLowerCase()));
  }, []);

  const isVideo = useCallback((mimeType, fileType) => {
    return (mimeType && mimeType.startsWith('video/')) || 
           (fileType && ['video', 'mp4', 'mov', 'avi', 'webm'].includes(String(fileType).toLowerCase()));
  }, []);

  /**
   * Get attachments for a message (by timestamp matching)
   */
  const getMessageAttachments = useCallback((message, inquiryId) => {
    if (!attachments[inquiryId] || !message.created_at) return [];
    
    const messageTime = new Date(message.created_at).getTime();
    return attachments[inquiryId].filter(att => {
      if (!att.created_at) return false;
      const attTime = new Date(att.created_at).getTime();
      const timeDiff = messageTime - attTime;
      return timeDiff >= 0 && timeDiff < 2000; // Within 2 seconds
    });
  }, [attachments]);

  /**
   * Get unmatched attachments (not associated with any message)
   */
  const getUnmatchedAttachments = useCallback((inquiryId, messages) => {
    if (!attachments[inquiryId]) return [];
    if (!messages || messages.length === 0) return attachments[inquiryId];
    
    const matchedIds = new Set();
    messages.forEach(msg => {
      if (msg.created_at) {
        getMessageAttachments(msg, inquiryId).forEach(att => {
          matchedIds.add(att.id);
        });
      }
    });
    
    return attachments[inquiryId].filter(att => !matchedIds.has(att.id));
  }, [attachments, getMessageAttachments]);

  // Get selected chat
  const selectedChat = useMemo(() => {
    return chats.find(c => c.id === selectedChatId) || null;
  }, [chats, selectedChatId]);

  // Real-time polling for new messages and attachments
  useEffect(() => {
    if (!mountedRef.current) return;
    
    const pollInterval = 2000; // Poll every 2 seconds for better real-time feel
    
    const pollForUpdates = async () => {
      // Prevent concurrent polling
      if (isPollingRef.current) {
        return;
      }
      isPollingRef.current = true;
      
      try {
        // Get fresh inquiry data
        const response = await api.getTenantInquiries();
        
        if (!mountedRef.current) return;
        
        if (response && response.inquiries) {
          const processedChats = processInquiries(response.inquiries);
          
          // Update chats state only if there are actual changes
          setChats(prevChats => {
            // Check if there are actual changes
            let hasChanges = false;
            let shouldScroll = false;
            
            // Compare all chats and messages
            for (const newChat of processedChats) {
              const oldChat = prevChats.find(c => c.id === newChat.id);
              
              if (!oldChat) {
                hasChanges = true;
                break; // New chat found
              }
              
              // Check if message count changed
              const oldMsgCount = oldChat.messages?.length || 0;
              const newMsgCount = newChat.messages?.length || 0;
              if (oldMsgCount !== newMsgCount) {
                hasChanges = true;
                // If this is the selected chat and we have new messages, scroll to bottom
                if (newChat.id === selectedChatIdRef.current && newMsgCount > oldMsgCount) {
                  shouldScroll = true;
                }
                break;
              }
              
              // Check all message IDs to detect new messages (more thorough than just last message)
              if (oldMsgCount > 0 && newMsgCount > 0) {
                const oldMsgIds = new Set((oldChat.messages || []).map(m => String(m.id)));
                const newMsgIds = new Set((newChat.messages || []).map(m => String(m.id)));
                
                // Check if any new message IDs don't exist in old messages
                for (const newId of newMsgIds) {
                  if (!oldMsgIds.has(newId)) {
                    hasChanges = true;
                    // If this is the selected chat, scroll to bottom
                    if (newChat.id === selectedChatIdRef.current) {
                      shouldScroll = true;
                    }
                    break;
                  }
                }
                
                if (hasChanges) break;
              }
              
              // Check if status changed
              if (oldChat.status !== newChat.status) {
                hasChanges = true;
                break;
              }
            }
            
            // Also check if any old chats are missing (deleted)
            if (!hasChanges && prevChats.length !== processedChats.length) {
              hasChanges = true;
            }
            
            // Update state if there are changes
            if (hasChanges) {
              // Aggressive deduplication by chat ID to prevent same chat appearing multiple times
              const uniqueById = [];
              const seenIds = new Set();
              const seenKeys = new Set(); // Also check for duplicate keys
              
              processedChats.forEach(chat => {
                const id = chat.id;
                const key = `chat-${id}`;
                
                // Only add if we haven't seen this ID before
                if (id && !seenIds.has(id) && !seenKeys.has(key)) {
                  seenIds.add(id);
                  seenKeys.add(key);
                  uniqueById.push(chat);
                }
              });
              
              // Update ref with latest chats
              chatsRef.current = uniqueById;
              
              // Schedule scroll after state update if needed
              if (shouldScroll) {
                // Use requestAnimationFrame to ensure DOM is updated
                requestAnimationFrame(() => {
                  setTimeout(() => {
                    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                  }, 50);
                });
              }
              return uniqueById;
            }
            
            return prevChats; // No changes
          });
          
          // Update attachments for selected chat only (with rate limiting and backoff)
          const currentSelectedId = selectedChatIdRef.current;
          if (currentSelectedId) {
            const selectedChat = processedChats.find(c => c.id === currentSelectedId);
            if (selectedChat) {
              const inquiryId = selectedChat.id;
              const now = Date.now();
              
              // Check if we're in backoff period due to 429 errors
              const backoffUntil = attachmentPollBackoffRef.current[inquiryId] || 0;
              const isInBackoff = now < backoffUntil;
              
              // Only poll attachments every 10 seconds (instead of every 2 seconds)
              const lastPoll = lastAttachmentPollRef.current[inquiryId] || 0;
              const attachmentPollInterval = 10000; // 10 seconds
              const shouldPoll = !isInBackoff && (now - lastPoll >= attachmentPollInterval);
              
              if (shouldPoll) {
                try {
                  const attData = await api.getInquiryAttachments(inquiryId);
                  lastAttachmentPollRef.current[inquiryId] = now;
                  
                  // Reset backoff on successful request
                  if (attachmentPollBackoffRef.current[inquiryId]) {
                    delete attachmentPollBackoffRef.current[inquiryId];
                  }
                  
                if (attData && attData.attachments && Array.isArray(attData.attachments)) {
                  setAttachments(prev => {
                      const currentAtts = prev[inquiryId] || [];
                    const newAtts = attData.attachments || [];
                    
                    // Check if attachments changed
                    if (currentAtts.length !== newAtts.length) {
                        return { ...prev, [inquiryId]: newAtts };
                    }
                    
                    // Check if any attachment IDs are different
                    const currentIds = new Set(currentAtts.map(a => String(a.id)));
                    const newIds = new Set(newAtts.map(a => String(a.id)));
                    if (currentIds.size !== newIds.size || 
                        [...currentIds].some(id => !newIds.has(id))) {
                        return { ...prev, [inquiryId]: newAtts };
                    }
                    
                    return prev; // No changes
                  });
                }
              } catch (err) {
                  // Handle 429 errors with exponential backoff
                  if (err?.response?.status === 429 || err?.status === 429) {
                    const currentBackoff = attachmentPollBackoffRef.current[inquiryId] || 0;
                    const backoffTime = Math.max(30000, (now - currentBackoff) * 2 || 30000); // Start with 30s, double each time
                    attachmentPollBackoffRef.current[inquiryId] = now + backoffTime;
                    
                    if (process.env.NODE_ENV === 'development') {
                      console.debug(`Rate limited for inquiry ${inquiryId}, backing off for ${backoffTime}ms`);
                    }
                  } else {
                    // For other errors, just log in debug mode
                    if (process.env.NODE_ENV === 'development') {
                      console.debug(`Failed to poll attachments for inquiry ${inquiryId}:`, err);
                    }
                  }
                }
              }
            }
          }
        }
      } catch (err) {
        // Log errors but don't spam console
        if (process.env.NODE_ENV === 'development') {
          console.error('Polling error:', err);
        }
      } finally {
        isPollingRef.current = false;
      }
    };
    
    // Clear any existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    
    // Poll immediately, then set up interval
    const startPolling = () => {
      pollForUpdates();
      pollingIntervalRef.current = setInterval(pollForUpdates, pollInterval);
    };
    
    // Start polling after a small delay to avoid immediate duplicate requests
    const timeoutId = setTimeout(startPolling, 500);
    
    // Cleanup interval on unmount
    return () => {
      clearTimeout(timeoutId);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      isPollingRef.current = false;
    };
  }, [processInquiries]);

  // Media Display Component
  const MediaDisplay = memo(({ attachment, type, getMediaUrl, onImageClick, failedAttachmentsRef }) => {
    const [url, setUrl] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const mountedRef = useRef(true);

    useEffect(() => {
      mountedRef.current = true;
      
      // Check if already failed
      if (failedAttachmentsRef?.current.has(attachment.id)) {
        setError(true);
        setLoading(false);
        return;
      }
      
      // Load media URL
      getMediaUrl(attachment.id).then(mediaUrl => {
        if (mountedRef.current) {
          if (mediaUrl) {
            setUrl(mediaUrl);
            setLoading(false);
          } else {
            setError(true);
            setLoading(false);
            if (failedAttachmentsRef) {
              failedAttachmentsRef.current.add(attachment.id);
            }
          }
        }
      }).catch(() => {
        if (mountedRef.current) {
          setError(true);
          setLoading(false);
          if (failedAttachmentsRef) {
            failedAttachmentsRef.current.add(attachment.id);
          }
        }
      });
      
      return () => {
        mountedRef.current = false;
      };
    }, [attachment.id, getMediaUrl, failedAttachmentsRef]);

    if (error) {
      return (
        <div className="w-full h-48 bg-gray-200 flex items-center justify-center rounded">
          <p className="text-sm text-gray-500">Image unavailable</p>
        </div>
      );
    }
    
    if (loading) {
      return (
        <div className="w-full h-48 bg-gray-300 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></div>
        </div>
      );
    }
    
    if (!url) {
      return (
        <div className="w-full h-48 bg-gray-200 flex items-center justify-center rounded">
          <p className="text-sm text-gray-500">Image unavailable</p>
        </div>
      );
    }

    if (type === 'image') {
      return (
        <img
          src={url}
          alt={attachment.file_name || 'Attachment'}
          className="w-full h-auto max-h-64 object-cover cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => onImageClick && onImageClick({ url, fileName: attachment.file_name })}
          onError={() => {
            setError(true);
            if (failedAttachmentsRef) {
              failedAttachmentsRef.current.add(attachment.id);
            }
          }}
        />
      );
    } else {
      return (
        <video
          src={url}
          controls
          className="w-full h-auto max-h-64 object-cover"
          onError={() => {
            setError(true);
            if (failedAttachmentsRef) {
              failedAttachmentsRef.current.add(attachment.id);
            }
          }}
        >
          Your browser does not support the video tag.
        </video>
      );
    }
  });

  // Render chat items (messages + attachments)
  const chatItems = useMemo(() => {
    if (!selectedChat?.id) return [];
    
    const items = [];
    const unmatchedAttachments = getUnmatchedAttachments(selectedChat.id, selectedChat.messages || []);
    
    // Add messages
    (selectedChat.messages || []).forEach(msg => {
      items.push({
        type: 'message',
        data: msg,
        timestamp: msg.created_at ? new Date(msg.created_at).getTime() : 0
      });
    });
    
    // Add unmatched attachments
    unmatchedAttachments.forEach(att => {
      items.push({
        type: 'attachment',
        data: att,
        timestamp: att.created_at ? new Date(att.created_at).getTime() : 0
      });
    });
    
    // Sort by timestamp
    items.sort((a, b) => a.timestamp - b.timestamp);
    
    return items;
  }, [selectedChat, getUnmatchedAttachments]);

  // Auto-scroll to bottom when chat is selected or messages change
  useEffect(() => {
    if (selectedChatId && messagesEndRef.current) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [selectedChatId, chatItems.length]);

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-3 z-50">
      <div className="bg-white rounded-xl w-full max-w-6xl h-[90vh] max-h-[90vh] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white flex-shrink-0">
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="w-9 h-9 bg-black rounded-full flex items-center justify-center hover:bg-gray-800 transition-all duration-300 shadow-lg"
              aria-label="Close"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-lg font-black text-black">My Property Inquiries</h1>
              <p className="text-xs text-gray-500">Chat with property managers about available properties</p>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mx-4 mt-2 flex-shrink-0">
            <div className="flex items-center justify-between">
              <p className="text-sm text-red-700">{error}</p>
              <button 
                onClick={() => setError(null)}
                className="text-xs text-red-600 underline ml-4"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left Panel - Chat List */}
          <div className="w-80 border-r border-gray-200 bg-gray-50 flex flex-col flex-shrink-0">
            {/* Tabs */}
            <div className="flex border-b border-gray-200">
              <button className="flex-1 py-3 px-4 text-sm font-medium bg-white text-black border-b-2 border-black">
                Active Chats
              </button>
              <button className="flex-1 py-3 px-4 text-sm font-medium text-gray-600 hover:text-black hover:bg-gray-100">
                New Properties
              </button>
            </div>

            {/* Search */}
            <div className="p-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search chats..."
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-sm"
                />
              </div>
            </div>

            {/* Chat List */}
            <div className="flex-1 overflow-y-auto">
              {loading && chats.length === 0 ? (
                <div className="p-4 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto"></div>
                  <p className="text-sm text-gray-500 mt-2">Loading inquiries...</p>
                </div>
              ) : chats.length === 0 ? (
                <div className="p-4 text-sm text-gray-500">No conversations yet. Start an inquiry from a unit to chat with a manager.</div>
              ) : (
                <div className="space-y-1 px-2">
                  {chats.filter((chat, index, self) => 
                    // Additional deduplication: ensure each ID appears only once
                    index === self.findIndex(c => c.id === chat.id)
                  ).map((chat) => (
                    <div
                      key={`chat-${chat.id}`}
                      onClick={() => setSelectedChatId(chat.id)}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedChatId === chat.id ? 'bg-gray-200' : 'hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="relative">
                          {chat.avatar ? (
                            <img
                              src={chat.avatar}
                              alt={chat.managerName}
                              className="w-10 h-10 rounded-full object-cover border-2 border-gray-200"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div 
                            className={`w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center ${chat.avatar ? 'hidden' : ''}`}
                          >
                            <span className="text-sm font-medium text-blue-600">{chat.avatarInitials || 'PM'}</span>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-900 truncate">{chat.managerName}</p>
                            <span className="text-xs text-gray-500">
                              {chat.messages[chat.messages.length - 1]?.time || ''}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 truncate">{chat.property}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {String(chat.messages[chat.messages.length - 1]?.text || '').substring(0, 50)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Chat Conversation */}
          <div className="flex-1 flex flex-col bg-white min-w-0 overflow-hidden">
            {selectedChat ? (
              <>
                {/* Chat Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
                  <div className="flex items-center space-x-3">
                    {selectedChat.avatar ? (
                      <img
                        src={selectedChat.avatar}
                        alt={selectedChat.managerName}
                        className="w-10 h-10 rounded-full object-cover border-2 border-gray-200"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div 
                      className={`w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center ${selectedChat.avatar ? 'hidden' : ''}`}
                    >
                      <span className="text-sm font-medium text-blue-600">{selectedChat.avatarInitials || 'PM'}</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">{selectedChat.managerName}</h3>
                      <p className="text-xs text-gray-500">{selectedChat.unitName || selectedChat.property}</p>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                  {chatItems.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      <p>No messages yet. Start the conversation!</p>
                    </div>
                  ) : (
                    <>
                      {chatItems.map((item, idx) => {
                      if (item.type === 'attachment') {
                        const att = item.data;
                        const currentChat = chats.find(c => c.id === selectedChat.id);
                        const isTenant = currentChat?.inquiry?.tenant_id && 
                                        att.uploaded_by && 
                                        String(att.uploaded_by) === String(currentChat.inquiry.tenant_id);
                        const sender = isTenant ? 'tenant' : 'manager';
                        
                        return (
                          <div key={`att-${att.id}-${idx}`} className={`flex ${sender === 'tenant' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-xs lg:max-w-md rounded-lg overflow-hidden ${
                              sender === 'tenant' ? 'bg-black text-white' : 'bg-gray-200 text-gray-900'
                            }`}>
                              {(isImage(att.mime_type, att.file_type) || isVideo(att.mime_type, att.file_type)) ? (
                                <MediaDisplay
                                  attachment={att}
                                  type={isImage(att.mime_type, att.file_type) ? 'image' : 'video'}
                                  getMediaUrl={getMediaUrl}
                                  onImageClick={setLightboxImage}
                                  failedAttachmentsRef={failedAttachmentsRef}
                                />
                              ) : (
                                <div className="px-4 pt-2 pb-2">
                                  <div className={`flex items-center space-x-2 p-2 rounded ${
                                    sender === 'tenant' ? 'bg-gray-800' : 'bg-gray-300'
                                  }`}>
                                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-medium truncate">{att.file_name}</p>
                                      <p className="text-xs opacity-75">
                                        {att.file_size ? `${(att.file_size / 1024).toFixed(1)} KB` : ''}
                                      </p>
                                    </div>
                                    <button
                                      onClick={() => handleDownloadAttachment(att.id, att.file_name)}
                                      className="p-1 hover:opacity-75 transition-opacity"
                                      title="Download"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              )}
                              <div className="px-4 pb-2">
                                <p className={`text-xs ${sender === 'tenant' ? 'text-gray-300' : 'text-gray-500'}`}>
                                  {formatTime(att.created_at)}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      } else {
                        const msg = item.data;
                        const inquiryId = selectedChat.id;
                        const messageAttachments = getMessageAttachments(msg, inquiryId);
                        const hasAttachments = messageAttachments.length > 0;
                        const hasText = msg.text && msg.text.trim().length > 0;
                        
                        return (
                          <div key={msg.id || `msg-${idx}`} className={`flex ${msg.sender === 'tenant' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-xs lg:max-w-md rounded-lg overflow-hidden ${
                              msg.sender === 'tenant' ? 'bg-black text-white' : 'bg-gray-200 text-gray-900'
                            }`}>
                              {hasAttachments && messageAttachments
                                .filter(att => isImage(att.mime_type, att.file_type) || isVideo(att.mime_type, att.file_type))
                                .map((att) => (
                                  <div key={att.id} className="relative">
                                    <MediaDisplay
                                      attachment={att}
                                      type={isImage(att.mime_type, att.file_type) ? 'image' : 'video'}
                                      getMediaUrl={getMediaUrl}
                                      onImageClick={setLightboxImage}
                                      failedAttachmentsRef={failedAttachmentsRef}
                                    />
                                  </div>
                                ))}
                              
                              {hasText && (
                                <div className="px-4 py-2">
                                  <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
                                </div>
                              )}
                              
                              {hasAttachments && messageAttachments
                                .filter(att => !isImage(att.mime_type, att.file_type) && !isVideo(att.mime_type, att.file_type))
                                .map((att) => (
                                  <div key={att.id} className={`px-4 ${hasText ? 'pt-2' : 'pt-2'} pb-2`}>
                                    <div className={`flex items-center space-x-2 p-2 rounded ${
                                      msg.sender === 'tenant' ? 'bg-gray-800' : 'bg-gray-300'
                                    }`}>
                                      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium truncate">{att.file_name}</p>
                                        <p className="text-xs opacity-75">
                                          {att.file_size ? `${(att.file_size / 1024).toFixed(1)} KB` : ''}
                                        </p>
                                      </div>
                                      <button
                                        onClick={() => handleDownloadAttachment(att.id, att.file_name)}
                                        className="p-1 hover:opacity-75 transition-opacity"
                                        title="Download"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              
                              <div className={`px-4 pb-2 ${hasAttachments && !hasText ? 'pt-2' : ''}`}>
                                <p className={`text-xs ${msg.sender === 'tenant' ? 'text-gray-300' : 'text-gray-500'}`}>
                                  {msg.time}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      })}
                      {/* Scroll anchor for auto-scroll to bottom */}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>

                {/* Message Input */}
                <div className="p-4 border-t border-gray-200 flex-shrink-0">
                  {selectedFiles.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {selectedFiles.map((file, idx) => (
                        <div key={idx} className="flex items-center space-x-2 bg-gray-100 px-3 py-1 rounded-lg text-sm">
                          <span className="text-gray-700">{file.name}</span>
                          <button
                            onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))}
                            className="text-red-600 hover:text-red-800"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={handleFileUpload}
                        disabled={uploadingFiles}
                        className="bg-blue-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                      >
                        {uploadingFiles ? 'Uploading...' : 'Upload'}
                      </button>
                    </div>
                  )}
                  
                  <div className="flex items-center space-x-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="file-input"
                    />
                    <label
                      htmlFor="file-input"
                      className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors cursor-pointer"
                    >
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                    </label>
                    <input
                      ref={messageInputRef}
                      type="text"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder="Type your message to the property manager..."
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-black placeholder-gray-400"
                      autoFocus={selectedChatId !== null}
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={loading || !message.trim()}
                      className="w-10 h-10 bg-black rounded-full flex items-center justify-center hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    You're chatting with the property manager about {selectedChat.unitName || selectedChat.property || 'this unit'}
                  </p>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-gray-500">Select a chat to start messaging</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Image Lightbox Modal */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 z-[200] bg-black bg-opacity-90 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-7xl max-h-full w-full h-full flex items-center justify-center">
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors z-10"
              aria-label="Close"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={lightboxImage.url}
              alt={lightboxImage.fileName || 'Image'}
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            {lightboxImage.fileName && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-75 text-white px-4 py-2 rounded-lg text-sm">
                {lightboxImage.fileName}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Inquiries;
