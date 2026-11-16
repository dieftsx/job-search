import { NextResponse } from "next/server";
import { getProfile, saveProfile } from "@/lib/store";
import { Profile, emptyProfile } from "@/lib/types";

export async function GET() {
  return NextResponse.json(await getProfile());
}

export async function PUT(req: Request) {
  const body = (await req.json()) as Partial<Profile>;
  const profile: Profile = {
    name: String(body.name ?? emptyProfile.name),
    resume: String(body.resume ?? emptyProfile.resume),
    keywords: Array.isArray(body.keywords)
      ? body.keywords.map((k) => String(k).trim()).filter(Boolean)
      : [],
    remoteOnly: Boolean(body.remoteOnly),
    state: String(body.state ?? "").trim(),
    minScore: Math.max(0, Math.min(100, Number(body.minScore) || 0)),
  };
  return NextResponse.json(await saveProfile(profile));
}
