export function getEffectiveAiConfig(user) {
  const groqApiKey = user?.aiSettings?.groqApiKey?.trim() || process.env.GROQ_API_KEY?.trim() || '';
  const groqBaseUrl = (
    user?.aiSettings?.groqBaseUrl ||
    process.env.GROQ_BASE_URL ||
    'https://api.groq.com/openai/v1'
  ).replace(/\/$/, '');

  const legacyModels = new Set(['gpt-4o-mini', 'llama-3.3-70b-versatile']);
  const userModel = user?.aiSettings?.model;
  const model =
    userModel && !legacyModels.has(userModel)
      ? userModel
      : process.env.GROQ_LLM_MODEL || 'openai/gpt-oss-120b';
  const sttModel = user?.aiSettings?.sttModel || process.env.GROQ_STT_MODEL || 'whisper-large-v3-turbo';
  const geminiApiKey =
    user?.aiSettings?.geminiApiKey?.trim() || process.env.GEMINI_API_KEY?.trim() || '';
  const geminiTtsModel =
    user?.aiSettings?.geminiTtsModel ||
    process.env.GEMINI_TTS_MODEL ||
    'gemini-2.5-flash-preview-tts';

  return {
    llmProvider: process.env.LLM_PROVIDER || user?.aiSettings?.llmProvider || 'groq',
    sttProvider: user?.voiceSettings?.sttProvider || process.env.STT_PROVIDER || 'groq',
    ttsProvider: user?.voiceSettings?.ttsProvider || process.env.TTS_PROVIDER || 'browser',
    groqApiKey,
    groqBaseUrl,
    model,
    sttModel,
    geminiApiKey,
    geminiTtsModel,
    temperature:
      typeof user?.aiSettings?.temperature === 'number' ? user.aiSettings.temperature : 0.4,
    systemPrompt: user?.aiSettings?.systemPrompt || '',
    hasGroqKey: Boolean(groqApiKey),
    hasGeminiKey: Boolean(geminiApiKey),
  };
}

export async function testAiConnection(aiConfig) {
  if (!aiConfig.groqApiKey) {
    return {
      connected: false,
      provider: 'groq',
      mode: 'unconfigured',
      message:
        'GROQ_API_KEY is not configured. Add your free Groq API key in server/.env or Settings.',
      geminiConfigured: aiConfig.hasGeminiKey,
    };
  }

  try {
    const res = await fetch(`${aiConfig.groqBaseUrl}/models`, {
      headers: {
        Authorization: `Bearer ${aiConfig.groqApiKey}`,
      },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        connected: false,
        provider: 'groq',
        mode: 'error',
        status: res.status,
        error: data?.error?.message || `HTTP ${res.status}`,
        message: `Groq API check failed (${data?.error?.message || res.status}).`,
        geminiConfigured: aiConfig.hasGeminiKey,
      };
    }

    const modelIds = (data.data || []).map((m) => m.id);
    return {
      connected: true,
      provider: 'groq',
      mode: 'groq-live',
      model: aiConfig.model,
      sttModel: aiConfig.sttModel,
      availableModelsCount: modelIds.length,
      chatModelAvailable: modelIds.includes(aiConfig.model),
      sttModelAvailable: modelIds.includes(aiConfig.sttModel),
      geminiConfigured: aiConfig.hasGeminiKey,
      message: `Connected to Groq (${aiConfig.groqBaseUrl}) · ${modelIds.length} models available`,
    };
  } catch (err) {
    return {
      connected: false,
      provider: 'groq',
      mode: 'error',
      error: err.message,
      message: `Groq connection error: ${err.message}`,
      geminiConfigured: aiConfig.hasGeminiKey,
    };
  }
}

function buildSalesSystemPrompt(user, call, retrievedChunks, language = 'auto') {
  const biz = user.businessSettings || {};
  const productsText = (biz.products || [])
    .map(
      (p) =>
        `- ${p.name} (${p.price}, ${p.billingCycle}): ${p.description} | Features: ${(p.features || []).join(', ')}`
    )
    .join('\n');

  const ragText =
    retrievedChunks.length > 0
      ? retrievedChunks
          .map((c, idx) => `[Source ${idx + 1}: ${c.title} (relevance ${c.score})]\n${c.content}`)
          .join('\n\n')
      : 'No matching uploaded knowledge base excerpts for this turn.';

  const leadMemory = call.analysis?.extractedLead || {};
  const languageDirective =
    language === 'hi'
      ? 'Respond naturally in conversational Hindi (Devanagari script, e.g., नमस्ते, बिल्कुल...), while keeping all JSON property keys and enum values in English.'
      : language === 'en'
        ? 'Respond naturally in English.'
        : 'Respond in the same language the customer uses (English or Hindi in Devanagari script). Keep all JSON property keys and enum values in English.';

  return `${user.aiSettings?.systemPrompt || 'You are SalesPilot AI, an autonomous AI sales representative.'}

LANGUAGE INSTRUCTION:
${languageDirective}

COMPANY CONTEXT:
- Company: ${biz.companyName || user.companyName || 'SalesPilot Client'}
- Industry: ${biz.industry || 'B2B SaaS'}
- Value Proposition: ${biz.tagline || ''} ${biz.description || ''}
- Working Hours: ${biz.workingHours?.start || '09:00'} - ${biz.workingHours?.end || '17:00'} (${(biz.workingHours?.days || []).join(', ')})

PRODUCT CATALOG:
${productsText || 'No products configured yet.'}

RETRIEVED KNOWLEDGE BASE (RAG):
${ragText}

KNOWN LEAD MEMORY SO FAR:
${JSON.stringify(leadMemory)}
Current Lead Score: ${call.analysis?.leadScore ?? 50}
Current Date/Time (UTC): ${new Date().toISOString()}

INSTRUCTIONS:
1. Respond naturally in 2-4 crisp spoken sentences suitable for voice playback (avoid markdown bullets or asterisks in the spoken reply).
2. Ground pricing/features strictly in PRODUCT CATALOG and RETRIEVED KNOWLEDGE BASE. Never invent certifications or SLAs not present in the context.
3. Extract any newly shared prospect info (name, email, phone, company, budget, timeline), objections, key needs, sentiment, buying intent, and lead score (0-100).
4. If the prospect asks to schedule/book a demo, call, or meeting, set appointmentIntent.wantsToBook=true and resolve suggestedDateTimeIso to an ISO-8601 timestamp in the near future.
5. Return ONLY valid JSON matching this exact structure:
{
  "reply": "Spoken conversational response in English or Hindi",
  "detectedLanguage": "en" | "hi",
  "sentiment": "positive" | "neutral" | "negative",
  "sentimentScore": number between -1 and 1,
  "leadScore": integer between 0 and 100,
  "leadStatus": "hot" | "warm" | "cold",
  "buyingIntent": "high" | "medium" | "low",
  "objections": ["string"],
  "keyNeeds": ["string"],
  "summary": "Brief updated 1-2 sentence CRM call summary",
  "recommendedNextAction": "Concrete sales next step",
  "extractedLead": {
    "name": "string or empty",
    "email": "string or empty",
    "phone": "string or empty",
    "company": "string or empty",
    "budget": "string or empty",
    "timeline": "string or empty"
  },
  "appointmentIntent": {
    "wantsToBook": boolean,
    "suggestedDateTimeIso": "ISO string or empty",
    "meetingType": "discovery_call" | "product_demo" | "proposal_review" | "follow_up",
    "notes": "string"
  }
}`;
}

function stripJsonFences(raw) {
  const trimmed = (raw || '').trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : trimmed;
}

export async function generateSalesTurn({ user, call, userMessage, retrievedChunks, language }) {
  const aiConfig = getEffectiveAiConfig(user);

  if (!aiConfig.groqApiKey) {
    const err = new Error(
      'Groq API key is missing. Configure GROQ_API_KEY in server/.env or Settings to generate AI responses.'
    );
    err.statusCode = 503;
    err.code = 'GROQ_KEY_MISSING';
    throw err;
  }

  const startedAt = Date.now();
  const effectiveLang = language || user?.voiceSettings?.language || 'auto';
  const systemPrompt = buildSalesSystemPrompt(user, call, retrievedChunks, effectiveLang);

  const rawTranscript = (call.transcript || []).filter(
    (m) => m.role === 'user' || m.role === 'assistant'
  );
  const priorTranscript =
    rawTranscript.length > 0 &&
    rawTranscript[rawTranscript.length - 1].role === 'user' &&
    rawTranscript[rawTranscript.length - 1].content === userMessage
      ? rawTranscript.slice(0, -1)
      : rawTranscript;

  const historyMessages = priorTranscript
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content }));

  const messages = [
    { role: 'system', content: systemPrompt },
    ...historyMessages,
    { role: 'user', content: userMessage },
  ];

  const callGroqChat = async (useJsonMode) => {
    const body = {
      model: aiConfig.model,
      temperature: aiConfig.temperature,
      messages,
      ...(useJsonMode ? { response_format: { type: 'json_object' } } : {}),
    };

    const response = await fetch(`${aiConfig.groqBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aiConfig.groqApiKey}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));
    return { response, data };
  };

  let { response, data } = await callGroqChat(true);

  if (!response.ok && response.status === 400 && /response_format/i.test(data?.error?.message || '')) {
    ({ response, data } = await callGroqChat(false));
  }

  if (!response.ok) {
    const apiMessage = data?.error?.message || `Groq API error (HTTP ${response.status})`;
    const err = new Error(
      response.status === 429
        ? `Groq free-tier rate limit reached: ${apiMessage}. Please retry in a few seconds.`
        : `Groq LLM error: ${apiMessage}`
    );
    err.statusCode = response.status;
    err.retryable = response.status === 429 || response.status >= 500;
    throw err;
  }

  const rawContent = stripJsonFences(data.choices?.[0]?.message?.content || '{}');
  let parsed;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    parsed = { reply: rawContent };
  }

  return {
    aiMode: 'groq-live',
    provider: 'groq',
    modelUsed: data.model || aiConfig.model,
    tokensUsed: data.usage?.total_tokens || 0,
    latencyMs: Date.now() - startedAt,
    result: {
      reply: parsed.reply || 'Thank you for sharing that. Could you tell me more about your requirements?',
      detectedLanguage: parsed.detectedLanguage || 'en',
      sentiment: ['positive', 'neutral', 'negative'].includes(parsed.sentiment)
        ? parsed.sentiment
        : 'neutral',
      sentimentScore: typeof parsed.sentimentScore === 'number' ? parsed.sentimentScore : 0,
      leadScore:
        typeof parsed.leadScore === 'number'
          ? Math.max(0, Math.min(100, Math.round(parsed.leadScore)))
          : 50,
      leadStatus: ['hot', 'warm', 'cold'].includes(parsed.leadStatus) ? parsed.leadStatus : 'warm',
      buyingIntent: ['high', 'medium', 'low'].includes(parsed.buyingIntent)
        ? parsed.buyingIntent
        : 'medium',
      objections: Array.isArray(parsed.objections) ? parsed.objections : [],
      keyNeeds: Array.isArray(parsed.keyNeeds) ? parsed.keyNeeds : [],
      summary: parsed.summary || '',
      recommendedNextAction:
        parsed.recommendedNextAction || 'Follow up with tailored product demo',
      extractedLead: {
        name: parsed.extractedLead?.name || call.analysis?.extractedLead?.name || '',
        email: parsed.extractedLead?.email || call.analysis?.extractedLead?.email || '',
        phone: parsed.extractedLead?.phone || call.analysis?.extractedLead?.phone || '',
        company: parsed.extractedLead?.company || call.analysis?.extractedLead?.company || '',
        budget: parsed.extractedLead?.budget || call.analysis?.extractedLead?.budget || '',
        timeline: parsed.extractedLead?.timeline || call.analysis?.extractedLead?.timeline || '',
      },
      appointmentIntent: {
        wantsToBook: Boolean(parsed.appointmentIntent?.wantsToBook),
        suggestedDateTimeIso: parsed.appointmentIntent?.suggestedDateTimeIso || '',
        meetingType: parsed.appointmentIntent?.meetingType || 'product_demo',
        notes: parsed.appointmentIntent?.notes || '',
      },
    },
  };
}
