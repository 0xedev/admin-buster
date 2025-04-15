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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [resolvedMarketIds, setResolvedMarketIds] = useState<Set<number>>(
    new Set()
  );

  // Fetch market count - we'll use this to know how many markets to query
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

      // Extract the market data from event args
      return {
        id: Number(args.marketId),
        question: args.question,
        optionA: args.optionA,
        optionB: args.optionB,
        endTime: args.endTime,
        resolved: false, // Initially not resolved
      };
    });

    // Ensure we don't have duplicate IDs in our markets array
    const uniqueMarkets = Array.from(
      new Map(processedMarkets.map((market) => [market.id, market])).values()
    );

    setMarkets(uniqueMarkets);
    setIsLoading(false);
  }, [marketCreatedEvents]);

  // Process resolved markets
  useEffect(() => {
    if (!marketResolvedEvents || marketResolvedEvents.length === 0) return;

    // Create a set of resolved market IDs
    const resolved = new Set<number>();
    marketResolvedEvents.forEach((event) => {
      resolved.add(Number(event.args.marketId));
    });

    setResolvedMarketIds(resolved);

    // Update existing markets with resolved status
    setMarkets((prev) =>
      prev.map((market) => ({
        ...market,
        resolved: resolved.has(market.id),
      }))
    );
  }, [marketResolvedEvents]);

  // Fallback to direct contract calls if events don't provide enough data
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
        const fetchedMarkets: Market[] = [];

        for (let i = 0; i < count; i++) {
          try {
            // Use the readContract function directly instead of using hooks
            // This is the recommended way to read contract data outside of React components
            const result = await readContract({
              contract,
              method:
                "function getMarketInfo(uint256 _marketId) view returns (string question, string optionA, string optionB, uint256 endTime, uint8 outcome, uint256 totalOptionAShares, uint256 totalOptionBShares, bool resolved)",
              params: [BigInt(i)],
            });

            if (result && Array.isArray(result) && result.length === 8) {
              fetchedMarkets.push({
                id: i,
                question: result[0],
                optionA: result[1],
                optionB: result[2],
                endTime: result[3],
                resolved: result[7],
              });
            }
          } catch (error) {
            console.error(`Error fetching market ${i}:`, error);
          }
        }

        // Ensure we don't have duplicate IDs in our markets array
        const uniqueMarkets = Array.from(
          new Map(fetchedMarkets.map((market) => [market.id, market])).values()
        );

        setMarkets(uniqueMarkets);
      } catch (error) {
        console.error("Failed to fetch markets:", error);
        toast({
          title: "Error",
          description: "Failed to load markets. Check console for details.",
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
        params: [BigInt(marketId), outcome === "OPTION_A" ? 1 : 2], // 1 for OPTION_A, 2 for OPTION_B
      });

      await sendTransaction(transaction);
      toast({
        title: "Success",
        description: `Market ${marketId} resolved as ${outcome}.`,
      });

      // Update local state
      setMarkets((prev) =>
        prev.map((m) => (m.id === marketId ? { ...m, resolved: true } : m))
      );
      setResolvedMarketIds((prev) => new Set(prev).add(marketId));
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
