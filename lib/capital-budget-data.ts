// 2026/27 HRM Draft Capital Budget — project-level detail
// Source: https://cdn.halifax.ca/sites/default/files/documents/city-hall/budget-finances/2026-27-draft-capital-budget-book-digital-version.pdf
// Figures in thousands of CAD. Only projects with 2026/27 > 0 are listed.
// Categories match the budget book; combined totals from the overview table.

export type Project = {
  id: string;    // project code from budget book
  name: string;
  amount: number; // 2026/27 planned spend, thousands CAD
  note?: string;
};

export type CategoryDetail = {
  key: string;
  label: string;
  /** 2026/27 total in thousands (from overview table) */
  total: number;
  color: string;       // Tailwind bg class
  textColor: string;   // Tailwind text class
  ringColor: string;   // Tailwind ring class for selected state
  bgSelected: string;  // Tailwind bg for selected row
  /** Sub-sections inside this category (e.g. Bridges / Roads & AT) */
  sections?: {
    title: string;
    projects: Project[];
  }[];
  /** Flat project list (no sub-sections) */
  projects?: Project[];
  /** True if we don't have project-level detail yet */
  detailPending?: boolean;
};

export const CATEGORIES: CategoryDetail[] = [
  // ─── Roads, Active Transportation & Bridges ───────────────────────────────
  // Base Capital $76,404k + Strategic Integrated Mobility $74,760k = $151,164k
  {
    key: 'roads',
    label: 'Roads & Active Transport',
    total: 151_164,
    color: 'bg-blue-500',
    textColor: 'text-blue-600 dark:text-blue-400',
    ringColor: 'ring-blue-400',
    bgSelected: 'bg-blue-500/8 dark:bg-blue-500/12',
    sections: [
      {
        title: 'Street Recapitalization & Major Projects',
        projects: [
          { id: 'CR200006', name: 'Street Recapitalization', amount: 53_010 },
          { id: 'CT190009', name: 'Strategic Mobility Corridors – Land Acquisition', amount: 30_000 },
          { id: 'CT190010', name: 'Windsor Street Exchange', amount: 29_900 },
          { id: 'CT200002', name: 'Strategic Mobility Corridor: Bayers Road', amount: 14_560 },
        ],
      },
      {
        title: 'Bridges',
        projects: [
          { id: 'CR200003', name: 'Bridges', amount: 2_039 },
        ],
      },
      {
        title: 'Active Transportation & Local Roads',
        projects: [
          { id: 'CR200001', name: 'Active Transportation', amount: 5_600 },
          { id: 'CR200007', name: 'Regional Centre AAA Bikeways', amount: 3_370 },
          { id: 'CT000012', name: 'Ross Road Realignment', amount: 3_500 },
          { id: 'CB220004', name: 'Mumford Terminal Interim Accessibility Expansion', amount: 2_350 },
          { id: 'CT000007', name: 'Cogswell Interchange Redevelopment', amount: 2_000 },
          { id: 'CT240001', name: 'Dartmouth Infra Renewal – Patou\'kn St', amount: 1_650 },
          { id: 'CR200002', name: 'Sidewalk Renewals', amount: 1_000 },
          { id: 'CM190002', name: 'Bus Stop Accessibility / Improvements', amount: 720 },
          { id: 'CTU01006', name: 'Bedford West Road Oversizing', amount: 470 },
          { id: 'CT190001', name: 'Streetscaping', amount: 500 },
          { id: 'CR210007', name: 'New Paving Subdivisions – Provincial Roads', amount: 150 },
        ],
      },
    ],
  },

  // ─── Buildings & Facilities ───────────────────────────────────────────────
  {
    key: 'buildings',
    label: 'Buildings & Facilities',
    total: 63_596,
    color: 'bg-amber-500',
    textColor: 'text-amber-600 dark:text-amber-400',
    ringColor: 'ring-amber-400',
    bgSelected: 'bg-amber-500/8 dark:bg-amber-500/12',
    sections: [
      {
        title: 'Recreation & Community Facilities',
        projects: [
          { id: 'CB000080', name: 'Sheet Harbour Rec Centre (ESLC)', amount: 13_590 },
          { id: 'CB230027', name: 'New Organics Facility', amount: 8_510 },
          { id: 'CB000068', name: 'PFE – General Building Recapitalization', amount: 1_731 },
          { id: 'CB190013', name: 'Halifax Forum Redevelopment', amount: 2_600 },
          { id: 'CB200008', name: 'PR – Scotiabank Centre', amount: 2_928 },
          { id: 'CB240003', name: 'PR – WG Bengal Lancers Arena', amount: 1_850 },
        ],
      },
      {
        title: 'Fire & Emergency Services',
        projects: [
          { id: 'CB000014', name: 'HRFE – Headquarters and Station 1', amount: 10_535, note: '+ $8.1M in 2027/28' },
          { id: 'CB000068b', name: 'HRFE – Facility Recap', amount: 2_835 },
        ],
      },
      {
        title: 'Corporate & Operations',
        projects: [
          { id: 'CB190011', name: 'Corporate Accommodations', amount: 2_800 },
          { id: 'CB000003', name: 'HRP – Bedford/Mill Cove Library', amount: 500 },
          { id: 'CB000016', name: 'HT – Transit Facility Investment Strategy', amount: 610 },
          { id: 'CB000022', name: 'HT – Wrights Cove Terminal', amount: 5_118 },
        ],
      },
    ],
    detailPending: false,
  },

  // ─── Vehicles, Vessels & Equipment ───────────────────────────────────────
  {
    key: 'vehicles',
    label: 'Vehicles & Equipment',
    total: 46_425,
    color: 'bg-violet-500',
    textColor: 'text-violet-600 dark:text-violet-400',
    ringColor: 'ring-violet-400',
    bgSelected: 'bg-violet-500/8 dark:bg-violet-500/12',
    detailPending: true,
  },

  // ─── Outdoor Recreation ───────────────────────────────────────────────────
  {
    key: 'outdoor',
    label: 'Outdoor Recreation',
    total: 18_300,
    color: 'bg-emerald-500',
    textColor: 'text-emerald-600 dark:text-emerald-400',
    ringColor: 'ring-emerald-400',
    bgSelected: 'bg-emerald-500/8 dark:bg-emerald-500/12',
    sections: [
      {
        title: 'Parks',
        projects: [
          { id: 'CP200001', name: 'Park Recapitalization', amount: 8_950 },
          { id: 'CP200002', name: 'Halifax Common Upgrades', amount: 4_300 },
          { id: 'CP210013', name: 'Park Development – New', amount: 900 },
          { id: 'CP180002', name: 'Shoreline Improvements / Water Access', amount: 500 },
          { id: 'CP190002', name: 'Recreational Trails', amount: 100 },
          { id: 'CW200001', name: 'Halifax Organics Mgmt Facility (Goodwood)', amount: 50 },
        ],
      },
      {
        title: 'Outdoor Sport Facilities',
        projects: [
          { id: 'Build30', name: 'PR – Wanderers Grounds Bleacher Replacement', amount: 3_000 },
        ],
      },
    ],
  },

  // ─── Business Systems ─────────────────────────────────────────────────────
  {
    key: 'business',
    label: 'Business Systems (IT)',
    total: 4_525,
    color: 'bg-sky-500',
    textColor: 'text-sky-600 dark:text-sky-400',
    ringColor: 'ring-sky-400',
    bgSelected: 'bg-sky-500/8 dark:bg-sky-500/12',
    projects: [
      { id: 'CI250010', name: 'Transit Technology Solution Upgrades', amount: 1_000 },
      { id: 'CI200003', name: 'IT Infrastructure Recap', amount: 690 },
      { id: 'CI210013', name: 'HRFE Station Alerting', amount: 400 },
      { id: 'CI250009', name: 'TMR2 Radio Replacement', amount: 400 },
      { id: 'CI210019', name: 'Corporate Scheduling', amount: 500 },
      { id: 'BT74',     name: 'AI Innovation Initiatives', amount: 250 },
      { id: 'CI200005', name: 'Cyber Security', amount: 200 },
      { id: 'CI190010', name: 'Business Intelligence Program', amount: 150 },
      { id: 'CI190009', name: 'Application Recapitalization', amount: 100 },
      { id: 'CI230002', name: 'GIS Service Management', amount: 150 },
      { id: 'CI210016', name: 'HRP Security Monitoring – Video Surveillance', amount: 25 },
    ],
  },

  // ─── Traffic & Streetlights ───────────────────────────────────────────────
  {
    key: 'traffic',
    label: 'Traffic & Streetlights',
    total: 5_525,
    color: 'bg-orange-500',
    textColor: 'text-orange-600 dark:text-orange-400',
    ringColor: 'ring-orange-400',
    bgSelected: 'bg-orange-500/8 dark:bg-orange-500/12',
    sections: [
      {
        title: 'Traffic Signs & Signals',
        projects: [
          { id: 'CT190006', name: 'Road Safety Improvement', amount: 4_500 },
          { id: 'CT180003', name: 'Traffic Signal Re-lamping', amount: 400 },
          { id: 'CT200004', name: 'Controller Cabinet & Detection', amount: 350 },
          { id: 'CT190004', name: 'Opticom Signalization', amount: 25 },
        ],
      },
      {
        title: 'Streetlights',
        projects: [
          { id: 'CT200001', name: 'Street Lighting', amount: 250 },
        ],
      },
    ],
  },

  // ─── Other ────────────────────────────────────────────────────────────────
  // Rolls up: District Capital ($1,504k) + Other Assets ($7,553k) +
  // Significant Projects ($4,600k) + HalifACT ($810k)
  {
    key: 'other',
    label: 'Other Programs',
    total: 14_467,
    color: 'bg-foreground/25',
    textColor: 'text-foreground/50',
    ringColor: 'ring-foreground/30',
    bgSelected: 'bg-foreground/5',
    projects: [
      { id: 'Strategic', name: 'Significant Capital Projects (Strategic)', amount: 4_600 },
      { id: 'OtherAssets', name: 'Other Assets', amount: 7_553 },
      { id: 'District', name: 'District Capital Funds', amount: 1_504 },
      { id: 'HalifACT', name: 'HalifACT Climate Action Projects', amount: 810 },
    ],
  },
];

export const TOTAL_2627 = CATEGORIES.reduce((s, c) => s + c.total, 0);

export const PDF_URL =
  'https://cdn.halifax.ca/sites/default/files/documents/city-hall/budget-finances/2026-27-draft-capital-budget-book-digital-version.pdf';
