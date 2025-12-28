import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Modal, KeyboardAvoidingView, Platform } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

interface PerspectiveInputModalProps {
  visible: boolean;
  emoji: string;
  fruitName: string;
  color: "purple" | "cyan";
  initialValue: string;
  onSave: (text: string) => void;
  onClose: () => void;
}

export const PerspectiveInputModal: React.FC<PerspectiveInputModalProps> = ({
  visible,
  emoji,
  fruitName,
  color,
  initialValue,
  onSave,
  onClose,
}) => {
  const [text, setText] = useState(initialValue);

  const handleSave = () => {
    onSave(text);
    onClose();
  };

  const borderColor = color === "purple" ? "border-purple-500" : "border-cyan-500";
  const textColor = color === "purple" ? "text-purple-300" : "text-cyan-300";
  const shadowColor = color === "purple" ? "#a855f7" : "#22d3ee";
  const bgColor = color === "purple" 
    ? "rgba(168, 85, 247, 0.15)" 
    : "rgba(34, 211, 238, 0.15)";

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View className="flex-1 bg-black/80 justify-center items-center px-6">
          <Animated.View 
            entering={FadeInDown}
            className={`w-full max-w-lg bg-black/95 border-2 ${borderColor} rounded-3xl p-6`}
            style={{ 
              shadowColor: shadowColor, 
              shadowOpacity: 0.3, 
              shadowRadius: 30 
            }}
          >
            {/* Header with Emoji */}
            <View className="flex-row items-center justify-between mb-6">
              <View className="flex-row items-center flex-1">
                <Text className="text-6xl mr-4">{emoji}</Text>
                <View className="flex-1">
                  <Text className={`text-xl font-bold ${textColor}`}>
                    Perspective {fruitName}
                  </Text>
                  <Text className="text-sm text-zinc-500 mt-1">
                    Share your view on this topic
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={onClose}
                className="p-2 border border-zinc-700 rounded-full ml-2"
              >
                <Text className="text-zinc-400 text-lg">✕</Text>
              </TouchableOpacity>
            </View>

            {/* Text Input */}
            <TextInput
              className={`bg-zinc-900/50 border ${borderColor} rounded-2xl p-4 text-white text-lg min-h-[200px]`}
              style={{ textAlignVertical: 'top' }}
              multiline
              placeholder="Type your perspective here..."
              placeholderTextColor="#52525b"
              value={text}
              onChangeText={setText}
              autoFocus
            />

            {/* Action Buttons */}
            <View className="flex-row justify-end mt-6 space-x-3">
              <TouchableOpacity
                onPress={onClose}
                className="border-2 border-zinc-600 px-6 py-3 rounded-full"
                style={{ 
                  backgroundColor: 'rgba(113, 113, 122, 0.1)'
                }}
              >
                <Text className="text-zinc-300 font-bold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                className={`border-2 ${borderColor} px-8 py-3 rounded-full`}
                style={{ 
                  shadowColor: shadowColor, 
                  shadowOpacity: 0.5, 
                  shadowRadius: 20,
                  backgroundColor: bgColor
                }}
              >
                <Text className={`${textColor} font-bold`}>Save</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};


