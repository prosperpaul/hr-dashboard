"use server";

import { signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";

/*
  Server actions for logging in and out. These run ONLY on the server, which
  is where Auth.js does its work (setting the signed session cookie).
*/

// The shape of what `login` returns to the form: either nothing (success, and
// we've redirected away) or an error message string to show the user.
export type LoginState = { error?: string } | undefined;

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      // On success, send the user to the dashboard overview.
      redirectTo: "/",
    });
  } catch (error) {
    // Auth.js signals a SUCCESSFUL sign-in by THROWING a special redirect
    // error. We must let that bubble up — only real auth failures are
    // AuthError, which we turn into a friendly message.
    if (error instanceof AuthError) {
      return { error: "Invalid email or password. Please try again." };
    }
    throw error; // re-throw the redirect (and anything unexpected)
  }
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}
