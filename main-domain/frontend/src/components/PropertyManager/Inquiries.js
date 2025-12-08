import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import api from '../../services/api';

const Inquiries = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('chats');
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [inquiries, setInquiries] = useState([]); // inquiries from backend API
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorModalMessage, setErrorModalMessage] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [attachments, setAttachments] = useState({}); // {inquiryId: [attachments]}
  const hydratedRef = useRef(false);
  const fileInputRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  const isPollingRef = useRef(false);
  const messagesEndRef = useRef(null);
  const selectedChatIdRef = useRef(selectedChatId);
  const deduplicatingRef = useRef(false);
  const [mediaUrls, setMediaUrls] = useState({}); // Cache for blob URLs
  const [lightboxImage, setLightboxImage] = useState(null); // {url, fileName} for lightbox modal
  const [copiedLink, setCopiedLink] = useState(false); // Track if link was copied

  // Helper to generate subdomain URL for a property
  const getSubdomainUrl = (property) => {
    if (!property) return null;
    
    // Get subdomain from property - check portal_subdomain first, then try title/building_name
    const subdomain = property.portal_subdomain || 
                     property.subdomain || 
                     (property.title ? property.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') : null) ||
                     (property.building_name ? property.building_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') : null);
    
    if (!subdomain || subdomain === 'no-subdomain') {
      return null;
    }
    
    // Build URL based on environment
    const host = window.location.hostname || '';
    const cleanSubdomain = subdomain.toLowerCase().replace(/[^a-z0-9-]/g, '');
    
    if (host.includes('localhost') || host === '127.0.0.1') {
      const devPort = process.env.REACT_APP_SUBDOMAIN_PORT || '8080';
      return `http://${cleanSubdomain}.localhost:${devPort}`;
    }
    
    // Production
    const baseDomain = process.env.REACT_APP_PORTAL_BASE_DOMAIN || 'jacs.com';
    const protocol = process.env.REACT_APP_PORTAL_PROTOCOL || 'https';
    return `${protocol}://${cleanSubdomain}.${baseDomain}`;
  };

  // Helper to copy subdomain link to clipboard
  const handleCopySubdomainLink = async (property) => {
    const url = getSubdomainUrl(property);
    if (!url) {
      setError('Subdomain URL not available for this property');
      return;
    }
    
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    } catch (err) {
      console.error('Failed to copy link:', err);
      // Fallback: create a temporary textarea
      const textarea = document.createElement('textarea');
      textarea.value = url;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 3000);
      } catch (e) {
        setError('Failed to copy link. Please copy manually: ' + url);
      }
      document.body.removeChild(textarea);
    }
  };

  // Helper to get attachment URL (for download)
  const getAttachmentUrl = (attachmentId) => {
    return `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/inquiries/attachments/${attachmentId}`;
  };

  // Helper to get authenticated image/video URL
  const getMediaUrl = async (attachmentId) => {
    if (mediaUrls[attachmentId]) return mediaUrls[attachmentId];
    try {
      const blob = await api.downloadInquiryAttachment(attachmentId);
      
      // Verify that we got a Blob object
      if (!blob || !(blob instanceof Blob)) {
        console.error('Invalid blob response:', blob);
        return null;
      }
      
      const url = window.URL.createObjectURL(blob);
      setMediaUrls(prev => ({ ...prev, [attachmentId]: url }));
      return url;
    } catch (error) {
      console.error('Failed to load media:', error);
      return null;
    }
  };

  // Helper to check if file is image
  const isImage = (mimeType, fileType) => {
    return (mimeType && mimeType.startsWith('image/')) || 
           (fileType && ['image', 'jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileType.toLowerCase()));
  };

  // Helper to check if file is video
  const isVideo = (mimeType, fileType) => {
    return (mimeType && mimeType.startsWith('video/')) || 
           (fileType && ['video', 'mp4', 'mov', 'avi', 'webm'].includes(fileType.toLowerCase()));
  };

  // Helper to get attachments for a specific message (by matching timestamp - only match if attachment was uploaded BEFORE message)
  const getMessageAttachments = useCallback((message, inquiryId) => {
    if (!attachments[inquiryId] || !message.created_at) return [];
    const messageTime = new Date(message.created_at).getTime();
    return attachments[inquiryId].filter(att => {
      if (!att.created_at) return false;
      const attTime = new Date(att.created_at).getTime();
      // Only match attachments that were uploaded BEFORE the message (within 2 seconds)
      // This ensures attachments are only associated with messages sent immediately after them
      // If a text message is sent more than 2 seconds after an attachment, they are separate
      const timeDiff = messageTime - attTime;
      return timeDiff >= 0 && timeDiff < 2000; // 0 to 2 seconds after attachment
    });
  }, [attachments]);

  // Helper to get unmatched attachments (attachments that don't belong to any message)
  const getUnmatchedAttachments = useCallback((inquiryId, messages) => {
    if (!attachments[inquiryId] || !messages || messages.length === 0) {
      // If no messages, show all attachments
      return attachments[inquiryId] || [];
    }
    
    const matchedAttachmentIds = new Set();
    messages.forEach(msg => {
      if (msg.created_at) {
        const messageAttachments = getMessageAttachments(msg, inquiryId);
        messageAttachments.forEach(att => matchedAttachmentIds.add(att.id));
      }
    });
    
    // Return attachments that weren't matched to any message
    return (attachments[inquiryId] || []).filter(att => !matchedAttachmentIds.has(att.id));
  }, [attachments, getMessageAttachments]);

  // Media Display Component
  const MediaDisplay = ({ attachment, type, getMediaUrl, getAttachmentUrl, onImageClick }) => {
    const [url, setUrl] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
      let isMounted = true;
      setLoading(true);
      setError(false);
      
      getMediaUrl(attachment.id).then(mediaUrl => {
        if (isMounted) {
          if (mediaUrl) {
            setUrl(mediaUrl);
            setLoading(false);
          } else {
            setError(true);
            setLoading(false);
            console.error('Failed to get media URL for attachment:', attachment.id);
          }
        }
      }).catch(err => {
        if (isMounted) {
          console.error('Error loading media:', err);
          setError(true);
          setLoading(false);
        }
      });
      
      return () => {
        isMounted = false;
        if (url) {
          window.URL.revokeObjectURL(url);
        }
      };
    }, [attachment.id]);

    if (error) return null;
    if (loading) {
      return (
        <div className="w-full h-48 bg-gray-300 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></div>
        </div>
      );
    }
    if (!url) return null;

    if (type === 'image') {
      return (
        <img
          src={url}
          alt={attachment.file_name}
          className="w-full h-auto max-h-64 object-cover cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => onImageClick && onImageClick({ url, fileName: attachment.file_name })}
          onError={() => setError(true)}
        />
      );
    } else {
      return (
        <video
          src={url}
          controls
          className="w-full h-auto max-h-64 object-cover"
          onError={() => setError(true)}
        >
          Your browser does not support the video tag.
        </video>
      );
    }
  };

  // Helper function to format time consistently
  const formatMessageTime = (dateString) => {
    if (!dateString) {
      const now = new Date();
      return now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
    try {
      let date;
      if (dateString instanceof Date) {
        date = dateString;
      } else if (typeof dateString === 'string') {
        // If the string doesn't have timezone info, assume it's UTC from the backend
        // Backend sends ISO format which may or may not have 'Z' suffix
        let normalizedString = dateString.trim();
        if (!normalizedString.endsWith('Z') && !normalizedString.includes('+') && !normalizedString.includes('-', 10)) {
          // No timezone indicator, assume UTC
          normalizedString = normalizedString.endsWith('Z') ? normalizedString : normalizedString + 'Z';
        }
        date = new Date(normalizedString);
      } else if (typeof dateString === 'number') {
        // Timestamp in milliseconds
        date = new Date(dateString);
      } else {
        date = new Date(dateString);
      }
      
      if (isNaN(date.getTime())) {
        console.warn('Invalid date:', dateString);
        return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      }
      
      // Format in local timezone
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch (error) {
      console.error('Error formatting time:', error, dateString);
      return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
  };

  // Load inquiries from backend API
  // Note: Backend automatically filters inquiries to only include those for properties
  // owned by the currently logged-in property manager
  const loadInquiries = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.getManagerInquiries();
      if (response && response.inquiries) {
        // Backend has already filtered inquiries by manager's properties
        // All inquiries returned here are for properties owned by this manager
        const mapped = response.inquiries.map(inquiry => ({
          id: inquiry.id,
          tenantName: inquiry.tenant?.first_name && inquiry.tenant?.last_name 
            ? `${inquiry.tenant.first_name} ${inquiry.tenant.last_name}` 
            : inquiry.tenant?.name || 'Tenant',
          tenantEmail: inquiry.tenant?.email || '',
          tenantPhone: inquiry.tenant?.phone || inquiry.tenant?.phone_number || null,
            tenant: inquiry.tenant || {},
            property: inquiry.property?.title || inquiry.property?.building_name || 'Property',
            propertyObj: inquiry.property || {}, // Store full property object for subdomain access
            propertyId: inquiry.property_id,
            unitId: inquiry.unit_id || null,
            unitName: inquiry.unit_name,
            status: inquiry.status ? inquiry.status.toLowerCase() : inquiry.status,
          messages: (function(){
            // Use new messages array from inquiry_messages table if available
            if (inquiry.messages && Array.isArray(inquiry.messages) && inquiry.messages.length > 0) {
              return inquiry.messages.map((msg, idx) => ({
                id: msg.id || `${inquiry.id}-${msg.sender}-${idx}`,
                sender: msg.sender || (msg.sender_id === inquiry.property_manager_id ? 'manager' : 'tenant'),
                text: msg.message || msg.text || '',
                time: formatMessageTime(msg.created_at),
                created_at: msg.created_at
              }));
            }
            
            // Fallback to old format parsing for backward compatibility
            const regex = /\n\n--- New Message(?: \[(\d{10,})\])? ---\n/g;
            const src = String(inquiry.message || '');
            const chunks = []; let last = 0; let m;
            while ((m = regex.exec(src)) !== null) {
              const txt = src.slice(last, m.index);
              if (txt) chunks.push({ text: txt, ts: null });
              chunks.push({ text: null, ts: m[1] ? Number(m[1]) : null });
              last = m.index + m[0].length;
            }
            const tail = src.slice(last); if (tail) chunks.push({ text: tail, ts: null });
            const out = []; let pending = null; const now = Date.now();
            for (const c of chunks) {
              if (c.text === null) { pending = c.ts; continue; }
              let cleanText = c.text.trim();
              cleanText = cleanText.replace(/^---\s*New\s*Message\s*\[?\d*\]?\s*---\s*/i, '').trim();
              if (!cleanText) continue;
              out.push({ 
                id: `${inquiry.id}-t-${out.length}`, 
                sender: 'tenant', 
                text: cleanText, 
                time: formatMessageTime(pending ? new Date(pending) : new Date(now)),
                created_at: pending ? new Date(pending).toISOString() : new Date(now).toISOString()
              });
              pending = null;
            }
            return out;
          })(),
          inquiry: inquiry
        }));
        
        // Aggressive deduplication by inquiry ID to prevent same inquiry appearing multiple times
        // But allow multiple different inquiries for the same property/unit
        const uniqueById = [];
        const seenIds = new Set();
        const seenKeys = new Set(); // Also check for duplicate keys
        
        mapped.forEach(inquiry => {
          const id = inquiry.id;
          const key = `inquiry-${id}`;
          
          // Only add if we haven't seen this ID before
          if (id && !seenIds.has(id) && !seenKeys.has(key)) {
            seenIds.add(id);
            seenKeys.add(key);
            uniqueById.push(inquiry);
          }
        });
        
        setInquiries(uniqueById);
        
        // Load attachments for all inquiries (use deduplicated list)
        for (const inquiry of uniqueById) {
          try {
            const attData = await api.getInquiryAttachments(inquiry.id);
            if (attData && attData.attachments) {
              setAttachments(prev => ({ ...prev, [inquiry.id]: attData.attachments }));
            }
          } catch (err) {
            console.error(`Failed to load attachments for inquiry ${inquiry.id}:`, err);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load inquiries:', err);
      setError('Failed to load inquiries. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Load inquiries on mount
  useEffect(() => {
    loadInquiries();
    hydratedRef.current = true;
  }, []);

  // Real-time polling for new messages and attachments
  useEffect(() => {
    if (!isOpen) {
      // Clear polling when modal closes
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      isPollingRef.current = false;
      return;
    }
    
    const pollInterval = 2000; // Poll every 2 seconds for better real-time feel
    
    // Update ref when selectedChatId changes
    selectedChatIdRef.current = selectedChatId;
    
    const pollForUpdates = async () => {
      // Prevent concurrent polling
      if (isPollingRef.current) {
        console.debug('Poll already in progress, skipping...');
        return;
      }
      isPollingRef.current = true;
      
      try {
        // Get fresh inquiry data
        const response = await api.getManagerInquiries();
        if (response && response.inquiries) {
          // Map the new data same way as loadInquiries
          const mapped = response.inquiries.map(inquiry => ({
            id: inquiry.id,
            tenantName: inquiry.tenant?.first_name && inquiry.tenant?.last_name 
              ? `${inquiry.tenant.first_name} ${inquiry.tenant.last_name}` 
              : inquiry.tenant?.name || 'Tenant',
            tenantEmail: inquiry.tenant?.email || '',
            tenantPhone: inquiry.tenant?.phone || inquiry.tenant?.phone_number || null,
            tenant: inquiry.tenant || {},
            property: inquiry.property?.title || inquiry.property?.building_name || 'Property',
            propertyObj: inquiry.property || {}, // Store full property object for subdomain access
            propertyId: inquiry.property_id,
            unitId: inquiry.unit_id || null,
            unitName: inquiry.unit_name,
            status: inquiry.status ? inquiry.status.toLowerCase() : inquiry.status,
            messages: (function(){
              // Use new messages array from inquiry_messages table if available
              if (inquiry.messages && Array.isArray(inquiry.messages) && inquiry.messages.length > 0) {
                return inquiry.messages.map((msg, idx) => ({
                  id: msg.id || `${inquiry.id}-${msg.sender}-${idx}`,
                  sender: msg.sender || (msg.sender_id === inquiry.property_manager_id ? 'manager' : 'tenant'),
                  text: msg.message || msg.text || '',
                  time: formatMessageTime(msg.created_at),
                  created_at: msg.created_at
                }));
              }
              
              // Fallback to old format parsing for backward compatibility
              const regex = /\n\n--- New Message(?: \[(\d{10,})\])? ---\n/g;
              const src = String(inquiry.message || '');
              const chunks = []; let last = 0; let m;
              while ((m = regex.exec(src)) !== null) {
                const txt = src.slice(last, m.index);
                if (txt) chunks.push({ text: txt, ts: null });
                chunks.push({ text: null, ts: m[1] ? Number(m[1]) : null });
                last = m.index + m[0].length;
              }
              const tail = src.slice(last); if (tail) chunks.push({ text: tail, ts: null });
              const out = []; let pending = null; const now = Date.now();
              for (const c of chunks) {
                if (c.text === null) { pending = c.ts; continue; }
                let cleanText = c.text.trim();
                cleanText = cleanText.replace(/^---\s*New\s*Message\s*\[?\d*\]?\s*---\s*/i, '').trim();
                if (!cleanText) continue;
                out.push({ 
                  id: `${inquiry.id}-t-${out.length}`, 
                  sender: 'tenant', 
                  text: cleanText, 
                  time: formatMessageTime(pending ? new Date(pending) : new Date(now)),
                  created_at: pending ? new Date(pending).toISOString() : new Date(now).toISOString()
                });
                pending = null;
              }
              return out;
            })(),
            inquiry: inquiry
          }));
          
          // Update inquiries state - always update to ensure we have latest data
          setInquiries(prevInquiries => {
            // Check if there are actual changes
            let hasChanges = false;
            let shouldScroll = false;
            
            // Compare all inquiries and messages
            for (const newInquiry of mapped) {
              const oldInquiry = prevInquiries.find(i => i.id === newInquiry.id);
              
              if (!oldInquiry) {
                hasChanges = true;
                break; // New inquiry found
              }
              
              // Check if message count changed
              const oldMsgCount = oldInquiry.messages?.length || 0;
              const newMsgCount = newInquiry.messages?.length || 0;
              if (oldMsgCount !== newMsgCount) {
                hasChanges = true;
                // If this is the selected chat and we have new messages, scroll to bottom
                if (newInquiry.id === selectedChatIdRef.current && newMsgCount > oldMsgCount) {
                  shouldScroll = true;
                }
                break;
              }
              
              // Check all message IDs to detect new messages (more thorough than just last message)
              if (oldMsgCount > 0 && newMsgCount > 0) {
                const oldMsgIds = new Set((oldInquiry.messages || []).map(m => String(m.id)));
                const newMsgIds = new Set((newInquiry.messages || []).map(m => String(m.id)));
                
                // Check if any new message IDs don't exist in old messages
                for (const newId of newMsgIds) {
                  if (!oldMsgIds.has(newId)) {
                    hasChanges = true;
                    // If this is the selected chat, scroll to bottom
                    if (newInquiry.id === selectedChatIdRef.current) {
                      shouldScroll = true;
                    }
                    break;
                  }
                }
                
                if (hasChanges) break;
              }
              
              // Check if status changed
              if (oldInquiry.status !== newInquiry.status) {
                hasChanges = true;
                break;
              }
            }
            
            // Also check if any old inquiries are missing (deleted)
            if (!hasChanges && prevInquiries.length !== mapped.length) {
              hasChanges = true;
            }
            
            // Update state if there are changes
            if (hasChanges) {
              // Aggressive deduplication by inquiry ID to prevent same inquiry appearing multiple times
              const uniqueById = [];
              const seenIds = new Set();
              const seenKeys = new Set(); // Also check for duplicate keys
              
              mapped.forEach(inquiry => {
                const id = inquiry.id;
                const key = `inquiry-${id}`;
                
                // Only add if we haven't seen this ID before
                if (id && !seenIds.has(id) && !seenKeys.has(key)) {
                  seenIds.add(id);
                  seenKeys.add(key);
                  uniqueById.push(inquiry);
                }
              });
              
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
            
            return prevInquiries; // No changes
          });
          
          // Update attachments for selected chat only
          const currentSelectedId = selectedChatIdRef.current;
          if (currentSelectedId) {
            const selectedInquiry = mapped.find(i => i.id === currentSelectedId);
            if (selectedInquiry) {
              try {
                const attData = await api.getInquiryAttachments(selectedInquiry.id);
                if (attData && attData.attachments) {
                  setAttachments(prev => {
                    const currentAtts = prev[selectedInquiry.id] || [];
                    const newAtts = attData.attachments || [];
                    
                    // Check if attachments changed
                    if (currentAtts.length !== newAtts.length) {
                      return { ...prev, [selectedInquiry.id]: newAtts };
                    }
                    
                    // Check if any attachment IDs are different
                    const currentIds = new Set(currentAtts.map(a => String(a.id)));
                    const newIds = new Set(newAtts.map(a => String(a.id)));
                    if (currentIds.size !== newIds.size || 
                        [...currentIds].some(id => !newIds.has(id))) {
                      return { ...prev, [selectedInquiry.id]: newAtts };
                    }
                    
                    return prev; // No changes
                  });
                }
              } catch (err) {
                // Silently fail for attachment polling errors
                console.debug(`Failed to poll attachments for inquiry ${selectedInquiry.id}:`, err);
              }
            }
          }
        }
      } catch (err) {
        // Log errors but don't spam console
        console.error('Polling error:', err);
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
    
    // Cleanup interval on unmount or when modal closes
    return () => {
      clearTimeout(timeoutId);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      isPollingRef.current = false;
    };
  }, [isOpen, selectedChatId]); // Only depend on isOpen and selectedChatId

  // Update ref when selectedChatId changes
  useEffect(() => {
    selectedChatIdRef.current = selectedChatId;
  }, [selectedChatId]);

  // Final safeguard: Ensure inquiries state never has duplicates
  useEffect(() => {
    if (inquiries.length > 0 && !deduplicatingRef.current) {
      const seenIds = new Set();
      let hasDuplicates = false;
      const unique = inquiries.filter(inquiry => {
        if (!inquiry.id) return false;
        if (seenIds.has(inquiry.id)) {
          hasDuplicates = true;
          console.warn(`Duplicate inquiry detected and removed: ${inquiry.id}`);
          return false;
        }
        seenIds.add(inquiry.id);
        return true;
      });
      
      // Only update if we actually found duplicates to prevent infinite loops
      if (hasDuplicates && unique.length !== inquiries.length) {
        deduplicatingRef.current = true;
        // Removed duplicate inquiries (logging disabled in production)
        setInquiries(unique);
        // Reset flag after state update
        setTimeout(() => {
          deduplicatingRef.current = false;
        }, 100);
      }
    }
  }, [inquiries]);

  // Persist PM selection back so it opens same thread again
  useEffect(() => {
    if (!hydratedRef.current) return;
    try { if (selectedChatId) localStorage.setItem('pm_selected_chat_id', selectedChatId); } catch (_) {}
  }, [selectedChatId]);

  // Debug modal state
  useEffect(() => {
    // showAssignModal state changed (logging disabled in production)
  }, [showAssignModal]);

  const selectedChat = useMemo(() => inquiries.find(c => c.id === selectedChatId) || null, [inquiries, selectedChatId]);

  // Memoize the combined messages and attachments for the selected chat
  const chatMessagesWithAttachments = useMemo(() => {
    if (!selectedChat?.id) return [];
    
    const unmatchedAttachments = getUnmatchedAttachments(selectedChat.id, selectedChat.messages || []);
    const allItems = [];
    
    // Add all messages
    (selectedChat.messages || []).forEach(msg => {
      allItems.push({ type: 'message', data: msg, timestamp: msg.created_at ? new Date(msg.created_at).getTime() : 0 });
    });
    
    // Add unmatched attachments as virtual messages
    unmatchedAttachments.forEach(att => {
      allItems.push({ 
        type: 'attachment', 
        data: att, 
        timestamp: att.created_at ? new Date(att.created_at).getTime() : 0 
      });
    });
    
    // Sort by timestamp
    allItems.sort((a, b) => a.timestamp - b.timestamp);
    
    return allItems;
  }, [selectedChat?.id, selectedChat?.messages, attachments, inquiries, getUnmatchedAttachments]);

  // Auto-scroll to bottom when chat is selected or messages change
  useEffect(() => {
    if (selectedChatId && messagesEndRef.current) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [selectedChatId, chatMessagesWithAttachments.length]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChat) return;
    
    try {
      setLoading(true);
      const messageText = newMessage.trim();
      const response = await api.sendManagerMessage(selectedChat.id, messageText);
      
      if (response && response.success) {
        // Optimistically add the message to the UI immediately
        const currentSelectedId = selectedChatId;
        const tempMessageId = `temp-${Date.now()}`;
        const now = new Date();
        setInquiries(prev => prev.map(c => c.id === selectedChat.id ? {
          ...c,
          status: c.status === 'pending' ? 'responded' : c.status, // Update status from pending to responded
          messages: [...(c.messages || []), { 
            id: tempMessageId,
            sender: 'manager', 
            text: messageText, 
            time: formatMessageTime(now),
            created_at: now.toISOString()
          }]
        } : c));
        setNewMessage('');
        
        // Reload inquiries to get the actual message from backend (with proper ID)
        await loadInquiries();
        
        // Re-select the same chat after reload
        if (currentSelectedId) {
          setSelectedChatId(currentSelectedId);
        }
      } else {
        setError('Failed to send message. Please try again.');
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles(files);
  };

  const handleFileUpload = async () => {
    if (!selectedFiles.length || !selectedChat) return;
    
    try {
      setUploadingFiles(true);
      const response = await api.uploadInquiryAttachments(selectedChat.id, selectedFiles);
      
      if (response && response.attachments) {
        // Uploaded attachments (logging disabled in production)
        // Update attachments for this inquiry immediately
        setAttachments(prev => {
          const updated = {
            ...prev,
            [selectedChat.id]: [...(prev[selectedChat.id] || []), ...response.attachments]
          };
          // Updated attachments state (logging disabled in production)
          return updated;
        });
        setSelectedFiles([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
        
        // Reload to get updated data and ensure everything is in sync
        await loadInquiries();
        
        // Re-select the same chat after reload
        setSelectedChatId(selectedChat.id);
      } else {
        setError('Failed to upload files. Please try again.');
      }
    } catch (err) {
      console.error('Failed to upload files:', err);
      setError('Failed to upload files. Please try again.');
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleDownloadAttachment = async (attachmentId, fileName) => {
    try {
      const blob = await api.downloadInquiryAttachment(attachmentId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to download attachment:', err);
      setError('Failed to download file. Please try again.');
    }
  };

  const handleDeleteAttachment = async (attachmentId, inquiryId) => {
    if (!window.confirm('Are you sure you want to delete this file?')) return;
    
    try {
      await api.deleteInquiryAttachment(attachmentId);
      setAttachments(prev => ({
        ...prev,
        [inquiryId]: (prev[inquiryId] || []).filter(att => att.id !== attachmentId)
      }));
      
      // Reload to get updated data
      await loadInquiries();
    } catch (err) {
      console.error('Failed to delete attachment:', err);
      setError('Failed to delete file. Please try again.');
    }
  };

  const markAsRead = (inquiryId) => {
    // no-op for local prototype; could update a flag in local storage
  };

  const handleAssignTenant = async () => {
    if (!selectedChat) {
      setError('No inquiry selected.');
      return;
    }
    
    try {
      setAssigning(true);
      setError(null);
      
      // Call API to assign tenant to property/unit - pass unit_id if available
      const response = await api.assignTenantToProperty(
        selectedChat.id, 
        selectedChat.propertyId,
        selectedChat.unitId || null,
        selectedChat.unitName || null
      );
      
      if (response && response.success) {
        // Close modal first
        setShowAssignModal(false);
        
        // Immediately update local state to show 'assigned' status (optimistic update)
        const currentSelectedId = selectedChatId;
        setInquiries(prev => prev.map(inquiry => 
          inquiry.id === selectedChat.id 
            ? { ...inquiry, status: 'assigned' }
            : inquiry
        ));
        
        // Reload inquiries to get updated data from backend
        await loadInquiries();
        
        // Re-select the same chat if it was selected
        if (currentSelectedId) {
          setSelectedChatId(currentSelectedId);
        }
        
        // Show success message
        const assignedUnit = response.unit_name || selectedChat.unitName || 'unit';
        let successMsg = `Tenant successfully assigned to ${assignedUnit} in ${selectedChat.property || 'property'}.`;
        if (response.tenant_unit_created !== false) {
          successMsg += ' The tenant can now login to the property subdomain using their account.';
        } else if (response.warning) {
          successMsg += ` Warning: ${response.warning}`;
        }
        alert(successMsg);
      } else {
        // Close assign modal and show error in modal
        setShowAssignModal(false);
        const errorMsg = response?.message || 'Failed to assign tenant. Please try again.';
        setErrorModalMessage(errorMsg);
        setShowErrorModal(true);
        setError(errorMsg);
      }
    } catch (err) {
      console.error('Failed to assign tenant:', err);
      // Close assign modal and show error in modal
      setShowAssignModal(false);
      // Extract error message from API error response
      const errorMsg = err?.data?.message || err?.message || 'Failed to assign tenant. Please try again.';
      setErrorModalMessage(errorMsg);
      setShowErrorModal(true);
      setError(errorMsg);
    } finally {
      setAssigning(false);
    }
  };

  if (!isOpen) return null;

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="bg-black bg-opacity-50 fixed inset-0" onClick={onClose}></div>
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 h-[80vh] flex items-center justify-center relative z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
            <p className="text-gray-600">Loading inquiries...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="bg-black bg-opacity-50 fixed inset-0" onClick={onClose}></div>
      
      {/* Modal Content */}
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 h-[80vh] flex flex-col relative z-10">
        {/* Header */}
        <div className="p-6 border-b flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Property Inquiries</h2>
            <p className="text-sm text-gray-600 mt-1">Manage tenant inquiries for your properties</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mx-6 mt-2">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
                <button 
                  onClick={() => setError(null)}
                  className="text-xs text-red-600 underline mt-1"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('chats')}
          className={`px-6 py-3 font-medium ${
            activeTab === 'chats'
              ? 'text-black border-b-2 border-black'
              : 'text-gray-500 hover:text-black'
          }`}
        >
          Active Chats ({inquiries.length})
        </button>
        <button
          onClick={() => setActiveTab('new')}
          className={`px-6 py-3 font-medium ${
            activeTab === 'new'
              ? 'text-black border-b-2 border-black'
              : 'text-gray-500 hover:text-black'
          }`}
        >
          New Inquiries ({inquiries.filter(i => i.status === 'new' || i.status === 'pending').length})
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'chats' ? (
          <div className="flex h-full">
            {/* Chat List */}
            <div className="w-1/3 border-r overflow-y-auto">
                {inquiries.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  <div className="mb-4">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.959 8.959 0 01-4.906-1.456L3 21l2.456-5.094A8.959 8.959 0 013 12c0-4.418 3.582-8 8-8s8 3.582 8 8z" />
                    </svg>
                  </div>
                  <p>No inquiries yet.</p>
                  <p className="text-sm mt-1">Inquiries will appear here when tenants contact you about your properties.</p>
                </div>
                ) : (
                inquiries.filter((inquiry, index, self) => 
                  // Additional deduplication: ensure each ID appears only once
                  index === self.findIndex(i => i.id === inquiry.id)
                ).map((inquiry) => (
                  <div
                    key={`inquiry-${inquiry.id}`}
                    onClick={() => {
                      setSelectedChatId(inquiry.id);
                      setCopiedLink(false); // Reset copied state when switching inquiries
                      if (inquiry.unread_count > 0) {
                        markAsRead(inquiry.id);
                      }
                    }}
                    className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${
                      selectedChatId === inquiry.id ? 'bg-gray-100 border-black' : ''
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                        <span className="text-gray-600 font-medium">
                          {(inquiry.tenantName || 'T').toString().slice(0,2).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {inquiry.tenantName || 'Tenant'}
                        </p>
                        <p className="text-sm text-gray-500 truncate">
                          {inquiry.unitName ? `${inquiry.unitName}/${inquiry.property}` : inquiry.property || 'Property'}
                        </p>
                        <p className="text-xs text-gray-400">
                          {inquiry.messages?.[inquiry.messages.length - 1]?.time || 'No messages'}
                        </p>
                      </div>
                      <div className="flex flex-col items-end space-y-1">
                        {inquiry.unread_count > 0 && (
                          <span className="bg-black text-white text-xs rounded-full px-2 py-1">
                            {inquiry.unread_count}
                          </span>
                        )}
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          inquiry.status === 'new' ? 'bg-gray-200 text-black' :
                          inquiry.status === 'pending' ? 'bg-yellow-100 text-yellow-800 border border-yellow-300 font-medium' :
                          inquiry.status === 'active' ? 'bg-gray-300 text-black' :
                          inquiry.status === 'assigned' ? 'bg-green-500 text-white font-semibold' :
                          inquiry.status === 'responded' ? 'bg-gray-200 text-black' :
                          inquiry.status === 'read' ? 'bg-blue-100 text-blue-800' :
                          inquiry.status === 'closed' ? 'bg-gray-400 text-white' :
                          'bg-gray-100 text-black'
                        }`}>
                          {inquiry.status === 'assigned' ? 'ASSIGNED' : 
                           inquiry.status === 'pending' ? 'PENDING' :
                           (inquiry.status || 'active').toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Chat Messages */}
            <div className="flex-1 flex flex-col">
              {selectedChat ? (
                <>
                  {/* Chat Header */}
                  <div className="p-4 border-b bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">{selectedChat.tenantName || selectedChat.tenant?.name}</h3>
                        <p className="text-sm text-gray-500">
                          Interested in: {selectedChat.unitName ? `${selectedChat.unitName}/${selectedChat.property}` : selectedChat.property || 'Property'}
                        </p>
                        {(selectedChat.tenantEmail || selectedChat.tenant?.email || selectedChat.tenantPhone || selectedChat.tenant?.phone) && (
                          <p className="text-xs text-gray-400">
                            {[selectedChat.tenantEmail || selectedChat.tenant?.email, selectedChat.tenantPhone || selectedChat.tenant?.phone].filter(Boolean).join(' • ')}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center space-x-3">
                        {(selectedChat.status?.toLowerCase() !== 'assigned' && selectedChat.status?.toLowerCase() !== 'closed') && (
                          <button
                            onClick={() => {
                              setShowAssignModal(true);
                            }}
                            className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 text-sm font-medium transition-colors"
                          >
                            Assign to {selectedChat.unitName ? `Unit ${selectedChat.unitName}` : 'Tenant'}
                          </button>
                        )}
                        {selectedChat.status?.toLowerCase() === 'assigned' && (
                          <div className="flex items-center space-x-2">
                            <span className="bg-green-500 text-white px-3 py-2 rounded-lg text-sm font-semibold">
                              ✓ ASSIGNED
                            </span>
                            {(() => {
                              // Try multiple paths to get property object
                              const property = selectedChat.propertyObj || 
                                             selectedChat.inquiry?.property || 
                                             (selectedChat.inquiry?.property_id ? { id: selectedChat.inquiry.property_id } : null);
                              const subdomainUrl = getSubdomainUrl(property);
                              
                              if (!subdomainUrl) return null;
                              
                              return (
                                <button
                                  onClick={() => handleCopySubdomainLink(property)}
                                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
                                  title="Copy subdomain link to send to tenant"
                                >
                                  {copiedLink ? (
                                    <>
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                      <span>Copied!</span>
                                    </>
                                  ) : (
                                    <>
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                      </svg>
                                      <span>Copy Link</span>
                                    </>
                                  )}
                                </button>
                              );
                            })()}
                          </div>
                        )}
                        {selectedChat.status?.toLowerCase() === 'closed' && (
                          <span className="bg-gray-400 text-white px-3 py-2 rounded-lg text-sm font-semibold">
                            CLOSED
                          </span>
                        )}
                        <div className="text-right">
                          {selectedChat.price && (
                            <p className="text-sm font-medium text-black">
                              {selectedChat.price}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Render combined messages and unmatched attachments */}
                    {chatMessagesWithAttachments.map((item, idx) => {
                        if (item.type === 'attachment') {
                          const att = item.data;
                          // Determine sender based on uploaded_by
                          const currentInquiry = inquiries.find(i => i.id === selectedChat.id);
                          const isManager = currentInquiry?.inquiry?.property_manager_id && 
                                           att.uploaded_by && 
                                           String(att.uploaded_by) === String(currentInquiry.inquiry.property_manager_id);
                          const sender = isManager ? 'manager' : 'tenant';
                          
                          return (
                            <div
                              key={`att-${att.id}`}
                              className={`flex ${sender === 'manager' ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-xs lg:max-w-md rounded-lg overflow-hidden ${
                                  sender === 'manager' ? 'bg-black text-white' : 'bg-gray-200 text-black'
                                }`}
                              >
                                {/* Images and Videos */}
                                {(isImage(att.mime_type, att.file_type) || isVideo(att.mime_type, att.file_type)) && (
                                  <div className="relative">
                                    {isImage(att.mime_type, att.file_type) ? (
                                      <MediaDisplay
                                        attachment={att}
                                        type="image"
                                        getMediaUrl={getMediaUrl}
                                        getAttachmentUrl={getAttachmentUrl}
                                        onImageClick={setLightboxImage}
                                      />
                                    ) : (
                                      <MediaDisplay
                                        attachment={att}
                                        type="video"
                                        getMediaUrl={getMediaUrl}
                                        getAttachmentUrl={getAttachmentUrl}
                                        onImageClick={setLightboxImage}
                                      />
                                    )}
                                  </div>
                                )}
                                
                                {/* File Attachments */}
                                {!isImage(att.mime_type, att.file_type) && !isVideo(att.mime_type, att.file_type) && (
                                  <div className="px-4 pt-2 pb-2">
                                    <div
                                      className={`flex items-center space-x-2 p-2 rounded ${
                                        sender === 'manager'
                                          ? 'bg-gray-800'
                                          : 'bg-gray-300'
                                      }`}
                                    >
                                      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium truncate">{att.file_name}</p>
                                        <p className="text-xs opacity-75">
                                          {(att.file_size / 1024).toFixed(1)} KB
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
                                
                                {/* Timestamp */}
                                <div className="px-4 pb-2">
                                  <p className={`text-xs ${sender === 'manager' ? 'text-gray-300' : 'text-gray-600'}`}>
                                    {formatMessageTime(att.created_at)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        } else {
                          // Regular message
                          const message = item.data;
                          const inquiryId = selectedChat?.id;
                          if (!inquiryId) return null;
                          const messageAttachments = getMessageAttachments(message, inquiryId);
                          const hasAttachments = messageAttachments.length > 0;
                          const hasText = (message.text || message.content) && (message.text || message.content).trim().length > 0;
                          
                          return (
                            <div
                              key={message.id}
                              className={`flex ${message.sender === 'manager' ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-xs lg:max-w-md rounded-lg overflow-hidden ${
                                  message.sender === 'manager' ? 'bg-black text-white' : 'bg-gray-200 text-black'
                                }`}
                              >
                                {/* Images and Videos */}
                                {hasAttachments && messageAttachments.filter(att => isImage(att.mime_type, att.file_type) || isVideo(att.mime_type, att.file_type)).length > 0 && (
                                  <div className="space-y-1">
                                    {messageAttachments
                                      .filter(att => isImage(att.mime_type, att.file_type) || isVideo(att.mime_type, att.file_type))
                                      .map((att) => (
                                        <div key={att.id} className="relative">
                                          {isImage(att.mime_type, att.file_type) ? (
                                            <MediaDisplay
                                              attachment={att}
                                              type="image"
                                              getMediaUrl={getMediaUrl}
                                              getAttachmentUrl={getAttachmentUrl}
                                              onImageClick={setLightboxImage}
                                            />
                                          ) : (
                                            <MediaDisplay
                                              attachment={att}
                                              type="video"
                                              getMediaUrl={getMediaUrl}
                                              getAttachmentUrl={getAttachmentUrl}
                                              onImageClick={setLightboxImage}
                                            />
                                          )}
                                        </div>
                                      ))}
                                  </div>
                                )}
                                
                                {/* Text Message */}
                                {hasText && (
                                  <div className="px-4 py-2">
                                    <p className="text-sm whitespace-pre-wrap break-words">{message.text || message.content}</p>
                                  </div>
                                )}
                                
                                {/* File Attachments */}
                                {hasAttachments && messageAttachments.filter(att => !isImage(att.mime_type, att.file_type) && !isVideo(att.mime_type, att.file_type)).length > 0 && (
                                  <div className={`px-4 ${hasText ? 'pt-2' : 'pt-2'} pb-2 space-y-2`}>
                                    {messageAttachments
                                      .filter(att => !isImage(att.mime_type, att.file_type) && !isVideo(att.mime_type, att.file_type))
                                      .map((att) => (
                                        <div
                                          key={att.id}
                                          className={`flex items-center space-x-2 p-2 rounded ${
                                            message.sender === 'manager'
                                              ? 'bg-gray-800'
                                              : 'bg-gray-300'
                                          }`}
                                        >
                                          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                          </svg>
                                          <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium truncate">{att.file_name}</p>
                                            <p className="text-xs opacity-75">
                                              {(att.file_size / 1024).toFixed(1)} KB
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
                                      ))}
                                  </div>
                                )}
                                
                                {/* Timestamp */}
                                <div className={`px-4 pb-2 ${hasAttachments && !hasText ? 'pt-2' : ''}`}>
                                  <p className={`text-xs ${message.sender === 'manager' ? 'text-gray-300' : 'text-gray-600'}`}>
                                    {message.time || formatMessageTime(message.created_at)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        }
                      })}
                    
                    {(!selectedChat.messages || selectedChat.messages.length === 0) && 
                     (!attachments[selectedChat.id] || attachments[selectedChat.id].length === 0) && (
                      <div className="text-center text-gray-500 py-8">
                        <p>No messages yet. The tenant is waiting for your response!</p>
                      </div>
                    )}
                    {/* Scroll anchor for auto-scroll to bottom */}
                    <div ref={messagesEndRef} />
                  </div>


                  {/* Message Input */}
                  <div className="p-4 border-t">
                    {/* File Selection Preview */}
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
                    
                    <div className="flex space-x-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
                        onChange={handleFileSelect}
                        className="hidden"
                        id="pm-file-input"
                      />
                      <label
                        htmlFor="pm-file-input"
                        className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center hover:bg-gray-200 transition-colors cursor-pointer"
                      >
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                      </label>
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type your response..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-black placeholder-gray-400"
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={!newMessage.trim() || loading}
                        className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.959 8.959 0 01-4.906-1.456L3 21l2.456-5.094A8.959 8.959 0 013 12c0-4.418 3.582-8 8-8s8 3.582 8 8z" />
                    </svg>
                    <p>Select an inquiry to view messages</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* New Inquiries Tab */
          <div className="p-6 overflow-y-auto">
            <div className="space-y-4">
              {inquiries.filter(i => i.status === 'new' || i.status === 'pending').length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <div className="mb-4">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2 2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                  </div>
                  <p>No new inquiries</p>
                  <p className="text-sm mt-1">New tenant inquiries will appear here.</p>
                </div>
              ) : (
                inquiries.filter(i => i.status === 'new' || i.status === 'pending')
                  .filter((inquiry, index, self) => 
                    // Additional deduplication: ensure each ID appears only once
                    index === self.findIndex(i => i.id === inquiry.id)
                  )
                  .map((inquiry) => (
                  <div key={`new-inquiry-${inquiry.id}`} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start space-x-4">
                      {inquiry.property?.images?.[0] ? (
                        <img
                          src={inquiry.property.images[0]}
                          alt={inquiry.property?.title}
                          className="w-16 h-16 object-cover rounded-lg"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div 
                        className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center"
                        style={{ display: inquiry.property?.images?.[0] ? 'none' : 'flex' }}
                      >
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium text-gray-900">{inquiry.tenant?.name}</h4>
                            <p className="text-sm text-gray-600">{inquiry.tenant?.email}</p>
                            <p className="text-sm text-gray-500 mt-1">
                              Interested in: <span className="font-medium">{inquiry.unitName ? `${inquiry.unitName}/${inquiry.property}` : inquiry.property || 'Property'}</span>
                            </p>
                          </div>
                          <div className="text-right">
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              inquiry.status === 'pending' ? 'bg-yellow-100 text-yellow-800 border border-yellow-300 font-medium' :
                              'bg-gray-200 text-black'
                            }`}>
                              {inquiry.status === 'pending' ? 'PENDING' : 'NEW'}
                            </span>
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(inquiry.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 flex space-x-2">
                          <button
                            onClick={() => {
                              setSelectedChatId(inquiry.id);
                              setActiveTab('chats');
                              markAsRead(inquiry.id);
                            }}
                            className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 text-sm"
                          >
                            Respond
                          </button>
                          <button className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 text-sm">
                            View Property
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
      </div>

      {/* Assign Tenant Confirmation Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black bg-opacity-50" 
            onClick={() => setShowAssignModal(false)}
          ></div>
          
          {/* Modal Content */}
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 z-10">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center mr-3">
                  <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Assign Tenant to Unit</h3>
              </div>
              
              {/* Content */}
              <div className="mb-6">
                <p className="text-gray-600 mb-4">
                  Are you sure you want to assign <strong>{selectedChat?.tenantName || selectedChat?.tenant?.name || 'this tenant'}</strong> to <strong>{selectedChat?.unitName ? `Unit ${selectedChat.unitName}` : 'a unit'}</strong> in <strong>{selectedChat?.property || 'this property'}</strong>?
                </p>
                
                <div className="bg-gray-100 border border-gray-300 rounded-lg p-3">
                  <p className="text-sm text-black">
                    <strong>Warning:</strong> This will change the unit status from vacant to occupied and create a tenancy record. The unit will no longer appear in tenant listings.
                  </p>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowAssignModal(false)}
                  disabled={assigning}
                  className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignTenant}
                  disabled={assigning}
                  className="flex-1 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                >
                  {assigning ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Assigning...
                    </>
                  ) : (
                    'Confirm Assignment'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {showErrorModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black bg-opacity-50" 
            onClick={() => setShowErrorModal(false)}
          ></div>
          
          {/* Modal Content */}
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 z-10">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-3">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Assignment Error</h3>
              </div>
              
              {/* Content */}
              <div className="mb-6">
                <p className="text-gray-600">
                  {errorModalMessage}
                </p>
              </div>
              
              {/* Actions */}
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setShowErrorModal(false);
                    setErrorModalMessage('');
                  }}
                  className="bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={lightboxImage.url}
              alt={lightboxImage.fileName}
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