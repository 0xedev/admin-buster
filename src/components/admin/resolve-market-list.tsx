"use client";

import { useEffect, useState } from "react";
import {
  useReadContract,
  useSendAndConfirmTransaction,
  useContractEvents,
} from "thirdweb/react";
import { prepareContractCall, prepareEvent, readContract } from "thirdweb";
import { contract } from "@/constants/contract";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";

interface Market {
  id: number;
  question: string;
  optionA: string;
  optionB: string;
  endTime: bigint;
  resolved: boolean;
}

// Prepare the event signatures we want to listen for
const marketCreatedEvent = prepareEvent({
  signature:
    "event MarketCreated(uint256 indexed marketId, string question, string optionA, string optionB, uint256 endTime)",
});

const marketResolvedEvent = prepareEvent({
  signature: "event MarketResolved(uint256 indexed marketId, uint8 outcome)",
});

export function ResolveMarketList() {
  const { toast } = useToast();
  const { mutateAsync: sendTransaction, isPending } =
    useSendAndConfirmTransaction();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [resolvedMarketIds, setResolvedMarketIds] = useState<Set<number>>(
    new Set()
  );

  // Fetch market count
  const { data: marketCount, isLoading: isMarketCountLoading } =
    useReadContract({
      contract,
      method: "function marketCount() view returns (uint256)",
      params: [],
    });

  // Listen for MarketCreated events
  const { data: marketCreatedEvents } = useContractEvents({
    contract,
    events: [marketCreatedEvent],
  });

  // Listen for MarketResolved events
  const { data: marketResolvedEvents } = useContractEvents({
    contract,
    events: [marketResolvedEvent],
  });

  // Process created markets
  useEffect(() => {
    if (!marketCreatedEvents || marketCreatedEvents.length === 0) return;

    const processedMarkets: Market[] = marketCreatedEvents.map((event) => {
      const { args } = event;
      return {
        id: Number(args.marketId),
        question: args.question,
        optionA: args.optionA,
        optionB: args.optionB,
        endTime: args.endTime,
        resolved: false,
      };
    });

    const uniqueMarkets = Array.from(
      new Map(processedMarkets.map((market) => [market.id, market])).values()
    );

    setMarkets(uniqueMarkets);
    setIsLoading(false);
  }, [marketCreatedEvents]);

  // Process resolved markets
  useEffect(() => {
    if (!marketResolvedEvents || marketResolvedEvents.length === 0) return;

    const resolved = new Set<number>();
    marketResolvedEvents.forEach((event) => {
      resolved.add(Number(event.args.marketId));
    });

    setResolvedMarketIds(resolved);
    setMarkets((prev) =>
      prev.map((market) => ({
        ...market,
        resolved: resolved.has(market.id),
      }))
    );
  }, [marketResolvedEvents]);

  // Fetch market info using getMarketInfoBatch
  useEffect(() => {
    if (
      markets.length > 0 ||
      isMarketCountLoading ||
      marketCount === undefined
    ) {
      return;
    }

    const fetchAllMarketInfo = async () => {
      setIsLoading(true);
      try {
        const count = Number(marketCount);
        const marketIds = Array.from({ length: count }, (_, i) => BigInt(i));
        const result = await readContract({
          contract,
          method:
            "function getMarketInfoBatch(uint256[] _marketIds) view returns (string[] questions, string[] optionAs, string[] optionBs, uint256[] endTimes, uint8[] outcomes, uint256[] totalOptionASharesArray, uint256[] totalOptionBSharesArray, bool[] resolvedArray)",
          params: [marketIds],
        });

        const fetchedMarkets: Market[] = marketIds.map((id, i) => ({
          id: Number(id),
          question: result[0][i],
          optionA: result[1][i],
          optionB: result[2][i],
          endTime: result[3][i],
          resolved: result[7][i],
        }));

        setMarkets(fetchedMarkets);
      } catch (error) {
        console.error("Failed to fetch markets:", error);
        toast({
          title: "Error",
          description: "Failed to load markets.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllMarketInfo();
  }, [marketCount, isMarketCountLoading, markets.length, toast]);

  const handleResolveMarket = async (
    marketId: number,
    outcome: "OPTION_A" | "OPTION_B"
  ) => {
    try {
      const transaction = await prepareContractCall({
        contract,
        method: "function resolveMarket(uint256 _marketId, uint8 _outcome)",
        params: [BigInt(marketId), outcome === "OPTION_A" ? 1 : 2],
      });

      await sendTransaction(transaction);
      toast({
        title: "Success",
        description: `Market ${marketId} resolved as ${outcome}.`,
      });

      setMarkets((prev) =>
        prev.map((m) => (m.id === marketId ? { ...m, resolved: true } : m))
      );
      setResolvedMarketIds((prev) => new Set(prev).add(marketId));
    } catch (error) {
      console.error("Resolve market error:", error);
      toast({
        title: "Error",
        description: "Failed to resolve market.",
        variant: "destructive",
      });
    }
  };

  const handleDistributeWinnings = async (marketId: number) => {
    try {
      const transaction = await prepareContractCall({
        contract,
        method:
          "function distributeWinningsBatch(uint256 _marketId, uint256 batchSize)",
        params: [BigInt(marketId), BigInt(10)], // Adjust batchSize as needed
      });

      await sendTransaction(transaction);
      toast({
        title: "Success",
        description: `Winnings distributed for market ${marketId}.`,
      });
    } catch (error) {
      console.error("Distribute winnings error:", error);
      toast({
        title: "Error",
        description: "Failed to distribute winnings.",
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
                <>
                  <p className="text-green-600">Resolved</p>
                  <Button
                    onClick={() => handleDistributeWinnings(market.id)}
                    disabled={isPending}
                    className="mt-2"
                  >
                    {isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      "Distribute Winnings"
                    )}
                  </Button>
                </>
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
