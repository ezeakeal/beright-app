import React from "react";
import { View, Text, Modal, TouchableOpacity, ScrollView, Linking } from "react-native";

interface InfoModalProps {
  visible: boolean;
  onClose: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({ visible, onClose }) => {
  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-center items-center bg-black/80 p-6">
        <View className="bg-black/95 border border-zinc-800/50 rounded-3xl w-full max-w-lg overflow-hidden"
              style={{ shadowColor: '#3b82f6', shadowOpacity: 0.2, shadowRadius: 30 }}>
          <View className="p-6 bg-black/90 border-b border-blue-900/40"
                style={{ shadowColor: '#3b82f6', shadowOpacity: 0.15, shadowRadius: 20 }}>
            <Text className="text-white/90 text-2xl font-bold text-center">About B'right</Text>
          </View>
          
          <ScrollView className="p-6 max-h-96">
            <Text className="text-white/90 text-lg font-bold mb-3">Our Mission</Text>
            <Text className="text-zinc-400 mb-6 leading-relaxed">
              We believe in the power of ubiquitous AI to help humans engage in friendly, respectful debate. 
              In a world of echo chambers, B'right aims to bridge divides by finding harmony in conflict 
              and fostering understanding between opposing viewpoints.
            </Text>

            <Text className="text-white/90 text-lg font-bold mb-3">Disclaimer</Text>
            <Text className="text-zinc-400 mb-6 leading-relaxed">
              This application uses Artificial Intelligence to analyze topics and generate summaries. 
              While we strive for accuracy and neutrality, AI models can make mistakes or exhibit biases.
              Please use the insights provided as a starting point for your own critical thinking.
            </Text>

            <Text className="text-white/90 text-lg font-bold mb-3">Privacy</Text>
            <Text className="text-zinc-400 mb-6 leading-relaxed">
              The only time we will ever store your personal opinions or data is when you report a conversation.
              Other than that, it is completely anonymous - even credits use obfuscated device IDs.
            </Text>

            <Text className="text-white/90 text-lg font-bold mb-3">Carbon Negative</Text>
            <Text className="text-zinc-400 mb-6 leading-relaxed">
              Every conversation matters to us and to the planet. We acknowledge that AI inference has an
              environmental footprint. When you purchase credits, 25% of your payment goes directly to
              carbon capture initiatives — and our contribution is designed to far exceed the emissions
              associated with the AI usage in the app. In practice, using B'right helps remove more CO₂
              than it generates.
            </Text>

            <TouchableOpacity
              onPress={() => Linking.openURL('https://cloud.google.com/blog/products/infrastructure/measuring-the-environmental-impact-of-ai-inference/')}
              className="mb-6"
            >
              <Text className="text-blue-300/80 underline text-sm">
                Read about the environmental impact of AI inference →
              </Text>
            </TouchableOpacity>
            
          </ScrollView>

          <View className="p-4 border-t border-zinc-800/50 bg-black/90">
            <TouchableOpacity 
              onPress={onClose}
              className="border border-zinc-700/50 py-3 rounded-xl"
            >
              <Text className="text-zinc-400 text-center font-bold text-lg">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
