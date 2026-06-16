// The six "tales" — single source of truth for panels, journal, and map markers.
// Content is fixed from Prateek's CV; do not invent facts. LinkedIn stays a TODO.

export interface Stop {
  id: string;
  locale: string; // Middle-earth place name
  org: string; // "Role · Company"
  era: string;
  headline: string;
  bullets: string[];
  stack: string[];
  /** filename (no ext) under public/assets/models — the ChatGPT→Meshy landmark */
  model: string;
}

export const STOPS: Stop[] = [
  {
    id: "shire",
    locale: "The Shire",
    org: "B.Tech IT · OURT, Bhubaneswar",
    era: "2018 – 2022",
    headline: "Where the road begins.",
    bullets: [
      "B.Tech in Information Technology",
      "Odisha University of Research & Technology",
      "Foundations: algorithms, systems, and the love of building",
    ],
    stack: ["C", "Java", "DSA"],
    model: "shire-home",
  },
  {
    id: "bywater",
    locale: "Bywater Mill",
    org: "SDE Intern · Milk Mantra",
    era: "Sep 2020 – Mar 2021",
    headline: "First craft at the mill.",
    bullets: [
      "Built 3 payment gateways into the MilkyMoo app",
      "Zero to App Store in 3 months — solo",
    ],
    stack: ["Flutter", "Payments", "Mobile"],
    model: "bywater-mill",
  },
  {
    id: "bree",
    locale: "Bree, the crossroads",
    org: "Product Developer · Aarna",
    era: "Jun 2021 – Apr 2022",
    headline: "Coin & exchange at the market town.",
    bullets: [
      "Crypto portfolio dashboard — 10+ tokens, 5+ exchanges, 4 chains",
      "Redis cache cut third-party calls by 50%",
    ],
    stack: ["Node.js", "Redis", "Web3"],
    model: "bree-inn",
  },
  {
    id: "edoras",
    locale: "Edoras of Rohan",
    org: "Product Lead · Frifty",
    era: "Jun 2022 – Jul 2023",
    headline: "Built the hall from the ground up.",
    bullets: [
      "Owned AWS + MongoDB Atlas infrastructure from scratch",
      "A 50+ component internal design system",
      "React bundle optimization across the product",
    ],
    stack: ["AWS", "MongoDB", "React"],
    model: "edoras-hall",
  },
  {
    id: "isengard",
    locale: "Isengard — the Works",
    org: "Full Stack Developer · Dextr Labs",
    era: "Jul 2023 – Dec 2024",
    headline: "The works of Orthanc: realtime & on-chain.",
    bullets: [
      "Real-time fantasy-sports backend (GraphQL, Redis, AWS Step Functions, SSE)",
      "RWA NFT trading platform (Ethers.js, Web3Auth, Ethereum/Polygon)",
      "CI/CD 45→10 min · composite-index refactor p95 12s→5s",
    ],
    stack: ["Node.js", "GraphQL", "AWS", "Web3"],
    model: "isengard-tower",
  },
  {
    id: "minas",
    locale: "Minas Tirith",
    org: "SDE-II · Pathfndr",
    era: "Jan 2025 – present",
    headline: "The summit — hotel search, 60× faster.",
    bullets: [
      "Hotel-search p95 20s → 300–700ms (60×)",
      "3 microservices on GCP GKE; aggregator over 6 supplier APIs (1.2K hotels <10s)",
      "Production RAG (Pinecone + OpenAI); AI agent cut supplier onboarding 75%",
    ],
    stack: ["TypeScript", "NestJS", "GCP", "RAG"],
    model: "minas-tirith",
  },
];

export const CONTACT = {
  name: "Prateek Kumar Mohanty",
  role: "Backend Engineer · SDE-II",
  email: "itsprateekmohanty@gmail.com",
  github: "https://github.com/StrangeNoob",
  resume: "https://prateekm.dev/pdf/Prateek%20Kumar%20Mohanty.pdf",
  // LINKEDIN_URL TODO — Prateek to supply
  linkedin: "",
};
