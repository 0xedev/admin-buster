"use client";

import { useEffect, useState } from "react";
import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useWatchContractEvent,
} from "wagmi";
import { formatUnits } from "viem";
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
  totalOptionAShares: bigint;
  totalOptionBShares: bigint;
  outcome: number;
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
  const [distributingMarket, setDistributingMarket] = useState<number | null>(
    null
  );

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
        totalOptionAShares: BigInt(0),
        totalOptionBShares: BigInt(0),
        outcome: 0,
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

  // Watch for MarketResolvedDetailed events to get participant counts
  useWatchContractEvent({
    address: contractAddress,
    abi: contractAbi,
    eventName: "MarketResolvedDetailed",
    onLogs(logs) {
      const resolvedMarketsData = logs.map((log) => ({
        id: Number(log.args.marketId),
        outcome: log.args.outcome as number,
        totalOptionAShares: log.args.totalOptionAShares as bigint,
        totalOptionBShares: log.args.totalOptionBShares as bigint,
        participantsLength: log.args.participantsLength as bigint,
      }));

      setMarkets((prev) =>
        prev
          .map((market) => {
            const resolvedData = resolvedMarketsData.find(
              (r) => r.id === market.id
            );
            return resolvedData
              ? {
                  ...market,
                  resolved: true,
                  outcome: resolvedData.outcome,
                  totalOptionAShares: resolvedData.totalOptionAShares,
                  totalOptionBShares: resolvedData.totalOptionBShares,
                  totalParticipants: resolvedData.participantsLength,
                }
              : market;
          })
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
            totalOptionAShares: result[5][i],
            totalOptionBShares: result[6][i],
            outcome: result[4][i],
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
      setDistributingMarket(marketId);

      writeContract({
        address: contractAddress,
        abi: contractAbi,
        functionName: "distributeWinningsBatch",
        args: [BigInt(marketId), BigInt(20)],
      });

      toast({
        title: "Distribution Started",
        description: `Processing winnings distribution for market ${marketId}...`,
      });
    } catch (error) {
      console.error("Distribute winnings error:", error);
      toast({
        title: "Error",
        description: "Failed to distribute winnings.",
        variant: "destructive",
      });
      setDistributingMarket(null);
    }
  };

  // Function to check if winnings are fully distributed
  const checkWinningsStatus = async (marketId: number) => {
    try {
      const { publicClient } = await import("@/constants/contract");

      // Get market info to check payout index
      const marketInfo = await publicClient.readContract({
        address: contractAddress,
        abi: contractAbi,
        functionName: "markets",
        args: [BigInt(marketId)],
      });

      return {
        payoutIndex: marketInfo[8], // payoutIndex is at index 8 in the markets struct
      };
    } catch (error) {
      console.error("Failed to check winnings status:", error);
      return {
        payoutIndex: BigInt(0),
      };
    }
  };

  // Effect to periodically update winnings status for resolved markets
  useEffect(() => {
    const updateWinningsStatus = async () => {
      const resolvedMarkets = markets.filter(
        (m) => m.resolved && m.payoutIndex === BigInt(0)
      );

      if (resolvedMarkets.length === 0) return;

      try {
        const updatedMarkets = await Promise.all(
          resolvedMarkets.map(async (market) => {
            const status = await checkWinningsStatus(market.id);
            return {
              ...market,
              payoutIndex: status.payoutIndex,
            };
          })
        );

        setMarkets((prev) =>
          prev.map((market) => {
            const updated = updatedMarkets.find((u) => u.id === market.id);
            return updated || market;
          })
        );
      } catch (error) {
        console.error("Failed to update winnings status:", error);
      }
    };

    if (markets.length > 0) {
      updateWinningsStatus();
    }
  }, [markets.length]); // Only run when markets array length changes

  // Update markets with winnings status when transaction is confirmed
  useEffect(() => {
    if (hash && distributingMarket && !isConfirming) {
      const updateMarketStatus = async () => {
        const status = await checkWinningsStatus(distributingMarket);
        const market = markets.find((m) => m.id === distributingMarket);

        setMarkets((prev) =>
          prev.map((m) =>
            m.id === distributingMarket
              ? {
                  ...m,
                  payoutIndex: status.payoutIndex,
                }
              : m
          )
        );

        if (market && market.totalParticipants > 0) {
          const isFullyDistributed =
            status.payoutIndex >= market.totalParticipants;
          const remaining = market.totalParticipants - status.payoutIndex;

          if (isFullyDistributed) {
            toast({
              title: "Distribution Complete",
              description: `All winnings have been distributed for market ${distributingMarket}.`,
            });
          } else {
            toast({
              title: "Partial Distribution",
              description: `Distributed batch for market ${distributingMarket}. ${remaining} participants remaining.`,
            });
          }
        } else {
          toast({
            title: "Distribution Processed",
            description: `Winnings distribution batch completed for market ${distributingMarket}.`,
          });
        }

        setDistributingMarket(null);
      };

      updateMarketStatus();
    }
  }, [hash, distributingMarket, isConfirming, markets, toast]);

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
          {paginatedMarkets.map((market) => {
            const isExpired =
              new Date(Number(market.endTime) * 1000) <= new Date();
            const winningsFullyDistributed =
              market.resolved &&
              market.totalParticipants > 0 &&
              market.payoutIndex >= market.totalParticipants;
            const remainingParticipants =
              market.totalParticipants > market.payoutIndex
                ? market.totalParticipants - market.payoutIndex
                : BigInt(0);

            return (
              <Card key={market.id} className="border-l-4 border-l-blue-500">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">{market.question}</CardTitle>
                    <div className="text-sm text-gray-500">#{market.id}</div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <p className="font-medium text-blue-800">Option A:</p>
                        <p className="text-blue-700">{market.optionA}</p>
                        {market.resolved && (
                          <p className="text-xs text-blue-600 mt-1">
                            Shares: {formatUnits(market.totalOptionAShares, 18)}
                          </p>
                        )}
                      </div>
                      <div className="p-3 bg-green-50 rounded-lg">
                        <p className="font-medium text-green-800">Option B:</p>
                        <p className="text-green-700">{market.optionB}</p>
                        {market.resolved && (
                          <p className="text-xs text-green-600 mt-1">
                            Shares: {formatUnits(market.totalOptionBShares, 18)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm">
                        <p className="font-medium">End Time:</p>
                        <p
                          className={
                            isExpired ? "text-red-600" : "text-gray-700"
                          }
                        >
                          {new Date(
                            Number(market.endTime) * 1000
                          ).toLocaleString()}
                        </p>
                        {!isExpired && (
                          <p className="text-xs text-orange-600">
                            Market still active
                          </p>
                        )}
                      </div>

                      {market.resolved && (
                        <div className="text-sm">
                          <p className="font-medium">Outcome:</p>
                          <p
                            className={`font-semibold ${
                              market.outcome === 1
                                ? "text-blue-600"
                                : market.outcome === 2
                                ? "text-green-600"
                                : "text-gray-600"
                            }`}
                          >
                            {market.outcome === 1
                              ? market.optionA
                              : market.outcome === 2
                              ? market.optionB
                              : "Invalid/Cancelled"}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {market.resolved ? (
                    <div className="border-t pt-3">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
                          <span className="text-green-600 font-medium">
                            Resolved
                          </span>
                        </div>

                        {market.totalParticipants > 0 && (
                          <div className="text-sm text-gray-600">
                            {winningsFullyDistributed ? (
                              <span className="text-green-600 font-medium">
                                ✓ All winnings distributed
                              </span>
                            ) : (
                              <span>
                                Distributed: {market.payoutIndex.toString()}/
                                {market.totalParticipants.toString()}{" "}
                                participants
                                {remainingParticipants > 0 && (
                                  <span className="text-orange-600 ml-2">
                                    ({remainingParticipants.toString()}{" "}
                                    remaining)
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <Button
                        onClick={() => handleDistributeWinnings(market.id)}
                        disabled={
                          distributingMarket === market.id ||
                          isPending ||
                          isConfirming ||
                          winningsFullyDistributed
                        }
                        variant={
                          winningsFullyDistributed ? "secondary" : "default"
                        }
                        className="w-full"
                      >
                        {distributingMarket === market.id ||
                        (isPending && distributingMarket === market.id) ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Distributing...
                          </>
                        ) : winningsFullyDistributed ? (
                          "✓ All Winnings Distributed"
                        ) : (
                          `Distribute Winnings${
                            remainingParticipants > 0
                              ? ` (${remainingParticipants} remaining)`
                              : ""
                          }`
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="border-t pt-3">
                      <div className="flex items-center gap-2 mb-3">
                        <span
                          className={`inline-block w-2 h-2 rounded-full ${
                            isExpired ? "bg-yellow-500" : "bg-blue-500"
                          }`}
                        ></span>
                        <span
                          className={`font-medium ${
                            isExpired ? "text-yellow-600" : "text-blue-600"
                          }`}
                        >
                          {isExpired ? "Ready to Resolve" : "Active"}
                        </span>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          onClick={() =>
                            handleResolveMarket(market.id, "OPTION_A")
                          }
                          disabled={isPending || isConfirming || !isExpired}
                          className="flex-1"
                          variant="outline"
                        >
                          {isPending || isConfirming ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : null}
                          Resolve as {market.optionA}
                        </Button>
                        <Button
                          onClick={() =>
                            handleResolveMarket(market.id, "OPTION_B")
                          }
                          disabled={isPending || isConfirming || !isExpired}
                          className="flex-1"
                          variant="outline"
                        >
                          {isPending || isConfirming ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : null}
                          Resolve as {market.optionB}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
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
