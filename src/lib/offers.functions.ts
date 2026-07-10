import { z } from "zod";

const inputSchema = z.object({
  candidateName: z.string().min(1).max(160),
  jobTitle: z.string().min(1).max(160),
  department: z.string().max(160).optional().default(""),
  location: z.string().max(160).optional().default(""),
  employmentType: z.string().max(80).optional().default("Full-time"),
  annualCtc: z.number().nonnegative().optional().default(0),
  joiningDate: z.string().max(40).optional().default(""),
  reportingManager: z.string().max(160).optional().default(""),
  extraNotes: z.string().max(2000).optional().default(""),
});

function salaryBreakup(annualCtc: number) {
  const basic = Math.round(annualCtc * 0.5);
  const hra = Math.round(annualCtc * 0.4);
  const allowance = Math.max(0, annualCtc - basic - hra);
  return { basic, hra, allowance };
}

const COMPANY = {
  name: "Tericsoft Technology Solutions Pvt. Ltd.",
  address:
    "3rd Floor, 16-2-664/1, Yunas Plaza, Press Road, New Malakpet, Hyderabad, TS 500036",
  cin: "U72900TG2018PTC125275",
  web: "www.tericsoft.com",
  phone: "+91-9398093938",
  email: "info@tericsoft.com",
};

function inr(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

function fallbackLetter(d: z.infer<typeof inputSchema>) {
  const { basic, hra, allowance } = salaryBreakup(d.annualCtc);
  const today = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const salarySection =
    d.annualCtc > 0
      ? `\nCompensation:\nYour total annual Cost to Company (CTC) will be ${inr(d.annualCtc)}, structured as follows:\n  • Basic Salary: ${inr(basic)} per annum\n  • House Rent Allowance (HRA): ${inr(hra)} per annum\n  • Special Allowance: ${inr(allowance)} per annum\n`
      : "";
  return `Date: ${today}

Dear ${d.candidateName},

Subject: Offer of Employment — ${d.jobTitle}

We are pleased to offer you the position of ${d.jobTitle}${d.department ? ` in the ${d.department} department` : ""} at ${COMPANY.name}. Your ${d.employmentType} employment will be based at ${d.location || "our Hyderabad office"}${d.joiningDate ? `, with a tentative joining date of ${d.joiningDate}` : ""}.
${salarySection}${d.reportingManager ? `\nYou will report to ${d.reportingManager}.\n` : ""}
This offer is subject to satisfactory completion of background verification and submission of the required documents. We are confident that your skills and experience will be a valuable addition to our team.

Please sign and return a copy of this letter to indicate your acceptance of this offer.
${d.extraNotes ? `\n${d.extraNotes}\n` : ""}
We look forward to welcoming you aboard.

Warm regards,

Human Resources
${COMPANY.name}`;
}

export async function generateOfferLetter(data: z.infer<typeof inputSchema>) {
  const parsed = inputSchema.parse(data);
  const key = import.meta.env.VITE_GEMINI_API_KEY;
  const { basic, hra, allowance } = salaryBreakup(parsed.annualCtc);
  if (!key) return { content: fallbackLetter(parsed) };

  const prompt = `You are the HR team at ${COMPANY.name} (CIN ${COMPANY.cin}, ${COMPANY.address}). Write a professional, warm offer letter body in plain text (no markdown, no letterhead, no company address block, no logo — those are pre-printed). Keep it concise and formal.

Candidate: ${parsed.candidateName}
Position: ${parsed.jobTitle}
Department: ${parsed.department || "N/A"}
Location: ${parsed.location || "Hyderabad office"}
Employment type: ${parsed.employmentType}
Joining date: ${parsed.joiningDate || "to be confirmed"}
Reporting manager: ${parsed.reportingManager || "N/A"}
Annual CTC: ${parsed.annualCtc > 0 ? inr(parsed.annualCtc) : "to be discussed"}
Salary breakup (company policy: 50% basic, 40% HRA, remainder special allowance): Basic ${inr(basic)}, HRA ${inr(hra)}, Special Allowance ${inr(allowance)}.
Additional notes: ${parsed.extraNotes || "none"}

Include: greeting, the offer of the role, compensation with the exact breakup above (only if CTC > 0), a line about background verification/documents, an acceptance line, and a warm closing signed by "Human Resources, ${COMPANY.name}". Start with a "Date:" line using today's date.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.5 },
        }),
      },
    );
    if (!res.ok) {
      console.error(`Gemini offer letter error [${res.status}]: ${await res.text()}`);
      return { content: fallbackLetter(parsed) };
    }
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text =
      json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim() ?? "";
    return { content: text || fallbackLetter(parsed) };
  } catch (e) {
    console.error("Offer letter generation failed", e);
    return { content: fallbackLetter(parsed) };
  }
}
