export const CANDIDATE_FIELDS = [
  { key: "name", label: "Name", required: true },
  { key: "email", label: "Email", required: false },
  { key: "phone", label: "Phone", required: false },
  { key: "skills", label: "Skills (comma separated)", required: false },
  { key: "roleInterest", label: "Role interest (comma separated)", required: false },
  { key: "experienceLevel", label: "Experience level", required: false },
  { key: "location", label: "Location", required: false },
  { key: "remoteOk", label: "Remote OK (yes/no)", required: false },
  { key: "linkedinUrl", label: "LinkedIn / portfolio URL", required: false },
  { key: "resumeUrl", label: "Resume URL", required: false },
  { key: "notes", label: "Notes", required: false },
] as const;

export type CandidateFieldKey = (typeof CANDIDATE_FIELDS)[number]["key"];

export type FieldMapping = Partial<Record<CandidateFieldKey, string>>;

function splitList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function parseBool(value: string | undefined): boolean {
  if (!value) return false;
  return ["yes", "true", "y", "1"].includes(value.trim().toLowerCase());
}

// Applies a saved column -> field mapping to one raw CSV row, producing the
// normalized shape stored on Candidate. rawFields keeps the original row so
// nothing is lost even if the mapping missed a column.
export function mapRowToCandidate(row: Record<string, string>, mapping: FieldMapping) {
  const get = (key: CandidateFieldKey) => {
    const col = mapping[key];
    return col ? row[col]?.trim() : undefined;
  };

  return {
    name: get("name") || "Unknown",
    email: get("email") || null,
    phone: get("phone") || null,
    skills: splitList(get("skills")),
    roleInterest: splitList(get("roleInterest")),
    experienceLevel: get("experienceLevel") || null,
    location: get("location") || null,
    remoteOk: parseBool(get("remoteOk")),
    linkedinUrl: get("linkedinUrl") || null,
    resumeUrl: get("resumeUrl") || null,
    notes: get("notes") || null,
    rawFields: row,
  };
}
