import { useState, useEffect } from 'react';
import { X, Send, Loader2 } from 'lucide-react';
import { apiGet, apiPost } from '../lib/apiClient';

export default function ConfigureModal({ isOpen, onClose, campaignType, onSave }) {
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [formData, setFormData] = useState({
    subject: '',
    senderName: '',
    senderEmail: '',
    replyTo: '',
    templateId: '',
    delayValue: 1,
    delayUnit: 'hours',
    enabled: false,
  });
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  // Campaign type labels and defaults
  const campaignLabels = {
    abandoned_cart: {
      title: 'Abandoned Cart',
      defaultSubject: 'You left items in your cart!',
      defaultDelay: { value: 2, unit: 'hours' },
    },
    welcome_email: {
      title: 'Welcome Email',
      defaultSubject: 'Welcome to our store!',
      defaultDelay: { value: 5, unit: 'minutes' },
    },
    post_purchase: {
      title: 'Post Purchase',
      defaultSubject: 'Thank you for your purchase!',
      defaultDelay: { value: 1, unit: 'hours' },
    },
    review_request: {
      title: 'Review Request',
      defaultSubject: 'How was your experience?',
      defaultDelay: { value: 7, unit: 'days' },
    },
    reactivation: {
      title: 'Reactivation',
      defaultSubject: 'We miss you!',
      defaultDelay: { value: 30, unit: 'days' },
    },
  };

  const config = campaignLabels[campaignType] || campaignLabels.abandoned_cart;

  // Load templates and existing configuration
  useEffect(() => {
    if (isOpen) {
      loadTemplates();
      loadExistingConfig();
    }
  }, [isOpen, campaignType]);

  async function loadTemplates() {
    try {
      const resp = await apiGet('/api/brevo/templates');
      setTemplates(resp.templates || []);
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  }

  async function loadExistingConfig() {
    try {
      setLoading(true);
      const resp = await apiGet(`/api/campaigns/type?type=${campaignType}`);
      if (resp.campaign) {
        setFormData({
          subject: resp.campaign.subject || config.defaultSubject,
          senderName: resp.campaign.senderName || '',
          senderEmail: resp.campaign.senderEmail || '',
          replyTo: resp.campaign.replyTo || '',
          templateId: resp.campaign.templateId || '',
          delayValue: resp.campaign.delayValue || config.defaultDelay.value,
          delayUnit: resp.campaign.delayUnit || config.defaultDelay.unit,
          enabled: resp.campaign.enabled || false,
        });
      } else {
        // Set defaults for new campaign
        setFormData({
          ...formData,
          subject: config.defaultSubject,
          delayValue: config.defaultDelay.value,
          delayUnit: config.defaultDelay.unit,
        });
      }
    } catch (error) {
      console.error('Failed to load campaign config:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    try {
      setLoading(true);
      await apiPost('/api/campaigns/save', {
        type: campaignType,
        ...formData,
      });
      onSave && onSave();
      onClose();
    } catch (error) {
      console.error('Failed to save campaign:', error);
      alert('Failed to save campaign: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleTestSend() {
    if (!testEmail) {
      alert('Please enter a test email address');
      return;
    }

    try {
      setSendingTest(true);
      await apiPost('/api/send-email', {
        to: testEmail,
        subject: formData.subject,
        htmlContent: `
          <h1>Test Email - ${config.title}</h1>
          <p>This is a test email for your ${config.title} campaign.</p>
          <p><strong>Subject:</strong> ${formData.subject}</p>
          <p><strong>Delay:</strong> ${formData.delayValue} ${formData.delayUnit}</p>
        `,
        senderName: formData.senderName,
        senderEmail: formData.senderEmail,
        replyTo: formData.replyTo,
      });
      alert('Test email sent successfully!');
    } catch (error) {
      console.error('Failed to send test:', error);
      alert('Failed to send test email: ' + error.message);
    } finally {
      setSendingTest(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <h2 className="text-xl font-bold text-white">Configure {config.title}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-lg transition"
          >
            <X className="w-5 h-5 text-neutral-400" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Subject Line *
            </label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="Enter email subject"
              className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500/20"
            />
          </div>

          {/* Sender Name */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Sender Name *
            </label>
            <input
              type="text"
              value={formData.senderName}
              onChange={(e) => setFormData({ ...formData, senderName: e.target.value })}
              placeholder="Your Store Name"
              className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500/20"
            />
          </div>

          {/* Sender Email */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Sender Email *
            </label>
            <input
              type="email"
              value={formData.senderEmail}
              onChange={(e) => setFormData({ ...formData, senderEmail: e.target.value })}
              placeholder="noreply@yourstore.com"
              className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500/20"
            />
          </div>

          {/* Reply To */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Reply To (optional)
            </label>
            <input
              type="email"
              value={formData.replyTo}
              onChange={(e) => setFormData({ ...formData, replyTo: e.target.value })}
              placeholder="support@yourstore.com"
              className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500/20"
            />
          </div>

          {/* Template Selection */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Email Template
            </label>
            <select
              value={formData.templateId}
              onChange={(e) => setFormData({ ...formData, templateId: e.target.value })}
              className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500/20"
            >
              <option value="">Select a template</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Delay */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Send Delay
            </label>
            <div className="flex gap-3">
              <input
                type="number"
                min="1"
                value={formData.delayValue}
                onChange={(e) => setFormData({ ...formData, delayValue: parseInt(e.target.value) || 1 })}
                className="w-24 px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500/20"
              />
              <select
                value={formData.delayUnit}
                onChange={(e) => setFormData({ ...formData, delayUnit: e.target.value })}
                className="flex-1 px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500/20"
              >
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </select>
            </div>
          </div>

          {/* Enable/Disable */}
          <div className="flex items-center gap-3 p-4 bg-zinc-800/50 rounded-lg">
            <input
              type="checkbox"
              id="enabled"
              checked={formData.enabled}
              onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              className="w-4 h-4 rounded border-zinc-600 text-fuchsia-500 focus:ring-fuchsia-500 focus:ring-offset-zinc-900"
            />
            <label htmlFor="enabled" className="text-sm text-neutral-300">
              Enable this campaign
            </label>
          </div>

          {/* Test Send */}
          <div className="border-t border-zinc-800 pt-4 mt-6">
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Test Email
            </label>
            <div className="flex gap-3">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="your@email.com"
                className="flex-1 px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500/20"
              />
              <button
                onClick={handleTestSend}
                disabled={sendingTest}
                className="px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white hover:bg-zinc-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {sendingTest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send Test
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-lg border border-zinc-700 text-white hover:bg-zinc-800 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white font-medium hover:shadow-lg hover:shadow-fuchsia-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}


