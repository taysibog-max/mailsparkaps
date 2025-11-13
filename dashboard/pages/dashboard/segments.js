import AppShell from '../../components/AppShell';
import RequireAuth from '../../components/RequireAuth';
import { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../../lib/apiClient';
import { useProgressBar } from '../../components/ProgressBar';
import { Users, Plus, Filter, Trash2, Edit2, UserCheck } from 'lucide-react';
import { LoadingSpinner } from '../../components/LoadingSkeleton';

export default function SegmentsPage() {
  return (
    <RequireAuth>
      <AppShell>
        <SegmentsContent />
      </AppShell>
    </RequireAuth>
  );
}

function SegmentsContent() {
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSegmentName, setNewSegmentName] = useState('');
  const [creating, setCreating] = useState(false);
  const progressBar = useProgressBar();

  useEffect(() => {
    loadSegments();
  }, []);

  async function loadSegments() {
    try {
      setLoading(true);
      progressBar.start();
      const res = await apiGet('/api/segments/list');
      setSegments(res.segments || []);
    } catch (e) {
      console.error('Load segments error:', e);
    } finally {
      setLoading(false);
      progressBar.complete();
    }
  }

  async function handleCreateSegment(e) {
    e.preventDefault();
    if (!newSegmentName.trim()) return;

    try {
      setCreating(true);
      progressBar.start();
      
      await apiPost('/api/segments/create', { name: newSegmentName });
      
      setNewSegmentName('');
      setShowCreateModal(false);
      loadSegments();
    } catch (e) {
      alert('Failed to create segment: ' + e.message);
    } finally {
      setCreating(false);
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
          <h1 className="text-3xl font-bold text-gray-900">Contact Segments</h1>
          <p className="text-gray-600 mt-2">Organize your contacts into targeted lists</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Segment
        </button>
      </div>

      {/* Segments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {segments.map((segment) => (
          <div
            key={segment.id}
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div className="ml-3">
                  <h3 className="font-bold text-gray-900">{segment.name}</h3>
                  <p className="text-sm text-gray-500">
                    {segment.totalSubscribers || 0} contacts
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>Created: {new Date(segment.createdAt).toLocaleDateString()}</span>
              <button className="text-blue-600 hover:text-blue-700">
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {segments.length === 0 && (
          <div className="col-span-full text-center py-12">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No segments yet</h3>
            <p className="text-gray-600 mb-4">Create your first segment to organize your contacts</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create First Segment
            </button>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Create New Segment</h2>
            <form onSubmit={handleCreateSegment}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Segment Name
                </label>
                <input
                  type="text"
                  value={newSegmentName}
                  onChange={(e) => setNewSegmentName(e.target.value)}
                  placeholder="e.g., High-Value Customers"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewSegmentName('');
                  }}
                  disabled={creating}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {creating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Segment
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


