import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Production Fallback Credentials (ensures app works on Vercel without manual env configuration)
export const FALLBACK_SUPABASE_URL = "https://epsplspwdjjjjezxscer.supabase.co";
export const FALLBACK_SUPABASE_ANON_KEY = "sb_publishable_X8IsGDLwK9fUliHih60dlg_vqyOiePl";

// Get credentials from Vite environment variables, localStorage, or fallback
export function getSupabaseCredentials(): { url: string; anonKey: string } {
  let envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  let envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

  // If env contains unconfigured placeholders from templates, discard them
  if (envUrl.includes('your-project-id') || !envUrl.startsWith('https://')) {
    envUrl = '';
  }
  if (envKey.includes('your-anon-public-key') || envKey.length < 20) {
    envKey = '';
  }
  
  let localUrl = (typeof window !== 'undefined' ? localStorage.getItem('studybull_supabase_url') || '' : '').trim();
  let localKey = (typeof window !== 'undefined' ? localStorage.getItem('studybull_supabase_key') || '' : '').trim();
  if (localUrl.includes('your-project-id') || !localUrl.startsWith('https://')) localUrl = '';
  if (localKey.includes('your-anon-public-key') || localKey.length < 20) localKey = '';

  let url = envUrl || localUrl || FALLBACK_SUPABASE_URL;
  let anonKey = envKey || localKey || FALLBACK_SUPABASE_ANON_KEY;

  // Clean and normalize URL (Supabase client requires base URL without /rest/v1/)
  if (url) {
    url = url.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
  }

  return { url, anonKey };
}

export function saveSupabaseCredentials(url: string, anonKey: string) {
  if (typeof window !== 'undefined') {
    if (url) localStorage.setItem('studybull_supabase_url', url.trim());
    else localStorage.removeItem('studybull_supabase_url');

    if (anonKey) localStorage.setItem('studybull_supabase_key', anonKey.trim());
    else localStorage.removeItem('studybull_supabase_key');
  }
  _clientInstance = null; // Reset singleton on credential change
}

// Check if credentials look valid (non-empty and not sample placeholders)
export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getSupabaseCredentials();
  return Boolean(
    url &&
    anonKey &&
    url.startsWith('https://') &&
    !url.includes('your-project-id') &&
    !anonKey.includes('your-anon-public-key')
  );
}

// Singleton client instance to prevent multiple client creations and connection churn
let _clientInstance: SupabaseClient | null = null;

// Create client helper
export function getSupabaseClient(): SupabaseClient | null {
  if (_clientInstance) return _clientInstance;

  const { url, anonKey } = getSupabaseCredentials();
  if (!url || !anonKey || !url.startsWith('https://')) {
    return null;
  }
  try {
    _clientInstance = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
    return _clientInstance;
  } catch (err) {
    console.warn('Failed to initialize Supabase client:', err);
    return null;
  }
}

// Export default supabase instance
export const supabase = getSupabaseClient();

export interface StudyBullNode {
  id: string;
  title: string;
  titleEn?: string;
  kind: 'button' | 'folder' | 'section' | 'mcq' | 'mock' | 'notes' | 'html' | 'tool' | 'calc' | 'typing';
  icon: string;
  subtitle: string;
  subtitleEn?: string;
  enabled: boolean;
  children: any[];
  questions?: any[];
  content?: string;
  htmlContent?: string;
  html?: string;
  code?: string;
  rawHtml?: string;
  view?: string;
  target_view?: string;
  url?: string;
  isLeaf?: boolean;
  allowChildren?: boolean;
  canAddChildren?: boolean;
  isContainer?: boolean;
}

// Full default Study Bull library matching schema (empty by default as requested; all temporary buttons added from admin)
export const DEFAULT_STUDYBULL_NODES: StudyBullNode[] = [];

// Helper: Determine if a node should be visible
// Never drop buttons that have undefined enabled or status
export function isNodeActive(n: any): boolean {
  if (!n) return false;
  if (n.enabled === false || n.enabled === 'false' || n.enabled === 0) return false;
  if (n.status === 'draft' || n.status === 'disabled' || n.status === 'hidden') return false;
  return true;
}

// Helper: Migration/sync function to keep Supabase in sync without forcing dummy nodes
export async function syncExistingContentToSupabase(): Promise<{ nodes: any[]; success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { nodes: [], success: false, error: 'No client' };
  }

  try {
    const { data: current, error: fetchErr } = await client
      .from('studybull_app_state')
      .select('nodes, settings')
      .eq('id', 'main')
      .maybeSingle();

    if (fetchErr) {
      console.warn('Fetch error during sync:', fetchErr.message);
    }

    const existingNodes: any[] = Array.isArray(current?.nodes) ? current.nodes : [];
    return { nodes: existingNodes, success: true };
  } catch (err: any) {
    console.error('syncExistingContentToSupabase exception:', err);
    return { nodes: [], success: false, error: err?.message };
  }
}

// Normalize all item fields according to Study Bull node schema
export function normalizeNode(n: any): StudyBullNode {
  const isCalcNode = String(n.id || '').startsWith('calc') || 
    String(n.kind || '').toLowerCase() === 'calc' || 
    String(n.view || '').toLowerCase() === 'calc_setup' || 
    String(n.target_view || '').toLowerCase() === 'calc_setup' ||
    String(n.title || '').toLowerCase().includes('calc') ||
    String(n.title || '').includes('कैलकुलेशन');

  const isTypingNode = String(n.id || '').startsWith('typing') || 
    String(n.kind || '').toLowerCase() === 'typing' || 
    String(n.view || '').toLowerCase() === 'typing_setup' || 
    String(n.target_view || '').toLowerCase() === 'typing_setup' ||
    String(n.title || '').toLowerCase().includes('typing') ||
    String(n.title || '').includes('टाइपिंग');

  const isTool = isCalcNode || isTypingNode;
  const rawKind = String(n.kind || '').toLowerCase();

  const resolvedHtml = n.htmlContent || n.html || n.code || n.rawHtml || 
    (typeof n.content === 'string' && (
      n.content.includes('<') || 
      n.content.includes('<!DOCTYPE') || 
      n.content.includes('<div') || 
      n.content.includes('<script') ||
      n.content.includes('<style') ||
      n.content.includes('function') ||
      n.content.includes('fetch(') ||
      n.content.includes('axios') ||
      n.content.includes('document.') ||
      n.content.includes('window.') ||
      n.content.includes('localStorage') ||
      n.content.includes('addEventListener')
    ) ? n.content : undefined);

  const isHtmlNode = Boolean(
    rawKind === 'html' || 
    String(n.view || '').toLowerCase() === 'custom_node' ||
    String(n.target_view || '').toLowerCase() === 'custom_node' ||
    resolvedHtml
  );

  let resolvedKind: any = 'button';
  if (isCalcNode) resolvedKind = 'calc';
  else if (isTypingNode) resolvedKind = 'typing';
  else if (isHtmlNode) resolvedKind = 'html';
  else if (['button', 'folder', 'section', 'mcq', 'mock', 'notes', 'html', 'tool'].includes(rawKind)) {
    resolvedKind = rawKind;
  }

  // Filter out accidental JavaScript/HTML code snippets improperly saved into questions
  const cleanQuestions = (Array.isArray(n.questions) ? n.questions : []).filter((q: any) => {
    const t = String(q?.question || q?.qText || q?.title || '');
    return t && !t.includes('document.') && !t.includes('var ') && !t.includes('STORE_KEY') && !t.includes('moodmoji') && !t.includes('BATCH=') && !t.includes('elementById') && !t.includes('onclick=');
  });

  return {
    ...n,
    id: String(n.id || `node-${Date.now()}`),
    title: String(n.title || n.name || 'Untitled'),
    titleEn: n.titleEn || n.title_en || undefined,
    kind: resolvedKind,
    icon: String(n.icon || (isCalcNode ? '⚡' : isTypingNode ? '⌨️' : isHtmlNode ? '🌐' : '📌')),
    subtitle: String(n.subtitle || n.sub || n.subtitleEn || ''),
    subtitleEn: n.subtitleEn || n.subtitle_en || undefined,
    enabled: isNodeActive(n),
    children: isTool ? [] : (Array.isArray(n.children) ? n.children.map(normalizeNode) : []),
    passages: Array.isArray(n.passages) ? n.passages : (n.passages ? [n.passages] : undefined),
    questions: isHtmlNode ? [] : cleanQuestions,
    isLeaf: isTool ? true : (n.isLeaf !== undefined ? Boolean(n.isLeaf) : undefined),
    allowChildren: isTool ? false : (n.allowChildren !== undefined ? Boolean(n.allowChildren) : undefined),
    canAddChildren: isTool ? false : (n.canAddChildren !== undefined ? Boolean(n.canAddChildren) : undefined),
    isContainer: isTool ? false : (n.isContainer !== undefined ? Boolean(n.isContainer) : undefined),
    htmlContent: resolvedHtml,
    html: resolvedHtml,
    code: resolvedHtml,
    ...(n.content ? { content: n.content } : {}),
    view: n.view || (isCalcNode ? 'calc_setup' : isTypingNode ? 'typing_setup' : isHtmlNode ? 'custom_node' : undefined),
    target_view: n.target_view || n.view || (isCalcNode ? 'calc_setup' : isTypingNode ? 'typing_setup' : isHtmlNode ? 'custom_node' : undefined),
    ...(n.url ? { url: n.url } : {})
  };
}

// 1. शुरुआती डेटा (Buttons, Folders, Quizzes, Settings) लोड करने के लिए:
// Dual strategy: Direct native fetch (100% resilient on Vercel) + Supabase JS Client fallback
export async function loadStudyBullApp(): Promise<{ nodes: any[]; settings: any; raw?: any; error?: string }> {
  const { url, anonKey } = getSupabaseCredentials();
  if (!url || !anonKey) {
    return {
      nodes: getCachedNodes(),
      settings: getCachedSettings(),
      error: 'Supabase credentials not configured',
    };
  }

  // Strategy A: Ultra-fast native HTTPS fetch (bypasses all client SDK packaging/websocket issues on Vercel)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const endpoint = `${url}/rest/v1/studybull_app_state?select=nodes,settings,updated_at&order=updated_at.desc&limit=1`;
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (response.ok) {
      const rows = await response.json();
      const latestRow = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
      if (latestRow) {
        const rawNodes = Array.isArray(latestRow.nodes) ? latestRow.nodes : [];
        const publishedNodes = rawNodes.filter(isNodeActive).map(normalizeNode);

        try {
          localStorage.setItem('studybull_user_cache', JSON.stringify(publishedNodes));
          localStorage.setItem('studybull_cached_nodes', JSON.stringify(publishedNodes));
          if (latestRow.settings) {
            localStorage.setItem('studybull_cached_settings', JSON.stringify(latestRow.settings));
          }
        } catch {}

        return {
          nodes: publishedNodes,
          settings: latestRow.settings || {},
          raw: latestRow,
        };
      }
    }
  } catch (nativeErr) {
    console.warn('Native fetch fallback to Supabase SDK:', nativeErr);
  }

  // Strategy B: Supabase JS Client
  const client = getSupabaseClient();
  if (!client) {
    return {
      nodes: getCachedNodes(),
      settings: getCachedSettings(),
      error: 'Supabase client unavailable',
    };
  }

  try {
    // Check latest row first (supports any custom ID or updated row)
    const { data: rows, error: rowsErr } = await client
      .from('studybull_app_state')
      .select('nodes, settings, updated_at')
      .order('updated_at', { ascending: false })
      .limit(1);

    let row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;

    if (!row || rowsErr) {
      // Fallback by ID 'main'
      const { data: mainData, error: mainErr } = await client
        .from('studybull_app_state')
        .select('nodes, settings, updated_at')
        .eq('id', 'main')
        .maybeSingle();

      if (mainErr) {
        console.warn('Supabase loadStudyBullApp query error:', mainErr.message);
        return {
          nodes: getCachedNodes(),
          settings: getCachedSettings(),
          error: mainErr.message,
        };
      }
      row = mainData;
    }

    if (row) {
      const rawNodes = Array.isArray(row.nodes) ? row.nodes : [];
      const publishedNodes = rawNodes.filter(isNodeActive).map(normalizeNode);

      try {
        localStorage.setItem('studybull_user_cache', JSON.stringify(publishedNodes));
        localStorage.setItem('studybull_cached_nodes', JSON.stringify(publishedNodes));
        if (row.settings) {
          localStorage.setItem('studybull_cached_settings', JSON.stringify(row.settings));
        }
      } catch {}

      return {
        nodes: publishedNodes,
        settings: row.settings || {},
        raw: row,
      };
    }

    return {
      nodes: getCachedNodes(),
      settings: getCachedSettings(),
    };
  } catch (err: any) {
    console.error('Supabase loadStudyBullApp error:', err);
    return {
      nodes: getCachedNodes(),
      settings: getCachedSettings(),
      error: err?.message || 'Network / connection error',
    };
  }
}

// Helpers for localStorage fallback
function getCachedNodes(): any[] {
  try {
    const cached = localStorage.getItem('studybull_user_cache') || localStorage.getItem('studybull_cached_nodes');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function getCachedSettings(): any {
  try {
    const cached = localStorage.getItem('studybull_cached_settings');
    if (cached) return JSON.parse(cached);
  } catch {}
  return {};
}

// 2. Admin में बदलाव होते ही User App में तुरंत लाइव अपडेट करने के लिए:
export function subscribeToAdminUpdates(onUpdate: (data: { nodes: any[]; settings: any }) => void) {
  const client = getSupabaseClient();
  if (!client) return () => {};

  try {
    const channel = client
      .channel('user-app-live-sync')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'studybull_app_state',
        },
        (payload: any) => {
          const row = payload.new as any;
          if (row) {
            const rawNodes = Array.isArray(row.nodes) ? row.nodes : [];
            const published = rawNodes.filter(isNodeActive).map(normalizeNode);

            // Update localStorage cache simultaneously
            try {
              localStorage.setItem('studybull_user_cache', JSON.stringify(published));
              localStorage.setItem('studybull_cached_nodes', JSON.stringify(published));
              if (row.settings) {
                localStorage.setItem('studybull_cached_settings', JSON.stringify(row.settings));
              }
            } catch {}

            onUpdate({
              nodes: published,
              settings: row.settings || {},
            });
          }
        }
      )
      .subscribe();

    return () => {
      try {
        client.removeChannel(channel);
      } catch {}
    };
  } catch (err) {
    console.warn('Failed to subscribe to realtime updates:', err);
    return () => {};
  }
}

// 3. लाइव डेटाबेस कनेक्शन टेस्ट और डायग्नोस्टिक्स:
export interface ConnectionTestResult {
  status: 'connected' | 'missing_keys' | 'table_missing' | 'auth_error' | 'error';
  message: string;
  latencyMs?: number;
  details?: any;
  credentialsSet: boolean;
  urlPreview?: string;
}

export async function checkSupabaseConnection(): Promise<ConnectionTestResult> {
  const { url, anonKey } = getSupabaseCredentials();

  if (!url || !anonKey || !url.startsWith('https://') || url.includes('your-project-id')) {
    return {
      status: 'missing_keys',
      message: 'Supabase URL या Anon Key अभी कॉन्फ़िगर नहीं की गई है। कृपया .env में डालें या नीचे दर्ज करें।',
      credentialsSet: false,
    };
  }

  const client = getSupabaseClient();
  if (!client) {
    return {
      status: 'error',
      message: 'Supabase Client शुरू नहीं हो सका। अमान्य URL या की (Key)।',
      credentialsSet: true,
      urlPreview: url.substring(0, 30) + '...',
    };
  }

  const startTime = Date.now();
  try {
    // Attempt to query the studybull_app_state table
    const { data, error, status } = await client
      .from('studybull_app_state')
      .select('id, updated_at')
      .eq('id', 'main')
      .maybeSingle();

    const latencyMs = Date.now() - startTime;

    if (error) {
      // Check if table does not exist
      if (error.code === '42P01' || error.message?.toLowerCase().includes('relation') || error.message?.toLowerCase().includes('does not exist')) {
        return {
          status: 'table_missing',
          message: 'Supabase कनेक्टेड है, लेकिन "studybull_app_state" टेबल नहीं मिली। नीचे दिए गए SQL को अपने Supabase SQL Editor में रन करें।',
          latencyMs,
          details: error,
          credentialsSet: true,
          urlPreview: url.substring(0, 30) + '...',
        };
      }

      if (status === 401 || status === 403 || error.message?.toLowerCase().includes('jwt') || error.message?.toLowerCase().includes('apikey')) {
        return {
          status: 'auth_error',
          message: 'प्रमाणीकरण विफल (401/403): Anon Key अमान्य है या RLS पॉलिसी में अनुमति नहीं है।',
          latencyMs,
          details: error,
          credentialsSet: true,
          urlPreview: url.substring(0, 30) + '...',
        };
      }

      return {
        status: 'error',
        message: `डेटाबेस त्रुटि: ${error.message} (Code: ${error.code || status})`,
        latencyMs,
        details: error,
        credentialsSet: true,
        urlPreview: url.substring(0, 30) + '...',
      };
    }

    return {
      status: 'connected',
      message: '✅ डेटाबेस सफलतापूर्वक कनेक्टेड है! "studybull_app_state" लाइव डेटा और रियलटाइम सिंक सक्रिय है।',
      latencyMs,
      details: data,
      credentialsSet: true,
      urlPreview: url.substring(0, 30) + '...',
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    return {
      status: 'error',
      message: `कनेक्शन विफलता: ${err?.message || 'सर्वर से कनेक्ट नहीं हो सका'}`,
      latencyMs,
      details: err,
      credentialsSet: true,
      urlPreview: url.substring(0, 30) + '...',
    };
  }
}

// User attempt tracking
export async function recordUserAttempt(type: 'quiz' | 'mock' | 'calc' | 'typing', payload: Record<string, any>) {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('user_attempts')
      .insert([{ type, data: payload, created_at: new Date().toISOString() }]);
    if (error) {
      console.warn('Supabase record attempt error:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('Supabase error:', err);
    return null;
  }
}

// 4. App Snippets / Button Previews Realtime Sync (Admin Code Editor to User App Preview)
export async function upsertAppSnippet(buttonId: string, htmlContent: string): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    // Fallback to localStorage if Supabase client not initialized
    try {
      localStorage.setItem(`snippet_${buttonId}`, htmlContent);
      localStorage.setItem(`snippet_updated_${buttonId}`, new Date().toISOString());
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'LocalStorage save error' };
    }
  }

  try {
    const { error } = await client
      .from('app_snippets')
      .upsert(
        {
          button_id: buttonId,
          html_content: htmlContent,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'button_id' }
      );

    if (error) {
      console.warn('Supabase upsertAppSnippet error:', error.message);
      // Fallback to local storage
      localStorage.setItem(`snippet_${buttonId}`, htmlContent);
      return { success: false, error: error.message };
    }

    try {
      localStorage.setItem(`snippet_${buttonId}`, htmlContent);
    } catch {}

    return { success: true };
  } catch (err: any) {
    console.error('upsertAppSnippet exception:', err);
    return { success: false, error: err?.message || 'Network error' };
  }
}

export async function fetchAppSnippet(buttonId: string): Promise<string | null> {
  // Check local cache first for instant load
  try {
    const local = localStorage.getItem(`snippet_${buttonId}`);
    if (local !== null) {
      // return local immediately, but also fetch fresh from server
    }
  } catch {}

  const client = getSupabaseClient();
  if (!client) {
    try {
      return localStorage.getItem(`snippet_${buttonId}`) || null;
    } catch {
      return null;
    }
  }

  try {
    const { data, error } = await client
      .from('app_snippets')
      .select('html_content')
      .eq('button_id', buttonId)
      .maybeSingle();

    if (error || !data) {
      return localStorage.getItem(`snippet_${buttonId}`) || null;
    }

    try {
      localStorage.setItem(`snippet_${buttonId}`, data.html_content);
    } catch {}

    return data.html_content;
  } catch (err) {
    console.warn('fetchAppSnippet error:', err);
    return localStorage.getItem(`snippet_${buttonId}`) || null;
  }
}

export function subscribeToSnippetUpdates(buttonId: string, onUpdate: (htmlContent: string) => void) {
  const client = getSupabaseClient();
  if (!client) return () => {};

  try {
    const channelName = `snippet-realtime-${buttonId}-${Math.random().toString(36).substring(2, 7)}`;
    const channel = client
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_snippets',
          filter: `button_id=eq.${buttonId}`,
        },
        (payload: any) => {
          const newRow = payload.new as any;
          if (newRow && typeof newRow.html_content === 'string') {
            try {
              localStorage.setItem(`snippet_${buttonId}`, newRow.html_content);
            } catch {}
            onUpdate(newRow.html_content);
          }
        }
      )
      .subscribe();

    return () => {
      try {
        client.removeChannel(channel);
      } catch {}
    };
  } catch (err) {
    console.warn('Failed to subscribe to snippet updates:', err);
    return () => {};
  }
}
