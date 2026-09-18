"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { slugify, withRandomSuffix } from "@/lib/slug";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your organization's name."),
});

export interface OnboardingState {
  error: string | null;
}

export async function createOrganization(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const parsed = schema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  let slug = slugify(parsed.data.name) || "org";

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { error } = await supabase.rpc("create_organization_with_owner", {
      p_name: parsed.data.name,
      p_slug: slug,
    });

    if (!error) {
      redirect("/dashboard");
    }

    if (error.code === "23505") {
      // slug collision — retry with a random suffix
      slug = withRandomSuffix(slugify(parsed.data.name) || "org");
      continue;
    }

    return { error: "Could not create the organization. Please try again." };
  }

  return { error: "Could not create the organization. Please try again." };
}
