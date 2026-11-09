export type AssistantMessage = { id: string; role: 'user' | 'assistant'; text: string };

const REPLY_DELAY_MS = 900;

const FALLBACK_REPLY = "I'm only a preview for now, so I can't answer that yet. Try one of the suggested questions.";

const REPLIES: Record<string, string> = {
  'Plan my day':
    'Here is a sample plan:\n\n1. Start with your high priority task\n2. Clear two quick to-dos before lunch\n3. Save the afternoon for what is in progress',
  'What should I do first?': 'In this example, I would start with "Review the plan for this week". It is high priority and has been open the longest.',
  'Summarize my week': 'Sample summary: 12 tasks finished, 3 still in progress and 1 on hold. Tuesday was your most productive day.',
};

export const SUGGESTED_PROMPTS = Object.keys(REPLIES);

export const WELCOME_MESSAGE: AssistantMessage = {
  id: 'welcome',
  role: 'assistant',
  text: 'Hi, I can help you plan your day and keep on top of your tasks.',
};

export async function fetchDummyReply(prompt: string): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, REPLY_DELAY_MS));
  return REPLIES[prompt] ?? FALLBACK_REPLY;
}
