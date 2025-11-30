import React, { useState } from "react";
import { View, Text, Dimensions, TouchableOpacity } from "react-native";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH * 0.85;
const PEEK_WIDTH = 60;

interface SwipeablePerspectiveCardProps {
    label: string;
    bullets: string[];
    side: "left" | "right";
    color: string;
}

export const SwipeablePerspectiveCard: React.FC<SwipeablePerspectiveCardProps> = ({
    label,
    bullets,
    side,
    color,
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const translateX = useSharedValue(side === "left" ? -CARD_WIDTH + PEEK_WIDTH : CARD_WIDTH - PEEK_WIDTH);

    const toggleCard = () => {
        if (isExpanded) {
            translateX.value = withSpring(side === "left" ? -CARD_WIDTH + PEEK_WIDTH : CARD_WIDTH - PEEK_WIDTH);
        } else {
            translateX.value = withSpring(0);
        }
        setIsExpanded(!isExpanded);
    };

    const pan = Gesture.Pan()
        .onUpdate((event) => {
            if (side === "left") {
                translateX.value = Math.min(0, Math.max(-CARD_WIDTH + PEEK_WIDTH, event.translationX - CARD_WIDTH + PEEK_WIDTH));
            } else {
                translateX.value = Math.max(0, Math.min(CARD_WIDTH - PEEK_WIDTH, event.translationX + CARD_WIDTH - PEEK_WIDTH));
            }
        })
        .onEnd(() => {
            const threshold = CARD_WIDTH / 3;
            if (side === "left") {
                if (translateX.value > -threshold) {
                    translateX.value = withSpring(0);
                    runOnJS(setIsExpanded)(true);
                } else {
                    translateX.value = withSpring(-CARD_WIDTH + PEEK_WIDTH);
                    runOnJS(setIsExpanded)(false);
                }
            } else {
                if (translateX.value < threshold) {
                    translateX.value = withSpring(0);
                    runOnJS(setIsExpanded)(true);
                } else {
                    translateX.value = withSpring(CARD_WIDTH - PEEK_WIDTH);
                    runOnJS(setIsExpanded)(false);
                }
            }
        });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
    }));

    return (
        <GestureDetector gesture={pan}>
            <Animated.View
                style={[
                    animatedStyle,
                    {
                        position: "absolute",
                        top: 0,
                        bottom: 0,
                        width: CARD_WIDTH,
                        [side]: 0,
                        shadowColor: color === "bg-black/70 border border-purple-900/40" ? '#a855f7' : '#22d3ee',
                        shadowOpacity: 0.15,
                        shadowRadius: 20,
                    },
                ]}
                className={`${color} p-6`}
            >
                <TouchableOpacity onPress={toggleCard} className="flex-1">
                    <Text className="text-2xl font-bold text-white/80 mb-4">{label}</Text>
                    {bullets.map((bullet, i) => (
                        <Text key={i} className="text-base text-zinc-300 mb-3 leading-relaxed">
                            • {bullet}
                        </Text>
                    ))}
                    <Text className="text-xs text-zinc-500 mt-4 italic">
                        {isExpanded ? "← Swipe to hide" : "Swipe to expand →"}
                    </Text>
                </TouchableOpacity>
            </Animated.View>
        </GestureDetector>
    );
};
