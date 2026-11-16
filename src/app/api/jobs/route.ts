import { NextResponse } from "next/server";
import { listJobs } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const jobs = await listJobs();
  jobs.sort(
    (a, b) =>
      (b.analysis?.score ?? -1) - (a.analysis?.score ?? -1) ||
      b.foundAt.localeCompare(a.foundAt),
  );
  return NextResponse.json(jobs);
}
