import type { Metadata } from "next";
import { connection } from "next/server";
import { isFirstUser } from "@/lib/server/users";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Create account" };

export default async function SignUpPage() {
  await connection();
  return <SignUpForm firstUser={await isFirstUser()} />;
}
