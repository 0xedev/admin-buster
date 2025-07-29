import { http, createConfig } from "wagmi";
import { base } from "wagmi/chains";
import { injected, metaMask, coinbaseWallet } from "wagmi/connectors";

export const config = createConfig({
  chains: [base],
  connectors: [
    injected(),
    metaMask(),
    coinbaseWallet({ appName: "Policast Market" }),
  ],
  transports: {
    [base.id]: http(
      "https://base-mainnet.g.alchemy.com/v2/fU-HhurJktYUS2c8TjtyPbtkxfgHYQHV"
    ),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
