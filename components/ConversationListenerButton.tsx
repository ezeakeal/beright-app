import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { ConversationListener, ExtractedConversation } from '../utils/conversationListener';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  onConversationExtracted: (data: ExtractedConversation) => void;
}

export function ConversationListenerButton({ onConversationExtracted }: Props) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [duration, setDuration] = useState(0);
  const listener = useRef(new ConversationListener());
  const { userTier } = useAuth();

  // Update duration every second while recording
  useEffect(() => {
    if (!isListening) return;
    
    const interval = setInterval(() => {
      setDuration(listener.current.getRecordingDuration());
    }, 1000);

    return () => clearInterval(interval);
  }, [isListening]);

  // Premium feature check
  if (userTier === 'anonymous' || userTier === 'free') {
    return (
      <View className="bg-white/90 p-6 rounded-3xl border-2 border-indigo-200 mb-4 shadow-lg">
        <View className="flex-row items-center mb-3">
          <Text className="text-3xl mr-3">🎙️</Text>
          <Text className="text-xl font-bold text-indigo-900">Listen In Feature</Text>
        </View>
        <Text className="text-indigo-800 mb-3">
          Automatically extract topics and viewpoints from recorded conversations.
        </Text>
        <View className="bg-amber-500 px-4 py-2 rounded-full self-start">
          <Text className="text-white font-bold">Premium Only</Text>
        </View>
      </View>
    );
  }

  const handleStart = async () => {
    try {
      await listener.current.startListening();
      setIsListening(true);
      setDuration(0);
    } catch (error) {
      Alert.alert('Error', 'Could not start recording. Please check permissions.');
      console.error(error);
    }
  };

  const handleStop = async () => {
    setIsListening(false);
    setIsProcessing(true);

    try {
      const result = await listener.current.stopAndTranscribe();
      
      if (result.confidence === 'low') {
        Alert.alert(
          'Low Confidence',
          'The conversation was unclear. The extracted information may not be accurate.',
          [
            { text: 'Edit Manually', onPress: () => onConversationExtracted(result) },
            { text: 'Try Again', style: 'cancel' },
          ]
        );
      } else {
        onConversationExtracted(result);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to process conversation');
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isProcessing) {
    return (
      <View className="bg-white/95 p-8 rounded-3xl items-center border-2 border-indigo-200 shadow-lg">
        <Text className="text-6xl mb-4">🎙️</Text>
        <Text className="text-xl font-bold text-slate-800 mb-2">Processing Conversation...</Text>
        <Text className="text-slate-600 text-center">
          Transcribing audio and extracting viewpoints
        </Text>
      </View>
    );
  }

  if (isListening) {
    return (
      <View className="bg-red-50 p-8 rounded-3xl items-center border-2 border-red-300 shadow-lg">
        <View className="bg-red-500 w-16 h-16 rounded-full items-center justify-center mb-4">
          <Text className="text-3xl">🔴</Text>
        </View>
        <Text className="text-2xl font-bold text-red-900 mb-2">Listening...</Text>
        <Text className="text-4xl font-mono text-red-700 mb-6">{formatDuration(duration)}</Text>
        <TouchableOpacity
          onPress={handleStop}
          className="bg-red-600 px-8 py-4 rounded-full active:scale-95"
        >
          <Text className="text-white font-bold text-lg">⏹️  Stop & Analyze</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity
      onPress={handleStart}
      className="bg-indigo-600 p-8 rounded-3xl items-center shadow-xl active:scale-95 border-2 border-indigo-400"
    >
      <Text className="text-6xl mb-3">🎙️</Text>
      <Text className="text-2xl font-bold text-white mb-2">Listen In</Text>
      <Text className="text-indigo-100 text-center text-sm">
        Record a conversation to auto-extract the topic and viewpoints
      </Text>
    </TouchableOpacity>
  );
}

