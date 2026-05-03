import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { passphrase } = await request.json();
  const expected = process.env.PASSPHRASE;

  if (!expected) {
    return Response.json({ error: "服务端未配置 PASSPHRASE" }, { status: 500 });
  }

  if (passphrase === expected) {
    return Response.json({ ok: true });
  }

  return Response.json({ ok: false, error: "口令错误" }, { status: 401 });
}
