"use client";

import { useConnect, useDisconnect, useAccount } from "wagmi";
import { Button } from "@/components/ui/button";

export function ConnectButton() {
  const { connectors, connect, status, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { address, isConnected } = useAccount();

  if (isConnected) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm">
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </span>
        <Button onClick={() => disconnect()} variant="outline" size="sm">
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {connectors.map((connector) => (
        <Button
          key={connector.uid}
          onClick={() => connect({ connector })}
          disabled={status === "pending"}
          variant="outline"
        >
          {connector.name}
          {status === "pending" && " (connecting...)"}
        </Button>
      ))}
      {error && <div className="text-red-500 text-sm">{error.message}</div>}
    </div>
  );
}
