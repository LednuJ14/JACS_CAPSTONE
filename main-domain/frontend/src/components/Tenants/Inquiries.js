import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import api from '../../services/api';

// Props:
// - onClose(): close modal
// - initialChat: { id?, managerName, property, unitId, propertyId }
const Inquiries = ({ onClose, initialChat = null }) => {
  const [message, setMessage] = useState('');
  const [chats, setChats] = useState([]); // [{id, managerName, property, avatar, status, messages: [{id, sender, text, time}]}]
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [attachments, setAttachments] = useState({}); // {inquiryId: [attachments]}
  const hydratedRef = useRef(false);
  const preFilledMessageRef = useRef(new Set()); // Track which chats have had messages pre-filled
  const messageInputRef = useRef(null); // Reference to the message input element
  const fileInputRef = useRef(null);
  const [lightboxImage, setLightboxImage] = useState(null); // {url, fileName} for lightbox modal

  // Media Display Component
  const MediaDisplay = ({ attachment, type, getMediaUrl, getAttachmentUrl, onImageClick }) => {
    const [url, setUrl] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
      let isMounted = true;
      setLoading(true);
      setError(false);
      
      console.log('MediaDisplay: Loading attachment', attachment.id, attachment.file_name, attachment.mime_type);
      
      getMediaUrl(attachment.id).then(mediaUrl => {
        if (isMounted) {
          if (mediaUrl) {
            console.log('MediaDisplay: Successfully loaded media URL for', attachment.id);
            setUrl(mediaUrl);
            setLoading(false);
          } else {
            console.error('MediaDisplay: Failed to get media URL for attachment:', attachment.id);
            setError(true);
            setLoading(false);
          }
        }
      }).catch(err => {
        if (isMounted) {
          console.error('MediaDisplay: Error loading media:', err, attachment);
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

  // Helper to get attachment URL (for download)
  const getAttachmentUrl = (attachmentId) => {
    return `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/inquiries/attachments/${attachmentId}`;
  };

  // Helper to get authenticated image/video URL
  const [mediaUrls, setMediaUrls] = useState({}); // Cache for blob URLs
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
  const loadInquiries = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Check if user is authenticated
      const accessToken = localStorage.getItem('access_token') || localStorage.getItem('token');
      if (!accessToken) {
        setError('Please log in to view your inquiries.');
        setLoading(false);
        return;
      }
      
      const response = await api.getTenantInquiries();
      if (response && response.inquiries) {
        // Helper: explode concatenated text (tenant + manager) into chronological bubbles with embedded timestamps
        const toMessages = (inq) => {
          // Start with messages from inquiry_messages table if available (new format)
          const newFormatMsgs = [];
          if (inq.messages && Array.isArray(inq.messages) && inq.messages.length > 0) {
            inq.messages.forEach(msg => {
              newFormatMsgs.push({
                id: `msg-${msg.id}`,
                sender: msg.sender || (msg.sender_id === inq.tenant_id ? 'tenant' : 'manager'),
                text: msg.message || msg.text || '',
                time: formatMessageTime(msg.created_at),
                created_at: msg.created_at
              });
            });
          }
          
          // Parse old format messages (for backward compatibility and initial messages)
          const oldFormatMsgs = [];
          
          // Fallback: Parse old format messages (for backward compatibility)
          const regex = /\n\n--- New Message(?: \[(\d{10,})\])? ---\n/g;
          const chunks = [];
          let lastIndex = 0;
          let match;
          while ((match = regex.exec(String(inq.message || ''))) !== null) {
            const ts = match[1] ? Number(match[1]) : null;
            const text = String(inq.message || '').slice(lastIndex, match.index);
            if (text) chunks.push({ text, ts: null });
            lastIndex = match.index + match[0].length;
            chunks.push({ text: null, ts });
          }
          const tail = String(inq.message || '').slice(lastIndex);
          if (tail) chunks.push({ text: tail, ts: null });

          // Merge markers (ts) with following text blocks
          const parts = [];
          let pendingTs = null;
          for (const c of chunks) {
            if (c.text === null && c.ts) {
              pendingTs = c.ts;
            } else if (c.text) {
              parts.push({ text: c.text, ts: pendingTs });
              pendingTs = null;
            }
          }

          parts.forEach((p, idx) => {
            let cleanText = p.text || '';
            cleanText = cleanText.replace(/^---\s*New\s*Message\s*\[?\d*\]?\s*---\s*/gi, '').trim();
            cleanText = cleanText.replace(/\s*---\s*New\s*Message\s*\[?\d*\]?\s*---\s*$/gi, '').trim();
            if (!cleanText) return;
            
            const placeholderPatterns = [
              /^inquiry\s+started$/i,
              /^placeholder$/i,
              /^init$/i
            ];
            if (placeholderPatterns.some(pattern => pattern.test(cleanText))) {
              return;
            }
            
            oldFormatMsgs.push({
              id: `${inq.id}-t-${idx}`,
              sender: 'tenant',
              text: cleanText,
              time: formatMessageTime(p.ts ? new Date(p.ts) : new Date()),
              created_at: p.ts ? new Date(p.ts).toISOString() : new Date().toISOString()
            });
          });

          // Also explode manager replies stored in response_message (old format)
          if (inq.response_message) {
            const mSep = /\n\n--- Manager Reply \[(\d{10,})\] ---\n/g;
            const mSrc = String(inq.response_message || '');
            const mParts = []; let mLast = 0; let mm;
            while ((mm = mSep.exec(mSrc)) !== null) {
              const txt = mSrc.slice(mLast, mm.index);
              if (txt) mParts.push({ text: txt, ts: null });
              mParts.push({ text: null, ts: mm[1] ? Number(mm[1]) : null });
              mLast = mm.index + mm[0].length;
            }
            const mTail = mSrc.slice(mLast); if (mTail) mParts.push({ text: mTail, ts: null });
            let mPending = null; const now = Date.now();
            for (const part of mParts) {
              if (part.text === null) { mPending = part.ts; continue; }
              let cleanText = part.text || '';
              cleanText = cleanText.replace(/^---\s*Manager\s*Reply\s*\[?\d*\]?\s*---\s*/gi, '').trim();
              cleanText = cleanText.replace(/\s*---\s*Manager\s*Reply\s*\[?\d*\]?\s*---\s*$/gi, '').trim();
              if (!cleanText) continue;
              
              oldFormatMsgs.push({ 
                id: `${inq.id}-m-${oldFormatMsgs.length}`, 
                sender: 'manager', 
                text: cleanText, 
                time: formatMessageTime(mPending ? new Date(mPending) : new Date(now)),
                created_at: mPending ? new Date(mPending).toISOString() : new Date(now).toISOString()
              });
              mPending = null;
            }
          }
          
          // Merge new format and old format messages, removing duplicates
          const allMsgs = [...newFormatMsgs, ...oldFormatMsgs];
          
          // Remove duplicates based on text content and sender
          const uniqueMsgs = [];
          const seenTexts = new Set();
          for (const msg of allMsgs) {
            const textKey = `${msg.sender}-${msg.text}`;
            if (!seenTexts.has(textKey)) {
              seenTexts.add(textKey);
              uniqueMsgs.push(msg);
            }
          }
          
          // Sort by created_at timestamp or time
          uniqueMsgs.sort((a, b) => {
            const timeA = a.created_at ? new Date(a.created_at).getTime() : 
                         (a.time ? new Date(`2000-01-01 ${a.time}`).getTime() : 0);
            const timeB = b.created_at ? new Date(b.created_at).getTime() : 
                         (b.time ? new Date(`2000-01-01 ${b.time}`).getTime() : 0);
            return timeA - timeB;
          });
          
          return uniqueMsgs;
        };

        // Map and de-duplicate by propertyId
        const mapped = response.inquiries.map(inquiry => ({
          id: inquiry.id,
          managerName: (inquiry.property_manager?.first_name || 'Property') + ' ' + (inquiry.property_manager?.last_name || 'Manager'),
          property: inquiry.property?.title || inquiry.property?.building_name || 'Property',
          propertyId: inquiry.property_id,
          unitId: inquiry.unit_id || inquiry.property_id,
          unitName: inquiry.unit_name || inquiry.property?.title || inquiry.property?.building_name || 'Property',
          avatar: '🏢',
          status: inquiry.status,
          messages: toMessages(inquiry),
          attachments: inquiry.attachments || [],
          inquiry
        }));
        const dedup = [];
        const seen = new Set();
        for (const c of mapped) {
          const key = String(c.propertyId);
          if (seen.has(key)) continue;
          seen.add(key);
          dedup.push(c);
        }
        setChats(dedup);
        
        // Load attachments for all inquiries
        for (const chat of dedup) {
          try {
            const attData = await api.getInquiryAttachments(chat.id);
            if (attData && attData.attachments) {
              setAttachments(prev => ({ ...prev, [chat.id]: attData.attachments }));
            }
          } catch (err) {
            console.error(`Failed to load attachments for inquiry ${chat.id}:`, err);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load inquiries:', err);
      if (err.status === 401) {
        setError('Please log in to view your inquiries.');
        // Optionally redirect to login
        // window.location.href = '/login';
      } else {
        setError('Failed to load inquiries. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Load inquiries on mount
  useEffect(() => {
    loadInquiries();
      hydratedRef.current = true;
  }, []);

  // Persist chats and selection whenever they change
  useEffect(() => {
    if (!hydratedRef.current) return; // avoid wiping storage with initial empty state
    try {
      if (Array.isArray(chats)) localStorage.setItem('tenant_chats', JSON.stringify(chats));
      if (selectedChatId) {
        localStorage.setItem('tenant_selected_chat_id', selectedChatId);
      }
    } catch (_) {
      // storage may be unavailable
    }
  }, [chats, selectedChatId]);

  // Create or reuse inquiry when opened from "INQUIRE NOW"
  useEffect(() => {
    if (!initialChat || !initialChat.propertyId) return;

    const ensureInquiry = async () => {
      try {
        setLoading(true);
        // 1) Load current inquiries to avoid duplicates
        let existing = chats;
        if (!Array.isArray(existing) || existing.length === 0) {
          try {
            const res = await api.getTenantInquiries();
            if (res && Array.isArray(res.inquiries)) {
              // Reuse the same parser as in main load
              const parser = (inq) => {
                const regex = /\n\n--- New Message(?: \[(\d{10,})\])? ---\n/g;
                const chunks = []; let last = 0; let m;
                while ((m = regex.exec(String(inq.message || ''))) !== null) {
                  const txt = String(inq.message || '').slice(last, m.index);
                  if (txt) chunks.push({ text: txt, ts: null });
                  chunks.push({ text: null, ts: m[1] ? Number(m[1]) : null });
                  last = m.index + m[0].length;
                }
                const tail = String(inq.message || '').slice(last);
                if (tail) chunks.push({ text: tail, ts: null });
                const out = []; let pending = null; const now = Date.now();
                for (const c of chunks) {
                  if (c.text === null) { pending = c.ts; continue; }
                  // Clean the text - remove any separator prefixes
                  let cleanText = c.text || '';
                  cleanText = cleanText.replace(/^---\s*New\s*Message\s*\[?\d*\]?\s*---\s*/gi, '').trim();
                  cleanText = cleanText.replace(/\s*---\s*New\s*Message\s*\[?\d*\]?\s*---\s*$/gi, '').trim();
                  // Skip empty messages after cleaning
                  if (!cleanText) continue;
                  
                  // Filter out placeholder messages
                  const placeholderPatterns = [/^inquiry\s+started$/i, /^placeholder$/i, /^init$/i];
                  if (placeholderPatterns.some(pattern => pattern.test(cleanText))) {
                    continue;
                  }
                  
                  out.push({ id: `${inq.id}-t-${out.length}`, sender: 'tenant', text: cleanText, time: new Date(pending || now).toLocaleTimeString() });
                  pending = null;
                }
                if (inq.response_message) {
                  // Clean manager reply too
                  let cleanReply = String(inq.response_message || '').replace(/^---\s*Manager\s*Reply\s*\[?\d*\]?\s*---\s*/gi, '').trim();
                  cleanReply = cleanReply.replace(/\s*---\s*Manager\s*Reply\s*\[?\d*\]?\s*---\s*$/gi, '').trim();
                  if (cleanReply) {
                    out.push({ id: `${inq.id}-m`, sender: 'manager', text: cleanReply, time: new Date(inq.responded_at || now).toLocaleTimeString() });
                  }
                }
                return out;
              };

              const mapped = res.inquiries.map(inquiry => ({
                id: inquiry.id,
                managerName: (inquiry.property_manager?.first_name || 'Property') + ' ' + (inquiry.property_manager?.last_name || 'Manager'),
                property: inquiry.property?.title || inquiry.property?.building_name || 'Property',
                propertyId: inquiry.property_id,
                unitId: inquiry.unit_id || inquiry.property_id,
                unitName: inquiry.unit_name || inquiry.property?.title || inquiry.property?.building_name || 'Property',
                avatar: '🏢',
                status: inquiry.status,
                messages: parser(inquiry),
                inquiry
              }));
              existing = mapped;
              setChats(mapped);
            }
          } catch (_) { /* ignore load errors here */ }
        }

        // 2) If an inquiry for this property already exists, just select it and pre-fill message
        const match = (existing || []).find(c => Number(c.propertyId) === Number(initialChat.propertyId));
        if (match) {
          setSelectedChatId(match.id);
          
          // Pre-fill message - use a more aggressive approach
          const preFillMsg = match.messages && match.messages.length > 0
            ? `Hello! I'm still interested in ${initialChat.unitName || initialChat.property || 'this unit'}. Could you please provide an update?`
            : `Hello! I'm interested in ${initialChat.unitName || initialChat.property || 'this unit'}. Please provide more information about availability, viewing options, and pricing details. Thank you!`;
          
          // Force set multiple times to ensure it appears - use both state and direct DOM manipulation
          const forceSetMessage = (msg) => {
            setMessage(msg);
            if (messageInputRef.current) {
              messageInputRef.current.value = msg;
              const event = new Event('input', { bubbles: true });
              messageInputRef.current.dispatchEvent(event);
            }
          };
          
          forceSetMessage('');
          setTimeout(() => forceSetMessage(preFillMsg), 10);
          setTimeout(() => forceSetMessage(preFillMsg), 50);
          setTimeout(() => forceSetMessage(preFillMsg), 100);
          setTimeout(() => forceSetMessage(preFillMsg), 200);
          setTimeout(() => forceSetMessage(preFillMsg), 400);
          
          return;
        }

        // 3) Otherwise, create one - send a minimal placeholder message (required by backend) but don't display it
        // Instead, pre-fill the text box with the actual message for user to send manually
        const placeholderMessage = "Inquiry started"; // Minimal message required by backend
        const response = await api.startTenantInquiry(
          initialChat.propertyId,
          placeholderMessage,
          initialChat.unitId || null
        );

        if (response && response.inquiry) {
          const newChat = {
            id: response.inquiry.id,
            managerName: (response.inquiry.property_manager?.first_name || 'Property') + ' ' + (response.inquiry.property_manager?.last_name || 'Manager'),
            property: response.inquiry.property?.title || response.inquiry.property?.building_name || 'Property',
            propertyId: response.inquiry.property_id,
            unitId: response.inquiry.unit_id || response.inquiry.property_id,
            unitName: initialChat.unitName || response.inquiry.unit_name || response.inquiry.property?.title || response.inquiry.property?.building_name || 'Property',
            avatar: '🏢',
            status: response.inquiry.status,
            // Don't show the placeholder message in chat - start with empty messages array
            messages: [],
            inquiry: response.inquiry
          };
          
          // Add to chats and select it
          setChats(prev => {
            // Remove any duplicate for this property
            const filtered = prev.filter(c => Number(c.propertyId) !== Number(newChat.propertyId));
            return [...filtered, newChat];
          });
          setSelectedChatId(newChat.id);
          
          // Pre-fill message with the actual message user should send (ready-to-send, not auto-sent)
          const preFillMsg = `Hello! I'm interested in ${initialChat.unitName || initialChat.property || 'this unit'}. Please provide more information about availability, viewing options, and pricing details. Thank you!`;
          
          // Force set multiple times to ensure it appears - use both state and direct DOM manipulation
          const forceSetMessage = (msg) => {
            setMessage(msg);
            if (messageInputRef.current) {
              messageInputRef.current.value = msg;
              const event = new Event('input', { bubbles: true });
              messageInputRef.current.dispatchEvent(event);
            }
          };
          
          // Clear first, then set the message multiple times
          forceSetMessage('');
          setTimeout(() => forceSetMessage(preFillMsg), 10);
          setTimeout(() => forceSetMessage(preFillMsg), 50);
          setTimeout(() => forceSetMessage(preFillMsg), 100);
          setTimeout(() => forceSetMessage(preFillMsg), 200);
          setTimeout(() => forceSetMessage(preFillMsg), 400);
          
          // Reload inquiries after a delay to ensure everything is in sync
          setTimeout(async () => {
            await loadInquiries();
            // Ensure the chat is still selected and message is set after reload
            setSelectedChatId(newChat.id);
            setTimeout(() => forceSetMessage(preFillMsg), 100);
          }, 300);
        }
        else if (response && response.message === 'Inquiry already exists' && response.inquiry) {
          // Select the existing inquiry
          const existingChat = {
            id: response.inquiry.id,
            managerName: (response.inquiry.property_manager?.first_name || 'Property') + ' ' + (response.inquiry.property_manager?.last_name || 'Manager'),
            property: response.inquiry.property?.title || response.inquiry.property?.building_name || 'Property',
            propertyId: response.inquiry.property_id,
            unitId: response.inquiry.unit_id || response.inquiry.property_id,
            unitName: initialChat.unitName || response.inquiry.unit_name || response.inquiry.property?.title || response.inquiry.property?.building_name || 'Property',
            avatar: '🏢',
            status: response.inquiry.status,
            messages: (function(){
              const inq = response.inquiry;
              // Use regex to properly split messages with timestamp support
              const regex = /\n\n--- New Message(?: \[(\d{10,})\])? ---\n/g;
              const parts = [];
              let lastIndex = 0;
              let match;
              let timestamps = [];
              
              while ((match = regex.exec(String(inq.message || ''))) !== null) {
                const textBefore = String(inq.message || '').slice(lastIndex, match.index);
                if (textBefore.trim()) {
                  parts.push({ text: textBefore, ts: timestamps[parts.length] || null });
                }
                timestamps.push(match[1] ? Number(match[1]) : null);
                lastIndex = match.index + match[0].length;
              }
              
              const tail = String(inq.message || '').slice(lastIndex);
              if (tail.trim()) {
                parts.push({ text: tail, ts: timestamps[parts.length] || null });
              }
              
              const nowMs = Date.now();
              const startMs = nowMs - (Math.max(0, parts.length - 1) * 60000);
              
              return parts.map((p, idx) => {
                // Clean the text - remove any separator prefixes
                let cleanText = p.text || '';
                cleanText = cleanText.replace(/^---\s*New\s*Message\s*\[?\d*\]?\s*---\s*/gi, '').trim();
                cleanText = cleanText.replace(/\s*---\s*New\s*Message\s*\[?\d*\]?\s*---\s*$/gi, '').trim();
                // Skip empty messages
                if (!cleanText) return null;
                
                // Filter out placeholder messages
                const placeholderPatterns = [/^inquiry\s+started$/i, /^placeholder$/i, /^init$/i];
                if (placeholderPatterns.some(pattern => pattern.test(cleanText))) {
                  return null;
                }
                
                return {
                  id: `${inq.id}-t-${idx}`,
                  sender: 'tenant',
                  text: cleanText,
                  time: new Date(p.ts || startMs + idx * 60000).toLocaleTimeString()
                };
              }).filter(Boolean); // Remove null entries
            })(),
            inquiry: response.inquiry
          };
          setChats(prev => {
            // Remove any duplicate for this property
            const filtered = prev.filter(c => Number(c.propertyId) !== Number(existingChat.propertyId));
            return [...filtered, existingChat];
          });
          setSelectedChatId(existingChat.id);
          
          // Pre-fill message - use a more aggressive approach
          const preFillMsg = existingChat.messages && existingChat.messages.length > 0
            ? `Hello! I'm still interested in ${initialChat.unitName || initialChat.property || 'this unit'}. Could you please provide an update?`
            : `Hello! I'm interested in ${initialChat.unitName || initialChat.property || 'this unit'}. Please provide more information about availability, viewing options, and pricing details. Thank you!`;
          
          // Force set multiple times to ensure it appears - use both state and direct DOM manipulation
          const forceSetMessage = (msg) => {
            setMessage(msg);
            if (messageInputRef.current) {
              messageInputRef.current.value = msg;
              const event = new Event('input', { bubbles: true });
              messageInputRef.current.dispatchEvent(event);
            }
          };
          
          forceSetMessage('');
          setTimeout(() => forceSetMessage(preFillMsg), 10);
          setTimeout(() => forceSetMessage(preFillMsg), 50);
          setTimeout(() => forceSetMessage(preFillMsg), 100);
          setTimeout(() => forceSetMessage(preFillMsg), 200);
          setTimeout(() => forceSetMessage(preFillMsg), 400);
        }
      } catch (err) {
        console.error('Failed to create inquiry:', err);
        if (err.status === 401) {
          setError('Please log in to create an inquiry.');
        } else if (err.status === 500) {
          setError('Server error. Please try again later.');
        } else {
          setError('Failed to create inquiry. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    };

    ensureInquiry();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialChat?.propertyId]);

  const selectedChat = useMemo(() => chats.find(c => c.id === selectedChatId) || null, [chats, selectedChatId]);

  // Pre-fill message when a chat matching initialChat is selected (multiple attempts for reliability)
  useEffect(() => {
    if (!initialChat || !selectedChatId) return;
    
    // Check if selected chat matches initialChat property
    const matchedChat = chats.find(c => c.id === selectedChatId && Number(c.propertyId) === Number(initialChat.propertyId));
    if (!matchedChat) return;
    
    // Only pre-fill once per chat
    if (preFilledMessageRef.current.has(selectedChatId)) return;
    
    // Set message with multiple attempts to ensure it gets set
    const attemptSetMessage = () => {
      setMessage(current => {
        // Only set if message is currently empty
        if (current.trim()) return current;
        
        // Determine message based on chat state
        if (matchedChat.messages && matchedChat.messages.length > 0) {
          preFilledMessageRef.current.add(selectedChatId);
          return `Hello! I'm still interested in ${initialChat.unitName || initialChat.property || 'this unit'}. Could you please provide an update?`;
        } else {
          preFilledMessageRef.current.add(selectedChatId);
          return `Hello! I'm interested in ${initialChat.unitName || initialChat.property || 'this unit'}. Please provide more information about availability, viewing options, and pricing details. Thank you!`;
        }
      });
    };
    
    // Try immediately
    attemptSetMessage();
    
    // Try again after a short delay as fallback
    const timeout1 = setTimeout(attemptSetMessage, 100);
    const timeout2 = setTimeout(attemptSetMessage, 300);
    
    return () => {
      clearTimeout(timeout1);
      clearTimeout(timeout2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChatId, initialChat?.propertyId]);

  const handleSendMessage = async () => {
    if (!message.trim() || !selectedChat) return;
    
    try {
      setLoading(true);
      const response = await api.sendTenantMessage(selectedChat.id, message.trim());
      
      if (response && response.success) {
        const messageText = message.trim();
        const now = new Date();
        // Optimistically add the message to the chat with correct time
    setChats(prev => prev.map(c => c.id === selectedChat.id ? {
      ...c,
          messages: [...c.messages, { 
            id: `temp-${Date.now()}`, 
            sender: 'tenant', 
            text: messageText, 
            time: formatMessageTime(now),
            created_at: now.toISOString()
          }]
    } : c));
    setMessage('');
        
        // Reload to get updated data from backend
        await loadInquiries();
        
        // Re-select the same chat after reload
        setSelectedChatId(selectedChat.id);
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
        console.log('Uploaded attachments:', response.attachments);
        // Update attachments for this inquiry immediately
        setAttachments(prev => {
          const updated = {
            ...prev,
            [selectedChat.id]: [...(prev[selectedChat.id] || []), ...response.attachments]
          };
          console.log('Updated attachments state:', updated);
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

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleSendMessage();
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-3 z-50">
      <div className="bg-white rounded-xl w-full max-w-6xl max-h-[90vh] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="w-9 h-9 bg-black rounded-full flex items-center justify-center hover:bg-gray-800 transition-all duration-300 shadow-lg"
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
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mx-4 mt-2">
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

        {/* Main Content */}
        <div className="flex h-[calc(90vh-72px)]">
          {/* Left Panel - Chat List */}
          <div className="w-80 border-r border-gray-200 bg-gray-50">
            {/* Tabs */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => {}}
                className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                  'bg-white text-black border-b-2 border-black'
                }`}
              >
                Active Chats
              </button>
              <button
                onClick={() => {}}
                className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                  'text-gray-600 hover:text-black hover:bg-gray-100'
                }`}
              >
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

            {/* Chat/Property List */}
            <div className="flex-1 overflow-y-auto">
              {/* Loading State */}
              {loading && chats.length === 0 ? (
                <div className="p-4 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto"></div>
                  <p className="text-sm text-gray-500 mt-2">Loading inquiries...</p>
                </div>
              ) : (
                /* Active Chats */
              <div className="space-y-1 px-2">
                {chats.length === 0 ? (
                  <div className="p-4 text-sm text-gray-500">No conversations yet. Start an inquiry from a unit to chat with a manager.</div>
                ) : (
                  chats.map((chat) => (
                    <div
                      key={chat.id}
                      onClick={() => setSelectedChatId(chat.id)}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedChatId === chat.id ? 'bg-gray-200' : 'hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="relative">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-blue-600">{chat.avatar}</span>
                          </div>
                          {chat.status === 'online' && (
                            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-900 truncate">{chat.managerName}</p>
                            <span className="text-xs text-gray-500">{chat.messages[chat.messages.length - 1]?.time}</span>
                          </div>
                          <p className="text-xs text-gray-600 truncate">{chat.property}</p>
                          <p className="text-xs text-gray-500 truncate">{
                            String(chat.messages[chat.messages.length - 1]?.text || '')
                              .replace(/---\s*Manager Reply\s*\[\d{10,}\]\s*---/g, '')
                              .replace(/---\s*New Message\s*(?:\[\d{10,}\])?\s*---/g, '')
                          }</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              )}
            </div>
          </div>

          {/* Right Panel - Chat Conversation */}
          <div className="flex-1 flex flex-col bg-white">
            {/* Chat Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-blue-600">
                      {selectedChat?.avatar || 'PM'}
                    </span>
                  </div>
                    {selectedChat?.status === 'online' && (
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-900">
                    {selectedChat?.managerName || 'Property Manager'}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {selectedChat?.unitName || selectedChat?.property || 'Property'}
                  </p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Combine messages and unmatched attachments, then sort by timestamp */}
              {useMemo(() => {
                if (!selectedChat?.id) return [];
                
                const unmatchedAttachments = getUnmatchedAttachments(selectedChat.id, selectedChat.messages || []);
                const allItems = [];
                
                // Add all messages
                (selectedChat?.messages || []).forEach(msg => {
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
                
                return allItems.map((item, idx) => {
                  if (item.type === 'attachment') {
                    const att = item.data;
                    // Determine sender based on uploaded_by
                    const currentChat = chats.find(c => c.id === selectedChat?.id);
                    const isTenant = currentChat?.inquiry?.tenant_id && 
                                    att.uploaded_by && 
                                    String(att.uploaded_by) === String(currentChat.inquiry.tenant_id);
                    const sender = isTenant ? 'tenant' : 'manager';
                    
                    return (
                      <div
                        key={`att-${att.id}`}
                        className={`flex ${sender === 'tenant' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-xs lg:max-w-md rounded-lg overflow-hidden ${
                            sender === 'tenant'
                              ? 'bg-black text-white'
                              : 'bg-gray-200 text-gray-900'
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
                                  sender === 'tenant'
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
                            <p className={`text-xs ${sender === 'tenant' ? 'text-gray-300' : 'text-gray-500'}`}>
                              {formatMessageTime(att.created_at)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  } else {
                    // Regular message
                    const msg = item.data;
                    const inquiryId = selectedChat?.id;
                    if (!inquiryId) return null;
                    const messageAttachments = getMessageAttachments(msg, inquiryId);
                    const hasAttachments = messageAttachments.length > 0;
                    const hasText = msg.text && msg.text.trim().length > 0;
                    
                    return (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'tenant' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                          className={`max-w-xs lg:max-w-md rounded-lg overflow-hidden ${
                      msg.sender === 'tenant'
                        ? 'bg-black text-white'
                        : 'bg-gray-200 text-gray-900'
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
                              <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
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
                                      msg.sender === 'tenant'
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
                            <p className={`text-xs ${
                      msg.sender === 'tenant' ? 'text-gray-300' : 'text-gray-500'
                    }`}>
                      {msg.time}
                    </p>
                  </div>
                </div>
            </div>
                    );
                  }
                });
              }, [selectedChat?.id, selectedChat?.messages, attachments, chats])}
              
              {(!selectedChat?.messages || selectedChat.messages.length === 0) && 
               (!attachments[selectedChat?.id] || attachments[selectedChat.id].length === 0) && (
                <div className="text-center text-gray-500 py-8">
                  <p>No messages yet. Start the conversation!</p>
                </div>
              )}
            </div>


            {/* Message Input */}
            <div className="p-4 border-t border-gray-200">
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
                  value={message || ''}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message to the property manager..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-black placeholder-gray-400"
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
                You're chatting with the property manager about {selectedChat?.unitName || selectedChat?.property || 'this unit'}
              </p>
            </div>
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
