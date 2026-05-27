import { NextResponse } from "next/server";

import {
  isValidHexPrefix,
  meshMonitorApiOrigin,
  normalizeHexPrefix,
} from "@/lib/mesh-monitor-proxy";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ prefix: string }> },
) {
  const { prefix } = await params;
  const normalized = normalizeHexPrefix(prefix);
  if (!isValidHexPrefix(normalized)) {
    return NextResponse.json({ error: "Invalid prefix format." }, { status: 400 });
  }

  const base = meshMonitorApiOrigin();
  try {
    const res = await fetch(`${base}/api/prefix/${encodeURIComponent(normalized)}`, {
      cache: "no-store",
    });
    const body = await res.json();
    return NextResponse.json(body, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Could not reach Mesh Monitor API." }, { status: 502 });
  }
}
