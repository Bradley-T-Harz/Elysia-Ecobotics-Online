import type { Session } from "@supabase/supabase-js";

type WebsiteAccountSignupClient = {
  auth: {
    signUp(input: {
      email: string;
      password: string;
      options: { emailRedirectTo: string; captchaToken?: string };
    }): Promise<{
      data: {
        session: Session | null;
        user: { identities?: unknown[] | null } | null;
      };
      error: { message: string; code?: string; status?: number } | null;
    }>;
  };
};

export type WebsiteAccountSignupResult =
  | { status: "configuration_unavailable" }
  | { status: "invalid_input" }
  | { status: "provider_error"; message: string; code?: string; providerStatus?: number }
  | { status: "unexpected_error" }
  | { status: "unexpected_response" }
  | { status: "confirmation_required" }
  | { status: "confirmation_or_existing" }
  | { status: "signed_in"; session: Session };

export async function requestWebsiteAccountSignup(input: {
  client: WebsiteAccountSignupClient | null;
  email: string;
  password: string;
  emailRedirectTo: string;
  captchaToken?: string;
}): Promise<WebsiteAccountSignupResult> {
  const submittedEmail = input.email.trim();
  const submittedPassword = input.password;
  if (!submittedEmail || submittedPassword.length < 6) return { status: "invalid_input" };
  if (!input.client) return { status: "configuration_unavailable" };

  try {
    const { data, error } = await input.client.auth.signUp({
      email: submittedEmail,
      password: submittedPassword,
      options: {
        emailRedirectTo: input.emailRedirectTo,
        ...(input.captchaToken ? { captchaToken: input.captchaToken } : {})
      }
    });
    if (error) {
      return {
        status: "provider_error",
        message: error.message,
        code: error.code,
        providerStatus: error.status
      };
    }
    if (data.session) return { status: "signed_in", session: data.session };
    if (!data.user || !Array.isArray(data.user.identities)) return { status: "unexpected_response" };
    if (data.user.identities.length === 0) return { status: "confirmation_or_existing" };
    return { status: "confirmation_required" };
  } catch {
    return { status: "unexpected_error" };
  }
}
