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

  const prompt = `Eres un auditor de RRHH revisando boletas/facturas de honorarios para Global66.
Extrae SOLO datos del EMISOR/PRESTADOR de la boleta, es decir, la persona o proveedor que cobra.
NO uses como nombre a Global66, Global 66, Global81, Global 81, Global Card ni empresas relacionadas: esas suelen ser receptor/cliente/razon social receptora.
Si el documento tiene secciones como receptor, cliente, destinatario, señor(es), empresa o pagador, IGNORA esos datos para el nombre.

Extrae:
1. nombre: nombre completo del emisor/prestador/persona que factura/cobra. Si no se distingue, null.
2. monto: monto total liquido/neto/a pagar de la boleta, como numero sin signos ni separadores.
3. moneda: codigo ISO de 3 letras. Usa CLP para pesos chilenos, COP para pesos colombianos, ARS para pesos argentinos, PEN para soles, USD para dolares, EUR para euros.
4. fecha: fecha de emision del documento en formato YYYY-MM-DD.

Responde SOLO con JSON válido, sin texto adicional:
{"nombre": "<nombre completo o null>", "monto": <número o null>, "moneda": "<moneda o null>", "fecha": "<YYYY-MM-DD o null>"}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
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
        generationConfig: { temperature: 0, maxOutputTokens: 1024 },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map((part: { text?: string }) => part.text ?? "")
    .join("");
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`Gemini no devolvió JSON válido: ${text.slice(0, 200)}`);

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const rawMoneda = typeof parsed.moneda === "string" && parsed.moneda !== "null" ? parsed.moneda.toUpperCase() : null;
    const monedaMap: Record<string, string> = {
      PESOS: "CLP",
      PESO: "CLP",
      "PESOS CHILENOS": "CLP",
      "PESO CHILENO": "CLP",
      "PESOS COLOMBIANOS": "COP",
      "PESO COLOMBIANO": "COP",
      "PESOS ARGENTINOS": "ARS",
      "PESO ARGENTINO": "ARS",
      SOLES: "PEN",
      SOL: "PEN",
      DOLARES: "USD",
      DOLAR: "USD",
    };
    return {
      nombre: typeof parsed.nombre === "string" && parsed.nombre !== "null" ? parsed.nombre : null,
      monto: typeof parsed.monto === "number" ? parsed.monto : null,
      moneda: rawMoneda ? (monedaMap[rawMoneda] ?? rawMoneda) : null,
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
