import { appConfig } from '../config';
import { ApiError, apiRequest } from './apiClient';
import { isValidEmail, normalizeEmail } from './customerValidation';

export type SupportMessage = { id: string; senderType: 'customer' | 'staff'; body: string; createdAt: string };
export type SupportConversation = { id: string; status: 'open' | 'pending_customer' | 'resolved' | 'closed'; subject: string; messages: SupportMessage[] };
export type SupportSession = { conversationId: string; clientToken: string };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const supportEndpoint = () => {
  if (!appConfig.supabaseUrl || !appConfig.supabasePublishableKey) throw new ApiError('Customer care is not configured yet.');
  return { url: `${appConfig.supabaseUrl}/functions/v1/support-inbox`, key: appConfig.supabasePublishableKey };
};

const validateSession = (session: SupportSession) => {
  if (!uuidPattern.test(session.conversationId) || session.clientToken.length < 32) throw new ApiError('This private conversation has expired. Start a new conversation.', 401);
};

const requestSupport = <T>(payload: Record<string, unknown>) => {
  const endpoint = supportEndpoint();
  return apiRequest<T>(endpoint.url, {
    method: 'POST',
    headers: { apikey: endpoint.key, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    timeoutMs: 15_000,
    maxAttempts: 2,
  });
};

export async function createSupportConversation(input: { name: string; email: string; orderNumber?: string; subject: string; message: string }) {
  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  const subject = input.subject.trim();
  const message = input.message.trim();
  if (name.length < 2) throw new ApiError('Please enter your name.');
  if (!isValidEmail(email)) throw new ApiError('Please enter a complete email address.');
  if (subject.length < 2) throw new ApiError('Please choose a support topic.');
  if (message.length < 5) throw new ApiError('Please tell us how we can help.');
  return requestSupport<SupportSession>({ action: 'create', name, email, orderNumber: input.orderNumber?.trim() || null, subject, message });
}

export function loadSupportConversation(session: SupportSession) {
  validateSession(session);
  return requestSupport<SupportConversation>({ action: 'customer_thread', ...session });
}

export async function sendCustomerSupportMessage(session: SupportSession, message: string) {
  validateSession(session);
  const body = message.trim();
  if (!body) throw new ApiError('Write a message before sending.');
  if (body.length > 4000) throw new ApiError('Your message is too long. Please keep it under 4,000 characters.');
  return requestSupport<SupportConversation>({ action: 'customer_reply', ...session, message: body });
}
