import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Get credentials from either Vite environment variables or localStorage (for easy setup)
export function getSupabaseCredentials(): { url: string; anonKey: string } {
  let envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  let envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
  
  let localUrl = (typeof window !== 'undefined' ? localStorage.getItem('studybull_supabase_url') || '' : '').trim();
  let localKey = (typeof window !== 'undefined' ? localStorage.getItem('studybull_supabase_key') || '' : '').trim();

  let url = envUrl || localUrl;
  let anonKey = envKey || localKey;

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

// Create client helper
export function getSupabaseClient(): SupabaseClient | null {
  const { url, anonKey } = getSupabaseCredentials();
  if (!url || !anonKey || !url.startsWith('https://')) {
    return null;
  }
  try {
    return createClient(url, anonKey, {
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

// Full default Study Bull library matching schema
export const DEFAULT_STUDYBULL_NODES: StudyBullNode[] = [
  {
    id: 'button-1791810077282',
    icon: '⚡',
    kind: 'button',
    title: 'नया Button Page',
    enabled: true,
    children: [],
    subtitle: 'Separate Page Container',
    questions: []
  },
  {
    id: 'quiz',
    title: 'क्विज अभ्यास',
    titleEn: 'Quiz Practice',
    kind: 'mcq',
    icon: '⚡',
    subtitle: 'विषयवार MCQs प्रश्न',
    subtitleEn: 'Subject-wise MCQs',
    enabled: true,
    view: 'quiz_categories',
    children: [
      {
        id: 'quiz-polity',
        title: 'भारतीय राजव्यवस्था',
        kind: 'mcq',
        icon: '⚖️',
        subtitle: 'संविधान, अनुच्छेद, मौलिक अधिकार',
        enabled: true,
        children: [],
        questions: [
          {
            id: 1,
            question: 'भारतीय संविधान सभा की प्रथम बैठक कब आयोजित की गई थी?',
            questionEn: 'When was the first meeting of the Indian Constituent Assembly held?',
            options: ['9 दिसंबर 1946', '11 दिसंबर 1946', '26 जनवरी 1950', '15 अगस्त 1947'],
            optionsEn: ['9 December 1946', '11 December 1946', '26 January 1950', '15 August 1947'],
            correct: 0,
            explanation: 'संविधान सभा की प्रथम बैठक 9 दिसंबर 1946 को काउंसिल चैंबर, नई दिल्ली में हुई थी, जिसके अस्थायी अध्यक्ष डॉ. सच्चिदानंद सिन्हा थे।'
          },
          {
            id: 2,
            question: 'प्रस्तावना में "धर्मनिरपेक्ष", "समाजवादी" और "अखंडता" शब्द किस संशोधन द्वारा जोड़े गए?',
            options: ['42वां संशोधन (1976)', '44वां संशोधन (1978)', '86वां संशोधन (2002)', '103वां संशोधन (2019)'],
            correct: 0,
            explanation: '42वें संविधान संशोधन अधिनियम (1976) जिसे "लघु संविधान" भी कहा जाता है, द्वारा प्रस्तावना में ये शब्द जोड़े गए।'
          }
        ]
      },
      {
        id: 'quiz-history',
        title: 'भारतीय इतिहास',
        kind: 'mcq',
        icon: '🏛️',
        subtitle: 'प्राचीन, मध्यकालीन एवं आधुनिक भारत',
        enabled: true,
        children: [],
        questions: [
          {
            id: 1,
            question: 'हड़प्पा सभ्यता की खोज किस वर्ष और किसने की थी?',
            options: ['1921 में दयाराम साहनी', '1922 में राखालदास बनर्जी', '1924 में जॉन मार्शल', '1928 में कनिंघम'],
            correct: 0,
            explanation: 'रायबहादुर दयाराम साहनी ने 1921 में रावी नदी के तट पर स्थित हड़प्पा स्थल का उत्खनन कार्य शुरू किया था।'
          }
        ]
      },
      {
        id: 'quiz-geography',
        title: 'भूगोल एवं पर्यावरण',
        kind: 'mcq',
        icon: '🌍',
        subtitle: 'नदियां, पर्वत, जलवायु व राष्ट्रीय उद्यान',
        enabled: true,
        children: [],
        questions: [
          {
            id: 1,
            question: 'भारत की सबसे लंबी नदी कौन सी है?',
            options: ['गंगा (2525 किमी)', 'गोदावरी (1465 किमी)', 'ब्रह्मपुत्र', 'यमुना'],
            correct: 0,
            explanation: 'गंगा नदी भारत की सबसे लंबी नदी है जिसकी कुल लंबाई 2525 किमी है।'
          }
        ]
      }
    ],
    questions: []
  },
  {
    id: 'mock',
    title: 'मॉक टेस्ट',
    titleEn: 'Mock Tests',
    kind: 'mock',
    icon: '📝',
    subtitle: 'रियल टाइमर सीरीज',
    subtitleEn: 'Real Timer Series',
    enabled: true,
    view: 'mock_play',
    children: [],
    questions: [
      {
        id: 1,
        question: 'भारतीय संविधान में "मौलिक अधिकार" किस देश के संविधान से प्रेरित होकर लिए गए हैं?',
        options: ['संयुक्त राज्य अमेरिका (USA)', 'यूनाइटेड किंगडम (UK)', 'रूस (USSR)', 'आयरलैंड'],
        correct: 0,
        explanation: 'भारतीय संविधान में मौलिक अधिकार (भाग 3) अमेरिकी संविधान के "बिल ऑफ राइट्स" से प्रेरित हैं।'
      },
      {
        id: 2,
        question: 'सौरमंडल का सबसे गर्म ग्रह कौन सा है?',
        options: ['शुक्र (Venus)', 'बुध (Mercury)', 'मंगल (Mars)', 'बृहस्पति (Jupiter)'],
        correct: 0,
        explanation: 'शुक्र के वायुमंडल में 96% से अधिक कार्बन डाइऑक्साइड होने के कारण तीव्र ग्रीनहाउस प्रभाव से यह सबसे गर्म ग्रह है।'
      }
    ]
  },
  {
    id: 'notes',
    title: 'नोट्स (PDF)',
    titleEn: 'Notes (PDF)',
    kind: 'notes',
    icon: '📚',
    subtitle: 'रिवीज़न लाइब्रेरी',
    subtitleEn: 'Clear Reading Library',
    enabled: true,
    view: 'notes_lib',
    children: [
      {
        id: 'ch-1',
        title: 'मुद्रास्फीति, आरबीआई एवं मौद्रिक नीति',
        subtitle: 'भारतीय अर्थव्यवस्था • परीक्षा स्पेशल',
        kind: 'notes',
        icon: '📖',
        enabled: true,
        children: [],
        content: '# मुद्रास्फीति एवं मौद्रिक नीति\n\n- रेपो दर एवं रिवर्स रेपो दर\n- सीआरआर एवं एसएलआर'
      },
      {
        id: 'ch-2',
        title: 'केंद्रीय बजट, प्रत्यक्ष एवं अप्रत्यक्ष कर (GST)',
        subtitle: 'वित्तीय प्रणाली • आवश्यक प्रावधान',
        kind: 'notes',
        icon: '📖',
        enabled: true,
        children: [],
        content: '# केंद्रीय बजट एवं भारतीय कर प्रणाली\n\n- प्रत्यक्ष कर और अप्रत्यक्ष कर\n- वस्तु एवं सेवा कर (GST)'
      }
    ],
    questions: []
  },
  {
    id: 'calc',
    title: 'कैलकुलेशन',
    titleEn: 'Calculation',
    kind: 'html', // Leaf/Tool mode: prevents Admin from offering "Add Button" inside calculation
    icon: '🧮',
    subtitle: 'असीमित स्पीड मैथ',
    subtitleEn: 'Unlimited Speed Math',
    enabled: true,
    view: 'calc_setup',
    target_view: 'calc_setup',
    isLeaf: true,
    allowChildren: false,
    canAddChildren: false,
    isContainer: false,
    children: [],
    questions: []
  },
  {
    id: 'typing',
    title: 'टाइपिंग टेस्ट',
    titleEn: 'Typing Test',
    kind: 'html', // Leaf/Tool mode: prevents Admin from offering "Add Button" inside typing
    icon: '⌨️',
    subtitle: 'स्पीड एवं एक्यूरेसी लैब',
    subtitleEn: 'Speed & Accuracy Lab',
    enabled: true,
    view: 'typing_setup',
    target_view: 'typing_setup',
    isLeaf: true,
    allowChildren: false,
    canAddChildren: false,
    isContainer: false,
    children: [],
    questions: []
  }
];

// Helper: One-time migration/sync function to merge all user app content into Supabase
export async function syncExistingContentToSupabase(): Promise<{ nodes: any[]; success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { nodes: DEFAULT_STUDYBULL_NODES, success: false, error: 'No client' };
  }

  try {
    // 1. Fetch current row from Supabase
    const { data: current, error: fetchErr } = await client
      .from('studybull_app_state')
      .select('nodes, settings')
      .eq('id', 'main')
      .maybeSingle();

    if (fetchErr) {
      console.warn('Fetch error during sync:', fetchErr.message);
    }

    const existingNodes: any[] = Array.isArray(current?.nodes) ? current.nodes : [];

    // Check if database row has only 0 or 1 button, or does not contain our full library
    const existingIds = new Set(existingNodes.map((n: any) => n.id));
    const hasCoreLibrary = existingIds.has('quiz') && existingIds.has('mock') && existingIds.has('notes');

    // Merge existing admin nodes with full library content
    const mergedNodes: any[] = [...existingNodes];
    for (const coreNode of DEFAULT_STUDYBULL_NODES) {
      if (!existingIds.has(coreNode.id)) {
        mergedNodes.push(coreNode);
      }
    }

    // Always ensure each item matches the Study Bull node schema
    const formattedNodes = mergedNodes.map((n: any) => {
      const isTool = n.id === 'calc' || n.id === 'typing' || n.view === 'calc_setup' || n.view === 'typing_setup';
      const rawKind = String(n.kind || '').toLowerCase();
      let resolvedKind: any = 'button';
      if (['button', 'folder', 'section', 'mcq', 'mock', 'notes', 'html', 'tool', 'calc', 'typing'].includes(rawKind)) {
        resolvedKind = rawKind;
      }
      if (isTool && (resolvedKind === 'button' || resolvedKind === 'folder' || resolvedKind === 'section')) {
        resolvedKind = 'html';
      }

      const resolvedHtml = n.htmlContent || n.html || n.code || n.rawHtml || 
        (typeof n.content === 'string' && (n.content.includes('<html') || n.content.includes('<!DOCTYPE') || n.content.includes('<div') || n.content.includes('<script')) ? n.content : undefined);

      return {
        ...n,
        id: String(n.id || `node-${Date.now()}`),
        title: String(n.title || n.name || 'Untitled'),
        titleEn: n.titleEn || n.title_en || undefined,
        kind: resolvedKind,
        icon: String(n.icon || '📌'),
        subtitle: String(n.subtitle || n.sub || ''),
        subtitleEn: n.subtitleEn || n.subtitle_en || undefined,
        enabled: n.enabled !== false,
        children: isTool ? [] : (Array.isArray(n.children) ? n.children : []),
        questions: Array.isArray(n.questions) ? n.questions : [],
        isLeaf: isTool ? true : (n.isLeaf !== undefined ? Boolean(n.isLeaf) : undefined),
        allowChildren: isTool ? false : (n.allowChildren !== undefined ? Boolean(n.allowChildren) : undefined),
        canAddChildren: isTool ? false : (n.canAddChildren !== undefined ? Boolean(n.canAddChildren) : undefined),
        isContainer: isTool ? false : (n.isContainer !== undefined ? Boolean(n.isContainer) : undefined),
        htmlContent: resolvedHtml,
        html: resolvedHtml,
        code: resolvedHtml,
        ...(n.content ? { content: n.content } : {}),
        ...(n.view ? { view: n.view } : (isTool ? { view: n.id === 'calc' ? 'calc_setup' : 'typing_setup' } : {})),
        ...(n.target_view ? { target_view: n.target_view } : (isTool ? { target_view: n.id === 'calc' ? 'calc_setup' : 'typing_setup' } : {})),
        ...(n.url ? { url: n.url } : {})
      };
    });

    // If needed or if missing items, upsert to Supabase
    if (existingNodes.length <= 1 || !hasCoreLibrary || formattedNodes.length > existingNodes.length) {
      const { error: upsertErr } = await client
        .from('studybull_app_state')
        .upsert({
          id: 'main',
          nodes: formattedNodes,
          settings: current?.settings || { appName: 'Study Bull' },
          updated_at: new Date().toISOString()
        });

      if (upsertErr) {
        console.warn('Sync upsert error:', upsertErr.message);
      }
    }

    // Update local cache immediately
    try {
      localStorage.setItem('studybull_cached_nodes', JSON.stringify(formattedNodes));
      localStorage.setItem('studybull_user_cache', JSON.stringify(formattedNodes));
    } catch {}

    return { nodes: formattedNodes, success: true };
  } catch (err: any) {
    console.error('syncExistingContentToSupabase exception:', err);
    return { nodes: DEFAULT_STUDYBULL_NODES, success: false, error: err?.message };
  }
}

// Normalize all item fields according to Study Bull node schema
export function normalizeNode(n: any): StudyBullNode {
  const isTool = n.id === 'calc' || n.id === 'typing' || n.view === 'calc_setup' || n.view === 'typing_setup';
  const rawKind = String(n.kind || '').toLowerCase();
  let resolvedKind: any = 'button';
  if (['button', 'folder', 'section', 'mcq', 'mock', 'notes', 'html', 'tool', 'calc', 'typing'].includes(rawKind)) {
    resolvedKind = rawKind;
  }
  // Standalone utilities (Calculation & Typing) must NEVER be container buttons so Admin doesn't show "Add Button" inside them
  if (isTool && (resolvedKind === 'button' || resolvedKind === 'folder' || resolvedKind === 'section')) {
    resolvedKind = 'html';
  }

  const resolvedHtml = n.htmlContent || n.html || n.code || n.rawHtml || 
    (typeof n.content === 'string' && (n.content.includes('<html') || n.content.includes('<!DOCTYPE') || n.content.includes('<div') || n.content.includes('<script')) ? n.content : undefined);

  return {
    ...n,
    id: String(n.id || `node-${Date.now()}`),
    title: String(n.title || n.name || 'Untitled'),
    titleEn: n.titleEn || n.title_en || undefined,
    kind: resolvedKind,
    icon: String(n.icon || '📌'),
    subtitle: String(n.subtitle || n.sub || n.subtitleEn || ''),
    subtitleEn: n.subtitleEn || n.subtitle_en || undefined,
    enabled: n.enabled !== false && n.enabled !== 'false' && n.enabled !== 0,
    children: isTool ? [] : (Array.isArray(n.children) ? n.children.map(normalizeNode) : []),
    questions: Array.isArray(n.questions) ? n.questions : [],
    isLeaf: isTool ? true : (n.isLeaf !== undefined ? Boolean(n.isLeaf) : undefined),
    allowChildren: isTool ? false : (n.allowChildren !== undefined ? Boolean(n.allowChildren) : undefined),
    canAddChildren: isTool ? false : (n.canAddChildren !== undefined ? Boolean(n.canAddChildren) : undefined),
    isContainer: isTool ? false : (n.isContainer !== undefined ? Boolean(n.isContainer) : undefined),
    htmlContent: resolvedHtml,
    html: resolvedHtml,
    code: resolvedHtml,
    ...(n.content ? { content: n.content } : {}),
    ...(n.view ? { view: n.view } : (isTool ? { view: n.id === 'calc' ? 'calc_setup' : 'typing_setup' } : {})),
    ...(n.target_view ? { target_view: n.target_view } : (isTool ? { target_view: n.id === 'calc' ? 'calc_setup' : 'typing_setup' } : {})),
    ...(n.url ? { url: n.url } : {})
  };
}

// 1. शुरुआती डेटा (Buttons, Folders, Quizzes, Settings) लोड करने के लिए:
export async function loadStudyBullApp(): Promise<{ nodes: any[]; settings: any; raw?: any; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      nodes: [],
      settings: {},
      error: 'Supabase credentials not configured',
    };
  }

  try {
    const { data, error } = await client
      .from('studybull_app_state')
      .select('nodes, settings, updated_at')
      .eq('id', 'main')
      .maybeSingle();

    if (error) {
      console.warn('Supabase loadStudyBullApp query error:', error.message);
      return {
        nodes: [],
        settings: {},
        error: error.message,
      };
    }

    const rawNodes = Array.isArray(data?.nodes) ? data.nodes : [];

    // Filter published nodes & normalize fields
    const publishedNodes = rawNodes
      .filter((n: any) => 
        Boolean(n.enabled === true || n.enabled === 'true' || n.enabled === 1 || n.status === 'published' || n.isPublished === true)
      )
      .map(normalizeNode);

    // Write to unified local user cache
    try {
      localStorage.setItem('studybull_user_cache', JSON.stringify(publishedNodes));
      localStorage.setItem('studybull_cached_nodes', JSON.stringify(publishedNodes));
      if (data?.settings) {
        localStorage.setItem('studybull_cached_settings', JSON.stringify(data.settings));
      }
    } catch {}

    return {
      nodes: publishedNodes,
      settings: data?.settings || {},
      raw: data,
    };
  } catch (err: any) {
    console.error('Supabase loadStudyBullApp error:', err);
    return {
      nodes: [],
      settings: {},
      error: err?.message || 'Network / connection error',
    };
  }
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
          filter: 'id=eq.main',
        },
        (payload: any) => {
          const row = payload.new as any;
          if (row) {
            const rawNodes = Array.isArray(row.nodes) ? row.nodes : [];
            const published = rawNodes
              .filter((n: any) => Boolean(n.enabled === true || n.enabled === 'true' || n.enabled === 1 || n.status === 'published' || n.isPublished === true))
              .map(normalizeNode);

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
      client.removeChannel(channel);
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
