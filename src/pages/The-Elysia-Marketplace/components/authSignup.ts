import type { Session } from "@supabase/supabase-js";

type WebsiteAccountSignupClient = {
  auth: {
    signUp(input: {
      email: string;
      password: string;
      options: { emailRedirectTo: string };
    }): Promise<{
      data: { session: Session | null };
      error: { message: string } | null;
    }>;
  };
};

export type WebsiteAccountSignupResult =
  | { status: "configuration_unavailable" }
  | { status: "invalid_input" }
  | { status: "provider_error"; message: string }
  | { status: "unexpected_error" }
  | { status: "confirmation_required" }
  | { status: "signed_in"; session: Session };

export async function requestWebsiteAccountSignup(input: {
  client: WebsiteAccountSignupClient | null;
  email: string;
  password: string;
  emailRedirectTo: string;
}): Promise<WebsiteAccountSignupResult> {
  const submittedEmail = input.email.trim();
  const submittedPassword = input.password;
  if (!submittedEmail || submittedPassword.length < 6) return { status: "invalid_input" };
  if (!input.client) return { status: "configuration_unavailable" };

  try {
    const { data, error } = await input.client.auth.signUp({
      email: submittedEmail,
      password: submittedPassword,
      options: { emailRedirectTo: input.emailRedirectTo }
    });
    if (error) return { status: "provider_error", message: error.message };
    if (data.session) return { status: "signed_in", session: data.session };
    return { status: "confirmation_required" };
  } catch {
    return { status: "unexpected_error" };
  }
}
