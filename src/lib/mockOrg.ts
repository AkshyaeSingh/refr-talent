import { prisma } from "@/lib/prisma";

// A permanent, always-available demo org every real org can connect with to
// try search before committing to importing their own pool. Lazily
// self-seeds on first use (idempotent — safe to call on every request) since
// this app has no separate data-seeding step in production.
export const MOCK_ORG_SLUG = "mock-talent-org-demo";
export const MOCK_ORG_NAME = "Mock Talent Org";

type SeedCandidate = {
  name: string;
  headline: string;
  summary: string;
  topics: string[];
  credentials: string[];
  skills: string[];
  roleInterest: string[];
  experienceLevel: string;
  location: string;
  remoteOk: boolean;
  audienceTier?: string;
};

const SEED_CANDIDATES: SeedCandidate[] = [
  {
    name: "Priya Natarajan",
    headline: "Interpretability researcher, first-author on 3 mechanistic interp papers",
    summary: "Studies circuit-level behavior in transformer language models; published at NeurIPS and ICML workshops.",
    topics: ["Interpretability", "Research"],
    credentials: ["MATS", "first-author", "AI safety org"],
    skills: ["mechanistic interpretability", "pytorch", "circuit analysis"],
    roleInterest: ["research"],
    experienceLevel: "Senior",
    location: "Berkeley, CA",
    remoteOk: true,
  },
  {
    name: "Sam Reyes",
    headline: "ML researcher focused on evals and dangerous capability testing",
    summary: "Built capability evaluation suites for frontier models; background in RL and red-teaming.",
    topics: ["Evals", "Research"],
    credentials: ["ARENA", "AI safety org"],
    skills: ["reinforcement learning", "evals", "red-teaming"],
    roleInterest: ["research", "engineering"],
    experienceLevel: "Mid",
    location: "London, UK",
    remoteOk: true,
  },
  {
    name: "Dana Lee",
    headline: "Interpretability researcher, ex-academic ML PhD",
    summary: "PhD in machine learning; now works on sparse autoencoders and feature visualization for safety research.",
    topics: ["Interpretability"],
    credentials: ["PhD", "MATS", "Alignment Forum"],
    skills: ["sparse autoencoders", "interpretability", "jax"],
    roleInterest: ["research"],
    experienceLevel: "Senior",
    location: "Remote",
    remoteOk: true,
  },
  {
    name: "Marcus Webb",
    headline: "AI policy analyst with 4 years in DC",
    summary: "Advised congressional staff on AI governance frameworks; former BlueDot fellow.",
    topics: ["Policy", "Communications"],
    credentials: ["BlueDot / AISF", "AI safety org"],
    skills: ["policy analysis", "regulatory frameworks", "stakeholder engagement"],
    roleInterest: ["policy"],
    experienceLevel: "Senior",
    location: "Washington, DC",
    remoteOk: false,
  },
  {
    name: "Amara Okafor",
    headline: "Governance researcher, international AI coordination",
    summary: "Focuses on multilateral AI governance mechanisms and compute governance; based in DC think-tank circles.",
    topics: ["Policy"],
    credentials: ["BlueDot / AISF", "EA university group"],
    skills: ["international relations", "compute governance", "policy writing"],
    roleInterest: ["policy"],
    experienceLevel: "Mid",
    location: "Washington, DC",
    remoteOk: true,
  },
  {
    name: "Andres Nino",
    headline: "Science communicator explaining AI safety to 250k+ subscribers",
    summary: "Runs a popular YouTube channel translating AI safety research into accessible video essays; former ML engineer.",
    topics: ["Communications", "Field-building"],
    credentials: ["Viral creator (100k+)", "Founder"],
    skills: ["video production", "science communication", "public speaking"],
    roleInterest: ["communications"],
    experienceLevel: "Senior",
    location: "Los Angeles, CA",
    remoteOk: true,
    audienceTier: "100k-1M",
  },
  {
    name: "Lena Fischer",
    headline: "AI safety writer and newsletter creator, 15k subscribers",
    summary: "Writes a weekly newsletter breaking down AI safety papers for a general audience; background in journalism.",
    topics: ["Communications"],
    credentials: ["EA university group"],
    skills: ["writing", "science communication", "newsletter growth"],
    roleInterest: ["communications"],
    experienceLevel: "Mid",
    location: "Remote",
    remoteOk: true,
    audienceTier: "10-100k",
  },
  {
    name: "Priya Chandrasekaran",
    headline: "Backend engineer, 6 years, open to AI safety org roles",
    summary: "Full-stack engineer with production ML infra experience; wants to transition into safety-focused work.",
    topics: ["Engineering"],
    credentials: ["OSS"],
    skills: ["typescript", "python", "kubernetes", "ml infra"],
    roleInterest: ["engineering"],
    experienceLevel: "Senior",
    location: "Toronto, Canada",
    remoteOk: true,
  },
  {
    name: "Tomás Álvarez",
    headline: "Research engineer supporting interpretability experiments",
    summary: "Builds tooling and infra for interpretability research teams; strong systems background.",
    topics: ["Engineering", "Interpretability"],
    credentials: ["MARS", "OSS"],
    skills: ["python", "distributed systems", "ml tooling"],
    roleInterest: ["engineering", "research"],
    experienceLevel: "Mid",
    location: "Berlin, Germany",
    remoteOk: true,
  },
  {
    name: "Grace Kim",
    headline: "Operations lead for AI safety field-building programs",
    summary: "Ran logistics and community for a 40-person AI safety fellowship cohort; strong program management background.",
    topics: ["Operations", "Field-building"],
    credentials: ["EA university group"],
    skills: ["program management", "community building", "event ops"],
    roleInterest: ["operations"],
    experienceLevel: "Mid",
    location: "San Francisco, CA",
    remoteOk: true,
  },
  {
    name: "Noah Bergström",
    headline: "Field-building organizer, university AI safety group founder",
    summary: "Founded and grew a university AI safety reading group into a 60-member org; now works on movement building.",
    topics: ["Field-building", "Communications"],
    credentials: ["EA university group", "Founder"],
    skills: ["community organizing", "curriculum design", "outreach"],
    roleInterest: ["operations", "communications"],
    experienceLevel: "Junior",
    location: "Stockholm, Sweden",
    remoteOk: true,
  },
  {
    name: "Fatima Al-Sayed",
    headline: "Interpretability researcher, LASR Labs alum",
    summary: "Works on activation steering and model internals; presented at an Alignment Forum workshop.",
    topics: ["Interpretability", "Research"],
    credentials: ["LASR Labs", "Alignment Forum"],
    skills: ["activation steering", "interpretability", "pytorch"],
    roleInterest: ["research"],
    experienceLevel: "Mid",
    location: "Oxford, UK",
    remoteOk: true,
  },
  {
    name: "Ryan O'Connell",
    headline: "AI safety podcast host, 40k monthly listeners",
    summary: "Interviews researchers and policymakers about AI risk on a weekly podcast; former academic.",
    topics: ["Communications"],
    credentials: ["Viral creator (100k+)", "Founder"],
    skills: ["podcasting", "interviewing", "science communication"],
    roleInterest: ["communications"],
    experienceLevel: "Senior",
    location: "Remote",
    remoteOk: true,
    audienceTier: "10-100k",
  },
  {
    name: "Wei Zhang",
    headline: "Governance researcher specializing in compute policy",
    summary: "PhD candidate studying compute governance mechanisms; policy fellow in DC for one year.",
    topics: ["Policy", "Research"],
    credentials: ["PhD", "BlueDot / AISF"],
    skills: ["compute governance", "policy research", "quantitative analysis"],
    roleInterest: ["policy", "research"],
    experienceLevel: "Mid",
    location: "Washington, DC",
    remoteOk: false,
  },
  {
    name: "Isabela Costa",
    headline: "Evals engineer building red-team benchmarks",
    summary: "Designs adversarial benchmarks for frontier model safety evaluations; background in security research.",
    topics: ["Evals", "Engineering"],
    credentials: ["ARENA", "OSS"],
    skills: ["security research", "benchmark design", "python"],
    roleInterest: ["research", "engineering"],
    experienceLevel: "Mid",
    location: "São Paulo, Brazil",
    remoteOk: true,
  },
  {
    name: "Jonas Weber",
    headline: "Junior interpretability researcher, ARENA graduate",
    summary: "Recently completed ARENA's technical AI safety program; looking for first research role.",
    topics: ["Interpretability"],
    credentials: ["ARENA"],
    skills: ["pytorch", "interpretability basics", "python"],
    roleInterest: ["research"],
    experienceLevel: "Junior",
    location: "Munich, Germany",
    remoteOk: true,
  },
  {
    name: "Aisha Rahman",
    headline: "Communications lead translating research for policymakers",
    summary: "Bridges technical AI safety research and policy audiences; writes explainers for a DC-based think tank.",
    topics: ["Communications", "Policy"],
    credentials: ["BlueDot / AISF"],
    skills: ["policy writing", "science communication", "stakeholder briefings"],
    roleInterest: ["communications", "policy"],
    experienceLevel: "Mid",
    location: "Washington, DC",
    remoteOk: true,
  },
  {
    name: "Liam Sullivan",
    headline: "Founder of an AI safety explainer YouTube channel, 90k subscribers",
    summary: "Full-time creator making short-form video explainers about AI risk; background in animation.",
    topics: ["Communications", "Field-building"],
    credentials: ["Viral creator (100k+)", "Founder"],
    skills: ["animation", "video editing", "science communication"],
    roleInterest: ["communications"],
    experienceLevel: "Mid",
    location: "Remote",
    remoteOk: true,
    audienceTier: "10-100k",
  },
];

let ensured: Promise<string> | null = null;

async function seed(): Promise<string> {
  const existing = await prisma.org.findUnique({ where: { slug: MOCK_ORG_SLUG } });
  if (existing) return existing.id;

  const org = await prisma.org.create({
    data: {
      name: MOCK_ORG_NAME,
      slug: MOCK_ORG_SLUG,
      orgType: "both",
      focusAreas: ["Research", "Policy", "Communications", "Engineering", "Field-building"],
      description:
        "A sample talent pool so you can try search before connecting your own — spanning interpretability " +
        "research, policy, science communication, engineering, and field-building.",
    },
  });

  await prisma.candidate.createMany({
    data: SEED_CANDIDATES.map((c) => ({
      orgId: org.id,
      name: c.name,
      headline: c.headline,
      summary: c.summary,
      topics: c.topics,
      credentials: c.credentials,
      skills: c.skills,
      roleInterest: c.roleInterest,
      experienceLevel: c.experienceLevel,
      location: c.location,
      remoteOk: c.remoteOk,
      audienceTier: c.audienceTier,
      consentToShare: true,
      profileExtractedAt: new Date(),
    })),
  });

  return org.id;
}

// Idempotent + memoized within the process: safe to call on every request.
export function ensureMockOrg(): Promise<string> {
  if (!ensured) ensured = seed();
  return ensured;
}
