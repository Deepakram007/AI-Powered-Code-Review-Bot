import OpenAI from 'openai';
import { env } from './env';

export const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

export const model = env.OPENAI_MODEL;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Creates chat completion using configure model and settings.
 * Ensures type safety and supports structured JSON outputs.
 */
export async function createChatCompletion(
  messages: ChatMessage[],
  responseFormat?: { type: 'json_object' }
): Promise<string | null> {
  const options: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
    model,
    messages,
    temperature: 0.2,
  };

  if (responseFormat) {
    options.response_format = responseFormat;
  }

  const response = await openai.chat.completions.create(options);
  return response.choices[0].message.content;
}
