import "server-only";
import { supabaseAdmin } from "./supabase-server";

// Where ID-card and selfie photos are kept until a moderator decides. Abstracted so
// tests can use memory instead of Supabase Storage.
export interface PhotoStore {
  put(path: string, file: Blob): Promise<void>;
  remove(paths: string[]): Promise<void>;
  signedUrl(path: string): Promise<string>;
}

const BUCKET = "verification"; // private bucket, created in the Supabase dashboard

export function supabasePhotoStore(): PhotoStore {
  const storage = () => supabaseAdmin().storage.from(BUCKET);
  return {
    async put(path, file) {
      const { error } = await storage().upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
    },
    async remove(paths) {
      if (paths.length === 0) return;
      const { error } = await storage().remove(paths);
      if (error) throw error;
    },
    async signedUrl(path) {
      const { data, error } = await storage().createSignedUrl(path, 600);
      if (error) throw error;
      return data.signedUrl;
    },
  };
}
