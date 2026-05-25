import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const scriptUrl = process.env.BOLETAS_APPS_SCRIPT_URL;
  const token = process.env.BOLETAS_APPS_SCRIPT_TOKEN;

  if (!scriptUrl || !token) {
    return NextResponse.json(
      { ok: false, rows: [], headers: [], error: "Faltan BOLETAS_APPS_SCRIPT_URL o BOLETAS_APPS_SCRIPT_TOKEN en el entorno." },
      { status: 500 },
    );
  }

  try {
    const url = new URL(scriptUrl);
    url.searchParams.set("token", token);

    const response = await fetch(url.toString(), { cache: "no-store" });
    const text = await response.text();
    let payload: unknown;

    try {
      payload = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { ok: false, rows: [], headers: [], error: "Apps Script no devolvio JSON valido.", raw: text.slice(0, 500) },
        { status: 502 },
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        { ok: false, rows: [], headers: [], error: `Apps Script respondio ${response.status}.`, payload },
        { status: 502 },
      );
    }

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { ok: false, rows: [], headers: [], error: error instanceof Error ? error.message : "No se pudo leer Apps Script." },
      { status: 500 },
    );
  }
}
