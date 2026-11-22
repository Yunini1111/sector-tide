// Display schema. These files are derived, display-only snapshots — not a raw CMC mirror.

export interface Coin {
  id: number;
  symbol: string;
  name: string;
  slug: string;
  marketCap: number;
  price: number;
  change24h: number;
  change7d: number;
}

export interface Sector {
  id: string;
  name: string;
  tokens: number;
  marketCap: number;
  /** % change of sector market cap over 24h (CMC market_cap_change) */
  change24h: number;
  /** cap-weighted 7d % change of the sector's largest constituents (null until drilled) */
  change7d: number | null;
  volume: number;
  volumeChange24h: number;
  /** largest constituents, by market cap (may be stale up to a few hours, see coinsAt) */
  coins: Coin[];
  coinsAt: string | null;
}

export interface Market {
  totalMarketCap: number;
  totalMarketCapChange24h: number | null;
  totalVolume24h: number;
  btcDominance: number;
  btcDominanceChange24h: number | null;
  ethDominance: number;
  fearGreed: { value: number; label: string } | null;
}

export interface Snapshot {
  generatedAt: string;
  synthetic?: boolean;
  market: Market;
  sectors: Sector[];
  meta: { creditsThisRun: number; endpoints: string[]; notes: string[] };
}

/** rolling window of compact points: per sector [marketCap, change24h, change7d|null] */
export interface History {
  points: { t: string; fg: number | null; b?: 1; s: Record<string, [number, number, number | null]> }[];
}
