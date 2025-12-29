import AsyncStorage from '@react-native-async-storage/async-storage';
import { AnalysisResult } from './gemini';

export interface StoredConversation {
  id: string;
  timestamp: number;
  topic: string;
  result: AnalysisResult;
  opinionA: string;
  opinionB: string;
  fruitA: { name: string; emoji: string };
  fruitB: { name: string; emoji: string };
}

const STORAGE_KEY = 'BRIGHT_PAST_CONVERSATIONS';

export const saveConversation = async (conversation: Omit<StoredConversation, 'id' | 'timestamp'>): Promise<string> => {
  try {
    const existingData = await AsyncStorage.getItem(STORAGE_KEY);
    const conversations: StoredConversation[] = existingData ? JSON.parse(existingData) : [];

    const newConversation: StoredConversation = {
      ...conversation,
      id: Date.now().toString(),
      timestamp: Date.now(),
    };

    // Add to beginning of list
    conversations.unshift(newConversation);

    // Limit to last 50 conversations
    if (conversations.length > 50) {
      conversations.pop();
    }

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    return newConversation.id;
  } catch (error) {
    console.error('Failed to save conversation:', error);
    return Date.now().toString(); // Return a fallback ID
  }
};

export const getPastConversations = async (): Promise<StoredConversation[]> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to load conversations:', error);
    return [];
  }
};

export const clearHistory = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear history:', error);
  }
};

const REPORTED_CONVERSATIONS_KEY = 'BRIGHT_REPORTED_CONVERSATIONS';

export const markConversationAsReported = async (conversationId: string): Promise<void> => {
  try {
    const existingData = await AsyncStorage.getItem(REPORTED_CONVERSATIONS_KEY);
    const reportedIds: string[] = existingData ? JSON.parse(existingData) : [];
    
    if (!reportedIds.includes(conversationId)) {
      reportedIds.push(conversationId);
      await AsyncStorage.setItem(REPORTED_CONVERSATIONS_KEY, JSON.stringify(reportedIds));
    }
  } catch (error) {
    console.error('Failed to mark conversation as reported:', error);
  }
};

export const isConversationReported = async (conversationId: string): Promise<boolean> => {
  try {
    const existingData = await AsyncStorage.getItem(REPORTED_CONVERSATIONS_KEY);
    const reportedIds: string[] = existingData ? JSON.parse(existingData) : [];
    return reportedIds.includes(conversationId);
  } catch (error) {
    console.error('Failed to check if conversation is reported:', error);
    return false;
  }
};

