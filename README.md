# Policast Prediction Market Admin

Admin dashboard for managing the Policast prediction market smart contract on Base mainnet.

## Features

- Create new prediction markets
- Resolve markets and set outcomes
- Distribute winnings to participants
- Grant admin roles (creator, resolver, owner)
- Connect wallet (MetaMask, Coinbase, etc.)
- View market details, shares, and participant stats

## Tech Stack

- Next.js 15 (App Router)
- TypeScript
- wagmi & viem (Web3 contract interaction)
- @tanstack/react-query (data fetching)
- Tailwind CSS (UI)

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Set your Alchemy RPC URL in `.env.local`:
   ```env
   NEXT_PUBLIC_ALCHEMY_RPC_URL=YOUR_ALCHEMY_BASE_MAINNET_URL
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000/admin](http://localhost:3000/admin) to access the admin dashboard.

## Usage

- Connect your wallet to access admin features.
- Only addresses with the correct roles (owner, creator, resolver) can perform admin actions.
- Use the dashboard to create, resolve, and distribute winnings for prediction markets.

## Smart Contract

- Contract address: `0xd24261cD87Ac11A8961a2d5df7036ad87ca7F02A` (Base mainnet)
- See `src/constants/contract.ts` for ABI and contract config.

## License

MIT
