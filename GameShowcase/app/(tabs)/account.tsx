"use client";

import IgdbCredit from "@/components/IgdbCredit";
import GlassButton from "@/components/ui/GlassButton";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useToast } from "@/hooks/useToast";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../lib/supabase";

export default function AccountTab() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const { user, loading: initialLoading } = useAuthSession();
  const { showToast } = useToast();

  async function signIn() {
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }

    setLoading(true);
    setError("");

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
    } else {
      router.replace("/(tabs)/games");
      setEmail("");
      setPassword("");
    }
  }

  async function signUp() {
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }

    setLoading(true);
    setError("");

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    setEmail("");
    setPassword("");

    // With email confirmation disabled, signUp returns a session and the auth
    // listener signs the user straight in — telling them to check their inbox
    // would be wrong. A null session means confirmation really is pending.
    if (data.session) {
      Alert.alert("Welcome", "Your account is ready.");
      router.replace("/(tabs)/games");
      return;
    }

    Alert.alert("Check your email", "We've sent you a link to verify your account.");
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert("Error", error.message);
    } else {
      showToast("Signed out");
    }
  }

  /**
   * Two confirmations, because this is irreversible and the button sits
   * directly below Sign Out.
   */
  function confirmDeleteAccount() {
    Alert.alert(
      "Delete Account",
      "This permanently deletes your account and every game in your library. It cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          style: "destructive",
          onPress: () =>
            Alert.alert("Are you sure?", "Your library will be permanently erased.", [
              { text: "Cancel", style: "cancel" },
              { text: "Delete my account", style: "destructive", onPress: () => void deleteAccount() },
            ]),
        },
      ]
    );
  }

  async function deleteAccount() {
    setDeleting(true);

    try {
      const { data, error: functionError } = await supabase.functions.invoke<{ error?: string }>("delete-account");

      if (functionError || data?.error) {
        throw new Error(data?.error || functionError?.message || "Could not delete your account.");
      }

      // The account is gone, so the stored session is now invalid — clear it
      // locally so the app doesn't keep trying to use it.
      await supabase.auth.signOut();
      Alert.alert("Account deleted", "Your account and library have been permanently removed.");
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Could not delete your account.");
    } finally {
      setDeleting(false);
    }
  }

  if (initialLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-gray-900 justify-center items-center">
        <ActivityIndicator size="large" color="#6366f1" />
        <Text className="text-gray-600 dark:text-gray-400 mt-4">Loading...</Text>
      </SafeAreaView>
    );
  }

  if (user) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
        {router.canGoBack() && (
          <View className="px-6 pt-2">
            <GlassButton label="Back" onPress={() => router.back()} style={{ alignSelf: "flex-start", marginBottom: 12 }} />
          </View>
        )}
        <View className="flex-1 justify-center px-8">
          <View className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 mb-8">
            <Text className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Account Information</Text>

            <View className="flex flex-col gap-3">
              <View>
                <Text className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Email</Text>
                <Text className="text-base text-gray-800 dark:text-white">{user.email}</Text>
              </View>

              <View>
                <Text className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">User ID</Text>
                <Text className="text-base text-gray-800 dark:text-white font-mono text-xs">{user.id}</Text>
              </View>

              <View>
                <Text className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Account Created</Text>
                <Text className="text-base text-gray-800 dark:text-white">{new Date(user.created_at).toLocaleDateString()}</Text>
              </View>

              <View>
                <Text className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Email Verified</Text>
                <View className="flex-row items-center">
                  <View className={`w-2 h-2 rounded-full mr-2 ${user.email_confirmed_at ? "bg-green-500" : "bg-red-500"}`} />
                  <Text className="text-base text-gray-800 dark:text-white">
                    {user.email_confirmed_at ? "Verified" : "Not Verified"}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <TouchableOpacity className="bg-red-600 dark:bg-red-500 rounded-lg py-4 items-center" onPress={signOut}>
            <Text className="text-white font-semibold text-base">Sign Out</Text>
          </TouchableOpacity>

          {/* Deliberately understated and set apart from Sign Out — destructive
              and irreversible, so it shouldn't invite a stray tap. */}
          <TouchableOpacity
            className="mt-8 items-center py-3"
            onPress={confirmDeleteAccount}
            disabled={deleting}
            accessibilityRole="button"
            accessibilityLabel="Delete account permanently"
          >
            {deleting ? (
              <View className="flex-row items-center">
                <ActivityIndicator size="small" color="#dc2626" />
                <Text className="text-red-600 dark:text-red-400 ml-2">Deleting...</Text>
              </View>
            ) : (
              <Text className="text-red-600 dark:text-red-400 underline">Delete account</Text>
            )}
          </TouchableOpacity>

          <IgdbCredit className="mt-10" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      {/* Guarded like the signed-in branch — arriving here via the redirect in
          app/index.tsx leaves nothing to go back to. */}
      {router.canGoBack() && (
        <View className="px-6 pt-2">
          <GlassButton label="Back" onPress={() => router.back()} style={{ alignSelf: "flex-start", marginBottom: 12 }} />
        </View>
      )}
      <View className="flex-1 justify-center px-8">
        <View className="items-center mb-12">
          <Text className="text-3xl font-bold text-gray-800 dark:text-white mb-2">Welcome Back</Text>
          <Text className="text-gray-600 dark:text-gray-400 text-center">Sign in to your account to continue</Text>
        </View>

        {error ? (
          <View className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <Text className="text-red-700 dark:text-red-400 text-center">{error}</Text>
          </View>
        ) : null}

        <View className="space-y-4 flex flex-col gap-4">
          <View>
            <Text className="text-gray-700 dark:text-gray-300 font-medium mb-2">Email</Text>
            <TextInput
              className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-4 text-gray-800 dark:text-white text-base"
              placeholder="Enter your email"
              placeholderTextColor="#9CA3AF"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setError("");
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
          </View>

          <View>
            <Text className="text-gray-700 dark:text-gray-300 font-medium mb-2">Password</Text>
            <TextInput
              className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-4 text-gray-800 dark:text-white text-base"
              placeholder="Enter your password"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setError("");
              }}
              autoCapitalize="none"
              editable={!loading}
            />
          </View>

          <TouchableOpacity
            className={`bg-indigo-600 dark:bg-indigo-500 rounded-lg py-4 items-center mt-6 ${loading ? "opacity-70" : ""}`}
            onPress={signIn}
            disabled={loading}
          >
            {loading ? (
              <View className="flex-row items-center">
                <ActivityIndicator color="white" size="small" />
                <Text className="text-white font-semibold text-base ml-2">Signing In...</Text>
              </View>
            ) : (
              <Text className="text-white font-semibold text-base">Sign In</Text>
            )}
          </TouchableOpacity>

          <View className="flex-row items-center my-6">
            <View className="flex-1 h-px bg-gray-300 dark:bg-gray-600" />
            <Text className="mx-4 text-gray-500 dark:text-gray-400">or</Text>
            <View className="flex-1 h-px bg-gray-300 dark:bg-gray-600" />
          </View>

          <TouchableOpacity
            className={`bg-white dark:bg-gray-800 border border-indigo-600 dark:border-indigo-500 rounded-lg py-4 items-center ${loading ? "opacity-70" : ""}`}
            onPress={signUp}
            disabled={loading}
          >
            <Text className="text-indigo-600 dark:text-indigo-400 font-semibold text-base">Create Account</Text>
          </TouchableOpacity>
        </View>

        <IgdbCredit className="mt-10" />
      </View>
    </SafeAreaView>
  );
}
