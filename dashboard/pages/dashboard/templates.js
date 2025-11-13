import AppShell from '../../components/AppShell';
import RequireAuth from '../../components/RequireAuth';
import { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../../lib/apiClient';
import { useProgressBar } from '../../components/ProgressBar';
import { 
  Layout, Plus, Eye, Edit2, Trash2, Sparkles, Mail, AlertCircle, 
  CheckCircle, Zap, Send, Star, X, ShoppingCart, UserPlus, Gift, 
  MessageCircle, RefreshCcw, Database
} from 'lucide-react';
import { LoadingSpinner } from '../../components/LoadingSkeleton';
import { motion, AnimatePresence } from 'framer-motion';

export default function TemplatesPage() {
  return (
    <RequireAuth>
      <AppShell>
        <TemplatesContent />
      </AppShell>
    </RequireAuth>
  );
}

function TemplatesContent() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPreview, setShowPreview] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const progressBar = useProgressBar();

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    try {
      setLoading(true);
      progressBar.start();
      
      const response = await apiGet('/api/templates/list');
      setTemplates(response.templates || []);
      
      progressBar.complete();
    } catch (err) {
      console.error('Failed to load templates:', err);
      setError('Failed to load templates');
      progressBar.reset();
    } finally {
      setLoading(false);
    }
  }

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

  async function handleDeleteTemplate(templateId) {
    setShowDeleteConfirm(templateId);
  }

  async function confirmDelete() {
    const templateId = showDeleteConfirm;
    setShowDeleteConfirm(null);

    try {
      setDeleting(templateId);
      setError('');
      
      await fetch(`/api/templates/delete?id=${templateId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`,
        },
      });
      
      setSuccess('✅ Template deleted successfully from database!');
      setTimeout(() => setSuccess(''), 3000);
      
      setTemplates(templates.filter(t => t.id !== templateId));
      
    } catch (err) {
      console.error('Failed to delete template:', err);
      setError('Failed to delete template from database');
    } finally {
      setDeleting(null);
    }
  }

  async function getAuthToken() {
    const { getFirebaseApp } = await import('../../lib/firebaseClient');
    const { getIdToken } = await import('firebase/auth');
    const { auth } = getFirebaseApp();
    const token = await getIdToken(auth.currentUser);
    return token;
  }

  return (
    <div className="space-y-8">
      {/* Template Count Badge */}
      {!loading && templates.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center gap-3 p-4 rounded-2xl bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-orange-500/10 border border-purple-500/20 backdrop-blur-sm"
        >
          <Database className="w-5 h-5 text-purple-400" />
          <span className="text-neutral-300">
            You have <span className="font-bold text-white">{templates.length}</span> email template{templates.length !== 1 ? 's' : ''}
          </span>
        </motion.div>
      )}

      {/* Ultra Modern Header with Animated Gradient */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-purple-500/20 bg-gradient-to-br from-zinc-900/90 via-purple-900/20 to-pink-900/20 p-8 backdrop-blur-xl"
      >
        {/* Animated Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-orange-500/10 animate-gradient-slow opacity-50"></div>
        
        {/* Floating Particles */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-purple-400 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                y: [0, -20, 0],
                opacity: [0.2, 0.8, 0.2],
                scale: [1, 1.5, 1],
              }}
              transition={{
                duration: 3 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <motion.div
              className="p-4 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 shadow-2xl shadow-purple-500/50"
              animate={{
                boxShadow: [
                  '0 20px 50px rgba(168, 85, 247, 0.4)',
                  '0 20px 60px rgba(236, 72, 153, 0.6)',
                  '0 20px 50px rgba(168, 85, 247, 0.4)',
                ],
              }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <Layout className="w-8 h-8 text-white" />
            </motion.div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent mb-2">
                Email Templates
              </h1>
              <p className="text-neutral-400">
                Create beautiful email campaigns with AI-powered content generation
              </p>
            </div>
          </div>
          
          <motion.button
            onClick={() => setShowCreateModal(true)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="group relative px-8 py-4 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 text-white font-bold text-lg overflow-hidden shadow-2xl shadow-purple-500/50"
          >
            {/* Animated Shine Effect */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
              animate={{
                x: ['-100%', '200%'],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatDelay: 1,
              }}
            />
            
            {/* Button Content */}
            <div className="relative flex items-center gap-3">
              <motion.div
                animate={{
                  rotate: [0, 360],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "linear",
                }}
              >
                <Sparkles className="w-6 h-6" />
              </motion.div>
              <span>Create with AI</span>
            </div>

            {/* Glow Effect */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500"></div>
          </motion.button>
        </div>
      </motion.div>

      {/* Success/Error Messages */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.9 }}
            className="p-4 rounded-2xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 text-green-400 flex items-center gap-3 shadow-xl shadow-green-500/20"
          >
            <CheckCircle className="w-5 h-5" />
            {success}
          </motion.div>
        )}
        
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.9 }}
            className="p-4 rounded-2xl bg-gradient-to-r from-red-500/10 to-pink-500/10 border border-red-500/30 text-red-400 flex items-center gap-3 shadow-xl shadow-red-500/20"
          >
            <AlertCircle className="w-5 h-5" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Templates Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-80 rounded-2xl bg-zinc-900/40 border border-zinc-800 animate-pulse" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        // Ultra Modern Empty State
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative text-center py-20 overflow-hidden rounded-3xl border border-purple-500/20 bg-gradient-to-br from-zinc-900/90 via-purple-900/10 to-pink-900/10 backdrop-blur-xl"
        >
          {/* Animated Background */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent animate-pulse-slow"></div>
          
          <div className="relative z-10 max-w-md mx-auto">
            <motion.div
              className="p-8 rounded-3xl bg-gradient-to-br from-purple-600/20 to-pink-600/20 w-fit mx-auto mb-6 backdrop-blur-sm"
              animate={{
                boxShadow: [
                  '0 0 40px rgba(168, 85, 247, 0.3)',
                  '0 0 60px rgba(236, 72, 153, 0.5)',
                  '0 0 40px rgba(168, 85, 247, 0.3)',
                ],
              }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <Mail className="w-20 h-20 text-purple-400" />
            </motion.div>
            
            <h3 className="text-3xl font-bold bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent mb-4">
              No Templates Yet
            </h3>
            <p className="text-neutral-400 mb-8 leading-relaxed">
              Create your first AI-powered email template and start engaging your customers with personalized content
            </p>
            
            <motion.button
              onClick={() => setShowCreateModal(true)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="group relative px-8 py-4 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 text-white font-bold text-lg overflow-hidden shadow-2xl shadow-purple-500/50"
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
              />
              <div className="relative flex items-center gap-3">
                <Sparkles className="w-6 h-6" />
                <span>Create Your First Template</span>
              </div>
            </motion.button>
          </div>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template, idx) => (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              whileHover={{ y: -8, scale: 1.02 }}
              className="group relative rounded-2xl border border-purple-500/20 bg-gradient-to-br from-zinc-900/90 to-zinc-900/50 backdrop-blur-sm p-6 overflow-hidden shadow-xl hover:shadow-2xl hover:shadow-purple-500/20 transition-all duration-500"
            >
              {/* Animated Border Gradient */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-500/0 via-pink-500/20 to-purple-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              
              {/* Glow Effect */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-600/0 to-pink-600/0 group-hover:from-purple-600/10 group-hover:to-pink-600/10 transition-all duration-500"></div>

              <div className="relative z-10">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <motion.div
                      className="p-3 rounded-xl bg-gradient-to-br from-purple-600/20 to-pink-600/20 shadow-lg"
                      whileHover={{ rotate: 360 }}
                      transition={{ duration: 0.6 }}
                    >
                      {template.generatedWithAI ? (
                        <Sparkles className="w-5 h-5 text-purple-400" />
                      ) : (
                        <Mail className="w-5 h-5 text-blue-400" />
                      )}
                    </motion.div>
                    <div>
                      <h3 className="font-bold text-white">{template.name}</h3>
                      <p className="text-xs text-neutral-400">
                        {template.generatedWithAI ? 'AI Generated' : 'Custom'}
                      </p>
                    </div>
                  </div>
                  
                  {template.isActive && (
                    <div className="px-3 py-1 rounded-lg bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 text-green-400 text-xs font-medium shadow-lg shadow-green-500/20">
                      Active
                    </div>
                  )}
                </div>

                {/* Subject */}
                <div className="mb-4 p-3 rounded-xl bg-gradient-to-r from-zinc-800/50 to-zinc-800/30 backdrop-blur-sm">
                  <p className="text-xs text-neutral-400 mb-1">Subject:</p>
                  <p className="text-sm text-white font-medium truncate">
                    {template.subject || 'No subject'}
                  </p>
                </div>

                {/* Info */}
                <div className="mb-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-neutral-400">
                    <span>Sender:</span>
                    <span className="text-white font-medium">{template.sender?.name || 'Not set'}</span>
                  </div>
                  <div className="flex items-center justify-between text-neutral-400">
                    <span>Created:</span>
                    <span className="text-white font-medium">
                      {new Date(template.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowPreview(template)}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/30 text-white hover:from-purple-600/30 hover:to-pink-600/30 transition-all shadow-lg hover:shadow-purple-500/20 flex items-center justify-center gap-2 text-sm font-medium"
                  >
                    <Eye className="w-4 h-4" />
                    Preview
                  </motion.button>
                  
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleDeleteTemplate(template.id)}
                    disabled={deleting === template.id}
                    className="p-3 rounded-xl bg-gradient-to-r from-red-500/20 to-pink-500/20 border border-red-500/30 text-red-400 hover:from-red-500/30 hover:to-pink-500/30 transition-all shadow-lg hover:shadow-red-500/20 disabled:opacity-50"
                  >
                    {deleting === template.id ? (
                      <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      <AnimatePresence>
        {showPreview && (
          <TemplatePreviewModal
            template={showPreview}
            onClose={() => setShowPreview(null)}
            onTemplateUpdated={loadTemplates}
          />
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <DeleteConfirmModal
            templateId={showDeleteConfirm}
            templateName={templates.find(t => t.id === showDeleteConfirm)?.name || 'this template'}
            onConfirm={confirmDelete}
            onCancel={() => setShowDeleteConfirm(null)}
          />
        )}
      </AnimatePresence>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <CreateTemplateModal
            onClose={() => setShowCreateModal(false)}
            onSuccess={() => {
              setShowCreateModal(false);
              loadTemplates();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Delete Confirmation Modal
function DeleteConfirmModal({ templateId, templateName, onConfirm, onCancel }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="relative bg-gradient-to-br from-zinc-900 to-red-900/20 rounded-3xl border border-red-500/30 max-w-md w-full overflow-hidden shadow-2xl shadow-red-500/20"
      >
        {/* Animated Background */}
        <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 via-pink-500/5 to-orange-500/5 animate-pulse-slow"></div>

        {/* Content */}
        <div className="relative z-10 p-8 text-center">
          <motion.div
            className="p-6 rounded-full bg-gradient-to-br from-red-600/20 to-pink-600/20 w-fit mx-auto mb-6"
            animate={{
              boxShadow: [
                '0 0 40px rgba(239, 68, 68, 0.3)',
                '0 0 60px rgba(239, 68, 68, 0.5)',
                '0 0 40px rgba(239, 68, 68, 0.3)',
              ],
            }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <AlertCircle className="w-16 h-16 text-red-400" />
          </motion.div>

          <h2 className="text-2xl font-bold text-white mb-3">
            Delete Template?
          </h2>
          
          <p className="text-neutral-300 mb-2">
            Are you sure you want to delete
          </p>
          <p className="text-lg font-bold text-white mb-4">
            "{templateName}"
          </p>
          
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 mb-6">
            <p className="text-sm text-red-400">
              ⚠️ This action cannot be undone. The template will be permanently deleted from the database.
            </p>
          </div>

          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onCancel}
              className="flex-1 px-6 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white hover:bg-zinc-700 transition-all shadow-lg"
            >
              Cancel
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onConfirm}
              className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-red-600 to-pink-600 text-white font-bold hover:shadow-2xl hover:shadow-red-500/50 transition-all"
            >
              Delete Forever
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Preview Modal with Edit & Regenerate
function TemplatePreviewModal({ template, onClose, onTemplateUpdated }) {
  const [editMode, setEditMode] = useState(false);
  const [editedName, setEditedName] = useState(template.name || '');
  const [editedSubject, setEditedSubject] = useState(template.subject || '');
  const [editedBody, setEditedBody] = useState(template.body || template.htmlContent || '');
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  async function getAuthToken() {
    const { getFirebaseApp } = await import('../../lib/firebaseClient');
    const { getIdToken } = await import('firebase/auth');
    const { auth } = getFirebaseApp();
    return await getIdToken(auth.currentUser);
  }

  async function handleSave() {
    try {
      setSaving(true);
      setError('');
      
      // Update template via API
      const token = await getAuthToken();
      const response = await fetch(`/api/templates/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: template.id,
          name: editedName,
          subject: editedSubject,
          htmlContent: editedBody,
        }),
      });

      if (!response.ok) throw new Error('Failed to save');

      // Update template object for immediate UI update
      template.name = editedName;
      template.subject = editedSubject;
      template.htmlContent = editedBody;

      setSuccess('✅ Template saved successfully!');
      
      // Call callback to refresh list if name changed
      if (onTemplateUpdated && editedName !== template.name) {
        onTemplateUpdated();
      }
      
      setTimeout(() => {
        setSuccess('');
        setEditMode(false);
      }, 2000);
      
    } catch (err) {
      console.error('Save error:', err);
      setError('Failed to save changes');
    } finally {
      setSaving(false);
    }
  }

  async function handleRegenerate() {
    try {
      setRegenerating(true);
      setError('');
      
      const { apiPost } = await import('../../lib/apiClient');
      const result = await apiPost('/api/ai/generate-email', {
        campaignType: template.campaignType || 'abandoned_cart',
        customerData: {
          storeName: template.sender || 'Your Store',
        },
        saveToCampaign: false,
      });

      setEditedSubject(result.subject);
      setEditedBody(result.body);
      setSuccess('✅ Content regenerated with AI!');
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (err) {
      console.error('Regenerate error:', err);
      setError('Failed to regenerate content');
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="relative bg-gradient-to-br from-zinc-900 via-purple-900/10 to-zinc-900 rounded-3xl border border-purple-500/30 max-w-5xl w-full max-h-[90vh] overflow-hidden shadow-2xl shadow-purple-500/20"
      >
        {/* Animated Background */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-pink-500/5 to-orange-500/5 animate-gradient-slow"></div>

        {/* Header */}
        <div className="relative z-10 p-6 border-b border-purple-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <motion.div
                className="p-3 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 shadow-xl"
                animate={{
                  boxShadow: [
                    '0 10px 30px rgba(168, 85, 247, 0.4)',
                    '0 10px 40px rgba(236, 72, 153, 0.6)',
                    '0 10px 30px rgba(168, 85, 247, 0.4)',
                  ],
                }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <Mail className="w-6 h-6 text-white" />
              </motion.div>
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent">
                  {template.name}
                </h2>
                {!editMode && (
                  <p className="text-sm text-neutral-400 mt-1">Preview & Edit Template</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!editMode ? (
                <>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setEditMode(true)}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium hover:shadow-xl hover:shadow-purple-500/30 transition-all flex items-center gap-2"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleRegenerate}
                    disabled={regenerating}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-600 to-pink-600 text-white font-medium hover:shadow-xl hover:shadow-orange-500/30 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {regenerating ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    {regenerating ? 'Regenerating...' : 'Regenerate AI'}
                  </motion.button>
                </>
              ) : (
                <>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setEditMode(false)}
                    className="px-4 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-white hover:bg-zinc-700 transition-all"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-medium hover:shadow-xl hover:shadow-green-500/30 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {saving ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    {saving ? 'Saving...' : 'Save Changes'}
                  </motion.button>
                </>
              )}
              <motion.button
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="p-3 rounded-xl bg-gradient-to-r from-zinc-800 to-zinc-700 border border-zinc-700 text-white hover:border-purple-500/50 transition-all shadow-lg"
              >
                <X className="w-5 h-5" />
              </motion.button>
            </div>
          </div>

          {/* Success/Error Messages */}
          <AnimatePresence>
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-4 p-3 rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 text-green-400 text-sm flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                {success}
              </motion.div>
            )}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-4 p-3 rounded-xl bg-gradient-to-r from-red-500/10 to-pink-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Content */}
        <div className="relative z-10 p-6 overflow-y-auto max-h-[calc(90vh-200px)] space-y-4">
          {editMode ? (
            <>
              {/* Edit Mode */}
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Template Name
                </label>
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  placeholder="e.g., Welcome Email"
                  className="w-full px-4 py-3 rounded-xl bg-zinc-800/50 border border-purple-500/20 text-white placeholder-neutral-500 focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Email Subject
                </label>
                <input
                  type="text"
                  value={editedSubject}
                  onChange={(e) => setEditedSubject(e.target.value)}
                  placeholder="Your email subject"
                  className="w-full px-4 py-3 rounded-xl bg-zinc-800/50 border border-purple-500/20 text-white placeholder-neutral-500 focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Email Body (HTML)
                </label>
                <textarea
                  value={editedBody}
                  onChange={(e) => setEditedBody(e.target.value)}
                  rows={15}
                  placeholder="<p>Your email content here...</p>"
                  className="w-full px-4 py-3 rounded-xl bg-zinc-800/50 border border-purple-500/20 text-white placeholder-neutral-500 focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all resize-none font-mono text-sm"
                />
              </div>
            </>
          ) : (
            <>
              {/* Preview Mode */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-zinc-800/50 to-zinc-800/30 border border-purple-500/20">
                <div className="text-xs text-neutral-400 mb-2">SUBJECT</div>
                <div className="text-lg font-medium text-white">{editedSubject}</div>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-2xl">
                <div 
                  dangerouslySetInnerHTML={{ __html: editedBody }}
                  className="prose prose-sm max-w-none [&_*]:text-gray-900 [&_h1]:text-gray-900 [&_h2]:text-gray-900 [&_h3]:text-gray-900 [&_p]:text-gray-900 [&_li]:text-gray-900 [&_a]:text-blue-600 [&_strong]:text-gray-900"
                  style={{ color: '#111827' }}
                />
              </div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// Create Template Modal
function CreateTemplateModal({ onClose, onSuccess }) {
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [campaignType, setCampaignType] = useState('abandoned_cart');
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [useAI, setUseAI] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const campaignTypes = [
    { value: 'abandoned_cart', label: 'Abandoned Cart', icon: ShoppingCart, color: 'from-orange-500 to-red-500' },
    { value: 'welcome_email', label: 'Welcome Email', icon: UserPlus, color: 'from-blue-500 to-cyan-500' },
    { value: 'post_purchase', label: 'Post Purchase', icon: Gift, color: 'from-green-500 to-emerald-500' },
    { value: 'review_request', label: 'Review Request', icon: Star, color: 'from-yellow-500 to-orange-500' },
    { value: 'reactivation', label: 'Reactivation', icon: RefreshCcw, color: 'from-purple-500 to-pink-500' },
  ];

  async function handleCreate() {
    if (!name.trim()) {
      setError('Template name is required');
      return;
    }

    if (!useAI && (!subject.trim() || !body.trim())) {
      setError('Subject and body are required when not using AI');
      return;
    }

    try {
      setCreating(true);
      setError('');

      const response = await apiPost('/api/templates/create', {
        name,
        campaignType: useAI ? campaignType : undefined,
        customSubject: !useAI ? subject : undefined,
        customBody: !useAI ? body : undefined,
        useAI,
        senderName: senderName || undefined,
        senderEmail: senderEmail || undefined,
        customerData: {
          storeName: senderName || 'Your Store',
        },
      });

      if (response.success) {
        onSuccess();
      }
    } catch (err) {
      console.error('Failed to create template:', err);
      setError(err.message || 'Failed to create template');
    } finally {
      setCreating(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="relative bg-gradient-to-br from-zinc-900 via-purple-900/10 to-zinc-900 rounded-3xl border border-purple-500/30 max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl shadow-purple-500/20"
      >
        {/* Animated Background */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-pink-500/5 to-orange-500/5 animate-gradient-slow"></div>

        {/* Header */}
        <div className="relative z-10 p-6 border-b border-purple-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.div
                className="p-3 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 shadow-xl"
                animate={{
                  boxShadow: [
                    '0 10px 30px rgba(168, 85, 247, 0.4)',
                    '0 10px 40px rgba(236, 72, 153, 0.6)',
                    '0 10px 30px rgba(168, 85, 247, 0.4)',
                  ],
                }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <Sparkles className="w-6 h-6 text-white" />
              </motion.div>
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent">
                  Create Email Template
                </h2>
                <p className="text-sm text-neutral-400 mt-1">Design your perfect email campaign</p>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className="p-3 rounded-xl bg-gradient-to-r from-zinc-800 to-zinc-700 border border-zinc-700 text-white hover:border-purple-500/50 transition-all shadow-lg"
            >
              <X className="w-5 h-5" />
            </motion.button>
          </div>
        </div>

        {/* Form */}
        <div className="relative z-10 p-6 space-y-4 max-h-[calc(90vh-200px)] overflow-y-auto">
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-4 rounded-xl bg-gradient-to-r from-red-500/10 to-pink-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2"
            >
              <AlertCircle className="w-5 h-5" />
              {error}
            </motion.div>
          )}

          {/* AI Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-purple-400" />
              <div>
                <div className="font-medium text-white">AI Generation</div>
                <div className="text-xs text-neutral-400">Let AI create content for you</div>
              </div>
            </div>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setUseAI(!useAI)}
              className={`relative w-14 h-7 rounded-full transition-all ${
                useAI ? 'bg-gradient-to-r from-purple-600 to-pink-600' : 'bg-zinc-700'
              }`}
            >
              <motion.div
                className="absolute top-1 w-5 h-5 bg-white rounded-full shadow-lg"
                animate={{ left: useAI ? '28px' : '4px' }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </motion.button>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Template Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Black Friday Sale"
              className="w-full px-4 py-3 rounded-xl bg-zinc-800/50 border border-purple-500/20 text-white placeholder-neutral-500 focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
            />
          </div>

          {useAI ? (
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Campaign Type *
              </label>
              <div className="grid grid-cols-1 gap-2">
                {campaignTypes.map(type => {
                  const TypeIcon = type.icon;
                  return (
                    <motion.button
                      key={type.value}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setCampaignType(type.value)}
                      className={`p-4 rounded-xl border transition-all text-left ${
                        campaignType === type.value
                          ? `bg-gradient-to-r ${type.color} bg-opacity-20 border-purple-500/50 shadow-lg`
                          : 'bg-zinc-800/30 border-zinc-700 hover:border-purple-500/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <TypeIcon className="w-5 h-5 text-white" />
                        <div className="font-medium text-white">{type.label}</div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Email Subject *
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Your email subject line"
                  className="w-full px-4 py-3 rounded-xl bg-zinc-800/50 border border-purple-500/20 text-white placeholder-neutral-500 focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Email Body *
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write your email content here..."
                  rows={6}
                  className="w-full px-4 py-3 rounded-xl bg-zinc-800/50 border border-purple-500/20 text-white placeholder-neutral-500 focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all resize-none"
                />
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Sender Name
              </label>
              <input
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="Your Store"
                className="w-full px-4 py-3 rounded-xl bg-zinc-800/50 border border-purple-500/20 text-white placeholder-neutral-500 focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Sender Email
              </label>
              <input
                type="email"
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                placeholder="noreply@store.com"
                className="w-full px-4 py-3 rounded-xl bg-zinc-800/50 border border-purple-500/20 text-white placeholder-neutral-500 focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="relative z-10 p-6 border-t border-purple-500/20 bg-gradient-to-r from-zinc-900 to-purple-900/10 flex items-center justify-end gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            className="px-6 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white hover:bg-zinc-700 transition-all shadow-lg"
          >
            Cancel
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleCreate}
            disabled={creating || !name.trim()}
            className="group relative px-8 py-3 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 text-white font-bold overflow-hidden shadow-2xl shadow-purple-500/50 disabled:opacity-50"
          >
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
              animate={{ x: creating ? ['-100%', '200%'] : '-100%' }}
              transition={{ duration: 1.5, repeat: creating ? Infinity : 0 }}
            />
            <div className="relative flex items-center gap-2">
              {creating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>Create Template</span>
                </>
              )}
            </div>
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
