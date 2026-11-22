// Curated sector list. CMC lists hundreds of categories, many of them portfolios or
// one-chain ecosystems; rotation reads best on a fixed set of thematic sectors.
// Each entry matches a CMC category by exact name (first match wins). `kw` maps community
// topics / post tags to the sector for the narrative (attention) view.
export const SECTORS = [
  { key: 'ai', label: 'AI & Big Data', match: ['AI & Big Data', 'Artificial Intelligence (AI)'], kw: ['ai', 'artificial intelligence', 'machine learning', 'llm', 'gpu', 'compute'] },
  { key: 'ai-agents', label: 'AI Agents', match: ['AI Agents'], kw: ['agent', 'agents', 'agentic', 'autonomous'] },
  { key: 'l1', label: 'Layer 1', match: ['Layer 1'], kw: ['layer 1', 'layer-1', 'l1', 'mainnet', 'smart contract platform'] },
  { key: 'l2', label: 'Layer 2', match: ['Layer 2'], kw: ['layer 2', 'layer-2', 'l2', 'rollup', 'rollups'] },
  { key: 'defi', label: 'DeFi', match: ['DeFi'], kw: ['defi', 'yield', 'tvl'] },
  { key: 'dex', label: 'DEX', match: ['Decentralized Exchange (DEX) Token', 'DEX'], kw: ['dex', 'swap', 'amm'] },
  { key: 'lending', label: 'Lending', match: ['Lending & Borrowing', 'Lending/Borrowing'], kw: ['lending', 'borrow', 'loan'] },
  { key: 'derivatives', label: 'Derivatives', match: ['Derivatives'], kw: ['perp', 'perps', 'perpetual', 'derivatives', 'futures', 'options'] },
  { key: 'memes', label: 'Memes', match: ['Memes', 'Meme'], kw: ['meme', 'memes', 'memecoin', 'dog', 'frog', 'cat'] },
  { key: 'gaming', label: 'Gaming', match: ['Gaming', 'Play To Earn'], kw: ['gaming', 'game', 'gamefi', 'play to earn'] },
  { key: 'rwa', label: 'Real World Assets', match: ['Real World Assets Protocols', 'Real World Assets'], kw: ['rwa', 'real world asset', 'tokenization', 'tokenized', 'treasury'] },
  { key: 'depin', label: 'DePIN', match: ['DePIN'], kw: ['depin', 'physical infrastructure', 'wireless', 'sensor'] },
  { key: 'oracles', label: 'Oracles', match: ['Oracles'], kw: ['oracle', 'oracles', 'price feed'] },
  { key: 'storage', label: 'Storage', match: ['Storage', 'Filesharing'], kw: ['storage', 'filecoin', 'arweave'] },
  { key: 'privacy', label: 'Privacy', match: ['Privacy'], kw: ['privacy', 'private', 'anonymous', 'zcash', 'monero'] },
  { key: 'lsd', label: 'Liquid Staking', match: ['Liquid Staking Derivatives', 'Liquid Staking'], kw: ['liquid staking', 'lst', 'staking'] },
  { key: 'restaking', label: 'Restaking', match: ['Restaking'], kw: ['restaking', 'eigenlayer', 'avs', 'lrt'] },
  { key: 'zk', label: 'Zero Knowledge', match: ['Zero Knowledge Proofs', 'Zero-Knowledge Proofs'], kw: ['zk', 'zero knowledge', 'zero-knowledge', 'snark', 'stark'] },
  { key: 'interop', label: 'Interoperability', match: ['Interoperability'], kw: ['bridge', 'cross-chain', 'interoperability'] },
  { key: 'prediction', label: 'Prediction Markets', match: ['Prediction Markets'], kw: ['prediction market', 'prediction markets', 'betting', 'polymarket'] },
  { key: 'cex', label: 'Exchange Tokens', match: ['Centralized Exchange (CEX) Token', 'CEX'], kw: ['exchange token', 'cex', 'exchange'] },
  { key: 'nft', label: 'NFT', match: ['NFTs & Collectibles', 'Collectibles & NFTs'], kw: ['nft', 'nfts', 'collectible'] },
  { key: 'metaverse', label: 'Metaverse', match: ['Metaverse'], kw: ['metaverse', 'virtual world', 'vr'] },
  { key: 'modular', label: 'Modular', match: ['Modular Blockchain'], kw: ['modular', 'data availability', 'celestia'] },
];
