"use client";

import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  Activity, Users, Settings, MessageSquare, Shield, Terminal, 
  Database, RefreshCw, LayoutDashboard, Send, Power, LogIn, Lock, 
  User, CheckCircle, AlertTriangle, Play, HelpCircle, FileText, Download,
  ToggleLeft, ToggleRight, Trash2, Plus, Edit, PlusCircle, ShieldAlert,
  Menu, X
} from 'lucide-react';

// API Server Address dynamically resolved to VPS IP / Host
const API_URL = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:5000`
  : 'http://localhost:5000';

interface RealtimeLog {
  timestamp: string;
  category: string;
  message: string;
  details?: any;
}

interface GroupSetting {
  id?: string;
  groupId: string;
  welcomeEnabled: boolean;
  welcomeStickerEnabled?: boolean;
  welcomeMessage: string;
  antiLink: boolean;
  antiSpam: boolean;
  antiFlood: boolean;
  antiToxic: boolean;
  antiBadWord: boolean;
  antiVirtex: boolean;
  antiDelete: boolean;
  antiEdit: boolean;
  antiFakeNumber: boolean;
  antiBot: boolean;
  antiCall: boolean;
  antiPromote: boolean;
  antiDemote: boolean;
  antiOpenGroup: boolean;
  antiCloseGroup: boolean;
  antiInvite: boolean;
  antiMentionSpam: boolean;
  antiMediaSpam: boolean;
  antiStickerSpam: boolean;
  aiEnabled: boolean;
}

interface Group {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  memberCount: number;
  adminCount: number;
  status: boolean;
  settings?: GroupSetting;
}

interface AutoReply {
  id: string;
  keyword: string;
  response: string;
  status: boolean;
}

interface ServerMetrics {
  memory: number;
  freeMemory: number;
  cpu: number;
  uptime: number;
}

export default function DashboardPage() {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [username, setUsername] = useState<string>('admin');
  const [password, setPassword] = useState<string>('');
  const [token, setToken] = useState<string>('');
  const [authError, setAuthError] = useState<string>('');

  // Active view tab
  const [activeTab, setActiveTab] = useState<string>('commands');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Real-time state from Socket.IO
  const [botConnected, setBotConnected] = useState<boolean>(false);
  const [botUser, setBotUser] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<ServerMetrics>({ memory: 0, freeMemory: 0, cpu: 0, uptime: 0 });
  const [logs, setLogs] = useState<RealtimeLog[]>([]);

  // Fetchable states
  const [groups, setGroups] = useState<Group[]>([]);
  const [autoReplies, setAutoReplies] = useState<AutoReply[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [newGroupJid, setNewGroupJid] = useState<string>('');
  const [newGroupName, setNewGroupName] = useState<string>('');
  const [isEditingGroupName, setIsEditingGroupName] = useState<boolean>(false);
  const [editingGroupNameText, setEditingGroupNameText] = useState<string>('');
  
  // Settings state
  const [ownerNumber, setOwnerNumber] = useState<string>('');
  const [openaiApiKey, setOpenaiApiKey] = useState<string>('');
  const [cooldownMs, setCooldownMs] = useState<number>(3000);
  const [prefix, setPrefix] = useState<string>('!');
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);
  const [aiSystemPrompt, setAiSystemPrompt] = useState<string>('');
  const [aiModel, setAiModel] = useState<string>('gemini-1.5-flash');
  const [aiTemperature, setAiTemperature] = useState<number>(0.3);
  const [aiMaxTokens, setAiMaxTokens] = useState<number>(800);
  const [badWords, setBadWords] = useState<string>('');
  const [sysMsg, setSysMsg] = useState<string>('');

  // Global Admins and Blacklist management
  const [adminsList, setAdminsList] = useState<any[]>([]);
  const [newAdminJid, setNewAdminJid] = useState<string>('');
  const [newAdminRole, setNewAdminRole] = useState<string>('Admin');
  const [newAdminName, setNewAdminName] = useState<string>('');

  const [blacklistList, setBlacklistList] = useState<any[]>([]);
  const [newBlacklistJid, setNewBlacklistJid] = useState<string>('');
  const [newBlacklistReason, setNewBlacklistReason] = useState<string>('');

  const [registeredUsersList, setRegisteredUsersList] = useState<any[]>([]);
  const [newRegJid, setNewRegJid] = useState<string>('');
  const [newRegName, setNewRegName] = useState<string>('');
  const [newRegUpbjj, setNewRegUpbjj] = useState<string>('');
  const [editingRegId, setEditingRegId] = useState<string | null>(null);

  // Form states for Auto Reply CRUD
  const [newKeyword, setNewKeyword] = useState<string>('');
  const [newResponse, setNewResponse] = useState<string>('');
  const [isEditingReply, setIsEditingReply] = useState<string | null>(null);

  // Broadcast state
  const [broadcastTarget, setBroadcastTarget] = useState<string>('all_groups');
  const [broadcastMessage, setBroadcastMessage] = useState<string>('');
  const [broadcastStatus, setBroadcastStatus] = useState<string>('');

  // Socket reference
  const socketRef = useRef<Socket | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  // Check token on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('access_token');
    if (savedToken) {
      setToken(savedToken);
      setIsAuthenticated(true);
    }
  }, []);

  // Fetch functions
  const fetchWithAuth = async (endpoint: string, options: RequestInit = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token || localStorage.getItem('access_token')}`,
      ...options.headers
    };
    const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
    if (res.status === 401 || res.status === 403) {
      handleLogout();
      throw new Error('Session expired');
    }
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Request failed');
    }
    return data;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }
      localStorage.setItem('access_token', data.accessToken);
      setToken(data.accessToken);
      setIsAuthenticated(true);
    } catch (err: any) {
      setAuthError(err.message || 'Connection refused');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    setToken('');
    setIsAuthenticated(false);
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
  };

  // Keep a ref of loadGroupsData to avoid closure staleness in socket listener
  const loadGroupsDataRef = useRef<(() => Promise<void>) | null>(null);
  useEffect(() => {
    loadGroupsDataRef.current = loadGroupsData;
  });

  // Socket and State Initialization
  useEffect(() => {
    // Connect socket for everyone to stream live metrics/logs
    socketRef.current = io(API_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });

    socketRef.current.on('bot_status', (data) => {
      setBotConnected(data.connected);
      setBotUser(data.botUser);
      setQrCode(data.qr);
    });

    socketRef.current.on('server_metrics', (data) => {
      setMetrics(data);
    });

    socketRef.current.on('realtime_log', (log: RealtimeLog) => {
      setLogs(prev => [...prev.slice(-99), log]);
    });

    socketRef.current.on('groups_updated', () => {
      if (localStorage.getItem('access_token') && loadGroupsDataRef.current) {
        loadGroupsDataRef.current();
      }
    });

    // Load static app logs on start publicly
    fetch(`${API_URL}/logs`)
      .then(res => res.json())
      .then(data => {
        const parsedLogs = data.map((line: string) => {
          const match = line.match(/^\[(.*?)\] \[(.*?)\] (.*)$/);
          if (match) {
            return {
              timestamp: match[1],
              category: match[2],
              message: match[3]
            };
          }
          return { timestamp: '', category: 'Log', message: line };
        });
        setLogs(parsedLogs);
      })
      .catch(() => {});

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Only load protected data if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadGroupsData();
      loadAutoRepliesData();
      loadSettingsData();
      loadRegisteredUsersData();
    }
  }, [isAuthenticated]);

  // Scroll logs
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Group load
  const loadGroupsData = async () => {
    try {
      const data = await fetchWithAuth('/api/groups');
      if (Array.isArray(data)) {
        setGroups(data);
        
        setSelectedGroup(currentSelected => {
          if (!currentSelected) return null;
          const currentGroup = data.find((g: Group) => g.id === currentSelected.id);
          if (!currentGroup || !currentGroup.status) {
            return null;
          }
          return currentGroup;
        });
      }
    } catch (_) {}
  };

  // Auto replies load
  const loadAutoRepliesData = async () => {
    try {
      const data = await fetchWithAuth('/api/auto-replies');
      if (Array.isArray(data)) {
        setAutoReplies(data);
      }
    } catch (_) {}
  };

  // Load global system settings
  const loadSettingsData = async () => {
    try {
      const data = await fetchWithAuth('/api/settings');
      setOwnerNumber(data.OWNER_NUMBER || '');
      setOpenaiApiKey(data.OPENAI_API_KEY || '');
      setCooldownMs(data.COOLDOWN_MS || 3000);
      setPrefix(data.PREFIX || '!');
      
      // Load extended settings
      setAiSystemPrompt(data.AI_SYSTEM_PROMPT || '');
      setAiModel(data.AI_MODEL || 'gemini-1.5-flash');
      setAiTemperature(data.AI_TEMPERATURE !== undefined ? parseFloat(data.AI_TEMPERATURE) : 0.3);
      setAiMaxTokens(data.AI_MAX_TOKENS !== undefined ? parseInt(data.AI_MAX_TOKENS) : 800);
      setBadWords(data.BAD_WORDS || '');
    } catch (_) {}
  };

  // Save global system settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      await fetchWithAuth('/api/settings', {
        method: 'POST',
        body: JSON.stringify({
          OWNER_NUMBER: ownerNumber,
          OPENAI_API_KEY: openaiApiKey,
          COOLDOWN_MS: cooldownMs,
          PREFIX: prefix,
          AI_SYSTEM_PROMPT: aiSystemPrompt,
          AI_MODEL: aiModel,
          AI_TEMPERATURE: aiTemperature,
          AI_MAX_TOKENS: aiMaxTokens,
          BAD_WORDS: badWords
        })
      });
      setSysMsg('Pengaturan berhasil disimpan!');
      setTimeout(() => setSysMsg(''), 3000);
    } catch (_) {
      setSysMsg('Gagal menyimpan pengaturan.');
      setTimeout(() => setSysMsg(''), 3000);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Global Admins handlers
  const loadAdminsData = async () => {
    try {
      const data = await fetchWithAuth('/api/admins');
      if (Array.isArray(data)) {
        setAdminsList(data);
      }
    } catch (_) {}
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminJid) return;
    try {
      let formattedJid = newAdminJid.trim();
      if (!formattedJid.includes('@')) {
        formattedJid = formattedJid.replace(/[^0-9]/g, '') + '@c.us';
      }
      await fetchWithAuth('/api/admins', {
        method: 'POST',
        body: JSON.stringify({
          whatsappId: formattedJid,
          role: newAdminRole,
          name: newAdminName || formattedJid.split('@')[0]
        })
      });
      setNewAdminJid('');
      setNewAdminName('');
      loadAdminsData();
    } catch (_) {}
  };

  const handleDeleteAdmin = async (whatsappId: string) => {
    try {
      await fetchWithAuth(`/api/admins/${encodeURIComponent(whatsappId)}`, {
        method: 'DELETE'
      });
      loadAdminsData();
    } catch (_) {}
  };

  // Blacklist handlers
  const loadBlacklistData = async () => {
    try {
      const data = await fetchWithAuth('/api/blacklist');
      if (Array.isArray(data)) {
        setBlacklistList(data);
      }
    } catch (_) {}
  };

  const handleAddBlacklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlacklistJid) return;
    try {
      let formattedJid = newBlacklistJid.trim();
      if (!formattedJid.includes('@')) {
        formattedJid = formattedJid.replace(/[^0-9]/g, '') + '@c.us';
      }
      await fetchWithAuth('/api/blacklist', {
        method: 'POST',
        body: JSON.stringify({
          whatsappId: formattedJid,
          reason: newBlacklistReason || 'Melanggar aturan bot'
        })
      });
      setNewBlacklistJid('');
      setNewBlacklistReason('');
      loadBlacklistData();
    } catch (_) {}
  };

  const handleDeleteBlacklist = async (whatsappId: string) => {
    try {
      await fetchWithAuth(`/api/blacklist/${encodeURIComponent(whatsappId)}`, {
        method: 'DELETE'
      });
      loadBlacklistData();
    } catch (_) {}
  };

  // Registered Users handlers
  const loadRegisteredUsersData = async () => {
    try {
      const data = await fetchWithAuth('/api/registered-users');
      if (Array.isArray(data)) {
        setRegisteredUsersList(data);
      }
    } catch (_) {}
  };

  const navigateTo = (tabName: string, requireAuth: boolean = true) => {
    if (requireAuth && !isAuthenticated) {
      setActiveTab('login');
    } else {
      setActiveTab(tabName);
    }
    
    // Load fresh data when switching to the tab
    if (isAuthenticated || !requireAuth) {
      if (tabName === 'groups') loadGroupsData();
      if (tabName === 'auto-reply') loadAutoRepliesData();
      if (tabName === 'settings') loadSettingsData();
      if (tabName === 'rbac') {
        loadAdminsData();
        loadBlacklistData();
      }
      if (tabName === 'registered-users') loadRegisteredUsersData();
    }
    
    setIsMobileMenuOpen(false);
  };

  const handleAddOrUpdateRegisteredUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRegJid || !newRegName || !newRegUpbjj) return;
    try {
      let formattedJid = newRegJid.trim();
      if (!formattedJid.includes('@')) {
        formattedJid = formattedJid.replace(/[^0-9]/g, '') + '@c.us';
      }
      await fetchWithAuth('/api/registered-users', {
        method: 'POST',
        body: JSON.stringify({
          id: editingRegId || undefined,
          whatsappId: formattedJid,
          name: newRegName.trim(),
          upbjj: newRegUpbjj.trim()
        })
      });
      setNewRegJid('');
      setNewRegName('');
      setNewRegUpbjj('');
      setEditingRegId(null);
      loadRegisteredUsersData();
    } catch (_) {}
  };

  const handleEditRegisteredUserClick = (user: any) => {
    setEditingRegId(user.id);
    setNewRegJid(user.whatsappId.split('@')[0]);
    setNewRegName(user.name);
    setNewRegUpbjj(user.upbjj);
  };

  const handleCancelRegEdit = () => {
    setEditingRegId(null);
    setNewRegJid('');
    setNewRegName('');
    setNewRegUpbjj('');
  };

  const handleDeleteRegisteredUser = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus pendaftaran mahasiswa ini?')) return;
    try {
      await fetchWithAuth(`/api/registered-users/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      loadRegisteredUsersData();
    } catch (_) {}
  };

  // System actions
  const handleRestartBot = async () => {
    if (!confirm('Apakah Anda yakin ingin merestart bot secara remote?')) return;
    try {
      setSysMsg('Mengirim perintah restart...');
      await fetchWithAuth('/api/system/restart', { method: 'POST' });
      setSysMsg('Bot sedang melakukan restart...');
      setTimeout(() => setSysMsg(''), 5000);
    } catch (_) {
      setSysMsg('Gagal merestart bot.');
      setTimeout(() => setSysMsg(''), 3000);
    }
  };

  const handleClearLogs = async () => {
    if (!confirm('Apakah Anda yakin ingin membersihkan seluruh file log?')) return;
    try {
      await fetchWithAuth('/api/system/clear-logs', { method: 'POST' });
      setLogs([]);
      setSysMsg('Log berhasil dibersihkan!');
      setTimeout(() => setSysMsg(''), 3000);
    } catch (_) {}
  };

  // Group setting save
  const handleSaveGroupSettings = async (groupId: string, updatedSettings: Partial<GroupSetting>) => {
    try {
      const res = await fetchWithAuth(`/api/groups/${groupId}/settings`, {
        method: 'POST',
        body: JSON.stringify(updatedSettings)
      });
      if (res.success) {
        loadGroupsData();
        if (selectedGroup && selectedGroup.id === groupId) {
          setSelectedGroup(prev => {
            if (!prev) return null;
            return {
              ...prev,
              settings: {
                ...(prev.settings as GroupSetting),
                ...updatedSettings
              }
            };
          });
        }
      }
    } catch (_) {}
  };

  // Group CRUD handlers
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupJid) return;
    try {
      let formattedJid = newGroupJid.trim();
      if (!formattedJid.includes('@')) {
        formattedJid = formattedJid.replace(/[^0-9]/g, '') + '@g.us';
      }
      await fetchWithAuth('/api/groups', {
        method: 'POST',
        body: JSON.stringify({
          id: formattedJid,
          name: newGroupName.trim() || undefined,
          status: true
        })
      });
      setNewGroupJid('');
      setNewGroupName('');
      loadGroupsData();
    } catch (_) {}
  };

  const handleRenameGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || !editingGroupNameText.trim()) return;
    try {
      const id = selectedGroup.id;
      const newName = editingGroupNameText.trim();
      await fetchWithAuth('/api/groups', {
        method: 'POST',
        body: JSON.stringify({
          id,
          name: newName,
          status: selectedGroup.status
        })
      });
      setIsEditingGroupName(false);
      setSelectedGroup(prev => prev ? { ...prev, name: newName } : null);
      loadGroupsData();
    } catch (_) {}
  };

  const handleDeleteGroup = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus grup ini dari whitelist? Seluruh pengaturan grup ini akan dihapus.')) return;
    try {
      await fetchWithAuth(`/api/groups/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      setSelectedGroup(null);
      loadGroupsData();
    } catch (_) {}
  };

  // Auto reply delete
  const handleDeleteAutoReply = async (id: string) => {
    try {
      await fetchWithAuth(`/api/auto-replies/${id}`, { method: 'DELETE' });
      loadAutoRepliesData();
    } catch (_) {}
  };

  // Auto reply add
  const handleAddAutoReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword || !newResponse) return;
    try {
      await fetchWithAuth('/api/auto-replies', {
        method: 'POST',
        body: JSON.stringify({ keyword: newKeyword, response: newResponse })
      });
      setNewKeyword('');
      setNewResponse('');
      loadAutoRepliesData();
    } catch (_) {}
  };

  // Broadcast send
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMessage) return;
    setBroadcastStatus('Sending...');
    try {
      const res = await fetchWithAuth('/api/broadcast', {
        method: 'POST',
        body: JSON.stringify({
          message: broadcastMessage,
          targetType: broadcastTarget
        })
      });
      if (res.success) {
        setBroadcastStatus('Success: Broadcast queued!');
        setBroadcastMessage('');
      } else {
        setBroadcastStatus('Failed: ' + res.error);
      }
    } catch (err: any) {
      setBroadcastStatus('Error: ' + err.message);
    }
  };

  const formatUptime = (sec: number) => {
    if (sec === 0) return '0s';
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    const parts = [];
    if (hrs > 0) parts.push(`${hrs}j`);
    if (mins > 0) parts.push(`${mins}m`);
    parts.push(`${secs}d`);
    return parts.join(' ');
  };

  return (
    <div className="min-h-screen bg-[#05070c] text-slate-100 flex flex-col md:flex-row">
      {/* MOBILE HEADER */}
      <header className="md:hidden bg-gray-950 border-b border-gray-900/60 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-base font-bold shadow-md shadow-indigo-500/10">
            UT
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight">Enterprise WA</h2>
            <p className="text-[8px] text-gray-500 uppercase tracking-widest font-semibold">Dashboard</p>
          </div>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="text-slate-400 hover:text-white p-2 hover:bg-gray-900 rounded-lg transition cursor-pointer"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {/* MOBILE MENU BACKDROP */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-gray-950 border-r border-gray-900/60 flex flex-col p-6 gap-6 transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0 md:bg-gray-950/80
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-xl font-bold shadow-md shadow-indigo-500/10">
            UT
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Enterprise WA</h2>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Dashboard Panel</p>
          </div>
        </div>

        <nav className="flex flex-col gap-1.5 flex-1">
          {/* Dashboard */}
          <button
            onClick={() => navigateTo('dashboard')}
            className={`flex items-center justify-between w-full px-4 py-3 rounded-xl text-sm font-semibold tracking-wide transition cursor-pointer ${
              activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10' : 'text-slate-400 hover:bg-gray-900 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <LayoutDashboard className="w-5 h-5" />
              <span>Dashboard</span>
            </div>
            {!isAuthenticated && <Lock className="w-3.5 h-3.5 text-gray-500" />}
          </button>

          {/* Grup Moderasi */}
          <button
            onClick={() => navigateTo('groups')}
            className={`flex items-center justify-between w-full px-4 py-3 rounded-xl text-sm font-semibold tracking-wide transition cursor-pointer ${
              activeTab === 'groups' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10' : 'text-slate-400 hover:bg-gray-900 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5" />
              <span>Grup Moderasi</span>
            </div>
            {!isAuthenticated && <Lock className="w-3.5 h-3.5 text-gray-500" />}
          </button>

          {/* Auto Reply */}
          <button
            onClick={() => navigateTo('auto-reply')}
            className={`flex items-center justify-between w-full px-4 py-3 rounded-xl text-sm font-semibold tracking-wide transition cursor-pointer ${
              activeTab === 'auto-reply' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10' : 'text-slate-400 hover:bg-gray-900 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <MessageSquare className="w-5 h-5" />
              <span>Auto Reply</span>
            </div>
            {!isAuthenticated && <Lock className="w-3.5 h-3.5 text-gray-500" />}
          </button>

          {/* Broadcast */}
          <button
            onClick={() => navigateTo('broadcast')}
            className={`flex items-center justify-between w-full px-4 py-3 rounded-xl text-sm font-semibold tracking-wide transition cursor-pointer ${
              activeTab === 'broadcast' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10' : 'text-slate-400 hover:bg-gray-900 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <Send className="w-5 h-5" />
              <span>Broadcast</span>
            </div>
            {!isAuthenticated && <Lock className="w-3.5 h-3.5 text-gray-500" />}
          </button>

          {/* Daftar Perintah (Public) */}
          <button
            onClick={() => navigateTo('commands', false)}
            className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-semibold tracking-wide transition cursor-pointer ${
              activeTab === 'commands' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10' : 'text-slate-400 hover:bg-gray-900 hover:text-white'
            }`}
          >
            <HelpCircle className="w-5 h-5" />
            <span>Daftar Perintah</span>
          </button>

          {/* Akses & Blokir */}
          <button
            onClick={() => navigateTo('rbac')}
            className={`flex items-center justify-between w-full px-4 py-3 rounded-xl text-sm font-semibold tracking-wide transition cursor-pointer ${
              activeTab === 'rbac' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10' : 'text-slate-400 hover:bg-gray-900 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5" />
              <span>Akses & Blokir</span>
            </div>
            {!isAuthenticated && <Lock className="w-3.5 h-3.5 text-gray-500" />}
          </button>

          {/* Mahasiswa Terdaftar */}
          <button
            onClick={() => navigateTo('registered-users')}
            className={`flex items-center justify-between w-full px-4 py-3 rounded-xl text-sm font-semibold tracking-wide transition cursor-pointer ${
              activeTab === 'registered-users' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10' : 'text-slate-400 hover:bg-gray-900 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <User className="w-5 h-5" />
              <span>Mahasiswa Terdaftar</span>
            </div>
            {!isAuthenticated && <Lock className="w-3.5 h-3.5 text-gray-500" />}
          </button>

          {/* Realtime Logs (Public) */}
          <button
            onClick={() => navigateTo('logs', false)}
            className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-semibold tracking-wide transition cursor-pointer ${
              activeTab === 'logs' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10' : 'text-slate-400 hover:bg-gray-900 hover:text-white'
            }`}
          >
            <Terminal className="w-5 h-5" />
            <span>Realtime Logs</span>
          </button>

          {/* Pengaturan Bot */}
          <button
            onClick={() => navigateTo('settings')}
            className={`flex items-center justify-between w-full px-4 py-3 rounded-xl text-sm font-semibold tracking-wide transition cursor-pointer ${
              activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10' : 'text-slate-400 hover:bg-gray-900 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5" />
              <span>Pengaturan Bot</span>
            </div>
            {!isAuthenticated && <Lock className="w-3.5 h-3.5 text-gray-500" />}
          </button>
        </nav>

        {isAuthenticated ? (
          <button
            onClick={() => {
              handleLogout();
              setIsMobileMenuOpen(false);
            }}
            className="flex items-center justify-center gap-2 px-4 py-3.5 border border-gray-800 hover:bg-red-950/20 hover:border-red-900/60 text-slate-400 hover:text-red-400 rounded-xl text-sm font-semibold transition cursor-pointer w-full"
          >
            <Power className="w-5 h-5" />
            <span>Keluar Sistem</span>
          </button>
        ) : (
          <button
            onClick={() => navigateTo('login', false)}
            className={`flex items-center justify-center gap-2 px-4 py-3.5 border border-gray-800 hover:bg-indigo-950/20 hover:border-indigo-900/60 rounded-xl text-sm font-semibold transition cursor-pointer w-full ${
              activeTab === 'login' ? 'bg-indigo-600 text-white border-none' : 'text-slate-400 hover:text-indigo-400'
            }`}
          >
            <LogIn className="w-5 h-5" />
            <span>Masuk Admin</span>
          </button>
        )}
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 p-6 md:p-10 flex flex-col gap-8 max-w-7xl w-full mx-auto overflow-x-hidden">
        {/* HEADER STATS BAR */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-gray-900/60">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white capitalize">{activeTab} Panel</h1>
            <p className="text-xs text-slate-400 mt-1">Selamat datang di Panel Enterprise UT Bot Academic Assistant.</p>
          </div>

          <div className="flex items-center gap-3 bg-gray-900/50 border border-gray-800/80 px-4 py-2.5 rounded-2xl">
            <div className={`w-2.5 h-2.5 rounded-full ${botConnected ? 'bg-emerald-500 shadow-md shadow-emerald-500/20' : 'bg-red-500'}`} />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              {botConnected ? 'Connected JID' : 'Disconnected / QR Pending'}
            </span>
          </div>
        </div>

        {sysMsg && (
          <div className="bg-indigo-950/40 border border-indigo-900/60 p-4 rounded-xl text-xs font-semibold text-indigo-300 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            <span>{sysMsg}</span>
          </div>
        )}

        {/* TAB 1: DASHBOARD METRICS */}
        {activeTab === 'dashboard' && (
          <div className="flex flex-col gap-8">
            {/* CARDS GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-6 flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-500/10 text-indigo-500 rounded-xl flex items-center justify-center">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-semibold tracking-wide uppercase">Server Load (CPU)</p>
                  <h3 className="text-xl font-bold mt-1 text-white">{metrics.cpu ? metrics.cpu.toFixed(1) : 0}%</h3>
                </div>
              </div>

              <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-6 flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center">
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-semibold tracking-wide uppercase">Memory Bot Usage</p>
                  <h3 className="text-xl font-bold mt-1 text-white">{metrics.memory || 0} MB</h3>
                </div>
              </div>

              <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-6 flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-semibold tracking-wide uppercase">Grup Whitelisted</p>
                  <h3 className="text-xl font-bold mt-1 text-white">{groups.length} Grup</h3>
                </div>
              </div>

              <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-6 flex items-center gap-4">
                <div className="w-12 h-12 bg-sky-500/10 text-sky-500 rounded-xl flex items-center justify-center">
                  <RefreshCw className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-semibold tracking-wide uppercase">System Uptime</p>
                  <h3 className="text-xl font-bold mt-1 text-white">{formatUptime(metrics.uptime)}</h3>
                </div>
              </div>
            </div>

            {/* SECONDARY ROW: LOGIN QR CODE / STATUS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* QR CODE CARD */}
              <div className="bg-gray-900/40 border border-gray-800 rounded-3xl p-8 flex flex-col items-center justify-center gap-6 min-h-[350px]">
                {botConnected ? (
                  <div className="text-center flex flex-col items-center gap-4">
                    <div className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-12 h-12" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">Bot Terhubung & Aktif</h2>
                      <p className="text-sm text-slate-400 mt-2">Nomor Terdaftar: <strong>{botUser || 'Owner'}</strong></p>
                    </div>
                  </div>
                ) : qrCode ? (
                  <div className="text-center flex flex-col items-center gap-4">
                    <h2 className="text-lg font-bold text-white">Tautkan Perangkat Anda</h2>
                    <p className="text-xs text-slate-400 max-w-xs">Scan QR code di bawah menggunakan aplikasi WhatsApp Anda (Perangkat Tertaut) untuk menghubungkan bot.</p>
                    <div className="bg-white p-3 rounded-2xl mt-2">
                      <img src={qrCode} alt="WhatsApp QR Code" className="w-48 h-48" />
                    </div>
                  </div>
                ) : (
                  <div className="text-center flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <h2 className="text-base font-bold text-white">Memuat Sesi WhatsApp...</h2>
                    <p className="text-xs text-slate-400 max-w-xs">Sedang mempersiapkan driver browser Chromium di background.</p>
                  </div>
                )}
              </div>

              {/* LOGS PREVIEW */}
              <div className="bg-gray-900/40 border border-gray-800 rounded-3xl p-6 flex flex-col min-h-[350px]">
                <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-gray-800/80 pb-3.5 mb-4">
                  <Terminal className="w-4 h-4 text-indigo-500" />
                  <span>Log Aktivitas Terbaru</span>
                </h3>
                <div className="flex-1 bg-gray-950/70 border border-gray-800/80 rounded-2xl p-4 font-mono text-[11px] text-slate-300 overflow-y-auto max-h-[250px] flex flex-col gap-2">
                  {logs.slice(-15).map((log, idx) => (
                    <div key={idx} className="leading-relaxed">
                      <span className="text-slate-500">[{log.timestamp ? log.timestamp.split(' ')[1] || log.timestamp : 'System'}]</span>{' '}
                      <span className="text-indigo-400">[{log.category}]</span>{' '}
                      <span className="text-slate-200">{log.message}</span>
                    </div>
                  ))}
                  <div ref={logEndRef} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: GROUPS MODERATION */}
        {activeTab === 'groups' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* GROUP LIST */}
            <div className="lg:col-span-1 flex flex-col gap-4">
              <h3 className="text-sm font-bold text-white">Daftar Grup</h3>

              {/* Form Tambah Whitelist Grup */}
              <form onSubmit={handleCreateGroup} className="flex flex-col gap-3.5 p-4 bg-gray-950/40 border border-gray-800 rounded-2xl">
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">Daftarkan Grup Baru</span>
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    placeholder="ID JID Grup (contoh: 120363xxx@g.us)"
                    value={newGroupJid}
                    onChange={(e) => setNewGroupJid(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg text-xs text-white placeholder-gray-600 focus:outline-none"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Nama Grup (Opsional - Otomatis dari WA)"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg text-xs text-white placeholder-gray-600 focus:outline-none"
                  />
                </div>
                <button type="submit" className="w-full py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-500 cursor-pointer transition">
                  Tambah ke Whitelist
                </button>
              </form>

              <div className="flex flex-col gap-3 overflow-y-auto max-h-[500px]">
                {groups.filter(g => g.status).length === 0 ? (
                  <div className="p-6 bg-gray-900/20 border border-gray-800/60 rounded-2xl text-center text-xs text-slate-500">
                    Tidak ada grup WhatsApp yang aktif dipantau.
                  </div>
                ) : (
                  groups.filter(g => g.status).map((group) => (
                    <button
                      key={group.id}
                      onClick={() => setSelectedGroup(group)}
                      className={`p-4 rounded-2xl text-left border flex items-center justify-between transition cursor-pointer ${
                        selectedGroup?.id === group.id 
                          ? 'bg-indigo-600/10 border-indigo-500' 
                          : 'bg-gray-900/40 border-gray-800 hover:border-gray-700'
                      }`}
                    >
                      <div>
                        <h4 className="text-xs font-bold text-white">{group.name}</h4>
                        <p className="text-[10px] text-slate-400 mt-1">{group.id.split('@')[0]}</p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${group.settings?.antiLink ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-800 text-slate-400'}`}>
                        {group.settings?.antiLink ? 'Secure' : 'Unsecured'}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* GROUP SETTINGS DETAILS */}
            <div className="lg:col-span-2">
              {selectedGroup ? (
                <div key={selectedGroup.id} className="bg-gray-900/40 border border-gray-800 rounded-3xl p-8 flex flex-col gap-6">
                  <div className="flex justify-between items-start border-b border-gray-800 pb-4">
                    <div>
                      {isEditingGroupName ? (
                        <form onSubmit={handleRenameGroup} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editingGroupNameText}
                            onChange={(e) => setEditingGroupNameText(e.target.value)}
                            className="px-3 py-1.5 bg-gray-950 border border-gray-800 rounded-xl text-sm text-white font-bold focus:outline-none"
                            required
                          />
                          <button type="submit" className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl cursor-pointer">
                            Simpan
                          </button>
                          <button type="button" onClick={() => setIsEditingGroupName(false)} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer">
                            Batal
                          </button>
                        </form>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-lg font-bold text-white">{selectedGroup.name}</h2>
                          <button
                            onClick={() => {
                              setIsEditingGroupName(true);
                              setEditingGroupNameText(selectedGroup.name);
                            }}
                            title="Ubah Nama Manual"
                            className="text-slate-500 hover:text-white p-1 rounded transition cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                const res = await fetchWithAuth(`/api/groups/${encodeURIComponent(selectedGroup.id)}/sync-name`, { method: 'POST' });
                                if (res.name) {
                                  setSelectedGroup(prev => prev ? { ...prev, name: res.name } : null);
                                  loadGroupsData();
                                  setSysMsg(`Nama grup berhasil disinkronkan: "${res.name}"`);
                                  setTimeout(() => setSysMsg(''), 3000);
                                }
                              } catch (err: any) {
                                alert(err.message || 'Gagal mengambil nama dari WhatsApp');
                              }
                            }}
                            title="Segarkan Nama Asli dari WhatsApp"
                            className="px-2 py-1 bg-indigo-950/40 border border-indigo-800/60 hover:bg-indigo-900/40 text-indigo-300 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition cursor-pointer"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Ambil Nama WA</span>
                          </button>
                        </div>
                      )}
                      <p className="text-xs text-slate-400 mt-1">ID Grup: <code>{selectedGroup.id}</code></p>
                    </div>
                    <button
                      onClick={() => handleDeleteGroup(selectedGroup.id)}
                      className="px-3 py-1.5 bg-red-950/20 hover:bg-red-900/30 text-red-400 hover:text-red-300 text-xs font-bold rounded-xl border border-red-900/30 transition cursor-pointer"
                    >
                      Hapus Whitelist
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Welcome settings */}
                    <div className="p-4 bg-gray-950/40 border border-gray-800 rounded-2xl flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-white block">Welcome Message</span>
                          <span className="text-[10px] text-slate-500 block mt-0.5">Kirim pesan sambutan saat member baru bergabung</span>
                        </div>
                        <button
                          onClick={() => handleSaveGroupSettings(selectedGroup.id, {
                            welcomeEnabled: !selectedGroup.settings?.welcomeEnabled
                          })}
                          className="text-slate-400 hover:text-white transition cursor-pointer"
                        >
                          {selectedGroup.settings?.welcomeEnabled ? (
                            <ToggleRight className="w-8 h-8 text-emerald-500" />
                          ) : (
                            <ToggleLeft className="w-8 h-8" />
                          )}
                        </button>
                      </div>

                      {selectedGroup.settings?.welcomeEnabled && (
                        <>
                          {/* Welcome Sticker Toggle */}
                          <div className="pt-2 border-t border-gray-900 flex items-center justify-between">
                            <div>
                              <span className="text-xs font-bold text-slate-300 block">Kirim Stiker Sambutan</span>
                              <span className="text-[10px] text-slate-500 block mt-0.5">Kirim stiker animasi welcome setelah pesan teks</span>
                            </div>
                            <button
                              onClick={() => handleSaveGroupSettings(selectedGroup.id, {
                                welcomeStickerEnabled: selectedGroup.settings?.welcomeStickerEnabled === false ? true : false
                              })}
                              className="text-slate-400 hover:text-white transition cursor-pointer"
                            >
                              {selectedGroup.settings?.welcomeStickerEnabled !== false ? (
                                <ToggleRight className="w-7 h-7 text-emerald-500" />
                              ) : (
                                <ToggleLeft className="w-7 h-7" />
                              )}
                            </button>
                          </div>

                          {/* Welcome Textarea */}
                          <div className="flex flex-col gap-2 pt-2 border-t border-gray-900">
                            <label className="text-[10px] font-bold text-slate-400">Pesan Teks Sambutan</label>
                            <textarea
                              id={`welcome-msg-${selectedGroup.id}`}
                              defaultValue={selectedGroup.settings?.welcomeMessage || "Selamat datang (user) di *(group)*\nSelamat berdiskusi"}
                              placeholder="Selamat datang (user) di *(group)*"
                              className="w-full p-3 bg-gray-900/60 border border-gray-800 rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                              rows={3}
                            />
                            <button
                              onClick={async () => {
                                const textarea = document.getElementById(`welcome-msg-${selectedGroup.id}`) as HTMLTextAreaElement;
                                if (textarea) {
                                  await handleSaveGroupSettings(selectedGroup.id, {
                                    welcomeMessage: textarea.value
                                  });
                                  setSysMsg('Pesan Sambutan berhasil disimpan!');
                                  setTimeout(() => setSysMsg(''), 3000);
                                }
                              }}
                              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow"
                            >
                              <span>Simpan Pengaturan Welcome</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    {/* AI settings */}
                    <div className="p-4 bg-gray-950/40 border border-gray-800 rounded-2xl flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-white block">AI RAG Response</span>
                        <span className="text-[10px] text-slate-500 block mt-1">Izinkan AI merespon jika ditag</span>
                      </div>
                      <button
                        onClick={() => handleSaveGroupSettings(selectedGroup.id, {
                          aiEnabled: !selectedGroup.settings?.aiEnabled
                        })}
                        className="text-slate-400 hover:text-white transition cursor-pointer"
                      >
                        {selectedGroup.settings?.aiEnabled ? (
                          <ToggleRight className="w-8 h-8 text-emerald-500" />
                        ) : (
                          <ToggleLeft className="w-8 h-8" />
                        )}
                      </button>
                    </div>

                    {/* Anti-Link */}
                    <div className="p-4 bg-gray-950/40 border border-gray-800 rounded-2xl flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-white block">Anti-Link Filter</span>
                        <span className="text-[10px] text-slate-500 block mt-1">Hapus pesan jika berisi link</span>
                      </div>
                      <button
                        onClick={() => handleSaveGroupSettings(selectedGroup.id, {
                          antiLink: !selectedGroup.settings?.antiLink
                        })}
                        className="text-slate-400 hover:text-white transition cursor-pointer"
                      >
                        {selectedGroup.settings?.antiLink ? (
                          <ToggleRight className="w-8 h-8 text-emerald-500" />
                        ) : (
                          <ToggleLeft className="w-8 h-8" />
                        )}
                      </button>
                    </div>

                    {/* Anti-Toxic */}
                    <div className="p-4 bg-gray-950/40 border border-gray-800 rounded-2xl flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-white block">Anti-Toxic / Bad Words</span>
                        <span className="text-[10px] text-slate-500 block mt-1">Hapus pesan berkata kasar/kotor</span>
                      </div>
                      <button
                        onClick={() => handleSaveGroupSettings(selectedGroup.id, {
                          antiToxic: !selectedGroup.settings?.antiToxic,
                          antiBadWord: !selectedGroup.settings?.antiBadWord
                        })}
                        className="text-slate-400 hover:text-white transition cursor-pointer"
                      >
                        {selectedGroup.settings?.antiToxic ? (
                          <ToggleRight className="w-8 h-8 text-emerald-500" />
                        ) : (
                          <ToggleLeft className="w-8 h-8" />
                        )}
                      </button>
                    </div>

                    {/* Anti-Virtex */}
                    <div className="p-4 bg-gray-950/40 border border-gray-800 rounded-2xl flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-white block">Anti-Virtex</span>
                        <span className="text-[10px] text-slate-500 block mt-1">Keluarkan pengirim spam crash</span>
                      </div>
                      <button
                        onClick={() => handleSaveGroupSettings(selectedGroup.id, {
                          antiVirtex: !selectedGroup.settings?.antiVirtex
                        })}
                        className="text-slate-400 hover:text-white transition cursor-pointer"
                      >
                        {selectedGroup.settings?.antiVirtex ? (
                          <ToggleRight className="w-8 h-8 text-emerald-500" />
                        ) : (
                          <ToggleLeft className="w-8 h-8" />
                        )}
                      </button>
                    </div>

                    {/* Anti-Fake-Number */}
                    <div className="p-4 bg-gray-950/40 border border-gray-800 rounded-2xl flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-white block">Anti-Fake-Number</span>
                        <span className="text-[10px] text-slate-500 block mt-1">Keluarkan nomor luar negeri non-62</span>
                      </div>
                      <button
                        onClick={() => handleSaveGroupSettings(selectedGroup.id, {
                          antiFakeNumber: !selectedGroup.settings?.antiFakeNumber
                        })}
                        className="text-slate-400 hover:text-white transition cursor-pointer"
                      >
                        {selectedGroup.settings?.antiFakeNumber ? (
                          <ToggleRight className="w-8 h-8 text-emerald-500" />
                        ) : (
                          <ToggleLeft className="w-8 h-8" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-900/20 border border-gray-800/80 rounded-3xl p-8 flex flex-col items-center justify-center text-center min-h-[400px]">
                  <ShieldAlert className="w-12 h-12 text-indigo-500/40 mb-3" />
                  <h3 className="text-sm font-bold text-white">Tidak Ada Grup Terpilih</h3>
                  <p className="text-xs text-slate-500 max-w-xs mt-1">Silakan pilih grup dari daftar sebelah kiri untuk memodifikasi pengaturan moderasi keamanan.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: AUTO REPLY */}
        {activeTab === 'auto-reply' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* CRUD FORM */}
            <div className="lg:col-span-1 bg-gray-900/40 border border-gray-800 rounded-3xl p-6 flex flex-col gap-6">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3">
                <PlusCircle className="w-5 h-5 text-indigo-500" />
                <span>Tambah Auto Reply</span>
              </h3>

              <form onSubmit={handleAddAutoReply} className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2">Kata Kunci (Keyword)</label>
                  <input
                    type="text"
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    placeholder="misal: pendaftaran"
                    className="w-full px-4 py-3 bg-gray-950/60 border border-gray-800 rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2">Jawaban Otomatis (Response)</label>
                  <textarea
                    value={newResponse}
                    onChange={(e) => setNewResponse(e.target.value)}
                    placeholder="Tulis respon bot..."
                    className="w-full p-4 bg-gray-950/60 border border-gray-800 rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                    rows={6}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="py-3.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold rounded-xl text-xs shadow-md transition cursor-pointer"
                >
                  Simpan Aturan
                </button>
              </form>
            </div>

            {/* LIST */}
            <div className="lg:col-span-2 flex flex-col gap-4">
              <h3 className="text-sm font-bold text-white">Daftar Keyword & Respon</h3>
              <div className="flex flex-col gap-4 max-h-[500px] overflow-y-auto">
                {autoReplies.length === 0 ? (
                  <div className="p-8 bg-gray-900/20 border border-gray-800/60 rounded-3xl text-center text-xs text-slate-500">
                    Belum ada aturan auto reply yang dibuat.
                  </div>
                ) : (
                  autoReplies.map((reply) => (
                    <div key={reply.id} className="p-5 bg-gray-900/40 border border-gray-800 rounded-2xl flex justify-between items-start gap-4">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-500 px-2 py-0.5 rounded-md">
                          Keyword: {reply.keyword}
                        </span>
                        <p className="text-xs text-slate-300 mt-3 leading-relaxed whitespace-pre-line">{reply.response}</p>
                      </div>

                      <button
                        onClick={() => handleDeleteAutoReply(reply.id)}
                        className="text-slate-500 hover:text-red-500 transition p-1.5 hover:bg-red-950/20 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: BROADCAST */}
        {activeTab === 'broadcast' && (
          <div className="max-w-2xl bg-gray-900/40 border border-gray-800 rounded-3xl p-8 flex flex-col gap-6">
            <h2 className="text-lg font-bold text-white">Kirim Pesan Masal (Broadcast)</h2>
            <p className="text-xs text-slate-400">Gunakan fitur ini untuk mengirimkan pengumuman masal ke seluruh kelas atau grup tutorial akademik yang terhubung.</p>

            <form onSubmit={handleSendBroadcast} className="flex flex-col gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2">Target Pengiriman</label>
                <select
                  value={broadcastTarget}
                  onChange={(e) => setBroadcastTarget(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-950/60 border border-gray-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="all_groups">Kirim Ke Semua Grup Whitelist</option>
                  <option value="all_admins">Kirim Ke Semua Admin (Private Chat)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2">Pesan Siaran</label>
                <textarea
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder="Tulis isi pengumuman broadcast..."
                  className="w-full p-4 bg-gray-950/60 border border-gray-800 rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                  rows={8}
                  required
                />
              </div>

              {broadcastStatus && (
                <div className={`p-4 rounded-xl text-xs font-semibold ${
                  broadcastStatus.includes('Error') || broadcastStatus.includes('Failed')
                    ? 'bg-red-950/30 border border-red-900/60 text-red-400' 
                    : 'bg-indigo-950/30 border border-indigo-900/60 text-indigo-400'
                }`}>
                  {broadcastStatus}
                </div>
              )}

              <button
                type="submit"
                className="py-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold rounded-xl text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Kirim Siaran Sekarang</span>
              </button>
            </form>
          </div>
        )}

        {/* TAB 5: REALTIME LOGS */}
        {activeTab === 'logs' && (
          <div className="bg-gray-900/40 border border-gray-800 rounded-3xl p-6 flex flex-col flex-1 min-h-[500px]">
            <div className="border-b border-gray-800 pb-4 mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Live System Terminal Log</h2>
                <p className="text-xs text-slate-400 mt-1">Memantau lalu lintas chat, query RAG, and audit keamanan secara realtime.</p>
              </div>
              <button
                onClick={() => setLogs([])}
                className="px-3 py-1.5 border border-gray-800 hover:bg-gray-800 text-slate-400 hover:text-white rounded-lg text-[10px] font-bold transition cursor-pointer"
              >
                Bersihkan Layar
              </button>
            </div>

            <div className="flex-1 bg-gray-950/70 border border-gray-800 rounded-2xl p-6 font-mono text-[11px] text-slate-300 overflow-y-auto max-h-[400px] flex flex-col gap-2.5">
              {logs.map((log, idx) => (
                <div key={idx} className="leading-relaxed">
                  <span className="text-slate-500">[{log.timestamp || new Date().toLocaleTimeString()}]</span>{' '}
                  <span className="text-indigo-400">[{log.category}]</span>{' '}
                  <span className="text-slate-200">{log.message}</span>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        )}

        {/* TAB 6: SYSTEM SETTINGS */}
        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-gray-900/40 border border-gray-800 rounded-3xl p-8 flex flex-col gap-6">
              <h2 className="text-lg font-bold text-white">Pengaturan Global & Parameter AI</h2>
              <p className="text-xs text-slate-400">Konfigurasi token API kecerdasan buatan, parameter RAG, nomor pemilik bot, dan setelan teknis lainnya.</p>

              <form onSubmit={handleSaveSettings} className="flex flex-col gap-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2">Prefix Perintah Bot</label>
                    <input
                      type="text"
                      value={prefix}
                      onChange={(e) => setPrefix(e.target.value)}
                      placeholder="Default: !"
                      className="w-full px-4 py-3 bg-gray-950/60 border border-gray-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                      maxLength={5}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2">Jeda Cooldown (Milidetik)</label>
                    <input
                      type="number"
                      value={cooldownMs}
                      onChange={(e) => setCooldownMs(parseInt(e.target.value) || 3000)}
                      placeholder="3000"
                      className="w-full px-4 py-3 bg-gray-950/60 border border-gray-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2">OpenAI / Gemini / Groq API Key</label>
                  <input
                    type="text"
                    value={openaiApiKey}
                    onChange={(e) => setOpenaiApiKey(e.target.value)}
                    placeholder="Masukkan Kunci API Anda (sk-..., AIzaSy..., AQ...., gsk_...)"
                    className="w-full px-4 py-3 bg-gray-950/60 border border-gray-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2">Nomor WhatsApp Owner (Pemilik Bot)</label>
                  <input
                    type="text"
                    value={ownerNumber}
                    onChange={(e) => setOwnerNumber(e.target.value)}
                    placeholder="Format: 62895..."
                    className="w-full px-4 py-3 bg-gray-950/60 border border-gray-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                <div className="border-t border-gray-850 my-2 pt-4">
                  <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-4">Pengaturan Mesin AI (RAG)</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2">Model AI Aktif</label>
                    <select
                      value={aiModel}
                      onChange={(e) => setAiModel(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-950/60 border border-gray-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="gemini-1.5-flash">gemini-1.5-flash (Gemini)</option>
                      <option value="gemini-1.5-pro">gemini-1.5-pro (Gemini Pro)</option>
                      <option value="gpt-4o-mini">gpt-4o-mini (OpenAI)</option>
                      <option value="llama3-8b-8192">llama3-8b-8192 (Groq Llama)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2">Temperatur AI (Kreativitas)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.0"
                      max="1.0"
                      value={aiTemperature}
                      onChange={(e) => setAiTemperature(parseFloat(e.target.value) || 0.3)}
                      className="w-full px-4 py-3 bg-gray-950/60 border border-gray-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2">Max Tokens Respon</label>
                    <input
                      type="number"
                      value={aiMaxTokens}
                      onChange={(e) => setAiMaxTokens(parseInt(e.target.value) || 800)}
                      className="w-full px-4 py-3 bg-gray-950/60 border border-gray-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2">AI System Prompt (Instruksi Perilaku Bot)</label>
                  <textarea
                    value={aiSystemPrompt}
                    onChange={(e) => setAiSystemPrompt(e.target.value)}
                    placeholder="Tuliskan instruksi sistem prompt untuk mengatur kepribadian respons AI bot..."
                    className="w-full p-4 bg-gray-950/60 border border-gray-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                    rows={6}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2">Daftar Kata Kasar/Sensitif (Bad Words)</label>
                  <textarea
                    value={badWords}
                    onChange={(e) => setBadWords(e.target.value)}
                    placeholder="Masukkan kata-kata kasar dipisahkan dengan koma (contoh: anjing, babi, bodoh)..."
                    className="w-full p-4 bg-gray-950/60 border border-gray-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                    rows={3}
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">Pisahkan setiap kata dengan tanda koma tanpa spasi tambahan. Filter Anti-Toxic/Bad-Word akan memeriksa kata-kata ini secara otomatis.</span>
                </div>

                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="py-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-xl text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSavingSettings ? 'Menyimpan...' : 'Simpan Pengaturan'}
                </button>
              </form>
            </div>

            {/* MAINTENANCE SECTION */}
            <div className="bg-gray-900/40 border border-gray-800 rounded-3xl p-6 flex flex-col gap-6 self-start">
              <div>
                <h2 className="text-base font-bold text-white">Tindakan Pemeliharaan</h2>
                <p className="text-xs text-slate-400 mt-1">Kelola status siklus hidup aplikasi backend secara langsung.</p>
              </div>

              <div className="flex flex-col gap-4">
                <button
                  onClick={handleRestartBot}
                  className="w-full py-4 border border-indigo-900/60 hover:bg-indigo-950/30 text-indigo-400 hover:text-indigo-300 font-bold rounded-xl text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4 animate-spin-slow" />
                  <span>Restart Bot Core (PM2)</span>
                </button>

                <button
                  onClick={handleClearLogs}
                  className="w-full py-4 border border-red-900/60 hover:bg-red-950/30 text-red-400 hover:text-red-300 font-bold rounded-xl text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Hapus File Log Sistem</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: COMMANDS LIST */}
        {activeTab === 'commands' && (
          <div className="bg-gray-900/40 border border-gray-800 rounded-3xl p-8 flex flex-col gap-6">
            <div>
              <h2 className="text-lg font-bold text-white">Katalog Perintah Bot (Commands Catalog)</h2>
              <p className="text-xs text-slate-400 mt-1">Daftar lengkap perintah bot WhatsApp yang tersedia beserta tingkat hak akses minimalnya.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[600px] overflow-y-auto pr-2">
              <div className="bg-gray-950/40 border border-gray-800/80 rounded-2xl p-5 flex flex-col gap-3">
                <span className="text-[10px] font-bold tracking-widest text-indigo-400 uppercase">👤 PERINTAH MEMBER / UMUM</span>
                <div className="text-xs text-slate-300 space-y-2.5">
                  <p><strong>.menu / .help</strong>: Menampilkan bantuan navigasi menu bot.</p>
                  <p><strong>.infout</strong>: Pusat informasi akademik UT Batam.</p>
                  <p><strong>.panduan</strong>: Peta jalan akademik dari Semester 1 - 8.</p>
                  <p><strong>.prodi / .jurusan</strong>: Daftar fakultas dan jurusan di UT Batam.</p>
                  <p><strong>.syarat / .berkas</strong>: Dokumen syarat masuk mahasiswa baru.</p>
                  <p><strong>.biaya / .spp</strong>: Rincian biaya paket semester (SIPAS vs Non-SIPAS).</p>
                  <p><strong>.ujian / .uas</strong>: Rincian 3 sistem ujian akhir semester UT.</p>
                  <p><strong>.kalender</strong>: Penanda batas waktu administrasi & akademik.</p>
                  <p><strong>.salut / .pokjar</strong>: Daftar Sentra Layanan UT di Kepulauan Riau.</p>
                  <p><strong>.kontak</strong>: WhatsApp helpdesk UT Batam & Pusat.</p>
                  <p><strong>.nilai / .lkam</strong>: Panduan cek indeks prestasi semester.</p>
                  <p><strong>.pustaka</strong>: Layanan bebas perpustakaan digital UT.</p>
                  <p><strong>.ping</strong>: Tes kecepatan latensi server bot.</p>
                  <p><strong>.rules</strong>: Aturan umum tata tertib mahasiswa grup.</p>
                  <p><strong>.fight [p1] [p2]</strong>: Memulai game RPG PvP interaktif antara 2 pemain.</p>
                  <p><strong>.fight leaderboard</strong>: Melihat papan peringkat juara pertarungan.</p>
                  <p><strong>.status</strong>: Status server dan konektivitas perangkat WhatsApp.</p>
                </div>
              </div>

              <div className="bg-gray-950/40 border border-gray-800/80 rounded-2xl p-5 flex flex-col gap-4">
                <div>
                  <span className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase">🛡️ MODERATOR & ADMIN GRUP</span>
                  <div className="text-xs text-slate-300 space-y-2 mt-2">
                    <p><strong>.warn @user</strong>: Memberi teguran peringatan ke member grup.</p>
                    <p><strong>.warnings @user</strong>: Memeriksa riwayat teguran member grup.</p>
                    <p><strong>.clearwarn @user</strong>: Menghapus catatan teguran member grup.</p>
                    <p><strong>.kick @user</strong>: Mengeluarkan member bermasalah dari grup.</p>
                    <p><strong>.add 628xxx</strong>: Memasukkan nomor kontak langsung ke grup.</p>
                    <p><strong>.promote @user</strong>: Mentag dan menaikkan peran member menjadi admin.</p>
                    <p><strong>.demote @user</strong>: Menurunkan jabatan admin grup menjadi member.</p>
                    <p><strong>.mute / .unmute</strong>: Membuka/menutup izin chat grup (hanya admin).</p>
                    <p><strong>.addgroup</strong>: Mengaktifkan/whitelist fitur bot di grup saat ini.</p>
                    <p><strong>.delgroup</strong>: Menyuruh bot keluar/menonaktifkan dari grup saat ini.</p>
                  </div>
                </div>
                
                <div className="border-t border-gray-850 pt-4">
                  <span className="text-[10px] font-bold tracking-widest text-amber-400 uppercase">👑 SUPER ADMIN</span>
                  <div className="text-xs text-slate-300 space-y-2 mt-2">
                    <p><strong>.lock / .unlock</strong>: Mengunci/membuka izin perubahan info/subjek grup.</p>
                    <p><strong>.tagall [pesan]</strong>: Mentag seluruh anggota grup sekaligus.</p>
                    <p><strong>.hidetag [pesan]</strong>: Mengirim pesan tag tersembunyi ke semua anggota.</p>
                  </div>
                </div>

                <div className="border-t border-gray-850 pt-4">
                  <span className="text-[10px] font-bold tracking-widest text-red-500 uppercase">🔴 OWNER ONLY (PEMILIK BOT)</span>
                  <div className="text-xs text-slate-300 space-y-2 mt-2">
                    <p><strong>.restart</strong>: Mematikan bot (PM2 akan restart otomatis dalam 2 detik).</p>
                    <p><strong>.backup</strong>: Melakukan backup database SQLite dan berkas settings.</p>
                    <p><strong>.addadmin @user [role]</strong>: Menambahkan admin global baru via WA.</p>
                    <p><strong>.deladmin @user</strong>: Menghapus hak akses admin global seseorang.</p>
                    <p><strong>.listadmin</strong>: Menampilkan seluruh admin global.</p>
                    <p><strong>.block @user [alasan]</strong>: Mem-blacklist nomor dari bot/AI.</p>
                    <p><strong>.unblock @user</strong>: Menghapus nomor dari blacklist.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 8: ACCESS & BLOKIR */}
        {activeTab === 'rbac' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* GLOBAL ADMINS SECTION */}
            <div className="bg-gray-900/40 border border-gray-800 rounded-3xl p-6 flex flex-col gap-6">
              <div>
                <h2 className="text-base font-bold text-white">Kelola Admin Global</h2>
                <p className="text-xs text-slate-400 mt-1">Daftar pengguna dengan otoritas global (SuperAdmin, Admin, Moderator) untuk memoderasi bot di seluruh grup.</p>
              </div>

              <form onSubmit={handleAddAdmin} className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-gray-950/40 p-4 border border-gray-800/60 rounded-2xl">
                <div className="sm:col-span-2 flex flex-col gap-2">
                  <input
                    type="text"
                    placeholder="Nomor WA (contoh: 628xxx)"
                    value={newAdminJid}
                    onChange={(e) => setNewAdminJid(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg text-xs text-white placeholder-gray-600 focus:outline-none"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Nama Admin (Opsional)"
                    value={newAdminName}
                    onChange={(e) => setNewAdminName(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg text-xs text-white placeholder-gray-600 focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <select
                    value={newAdminRole}
                    onChange={(e) => setNewAdminRole(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-850 rounded-lg text-xs text-white focus:outline-none"
                  >
                    <option value="SuperAdmin">SuperAdmin</option>
                    <option value="Admin">Admin</option>
                    <option value="Moderator">Moderator</option>
                    <option value="Admin,Moderator">Admin & Moderator</option>
                    <option value="SuperAdmin,Admin,Moderator">Semua (SuperAdmin, Admin, Mod)</option>
                  </select>
                  <button type="submit" className="w-full py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-500 cursor-pointer">
                    Tambah Admin
                  </button>
                </div>
              </form>

              <div className="flex-1 max-h-[400px] overflow-y-auto pr-1">
                {adminsList.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">Belum ada admin global terdaftar.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {adminsList.map(adm => (
                      <div key={adm.whatsappId} className="flex justify-between items-center bg-gray-950/20 border border-gray-900 px-4 py-3 rounded-xl">
                        <div>
                          <p className="text-xs font-bold text-white">{adm.name || adm.whatsappId.split('@')[0]}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">{adm.whatsappId.split('@')[0]}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                            adm.role === 'SuperAdmin' ? 'bg-amber-500/10 text-amber-500' : (adm.role === 'Moderator' ? 'bg-blue-500/10 text-blue-500' : 'bg-emerald-500/10 text-emerald-500')
                          }`}>{adm.role}</span>
                          <button onClick={() => handleDeleteAdmin(adm.whatsappId)} className="text-slate-500 hover:text-red-500 p-1 rounded-md transition cursor-pointer">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* BLACKLIST USER SECTION */}
            <div className="bg-gray-900/40 border border-gray-800 rounded-3xl p-6 flex flex-col gap-6">
              <div>
                <h2 className="text-base font-bold text-white">Daftar Hitam Pengguna (Blacklist)</h2>
                <p className="text-xs text-slate-400 mt-1">Blokir pengguna bermasalah/spammer agar tidak bisa memicu AI atau memberikan perintah apa pun ke bot.</p>
              </div>

              <form onSubmit={handleAddBlacklist} className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-gray-950/40 p-4 border border-gray-800/60 rounded-2xl">
                <div className="sm:col-span-2 flex flex-col gap-2">
                  <input
                    type="text"
                    placeholder="Nomor WA (contoh: 628xxx)"
                    value={newBlacklistJid}
                    onChange={(e) => setNewBlacklistJid(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg text-xs text-white placeholder-gray-600 focus:outline-none"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Alasan Pemblokiran"
                    value={newBlacklistReason}
                    onChange={(e) => setNewBlacklistReason(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg text-xs text-white placeholder-gray-600 focus:outline-none"
                  />
                </div>
                <div className="flex items-end justify-end">
                  <button type="submit" className="w-full py-3 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-500 cursor-pointer">
                    Blokir Nomor
                  </button>
                </div>
              </form>

              <div className="flex-1 max-h-[400px] overflow-y-auto pr-1">
                {blacklistList.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">Belum ada pengguna diblokir.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {blacklistList.map(bl => (
                      <div key={bl.whatsappId} className="flex justify-between items-center bg-gray-950/20 border border-gray-900 px-4 py-3 rounded-xl">
                        <div>
                          <p className="text-xs font-bold text-white">@{bl.whatsappId.split('@')[0]}</p>
                          <p className="text-[10px] text-red-400 mt-1 font-semibold">Alasan: {bl.reason}</p>
                        </div>
                        <button onClick={() => handleDeleteBlacklist(bl.whatsappId)} className="text-slate-500 hover:text-emerald-500 p-1.5 hover:bg-emerald-950/20 rounded-lg transition cursor-pointer">
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB: REGISTERED USERS MANAGEMENT */}
        {activeTab === 'registered-users' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* ADD/EDIT USER FORM */}
            <div className="bg-gray-900/40 border border-gray-800 rounded-3xl p-6 flex flex-col gap-6 lg:col-span-1">
              <div>
                <h2 className="text-base font-bold text-white">
                  {editingRegId ? 'Edit Mahasiswa' : 'Tambah Mahasiswa'}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {editingRegId 
                    ? 'Ubah informasi mahasiswa yang terdaftar di database.' 
                    : 'Daftarkan mahasiswa baru secara manual ke database.'}
                </p>
              </div>

              <form onSubmit={handleAddOrUpdateRegisteredUser} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Nomor WA</label>
                  <input
                    type="text"
                    placeholder="Contoh: 628xxx"
                    value={newRegJid}
                    onChange={(e) => setNewRegJid(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Nama Lengkap</label>
                  <input
                    type="text"
                    placeholder="Contoh: Budi"
                    value={newRegName}
                    onChange={(e) => setNewRegName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">UPBJJ</label>
                  <input
                    type="text"
                    placeholder="Contoh: Jakarta"
                    value={newRegUpbjj}
                    onChange={(e) => setNewRegUpbjj(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                <div className="flex gap-2 mt-2">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center justify-center cursor-pointer"
                  >
                    {editingRegId ? 'Update Data' : 'Tambah Mahasiswa'}
                  </button>
                  {editingRegId && (
                    <button
                      type="button"
                      onClick={handleCancelRegEdit}
                      className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      Batal
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* REGISTERED USERS LIST */}
            <div className="bg-gray-900/40 border border-gray-800 rounded-3xl p-6 flex flex-col gap-6 lg:col-span-2">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-base font-bold text-white">Daftar Mahasiswa Terdaftar</h2>
                  <p className="text-xs text-slate-400 mt-1">Daftar seluruh mahasiswa yang sudah teregistrasi untuk dapat berinteraksi dengan bot.</p>
                </div>
                <span className="text-[10px] font-bold bg-indigo-500/10 text-indigo-400 px-3 py-1.5 rounded-full">
                  Total: {registeredUsersList.length}
                </span>
              </div>

              <div className="flex-1 max-h-[600px] overflow-y-auto pr-1">
                {registeredUsersList.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-12">Belum ada mahasiswa terdaftar di database.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {registeredUsersList.map(user => (
                      <div key={user.id} className="flex flex-col justify-between bg-gray-950/20 border border-gray-900/80 p-4 rounded-2xl gap-3">
                        <div className="flex flex-col gap-1">
                          <div className="flex justify-between items-start">
                            <h3 className="text-xs font-bold text-white">{user.name}</h3>
                            <span className="text-[9px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md font-semibold">
                              {user.upbjj}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">@{user.whatsappId.split('@')[0]}</p>
                          <p className="text-[9px] text-slate-600 mt-1">
                            Terdaftar: {new Date(user.createdAt).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                        <div className="flex justify-end gap-2 border-t border-gray-900/40 pt-3">
                          <button
                            onClick={() => handleEditRegisteredUserClick(user)}
                            className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-white px-2.5 py-1.5 hover:bg-gray-800 rounded-lg transition cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteRegisteredUser(user.id)}
                            className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-red-500 px-2.5 py-1.5 hover:bg-red-950/20 rounded-lg transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Hapus</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 9: LOGIN (for non-authenticated users wanting to log in) */}
        {activeTab === 'login' && (
          <div className="max-w-md mx-auto bg-gray-900/40 border border-gray-800 rounded-3xl p-8 flex flex-col gap-6 w-full">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-indigo-500/20 mb-4">
                UT
              </div>
              <h2 className="text-xl font-bold text-white">Login Administrator</h2>
              <p className="text-xs text-slate-400 mt-1">Masuk untuk mengelola grup, auto reply, dan pengaturan bot.</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              {authError && (
                <div className="p-4 bg-red-950/40 border border-red-900/60 rounded-xl text-red-400 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Username</label>
                <div className="relative">
                  <User className="absolute left-4 top-3 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin"
                    className="w-full pl-11 pr-4 py-2.5 bg-gray-950/60 border border-gray-800 rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-3 w-4 h-4 text-gray-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-11 pr-4 py-2.5 bg-gray-950/60 border border-gray-800 rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold rounded-xl text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                <LogIn className="w-4 h-4" />
                <span>Masuk Ke Panel</span>
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
