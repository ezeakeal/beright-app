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
      <View className="flex-1 justify-center items-center bg-black/50 p-6">
        <View className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
          <View className="p-6 bg-indigo-600">
            <Text className="text-white text-2xl font-bold text-center">About B'right</Text>
          </View>
          
          <ScrollView className="p-6 max-h-96">
            <Text className="text-slate-800 text-lg font-bold mb-3">Our Mission</Text>
            <Text className="text-slate-600 mb-6 leading-relaxed">
              We believe in the power of ubiquitous AI to help humans engage in friendly, respectful debate. 
              In a world of echo chambers, B'right aims to bridge divides by finding harmony in conflict 
              and fostering understanding between opposing viewpoints.
            </Text>

            <Text className="text-slate-800 text-lg font-bold mb-3">Disclaimer</Text>
            <Text className="text-slate-600 mb-2 leading-relaxed">
              This application uses Artificial Intelligence to analyze topics and generate summaries. 
              While we strive for accuracy and neutrality, AI models can make mistakes or exhibit biases.
            </Text>
            <Text className="text-slate-600 leading-relaxed">
              Please use the insights provided as a starting point for your own critical thinking and verify important information independently.
            </Text>
          </ScrollView>

          <View className="p-4 border-t border-slate-100 bg-slate-50">
            <TouchableOpacity 
              onPress={onClose}
              className="bg-slate-800 py-3 rounded-xl"
            >
              <Text className="text-white text-center font-bold text-lg">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

