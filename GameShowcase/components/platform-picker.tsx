"use client";

import { COMMON_PLATFORMS, searchIgdbPlatforms } from "@/app/lib/igdb";
import { GamePlatform } from "@/app/types/supabase";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 2;

type PlatformPickerProps = {
  selected: GamePlatform;
  onSelectedChange: (platform: GamePlatform) => void;
};

/**
 * Platform chooser backed by IGDB's platform list.
 *
 * The app used to ship a fixed list of 15, so anything else — N64, GameCube,
 * Dreamcast, Android, VR — was unrecordable. IGDB tracks ~200, and free-text
 * entry covers the rest, since a personal library shouldn't be bounded by
 * someone else's catalogue.
 */
export default function PlatformPicker({ selected, onSelectedChange }: PlatformPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);

  // Responses can land out of order; ignore anything but the newest.
  const latestRequestId = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < MIN_QUERY_LENGTH) {
      latestRequestId.current += 1;
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);

    const timer = setTimeout(async () => {
      const requestId = ++latestRequestId.current;
      const names = await searchIgdbPlatforms(trimmed);

      if (requestId !== latestRequestId.current) {
        return;
      }

      setResults(names);
      setSearching(false);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  function choose(platform: GamePlatform) {
    onSelectedChange(platform);
    setOpen(false);
    setQuery("");
  }

  const trimmed = query.trim();
  const searched = trimmed.length >= MIN_QUERY_LENGTH;
  const options = searched ? results : COMMON_PLATFORMS;

  // Offer the raw text whenever IGDB has no exact match for it, so a platform
  // IGDB doesn't carry is still recordable.
  const showFreeText =
    trimmed.length > 0 &&
    !options.some((option) => option.toLowerCase() === trimmed.toLowerCase());

  return (
    <View className="mb-4">
      <Text className="text-gray-700 dark:text-gray-300 font-medium mb-2">Platform</Text>

      <Pressable
        className="flex-row items-center justify-between bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-4 py-4"
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Platform: ${selected || "none selected"}`}
      >
        <Text className={`text-base ${selected ? "text-gray-800 dark:text-white" : "text-gray-400 dark:text-gray-500"}`}>
          {selected || "Choose a platform"}
        </Text>
        <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
      </Pressable>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <SafeAreaView className="flex-1 bg-white dark:bg-gray-900" edges={["top", "left", "right", "bottom"]}>
          <View className="flex-row items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-700">
            <View style={{ width: 44 }} />
            <Text className="text-lg font-semibold text-gray-900 dark:text-white">Platform</Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={8}>
              <Text className="text-base font-semibold text-indigo-600 dark:text-indigo-400">Done</Text>
            </Pressable>
          </View>

          <View className="px-6 pt-4">
            <TextInput
              className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-4 py-3 text-gray-800 dark:text-white"
              value={query}
              onChangeText={setQuery}
              placeholder="Search platforms..."
              placeholderTextColor="#9CA3AF"
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
          </View>

          <ScrollView className="flex-1 px-6 pt-4" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {!searched ? (
              <Text className="px-1 mb-2 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Common
              </Text>
            ) : null}

            {searching ? (
              <View className="items-center py-8">
                <ActivityIndicator size="small" color="#6366f1" />
                <Text className="text-gray-600 dark:text-gray-400 mt-3">Searching IGDB...</Text>
              </View>
            ) : null}

            {!searching ? (
              <View className="rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-800 mb-4">
                {options.map((platform) => {
                  const isSelected = selected === platform;

                  return (
                    <Pressable
                      key={platform}
                      className={`flex-row items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 ${
                        isSelected ? "bg-indigo-50 dark:bg-indigo-500/20" : ""
                      }`}
                      onPress={() => choose(platform)}
                    >
                      <Text
                        className={`text-base flex-1 ${
                          isSelected ? "font-semibold text-indigo-700 dark:text-indigo-300" : "text-gray-800 dark:text-white"
                        }`}
                      >
                        {platform}
                      </Text>
                      {isSelected ? <Ionicons name="checkmark" size={20} color="#6366f1" /> : null}
                    </Pressable>
                  );
                })}

                {searched && options.length === 0 ? (
                  <View className="px-4 py-6">
                    <Text className="text-center text-gray-600 dark:text-gray-400">
                      No platforms found on IGDB.
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {showFreeText && !searching ? (
              <Pressable
                className="mb-8 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-4"
                onPress={() => choose(trimmed)}
              >
                <Text className="text-indigo-600 dark:text-indigo-400 font-semibold">Use &quot;{trimmed}&quot;</Text>
                <Text className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Save this exactly as typed, even though IGDB doesn&apos;t list it.
                </Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
