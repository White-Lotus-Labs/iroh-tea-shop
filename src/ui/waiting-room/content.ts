export type Member = {
  handle: string;
  roles: string;
  bio: string;
  portrait: string;
};

const art = (name: string) => `/images/waiting-room/${name}.jpg`;

export const TEAM: Member[] = [
  {
    handle: '0x_iroh',
    roles: 'Vision · visuals · style · UI',
    bio: 'Wise uncle, trader, investor, vibecoder, farmer.',
    portrait: art('team-iroh'),
  },
  {
    handle: '0x_Takezo',
    roles: 'Video · texts · marketing',
    bio: 'NFT and meme connoisseur, and an upcoming marketing star. Builds study\u2011for\u2011A and runs YouTube channels.',
    portrait: art('team-takezo'),
  },
  {
    handle: 'david_grii',
    roles: 'Front-end · UI',
    bio: 'Full-stack dev across SaaS, health, and crypto. Does not watch anime, yet somehow has an anime pfp.',
    portrait: art('team-david'),
  },
  {
    handle: 'PandaCoderexe',
    roles: 'Back-end · API · UI',
    bio: 'A high schooler with three years of programming behind him. High agency. Runs his own YouTube channel.',
    portrait: art('team-panda'),
  },
  {
    handle: 'tldde',
    roles: 'Back-end · systems · API · Observatorium',
    bio: 'Tall, seasoned dev. On-chain analytics and systems engineering. Has a cat.',
    portrait: art('team-tldde'),
  },
];

export const xUrl = (handle: string) => `https://x.com/${handle}`;
export const REPO_URL = 'https://github.com/White-Lotus-Labs/iroh-tea-shop';

export const PROJECT = {
  name: 'Tea After Pour',
  studio: 'White Lotus Labs',
  tagline: 'A quiet room for a finished thesis.',
  summary:
    'Tea After Pour is a tea room for a crypto thesis you have already written. You bring the reasoning. The room helps you see what it rests on, one cup at a time.',
  // Same names and captions as the station dock inside.
  steps: [
    {
      label: 'Counter',
      caption: 'Thesis desk',
      text: 'Write the thesis you already hold, confirm the symbol, and choose a review window.',
    },
    {
      label: 'Host',
      caption: 'Talk to Iroh',
      text: 'Ask Iroh, the host. He answers with live Nansen research.',
    },
    {
      label: 'Shelf',
      caption: 'Leaderboard',
      text: 'Meet the ten Smart Money perp traders with the highest PnL on Nansen over the last 30 days.',
    },
    {
      label: 'Observatorium',
      caption: 'The flows of chains',
      text: 'Read the review: what the evidence noticed, what it cut, and one question to carry.',
    },
  ],
  honesty:
    'The thesis review is a demo with synthetic data. Iroh’s research and the Shelf use live Nansen data.',
};
