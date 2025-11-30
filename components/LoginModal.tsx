import React from "react";
import { View, Text, TouchableOpacity, Image, Modal } from "react-native";
import { useAuth } from "../contexts/AuthContext";

interface LoginModalProps {
  visible: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ visible, onClose }) => {
  const { user, userTier, signInWithGoogle, signOut } = useAuth();

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
            <Text className="text-2xl font-bold text-white/90">Account</Text>
            <TouchableOpacity onPress={onClose} className="p-2 border border-zinc-800/50 rounded-full">
              <Text className="text-zinc-400 font-bold">✕</Text>
            </TouchableOpacity>
          </View>

          {user && !user.isAnonymous ? (
            <View>
              <View className="flex-row items-center mb-6 bg-black/60 border border-zinc-800/50 p-4 rounded-xl">
                {user.photoURL ? (
                  <Image source={{ uri: user.photoURL }} className="w-14 h-14 rounded-full mr-4" />
                ) : (
                  <View className="w-14 h-14 bg-blue-900/30 border border-blue-700/50 rounded-full justify-center items-center mr-4">
                    <Text className="text-blue-300/70 text-xl font-bold">{user.displayName?.charAt(0) || "U"}</Text>
                  </View>
                )}
                <View className="flex-1">
                  <Text className="text-lg font-bold text-white/90">{user.displayName}</Text>
                  <Text className="text-sm text-zinc-500">{user.email}</Text>
                </View>
              </View>

              <View className="flex-row items-center justify-between bg-black/40 border border-blue-900/40 p-4 rounded-xl mb-6"
                    style={{ shadowColor: '#3b82f6', shadowOpacity: 0.15, shadowRadius: 15 }}>
                <Text className="text-blue-300/70 font-medium text-base">Current Plan</Text>
                <View className="border border-blue-400/50 px-3 py-1 rounded-lg"
                      style={{ shadowColor: '#3b82f6', shadowOpacity: 0.2, shadowRadius: 10 }}>
                    <Text className="text-blue-300/80 font-bold capitalize">{userTier}</Text>
                </View>
              </View>

              <TouchableOpacity 
                onPress={() => { signOut(); onClose(); }}
                className="border border-zinc-700/50 py-4 rounded-xl"
              >
                <Text className="text-zinc-400 text-center font-bold text-lg">Sign Out</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Text className="text-zinc-400 text-base mb-6 leading-relaxed">
                Sign in to verify your subscription tier and access advanced AI models. 
                Your conversations remain private and are not stored on our servers.
              </Text>
              
              <TouchableOpacity 
                onPress={() => { signInWithGoogle(); onClose(); }}
                className="border border-zinc-700/50 py-4 rounded-xl flex-row justify-center items-center mb-3"
              >
                <Text className="text-zinc-300 text-center font-bold text-lg">Sign in with Google</Text>
              </TouchableOpacity>
              
              <Text className="text-center text-zinc-600 text-xs mt-4">
                We only use your email to verify your subscription status.
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

