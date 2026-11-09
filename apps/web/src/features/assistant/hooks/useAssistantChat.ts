'use client';

import { useState } from 'react';
import { type AssistantMessage, fetchDummyReply, WELCOME_MESSAGE } from '../src/dummy-assistant';

export function useAssistantChat() {
  const [messages, setMessages] = useState<AssistantMessage[]>([WELCOME_MESSAGE]);
  const [replying, setReplying] = useState(false);

  const addMessage = (role: AssistantMessage['role'], text: string) =>
    setMessages((current) => [...current, { id: crypto.randomUUID(), role, text }]);

  async function send(text: string) {
    const prompt = text.trim();
    if (!prompt || replying) return;
    addMessage('user', prompt);
    setReplying(true);
    addMessage('assistant', await fetchDummyReply(prompt));
    setReplying(false);
  }

  return { messages, replying, send };
}
