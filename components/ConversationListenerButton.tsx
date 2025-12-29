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
      <View className="bg-black/60 border border-zinc-800/50 p-6 rounded-3xl mb-4"
            style={{ shadowColor: '#3b82f6', shadowOpacity: 0.1, shadowRadius: 20 }}>
        <View className="flex-row items-center mb-3">
          <Text className="text-3xl mr-3">🎙️</Text>
          <Text className="text-xl font-bold text-white/90">Listen In Feature</Text>
        </View>
        <Text className="text-zinc-400 mb-3">
          Automatically extract topics and viewpoints from recorded conversations.
        </Text>
        <View className="border border-amber-500/50 px-4 py-2 rounded-full self-start"
              style={{ shadowColor: '#f59e0b', shadowOpacity: 0.3, shadowRadius: 15 }}>
          <Text className="text-amber-300/80 font-bold">Premium Only</Text>
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
      Alert.alert(
        'Recording Permission Required',
        'B\'right needs microphone access to listen to conversations. Please enable it in your device settings.'
      );
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
          'We had trouble understanding the conversation. The audio might be unclear or contain only one viewpoint.\n\nWould you like to review what we extracted?',
          [
            { text: 'Try Again', style: 'cancel' },
            { text: 'Review', onPress: () => onConversationExtracted(result) }
          ]
        );
      } else {
        onConversationExtracted(result);
      }
    } catch (error: any) {
      console.error(error);
      
      const errorMessage = error?.message || String(error);
      
      if (errorMessage.includes("NO_CREDITS") || errorMessage.includes("402")) {
        Alert.alert(
          'No Credits Available',
          'You need credits to use the conversation listener feature.',
          [{ text: 'OK' }]
        );
      } else if (errorMessage.includes("Network") || errorMessage.includes("Failed to fetch")) {
        Alert.alert(
          'Connection Error',
          'Unable to process the recording. Please check your internet connection and try again.'
        );
      } else {
        Alert.alert(
          'Processing Failed',
          'We couldn\'t process your recording. Please try again with clearer audio or type the perspectives manually.'
        );
      }
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
      <View className="bg-black/80 border border-zinc-800/50 p-8 rounded-3xl items-center"
            style={{ shadowColor: '#3b82f6', shadowOpacity: 0.15, shadowRadius: 20 }}>
        <Text className="text-6xl mb-4">🎙️</Text>
        <Text className="text-xl font-bold text-white/90 mb-2">Processing Conversation...</Text>
        <Text className="text-zinc-400 text-center">
          Transcribing audio and extracting viewpoints
        </Text>
      </View>
    );
  }

  if (isListening) {
    return (
      <View className="bg-black/70 border-2 border-red-500/50 p-8 rounded-3xl items-center"
            style={{ shadowColor: '#ef4444', shadowOpacity: 0.3, shadowRadius: 25 }}>
        <View className="bg-red-500/20 border border-red-500/40 w-16 h-16 rounded-full items-center justify-center mb-4">
          <Text className="text-3xl">🔴</Text>
        </View>
        <Text className="text-2xl font-bold text-red-300/80 mb-2">Listening...</Text>
        <Text className="text-4xl font-mono text-red-400/70 mb-6">{formatDuration(duration)}</Text>
        <TouchableOpacity
          onPress={handleStop}
          className="border-2 border-red-500/50 bg-black/40 px-8 py-4 rounded-full active:scale-95"
          style={{ shadowColor: '#ef4444', shadowOpacity: 0.3, shadowRadius: 20 }}
        >
          <Text className="text-red-300/90 font-bold text-lg">⏹️  Stop & Analyze</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity
      onPress={handleStart}
      className="border-2 border-blue-400/50 bg-black/60 p-8 rounded-3xl items-center active:scale-95"
      style={{ shadowColor: '#3b82f6', shadowOpacity: 0.3, shadowRadius: 25 }}
    >
      <Text className="text-6xl mb-3">🎙️</Text>
      <Text className="text-2xl font-bold text-white/90 mb-2">Listen In</Text>
      <Text className="text-zinc-400 text-center text-sm">
        Record a conversation to auto-extract the topic and viewpoints
      </Text>
    </TouchableOpacity>
  );
}

