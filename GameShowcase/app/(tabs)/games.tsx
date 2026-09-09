"use client";

import AddGameButton from "@/components/AddGameButton";
import IgdbCredit from "@/components/IgdbCredit";
import GlassButton from "@/components/ui/GlassButton";
import SortFilterSheet, {
    DEFAULT_DIRECTION,
    DEFAULT_FILTER,
    DEFAULT_SORT,
    describeSortFilter,
    type FilterOption,
    type SortDirection,
    type SortOption,
} from "@/components/sort-filter-sheet";
import { useAds } from "@/hooks/useAds";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useGames } from "@/hooks/useGames";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Button, FlatList, Pressable, Text, useColorScheme, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { Image } from "expo-image";
import { BannerAd, BannerAdSize, useForeground } from "react-native-google-mobile-ads";
import { AD_UNITS } from "../lib/ads";
import { Game } from "../types/supabase";

export default function GamesTab() {
    const insets = useSafeAreaInsets();
    const isDark = useColorScheme() === "dark";
    const [sheetOpen, setSheetOpen] = useState(false);
    const [sortBy, setSortBy] = useState<SortOption>(DEFAULT_SORT);
    const [sortDirection, setSortDirection] = useState<SortDirection>(DEFAULT_DIRECTION);
    const [filterBy, setFilterBy] = useState<FilterOption>(DEFAULT_FILTER);
    const { user, loading: authLoading } = useAuthSession();
    const { games, loadingGames, error, fetchGames } = useGames();
    const { adsReady } = useAds();
    const router = useRouter();

    // Measured from the ad itself rather than assumed — adaptive banner height
    // varies by device width.
    const [bannerHeight, setBannerHeight] = useState(0);
    const bannerRef = useRef<BannerAd>(null);

    // iOS needs a manual refresh when the app returns to the foreground.
    useForeground(() => {
        bannerRef.current?.load();
    });

    function parseSortableDate(value: string | null) {
        if (!value) {
            return Number.NEGATIVE_INFINITY;
        }

        const parsed = Date.parse(value);
        return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
    }

    function getDisplayedGames() {
        const filteredGames = filterBy === "All" ? games : games.filter((game) => (game.Status ?? "Unknown") === filterBy);

        const sortedGames = [...filteredGames];

        sortedGames.sort((a, b) => {
            let comparison = 0;

            switch (sortBy) {
                case "alphabetical":
                    comparison = (a.Name ?? "").localeCompare(b.Name ?? "");
                    break;
                case "dateStarted":
                    comparison = parseSortableDate(a.Started) - parseSortableDate(b.Started);
                    break;
                case "dateFinished":
                    comparison = parseSortableDate(a.Finished) - parseSortableDate(b.Finished);
                    break;
                case "rating":
                    comparison = (a.Rating ?? Number.NEGATIVE_INFINITY) - (b.Rating ?? Number.NEGATIVE_INFINITY);
                    break;
                case "dateAdded":
                default:
                    comparison = a.id - b.id;
                    break;
            }

            return sortDirection === "asc" ? comparison : comparison * -1;
        });

        return sortedGames;
    }


    const getStatusLabel = (status: string) => {
        switch (status.toLowerCase()) {
            case "started":
                return "started";
            case "finished":
                return "finished";
            case "completed":
                return "completed";
            case "continuous":
                return "continuous";
            case "dropped":
                return "dropped";
            case "paused":
                return "paused";
            case "plan to play":
                return "plan to play";
            default:
                return "unknown";
        }
    };

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case "started":
                return "text-blue-500";
            case "finished":
                return "text-green-500";
            case "completed":
                return "text-amber-300";
            case "continuous":
                return "text-black dark:text-white";
            case "dropped":
                return "text-red-500";
            case "paused":
                return "text-slate-500";
            case "plan to play":
                return "text-indigo-500";
            default:
                return "text-slate-500";
        }
    };

    const renderStars = (rating: number | null) => {
        if (!rating) {
            return null;
        }

        const stars = [];
        const starRating = rating / 2;
        const fullStars = Math.floor(starRating);
        const hasHalfStar = starRating % 1 !== 0;

        for (let i = 0; i < 5; i++) {
            if (i < fullStars) {
                stars.push(
                    <Text key={i} className="text-yellow-500 text-xs">
                        ★
                    </Text>
                );
            } else if (i === fullStars && hasHalfStar) {
                stars.push(
                    <Text key={i} className="text-yellow-500 text-xs">
                        ☆
                    </Text>
                );
            } else {
                stars.push(
                    <Text key={i} className="text-gray-300 dark:text-gray-600 text-xs">
                        ★
                    </Text>
                );
            }
        }

        return <View className="flex-row">{stars}</View>;
    };

    const renderGameItem = ({ item }: { item: Game }) => (
        <Pressable
            className="bg-white dark:bg-gray-900 mx-4 mb-3 rounded-lg shadow-sm border border-indigo-300 p-4"
            onPress={() => router.push(`/screens/game-details?id=${item.id}`)}
        >
            <View className="flex-row items-center justify-between">
                {item.CoverUrl ? (
                    <Image
                        source={{ uri: item.CoverUrl }}
                        style={{ width: 48, height: 64, borderRadius: 6, marginRight: 12 }}
                        contentFit="cover"
                        transition={150}
                    />
                ) : null}

                <View className="flex-1 mr-4">
                    <Text className="text-base font-semibold text-gray-900 dark:text-white mb-1" numberOfLines={1}>
                        {item.Name}
                    </Text>
                    <Text className="text-sm text-gray-600 dark:text-gray-400 mb-2" numberOfLines={1}>
                        {item["Developer/Publisher"]}
                    </Text>
                    {item.Rating && <View className="flex-row items-center">{renderStars(item.Rating)}</View>}
                </View>

                <View className="items-center">
                    <Text className={`text-xs font-medium capitalize ${getStatusColor(item.Status ?? "Unknown")}`}>
                        {getStatusLabel(item.Status ?? "Unknown")}
                    </Text>
                </View>
            </View>
        </Pressable>
    );

    const displayedGames = getDisplayedGames();

    if (authLoading) {
        return (
            <View className="flex-1 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-indigo-900 dark:to-blue-800">
                <View className="flex-1 flex-col items-center justify-center px-6">
                    <Text className="text-xl font-semibold text-foreground mb-2">Checking account...</Text>
                </View>
            </View>
        );
    }

    if (!user) {
        return (
            <View className="flex-1 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
                <View className="flex-1 flex flex-col items-center justify-center px-6">
                    <Text className="text-xl font-semibold text-black dark:text-white mb-2">You are not logged in. Open the account page to sign in.</Text>
                </View>
            </View>
        );
    }

    if (error) {
        return (
            <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
                <AddGameButton />
                <View className="flex-1 flex flex-col items-center justify-center px-6">
                    <Text className="text-xl font-semibold text-black dark:text-white mb-2">Oops! Something went wrong</Text>
                    <Text className="text-muted-foreground text-center mb-6">{error}</Text>
                    <Button title="Try Again" onPress={fetchGames} />
                </View>
            </SafeAreaView>
        );
    }

    if (loadingGames) {
        return (
            <View className="flex-1 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-indigo-900 dark:to-blue-800">
                <View className="flex-1 flex flex-col items-center justify-center px-6">
                    <Text className="text-xl font-semibold text-foreground mb-2">Loading...</Text>
                </View>
            </View>
        );
    }

    // An empty library still needs the add button — it's the only way out of
    // this state.
    if (games.length === 0) {
        return (
            <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-indigo-900 dark:to-blue-800">
                <AddGameButton />
                <View className="flex-1 flex flex-col items-center justify-center px-6">
                    <Text className="text-xl font-semibold text-foreground mb-2">No games available</Text>
                    <Text className="text-black dark:text-white text-center mb-6">Your game library is empty. Start building your collection!</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
            <AddGameButton bottomOffset={bannerHeight ? bannerHeight + 16 : 0} />

            <View className="px-4 pt-2 pb-3 flex-row items-center">
                <GlassButton
                    label="Sort & Filter"
                    leading={<Ionicons name="options-outline" size={18} color={isDark ? "#eef2ff" : "#1e1b4b"} />}
                    onPress={() => setSheetOpen(true)}
                />
                <Text className="ml-3 flex-1 text-sm text-indigo-900/70 dark:text-gray-400" numberOfLines={1}>
                    {describeSortFilter(sortBy, sortDirection, filterBy)}
                </Text>
            </View>

            <SortFilterSheet
                visible={sheetOpen}
                onClose={() => setSheetOpen(false)}
                sortBy={sortBy}
                onSortByChange={setSortBy}
                sortDirection={sortDirection}
                onSortDirectionChange={setSortDirection}
                filterBy={filterBy}
                onFilterByChange={setFilterBy}
            />

            <FlatList
                data={displayedGames}
                extraData={`${sortBy}|${sortDirection}|${filterBy}`}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderGameItem}
                ListEmptyComponent={
                    <View className="mx-4 mt-8 items-center justify-center rounded-xl border border-indigo-200 bg-white/80 px-6 py-10 dark:border-gray-700 dark:bg-gray-900/70">
                        <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No matching games</Text>
                        <Text className="text-center text-gray-600 dark:text-gray-400">Try a different sort or clear the current status filter.</Text>
                    </View>
                }
                ListFooterComponent={<IgdbCredit className="mt-6" />}
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: insets.bottom + 96 + bannerHeight }}
                showsVerticalScrollIndicator={false}
            />

            {/*
              Only on the populated list. The empty-library and error branches
              above stay ad-free — AdMob prohibits ads on screens with no
              content, and it keeps the first-run experience clean.
            */}
            {adsReady ? (
                <View
                    // Measured from real layout rather than onSizeChange, which
                    // only fires when the ad's size *changes* — an anchored
                    // banner that settles at one size may never emit it, leaving
                    // the Add Game button sitting on top of the ad.
                    onLayout={(event) => setBannerHeight(event.nativeEvent.layout.height)}
                    style={{ position: "absolute", left: 0, right: 0, bottom: insets.bottom, alignItems: "center" }}
                >
                    <BannerAd
                        ref={bannerRef}
                        unitId={AD_UNITS.banner}
                        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
                        onAdFailedToLoad={() => setBannerHeight(0)}
                    />
                </View>
            ) : null}
        </SafeAreaView>
    );
}
