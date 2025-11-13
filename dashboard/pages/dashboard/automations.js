import AppShell from '../../components/AppShell';
import RequireAuth from '../../components/RequireAuth';
import { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../../lib/apiClient';
import { useProgressBar } from '../../components/ProgressBar';
import { 
  Zap, Plus, Play, Pause, Edit2, Trash2, Clock, 
  Mail, ShoppingCart, UserPlus, Star, RefreshCcw 
} from 'lucide-react';
import { LoadingSpinner } from '../../components/LoadingSkeleton';

export default function AutomationsPage() {
  return (
    <RequireAuth>
      <AppShell>
        <AutomationsContent />
      </AppShell>
    </RequireAuth>
  );
}

function AutomationsContent() {
  const [automations, setAutomations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const progressBar = useProgressBar();

  // Predefined automation templates
  const automationTemplates = [
    {
      type: 'abandoned_cart',
      name: 'Abandoned Cart Recovery',
      description: 'Send emails to customers who left items in their cart',
      icon: ShoppingCart,
      color: 'from-orange-500 to-red-500',
      trigger: 'cart_abandoned',
      delay: 120, // 2 hours
    },
    {
      type: 'welcome_series',
      name: 'Welcome Email Series',
      description: 'Greet new subscribers with a series of welcome emails',
      icon: UserPlus,
      color: 'from-blue-500 to-cyan-500',
      trigger: 'contact_created',
      delay: 0,
    },
    {
      type: 'post_purchase',
      name: 'Post-Purchase Follow-up',
      description: 'Thank customers and request reviews after purchase',
      icon: Star,
      color: 'from-green-500 to-emerald-500',
      trigger: 'order_completed',
      delay: 168, // 7 days
    },
    {
      type: 'reactivation',
      name: 'Re-engagement Campaign',
      description: 'Win back inactive customers with special offers',
      icon: RefreshCcw,
      color: 'from-purple-500 to-pink-500',
      trigger: 'inactive_30_days',
      delay: 0,
    },
  ];

  useEffect(() => {
    loadAutomations();
  }, []);

  async function loadAutomations() {
    try {
      setLoading(true);
      progressBar.start();
      
      // For now, load from local state or API
      // In future, this would call Brevo's automation API
      const res = await apiGet('/api/automations/list').catch(() => ({ automations: [] }));
      setAutomations(res.automations || []);
    } catch (e) {
      console.error('Load automations error:', e);
    } finally {
      setLoading(false);
      progressBar.complete();
    }
  }

  async function handleToggleAutomation(automationId, currentStatus) {
    try {
      progressBar.start();
      const newStatus = currentStatus === 'active' ? 'paused' : 'active';
      
      await apiPost('/api/automations/toggle', { 
        automationId, 
        status: newStatus 
      });
      
      // Update local state
      setAutomations(prev => prev.map(auto => 
        auto.id === automationId 
          ? { ...auto, status: newStatus }
          : auto
      ));
      
      progressBar.complete();
    } catch (e) {
      alert('Failed to toggle automation: ' + e.message);
      progressBar.complete();
    }
  }

  async function handleCreateAutomation(template) {
    try {
      progressBar.start();
      
      const result = await apiPost('/api/automations/create', {
        type: template.type,
        name: template.name,
        trigger: template.trigger,
        delay: template.delay,
        status: 'draft',
      });

      setAutomations(prev => [...prev, result.automation]);
      setShowCreateModal(false);
      progressBar.complete();
      
      // Redirect to edit page
      window.location.href = `/dashboard/automations/${result.automation.id}`;
    } catch (e) {
      alert('Failed to create automation: ' + e.message);
      progressBar.complete();
    }
  }

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Marketing Automations</h1>
          <p className="text-gray-600 mt-2">Create automated workflows to engage your customers</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Automation
        </button>
      </div>

      {/* Active Automations */}
      {automations.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Your Automations</h2>
          <div className="space-y-4">
            {automations.map((automation) => {
              const template = automationTemplates.find(t => t.type === automation.type) || {};
              const Icon = template.icon || Zap;
              
              return (
                <div
                  key={automation.id}
                  className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className={`w-14 h-14 bg-gradient-to-br ${template.color || 'from-gray-500 to-gray-700'} rounded-lg flex items-center justify-center`}>
                        <Icon className="w-7 h-7 text-white" />
                      </div>
                      
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">{automation.name}</h3>
                        <p className="text-sm text-gray-600">{template.description}</p>
                        <div className="flex items-center mt-2 space-x-4 text-sm text-gray-500">
                          <span className="flex items-center">
                            <Clock className="w-4 h-4 mr-1" />
                            Delay: {automation.delay || 0} min
                          </span>
                          <span className="flex items-center">
                            <Mail className="w-4 h-4 mr-1" />
                            {automation.emailsSent || 0} sent
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            automation.status === 'active' 
                              ? 'bg-green-100 text-green-800'
                              : automation.status === 'paused'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {automation.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleToggleAutomation(automation.id, automation.status)}
                        className={`p-2 rounded-lg ${
                          automation.status === 'active'
                            ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                        title={automation.status === 'active' ? 'Pause' : 'Activate'}
                      >
                        {automation.status === 'active' ? (
                          <Pause className="w-5 h-5" />
                        ) : (
                          <Play className="w-5 h-5" />
                        )}
                      </button>
                      <button
                        onClick={() => window.location.href = `/dashboard/automations/${automation.id}`}
                        className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                        title="Edit"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {automations.length === 0 && (
        <div className="text-center py-12">
          <Zap className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No automations yet</h3>
          <p className="text-gray-600 mb-6">Create your first automation to start engaging customers automatically</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create Your First Automation
          </button>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Choose Automation Template</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {automationTemplates.map((template) => {
                const Icon = template.icon;
                return (
                  <button
                    key={template.type}
                    onClick={() => handleCreateAutomation(template)}
                    className="text-left bg-white border-2 border-gray-200 rounded-lg p-6 hover:border-blue-500 hover:shadow-md transition-all"
                  >
                    <div className={`w-12 h-12 bg-gradient-to-br ${template.color} rounded-lg flex items-center justify-center mb-4`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">{template.name}</h3>
                    <p className="text-sm text-gray-600">{template.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
