// frontend/src/pages/UserProfile.tsx
import { useEffect, useState } from 'react';
import Layout from '../components/layout/Layout';
import api from '../api';
import toast from 'react-hot-toast';
import { Mail, User, Shield, Calendar, Clock, CheckCircle, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';

interface User {
  id: number;
  username: string;
  email: string;
  name: string;
  role?: string;
  is_active?: boolean;
  created_at: string;
  permissions?: string[];
}

interface Notification {
  id: number;
  title: string;
  message: string;
  notification_type: string;
  category?: string;
  is_read: boolean;
  read_at?: string;
  created_at: string;
}

export default function UserProfile() {
  const [user, setUser] = useState<User | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [currentSlide, setCurrentSlide] = useState(0);

  // Hardcoded role details for different account types
  const roleDetailsMap: Record<string, { title: string; responsibilities: string; capabilities: string[] }> = {
    admin: {
      title: 'System Administrator — Full Access',
      responsibilities: 'Manages all system functions, user accounts, settings, approvals, and financial operations',
      capabilities: ['Create Users', 'Manage Roles', 'View Reports', 'System Settings', 'All Approvals'],
    },
    sales: {
      title: 'Sales Executive — Limited Access',
      responsibilities: 'Create and manage quotations, customer relationships, and nurture sales pipeline',
      capabilities: ['Create Quotations', 'Manage Customers', 'View Reports', 'Send Notifications', 'Track Orders'],
    },
    purchase: {
      title: 'Purchase Manager — Procurement Access',
      responsibilities: 'Manages procurement workflows, vendor lifecycle, purchase orders, and approval chains',
      capabilities: ['Create PO', 'Approve PO', 'Manage Vendors', 'View Financial Reports', 'Send to CEO'],
    },
  };

  // Carousel slides content
  const carouselSlides = [
    {
      title: 'Coming Soon',
      description: 'New Features',
      icon: '🚀',
    },
    {
      title: 'Coming Soon',
      description: 'Performance Updates',
      icon: '⚡',
    },
  ];

  useEffect(() => {
    fetchUserData();
  }, []);

  // Auto-rotate carousel every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % carouselSlides.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [carouselSlides.length]);

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % carouselSlides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + carouselSlides.length) % carouselSlides.length);
  };

  const fetchUserData = async () => {
    try {
      setLoading(true);
      // Fetch current user - handle both { user: {...} } and {...} responses
      const response = await api.getMe();
      const userData = response.user || response;
      setUser(userData || {});
      setFormData({
        name: userData?.name || '',
        email: userData?.email || '',
        password: '',
      });

      // Fetch user roles if user has ID (data structure for future use)
      if (userData?.id && userData.id > 0) {
        try {
          // const roleData = await api.getErpUser(userData.id);
          // Commented out for now - will be used when role/permission UI is implemented
        } catch (err) {
          console.error('Error fetching user roles:', err);
        }
      }

      // Fetch notifications
      try {
        const notifData = await api.getErpNotifications();
        setNotifications(Array.isArray(notifData) ? notifData.slice(0, 10) : []);
      } catch (err) {
        console.error('Error fetching notifications:', err);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      if (!formData.email) {
        toast.error('Email is required');
        return;
      }
      
      setSaving(true);
      const updatePayload: any = {
        name: formData.name,
        email: formData.email,
      };
      
      if (formData.password && formData.password.trim()) {
        updatePayload.password = formData.password;
      }

      console.log('📤 Sending profile update:', updatePayload);
      const result = await api.updateProfile(updatePayload);
      console.log('✅ Profile update response:', result);
      
      // Use the returned user data to update state immediately
      if (result?.user) {
        console.log('🔄 Using fresh user data from response:', result.user);
        setUser(result.user);
        setFormData({
          name: result.user.name || '',
          email: result.user.email || '',
          password: '',
        });
      }
      
      toast.success('Profile updated successfully');
      setEditMode(false);
      
      // Still refresh after a moment to ensure consistency
      await new Promise(resolve => setTimeout(resolve, 500));
      await fetchUserData();
      console.log('🔄 Profile data refreshed after update');
    } catch (err) {
      console.error('❌ Profile update failed:', err);
      toast.error(`Error updating profile: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Layout><div className="p-12 text-center text-gray-600">Loading profile...</div></Layout>;
  if (!user) return <Layout><div className="p-12 text-center text-gray-600">Failed to load user profile</div></Layout>;

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900">My Profile</h1>
            <p className="text-gray-600 mt-2">Manage your account, roles, and notifications</p>
          </div>

          {/* Top Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Account Status</p>
                  <p className="text-lg font-semibold text-gray-900 mt-2">{user.is_active !== false ? 'Active' : 'Inactive'}</p>
                </div>
                <CheckCircle className={`w-10 h-10 ${user.is_active !== false ? 'text-green-500' : 'text-gray-400'}`} />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Role</p>
                  <p className="text-lg font-semibold text-gray-900 mt-2 capitalize">{user.role || 'User'}</p>
                </div>
                <Shield className="w-10 h-10 text-blue-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Member Since</p>
                  <p className="text-lg font-semibold text-gray-900 mt-2">
                    {user?.created_at ? (
                      <span title={new Date(user.created_at).toLocaleString()}>
                        {new Date(user.created_at).getFullYear()}
                      </span>
                    ) : 'N/A'}
                  </p>
                </div>
                <Calendar className="w-10 h-10 text-purple-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Notifications</p>
                  <p className="text-lg font-semibold text-gray-900 mt-2">{notifications.filter(n => !n.is_read).length}</p>
                </div>
                <AlertCircle className="w-10 h-10 text-orange-500" />
              </div>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Profile Card Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-8">
                  <div className="flex justify-center">
                    <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-lg">
                      <span className="text-4xl font-bold text-blue-600">
                        {user?.name ? user.name.charAt(0).toUpperCase() : '?'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-900">{user?.name || 'User'}</h2>
                    <p className="text-gray-500 mt-1">@{user?.username || 'username'}</p>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-gray-200">
                    <div className="flex items-start gap-3">
                      <Mail className="w-5 h-5 text-gray-400 mt-1" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-500 uppercase">Email</p>
                        <p className="text-sm text-gray-900 break-all">{user?.email || '-'}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <User className="w-5 h-5 text-gray-400" />
                      <div className="flex-1">
                        <p className="text-xs font-medium text-gray-500 uppercase">Member Since</p>
                        <p className="text-sm text-gray-900">
                          {user?.created_at ? new Date(user.created_at).getFullYear() : 'N/A'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Shield className="w-5 h-5 text-gray-400" />
                      <div className="flex-1">
                        <p className="text-xs font-medium text-gray-500 uppercase">Account Type</p>
                        <p className="text-sm text-gray-900 capitalize">{user?.role || 'standard'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Account Settings */}
              <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                  <h2 className="text-lg font-bold text-gray-900">Account Information</h2>
                  {!editMode && (
                    <button
                      onClick={() => setEditMode(true)}
                      className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Edit Profile
                    </button>
                  )}
                </div>

                <div className="p-6">
                  {editMode ? (
                    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSaveProfile(); }}>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Your full name"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="your.email@example.com"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">New Password</label>
                        <input
                          type="password"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Leave blank to keep current password"
                        />
                        <p className="text-xs text-gray-500 mt-1">Leave blank to keep your current password</p>
                      </div>

                      <div className="flex gap-3 pt-6 border-t border-gray-200">
                        <button
                          type="button"
                          onClick={() => {
                            setEditMode(false);
                            setFormData({ 
                              name: user?.name || '', 
                              email: user?.email || '', 
                              password: '' 
                            });
                          }}
                          className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={saving}
                          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50"
                        >
                          {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase mb-1">Full Name</p>
                          <p className="text-gray-900 font-medium">{user?.name || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase mb-1">Email</p>
                          <p className="text-gray-900 font-medium">{user?.email || '-'}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase mb-1">Username</p>
                        <p className="text-gray-900 font-medium">{user?.username || '-'}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Roles & Permissions - Enterprise Access Control Dashboard */}
              <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-bold text-gray-900">🔐 Access Control & Responsibilities</h2>
                  <p className="text-sm text-gray-600 mt-1">Complete audit trail of your roles and permissions</p>
                </div>

                <div className="p-6">
                  {user && roleDetailsMap[user?.role?.toLowerCase() || 'viewer'] ? (
                    <div className="space-y-6">
                      {/* Primary Role with Hardcoded Details */}
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Primary Role</p>
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-6">
                          <div className="flex items-start gap-4">
                            <div className="flex-shrink-0">
                              <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-blue-600 text-white font-bold text-lg">
                                {user?.role?.charAt(0).toUpperCase()}
                              </div>
                            </div>
                            <div className="flex-1">
                              <h3 className="text-xl font-bold text-gray-900">
                                {roleDetailsMap[user?.role?.toLowerCase() || 'viewer']?.title}
                              </h3>
                              <p className="text-gray-700 mt-2">
                                {roleDetailsMap[user?.role?.toLowerCase() || 'viewer']?.responsibilities}
                              </p>
                              {user?.created_at && (
                                <p className="text-xs text-gray-600 mt-3">
                                  <Clock className="w-3 h-3 inline mr-1" />
                                  Role assigned on {new Date(user.created_at).toLocaleDateString('en-US', { 
                                    year: 'numeric', 
                                    month: 'short', 
                                    day: 'numeric'
                                  })}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Scope of Control */}
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Scope of Control</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <p className="text-xs text-gray-600 uppercase tracking-wide">Access Level</p>
                            <p className="text-sm font-semibold text-gray-900 mt-1">
                              {user?.role?.toLowerCase() === 'admin' ? '🌍 Global' : '🏢 Assigned'}
                            </p>
                          </div>
                          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <p className="text-xs text-gray-600 uppercase tracking-wide">Data Scope</p>
                            <p className="text-sm font-semibold text-gray-900 mt-1">
                              {user?.role?.toLowerCase() === 'admin' ? 'All Records' : 'Assigned Records'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Permission Capabilities Snapshot */}
                      {/* Key Capabilities from Hardcoded Data */}
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Key Capabilities</p>
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                          <div className="flex items-start gap-3">
                            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <div className="flex flex-wrap gap-2">
                                {roleDetailsMap[user?.role?.toLowerCase() || 'viewer']?.capabilities.map((cap, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold bg-blue-100 text-blue-800"
                                  >
                                    {cap}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-lg font-semibold text-gray-900">No Active Roles</p>
                      <p className="text-gray-600 mt-2">Your account has no roles assigned yet</p>
                      <p className="text-sm text-gray-500 mt-1">Contact an administrator to request access and role assignment</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Notifications - Auto-rotating Carousel */}
              <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-bold text-gray-900">Recent Notifications</h2>
                  <p className="text-sm text-gray-600 mt-1">Latest updates and announcements</p>
                </div>

                <div className="relative">
                  {/* Carousel Container */}
                  <div className="relative h-64 overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-50">
                    {/* Slides */}
                    {carouselSlides.map((slide, idx) => (
                      <div
                        key={idx}
                        className={`absolute inset-0 transition-opacity duration-1000 ease-in-out flex items-center justify-center ${
                          idx === currentSlide ? 'opacity-100' : 'opacity-0'
                        }`}
                      >
                        <div className="text-center px-6">
                          <div className="text-6xl mb-4">{slide.icon}</div>
                          <h3 className="text-3xl font-bold text-gray-900 mb-2">{slide.title}</h3>
                          <p className="text-lg text-gray-600">{slide.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Navigation Arrows */}
                  <button
                    onClick={prevSlide}
                    aria-label="Previous slide"
                    className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white text-gray-800 p-2 rounded-full shadow-md transition-all z-10"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    onClick={nextSlide}
                    aria-label="Next slide"
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white text-gray-800 p-2 rounded-full shadow-md transition-all z-10"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>

                  {/* Slide Indicators */}
                  <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
                    {carouselSlides.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => goToSlide(idx)}
                        aria-label={`Go to slide ${idx + 1}`}
                        className={`w-3 h-3 rounded-full transition-all ${
                          idx === currentSlide
                            ? 'bg-blue-600 w-8'
                            : 'bg-gray-400 hover:bg-gray-500'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
