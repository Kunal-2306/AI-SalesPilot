import { useEffect, useState } from 'react';
import {
  User,
  Brain,
  Building2,
  Mic,
  Activity,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Skeleton } from '../components/Skeleton';

export default function SettingsPage() {
  const { refreshUser } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);

  const [profile, setProfile] = useState({ name: '', email: '', companyName: '' });
  const [aiSettings, setAiSettings] = useState({
    groqApiKey: '',
    geminiApiKey: '',
    hasGroqKey: false,
    hasGeminiKey: false,
    groqBaseUrl: 'https://api.groq.com/openai/v1',
    model: 'openai/gpt-oss-120b',
    sttModel: 'whisper-large-v3-turbo',
    geminiTtsModel: 'gemini-2.5-flash-preview-tts',
    temperature: 0.4,
    systemPrompt: '',
  });
  const [businessSettings, setBusinessSettings] = useState({
    companyName: '',
    industry: '',
    tagline: '',
    description: '',
    website: '',
    products: [],
  });
  const [voiceSettings, setVoiceSettings] = useState({
    sttProvider: 'groq',
    ttsProvider: 'browser',
    ttsVoice: 'Kore',
    language: 'auto',
    speechRate: 1.0,
    autoListen: true,
  });

  useEffect(() => {
    const load = async () => {
      try {
        const [settingsRes, statusRes] = await Promise.all([
          api.get('/settings'),
          api.post('/settings/test-connection'),
        ]);
        setProfile(settingsRes.data.profile);
        setAiSettings((prev) => ({
          ...prev,
          ...settingsRes.data.aiSettings,
          groqApiKey: '',
          geminiApiKey: '',
        }));
        setBusinessSettings(settingsRes.data.businessSettings);
        setVoiceSettings(settingsRes.data.voiceSettings);
        setConnectionStatus(statusRes.data);
      } catch (err) {
        toast(err.response?.data?.message || 'Failed to load settings', 'error');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [toast]);

  const testConnection = async () => {
    try {
      const { data } = await api.post('/settings/test-connection');
      setConnectionStatus(data);
      toast('Connection status refreshed', 'info');
    } catch (err) {
      toast(err.response?.data?.message || 'Connection test failed', 'error');
    }
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/auth/profile', profile);
      await refreshUser();
      toast('Profile updated', 'success');
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveAi = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.put('/settings/ai', aiSettings);
      setAiSettings((prev) => ({
        ...prev,
        hasGroqKey: data.hasGroqKey,
        hasGeminiKey: data.hasGeminiKey,
        groqApiKey: '',
        geminiApiKey: '',
      }));
      await refreshUser();
      await testConnection();
      toast('Free AI configuration saved', 'success');
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to save AI config', 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveBusiness = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/settings/business', businessSettings);
      toast('Business & product configuration saved', 'success');
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to save business settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveVoice = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/settings/voice', voiceSettings);
      await refreshUser();
      toast('Voice configuration saved', 'success');
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to save voice settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const addProduct = () => {
    setBusinessSettings((prev) => ({
      ...prev,
      products: [
        ...(prev.products || []),
        { name: 'New Plan', price: '$99/mo', billingCycle: 'monthly', description: '', features: [] },
      ],
    }));
  };

  const removeProduct = (index) => {
    setBusinessSettings((prev) => ({
      ...prev,
      products: prev.products.filter((_, i) => i !== index),
    }));
  };

  if (loading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Connection Status */}
      <div className="pro-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4.5 w-4.5 text-indigo-600" />
            <h2 className="text-[15px] font-bold">API &amp; Infrastructure Health</h2>
          </div>
          <button onClick={testConnection} className="pro-btn-secondary py-1.5 text-xs">
            Re-test Connections
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-[#131824] p-4">
            <div className="flex items-center gap-2 font-bold mb-1">
              {connectionStatus?.database?.connected ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-rose-500" />
              )}
              MongoDB Persistence
            </div>
            <p className="text-slate-500">
              {connectionStatus?.database?.connected
                ? `Connected (${connectionStatus.database.name})`
                : 'Disconnected'}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-[#131824] p-4">
            <div className="flex items-center gap-2 font-bold mb-1">
              {connectionStatus?.ai?.connected ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              )}
              Groq AI ({connectionStatus?.ai?.mode})
            </div>
            <p className="text-slate-500">{connectionStatus?.ai?.message}</p>
          </div>

          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-[#131824] p-4">
            <div className="flex items-center gap-2 font-bold mb-1">
              <CheckCircle2 className="h-4 w-4 text-indigo-500" />
              Local RAG Index ({connectionStatus?.rag?.provider || 'local-tfidf'})
            </div>
            <p className="text-slate-500">
              {connectionStatus?.rag?.indexedDocuments ?? 0} indexed documents ready
            </p>
          </div>
        </div>
      </div>

      {/* Profile Settings */}
      <form onSubmit={saveProfile} className="pro-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <User className="h-4.5 w-4.5 text-indigo-600" />
          <h2 className="text-[15px] font-bold">Profile Settings</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <input
            value={profile.name}
            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            placeholder="Your Name"
            className="pro-input"
          />
          <input disabled value={profile.email} className="pro-input opacity-60 cursor-not-allowed" />
          <input
            value={profile.companyName}
            onChange={(e) => setProfile({ ...profile, companyName: e.target.value })}
            placeholder="Workspace Company"
            className="pro-input"
          />
        </div>
        <button type="submit" disabled={saving} className="pro-btn-primary py-2 text-xs">
          <Save className="h-3.5 w-3.5" /> Save Profile
        </button>
      </form>

      {/* Free AI Configuration */}
      <form onSubmit={saveAi} className="pro-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Brain className="h-4.5 w-4.5 text-indigo-600" />
          <h2 className="text-[15px] font-bold">Free AI Services Configuration (Groq &amp; Gemini TTS)</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="pro-label">
              Groq API Key {aiSettings.hasGroqKey ? '(Configured)' : '(Required for Groq STT & LLM)'}
            </label>
            <input
              type="password"
              value={aiSettings.groqApiKey}
              onChange={(e) => setAiSettings({ ...aiSettings, groqApiKey: e.target.value })}
              placeholder={aiSettings.hasGroqKey ? 'Enter new key to replace existing' : 'gsk_...'}
              className="pro-input"
            />
          </div>
          <div>
            <label className="pro-label">Groq Base URL</label>
            <input
              value={aiSettings.groqBaseUrl}
              onChange={(e) => setAiSettings({ ...aiSettings, groqBaseUrl: e.target.value })}
              className="pro-input"
            />
          </div>
          <div>
            <label className="pro-label">Groq Free-Tier Chat Model</label>
            <select
              value={aiSettings.model}
              onChange={(e) => setAiSettings({ ...aiSettings, model: e.target.value })}
              className="pro-input"
            >
              <option value="openai/gpt-oss-120b">openai/gpt-oss-120b (Recommended Free Tier)</option>
              <option value="openai/gpt-oss-20b">openai/gpt-oss-20b (Ultra Fast)</option>
              <option value="qwen/qwen3.8-27b">qwen/qwen3.8-27b</option>
            </select>
          </div>
          <div>
            <label className="pro-label">Groq Whisper STT Model</label>
            <input
              value={aiSettings.sttModel}
              onChange={(e) => setAiSettings({ ...aiSettings, sttModel: e.target.value })}
              className="pro-input"
            />
          </div>
          <div>
            <label className="pro-label">
              Google Gemini API Key {aiSettings.hasGeminiKey ? '(Configured)' : '(Optional — Only for Gemini TTS)'}
            </label>
            <input
              type="password"
              value={aiSettings.geminiApiKey}
              onChange={(e) => setAiSettings({ ...aiSettings, geminiApiKey: e.target.value })}
              placeholder={aiSettings.hasGeminiKey ? 'Enter new key to replace existing' : 'AIza...'}
              className="pro-input"
            />
          </div>
          <div>
            <label className="pro-label">Gemini TTS Model</label>
            <input
              value={aiSettings.geminiTtsModel}
              onChange={(e) => setAiSettings({ ...aiSettings, geminiTtsModel: e.target.value })}
              className="pro-input"
            />
          </div>
          <div>
            <label className="pro-label">Temperature ({aiSettings.temperature})</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="1.5"
              value={aiSettings.temperature}
              onChange={(e) => setAiSettings({ ...aiSettings, temperature: Number(e.target.value) })}
              className="pro-input"
            />
          </div>
        </div>
        <div>
          <label className="pro-label">Sales Agent System Prompt</label>
          <textarea
            rows={3}
            value={aiSettings.systemPrompt}
            onChange={(e) => setAiSettings({ ...aiSettings, systemPrompt: e.target.value })}
            className="pro-input"
          />
        </div>
        <button type="submit" disabled={saving} className="pro-btn-primary py-2 text-xs">
          <Save className="h-3.5 w-3.5" /> Save AI Configuration
        </button>
      </form>

      {/* Business & Product Catalog */}
      <form onSubmit={saveBusiness} className="pro-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-4.5 w-4.5 text-indigo-600" />
            <h2 className="text-[15px] font-bold">Business &amp; Product Catalog</h2>
          </div>
          <button type="button" onClick={addProduct} className="pro-btn-secondary py-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" /> Add Product
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <input
            value={businessSettings.companyName || ''}
            onChange={(e) => setBusinessSettings({ ...businessSettings, companyName: e.target.value })}
            placeholder="Company Name"
            className="pro-input"
          />
          <input
            value={businessSettings.industry || ''}
            onChange={(e) => setBusinessSettings({ ...businessSettings, industry: e.target.value })}
            placeholder="Industry"
            className="pro-input"
          />
        </div>
        <input
          value={businessSettings.tagline || ''}
          onChange={(e) => setBusinessSettings({ ...businessSettings, tagline: e.target.value })}
          placeholder="Elevator Pitch / Tagline"
          className="pro-input"
        />

        <div className="space-y-3">
          {(businessSettings.products || []).map((prod, idx) => (
            <div
              key={idx}
              className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-[#131824] p-3"
            >
              <input
                value={prod.name}
                onChange={(e) => {
                  const next = [...businessSettings.products];
                  next[idx] = { ...next[idx], name: e.target.value };
                  setBusinessSettings({ ...businessSettings, products: next });
                }}
                placeholder="Product Name"
                className="pro-input sm:col-span-3 py-1.5"
              />
              <input
                value={prod.price}
                onChange={(e) => {
                  const next = [...businessSettings.products];
                  next[idx] = { ...next[idx], price: e.target.value };
                  setBusinessSettings({ ...businessSettings, products: next });
                }}
                placeholder="Price"
                className="pro-input sm:col-span-2 py-1.5"
              />
              <input
                value={prod.description}
                onChange={(e) => {
                  const next = [...businessSettings.products];
                  next[idx] = { ...next[idx], description: e.target.value };
                  setBusinessSettings({ ...businessSettings, products: next });
                }}
                placeholder="Description"
                className="pro-input sm:col-span-6 py-1.5"
              />
              <button
                type="button"
                onClick={() => removeProduct(idx)}
                className="sm:col-span-1 text-rose-500 hover:text-rose-600 justify-self-end p-1 cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <button type="submit" disabled={saving} className="pro-btn-primary py-2 text-xs">
          <Save className="h-3.5 w-3.5" /> Save Business &amp; Products
        </button>
      </form>

      {/* Voice Configuration */}
      <form onSubmit={saveVoice} className="pro-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Mic className="h-4.5 w-4.5 text-indigo-600" />
          <h2 className="text-[15px] font-bold">Voice &amp; Language Configuration</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="pro-label">STT Provider</label>
            <select
              value={voiceSettings.sttProvider}
              onChange={(e) => setVoiceSettings({ ...voiceSettings, sttProvider: e.target.value })}
              className="pro-input"
            >
              <option value="groq">Groq Whisper (whisper-large-v3-turbo)</option>
              <option value="webspeech">Browser Web Speech API</option>
            </select>
          </div>
          <div>
            <label className="pro-label">TTS Provider</label>
            <select
              value={voiceSettings.ttsProvider}
              onChange={(e) => setVoiceSettings({ ...voiceSettings, ttsProvider: e.target.value })}
              className="pro-input"
            >
              <option value="browser">Browser SpeechSynthesis (Zero-Cost)</option>
              <option value="gemini">Google Gemini TTS (Free Tier)</option>
            </select>
          </div>
          <div>
            <label className="pro-label">Language</label>
            <select
              value={voiceSettings.language || 'auto'}
              onChange={(e) => setVoiceSettings({ ...voiceSettings, language: e.target.value })}
              className="pro-input"
            >
              <option value="auto">Auto (English &amp; Hindi)</option>
              <option value="en">English</option>
              <option value="hi">Hindi (हिन्दी)</option>
            </select>
          </div>
          <div>
            <label className="pro-label">Gemini Voice / Rate</label>
            <div className="flex gap-2">
              <select
                value={voiceSettings.ttsVoice}
                onChange={(e) => setVoiceSettings({ ...voiceSettings, ttsVoice: e.target.value })}
                className="pro-input"
              >
                {['Kore', 'Puck', 'Aoede', 'Charon', 'Fenrir'].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="0.1"
                min="0.7"
                max="1.4"
                value={voiceSettings.speechRate}
                onChange={(e) => setVoiceSettings({ ...voiceSettings, speechRate: Number(e.target.value) })}
                className="pro-input w-20"
              />
            </div>
          </div>
        </div>
        <button type="submit" disabled={saving} className="pro-btn-primary py-2 text-xs">
          <Save className="h-3.5 w-3.5" /> Save Voice Configuration
        </button>
      </form>
    </div>
  );
}
