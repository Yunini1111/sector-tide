// Curated sector list. CMC lists hundreds of categories, many of them portfolios or
// one-chain ecosystems; rotation reads best on a fixed set of thematic sectors.
// Each entry matches a CMC category by exact name (first match wins).
export const SECTORS = [
  { key: 'ai', label: 'AI & Big Data', match: ['AI & Big Data', 'Artificial Intelligence (AI)'] },
  { key: 'ai-agents', label: 'AI Agents', match: ['AI Agents'] },
  { key: 'l1', label: 'Layer 1', match: ['Layer 1'] },
  { key: 'l2', label: 'Layer 2', match: ['Layer 2'] },
  { key: 'defi', label: 'DeFi', match: ['DeFi'] },
  { key: 'dex', label: 'DEX', match: ['Decentralized Exchange (DEX) Token', 'DEX'] },
  { key: 'lending', label: 'Lending', match: ['Lending & Borrowing', 'Lending/Borrowing'] },
  { key: 'derivatives', label: 'Derivatives', match: ['Derivatives'] },
  { key: 'memes', label: 'Memes', match: ['Memes', 'Meme'] },
  { key: 'gaming', label: 'Gaming', match: ['Gaming', 'Play To Earn'] },
  { key: 'rwa', label: 'Real World Assets', match: ['Real World Assets Protocols', 'Real World Assets'] },
  { key: 'depin', label: 'DePIN', match: ['DePIN'] },
  { key: 'oracles', label: 'Oracles', match: ['Oracles'] },
  { key: 'storage', label: 'Storage', match: ['Storage', 'Filesharing'] },
  { key: 'privacy', label: 'Privacy', match: ['Privacy'] },
  { key: 'lsd', label: 'Liquid Staking', match: ['Liquid Staking Derivatives', 'Liquid Staking'] },
  { key: 'restaking', label: 'Restaking', match: ['Restaking'] },
  { key: 'zk', label: 'Zero Knowledge', match: ['Zero Knowledge Proofs', 'Zero-Knowledge Proofs'] },
  { key: 'interop', label: 'Interoperability', match: ['Interoperability'] },
  { key: 'prediction', label: 'Prediction Markets', match: ['Prediction Markets'] },
  { key: 'cex', label: 'Exchange Tokens', match: ['Centralized Exchange (CEX) Token', 'CEX'] },
  { key: 'nft', label: 'NFT', match: ['NFTs & Collectibles', 'Collectibles & NFTs'] },
  { key: 'metaverse', label: 'Metaverse', match: ['Metaverse'] },
  { key: 'modular', label: 'Modular', match: ['Modular Blockchain'] },
];
