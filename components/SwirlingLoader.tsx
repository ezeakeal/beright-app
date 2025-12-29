import React, { useEffect } from "react";
import { View } from "react-native";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence,
    Easing,
    cancelAnimation,
    runOnUI,
} from "react-native-reanimated";

export const SwirlingLoader = () => {
    const rotation1 = useSharedValue(0);
    const rotation2 = useSharedValue(0);
    const scale = useSharedValue(1);

    useEffect(() => {
        runOnUI(() => {
            "worklet";
            rotation1.value = withRepeat(
                withTiming(360, { duration: 4000, easing: Easing.linear }),
                -1
            );

            rotation2.value = withRepeat(
                withTiming(-360, { duration: 6000, easing: Easing.linear }),
                -1
            );

            scale.value = withRepeat(
                withSequence(
                    withTiming(1.1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
                    withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) })
                ),
                -1,
                true
            );
        })();

        return () => {
            cancelAnimation(rotation1);
            cancelAnimation(rotation2);
            cancelAnimation(scale);
        };
    }, []);

    const ring1Style = useAnimatedStyle(() => {
        return {
            transform: [{ rotate: `${rotation1.value}deg` }, { scale: scale.value }],
        };
    });

    const ring2Style = useAnimatedStyle(() => {
        return {
            transform: [{ rotate: `${rotation2.value}deg` }, { scale: scale.value }],
        };
    });

    return (
        <View className="flex-1 justify-start items-center pt-20 absolute inset-0 z-20" pointerEvents="none">
            <View className="relative w-48 h-48 justify-center items-center">
                {/* Outer ring - Blue */}
                <Animated.View
                    className="absolute inset-0 border-2 border-blue-400/30 rounded-full"
                    style={[ring1Style, { shadowColor: '#3b82f6', shadowOpacity: 0.2, shadowRadius: 30 }]}
                />
                {/* Inner ring - Purple */}
                <Animated.View
                    className="absolute inset-8 border-2 border-purple-400/30 rounded-full"
                    style={[ring2Style, { shadowColor: '#a855f7', shadowOpacity: 0.2, shadowRadius: 30 }]}
                />

                {/* Center Core */}
                <View className="w-2 h-2 bg-white/40 rounded-full" 
                      style={{ shadowColor: '#ffffff', shadowOpacity: 0.5, shadowRadius: 10 }} />
            </View>
        </View>
    );
};
