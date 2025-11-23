import React, { useEffect } from "react";
import { View, Text, Dimensions } from "react-native";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence,
    Easing,
    cancelAnimation,
} from "react-native-reanimated";

const { width } = Dimensions.get("window");

export const SwirlingLoader = () => {
    const rotation = useSharedValue(0);
    const scale = useSharedValue(1);
    const textOpacity = useSharedValue(0);

    useEffect(() => {
        rotation.value = withRepeat(
            withTiming(360, { duration: 2000, easing: Easing.linear }),
            -1
        );

        scale.value = withRepeat(
            withSequence(
                withTiming(1.2, { duration: 1000 }),
                withTiming(1, { duration: 1000 })
            ),
            -1,
            true
        );

        textOpacity.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 1500 }),
                withTiming(0.5, { duration: 1500 })
            ),
            -1,
            true
        );

        return () => {
            cancelAnimation(rotation);
            cancelAnimation(scale);
            cancelAnimation(textOpacity);
        };
    }, []);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ rotate: `${rotation.value}deg` }, { scale: scale.value }],
        };
    });

    const textStyle = useAnimatedStyle(() => {
        return {
            opacity: textOpacity.value,
        };
    });

    return (
        <View className="flex-1 justify-start items-center pt-20 absolute inset-0 z-20" pointerEvents="none">
            <View className="relative w-64 h-64 justify-center items-center">
                {/* Orb 1 */}
                <Animated.View
                    className="absolute w-16 h-16 rounded-full bg-blue-500/60 blur-xl"
                    style={[animatedStyle, { transform: [{ rotate: `${rotation.value}deg` }, { translateX: 50 }] }]}
                />
                {/* Orb 2 */}
                <Animated.View
                    className="absolute w-16 h-16 rounded-full bg-purple-500/60 blur-xl"
                    style={[animatedStyle, { transform: [{ rotate: `${rotation.value}deg` }, { translateX: -50 }] }]}
                />

                {/* Center Core */}
                <View className="w-4 h-4 bg-white rounded-full shadow-lg shadow-white" />
            </View>
        </View>
    );
};
