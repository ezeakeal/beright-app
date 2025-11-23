import "./global.css";
import React, { useState } from "react";
import { View, Text, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView, ImageBackground, Linking } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { SwirlingLoader } from "./components/SwirlingLoader";
import { analyzeConflictStaged, AnalysisResult, getRandomFruitPair, StageResult } from "./utils/gemini";
import { saveConversation, getPastConversations, StoredConversation } from "./utils/storage";
import Animated, { FadeIn, FadeInDown, useSharedValue, useAnimatedStyle, withTiming, interpolateColor } from "react-native-reanimated";
import * as Speech from "expo-speech";
import sampleTopics from "./data/sampleTopics.json";

type AppState = "HOME" | "TOPIC" | "INPUT" | "ANALYZING" | "RESULTS" | "FOLLOWUP" | "HISTORY";

export default function App() {
  const [appState, setAppState] = useState<AppState>("HOME");
  const [topic, setTopic] = useState("");
  const [opinionA, setOpinionA] = useState("");
  const [opinionB, setOpinionB] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<StoredConversation[]>([]);

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
      backgroundColor: interpolateColor(
        analyzingFade.value,
        [0, 1],
        ["rgba(255,255,255,0.30)", "rgba(2,6,23,0.45)"] // from light veil to dim slate
      ),
    };
  });

  React.useEffect(() => {
    analyzingFade.value = withTiming(appState === "ANALYZING" ? 1 : 0, { duration: 400 });
  }, [appState]);

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

      setAppState("RESULTS");

      // Final narration
      setTimeout(() => {
        Speech.speak(analysis.narration, {
          rate: 0.85,
          pitch: 1.05,
          language: 'en-US'
        });
      }, 1000);

    } catch (error) {
      console.error(error);
      setAppState("INPUT");
    }
  };

  const stopAudio = () => {
    Speech.stop();
  };

  return (
    <SafeAreaProvider>
      <ImageBackground
        source={{ uri: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=2070&auto=format&fit=crop" }}
        className="flex-1"
        blurRadius={Platform.OS === 'ios' ? 20 : 5}
      >
        <Animated.View className="flex-1" style={backgroundFadeStyle}>
          <SafeAreaView className="flex-1">
            <StatusBar style="dark" />

            {appState === "HOME" && (
              <Animated.View entering={FadeIn} className="flex-1 justify-center items-center p-6">
                <Text className="text-5xl font-bold text-slate-800 mb-2 text-center">B'right</Text>
                <Text className="text-xl text-slate-600 mb-12 text-center">Find harmony in conflict.</Text>

                <TouchableOpacity
                  onPress={startNewConversation}
                  className="bg-indigo-600 px-10 py-6 rounded-full shadow-xl active:scale-95 transform transition mb-4"
                >
                  <Text className="text-white text-2xl font-bold">New Conversation</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={openHistory}
                  className="bg-white/80 px-8 py-4 rounded-full shadow-sm active:scale-95 transform transition border border-slate-200"
                >
                  <Text className="text-slate-700 text-lg font-bold">Past Conversations</Text>
                </TouchableOpacity>
              </Animated.View>
            )}

            {appState === "HISTORY" && (
              <Animated.View entering={FadeIn} className="flex-1 p-6 pt-12">
                <View className="flex-row items-center mb-6">
                  <TouchableOpacity onPress={() => setAppState("HOME")} className="mr-4 p-2 bg-white/50 rounded-full">
                    <Text className="text-2xl">←</Text>
                  </TouchableOpacity>
                  <Text className="text-3xl font-bold text-slate-800">Past Conversations</Text>
                </View>

                <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                  {history.length === 0 ? (
                    <Text className="text-slate-500 text-center mt-10 italic">No past conversations found.</Text>
                  ) : (
                    history.map((conv) => (
                      <TouchableOpacity
                        key={conv.id}
                        onPress={() => loadConversation(conv)}
                        className="bg-white/70 p-5 rounded-2xl mb-3 border border-white/50 shadow-sm"
                      >
                        <View className="flex-row justify-between items-start mb-2">
                          <Text className="text-lg font-bold text-slate-800 flex-1 mr-2">{conv.topic}</Text>
                          <Text className="text-xs text-slate-500 mt-1">{new Date(conv.timestamp).toLocaleDateString()}</Text>
                        </View>
                        <Text className="text-sm text-slate-600 mb-1 numberOfLines={2}">
                          Harmony between {conv.fruitA.name} & {conv.fruitB.name}
                        </Text>
                        <Text className="text-xs text-indigo-600 font-medium italic mt-2">
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
                <Text className="text-3xl font-bold text-slate-800 mb-4 text-center">What is the topic?</Text>
                <TextInput
                  className="bg-white/80 p-6 rounded-3xl text-2xl text-center shadow-sm border border-white/50"
                  placeholder="e.g., Climate Change"
                  value={topic}
                  onChangeText={setTopic}
                  autoFocus
                  onSubmitEditing={handleTopicSubmit}
                  returnKeyType="next"
                />
                <TouchableOpacity
                  onPress={handleTopicSubmit}
                  className="mt-4 bg-slate-800 self-center px-8 py-4 rounded-full"
                >
                  <Text className="text-white font-bold text-lg">Next</Text>
                </TouchableOpacity>

                {/* Sample Topics */}
                <Text className="text-center text-slate-600 mt-8 mb-4 font-medium">Or choose a sample topic:</Text>
                <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                  {Object.entries(sampleTopics).map(([topicName, perspectives]) => (
                    <TouchableOpacity
                      key={topicName}
                      onPress={() => loadSampleTopic(topicName, perspectives as [string, string])}
                      className="bg-white/70 p-4 rounded-2xl mb-3 border border-white/50"
                    >
                      <Text className="text-lg font-bold text-slate-800 mb-1">{topicName}</Text>
                      <Text className="text-xs text-slate-600">• {(perspectives as [string, string])[0]}</Text>
                      <Text className="text-xs text-slate-600">• {(perspectives as [string, string])[1]}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </Animated.View>
            )}

            {appState === "INPUT" && fruitA && fruitB && (
              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                className="flex-1"
              >
                <View className="flex-1 relative">
                  <View className="flex-1 rotate-180 p-4">
                    <View className="flex-1 bg-white/40 rounded-3xl p-6 border border-white/30 shadow-sm backdrop-blur-md">
                      <Text className="text-lg font-bold text-slate-700 mb-2 text-center">
                        Perspective {fruitA.name} {fruitA.emoji}
                      </Text>
                      <TextInput
                        className="flex-1 text-xl text-slate-800 text-center"
                        multiline
                        placeholder="Type your view..."
                        value={opinionA}
                        onChangeText={setOpinionA}
                      />
                    </View>
                  </View>

                  <View className="absolute top-1/2 left-0 right-0 -mt-8 items-center z-10">
                    <TouchableOpacity
                      onPress={handleResolve}
                      className="bg-indigo-600 px-8 py-4 rounded-full shadow-xl border-4 border-white/20"
                    >
                      <Text className="text-white font-bold text-lg tracking-wider">RESOLVE</Text>
                    </TouchableOpacity>
                  </View>

                  <View className="flex-1 p-4">
                    <View className="flex-1 bg-white/40 rounded-3xl p-6 border border-white/30 shadow-sm backdrop-blur-md">
                      <Text className="text-lg font-bold text-slate-700 mb-2 text-center">
                        Perspective {fruitB.name} {fruitB.emoji}
                      </Text>
                      <TextInput
                        className="flex-1 text-xl text-slate-800 text-center"
                        multiline
                        placeholder="Type your view..."
                        value={opinionB}
                        onChangeText={setOpinionB}
                      />
                    </View>
                  </View>
                </View>
              </KeyboardAvoidingView>
            )}

            {appState === "ANALYZING" && (
              <View className="flex-1">
                <SwirlingLoader />
                {/* Top status + progress (kept above everything) */}
                <View className="absolute top-0 left-0 right-0 p-6 pt-28 z-[100]" style={{ zIndex: 9999, elevation: 50 }}>
                  <Text className="text-center text-white font-bold text-xl mb-2">{currentStage}</Text>
                  <View className="bg-white/80 h-2 rounded-full overflow-hidden">
                    <View className="bg-indigo-600 h-full" style={{ width: `${progress * 100}%` }} />
                  </View>
                </View>

                {/* Stage result cards below header */}
                <ScrollView className="flex-1 px-6 pt-56 pb-6" showsVerticalScrollIndicator={false}>
                  {stageResults.map((stage, idx) => (
                    <Animated.View
                      key={idx}
                      entering={FadeInDown.delay(200)}
                      className="bg-white/10 rounded-xl p-5 mb-4"
                    >
                      <Text className="text-indigo-300 font-bold text-lg mb-2">{stage.stageName}</Text>
                      <Text className="text-sm text-white/90 italic mb-3 font-medium">{stage.oneLineSummary}</Text>
                      {stage.summaryBullets.map((bullet, i) => (
                        <Text key={i} className="text-sm text-white/70 mb-1 leading-relaxed">• {bullet}</Text>
                      ))}
                    </Animated.View>
                  ))}
                </ScrollView>
              </View>
            )}

            {appState === "FOLLOWUP" && fruitA && fruitB && (
              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                className="flex-1"
              >
                <View className="flex-1 relative">
                  <View className="flex-1 rotate-180 p-4">
                    <View className="flex-1 bg-white/40 rounded-3xl p-6 border border-white/30 shadow-sm backdrop-blur-md">
                      <Text className="text-lg font-bold text-slate-700 mb-2 text-center">
                        {fruitA.name} {fruitA.emoji} - Add More Details
                      </Text>
                      <TextInput
                        className="flex-1 text-xl text-slate-800 text-center"
                        multiline
                        placeholder="Add more context or details..."
                        value={followUpA}
                        onChangeText={setFollowUpA}
                      />
                    </View>
                  </View>

                  <View className="absolute top-1/2 left-0 right-0 -mt-8 items-center z-10">
                    <TouchableOpacity
                      onPress={() => {
                        setOpinionA(previousOpinionA + "\n\nAdditional context: " + followUpA);
                        setOpinionB(previousOpinionB + "\n\nAdditional context: " + followUpB);
                        handleResolve();
                      }}
                      className="bg-indigo-600 px-8 py-4 rounded-full shadow-xl border-4 border-white/20"
                    >
                      <Text className="text-white font-bold text-lg tracking-wider">CONTINUE</Text>
                    </TouchableOpacity>
                  </View>

                  <View className="flex-1 p-4">
                    <View className="flex-1 bg-white/40 rounded-3xl p-6 border border-white/30 shadow-sm backdrop-blur-md">
                      <Text className="text-lg font-bold text-slate-700 mb-2 text-center">
                        {fruitB.name} {fruitB.emoji} - Add More Details
                      </Text>
                      <TextInput
                        className="flex-1 text-xl text-slate-800 text-center"
                        multiline
                        placeholder="Add more context or details..."
                        value={followUpB}
                        onChangeText={setFollowUpB}
                      />
                    </View>
                  </View>
                </View>
              </KeyboardAvoidingView>
            )}

            {appState === "RESULTS" && result && (
              <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                <Animated.View entering={FadeIn.delay(300)} className="p-6">
                  {/* Final Summary Card */}
                  <View className="bg-white/95 rounded-3xl p-6 mb-6 shadow-xl">
                    <Text className="text-center text-slate-500 font-medium uppercase tracking-widest text-xs mb-1">Topic</Text>
                    <Text className="text-center text-2xl font-bold text-slate-800 mb-2">{result.topic}</Text>
                    <Text className="text-center text-xl font-bold text-indigo-600 mb-4">Harmony! 🌟</Text>

                    {result.summaryBullets.map((bullet, i) => (
                      <Text key={i} className="text-base text-slate-800 leading-relaxed font-medium mb-2">
                        • {bullet}
                      </Text>
                    ))}

                    <Text className="text-sm text-slate-500 italic mt-4 leading-relaxed">
                      {result.narration}
                    </Text>

                    {/* Summary Links */}
                    {result.summaryLinks.length > 0 && (
                      <View className="mt-4">
                        <Text className="text-xs text-slate-500 font-bold uppercase mb-2">Related Reading</Text>
                        {result.summaryLinks.map((link, i) => (
                          <TouchableOpacity
                            key={i}
                            onPress={() => Linking.openURL(link.url)}
                            className="mb-2"
                          >
                            <Text className="text-sm text-indigo-600 underline">{link.title}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    <View className="flex-row justify-center space-x-4 mt-4">
                      <TouchableOpacity
                        onPress={() => Speech.speak(result.narration, { rate: 0.85, pitch: 1.05, language: 'en-US' })}
                        className="bg-indigo-600 px-6 py-2 rounded-full"
                      >
                        <Text className="text-white font-bold">🔊 Play</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={stopAudio} className="bg-slate-300 px-6 py-2 rounded-full">
                        <Text className="text-slate-700 font-bold">Stop</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Fruit Perspectives Side-by-Side */}
                  <View className="flex-row justify-between mb-6">
                    <Animated.View entering={FadeInDown.delay(500)} className="w-[48%] bg-red-100/95 p-5 rounded-2xl shadow-lg">
                      <Text className="text-xl font-bold text-slate-800 mb-3">{result.perspectiveALabel}</Text>
                      {result.perspectiveABullets.map((bullet, i) => (
                        <Text key={i} className="text-sm text-slate-700 mb-2 leading-snug">• {bullet}</Text>
                      ))}
                      {result.perspectiveALinks.length > 0 && (
                        <View className="mt-3">
                          <Text className="text-xs text-slate-600 font-bold mb-1">Links</Text>
                          {result.perspectiveALinks.map((link, i) => (
                            <TouchableOpacity
                              key={i}
                              onPress={() => Linking.openURL(link.url)}
                              className="mb-1"
                            >
                              <Text className="text-xs text-red-700 underline">{link.title}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </Animated.View>

                    <Animated.View entering={FadeInDown.delay(500)} className="w-[48%] bg-yellow-100/95 p-5 rounded-2xl shadow-lg">
                      <Text className="text-xl font-bold text-slate-800 mb-3">{result.perspectiveBLabel}</Text>
                      {result.perspectiveBBullets.map((bullet, i) => (
                        <Text key={i} className="text-sm text-slate-700 mb-2 leading-snug">• {bullet}</Text>
                      ))}
                      {result.perspectiveBLinks.length > 0 && (
                        <View className="mt-3">
                          <Text className="text-xs text-slate-600 font-bold mb-1">Links</Text>
                          {result.perspectiveBLinks.map((link, i) => (
                            <TouchableOpacity
                              key={i}
                              onPress={() => Linking.openURL(link.url)}
                              className="mb-1"
                            >
                              <Text className="text-xs text-yellow-800 underline">{link.title}</Text>
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
                      className="flex-1 bg-indigo-600 py-4 rounded-2xl"
                    >
                      <Text className="text-white text-center font-bold text-lg">Follow Up</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => { stopAudio(); setAppState("HOME"); }}
                      className="flex-1 bg-slate-800 py-4 rounded-2xl"
                    >
                      <Text className="text-white text-center font-bold text-lg">Start Over</Text>
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              </ScrollView>
            )}
          </SafeAreaView>
        </Animated.View>
      </ImageBackground>
    </SafeAreaProvider>
  );
}
