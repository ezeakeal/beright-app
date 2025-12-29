import React from "react";
import { View, Text, Modal, TouchableOpacity, ScrollView } from "react-native";

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
              We do not track or store any of your personal opinions or data. 
              Google Sign-In is used solely for managing authentication and subscription tiers to provide 
              access to advanced AI models. Your conversations remain private and are not harvested.
            </Text>

            <Text className="text-white/90 text-lg font-bold mb-3">Carbon Negative</Text>
            <Text className="text-zinc-400 mb-6 leading-relaxed">
              Every conversation matters to us and to the planet. When you purchase credits, 25% of your 
              payment goes directly to carbon capture initiatives. This means using B'right actively 
              helps remove CO₂ from the atmosphere, making our app carbon negative.
            </Text>
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
