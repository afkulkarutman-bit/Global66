import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

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

// Extract Google Drive file ID from various URL formats
function extractDriveFileId(url: string): string | null {
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /\/open\?id=([a-zA-Z0-9_-]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function downloadPdfAsBase64(fileId: string, accessToken: string): Promise<string> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Drive API ${res.status} para archivo ${fileId}`);
  const buffer = await res.arrayBuffer();
  return Buffer.from(buffer).toString("base64");
}

async function analyzeWithGemini(pdfBase64: string): Promise<{ nombre: string | null; monto: number | null; moneda: string | null; fecha: string | null; error?: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY no configurada");

  const prompt = `Eres un asistente de RRHH. Analiza esta boleta/factura de honorarios y extrae:
1. El nombre completo de quien emite la boleta (prestador de servicios).
2. El monto total a pagar (número sin signos ni separadores de miles). Busca el total neto, monto líquido o valor a pagar.
3. La moneda (USD, ARS, CLP, COP, PEN, etc.).
4. La fecha de emisión de la boleta (formato YYYY-MM-DD).

Responde SOLO con JSON válido, sin texto adicional:
{"nombre": "<nombre completo o null>", "monto": <número o null>, "moneda": "<moneda o null>", "fecha": "<YYYY-MM-DD o null>"}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: "application/pdf", data: pdfBase64 } },
          ],
        }],
        generationConfig: { temperature: 0, maxOutputTokens: 256 },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`Gemini no devolvió JSON válido: ${text.slice(0, 200)}`);

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      nombre: typeof parsed.nombre === "string" && parsed.nombre !== "null" ? parsed.nombre : null,
      monto: typeof parsed.monto === "number" ? parsed.monto : null,
      moneda: typeof parsed.moneda === "string" && parsed.moneda !== "null" ? parsed.moneda.toUpperCase() : null,
      fecha: typeof parsed.fecha === "string" && parsed.fecha !== "null" ? parsed.fecha : null,
    };
  } catch {
    throw new Error(`JSON inválido de Gemini: ${jsonMatch[0].slice(0, 200)}`);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { items } = body as {
    items: { email: string; fileUrl: string }[];
  };

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "items requerido" }, { status: 400 });
  }

  if (items.length > 50) {
    return NextResponse.json({ error: "Máximo 50 boletas por llamada" }, { status: 400 });
  }

  let accessToken: string;
  try {
    accessToken = await getAccessToken();
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error de autenticación Google" }, { status: 500 });
  }

  const results = await Promise.allSettled(
    items.map(async item => {
      const fileId = extractDriveFileId(item.fileUrl);
      if (!fileId) return { ...item, nombre: null, monto: null, moneda: null, fecha: null, error: "URL de Drive inválida" };

      try {
        const pdfBase64 = await downloadPdfAsBase64(fileId, accessToken);
        const analysis = await analyzeWithGemini(pdfBase64);
        return { ...item, ...analysis };
      } catch (e) {
        return { ...item, nombre: null, monto: null, moneda: null, fecha: null, error: e instanceof Error ? e.message : "Error desconocido" };
      }
    })
  );

  const output = results.map(r => r.status === "fulfilled" ? r.value : { nombre: null, monto: null, moneda: null, fecha: null, error: String((r as PromiseRejectedResult).reason) });
  return NextResponse.json({ ok: true, results: output });
}
