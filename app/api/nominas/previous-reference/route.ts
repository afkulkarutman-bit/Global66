import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const REFERENCE_JSON = path.join(process.cwd(), "data", "previous-reference-april-2026.json");

export async function GET() {
  try {
    const raw = await readFile(REFERENCE_JSON, "utf8");
    return NextResponse.json(JSON.parse(raw));
  } catch (error) {
    return NextResponse.json({
      source: REFERENCE_JSON,
      rows: [],
      totals: {},
      error: error instanceof Error ? error.message : "No se pudo leer la referencia de abril",
    });
  }
}
