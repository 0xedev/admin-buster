"use client";

import { useEffect, useState } from "react";
import { useReadContract, useSendAndConfirmTransaction } from "thirdweb/react";
import { prepareContractCall } from "thirdweb";
import { contract } from "@/constants/contract";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";

interface Market {
  question: string;
  optionA: string;
  optionB: string;
  endTime: bigint;
  resolved: boolean;
}

export function ResolveMarketList() {
  const { toast } = useToast();
  const { mutateAsync: sendTransaction, isPending } =
    useSendAndConfirmTransaction();
  const [markets, setMarkets] = useState<(Market & { id: number })[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch market count
  const { data: marketCount } = useReadContract({
    contract,
    method: "function marketCount() view returns (uint256)",
    params: [],
  });

  // Fetch market details
  useEffect(() => {
    const fetchMarkets = async () => {
      if (!marketCount) return;

      setIsLoading(true);
      const marketData: (Market & { id: number })[] = [];
      for (let i = 0; i < Number(marketCount); i++) {
        const { data } = await useReadContract({
          contract,
          method:
            "function getMarketInfo(uint256 _marketId) view returns (string question, string optionA, string optionB, uint256 endTime, uint8 outcome, uint256 totalOptionAShares, uint256 totalOptionBShares, bool resolved)",
          params: [BigInt(i)],
        });
        if (data) {
          marketData.push({
            id: i,
            question: data[0],
            optionA: data[1],
            optionB: data[2],
            endTime: data[3],
            resolved: data[7],
          });
        }
      }
      setMarkets(marketData);
      setIsLoading(false);
    };

    fetchMarkets();
  }, [marketCount]);

  const handleResolveMarket = async (
    marketId: number,
    outcome: "OPTION_A" | "OPTION_B"
  ) => {
    try {
      const transaction = await prepareContractCall({
        contract,
        method: "function resolveMarket(uint256 _marketId, uint8 _outcome)",
        params: [BigInt(marketId), outcome === "OPTION_A" ? 1 : 2], // 1 for OPTION_A, 2 for OPTION_B
      });

      await sendTransaction(transaction);
      toast({
        title: "Success",
        description: `Market ${marketId} resolved as ${outcome}.`,
      });
      setMarkets((prev) =>
        prev.map((m) => (m.id === marketId ? { ...m, resolved: true } : m))
      );
    } catch (error) {
      console.error("Resolve market error:", error);
      toast({
        title: "Error",
        description: "Failed to resolve market. Check console for details.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {markets.length === 0 ? (
        <p>No markets available.</p>
      ) : (
        markets.map((market) => (
          <Card key={market.id}>
            <CardHeader>
              <CardTitle>{market.question}</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Option A: {market.optionA}</p>
              <p>Option B: {market.optionB}</p>
              <p>
                End Time:{" "}
                {new Date(Number(market.endTime) * 1000).toLocaleDateString()}
              </p>
              {market.resolved ? (
                <p className="text-green-600">Resolved</p>
              ) : (
                <div className="flex gap-2 mt-2">
                  <Button
                    onClick={() => handleResolveMarket(market.id, "OPTION_A")}
                    disabled={
                      isPending ||
                      new Date(Number(market.endTime) * 1000) > new Date()
                    }
                  >
                    {isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      `Resolve as ${market.optionA}`
                    )}
                  </Button>
                  <Button
                    onClick={() => handleResolveMarket(market.id, "OPTION_B")}
                    disabled={
                      isPending ||
                      new Date(Number(market.endTime) * 1000) > new Date()
                    }
                  >
                    {isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      `Resolve as ${market.optionB}`
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
