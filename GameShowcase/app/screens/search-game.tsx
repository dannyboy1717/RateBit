"use client";

import IgdbCredit from "@/components/IgdbCredit";
import GlassButton from "@/components/ui/GlassButton";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { IgdbGame, mapIgdbPlatforms, searchIgdbGames } from "../lib/igdb";

const DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 2;

export default function SearchGameScreen() {
    const insets = useSafeAreaInsets();

    // editId is set when matching a game that already exists in the library
    // (from edit-game). Without it, picking a result starts a new entry.
    const params = useLocalSearchParams<{ editId?: string; initialQuery?: string }>();
    const editId = params.editId;
    const isMatching = Boolean(editId);

    const [query, setQuery] = useState(params.initialQuery ?? "");
    const [results, setResults] = useState<IgdbGame[]>([]);
    const [searching, setSearching] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    // Responses can land out of order, so tag each request and ignore anything
    // that isn't the most recent one.
    const latestRequestId = useRef(0);

    useEffect(() => {
        const trimmed = query.trim();

        if (trimmed.length < MIN_QUERY_LENGTH) {
            latestRequestId.current += 1;
            setResults([]);
            setSearching(false);
            setHasSearched(false);
            return;
        }

        setSearching(true);

        const timer = setTimeout(async () => {
            const requestId = ++latestRequestId.current;
            const games = await searchIgdbGames(trimmed);

            if (requestId !== latestRequestId.current) {
                return;
            }

            setResults(games);
            setSearching(false);
            setHasSearched(true);
        }, DEBOUNCE_MS);

        return () => clearTimeout(timer);
    }, [query]);

    function selectGame(game: IgdbGame) {
        const igdbFields = {
            igdbId: String(game.id),
            name: game.name,
            developer: game.developer ?? "",
            coverUrl: game.coverUrl ?? "",
            platforms: JSON.stringify(mapIgdbPlatforms(game.platforms)),
        };

        // Hand the match back to the edit form as pending state rather than
        // writing it here, so it lands with the user's other edits on Save.
        if (editId) {
            router.replace({
                pathname: "/screens/edit-game",
                params: { id: editId, ...igdbFields },
            });
            return;
        }

        router.replace({ pathname: "/screens/add-game", params: igdbFields });
    }

    function addManually() {
        router.replace({
            pathname: "/screens/add-game",
            params: { name: query.trim() },
        });
    }

    const renderResult = ({ item }: { item: IgdbGame }) => (
        <Pressable className="bg-white dark:bg-gray-900 mx-4 mb-3 rounded-lg shadow-sm border border-indigo-300 p-4" onPress={() => selectGame(item)}>
            <View className="flex-row items-center">
                {item.thumbUrl ? (
                    <Image
                        source={{ uri: item.thumbUrl }}
                        style={{ width: 44, height: 59, borderRadius: 6, marginRight: 12 }}
                        contentFit="cover"
                        transition={150}
                    />
                ) : (
                    <View style={{ width: 44, height: 59, borderRadius: 6, marginRight: 12 }} className="bg-gray-200 dark:bg-gray-700" />
                )}

                <View className="flex-1">
                    <Text className="text-base font-semibold text-gray-900 dark:text-white mb-1" numberOfLines={2}>
                        {item.name}
                    </Text>
                    <Text className="text-sm text-gray-600 dark:text-gray-400" numberOfLines={1}>
                        {[item.developer, item.releaseYear].filter(Boolean).join(" · ") || "Unknown developer"}
                    </Text>
                </View>
            </View>
        </Pressable>
    );

    /** Always reachable — IGDB doesn't know every game, and search can fail. */
    const escapeHatchRow = isMatching ? (
        <Pressable className="mx-4 mb-3 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-4" onPress={() => router.back()}>
            <Text className="text-indigo-600 dark:text-indigo-400 font-semibold">Leave unmatched</Text>
            <Text className="text-sm text-gray-600 dark:text-gray-400 mt-1">Go back without attaching an IGDB game.</Text>
        </Pressable>
    ) : (
        <Pressable className="mx-4 mb-3 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-4" onPress={addManually}>
            <Text className="text-indigo-600 dark:text-indigo-400 font-semibold">
                {query.trim() ? `+ Add "${query.trim()}" manually` : "+ Add a game manually"}
            </Text>
            <Text className="text-sm text-gray-600 dark:text-gray-400 mt-1">Enter the details yourself if the game isn&apos;t listed.</Text>
        </Pressable>
    );

    function renderStatus() {
        if (searching) {
            return (
                <View className="items-center py-8">
                    <ActivityIndicator size="small" color="#6366f1" />
                    <Text className="text-gray-600 dark:text-gray-400 mt-3">Searching IGDB...</Text>
                </View>
            );
        }

        if (hasSearched && results.length === 0) {
            return (
                <View className="items-center py-8 px-6">
                    <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No matches found</Text>
                    <Text className="text-center text-gray-600 dark:text-gray-400">Try a different spelling, or add the game manually below.</Text>
                </View>
            );
        }

        return null;
    }

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
            <View className="px-6 pt-4 pb-2">
                <GlassButton label="Cancel" onPress={() => router.back()} style={{ alignSelf: "flex-start", marginBottom: 16 }} />

                <Text className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
                    {isMatching ? "Match on IGDB" : "Add Game"}
                </Text>
                <Text className="text-gray-600 dark:text-gray-400 mb-4">
                    {isMatching ? "Pick the game this entry refers to" : "Search for a game, or add your own"}
                </Text>

                <TextInput
                    className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-4 py-3 text-gray-800 dark:text-white"
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search by name..."
                    placeholderTextColor="#9CA3AF"
                    autoFocus
                    autoCorrect={false}
                    returnKeyType="search"
                />
            </View>

            <FlatList
                data={results}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderResult}
                ListHeaderComponent={renderStatus()}
                ListFooterComponent={
                    <>
                        {escapeHatchRow}
                        <IgdbCredit className="mt-2" />
                    </>
                }
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingTop: 8, paddingBottom: insets.bottom + 24 }}
                showsVerticalScrollIndicator={false}
            />
        </SafeAreaView>
    );
}
