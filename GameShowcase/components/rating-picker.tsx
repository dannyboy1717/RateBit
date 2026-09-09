import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export interface RatingPickerProps {
    onValueChange: (rating: number) => void;
    value: number;
}

/** Matches the sentinel add-game and edit-game use for "not rated yet". */
export const NO_RATING = -1;

const RATINGS = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

/**
 * A dropdown rather than a row of chips: ten 40px circles overflow every phone
 * width, so 10 — the rating people most want to give — sat off the edge of a
 * horizontal scroller with nothing to suggest it was there.
 *
 * Highest first, because that's the end of the scale in demand.
 */
export default function RatingPicker({ value, onValueChange }: RatingPickerProps) {
    const [open, setOpen] = useState(false);
    const hasRating = value > 0;

    function select(rating: number) {
        onValueChange(rating);
        setOpen(false);
    }

    return (
        <View className="mb-4">
            <Text className="text-gray-700 dark:text-gray-300 font-medium mb-2">Rating</Text>

            <Pressable
                className="flex-row items-center justify-between bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-4"
                onPress={() => setOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={hasRating ? `Rating: ${value} out of 10` : "Rating: not rated"}
            >
                <View className="flex-row items-center">
                    {hasRating ? <Ionicons name="star" size={16} color="#facc15" style={{ marginRight: 6 }} /> : null}
                    <Text className={`text-base ${hasRating ? "text-gray-800 dark:text-white" : "text-gray-400 dark:text-gray-500"}`}>
                        {hasRating ? `${value} / 10` : "Not rated"}
                    </Text>
                </View>
                <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
            </Pressable>

            <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
                <SafeAreaView className="flex-1 bg-white dark:bg-gray-900" edges={["top", "left", "right", "bottom"]}>
                    <View className="flex-row items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-700">
                        <Pressable onPress={() => select(NO_RATING)} disabled={!hasRating} hitSlop={8}>
                            <Text className={`text-base ${hasRating ? "text-indigo-600 dark:text-indigo-400" : "text-gray-300 dark:text-gray-600"}`}>
                                Clear
                            </Text>
                        </Pressable>

                        <Text className="text-lg font-semibold text-gray-900 dark:text-white">Rating</Text>

                        <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                            <Text className="text-base font-semibold text-indigo-600 dark:text-indigo-400">Done</Text>
                        </Pressable>
                    </View>

                    <ScrollView className="flex-1 px-6 pt-5" showsVerticalScrollIndicator={false}>
                        <View className="rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-800 mb-6">
                            {RATINGS.map((rating) => {
                                const selected = value === rating;

                                return (
                                    <Pressable
                                        key={rating}
                                        className={`flex-row items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 ${
                                            selected ? "bg-indigo-50 dark:bg-indigo-500/20" : ""
                                        }`}
                                        onPress={() => select(rating)}
                                    >
                                        <Text
                                            className={`text-base ${
                                                selected
                                                    ? "font-semibold text-indigo-700 dark:text-indigo-300"
                                                    : "text-gray-800 dark:text-white"
                                            }`}
                                        >
                                            {rating}
                                        </Text>
                                        {selected ? <Ionicons name="checkmark" size={20} color="#6366f1" /> : null}
                                    </Pressable>
                                );
                            })}
                        </View>
                    </ScrollView>
                </SafeAreaView>
            </Modal>
        </View>
    );
}
