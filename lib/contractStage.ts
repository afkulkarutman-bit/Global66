export type ContractStage = "plazo_fijo_3m" | "extension_6m" | "indefinido";

export const STAGE_LABELS: Record<ContractStage, string> = {
  plazo_fijo_3m: "Plazo fijo 3 meses",
  extension_6m: "Extensión 6 meses",
  indefinido: "Indefinido",
};

export function isB2B(employee: {
  cargo?: string | null;
  area?: string | null;
  centro_costo?: string | null;
}): boolean {
  const text = `${employee.cargo ?? ""} ${employee.area ?? ""} ${employee.centro_costo ?? ""}`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  return text.includes("b2b");
}

export function detectContractStage(
  employee: { cargo?: string | null; area?: string | null; centro_costo?: string | null },
  approvedFeedbackCount: number
): ContractStage {
  const b2b = isB2B(employee);
  if (!b2b) return approvedFeedbackCount >= 1 ? "indefinido" : "plazo_fijo_3m";
  if (approvedFeedbackCount >= 2) return "indefinido";
  if (approvedFeedbackCount === 1) return "extension_6m";
  return "plazo_fijo_3m";
}

export function calcFechaTermino(
  fechaIngreso: string | null | undefined,
  stage: ContractStage
): string | null {
  if (stage === "indefinido") return null;
  if (!fechaIngreso || fechaIngreso === "NA") return null;
  const date = new Date(`${fechaIngreso.slice(0, 10)}T12:00:00`);
  if (isNaN(date.getTime())) return null;
  if (stage === "plazo_fijo_3m") date.setDate(date.getDate() + 90);
  else if (stage === "extension_6m") date.setMonth(date.getMonth() + 6);
  return date.toISOString().slice(0, 10);
}
