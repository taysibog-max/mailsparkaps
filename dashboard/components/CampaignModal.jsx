import { useState, useEffect, useRef } from 'react';
import { X, Send, Save, Clock, Check, Zap, Mail, User, AtSign, Sparkles } from 'lucide-react';
import dynamic from 'next/dynamic';
import 'react-quill/dist/quill.snow.css';
import { useProgressBar } from './ProgressBar';
import { getFirebaseApp } from '../lib/firebaseClient';
import { getIdToken } from 'firebase/auth';

// Dynamic import to avoid SSR issues with react-quill
const ReactQuill = dynamic(() => import('react-quill'), { ssr: false });

export default function CampaignModal({ 
  isOpen, 
  onClose, 
  campaignType = 'Custom Campaign',
  onSuccess 
}) {
  const progressBar = useProgressBar();
  
  // Form state
  const [campaignName, setCampaignName] = useState('');
  const [subject, setSubject] = useState('');
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [body, setBody] = useState('');
  const [triggerDelay, setTriggerDelay] = useState('30min');
  const [sendOncePerUser, setSendOncePerUser] = useState(true);
  const [isDraft, setIsDraft] = useState(true);
  
  // Template selection
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  
  // UI state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState(null);
  
  // AI generation state
  const [generatingAI, setGeneratingAI] = useState(false);
  const [aiGenerated, setAiGenerated] = useState(false);
  
  const modalRef = useRef();

  useEffect(() => {
    if (isOpen) {
      // Reset form when modal opens
      setCampaignName(`${campaignType} - ${new Date().toLocaleDateString()}`);
      setSubject('');
      setSenderName('');
      setSenderEmail('');
      setBody('');
      setSelectedTemplate('');
      setError('');
      setSuccess(false);
      setShowStats(false);
      setAiGenerated(false);
      setGeneratingAI(false);
      
      // Load templates
      loadTemplates();
    }
  }, [isOpen, campaignType]);

  async function loadTemplates() {
    try {
      setLoadingTemplates(true);
      
      const { auth } = getFirebaseApp();
      const currentUser = auth.currentUser;
      
      if (!currentUser) return;
      
      const token = await getIdToken(currentUser, false);
      
      const response = await fetch('/api/templates/list', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setLoadingTemplates(false);
    }
  }

  function handleTemplateChange(templateId) {
    setSelectedTemplate(templateId);
    
    if (templateId) {
      // Template selected - populate fields
      const template = templates.find(t => t.id === templateId);
      if (template) {
        setSubject(template.subject || '');
        setBody(template.htmlContent || template.body || '');
        
        // Handle sender - can be string or object
        if (typeof template.sender === 'object' && template.sender !== null) {
          setSenderName(template.sender.name || senderName);
          setSenderEmail(template.sender.email || template.senderEmail || senderEmail);
        } else {
          setSenderName(template.sender || senderName);
          setSenderEmail(template.senderEmail || senderEmail);
        }
      }
    } else {
      // No template - clear fields
      setSubject('');
      setBody('');
    }
  }

  // Close modal on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    }
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  async function handleSaveCampaign(activate = false) {
    setError('');
    setSaving(true);
    progressBar.start();

    try {
      // Validation
      if (!campaignName || !subject || !senderName || !senderEmail || !body) {
        throw new Error('Please fill in all required fields');
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(senderEmail)) {
        throw new Error('Please enter a valid sender email');
      }

      progressBar.update(30);

      // Create campaign via Brevo API
      const payload = {
        name: campaignName,
        subject: subject,
        sender: { 
          name: senderName, 
          email: senderEmail 
        },
        htmlContent: body,
        // Don't include recipients for now - will be set up separately via contacts
        type: 'classic',
        status: activate ? 'active' : 'draft',
        // Add campaign metadata
        metadata: {
          campaignType,
          triggerDelay,
          sendOncePerUser
        }
      };

      progressBar.update(50);

      // Get fresh auth token from Firebase
      const { auth } = getFirebaseApp();
      const currentUser = auth.currentUser;

      if (!currentUser) {
        throw new Error('Please log in again to create campaigns');
      }

      // Get fresh ID token (handles auto-refresh)
      const token = await getIdToken(currentUser, false);

      const response = await fetch('/api/createCampaign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      progressBar.update(80);

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.message || 'Failed to create campaign');
      }
      
      setSuccess(true);
      setIsDraft(!activate);
      progressBar.complete();

      // Show success toast with confetti
      showToast(activate ? '✅ Campaign activated successfully!' : '✅ Campaign saved as draft');
      
      // Trigger confetti animation
      if (activate) {
        triggerConfetti();
      }

      // If activated, fetch stats after 2 seconds
      if (activate && result.campaign?.id) {
        setTimeout(() => {
          fetchCampaignStats(result.campaign.id);
        }, 2000);
      }

      // Call onSuccess callback if provided
      if (onSuccess) {
        setTimeout(() => {
          onSuccess(result);
        }, 1500);
      }

      // Close modal after 3 seconds
      setTimeout(() => {
        onClose();
      }, 3000);

    } catch (err) {
      console.error('Save campaign error:', err);
      setError(err.message);
      progressBar.reset();
    } finally {
      setSaving(false);
    }
  }

  async function fetchCampaignStats(campaignId) {
    try {
      const response = await fetch(`/api/brevo/campaign-stats?id=${campaignId}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
        setShowStats(true);
      }
    } catch (err) {
      console.error('Fetch stats error:', err);
    }
  }

  async function handleGenerateWithAI() {
    setError('');
    setGeneratingAI(true);

    try {
      // Get fresh auth token
      const { auth } = getFirebaseApp();
      const currentUser = auth.currentUser;

      if (!currentUser) {
        throw new Error('Please log in to use AI generation');
      }

      const token = await getIdToken(currentUser, false);

      // Prepare customer data for AI
      const customerData = {
        name: 'kupče', // Can be personalized with actual customer data
        storeName: senderName || 'Vaša Prodavnica',
        productName: 'proizvod', // Can be extracted from campaign context
      };

      // Convert campaignType to API format
      const apiCampaignType = campaignType.toLowerCase().replace(/\s+/g, '_');

      // Call AI generation endpoint
      const response = await fetch('/api/ai/generate-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          campaignType: apiCampaignType,
          customerData,
          saveToCampaign: false, // Don't auto-save, let user review first
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'AI generation failed');
      }

      // Populate form with AI-generated content
      setSubject(result.subject);
      setBody(result.body);
      setAiGenerated(true);

      // Show success toast
      showToast('✨ AI email generated successfully!');

    } catch (err) {
      console.error('AI generation error:', err);
      setError(err.message || 'AI generisanje nije uspjelo. Pokušaj ponovo.');
    } finally {
      setGeneratingAI(false);
    }
  }

  function showToast(message) {
    // Create toast notification
    const toast = document.createElement('div');
    toast.className = 'fixed top-20 right-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3 rounded-lg shadow-2xl z-[9999] animate-slide-in flex items-center gap-2 font-medium';
    toast.innerHTML = `
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
      </svg>
      ${message}
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function triggerConfetti() {
    // Simple confetti animation using DOM elements
    const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];
    const confettiCount = 50;

    for (let i = 0; i < confettiCount; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'confetti-piece';
      confetti.style.cssText = `
        position: fixed;
        width: 10px;
        height: 10px;
        background-color: ${colors[Math.floor(Math.random() * colors.length)]};
        left: ${50 + (Math.random() - 0.5) * 30}%;
        top: 50%;
        opacity: 1;
        transform: translateY(0) rotate(0deg);
        animation: confettiFall ${1 + Math.random() * 2}s ease-out forwards;
        animation-delay: ${Math.random() * 0.3}s;
        z-index: 10000;
        border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
      `;
      document.body.appendChild(confetti);

      setTimeout(() => confetti.remove(), 3000);
    }
  }

  if (!isOpen) return null;

  return (
    <>
      {/* Dark overlay */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity" />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
        <div 
          ref={modalRef}
          className="bg-[#1a1d29] text-white rounded-xl shadow-2xl w-full max-w-4xl my-8 border border-gray-700/50"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-700/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Create Email Campaign</h2>
                <p className="text-sm text-gray-400">{campaignType}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-700/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
            {/* Error Alert */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 flex items-start gap-3">
                <div className="text-red-400 mt-0.5">⚠️</div>
                <div className="flex-1">
                  <p className="text-sm text-red-300 font-medium">Error</p>
                  <p className="text-sm text-red-200/80">{error}</p>
                </div>
              </div>
            )}

            {/* Success Alert */}
            {success && (
              <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-4 flex items-start gap-3">
                <Check className="w-5 h-5 text-green-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-green-300 font-medium">Success!</p>
                  <p className="text-sm text-green-200/80">
                    Campaign {isDraft ? 'saved as draft' : 'activated'} successfully
                  </p>
                </div>
              </div>
            )}

            {/* Campaign Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Campaign Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="e.g., Welcome Email Campaign"
                className="w-full px-4 py-2.5 bg-[#0f1117] border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-white placeholder-gray-500"
              />
            </div>

            {/* Template Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Choose Template (Optional)
              </label>
              <select
                value={selectedTemplate}
                onChange={(e) => handleTemplateChange(e.target.value)}
                disabled={loadingTemplates}
                className="w-full px-4 py-2.5 bg-[#0f1117] border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">None - Create from scratch</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} {template.generatedWithAI ? '✨' : ''}
                  </option>
                ))}
              </select>
              {selectedTemplate && (
                <p className="mt-2 text-xs text-green-400 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Template loaded - Subject and content auto-filled
                </p>
              )}
            </div>

            {/* Subject Line */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Subject Line <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Enter email subject"
                  className="w-full pl-11 pr-4 py-2.5 bg-[#0f1117] border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-white placeholder-gray-500"
                />
              </div>
            </div>

            {/* Sender Information */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Sender Name <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder="Your Name"
                    className="w-full pl-11 pr-4 py-2.5 bg-[#0f1117] border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-white placeholder-gray-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Sender Email <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="email"
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full pl-11 pr-4 py-2.5 bg-[#0f1117] border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-white placeholder-gray-500"
                  />
                </div>
              </div>
            </div>

            {/* Trigger Delay */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Clock className="w-4 h-4 inline mr-1.5" />
                Trigger Timing
              </label>
              <select
                value={triggerDelay}
                onChange={(e) => setTriggerDelay(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#0f1117] border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-white cursor-pointer"
              >
                <option value="immediate">Immediately</option>
                <option value="30min">30 minutes after trigger</option>
                <option value="1h">1 hour after trigger</option>
                <option value="24h">24 hours after trigger</option>
                <option value="48h">48 hours after trigger</option>
                <option value="7d">7 days after trigger</option>
              </select>
            </div>

            {/* Send Once Per User Checkbox */}
            <div className="flex items-center gap-3 p-4 bg-[#0f1117] border border-gray-700 rounded-lg">
              <input
                type="checkbox"
                id="sendOnce"
                checked={sendOncePerUser}
                onChange={(e) => setSendOncePerUser(e.target.checked)}
                className="w-4 h-4 bg-gray-700 border-gray-600 rounded text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="sendOnce" className="flex-1 text-sm text-gray-300 cursor-pointer">
                Send once per user (prevent duplicate sends)
              </label>
            </div>

            {/* Email Body Editor - Only show if NO template selected */}
            {!selectedTemplate && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-300">
                    Email Content <span className="text-red-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateWithAI}
                    disabled={generatingAI || !senderName}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                      generatingAI || !senderName
                        ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg hover:shadow-purple-500/50'
                    }`}
                    title={!senderName ? 'Enter sender name first' : 'Generate email content with AI'}
                  >
                    {generatingAI ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        {aiGenerated ? 'Regenerate with AI' : 'Generate with AI'}
                      </>
                    )}
                  </button>
                </div>
                {aiGenerated && (
                  <div className="mb-2 text-xs text-purple-400 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    AI-generated content - feel free to edit
                  </div>
                )}
                <div className="bg-[#0f1117] border border-gray-700 rounded-lg overflow-hidden quill-dark-theme">
                  <ReactQuill
                    theme="snow"
                    value={body}
                    onChange={setBody}
                    placeholder="Write your email content here or generate with AI..."
                    className="text-white"
                    modules={{
                      toolbar: [
                        [{ header: [1, 2, 3, false] }],
                        ['bold', 'italic', 'underline', 'strike'],
                        [{ list: 'ordered' }, { list: 'bullet' }],
                        [{ color: [] }, { background: [] }],
                        ['link', 'image'],
                        ['clean'],
                      ],
                    }}
                  />
                </div>
              </div>
            )}

            {/* Template Preview - Show if template selected */}
            {selectedTemplate && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email Content Preview
                </label>
                <div className="bg-[#0f1117] border border-gray-700 rounded-lg p-6 max-h-96 overflow-y-auto custom-scrollbar">
                  <div 
                    dangerouslySetInnerHTML={{ __html: body }}
                    className="prose prose-sm prose-invert max-w-none text-white"
                  />
                </div>
                <p className="mt-2 text-xs text-blue-400 flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  Using template content - choose "None" to customize manually
                </p>
              </div>
            )}

            {/* Campaign Stats (if available) */}
            {showStats && stats && (
              <div className="bg-gradient-to-br from-blue-500/10 to-purple-600/10 border border-blue-500/30 rounded-lg p-4">
                <h3 className="text-sm font-medium text-blue-300 mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Campaign Statistics
                </h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white">{stats.sent || 0}</p>
                    <p className="text-xs text-gray-400">Sent</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-400">{stats.opens || 0}</p>
                    <p className="text-xs text-gray-400">Opens</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-400">{stats.clicks || 0}</p>
                    <p className="text-xs text-gray-400">Clicks</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-purple-400">
                      {stats.opens && stats.sent ? ((stats.opens / stats.sent) * 100).toFixed(1) : 0}%
                    </p>
                    <p className="text-xs text-gray-400">Open Rate</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-gray-700/50 bg-[#0f1117]/50">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700/50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <div className="flex gap-3">
              <button
                onClick={() => handleSaveCampaign(false)}
                disabled={saving}
                className="px-6 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Draft'}
              </button>
              <button
                onClick={() => handleSaveCampaign(true)}
                disabled={saving}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl relative overflow-hidden"
              >
                {saving && (
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {!saving && <Send className="w-4 h-4" />}
                {saving ? 'Activating...' : 'Activate Campaign'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .quill-dark-theme .ql-toolbar {
          background: #0f1117;
          border: none !important;
          border-bottom: 1px solid #374151 !important;
        }
        
        .quill-dark-theme .ql-container {
          background: #0f1117;
          border: none !important;
          color: white;
          min-height: 250px;
        }
        
        .quill-dark-theme .ql-editor {
          color: white;
          min-height: 250px;
        }
        
        .quill-dark-theme .ql-editor.ql-blank::before {
          color: #6b7280;
        }
        
        .quill-dark-theme .ql-stroke {
          stroke: #9ca3af !important;
        }
        
        .quill-dark-theme .ql-fill {
          fill: #9ca3af !important;
        }
        
        .quill-dark-theme .ql-picker-label {
          color: #9ca3af !important;
        }
        
        .quill-dark-theme button:hover .ql-stroke {
          stroke: #ffffff !important;
        }
        
        .quill-dark-theme button:hover .ql-fill {
          fill: #ffffff !important;
        }
        
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #0f1117;
          border-radius: 4px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #374151;
          border-radius: 4px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #4b5563;
        }
        
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
        
        @keyframes confettiFall {
          from {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          to {
            transform: translateY(100vh) rotate(${Math.random() * 720}deg);
            opacity: 0;
          }
        }
      `}</style>
    </>
  );
}

