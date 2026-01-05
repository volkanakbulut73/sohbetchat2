import { createGroq } from '@ai-sdk/groq';
import { streamText } from 'ai';

// Vercel Edge Runtime for lower latency
export const runtime = 'edge';

// Initialize Groq provider
const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req: Request) {
  // CORS Headers for PocketBase/Frontend access
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();

    // Streaming response using Vercel AI SDK
    const result = await streamText({
      // Using Llama 3.3 70B as the closest valid high-performance equivalent on Groq
      // 'openai/gpt-oss-120b' is not a standard public Groq model ID
      model: groq('llama-3.3-70b-versatile'),
      messages,
    });

    // Return stream with CORS headers
    return result.toDataStreamResponse({
      headers: corsHeaders,
    });

  } catch (error) {
    console.error('AI API Error:', error);
    return new Response(JSON.stringify({ error: 'Failed to process AI request' }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

