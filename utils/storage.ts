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

export const saveConversation = async (conversation: Omit<StoredConversation, 'id' | 'timestamp'>): Promise<void> => {
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
  } catch (error) {
    console.error('Failed to save conversation:', error);
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

