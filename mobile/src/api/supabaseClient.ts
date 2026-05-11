import "react-native-get-random-values";
import "react-native-url-polyfill/auto";
import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";

/**
 * ExpoSecureStoreAdapter: Uses SecureStore for token persistence.
 * Expo SecureStore in SDK 54 supports values up to ~2KB.
 * If tokens exceed this, we chunk them across multiple keys.
 */
const CHUNK_SIZE = 2000;

class ExpoSecureStoreAdapter {
  async getItem(key: string): Promise<string | null> {
    // Try single-key read first
    const value = await SecureStore.getItemAsync(key);
    if (value === null) return null;

    // Check if it's chunked
    if (value.startsWith("__chunked__:")) {
      const count = parseInt(value.split(":")[1], 10);
      const chunks: string[] = [];
      for (let i = 0; i < count; i++) {
        const chunk = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
        if (chunk === null) return null;
        chunks.push(chunk);
      }
      return chunks.join("");
    }

    return value;
  }

  async setItem(key: string, value: string): Promise<void> {
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }

    // Chunk the value
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }

    // Store chunk count as marker
    await SecureStore.setItemAsync(key, `__chunked__:${chunks.length}`);
    for (let i = 0; i < chunks.length; i++) {
      await SecureStore.setItemAsync(`${key}_chunk_${i}`, chunks[i]);
    }
  }

  async removeItem(key: string): Promise<void> {
    const value = await SecureStore.getItemAsync(key);

    if (value?.startsWith("__chunked__:")) {
      const count = parseInt(value.split(":")[1], 10);
      for (let i = 0; i < count; i++) {
        await SecureStore.deleteItemAsync(`${key}_chunk_${i}`);
      }
    }

    await SecureStore.deleteItemAsync(key);
  }
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: new ExpoSecureStoreAdapter(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
