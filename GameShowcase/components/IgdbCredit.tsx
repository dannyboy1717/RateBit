"use client";

import { Linking, Text, View } from "react-native";

const IGDB_URL = "https://www.igdb.com";

/**
 * Required attribution for the IGDB data behind search, covers, developers and
 * release years.
 *
 * The wording is fixed by the IGDB API/Data Commercial Usage Addendum, which
 * requires this disclosure on "each page ... using IGDB Services" and requires
 * it to link to IGDB. Don't reword it, and don't drop it from a screen that
 * renders IGDB data.
 *
 * Opens in Safari rather than an in-app browser on purpose: the app otherwise
 * renders no remote web content at all, and keeping it that way is worth more
 * than the polish of staying in-app.
 */
export default function IgdbCredit({ className = "" }: { className?: string }) {
    return (
        <View className={`items-center px-6 ${className}`}>
            <Text className="text-xs text-gray-500 dark:text-gray-400 text-center">
                Games metadata is powered by{" "}
                <Text
                    className="text-indigo-600 dark:text-indigo-400 underline"
                    accessibilityRole="link"
                    onPress={() => void Linking.openURL(IGDB_URL)}
                >
                    IGDB.com
                </Text>
            </Text>
        </View>
    );
}
