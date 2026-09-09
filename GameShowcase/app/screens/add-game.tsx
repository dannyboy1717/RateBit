"use client";

import IgdbCredit from "@/components/IgdbCredit";
import PlatformPicker from "@/components/platform-picker";
import RatingPicker from "@/components/rating-picker";
import StatusPicker from "@/components/status-picker";
import GlassButton from "@/components/ui/GlassButton";
import { useAds } from "@/hooks/useAds";
import { useGames, type NewGame } from "@/hooks/useGames";
import { useToast } from "@/hooks/useToast";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { GamePlatform, GameStatus } from "../types/supabase";

export const platforms: GamePlatform[] = [
  "PC",
  "Xbox",
  "PS5",
  "PS4",
  "PS3",
  "PS2",
  "PS1",
  "PS Vita",
  "PSP",
  "Switch",
  "Switch 2",
  "3DS",
  "DS",
  "GBA",
  "SNES",
];

function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType = "default" as const,
}: {
  label: string;
  value: string | null | undefined;
  onChangeText: (text: string) => void;
  placeholder: string;
  multiline?: boolean;
  keyboardType?: "default" | "numeric" | "decimal-pad";
}) {
  return (
    <View className="mb-4">
      <Text className="text-gray-700 dark:text-gray-300 font-medium mb-2">{label}</Text>
      <TextInput
        className={`bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-4 py-3 text-gray-800 dark:text-white ${
          multiline ? "min-h-[100px]" : ""
        }`}
        value={value || ""}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        keyboardType={keyboardType}
      />
    </View>
  );
}

/**
 * Router params are always strings. The search screen passes the mapped
 * platforms as a JSON array; fall back to "PC" when absent or malformed.
 */
function parseSeededPlatform(raw: string | undefined): GamePlatform {
  if (!raw) {
    return "PC";
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? (parsed[0] as GamePlatform) : "PC";
  } catch {
    return "PC";
  }
}

export default function AddGameScreen() {
  const insets = useSafeAreaInsets();
  const { addGame } = useGames();
  const { maybeShowInterstitial } = useAds();
  const { showToast } = useToast();

  // Seeded by screens/search-game when a game is picked from IGDB. Absent when
  // the user chose to enter a game manually, which leaves every field blank.
  const params = useLocalSearchParams<{
    igdbId?: string;
    name?: string;
    developer?: string;
    coverUrl?: string;
    platforms?: string;
  }>();

  const [igdbId] = useState<string | undefined>(params.igdbId || undefined);
  const [coverUrl] = useState<string | undefined>(params.coverUrl || undefined);

  const [saving, setSaving] = useState(false);
  const [selectedName, setSelectedName] = useState(params.name ?? "");
  const [selectedDeveloper, setSelectedDeveloper] = useState<string | undefined>(params.developer || undefined);
  const [selectedPlatform, setSelectedPlatform] = useState<GamePlatform>(() => parseSeededPlatform(params.platforms));
  const [selectedStartDate, setSelectedStartDate] = useState<string | undefined>(undefined);
  const [selectedFinishDate, setSelectedFinishDate] = useState<string | undefined>(undefined);
  const [selectedPlaytime, setSelectedPlaytime] = useState<string | undefined>(undefined);
  const [selectedRating, setSelectedRating] = useState<number>(-1);
  const [selectedStatus, setSelectedStatus] = useState<GameStatus>("Plan to Play");
  const [selectedBoughtDate, setSelectedBoughtDate] = useState<string | undefined>(undefined);
  const [selectedCost, setSelectedCost] = useState<string | undefined>(undefined);
  const [selectedComments, setSelectedComments] = useState<string | undefined>(undefined);

  async function saveGame() {
    try {
      setSaving(true);

      if (!selectedName.trim()) {
        throw new Error("Game name is required.");
      }

      const newGame: NewGame = {
        Name: selectedName.trim(),
        "Developer/Publisher": selectedDeveloper?.trim() || null,
        Platform: selectedPlatform || null,
        Started: selectedStartDate?.trim() || null,
        Finished: selectedFinishDate?.trim() || null,
        Playtime: selectedPlaytime?.trim() || null,
        Rating: selectedRating > 0 ? selectedRating : null,
        Status: selectedStatus || null,
        Bought: selectedBoughtDate?.trim() || null,
        Cost: selectedCost?.trim() || null,
        Comments: selectedComments?.trim() || null,
        IgdbId: igdbId ? Number(igdbId) : null,
        CoverUrl: coverUrl || null,
      };

      await addGame(newGame);

      // Finishing an add is the one genuine task boundary in the app, which is
      // where Google says interstitials belong. Frequency capping lives in
      // app/lib/ads.ts — most adds show nothing.
      await maybeShowInterstitial();

      // Back first, then confirm: the toast is app-level, so it lands on the
      // games list next to the game that was just added rather than flashing on
      // a screen that is being popped.
      router.back();
      showToast(`${newGame.Name} added`);
    } catch (err: any) {
      Alert.alert("Error", "Failed to add game: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  const statuses = ["Plan to Play", "Started", "Finished", "Completed", "Continuous", "Paused", "Dropped"];

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <ScrollView
        className="flex-1 bg-white dark:bg-gray-900"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        <View className="px-6 pt-4 pb-4">
          <GlassButton label="Cancel" onPress={() => router.back()} style={{ alignSelf: "flex-start", marginBottom: 16 }} />

          <Text className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Add Game</Text>
          <Text className="text-gray-600 dark:text-gray-400 mb-6">Create a new game entry</Text>
        </View>

        <View className="px-6">
          <View className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-6">
            <Text className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Basic Information</Text>

            {coverUrl ? (
              <View className="flex-row items-center mb-4">
                <Image
                  source={{ uri: coverUrl }}
                  style={{ width: 60, height: 80, borderRadius: 8 }}
                  contentFit="cover"
                  transition={150}
                />
                <View className="ml-3 flex-1">
                  <Text className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Matched on IGDB</Text>
                  <Pressable onPress={() => router.replace("/screens/search-game")}>
                    <Text className="text-indigo-600 dark:text-indigo-400 font-semibold">Change game</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            <InputField label="Game Name" value={selectedName} onChangeText={setSelectedName} placeholder="Enter game name" />

            <InputField
              label="Developer/Publisher"
              value={selectedDeveloper}
              onChangeText={setSelectedDeveloper}
              placeholder="Enter developer or publisher"
            />

            <PlatformPicker options={platforms} selected={selectedPlatform} onSelectedChange={setSelectedPlatform} />

            <StatusPicker statuses={statuses} selected={selectedStatus} onSelectedChange={setSelectedStatus} />
            <RatingPicker value={selectedRating} onValueChange={setSelectedRating} />
          </View>

          <View className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-6">
            <Text className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Timeline</Text>

            <InputField
              label="Started Date"
              value={selectedStartDate}
              onChangeText={setSelectedStartDate}
              placeholder="YYYY-MM-DD"
            />

            <InputField
              label="Finished Date"
              value={selectedFinishDate}
              onChangeText={setSelectedFinishDate}
              placeholder="YYYY-MM-DD"
            />

            <InputField
              label="Playtime"
              value={selectedPlaytime}
              onChangeText={setSelectedPlaytime}
              placeholder="e.g., 25 hours, 3 days"
            />
          </View>

          <View className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-6">
            <Text className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Purchase Details</Text>

            <InputField
              label="Purchase Date"
              value={selectedBoughtDate}
              onChangeText={setSelectedBoughtDate}
              placeholder="YYYY-MM-DD"
            />

            <InputField
              label="Cost"
              value={selectedCost}
              onChangeText={setSelectedCost}
              placeholder="e.g., $59.99, Free"
              keyboardType="decimal-pad"
            />
          </View>

          <View className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-6">
            <Text className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Comments</Text>

            <InputField
              label="Notes & Comments"
              value={selectedComments}
              onChangeText={setSelectedComments}
              placeholder="Add your thoughts, notes, or review..."
              multiline
            />
          </View>

          <TouchableOpacity
            className={`py-4 rounded-lg items-center ${
              saving ? "bg-gray-400 dark:bg-gray-600" : "bg-indigo-600 dark:bg-indigo-500"
            }`}
            onPress={saveGame}
            disabled={saving}
          >
            {saving ? (
              <View className="flex-row items-center">
                <ActivityIndicator size="small" color="white" />
                <Text className="text-white font-semibold ml-2">Saving...</Text>
              </View>
            ) : (
              <Text className="text-white font-semibold">Add Game</Text>
            )}
          </TouchableOpacity>

          <IgdbCredit className="mt-8" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
