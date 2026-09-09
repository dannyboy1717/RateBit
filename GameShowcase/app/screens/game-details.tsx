"use client";

import IgdbCredit from "@/components/IgdbCredit";
import GlassButton from "@/components/ui/GlassButton";
import { useGames } from "@/hooks/useGames";
import { useToast } from "@/hooks/useToast";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

export default function GameDetailsScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const insets = useSafeAreaInsets();
    const [deleting, setDeleting] = useState(false);

    // Reads from shared state, so edits and deletes made elsewhere are already
    // reflected here — no refetch on focus needed.
    const { getGameById, deleteGame, loadingGames } = useGames();
    const { showToast } = useToast();
    const game = getGameById(Number(id));

    const getStatusColor = (status: string | null) => {
        if (!status) {
            return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
        }

        switch (status.toLowerCase()) {
            case "completed":
            case "finished":
                return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-400";
            case "playing":
            case "started":
                return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
            case "wishlist":
                return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
            case "dropped":
                return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
            case "paused":
                return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
            default:
                return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
        }
    };

    const getPlatformLabel = (platform: string | null) => {
        if (!platform) {
            return "Game";
        }

        switch (platform.toLowerCase()) {
            case "pc":
            case "steam":
                return "PC";
            case "playstation":
            case "ps4":
            case "ps5":
                return "PlayStation";
            case "xbox":
                return "Xbox";
            case "switch":
                return "Switch";
            case "mobile":
            case "ios":
            case "android":
                return "Mobile";
            default:
                return platform;
        }
    };

    const renderStars = (rating: number | null) => {
        if (!rating) {
            return <Text className="text-gray-400 dark:text-gray-500">No rating</Text>;
        }

        const stars = [];
        const starRating = rating / 2;
        const fullStars = Math.floor(starRating);
        const hasHalfStar = starRating % 1 !== 0;

        for (let i = 0; i < 5; i++) {
            if (i < fullStars) {
                stars.push(
                    <Text key={i} className="text-yellow-400 text-lg">
                        ★
                    </Text>
                );
            } else if (i === fullStars && hasHalfStar) {
                stars.push(
                    <Text key={i} className="text-yellow-400 text-lg">
                        ☆
                    </Text>
                );
            } else {
                stars.push(
                    <Text key={i} className="text-gray-300 dark:text-gray-600 text-lg">
                        ★
                    </Text>
                );
            }
        }

        return (
            <View className="flex-row items-center">
                <View className="flex-row">{stars}</View>
                <Text className="ml-2 text-gray-600 dark:text-gray-400 font-medium">{starRating}/5</Text>
            </View>
        );
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) {
            return "Not set";
        }

        try {
            return new Date(dateString).toLocaleDateString();
        } catch {
            return dateString;
        }
    };

    const InfoRow = ({ label, value }: { label: string; value: string | null }) => (
        <View className="flex-row justify-between items-center py-3 border-b border-gray-100 dark:border-gray-700">
            <Text className="text-gray-600 dark:text-gray-400 font-medium flex-1">{label}</Text>
            <Text className="text-gray-800 dark:text-white font-medium flex-1 text-right" numberOfLines={2}>
                {value || "Not specified"}
            </Text>
        </View>
    );

    function confirmDeleteGame() {
        if (!game || deleting) {
            return;
        }

        Alert.alert("Delete Game", `Delete "${game.Name || "this game"}"?`, [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: "destructive",
                onPress: () => {
                    void performDelete();
                },
            },
        ]);
    }

    async function performDelete() {
        if (!game) {
            return;
        }

        // Captured up front: deleteGame removes the row from shared state, so
        // `game` is already undefined by the time the await resolves.
        const deletedName = game.Name || "Game";
        const deletedId = game.id;

        try {
            setDeleting(true);
            await deleteGame(deletedId);

            router.back();
            showToast(`${deletedName} deleted`);
        } catch (err: any) {
            Alert.alert("Error", "Failed to delete game: " + err.message);
        } finally {
            setDeleting(false);
        }
    }

    if (loadingGames) {
        return (
            <View className="flex-1 justify-center items-center">
                <ActivityIndicator size="large" color="#6366f1" />
                <Text className="text-gray-600 dark:text-gray-400 mt-4">Loading game details...</Text>
            </View>
        );
    }

    if (!game) {
        return (
            <View className="flex-1 justify-center items-center px-8">
                <Text className="text-red-600 dark:text-red-400 text-lg font-medium mb-4">Game not found</Text>
                <GlassButton label="Back" onPress={() => router.back()} />
            </View>
        );
    }

    return (
        <SafeAreaView className="flex-1">
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
                <View className="px-6 pt-4 pb-4">
                    <GlassButton label="Back" onPress={() => router.back()} style={{ alignSelf: "flex-start", marginBottom: 16 }} />

                    {game.CoverUrl ? (
                        <Image
                            source={{ uri: game.CoverUrl }}
                            style={{ width: 140, height: 187, borderRadius: 10, marginBottom: 16 }}
                            contentFit="cover"
                            transition={200}
                        />
                    ) : null}

                    <Text className="text-2xl font-bold text-gray-800 dark:text-white mb-2" numberOfLines={3}>
                        {game.Name || "Untitled Game"}
                    </Text>

                    <Text className="text-gray-600 dark:text-gray-400 mb-4">{game["Developer/Publisher"] || "Unknown Developer"}</Text>

                    <View className="flex-row items-center justify-between mb-6">
                        {renderStars(game.Rating)}
                        <View className={`px-3 py-1 rounded-full ${getStatusColor(game.Status)}`}>
                            <Text className="text-sm font-medium capitalize">{game.Status || "Unknown"}</Text>
                        </View>
                    </View>
                </View>

                <View className="flex flex-col px-6 gap-6">
                    <View className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                        <Text className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Game Information</Text>
                        <InfoRow label="Platform" value={getPlatformLabel(game.Platform)} />
                        {game.Playtime ? <InfoRow label="Playtime" value={game.Playtime} /> : null}
                        <InfoRow label="Status" value={game.Status} />
                    </View>

                    {game.Started || game.Finished ? (
                        <View className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                            <Text className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Timeline</Text>
                            <InfoRow label="Started" value={game.Started ?? "Unknown"} />
                            <InfoRow label="Finished" value={game.Finished ?? "Unknown"} />
                        </View>
                    ) : null}

                    {game.Bought ? (
                        <View className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                            <Text className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Purchase Details</Text>
                            <InfoRow label="Purchase Date" value={formatDate(game.Bought)} />
                            <InfoRow label="Cost" value={game.Cost} />
                        </View>
                    ) : null}

                    {game.Comments ? (
                        <View className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                            <Text className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Comments</Text>
                            <Text className="text-gray-700 dark:text-gray-300 leading-6">{game.Comments}</Text>
                        </View>
                    ) : null}

                    <View className="flex gap-3">
                        <TouchableOpacity
                            className="flex-1 bg-indigo-600 dark:bg-indigo-500 py-4 rounded-lg items-center"
                            onPress={() => router.push(`/screens/edit-game?id=${game.id}`)}
                        >
                            <Text className="text-white font-semibold">Edit Game</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            className={`flex-1 py-4 rounded-lg items-center ${deleting ? "bg-red-300 dark:bg-red-800" : "bg-red-600 dark:bg-red-500"}`}
                            onPress={confirmDeleteGame}
                            disabled={deleting}
                        >
                            <Text className="text-white font-semibold">{deleting ? "Deleting..." : "Delete Game"}</Text>
                        </TouchableOpacity>
                    </View>

                    <IgdbCredit className="mt-8" />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
