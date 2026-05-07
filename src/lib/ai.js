/**
 * ai.js — Claude API wrapper
 * Uses extended thinking for richer, more personal content
 */

const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function generateGiftContent(formData) {
  const { partnerName, occasion, tone, memories, traits, song, timeline, relationshipDate } = formData;

  const timelineText = timeline && timeline.length > 0
    ? timeline.map((t, i) => `${i + 1}. ${t.date}: ${t.event}`).join('\n')
    : 'Not provided';

  const prompt = `You are a world-class romantic writer creating a premium personalized digital gift.

Partner's name: ${partnerName}
Occasion: ${occasion}
Tone: ${tone}
Relationship start date: ${relationshipDate || 'Not specified'}

Three special memories:
1. ${memories[0]}
2. ${memories[1]}
3. ${memories[2]}

Three things I love about them:
1. ${traits[0]}
2. ${traits[1]}
3. ${traits[2]}

Our song: ${song || 'Not specified'}

Relationship timeline:
${timelineText}

For the "captions" field: write 5 short romantic photo captions (max 8 words each) that reference the specific memories and traits shared above. Each should feel like it belongs to a real photo from this couple's story — intimate and specific, not generic. Examples of the right tone: "That rainy Tuesday we never wanted to end", "Lost together, happy together", "The night we talked until sunrise".

Respond ONLY with valid JSON (no markdown, no backticks) in this exact format:
{
  "title": "A poetic, deeply romantic title (max 10 words)",
  "subtitle": "A tender one-line subtitle (max 12 words)",
  "letter": "A heartfelt personal letter (4-5 paragraphs separated by double newlines, deeply warm and specific to their memories)",
  "poem": "A short romantic poem (4-6 lines) specific to their story",
  "reasons": ["Reason 1","Reason 2","Reason 3","Reason 4","Reason 5","Reason 6","Reason 7"],
  "captions": ["caption1","caption2","caption3","caption4","caption5"],
  "timelineCaptions": ["Note for event 1","Note for event 2","Note for event 3"],
  "songNote": "A beautiful 2-3 sentence note about what this song means",
  "finalMessage": "A short devastating closing message (2-3 sentences)"
}`;

  const response = await anthropic.messages.create({
    model:      'claude-sonnet-4-20250514',
    max_tokens: 2500,
    messages:   [{ role: 'user', content: prompt }],
  });

  const text = response.content.find(b => b.type === 'text')?.text?.trim();
  if (!text) throw new Error('No text response from AI');

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('AI returned invalid JSON — please try again');
  }

  const required = ['title', 'subtitle', 'letter', 'poem', 'reasons', 'captions', 'finalMessage'];
  for (const key of required) {
    if (!(key in parsed)) throw new Error(`AI response missing field: ${key}`);
  }

  return parsed;
}

module.exports = { generateGiftContent };
