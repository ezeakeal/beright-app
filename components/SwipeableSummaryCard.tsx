import React, { useState } from "react";
import { View, Text, Dimensions, TouchableOpacity } from "react-native";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    runOnJS,
    runOnUI,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const CARD_HEIGHT = SCREEN_HEIGHT * 0.6;
const PEEK_HEIGHT = 120;

interface SwipeableSummaryCardProps {
    topic: string;
    bullets: string[];
    narration: string;
}

export const SwipeableSummaryCard: React.FC<SwipeableSummaryCardProps> = ({
    topic,
    bullets,
    narration,
}) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const translateY = useSharedValue(0);

    const toggleCard = () => {
        const nextExpanded = !isExpanded;
        setIsExpanded(nextExpanded);
        runOnUI((next: boolean) => {
            "worklet";
            translateY.value = withSpring(next ? 0 : -CARD_HEIGHT + PEEK_HEIGHT);
        })(nextExpanded);
    };

    const pan = Gesture.Pan()
        .onUpdate((event) => {
            "worklet";
            translateY.value = Math.min(0, Math.max(-CARD_HEIGHT + PEEK_HEIGHT, event.translationY));
        })
        .onEnd(() => {
            "worklet";
            const threshold = CARD_HEIGHT / 3;
            if (translateY.value < -threshold) {
                translateY.value = withSpring(-CARD_HEIGHT + PEEK_HEIGHT);
                runOnJS(setIsExpanded)(false);
            } else {
                translateY.value = withSpring(0);
                runOnJS(setIsExpanded)(true);
            }
        });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    return (
        <GestureDetector gesture={pan}>
            <Animated.View
                style={[
                    animatedStyle,
                    {
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: CARD_HEIGHT,
                        zIndex: 10,
                        shadowColor: '#3b82f6',
                        shadowOpacity: 0.2,
                        shadowRadius: 30,
                    },
                ]}
                className="bg-black/90 border border-zinc-800/50 rounded-b-3xl"
            >
                <TouchableOpacity onPress={toggleCard} className="flex-1 p-6">
                    <View className="items-center mb-4">
                        <View className="w-12 h-1 bg-zinc-700 rounded-full mb-4" />
                        <Text className="text-zinc-600 font-medium uppercase tracking-widest text-xs mb-1">Topic</Text>
                        <Text className="text-2xl font-bold text-white/90 text-center mb-2">{topic}</Text>
                        <Text className="text-xl font-bold text-blue-300/70">Harmony! 🌟</Text>
                    </View>

                    {bullets.map((bullet, i) => (
                        <Text key={i} className="text-lg text-white/80 leading-relaxed font-medium mb-3">
                            • {bullet}
                        </Text>
                    ))}

                    <Text className="text-sm text-zinc-400 italic mt-4 leading-relaxed">
                        {narration}
                    </Text>

                    <Text className="text-xs text-zinc-600 mt-4 text-center">
                        {isExpanded ? "↑ Swipe up to see perspectives" : "↓ Swipe down to expand"}
                    </Text>
                </TouchableOpacity>
            </Animated.View>
        </GestureDetector>
    );
};
