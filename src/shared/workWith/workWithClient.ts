import { supabase } from "../../pages/The-Elysia-Marketplace/lib/supabase";

export const workWithStatusPath = "/commons-circle/signals/work-with";
const bucket = "work-with-attachments";
export function workWithRequestPath(id: string) { return `${workWithStatusPath}?request=${encodeURIComponent(id)}`; }

// Persist only a user-scoped opaque intent, never private application/CV contents.
export function workWithIntent(userId: string, source: string) {
  const key = `elysia.work-with.intent.v2.${userId}.${source}`;
  let id = sessionStorage.getItem(key);
  if (!id || !/^[a-f0-9-]{36}$/.test(id)) { id = crypto.randomUUID(); sessionStorage.setItem(key, id); }
  return { id, complete: () => sessionStorage.removeItem(key) };
}

export async function attachWorkWithFile(userId: string, requestId: string, file: File) {
  if (!supabase) throw new Error("Sign in to upload a private attachment.");
  if (!/\.(pdf|doc|docx|odt|txt|md)$/i.test(file.name) || file.size < 1 || file.size > 10485760) throw new Error("Choose a PDF, document or text CV of 10 MB or less.");
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer())), byte => byte.toString(16).padStart(2, "0")).join("");
  const extension = file.name.split(".").pop()!.toLowerCase();
  const storagePath = `${userId}/${requestId}/${digest}.${extension}`;
  const uploaded = await supabase.storage.from(bucket).upload(storagePath, file, { upsert: false, contentType: file.type || undefined });
  // Identical-byte retry has the same path. No existing object is overwritten.
  if (uploaded.error && !/duplicate|already exists|resource already/i.test(uploaded.error.message)) throw new Error("Application saved. The private upload needs retrying from My Work With.");
  const linked = await supabase.rpc("attach_own_work_with_file", { p_request_id: requestId, p_storage_path: storagePath, p_original_filename: file.name.slice(0, 160) });
  if (linked.error) throw new Error("Application saved. Attachment verification needs retrying from My Work With; approval remains blocked while the attachment is pending.");
}

export async function submitWorkWith(application: Record<string, unknown>, userId: string, source: string, file: File | null) {
  if (!supabase) throw new Error("Sign in before submitting.");
  const intent = workWithIntent(userId, source);
  const result = await supabase.rpc("submit_own_work_with_request", { p_request_id: intent.id, p_application: application, p_attachment_expected: Boolean(file) });
  if (result.error) throw new Error("Submission could not be confirmed. Retry safely or check My Work With; do not start another application.");
  if (file) await attachWorkWithFile(userId, intent.id, file);
  intent.complete();
  return intent.id;
}
