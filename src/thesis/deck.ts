import type { Thesis, ThesisId } from './types';

// Addresses are public contracts. The API routes accept only thesis and ticker
// ids and resolve them here, so the app never proxies arbitrary addresses.
export const THESES: Thesis[] = [
  {
    id: 'robinhood',
    numeral: 'I',
    title: 'Robinhood Chain tokenization',
    subtitle: 'Every asset becomes a token',
    body: 'Stocks, memes, and DeFi are moving onto one chain. If tokenization is real, smart money will accumulate the tokens that live there and the rails that carry them.',
    spirit: 'Jade Fortune Toad',
    image: '/images/theses/robinhood.webp',
    hue: 145,
    colors: { primary: '#2f7d5b', accent: '#b8d8a8', ink: '#15342a' },
    tickers: [
      {
        symbol: 'NET',
        name: 'NetNet',
        assetClass: 'crypto',
        token: {
          chain: 'robinhood',
          address: '0xCA9c78Dd337A67F6e0077F65F5E9218719d30eDf',
        },
      },
      {
        symbol: 'SHROOM',
        name: 'Shroom',
        assetClass: 'crypto',
        token: {
          chain: 'robinhood',
          address: '0xab093dEF657F15dF31b33922A95e047aDd645B29',
        },
      },
      {
        symbol: 'ARB',
        name: 'Arbitrum',
        assetClass: 'crypto',
        token: {
          chain: 'arbitrum',
          address: '0x912CE59144191C1204E64559FE8253a0e49E6548',
        },
        perp: 'ARB',
      },
      {
        symbol: 'UNI',
        name: 'Uniswap',
        assetClass: 'crypto',
        token: {
          chain: 'ethereum',
          address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
        },
        perp: 'UNI',
      },
    ],
  },
  {
    id: 'bullrun',
    numeral: 'II',
    title: 'Crypto Bullrun',
    subtitle: 'The majors lead the way up',
    body: 'A bull market starts with the majors. If this one is real, smart money is net long bitcoin and ether, and is accumulating the chains where new users land.',
    spirit: 'Golden Ox',
    image: '/images/theses/bullrun.webp',
    hue: 38,
    colors: { primary: '#b8862f', accent: '#e7c77a', ink: '#3b2410' },
    tickers: [
      {
        symbol: 'BTC',
        name: 'Bitcoin',
        assetClass: 'native',
        token: {
          chain: 'ethereum',
          address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
        },
        perp: 'BTC',
      },
      {
        symbol: 'ETH',
        name: 'Ether',
        assetClass: 'native',
        token: {
          chain: 'ethereum',
          address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        },
        perp: 'ETH',
      },
      {
        symbol: 'HYPE',
        name: 'Hyperliquid',
        assetClass: 'native',
        token: {
          chain: 'hyperevm',
          address: '0x5555555555555555555555555555555555555555',
        },
        perp: 'HYPE',
      },
      {
        symbol: 'SOL',
        name: 'Solana',
        assetClass: 'native',
        token: {
          chain: 'solana',
          address: 'So11111111111111111111111111111111111111112',
        },
        perp: 'SOL',
      },
    ],
  },
  {
    id: 'ai',
    numeral: 'III',
    title: 'AI taking over the world',
    subtitle: 'Compute is the new oil',
    body: 'If AI keeps eating the world, the money flows to the chips, the memory, and the open models. Smart money should be buying the tokenized chipmakers and the onchain AI networks.',
    spirit: 'Thunder Qilin',
    image: '/images/theses/ai.webp',
    hue: 268,
    colors: { primary: '#5b3fb0', accent: '#7fe3f0', ink: '#1c1438' },
    tickers: [
      {
        symbol: 'VVV',
        name: 'Venice',
        assetClass: 'crypto',
        token: {
          chain: 'base',
          address: '0xacfE6019Ed1A7Dc6f7B508C02d1b04ec88cC21bf',
        },
      },
      {
        symbol: 'SNDK',
        name: 'SanDisk (stock token)',
        assetClass: 'stock',
        token: {
          chain: 'robinhood',
          address: '0xB90A19fF0Af67f7779afF50A882A9CfF42446400',
        },
      },
      {
        symbol: 'NVDA',
        name: 'NVIDIA (stock token)',
        assetClass: 'stock',
        token: {
          chain: 'robinhood',
          address: '0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC',
        },
      },
      {
        symbol: 'MU',
        name: 'Micron (stock token)',
        assetClass: 'stock',
        token: {
          chain: 'robinhood',
          address: '0xfF080c8ce2E5feadaCa0Da81314Ae59D232d4afD',
        },
      },
    ],
  },
];

export function findThesis(id: string): Thesis | undefined {
  return THESES.find((thesis) => thesis.id === id);
}

export function findTicker(thesisId: ThesisId | string, symbol: string) {
  return findThesis(thesisId)?.tickers.find(
    (ticker) => ticker.symbol === symbol.toUpperCase(),
  );
}
