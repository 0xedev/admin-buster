"use client";

import { useEffect, useState } from "react";
import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useWatchContractEvent,
} from "wagmi";
import { contractAddress, contractAbi } from "@/constants/contract";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";

interface Market {
  id: number;
  question: string;
  optionA: string;
  optionB: string;
  endTime: bigint;
  resolved: boolean;
  payoutIndex: bigint;
  totalParticipants: bigint;
}

const MARKETS_PER_PAGE = 10;

export function ResolveMarketList() {
  const { toast } = useToast();
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash,
  });
  const [markets, setMarkets] = useState<Market[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const { data: marketCount, isLoading: isMarketCountLoading } =
    useReadContract({
      address: contractAddress,
      abi: contractAbi,
      functionName: "marketCount",
    });

  // Watch for MarketCreated events
  useWatchContractEvent({
    address: contractAddress,
    abi: contractAbi,
    eventName: "MarketCreated",
    onLogs(logs) {
      const newMarkets = logs.map((log) => ({
        id: Number(log.args.marketId),
        question: log.args.question as string,
        optionA: log.args.optionA as string,
        optionB: log.args.optionB as string,
        endTime: log.args.endTime as bigint,
        resolved: false,
        payoutIndex: BigInt(0),
        totalParticipants: BigInt(0),
      }));

      setMarkets((prev) => {
        const combined = [...prev, ...newMarkets];
        const uniqueMarkets = Array.from(
          new Map(combined.map((market) => [market.id, market])).values()
        ).sort((a, b) => b.id - a.id);
        return uniqueMarkets;
      });
    },
  });

  // Watch for MarketResolved events
  useWatchContractEvent({
    address: contractAddress,
    abi: contractAbi,
    eventName: "MarketResolved",
    onLogs(logs) {
      const resolvedIds = new Set(logs.map((log) => Number(log.args.marketId)));
      setMarkets((prev) =>
        prev
          .map((market) => ({
            ...market,
            resolved: resolvedIds.has(market.id) ? true : market.resolved,
          }))
          .sort((a, b) => b.id - a.id)
      );
    },
  });

  // Effect to update total pages when markets change
  useEffect(() => {
    setTotalPages(Math.ceil(markets.length / MARKETS_PER_PAGE));
  }, [markets.length]);

  // Fetch initial market data if no markets are loaded
  useEffect(() => {
    if (markets.length > 0 || isMarketCountLoading || !marketCount) {
      return;
    }

    const fetchAllMarketInfo = async () => {
      setIsLoading(true);
      try {
        const count = Number(marketCount);
        const marketIds = Array.from({ length: count }, (_, i) => BigInt(i));

        // Use viem directly to read contract data
        const { publicClient } = await import("@/constants/contract");
        const result = await publicClient.readContract({
          address: contractAddress,
          abi: contractAbi,
          functionName: "getMarketInfoBatch",
          args: [marketIds],
        });

        const fetchedMarkets: Market[] = marketIds
          .map((id, i) => ({
            id: Number(id),
            question: result[0][i],
            optionA: result[1][i],
            optionB: result[2][i],
            endTime: result[3][i],
            resolved: result[7][i],
            payoutIndex: BigInt(0), // Will be updated when needed
            totalParticipants: BigInt(0), // Will be updated when needed
          }))
          .sort((a, b) => b.id - a.id);

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
      writeContract({
        address: contractAddress,
        abi: contractAbi,
        functionName: "resolveMarket",
        args: [BigInt(marketId), outcome === "OPTION_A" ? 1 : 2],
      });

      toast({
        title: "Success",
        description: `Market ${marketId} resolved as ${outcome}.`,
      });

      setMarkets((prev: Market[]) =>
        prev
          .map((m) => (m.id === marketId ? { ...m, resolved: true } : m))
          .sort((a, b) => b.id - a.id)
      );
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
      writeContract({
        address: contractAddress,
        abi: contractAbi,
        functionName: "distributeWinningsBatch",
        args: [BigInt(marketId), BigInt(20)],
      });

      toast({
        title: "Success",
        description: `Winnings distributed for market ${marketId}.`,
      });

      // Update market state - for now just show success
      // In a real app, you might want to refetch the market data
    } catch (error) {
      console.error("Distribute winnings error:", error);
      toast({
        title: "Error",
        description: "Failed to distribute winnings.",
        variant: "destructive",
      });
    }
  };

  const startIndex = (currentPage - 1) * MARKETS_PER_PAGE;
  const paginatedMarkets = markets.slice(
    startIndex,
    startIndex + MARKETS_PER_PAGE
  );

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
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
        <>
          {paginatedMarkets.map((market) => (
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
                      disabled={isPending || isConfirming}
                      className="mt-2"
                    >
                      {isPending || isConfirming ? (
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
                        isConfirming ||
                        new Date(Number(market.endTime) * 1000) > new Date()
                      }
                    >
                      {isPending || isConfirming ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        `Resolve as ${market.optionA}`
                      )}
                    </Button>
                    <Button
                      onClick={() => handleResolveMarket(market.id, "OPTION_B")}
                      disabled={
                        isPending ||
                        isConfirming ||
                        new Date(Number(market.endTime) * 1000) > new Date()
                      }
                    >
                      {isPending || isConfirming ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        `Resolve as ${market.optionB}`
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {totalPages > 1 && (
            <div className="flex justify-between items-center mt-4">
              <Button
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
                variant="outline"
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
              <p>
                Page {currentPage} of {totalPages}
              </p>
              <Button
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                variant="outline"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
