"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { slugify, withRandomSuffix } from "@/lib/slug";
import { isSelfServiceOrgCreationEnabled } from "@/lib/config";
import { getPlatformLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";

export interface OnboardingState {
  error: string | null;
}

export async function createOrganization(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const dict = getDictionary(await getPlatformLocale());

  // Defense in depth: the onboarding page already hides the form when
  // this is off, but a server action is a reachable endpoint on its
  // own regardless of what the page renders.
  if (!isSelfServiceOrgCreationEnabled()) {
    return { error: dict.dashboard.onboardingDisabledError };
  }

  const schema = z.object({
    name: z.string().trim().min(2, dict.dashboard.onboardingNameRequired),
  });

  const parsed = schema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? dict.common.genericError };
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

    return { error: dict.dashboard.onboardingGenericError };
  }

  return { error: dict.dashboard.onboardingGenericError };
}
