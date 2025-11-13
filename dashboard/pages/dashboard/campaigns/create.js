import AppShell from '../../../components/AppShell';
import RequireAuth from '../../../components/RequireAuth';
import { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../../../lib/apiClient';
import { useProgressBar } from '../../../components/ProgressBar';
import { useRouter } from 'next/router';
import { 
  Mail, Send, Save, Eye, Users, List, Calendar, 
  Clock, ArrowLeft, AlertCircle, CheckCircle2 
} from 'lucide-react';

export default function CreateCampaignPage() {
  return (
    <RequireAuth>
      <AppShell>
        <CreateCampaignContent />
      </AppShell>
    </RequireAuth>
  );
}

function CreateCampaignContent() {
  const router = useRouter();
  const progressBar = useProgressBar();
  
  // Form state
  const [campaignName, setCampaignName] = useState('');
  const [subject, setSubject] = useState('');
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [replyTo, setReplyTo] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedSegment, setSelectedSegment] = useState('all');
  const [scheduledAt, setScheduledAt] = useState('');
  const [sendNow, setSendNow] = useState(true);
  
  // Data state
  const [templates, setTemplates] = useState([]);
  const [segments, setSegments] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      progressBar.start();

      const [templatesRes, segmentsRes, contactsRes] = await Promise.all([
        apiGet('/api/brevo/templates'),
        apiGet('/api/segments/list'),
        apiGet('/api/contacts'),
      ]);

      setTemplates(templatesRes.templates || []);
      setSegments(segmentsRes.segments || []);
      setContacts(contactsRes.contacts || []);
    } catch (e) {
      console.error('Load data error:', e);
      setError('Failed to load data: ' + e.message);
    } finally {
      setLoading(false);
      progressBar.complete();
    }
  }

  async function handleCreateCampaign(e) {
    e.preventDefault();
    
    if (!campaignName || !subject || !senderEmail) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);
      setError('');
      progressBar.start();

      // Prepare recipients based on selected segment
      let recipients = {};
      if (selectedSegment === 'all') {
        recipients = { listIds: [] }; // Will send to all contacts
      } else {
        recipients = { listIds: [parseInt(selectedSegment)] };
      }

      // Create campaign via Brevo
      const campaignData = {
        name: campaignName,
        subject,
        sender: {
          name: senderName || 'Support',
          email: senderEmail,
        },
        replyTo: replyTo || senderEmail,
        htmlContent: htmlContent || (selectedTemplate ? templates.find(t => t.id == selectedTemplate)?.htmlContent : '<p>Your email content here</p>'),
        recipients,
        scheduledAt: sendNow ? null : scheduledAt,
      };

      const result = await apiPost('/api/brevo/create-campaign', campaignData);

      setSuccess(true);
      progressBar.complete();

      // Redirect to campaigns list after 2 seconds
      setTimeout(() => {
        router.push('/dashboard/campaigns');
      }, 2000);
    } catch (e) {
      console.error('Create campaign error:', e);
      setError('Failed to create campaign: ' + e.message);
      progressBar.reset();
    } finally {
      setSaving(false);
    }
  }

  async function handleSendTest() {
    if (!senderEmail) {
      alert('Please enter your email address first');
      return;
    }

    try {
      progressBar.start();
      
      const testData = {
        to: [{ email: senderEmail }],
        subject: subject || 'Test Email',
        htmlContent: htmlContent || '<p>Test email content</p>',
        sender: {
          name: senderName || 'Support',
          email: senderEmail,
        },
      };

      await apiPost('/api/brevo/send-transactional', testData);
      alert('Test email sent to ' + senderEmail);
      progressBar.complete();
    } catch (e) {
      alert('Failed to send test email: ' + e.message);
      progressBar.reset();
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center bg-white p-8 rounded-lg shadow-lg">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Campaign Created!</h2>
          <p className="text-gray-600">Redirecting to campaigns list...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push('/dashboard/campaigns')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Campaigns
        </button>
        <h1 className="text-3xl font-bold text-gray-900">Create Email Campaign</h1>
        <p className="text-gray-600 mt-2">Design and send beautiful email campaigns to your contacts</p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <AlertCircle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-red-800 font-medium">Error</h3>
            <p className="text-red-700 text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleCreateCampaign} className="space-y-6">
        {/* Campaign Settings Card */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            <Mail className="w-5 h-5 mr-2 text-blue-600" />
            Campaign Settings
          </h2>

          <div className="space-y-4">
            {/* Campaign Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Campaign Name *
              </label>
              <input
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="e.g., Summer Sale 2024"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            {/* Subject Line */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subject Line *
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g., Get 50% off this weekend!"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            {/* Sender Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sender Name
                </label>
                <input
                  type="text"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="Your Store Name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sender Email *
                </label>
                <input
                  type="email"
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  placeholder="noreply@yourstore.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            {/* Reply To */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reply-To Email
              </label>
              <input
                type="email"
                value={replyTo}
                onChange={(e) => setReplyTo(e.target.value)}
                placeholder="support@yourstore.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Leave empty to use sender email</p>
            </div>
          </div>
        </div>

        {/* Recipients Card */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            <Users className="w-5 h-5 mr-2 text-blue-600" />
            Recipients
          </h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Segment
            </label>
            <select
              value={selectedSegment}
              onChange={(e) => setSelectedSegment(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Contacts ({contacts.length})</option>
              {segments.map((seg) => (
                <option key={seg.id} value={seg.id}>
                  {seg.name} ({seg.contactCount || 0})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              This campaign will be sent to {selectedSegment === 'all' ? contacts.length : segments.find(s => s.id == selectedSegment)?.contactCount || 0} contacts
            </p>
          </div>
        </div>

        {/* Email Content Card */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            <List className="w-5 h-5 mr-2 text-blue-600" />
            Email Content
          </h2>

          {/* Template Selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Use Template (Optional)
            </label>
            <select
              value={selectedTemplate || ''}
              onChange={(e) => {
                const templateId = e.target.value;
                setSelectedTemplate(templateId);
                if (templateId) {
                  const template = templates.find(t => t.id == templateId);
                  if (template) {
                    setHtmlContent(template.htmlContent || '');
                    if (!subject) setSubject(template.subject || '');
                  }
                }
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">None - Custom HTML</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>

          {/* HTML Editor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              HTML Content
            </label>
            <textarea
              value={htmlContent}
              onChange={(e) => setHtmlContent(e.target.value)}
              placeholder="<html><body><h1>Your email content here</h1></body></html>"
              rows={12}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              You can use HTML and CSS. Variables: {'{FIRSTNAME}'}, {'{LASTNAME}'}, {'{EMAIL}'}
            </p>
          </div>

          {/* Preview Button */}
          <button
            type="button"
            onClick={() => setPreview(!preview)}
            className="mt-4 flex items-center text-blue-600 hover:text-blue-700 font-medium"
          >
            <Eye className="w-4 h-4 mr-2" />
            {preview ? 'Hide Preview' : 'Show Preview'}
          </button>

          {/* Preview */}
          {preview && (
            <div className="mt-4 border border-gray-300 rounded-lg p-4 bg-gray-50">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Preview:</h3>
              <div 
                className="bg-white p-4 rounded border"
                dangerouslySetInnerHTML={{ __html: htmlContent || '<p>No content yet</p>' }}
              />
            </div>
          )}
        </div>

        {/* Schedule Card */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            <Calendar className="w-5 h-5 mr-2 text-blue-600" />
            Schedule
          </h2>

          <div className="space-y-4">
            {/* Send Now / Schedule */}
            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={sendNow}
                  onChange={() => setSendNow(true)}
                  className="mr-2"
                />
                <span className="text-sm font-medium text-gray-700">Send Now</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={!sendNow}
                  onChange={() => setSendNow(false)}
                  className="mr-2"
                />
                <span className="text-sm font-medium text-gray-700">Schedule for Later</span>
              </label>
            </div>

            {/* Schedule Date/Time */}
            {!sendNow && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Schedule Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between bg-white rounded-lg shadow-md p-6">
          <button
            type="button"
            onClick={handleSendTest}
            disabled={saving}
            className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <Send className="w-4 h-4 mr-2" />
            Send Test Email
          </button>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => router.push('/dashboard/campaigns')}
              disabled={saving}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {sendNow ? 'Create & Send' : 'Create Campaign'}
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

