"use server";

import { revalidatePath } from "next/cache";
import { insertDemoMessage } from "@/lib/db";

export async function createMessage(formData: FormData) {
  const body = String(formData.get("body") ?? "").trim();
  if (!body) {
    return;
  }

  await insertDemoMessage(body);
  revalidatePath("/");
}
