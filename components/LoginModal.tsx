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
      <View className="flex-1 justify-end bg-black/50">
        <View className="bg-white rounded-t-3xl p-6 pb-10 shadow-2xl">
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-2xl font-bold text-slate-800">Account</Text>
            <TouchableOpacity onPress={onClose} className="p-2 bg-slate-100 rounded-full">
              <Text className="text-slate-600 font-bold">✕</Text>
            </TouchableOpacity>
          </View>

          {user && !user.isAnonymous ? (
            <View>
              <View className="flex-row items-center mb-6 bg-slate-50 p-4 rounded-xl">
                {user.photoURL ? (
                  <Image source={{ uri: user.photoURL }} className="w-14 h-14 rounded-full mr-4" />
                ) : (
                  <View className="w-14 h-14 bg-indigo-100 rounded-full justify-center items-center mr-4">
                    <Text className="text-indigo-600 text-xl font-bold">{user.displayName?.charAt(0) || "U"}</Text>
                  </View>
                )}
                <View className="flex-1">
                  <Text className="text-lg font-bold text-slate-800">{user.displayName}</Text>
                  <Text className="text-sm text-slate-500">{user.email}</Text>
                </View>
              </View>

              <View className="flex-row items-center justify-between bg-indigo-50 p-4 rounded-xl mb-6 border border-indigo-100">
                <Text className="text-indigo-800 font-medium text-base">Current Plan</Text>
                <View className="bg-indigo-200 px-3 py-1 rounded-lg">
                    <Text className="text-indigo-800 font-bold capitalize">{userTier}</Text>
                </View>
              </View>

              <TouchableOpacity 
                onPress={() => { signOut(); onClose(); }}
                className="bg-slate-200 py-4 rounded-xl"
              >
                <Text className="text-slate-700 text-center font-bold text-lg">Sign Out</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Text className="text-slate-600 text-base mb-6 leading-relaxed">
                Sign in to verify your subscription tier and access advanced AI models. 
                Your conversations remain private and are not stored on our servers.
              </Text>
              
              <TouchableOpacity 
                onPress={() => { signInWithGoogle(); onClose(); }}
                className="bg-white border border-slate-300 py-4 rounded-xl flex-row justify-center items-center mb-3 shadow-sm"
              >
                <Text className="text-slate-700 text-center font-bold text-lg">Sign in with Google</Text>
              </TouchableOpacity>
              
              <Text className="text-center text-slate-400 text-xs mt-4">
                We only use your email to verify your subscription status.
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

