import OpenAI from "openai";

export type MedicalRecord = {
  diagnosis?: string;
  medication?: string;
  keywords?: string;
  description?: string;
};

export async function summarizeRecords(records: MedicalRecord[]): Promise<string> {
  if (!process.env.NEXT_PUBLIC_OPENROUTER_API_KEY) {
    throw new Error("Missing NEXT_PUBLIC_OPENROUTER_API_KEY");
  }

  if (!records?.length) {
    return "No records available to summarize.";
  }

  const openai = new OpenAI({
    apiKey: process.env.NEXT_PUBLIC_OPENROUTER_API_KEY,
    dangerouslyAllowBrowser: true,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "https://carechain.ai",
      "X-Title": process.env.NEXT_PUBLIC_SITE_NAME ?? "CareChain",
    },
  });

  const content = records
    .map(
      (r, i) =>
        `Record ${i + 1}:
Diagnosis: ${r.diagnosis || "N/A"}
Medication: ${r.medication || "N/A"}
Keywords: ${r.keywords || "N/A"}
Description: ${r.description || "N/A"}`
    )
    .join("\n\n");

  const prompt = `
You are a medical summarizer AI. Summarize the following patient medical records into a concise clinical summary highlighting trends, key diagnoses, and treatment patterns.

${content}
`;

  const completion = await openai.chat.completions.create({
    model: "openai/gpt-4o",
    messages: [{ role: "user", content: prompt }],
  });

  return completion.choices[0].message.content ?? "No summary generated.";
}
