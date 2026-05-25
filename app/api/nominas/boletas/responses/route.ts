import { NextResponse } from "next/server";

export const runtime = "nodejs";

const STANDARD_HEADERS = ["Marca temporal", "Dirección de correo electrónico", "PDF"];

async function getAccessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("No se pudo obtener access_token de Google.");
  return data.access_token;
}

function normalizePlain(value: unknown) {
  return String(value ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

function looksLikeHeader(row: unknown[]): boolean {
  const normalized = row.map(c => normalizePlain(c));
  return normalized.some(c =>
    c.includes("correo") || c.includes("marca temporal") || c.includes("timestamp") || c.includes("pdf") || c.includes("fecha")
  );
}

// Always use the main "Respuestas de formulario 1" sheet and filter by month
function selectSheet(sheetNames: string[]): { sheetName: string } {
  const main = sheetNames.find(n => normalizePlain(n).includes("respuestas")) ?? sheetNames[0] ?? "";
  return { sheetName: main };
}

// Parse dates like "6/04/2026 1:53:09" or "2026-04-06" → "2026-04-06"
function parseDateCell(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  // DD/MM/YYYY or D/M/YYYY
  const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  // ISO
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  return null;
}

export async function GET(request: Request) {
  const missingVars = ["GOOGLE_CLIENT_ID","GOOGLE_CLIENT_SECRET","GOOGLE_REFRESH_TOKEN","GOOGLE_SHEETS_SPREADSHEET_ID"]
    .filter(k => !process.env[k]);
  if (missingVars.length > 0) {
    return NextResponse.json({ ok: false, rows: [], headers: [], error: `Faltan variables: ${missingVars.join(", ")}` }, { status: 500 });
  }

  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
  const mes = new URL(request.url).searchParams.get("mes") ?? undefined;

  // Month prefix for filtering (e.g. "2026-05")
  const mesPrefix = mes ? mes.slice(0, 7) : null;

  try {
    const accessToken = await getAccessToken();
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    // Get sheet names
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
      { headers: authHeader, cache: "no-store" }
    );
    if (!metaRes.ok) {
      const err = await metaRes.text();
      return NextResponse.json({ ok: false, rows: [], headers: [], error: `Sheets API ${metaRes.status}: ${err.slice(0, 200)}` }, { status: 502 });
    }
    const meta = await metaRes.json();
    const sheetNames: string[] = (meta.sheets ?? []).map((s: { properties: { title: string } }) => s.properties.title);
    if (sheetNames.length === 0) {
      return NextResponse.json({ ok: false, rows: [], headers: [], error: "El spreadsheet no tiene hojas." }, { status: 404 });
    }

    const { sheetName } = selectSheet(sheetNames);

    // Read sheet values
    const rangeRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}`,
      { headers: authHeader, cache: "no-store" }
    );
    if (!rangeRes.ok) {
      const err = await rangeRes.text();
      return NextResponse.json({ ok: false, rows: [], headers: [], error: `Error leyendo "${sheetName}": ${err.slice(0, 200)}` }, { status: 502 });
    }
    const range = await rangeRes.json();
    const rawRows: unknown[][] = (range.values ?? []).filter((row: unknown[]) =>
      row.some(cell => String(cell ?? "").trim() !== "")
    );

    if (rawRows.length === 0) {
      return NextResponse.json({ ok: true, rows: [], headers: STANDARD_HEADERS, sheetName });
    }

    const firstRow = rawRows[0];
    const hasHeader = looksLikeHeader(firstRow);
    const colHeaders: string[] = hasHeader
      ? firstRow.map(c => String(c ?? "").trim())
      : STANDARD_HEADERS;
    const dataRows = hasHeader ? rawRows.slice(1) : rawRows;

    // Index of the timestamp column
    const timestampIdx = colHeaders.findIndex(h =>
      normalizePlain(h).includes("marca temporal") || normalizePlain(h).includes("timestamp")
    );

    let filteredRows = dataRows.filter(row => row.some(cell => String(cell ?? "").trim() !== ""));

    // Filter by month prefix using the timestamp column
    if (mesPrefix && timestampIdx >= 0) {
      filteredRows = filteredRows.filter(row => {
        const dateStr = parseDateCell(row[timestampIdx]);
        return dateStr ? dateStr.startsWith(mesPrefix) : false;
      });
    }

    const rows = filteredRows.map((row, index) => {
      const obj: Record<string, unknown> & { __rowNumber: number } = {
        __rowNumber: hasHeader ? index + 2 : index + 1,
      };
      colHeaders.forEach((header, i) => {
        obj[header || `Columna ${i + 1}`] = row[i] ?? "";
      });
      return obj;
    });

    return NextResponse.json({ ok: true, rows, headers: colHeaders, sheetName });
  } catch (error) {
    return NextResponse.json(
      { ok: false, rows: [], headers: [], error: error instanceof Error ? error.message : "Error desconocido." },
      { status: 500 }
    );
  }
}
