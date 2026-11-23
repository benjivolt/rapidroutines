const express = require('express');
const fs = require('fs');
const path = require('path');
const ChatbotKnowledge = require('../models/chatbotKnowledge');
const { chatbotLimiter } = require('../lib/rate-limit');

const router = express.Router();
const knowledgeBasePath = path.join(__dirname, '..', 'data', 'chatbot-knowledge-base.json');

let fallbackKnowledgeBase = [];
try {
  fallbackKnowledgeBase = JSON.parse(fs.readFileSync(knowledgeBasePath, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') console.error('Failed to load chatbot knowledge base:', error.message);
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function rankRelevantDocumentsFromCollection(query, collection) {
  const queryTokens = new Set(tokenize(query));
  if (queryTokens.size === 0) {
    return [];
  }

  const scored = collection
    .map((doc) => {
      const content = String(doc?.content || '');
      if (!content) {
        return { doc: { content: '' }, score: 0 };
      }

      const docTokens = Array.isArray(doc?.tokens) && doc.tokens.length ? doc.tokens : tokenize(content);
      let score = 0;
      for (const token of docTokens) {
        if (queryTokens.has(token)) score += 1;
      }
      return { doc: { content }, score };
    })
    .sort((a, b) => b.score - a.score)
    .filter((item) => item.score > 0)
    .slice(0, 3)
    .map((item) => item.doc.content);

  return scored;
}

function buildPrompt(query, relevantDocs, context) {
  const parts = [
    'You are RapidRoutines AI, a helpful calisthenics and fitness assistant. ',
    'You know fitness topics including weight loss, muscle building, nutrition, cardio vs strength, and recovery.',
    '\n\n',
  ];

  if (relevantDocs.length) {
    parts.push('RELEVANT INFORMATION:\n');
    relevantDocs.forEach((doc, idx) => {
      parts.push(`[${idx + 1}] ${doc}\n\n`);
    });
  }

  if (Array.isArray(context) && context.length) {
    parts.push('CONVERSATION HISTORY:\n');
    context.slice(-4).forEach((msg) => {
      const role = String(msg?.role || 'user');
      const content = String(msg?.content || '');
      parts.push(`${role}: ${content}\n`);
    });
    parts.push('\n');
  }

  parts.push(`User query: ${query}\n`);
  parts.push(
    'Respond in a friendly, helpful manner with accurate fitness information. ',
    'Keep responses concise and easy to read. ',
    'Use **bold text** for key points and section titles. ',
    'Do not use markdown heading syntax with #, ##, or ###. ',
    'Use plain section titles (prefer **bold titles**) and bullet points that start with "- ". ',
    'Do not use code blocks. Do not include unnecessary symbols. ',
    'If the user greets you, greet them back simply. Ask one follow-up question if the query is too general.',
  );

  return parts.join('');
}

function normalizeChatbotText(text) {
  const normalizedLines = String(text || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => {
      const headingMatch = line.match(/^\s{0,3}#{1,6}\s*(.+?)\s*$/);
      if (headingMatch) {
        return `**${headingMatch[1]}**`;
      }

      const bulletMatch = line.match(/^\s*[\*\u2022]\s+(.+)$/);
      if (bulletMatch) {
        return `- ${bulletMatch[1]}`;
      }

      return line;
    });

  return normalizedLines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const MAX_QUERY = 2000;
const MAX_TURNS = 6;
const KB_TTL_MS = 5 * 60 * 1000;
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
let knowledgeCache = { docs: null, loadedAt: 0 };

async function knowledgeDocs() {
  if (knowledgeCache.docs && Date.now() - knowledgeCache.loadedAt < KB_TTL_MS) return knowledgeCache.docs;
  const docs = await ChatbotKnowledge.find({}, { content: 1, tokens: 1, _id: 0 }).lean();
  knowledgeCache = { docs: docs.length ? docs : fallbackKnowledgeBase, loadedAt: Date.now() };
  return knowledgeCache.docs;
}

function cleanContext(context) {
  if (!Array.isArray(context)) return [];
  return context
    .filter((msg) => msg && (msg.role === 'user' || msg.role === 'assistant') && typeof msg.content === 'string')
    .slice(-MAX_TURNS)
    .map((msg) => ({ role: msg.role, content: msg.content.slice(0, MAX_QUERY) }));
}

router.post('/generate', chatbotLimiter, async (req, res) => {
  const userQuery = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
  if (!userQuery || userQuery.length > MAX_QUERY) {
    return res.status(400).json({ error: `Send a message between 1 and ${MAX_QUERY} characters.` });
  }
  if (!process.env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY is not set');
    return res.status(503).json({ error: 'The assistant is unavailable right now.' });
  }

  try {
    const relevantDocs = rankRelevantDocumentsFromCollection(userQuery, await knowledgeDocs());
    const prompt = buildPrompt(userQuery, relevantDocs, cleanContext(req.body?.context));
    const geminiResponse = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 1024 },
      }),
      signal: AbortSignal.timeout(20000),
    });

    const body = await geminiResponse.json().catch(() => null);
    const text = body?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!geminiResponse.ok || typeof text !== 'string' || !text.trim()) {
      console.error('Gemini error:', geminiResponse.status, JSON.stringify(body?.error || {}).slice(0, 300));
      return res.status(502).json({ error: 'The assistant could not answer that. Try again.' });
    }

    return res.json({ candidates: [{ content: { parts: [{ text: normalizeChatbotText(text) }] } }] });
  } catch (error) {
    console.error('Chatbot generation error:', error.message);
    return res.status(502).json({ error: 'The assistant could not answer that. Try again.' });
  }
});

module.exports = router;
