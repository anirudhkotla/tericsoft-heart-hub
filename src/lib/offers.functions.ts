import { z } from "zod";
import { callGemini, geminiText } from "@/lib/gemini-proxy";

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

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formattedDate(): string {
  const d = new Date();
  const day = ordinal(d.getDate());
  const month = d.toLocaleDateString("en-IN", { month: "long" });
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

function fallbackLetter(d: z.infer<typeof inputSchema>) {
  const { basic, hra, allowance } = salaryBreakup(d.annualCtc);
  const today = formattedDate();
  const isIntern = d.employmentType.toLowerCase().includes("intern");

  let body: string;

  if (isIntern) {
    const stipend = Math.round(d.annualCtc / 12);
    body = `Subject: Internship at Tericsoft Technology
Dear ${d.candidateName},

In reference to your application, we would like to congratulate you on your internship being extended for the position of ${d.jobTitle}${d.department ? ` in the ${d.department} department` : ""}. Your internship is scheduled to start effective from ${d.joiningDate || "to be confirmed"}. All of us at Tericsoft are excited that you will be joining our team.

As such, your internship will include training and focus primarily on learning and developing new skills and gaining a deeper understanding of ${d.department || "your field"}${d.reportingManager ? `, working alongside ${d.reportingManager}` : ""}${d.extraNotes ? `. ${d.extraNotes}` : ""}.

Date of Joining: ${d.joiningDate || "To be confirmed"}
Timings: 10:30am – 7pm
Weekdays: Monday to Friday
${d.annualCtc > 0 ? `Stipend: ${inr(stipend).replace("₹", "").trim()} per month` : ""}

Again, congratulations and we look forward to working with you.

Yours sincerely,


Abdul Rahman
Director
Tericsoft Technology

I accept the terms of this offer with Tericsoft.
_____________________________________ Date -_______________________________________
${d.candidateName}`;
  } else {
    const salarySection =
      d.annualCtc > 0
        ? `\nCompensation:\nYour total annual Cost to Company (CTC) will be ${inr(d.annualCtc)}, structured as follows:\n  • Basic Salary: ${inr(basic)} per annum\n  • House Rent Allowance (HRA): ${inr(hra)} per annum\n  • Special Allowance: ${inr(allowance)} per annum\n`
        : "";
    body = `Subject: Offer of Employment — ${d.jobTitle}
Dear ${d.candidateName},

We are pleased to offer you the position of ${d.jobTitle}${d.department ? ` in the ${d.department} department` : ""} at ${COMPANY.name}. Your ${d.employmentType} employment will be based at ${d.location || "our Hyderabad office"}${d.joiningDate ? `, effective from ${d.joiningDate}` : ""}. We are confident that your skills and experience will be a valuable addition to our team.
${salarySection}${d.reportingManager ? `\nYou will report to ${d.reportingManager}.\n` : ""}
${d.extraNotes ? `${d.extraNotes}\n` : ""}
This offer is subject to satisfactory completion of background verification and submission of the required documents.

Please sign and return a copy of this letter to indicate your acceptance of this offer.

We look forward to welcoming you aboard.

Yours sincerely,


Abdul Rahman
Director
Tericsoft Technology

I accept the terms of this offer with Tericsoft.
_____________________________________ Date -_______________________________________
${d.candidateName}`;
  }

  return `${today}\n\n${body}`;
}

export async function generateOfferLetter(data: z.infer<typeof inputSchema>) {
  const parsed = inputSchema.parse(data);
  const { basic, hra, allowance } = salaryBreakup(parsed.annualCtc);

  const isIntern = parsed.employmentType.toLowerCase().includes("intern");
  const stipend = Math.round(parsed.annualCtc / 12);

  const prompt = `You are generating an offer letter for ${COMPANY.name}. Write ONLY the letter body as plain text (no markdown, no letterhead/logo/address — those are pre-printed on the letterhead).

${isIntern ? `INTERNSHIP FORMAT — Use this exact structure:
Subject: Internship at Tericsoft Technology
Dear [Candidate Name],

Congratulatory paragraph about the internship being extended for the position of ${parsed.jobTitle}${parsed.department ? ` in the ${parsed.department} department` : ""}, starting ${parsed.joiningDate || "to be confirmed"}.

Paragraph about training, learning, and working alongside ${parsed.reportingManager || "the team"}.

Details:
Date of Joining: ${parsed.joiningDate || "To be confirmed"}
Timings: 10:30am – 7pm
Weekdays: Monday to Friday
${parsed.annualCtc > 0 ? `Stipend: ${inr(stipend).replace("₹", "").trim()} per month` : ""}

Closing congratulations line.

Yours sincerely,

(space for signature)

Abdul Rahman
Director
Tericsoft Technology

Acceptance section:
I accept the terms of this offer with Tericsoft.
_____________________________________ Date -_______________________________________
${parsed.candidateName}` : `FULL-TIME FORMAT — Use this exact structure:
Subject: Offer of Employment — ${parsed.jobTitle}
Dear ${parsed.candidateName},

Paragraph offering the position of ${parsed.jobTitle}${parsed.department ? ` in the ${parsed.department} department` : ""} at ${COMPANY.name}${parsed.joiningDate ? `, effective from ${parsed.joiningDate}` : ""}.

${parsed.annualCtc > 0 ? `Compensation section with annual CTC of ${inr(parsed.annualCtc)} and breakup: Basic ${inr(basic)}, HRA ${inr(hra)}, Special Allowance ${inr(allowance)}.` : ""}

${parsed.reportingManager ? `Reporting line: will report to ${parsed.reportingManager}.` : ""}

${parsed.extraNotes ? `${parsed.extraNotes}` : ""}

Background verification and document submission line.

Acceptance request line.

Closing line.

Yours sincerely,

(space for signature)

Abdul Rahman
Director
Tericsoft Technology

Acceptance section:
I accept the terms of this offer with Tericsoft.
_____________________________________ Date -_______________________________________
${parsed.candidateName}`}

Date format: "${formattedDate()}" (ordinal day, month, year).

Candidate: ${parsed.candidateName}
Position: ${parsed.jobTitle}
Department: ${parsed.department || "N/A"}
Location: ${parsed.location || "Hyderabad office"}
Employment type: ${parsed.employmentType}
Joining date: ${parsed.joiningDate || "to be confirmed"}
Reporting manager: ${parsed.reportingManager || "N/A"}
${isIntern && parsed.annualCtc > 0 ? `Monthly stipend: ${inr(stipend).replace("₹", "").trim()}` : `Annual CTC: ${parsed.annualCtc > 0 ? inr(parsed.annualCtc) : "to be discussed"}${parsed.annualCtc > 0 ? `\nSalary breakup: Basic ${inr(basic)}, HRA ${inr(hra)}, Special Allowance ${inr(allowance)}` : ""}`}
Additional notes: ${parsed.extraNotes || "none"}`;

  try {
    const response = await callGemini({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.5 },
    });
    const text = geminiText(response).trim();
    return { content: text || fallbackLetter(parsed) };
  } catch (e) {
    console.error("Offer letter generation failed", e);
    return { content: fallbackLetter(parsed) };
  }
}
