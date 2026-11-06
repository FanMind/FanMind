import { redirect } from "next/navigation";
import { signOutSupabaseServerSession } from "@/lib/supabase/server";

export async function GET() {
  await signOutSupabaseServerSession();
  redirect("/");
}

export async function POST() {
  await signOutSupabaseServerSession();
  redirect("/");
}
