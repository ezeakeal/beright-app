import "./global.css";
import React, { useState } from "react";
import { View, Text, TouchableOpacity, TextInput, ScrollView, Linking, Alert, BackHandler, AppState } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { SwirlingLoader } from "./components/SwirlingLoader";
import { InfoModal } from "./components/InfoModal";
import { LoginModal } from "./components/LoginModal";
import { ConversationListenerButton } from "./components/ConversationListenerButton";
import { PerspectiveInputModal } from "./components/PerspectiveInputModal";
import { analyzeConflictStaged, AnalysisResult, getRandomFruitPair, StageResult } from "./utils/gemini";
import { saveConversation, getPastConversations, StoredConversation } from "./utils/storage";
import Animated, { FadeIn, FadeInDown, useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import * as Speech from "expo-speech";
import sampleTopics from "./data/sampleTopics.json";
import { AuthProvider, useAuth } from "./contexts/AuthContext";

type ScreenState = "HOME" | "TOPIC" | "INPUT" | "ANALYZING" | "RESULTS" | "FOLLOWUP" | "HISTORY";
type Credits = {
  deviceId: string;
  today: string;
  paidCredits: number;
  freeAvailable: boolean;
  deviceFreeRemainingToday: number;
  freePoolRemaining: number;
  unitPriceCents: number;
  currency: string;
};

export default function App() {
  return (
    <AuthProvider>
        <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const [appState, setAppState] = useState<ScreenState>("HOME");
  const [topic, setTopic] = useState("");
  const [opinionA, setOpinionA] = useState("");
  const [opinionB, setOpinionB] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<StoredConversation[]>([]);
  const [showInfo, setShowInfo] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [editingPerspective, setEditingPerspective] = useState<"A" | "B" | null>(null);
  const { deviceId } = useAuth();

  const [fruitA, setFruitA] = useState<{ name: string; emoji: string } | null>(null);
  const [fruitB, setFruitB] = useState<{ name: string; emoji: string } | null>(null);

  // Stage tracking
  const [currentStage, setCurrentStage] = useState("");
  const [progress, setProgress] = useState(0);
  const [stageResults, setStageResults] = useState<StageResult[]>([]);

  // Follow-up tracking
  const [previousOpinionA, setPreviousOpinionA] = useState("");
  const [previousOpinionB, setPreviousOpinionB] = useState("");
  const [followUpA, setFollowUpA] = useState("");
  const [followUpB, setFollowUpB] = useState("");

  // Animated background fade during ANALYZING
  const analyzingFade = useSharedValue(0);
  const backgroundFadeStyle = useAnimatedStyle(() => {
    return {
      opacity: analyzingFade.value,
    };
  });

  const resolveRunId = React.useRef(0);
  const SERVER_URL = "https://beright-app-1021561698058.europe-west1.run.app";
  const [credits, setCredits] = useState<Credits | null>(null);
  const [creditsNonce, setCreditsNonce] = useState(0);

  React.useEffect(() => {
    analyzingFade.value = withTiming(appState === "ANALYZING" ? 0.6 : 0, { duration: 600 });
  }, [appState]);

  const stopAudio = () => {
    Speech.stop();
  };

  const goHome = () => {
    // Invalidate any in-flight analysis so it can't "pop" you back into RESULTS after backing out.
    resolveRunId.current += 1;
    stopAudio();
    setEditingPerspective(null);
    setAppState("HOME");
    setCreditsNonce((n) => n + 1);
  };

  const refreshCredits = React.useCallback(async () => {
    if (!deviceId) return;
    const res = await fetch(SERVER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Device-Id": deviceId,
      },
      body: JSON.stringify({ action: "credits" }),
    });
    const body = await res.text();
    if (!res.ok) {
      throw new Error(`Credits endpoint HTTP ${res.status} ${res.statusText}. Body: ${body}`);
    }
    const parsed = JSON.parse(body);
    setCredits(parsed.credits);
  }, [deviceId]);

  const startTopUp = React.useCallback(async () => {
    if (!deviceId) return;
    const res = await fetch(SERVER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Device-Id": deviceId,
      },
      body: JSON.stringify({ action: "createCheckoutSession" }),
    });
    const body = await res.text();
    if (!res.ok) {
      throw new Error(`Checkout session HTTP ${res.status} ${res.statusText}. Body: ${body}`);
    }
    const parsed = JSON.parse(body);
    await Linking.openURL(parsed.url);
  }, [deviceId]);

  React.useEffect(() => {
    refreshCredits();
  }, [refreshCredits, creditsNonce]);

  React.useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        refreshCredits();
      }
    });
    return () => sub.remove();
  }, [refreshCredits]);

  React.useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      // Close transient UI first.
      if (showInfo) {
        setShowInfo(false);
        return true;
      }
      if (showLogin) {
        setShowLogin(false);
        return true;
      }
      if (editingPerspective) {
        setEditingPerspective(null);
        return true;
      }

      // From any non-home "screen", back returns to HOME (instead of exiting the app).
      if (appState !== "HOME") {
        goHome();
        return true;
      }

      // On HOME, allow default OS behavior (exit / minimize).
      return false;
    });

    return () => sub.remove();
  }, [appState, editingPerspective, showInfo, showLogin]);

  const startNewConversation = () => {
    setTopic("");
    setOpinionA("");
    setOpinionB("");
    setResult(null);
    setFruitA(null);
    setFruitB(null);
    setStageResults([]);
    setAppState("TOPIC");
  };

  const openHistory = async () => {
    const past = await getPastConversations();
    setHistory(past);
    setAppState("HISTORY");
  };

  const loadConversation = (conv: StoredConversation) => {
    setTopic(conv.topic);
    setOpinionA(conv.opinionA);
    setOpinionB(conv.opinionB);
    setFruitA(conv.fruitA);
    setFruitB(conv.fruitB);
    setResult(conv.result);
    setAppState("RESULTS");
  };

  const handleTopicSubmit = () => {
    if (topic.trim()) {
      const [fA, fB] = getRandomFruitPair();
      setFruitA(fA);
      setFruitB(fB);
      setAppState("INPUT");
    }
  };

  const loadSampleTopic = (topicName: string, perspectives: [string, string]) => {
    setTopic(topicName);
    setOpinionA(perspectives[0]);
    setOpinionB(perspectives[1]);
    const [fA, fB] = getRandomFruitPair();
    setFruitA(fA);
    setFruitB(fB);
    setAppState("INPUT");
  };

  const handleFollowUp = () => {
    setPreviousOpinionA(opinionA);
    setPreviousOpinionB(opinionB);
    setFollowUpA("");
    setFollowUpB("");
    setAppState("FOLLOWUP");
  };

  const handleResolve = async () => {
    if (!opinionA.trim() || !opinionB.trim() || !fruitA || !fruitB) return;
    const myRunId = ++resolveRunId.current;
    setAppState("ANALYZING");
    setStageResults([]);

    try {
      // Combine previous and follow-up opinions if in follow-up mode
      const finalOpinionA = previousOpinionA
        ? `${previousOpinionA}\n\nAdditional context: ${followUpA}`
        : opinionA;
      const finalOpinionB = previousOpinionB
        ? `${previousOpinionB}\n\nAdditional context: ${followUpB}`
        : opinionB;

      const analysis = await analyzeConflictStaged(
        topic,
        finalOpinionA,
        finalOpinionB,
        fruitA,
        fruitB,
        (stage, prog, stageResult) => {
          if (resolveRunId.current !== myRunId) return;
          setCurrentStage(stage);
          setProgress(prog);

          if (stageResult) {
            setStageResults(prev => [...prev, stageResult]);
            // Narrate the one-line summary
            Speech.speak(stageResult.oneLineSummary, {
              rate: 0.85,
              pitch: 1.05,
              language: 'en-US'
            });
          }
        },
        previousOpinionA && result ? result : undefined // Pass previous analysis if this is a follow-up
      );

      if (resolveRunId.current !== myRunId) return;
      setResult(analysis);
      
      // Save to history
      await saveConversation({
        topic,
        opinionA: finalOpinionA,
        opinionB: finalOpinionB,
        result: analysis,
        fruitA: fruitA!,
        fruitB: fruitB!
      });

      if (resolveRunId.current !== myRunId) return;
      setAppState("RESULTS");

      // Final narration
      setTimeout(() => {
        if (resolveRunId.current !== myRunId) return;
        Speech.speak(analysis.narration, {
          rate: 0.85,
          pitch: 1.05,
          language: 'en-US'
        });
      }, 1000);

    } catch (error: any) {
      console.error(error);
      if (error.message === "NO_CREDITS") {
        Alert.alert(
          "No Requests Available",
          "You have no free requests available and your paid balance is 0. Please top up to continue.",
          [{ text: "Top up", onPress: startTopUp }, { text: "Cancel", style: "cancel" }]
        );
        setAppState("INPUT");
        return;
      }
      if (error.message === "RATE_LIMIT_EXCEEDED") {
        Alert.alert(
          "Too Many Requests",
          "We are experiencing high traffic. Please try again in a moment.",
          [{ text: "OK" }]
        );
      } else {
        Alert.alert("Error", "Something went wrong. Please try again.");
      }
      setAppState("INPUT");
    }
  };

  return (
    <SafeAreaProvider>
      <LinearGradient
        colors={['#000000', '#0a0a1a', '#050510', '#000000']}
        locations={[0, 0.3, 0.7, 1]}
        className="flex-1"
      >
        <Animated.View className="flex-1 bg-black/40" style={backgroundFadeStyle} pointerEvents="none" />
        <View className="flex-1 absolute inset-0">
          <SafeAreaView className="flex-1">
            <StatusBar style="light" />

            {appState === "HOME" && (
              <Animated.View entering={FadeIn} className="flex-1 justify-center items-center p-6 relative">
                <View className="absolute top-0 right-6" style={{ zIndex: 50 }}>
                  <TouchableOpacity
                    onPress={() => setShowInfo(true)}
                    className="p-2 border border-zinc-700/50 rounded-full"
                    style={{ shadowColor: '#ffffff', shadowOpacity: 0.1, shadowRadius: 10 }}
                  >
                    <Text className="text-zinc-400 font-bold text-lg">Info ⓘ</Text>
                  </TouchableOpacity>
                </View>

                <Text className="text-5xl font-bold text-white/90 mb-2 text-center">B'right</Text>
                <Text className="text-xl text-zinc-400 mb-12 text-center">Find harmony in conflict.</Text>

                <View className="w-full max-w-[420px] bg-black/60 border border-zinc-800/50 p-5 rounded-3xl mb-8"
                      style={{ shadowColor: '#3b82f6', shadowOpacity: 0.06, shadowRadius: 18 }}>
                  <Text className="text-zinc-500 font-bold uppercase tracking-widest text-xs mb-2">Requests</Text>
                  {credits ? (
                    <>
                      <Text className={`text-lg font-bold ${credits.freeAvailable ? 'text-emerald-200/90' : 'text-amber-200/90'}`}>
                        {credits.freeAvailable ? "Free request available today" : "No free requests available"}
                      </Text>
                      <Text className="text-zinc-400 mt-1">
                        Paid balance: <Text className="text-white/80 font-bold">{credits.paidCredits}</Text>
                      </Text>
                      {!credits.freeAvailable && credits.paidCredits === 0 && (
                        <TouchableOpacity
                          onPress={startTopUp}
                          className="mt-4 border-2 border-amber-500/70 px-6 py-4 rounded-2xl"
                          style={{
                            shadowColor: '#f59e0b',
                            shadowOpacity: 0.35,
                            shadowRadius: 18,
                            backgroundColor: 'rgba(245, 158, 11, 0.12)',
                          }}
                        >
                          <Text className="text-amber-200 text-center font-bold text-lg">
                            Top up (€0.20 / request)
                          </Text>
                        </TouchableOpacity>
                      )}
                      {credits.freePoolRemaining === 0 && (
                        <Text className="text-zinc-500 text-xs mt-3">
                          Free pool exhausted (100 total). Top up required.
                        </Text>
                      )}
                    </>
                  ) : (
                    <Text className="text-zinc-500">Loading…</Text>
                  )}
                </View>

                <TouchableOpacity
                  onPress={startNewConversation}
                  className="border-2 border-blue-500 px-10 py-6 rounded-full active:scale-95 transform transition mb-4"
                  style={{ 
                    shadowColor: '#3b82f6', 
                    shadowOpacity: 0.6, 
                    shadowRadius: 25,
                    backgroundColor: 'rgba(59, 130, 246, 0.15)'
                  }}
                >
                  <Text className="text-white text-2xl font-bold">New Conversation</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={openHistory}
                  className="border-2 border-purple-500/70 px-8 py-4 rounded-full active:scale-95 transform transition mb-8"
                  style={{ 
                    shadowColor: '#a855f7', 
                    shadowOpacity: 0.4, 
                    shadowRadius: 20,
                    backgroundColor: 'rgba(168, 85, 247, 0.1)'
                  }}
                >
                  <Text className="text-purple-300 text-lg font-bold">Past Conversations</Text>
                </TouchableOpacity>

                {/* Login Status Button */}
                <TouchableOpacity
                  onPress={() => setShowLogin(true)}
                  className="border border-zinc-800/50 px-6 py-3 rounded-full flex-row items-center"
                  style={{ shadowColor: '#ffffff', shadowOpacity: 0.03, shadowRadius: 10 }}
                >
                  <View className="w-3 h-3 rounded-full mr-2 bg-zinc-600" />
                  <Text className="text-zinc-500 font-medium">
                    {deviceId ? `Device: ${deviceId.slice(0, 8)}…` : "Device: Loading…"}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            )}

            {appState === "HISTORY" && (
              <Animated.View entering={FadeIn} className="flex-1 p-6 pt-12">
                <View className="flex-row items-center mb-6">
                  <TouchableOpacity onPress={goHome} className="mr-4 p-2 border border-zinc-700/50 rounded-full">
                    <Text className="text-2xl text-white/70">←</Text>
                  </TouchableOpacity>
                  <Text className="text-3xl font-bold text-white/90">Past Conversations</Text>
                </View>

                <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                  {history.length === 0 ? (
                    <Text className="text-zinc-500 text-center mt-10 italic">No past conversations found.</Text>
                  ) : (
                    history.map((conv) => (
                      <TouchableOpacity
                        key={conv.id}
                        onPress={() => loadConversation(conv)}
                        className="bg-black/60 border border-zinc-800/50 p-5 rounded-2xl mb-3"
                        style={{ shadowColor: '#3b82f6', shadowOpacity: 0.05, shadowRadius: 15 }}
                      >
                        <View className="flex-row justify-between items-start mb-2">
                          <Text className="text-lg font-bold text-white/90 flex-1 mr-2">{conv.topic}</Text>
                          <Text className="text-xs text-zinc-600 mt-1">{new Date(conv.timestamp).toLocaleDateString()}</Text>
                        </View>
                        <Text className="text-sm text-zinc-400 mb-1 numberOfLines={2}">
                          Harmony between {conv.fruitA.name} & {conv.fruitB.name}
                        </Text>
                        <Text className="text-xs text-blue-300/70 font-medium italic mt-2">
                          Tap to view summary →
                        </Text>
                      </TouchableOpacity>
                    ))
                  )}
                  <View className="h-10" />
                </ScrollView>
              </Animated.View>
            )}

            {appState === "TOPIC" && (
              <Animated.View entering={FadeIn} className="flex-1 p-6">
                <View className="flex-row items-center mb-4">
                  <TouchableOpacity onPress={goHome} className="mr-4 p-2 border border-zinc-700/50 rounded-full">
                    <Text className="text-2xl text-white/70">←</Text>
                  </TouchableOpacity>
                  <View className="flex-1 pr-10">
                    <Text className="text-3xl font-bold text-white/90 text-center">What is the topic?</Text>
                  </View>
                </View>
                
                {/* Listen In Feature */}
                <ConversationListenerButton
                  onConversationExtracted={(data) => {
                    // Auto-fill the form
                    setTopic(data.topic);
                    setOpinionA(data.viewpointA);
                    setOpinionB(data.viewpointB);
                    
                    const [fA, fB] = getRandomFruitPair();
                    setFruitA(fA);
                    setFruitB(fB);
                    
                    // Show a confirmation and go to INPUT with pre-filled data
                    setAppState("INPUT");
                    
                    Alert.alert(
                      'Conversation Extracted! ✨',
                      `Topic: ${data.topic}\n\nReview and edit the viewpoints if needed.`,
                      [{ text: 'Review', style: 'default' }]
                    );
                  }}
                />
                
                {/* Divider */}
                <View className="flex-row items-center my-6">
                  <View className="flex-1 h-px bg-zinc-800" />
                  <Text className="mx-4 text-zinc-600 font-medium">OR</Text>
                  <View className="flex-1 h-px bg-zinc-800" />
                </View>
                
                <TextInput
                  className="bg-black/60 border border-zinc-800/50 p-6 rounded-3xl text-2xl text-center text-white/90"
                  placeholder="e.g., Climate Change"
                  placeholderTextColor="#52525b"
                  value={topic}
                  onChangeText={setTopic}
                  onSubmitEditing={handleTopicSubmit}
                  returnKeyType="next"
                />
                <TouchableOpacity
                  onPress={handleTopicSubmit}
                  className="mt-4 border-2 border-cyan-500 self-center px-8 py-4 rounded-full"
                  style={{ 
                    shadowColor: '#06b6d4', 
                    shadowOpacity: 0.5, 
                    shadowRadius: 20,
                    backgroundColor: 'rgba(6, 182, 212, 0.15)'
                  }}
                >
                  <Text className="text-cyan-200 font-bold text-lg">Next</Text>
                </TouchableOpacity>

                {/* Sample Topics */}
                <Text className="text-center text-zinc-400 mt-8 mb-4 font-medium">Or choose a sample topic:</Text>
                <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                  {Object.entries(sampleTopics).map(([topicName, perspectives]) => (
                    <TouchableOpacity
                      key={topicName}
                      onPress={() => loadSampleTopic(topicName, perspectives as [string, string])}
                      className="bg-black/60 border border-zinc-800/50 p-4 rounded-2xl mb-3"
                    >
                      <Text className="text-lg font-bold text-white/90 mb-1">{topicName}</Text>
                      <Text className="text-xs text-zinc-500">• {(perspectives as [string, string])[0]}</Text>
                      <Text className="text-xs text-zinc-500">• {(perspectives as [string, string])[1]}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </Animated.View>
            )}

            {appState === "INPUT" && fruitA && fruitB && (
              <View className="flex-1 relative">
                {/* Top half - Perspective A (rotated) */}
                <View className="flex-1 rotate-180 p-4 justify-center items-center">
                  <TouchableOpacity
                    onPress={() => setEditingPerspective("A")}
                    className="bg-black/70 border-2 border-purple-500/40 rounded-3xl p-10 items-center justify-center active:scale-95"
                    style={{ 
                      shadowColor: '#a855f7', 
                      shadowOpacity: 0.3, 
                      shadowRadius: 30,
                      minWidth: 280,
                      minHeight: 280
                    }}
                  >
                    <Text style={{ fontSize: 120 }}>{fruitA.emoji}</Text>
                    <Text className="text-2xl font-bold text-purple-300/70 mt-4 text-center">
                      {fruitA.name}
                    </Text>
                    {opinionA.trim() && (
                      <View className="mt-4 bg-purple-900/20 px-4 py-2 rounded-full">
                        <Text className="text-purple-300/60 text-sm">✓ Perspective Added</Text>
                      </View>
                    )}
                    <Text className="text-zinc-500 text-sm mt-3 text-center">
                      Tap to {opinionA.trim() ? 'edit' : 'add'} perspective
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Center button */}
                <View className="absolute top-1/2 left-0 right-0 -mt-8 items-center z-10">
                  <TouchableOpacity
                    onPress={handleResolve}
                    disabled={!opinionA.trim() || !opinionB.trim()}
                    className="border-3 border-emerald-500 bg-black/50 px-8 py-4 rounded-full disabled:opacity-40"
                    style={{ 
                      shadowColor: '#10b981', 
                      shadowOpacity: 0.7, 
                      shadowRadius: 30,
                      backgroundColor: 'rgba(16, 185, 129, 0.2)',
                      borderWidth: 3
                    }}
                  >
                    <Text className="text-emerald-200 font-bold text-lg tracking-wider">ALL RIGHT</Text>
                  </TouchableOpacity>
                </View>

                {/* Bottom half - Perspective B */}
                <View className="flex-1 p-4 justify-center items-center">
                  <TouchableOpacity
                    onPress={() => setEditingPerspective("B")}
                    className="bg-black/70 border-2 border-cyan-500/40 rounded-3xl p-10 items-center justify-center active:scale-95"
                    style={{ 
                      shadowColor: '#22d3ee', 
                      shadowOpacity: 0.3, 
                      shadowRadius: 30,
                      minWidth: 280,
                      minHeight: 280
                    }}
                  >
                    <Text style={{ fontSize: 120 }}>{fruitB.emoji}</Text>
                    <Text className="text-2xl font-bold text-cyan-300/70 mt-4 text-center">
                      {fruitB.name}
                    </Text>
                    {opinionB.trim() && (
                      <View className="mt-4 bg-cyan-900/20 px-4 py-2 rounded-full">
                        <Text className="text-cyan-300/60 text-sm">✓ Perspective Added</Text>
                      </View>
                    )}
                    <Text className="text-zinc-500 text-sm mt-3 text-center">
                      Tap to {opinionB.trim() ? 'edit' : 'add'} perspective
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Modals */}
                <PerspectiveInputModal
                  visible={editingPerspective === "A"}
                  emoji={fruitA.emoji}
                  fruitName={fruitA.name}
                  color="purple"
                  initialValue={opinionA}
                  onSave={setOpinionA}
                  onClose={() => setEditingPerspective(null)}
                />
                <PerspectiveInputModal
                  visible={editingPerspective === "B"}
                  emoji={fruitB.emoji}
                  fruitName={fruitB.name}
                  color="cyan"
                  initialValue={opinionB}
                  onSave={setOpinionB}
                  onClose={() => setEditingPerspective(null)}
                />
              </View>
            )}

            {appState === "ANALYZING" && (
              <View className="flex-1">
                <SwirlingLoader />
                {/* Top status + progress (kept above everything) */}
                <View className="absolute top-0 left-0 right-0 p-6 pt-28 z-[100]" style={{ zIndex: 9999, elevation: 50 }}>
                  <Text className="text-center text-white/90 font-bold text-xl mb-2">{currentStage}</Text>
                  <View className="bg-white/10 border border-white/20 h-2 rounded-full overflow-hidden">
                    <View className="bg-blue-400/70 h-full" style={{ width: `${progress * 100}%`, shadowColor: '#3b82f6', shadowOpacity: 0.5, shadowRadius: 10 }} />
                  </View>
                </View>

                {/* Stage result cards below header */}
                <ScrollView className="flex-1 px-6 pt-56 pb-6" showsVerticalScrollIndicator={false}>
                  {stageResults.map((stage, idx) => (
                    <Animated.View
                      key={idx}
                      entering={FadeInDown.delay(200)}
                      className="bg-black/40 border border-zinc-800/50 rounded-xl p-5 mb-4"
                    >
                      <Text className="text-blue-300/70 font-bold text-lg mb-2">{stage.stageName}</Text>
                      <Text className="text-sm text-white/80 italic mb-3 font-medium">{stage.oneLineSummary}</Text>
                      {stage.summaryBullets.map((bullet, i) => (
                        <Text key={i} className="text-sm text-zinc-400 mb-1 leading-relaxed">• {bullet}</Text>
                      ))}
                    </Animated.View>
                  ))}
                </ScrollView>
              </View>
            )}

            {appState === "FOLLOWUP" && fruitA && fruitB && (
              <View className="flex-1 relative">
                {/* Top half - Perspective A (rotated) */}
                <View className="flex-1 rotate-180 p-4 justify-center items-center">
                  <TouchableOpacity
                    onPress={() => setEditingPerspective("A")}
                    className="bg-black/70 border-2 border-purple-500/40 rounded-3xl p-10 items-center justify-center active:scale-95"
                    style={{ 
                      shadowColor: '#a855f7', 
                      shadowOpacity: 0.3, 
                      shadowRadius: 30,
                      minWidth: 280,
                      minHeight: 280
                    }}
                  >
                    <Text style={{ fontSize: 120 }}>{fruitA.emoji}</Text>
                    <Text className="text-2xl font-bold text-purple-300/70 mt-4 text-center">
                      {fruitA.name}
                    </Text>
                    <Text className="text-sm text-purple-400/60 mt-2 text-center">
                      Add More Details
                    </Text>
                    {followUpA.trim() && (
                      <View className="mt-4 bg-purple-900/20 px-4 py-2 rounded-full">
                        <Text className="text-purple-300/60 text-sm">✓ Details Added</Text>
                      </View>
                    )}
                    <Text className="text-zinc-500 text-sm mt-3 text-center">
                      Tap to {followUpA.trim() ? 'edit' : 'add'} context
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Center button */}
                <View className="absolute top-1/2 left-0 right-0 -mt-8 items-center z-10">
                  <TouchableOpacity
                    onPress={() => {
                      setOpinionA(previousOpinionA + "\n\nAdditional context: " + followUpA);
                      setOpinionB(previousOpinionB + "\n\nAdditional context: " + followUpB);
                      handleResolve();
                    }}
                    className="border-3 border-amber-500 bg-black/50 px-8 py-4 rounded-full"
                    style={{ 
                      shadowColor: '#f59e0b', 
                      shadowOpacity: 0.7, 
                      shadowRadius: 30,
                      backgroundColor: 'rgba(245, 158, 11, 0.2)',
                      borderWidth: 3
                    }}
                  >
                    <Text className="text-amber-200 font-bold text-lg tracking-wider">CONTINUE</Text>
                  </TouchableOpacity>
                </View>

                {/* Bottom half - Perspective B */}
                <View className="flex-1 p-4 justify-center items-center">
                  <TouchableOpacity
                    onPress={() => setEditingPerspective("B")}
                    className="bg-black/70 border-2 border-cyan-500/40 rounded-3xl p-10 items-center justify-center active:scale-95"
                    style={{ 
                      shadowColor: '#22d3ee', 
                      shadowOpacity: 0.3, 
                      shadowRadius: 30,
                      minWidth: 280,
                      minHeight: 280
                    }}
                  >
                    <Text style={{ fontSize: 120 }}>{fruitB.emoji}</Text>
                    <Text className="text-2xl font-bold text-cyan-300/70 mt-4 text-center">
                      {fruitB.name}
                    </Text>
                    <Text className="text-sm text-cyan-400/60 mt-2 text-center">
                      Add More Details
                    </Text>
                    {followUpB.trim() && (
                      <View className="mt-4 bg-cyan-900/20 px-4 py-2 rounded-full">
                        <Text className="text-cyan-300/60 text-sm">✓ Details Added</Text>
                      </View>
                    )}
                    <Text className="text-zinc-500 text-sm mt-3 text-center">
                      Tap to {followUpB.trim() ? 'edit' : 'add'} context
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Modals */}
                <PerspectiveInputModal
                  visible={editingPerspective === "A"}
                  emoji={fruitA.emoji}
                  fruitName={fruitA.name}
                  color="purple"
                  initialValue={followUpA}
                  onSave={setFollowUpA}
                  onClose={() => setEditingPerspective(null)}
                />
                <PerspectiveInputModal
                  visible={editingPerspective === "B"}
                  emoji={fruitB.emoji}
                  fruitName={fruitB.name}
                  color="cyan"
                  initialValue={followUpB}
                  onSave={setFollowUpB}
                  onClose={() => setEditingPerspective(null)}
                />
              </View>
            )}

            {appState === "RESULTS" && result && (
              <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                <Animated.View entering={FadeIn.delay(300)} className="p-6">
                  {/* Final Summary Card */}
                  <View className="bg-black/80 border border-zinc-800/50 rounded-3xl p-6 mb-6"
                        style={{ shadowColor: '#3b82f6', shadowOpacity: 0.1, shadowRadius: 25 }}>
                    <Text className="text-center text-zinc-600 font-medium uppercase tracking-widest text-xs mb-1">Topic</Text>
                    <Text className="text-center text-2xl font-bold text-blue-300/70 mb-4">{result.topic}</Text>

                    {result.summaryBullets.map((bullet, i) => (
                      <Text key={i} className="text-base text-white/80 leading-relaxed font-medium mb-2">
                        • {bullet}
                      </Text>
                    ))}

                    <Text className="text-sm text-zinc-400 italic mt-4 leading-relaxed">
                      {result.narration}
                    </Text>

                    {/* Summary Links */}
                    {result.summaryLinks.length > 0 && (
                      <View className="mt-4">
                        <Text className="text-xs text-zinc-600 font-bold uppercase mb-2">Related Reading</Text>
                        {result.summaryLinks.map((link, i) => (
                          <TouchableOpacity
                            key={i}
                            onPress={() => Linking.openURL(link.url)}
                            className="mb-2"
                          >
                            <Text className="text-sm text-blue-300/70 underline">{link.title}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    <View className="flex-row justify-center space-x-4 mt-4">
                      <TouchableOpacity
                        onPress={() => Speech.speak(result.narration, { rate: 0.85, pitch: 1.05, language: 'en-US' })}
                        className="border-2 border-blue-500 px-6 py-2 rounded-full"
                        style={{ 
                          shadowColor: '#3b82f6', 
                          shadowOpacity: 0.5, 
                          shadowRadius: 20,
                          backgroundColor: 'rgba(59, 130, 246, 0.15)'
                        }}
                      >
                        <Text className="text-blue-200 font-bold">🔊 Play</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        onPress={stopAudio} 
                        className="border-2 border-zinc-600 px-6 py-2 rounded-full"
                        style={{ 
                          shadowColor: '#71717a', 
                          shadowOpacity: 0.3, 
                          shadowRadius: 15,
                          backgroundColor: 'rgba(113, 113, 122, 0.1)'
                        }}
                      >
                        <Text className="text-zinc-300 font-bold">Stop</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Fruit Perspectives Side-by-Side */}
                  <View className="flex-row justify-between mb-6">
                    <Animated.View entering={FadeInDown.delay(500)} className="w-[48%] bg-black/70 border border-purple-900/40 p-5 rounded-2xl"
                                   style={{ shadowColor: '#a855f7', shadowOpacity: 0.15, shadowRadius: 20 }}>
                      <Text className="text-xl font-bold text-purple-300/70 mb-3">{result.perspectiveALabel}</Text>
                      {result.perspectiveABullets.map((bullet, i) => (
                        <Text key={i} className="text-sm text-zinc-300 mb-2 leading-snug">• {bullet}</Text>
                      ))}
                      {result.perspectiveALinks.length > 0 && (
                        <View className="mt-3">
                          <Text className="text-xs text-zinc-500 font-bold mb-1">Links</Text>
                          {result.perspectiveALinks.map((link, i) => (
                            <TouchableOpacity
                              key={i}
                              onPress={() => Linking.openURL(link.url)}
                              className="mb-1"
                            >
                              <Text className="text-xs text-purple-300/70 underline">{link.title}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </Animated.View>

                    <Animated.View entering={FadeInDown.delay(500)} className="w-[48%] bg-black/70 border border-cyan-900/40 p-5 rounded-2xl"
                                   style={{ shadowColor: '#22d3ee', shadowOpacity: 0.15, shadowRadius: 20 }}>
                      <Text className="text-xl font-bold text-cyan-300/70 mb-3">{result.perspectiveBLabel}</Text>
                      {result.perspectiveBBullets.map((bullet, i) => (
                        <Text key={i} className="text-sm text-zinc-300 mb-2 leading-snug">• {bullet}</Text>
                      ))}
                      {result.perspectiveBLinks.length > 0 && (
                        <View className="mt-3">
                          <Text className="text-xs text-zinc-500 font-bold mb-1">Links</Text>
                          {result.perspectiveBLinks.map((link, i) => (
                            <TouchableOpacity
                              key={i}
                              onPress={() => Linking.openURL(link.url)}
                              className="mb-1"
                            >
                              <Text className="text-xs text-cyan-300/70 underline">{link.title}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </Animated.View>
                  </View>

                  {/* Action Buttons */}
                  <View className="flex-row justify-between mb-8 space-x-3">
                    <TouchableOpacity
                      onPress={handleFollowUp}
                      className="flex-1 border-2 border-indigo-500 py-4 rounded-2xl"
                      style={{ 
                        shadowColor: '#6366f1', 
                        shadowOpacity: 0.5, 
                        shadowRadius: 20,
                        backgroundColor: 'rgba(99, 102, 241, 0.15)'
                      }}
                    >
                      <Text className="text-indigo-200 text-center font-bold text-lg">Follow Up</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => { stopAudio(); setAppState("HOME"); }}
                      className="flex-1 border-2 border-zinc-600 py-4 rounded-2xl"
                      style={{ 
                        shadowColor: '#71717a', 
                        shadowOpacity: 0.3, 
                        shadowRadius: 15,
                        backgroundColor: 'rgba(113, 113, 122, 0.1)'
                      }}
                    >
                      <Text className="text-zinc-300 text-center font-bold text-lg">Start Over</Text>
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              </ScrollView>
            )}
          </SafeAreaView>
        </View>
        <InfoModal visible={showInfo} onClose={() => setShowInfo(false)} />
        <LoginModal visible={showLogin} onClose={() => setShowLogin(false)} />
      </LinearGradient>
    </SafeAreaProvider>
  );
}
