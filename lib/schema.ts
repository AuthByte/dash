import { z } from "zod";

export const ThemeSlugSchema = z.enum([
  "photonics",
  "neocloud",
  "ai-semi",
  "energy",
  "natsec",
  "fintech",
  "consumer",
  "crypto",
  "macro",
]);
export type ThemeSlug = z.infer<typeof ThemeSlugSchema>;

export const StanceSchema = z.enum(["long", "neutral", "bearish", "exited"]);
export type Stance = z.infer<typeof StanceSchema>;

export const ConvictionSchema = z.enum(["high", "medium", "low"]);
export type Conviction = z.infer<typeof ConvictionSchema>;

export const ThemeSchema = z.object({
  slug: ThemeSlugSchema,
  label: z.string(),
  accent: z.string(),
  sort_order: z.number().int(),
});
export type Theme = z.infer<typeof ThemeSchema>;

export const ThemesFileSchema = z.array(ThemeSchema);

export const PickSchema = z.object({
  ticker: z.string().min(1).max(20),
  name: z.string(),
  theme: ThemeSlugSchema,
  stance: StanceSchema,
  conviction: ConvictionSchema,
  thesis_short: z.string(),
  thesis_long: z.string(),
  first_mentioned_at: z.string(),
  tweet_url: z.string().url().or(z.literal("")),
  tweet_id: z.string(),
  exited_at: z.string().nullable(),
  exit_price: z.number().nullable(),
});
export type Pick = z.infer<typeof PickSchema>;

export const PicksFileSchema = z.array(PickSchema);

export const PriceHistoryPointSchema = z.object({
  date: z.string(),
  close: z.number(),
});
export type PriceHistoryPoint = z.infer<typeof PriceHistoryPointSchema>;

export const FinancialMetricsSchema = z.object({
  // Daily trading
  prev_close: z.number().nullable().optional(),
  open: z.number().nullable().optional(),
  day_high: z.number().nullable().optional(),
  day_low: z.number().nullable().optional(),
  day_change_pct: z.number().nullable().optional(),
  volume: z.number().nullable().optional(),
  avg_volume: z.number().nullable().optional(),

  // 52-week
  fifty_two_week_high: z.number().nullable().optional(),
  fifty_two_week_low: z.number().nullable().optional(),
  fifty_two_week_change_pct: z.number().nullable().optional(),

  // Moving averages
  fifty_day_avg: z.number().nullable().optional(),
  two_hundred_day_avg: z.number().nullable().optional(),

  // Valuation
  pe_trailing: z.number().nullable().optional(),
  pe_forward: z.number().nullable().optional(),
  peg_ratio: z.number().nullable().optional(),
  price_to_book: z.number().nullable().optional(),
  price_to_sales: z.number().nullable().optional(),
  ev_to_revenue: z.number().nullable().optional(),
  ev_to_ebitda: z.number().nullable().optional(),
  enterprise_value: z.number().nullable().optional(),
  eps_trailing: z.number().nullable().optional(),
  eps_forward: z.number().nullable().optional(),
  shares_outstanding: z.number().nullable().optional(),
  float_shares: z.number().nullable().optional(),

  // Profitability / fundamentals
  total_revenue: z.number().nullable().optional(),
  revenue_growth: z.number().nullable().optional(),
  earnings_growth: z.number().nullable().optional(),
  gross_margin: z.number().nullable().optional(),
  operating_margin: z.number().nullable().optional(),
  profit_margin: z.number().nullable().optional(),
  ebitda_margin: z.number().nullable().optional(),
  return_on_equity: z.number().nullable().optional(),
  return_on_assets: z.number().nullable().optional(),

  // Balance sheet
  total_cash: z.number().nullable().optional(),
  total_debt: z.number().nullable().optional(),
  debt_to_equity: z.number().nullable().optional(),
  current_ratio: z.number().nullable().optional(),
  quick_ratio: z.number().nullable().optional(),
  free_cashflow: z.number().nullable().optional(),
  operating_cashflow: z.number().nullable().optional(),

  // Analyst coverage
  recommendation_key: z.string().nullable().optional(),
  recommendation_mean: z.number().nullable().optional(),
  num_analysts: z.number().nullable().optional(),
  target_mean_price: z.number().nullable().optional(),
  target_high_price: z.number().nullable().optional(),
  target_low_price: z.number().nullable().optional(),

  // Risk / dividends / events
  beta: z.number().nullable().optional(),
  short_pct_float: z.number().nullable().optional(),
  short_ratio: z.number().nullable().optional(),
  dividend_yield: z.number().nullable().optional(),
  dividend_rate: z.number().nullable().optional(),
  payout_ratio: z.number().nullable().optional(),
  ex_dividend_date: z.string().nullable().optional(),
  next_earnings_date: z.string().nullable().optional(),

  // Profile
  sector: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  exchange: z.string().nullable().optional(),
});
export type FinancialMetrics = z.infer<typeof FinancialMetricsSchema>;

export const PriceEntrySchema = z.object({
  price: z.number().nullable(),
  market_cap: z.number().nullable(),
  currency: z.string(),
  ytd_pct: z.number(),
  history: z.array(PriceHistoryPointSchema),
  updated_at: z.string(),
  metrics: FinancialMetricsSchema.optional(),
});
export type PriceEntry = z.infer<typeof PriceEntrySchema>;

export const PricesFileSchema = z.record(z.string(), PriceEntrySchema);
export type PricesFile = z.infer<typeof PricesFileSchema>;

export const SiteMetaSchema = z.object({
  handle: z.string(),
  follower_count: z.number().int(),
  current_thesis_md: z.string(),
  claimed_ytd_pct: z.number(),
  last_updated: z.string(),
});
export type SiteMeta = z.infer<typeof SiteMetaSchema>;

export const PersonSchema = z.object({
  slug: z.string().min(1),
  name: z.string(),
  handle: z.string(),
  tagline: z.string(),
  accent: z.string(),
  active: z.boolean().default(true),
});
export type Person = z.infer<typeof PersonSchema>;

export const PeopleFileSchema = z.array(PersonSchema);
