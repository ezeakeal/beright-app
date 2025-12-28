import React from "react";
import { View, Text, TouchableOpacity, Modal } from "react-native";
import { useAuth } from "../contexts/AuthContext";

interface LoginModalProps {
  visible: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ visible, onClose }) => {
  const { deviceId } = useAuth();

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/80">
        <View className="bg-black/95 border-t border-zinc-800/50 rounded-t-3xl p-6 pb-10"
              style={{ shadowColor: '#3b82f6', shadowOpacity: 0.2, shadowRadius: 30 }}>
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-2xl font-bold text-white/90">Device</Text>
            <TouchableOpacity onPress={onClose} className="p-2 border border-zinc-800/50 rounded-full">
              <Text className="text-zinc-400 font-bold">✕</Text>
            </TouchableOpacity>
          </View>

          <View>
            <Text className="text-zinc-400 text-base mb-4 leading-relaxed">
              Credits are tied to this device ID.
            </Text>

            <View className="bg-black/60 border border-zinc-800/50 p-4 rounded-xl mb-4">
              <Text className="text-xs text-zinc-500 font-bold uppercase mb-2">Device ID</Text>
              <Text className="text-white/90 font-mono text-sm">{deviceId ?? "Loading..."}</Text>
            </View>

            <View className="bg-amber-900/10 border border-amber-500/30 p-4 rounded-xl mb-6">
              <Text className="text-amber-200/90 font-bold mb-2">Important</Text>
              <Text className="text-amber-200/70 text-sm leading-relaxed">
                If you clear app storage or uninstall the app, you will lose this device ID and may lose access to purchased credits.
              </Text>
            </View>

            <TouchableOpacity onPress={onClose} className="border border-zinc-700/50 py-4 rounded-xl">
              <Text className="text-zinc-300 text-center font-bold text-lg">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

