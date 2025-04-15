// src/components/enhanced-prediction-market-dashboard.tsx
"use client";

import { useReadContract } from "thirdweb/react";
import { contract } from "@/constants/contract";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarketCard } from "./marketCard";
import { Navbar } from "./navbar";
import { MarketCardSkeleton } from "./market-card-skeleton";
import { Footer } from "./footer";
import { useEffect, useState } from "react";
import { sdk } from "@farcaster/frame-sdk";

export function EnhancedPredictionMarketDashboard() {
  const { data: marketCount, isLoading: isLoadingMarketCount } =
    useReadContract({
      contract,
      method: "function marketCount() view returns (uint256)",
      params: [],
    });

  const [leaderboard, setLeaderboard] = useState<
    Array<{
      username: string;
      fid: number;
      winnings: number;
    }>
  >([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(true);

  useEffect(() => {
    setIsLoadingLeaderboard(true);
    fetch("/api/leaderboard")
      .then((res) => res.json())
      .then((data) => {
        setLeaderboard(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error("Leaderboard fetch error:", err);
        setLeaderboard([]);
      })
      .finally(() => {
        setIsLoadingLeaderboard(false);
      });
  }, []);

  // Signal readiness to Farcaster client
  useEffect(() => {
    if (!isLoadingMarketCount && !isLoadingLeaderboard) {
      sdk.actions.ready();
    }
  }, [isLoadingMarketCount, isLoadingLeaderboard]);

  const skeletonCards = Array.from({ length: 6 }, (_, i) => (
    <MarketCardSkeleton key={`skeleton-${i}`} />
  ));

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-grow container mx-auto p-4">
        <Navbar />
        <div className="mb-4">
          <img
            src="banner2.avif"
            alt="Buster Banner"
            className="w-full h-auto rounded-lg"
          />
        </div>
        <Tabs defaultValue="active" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="resolved">Results</TabsTrigger>
            <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          </TabsList>
          {isLoadingMarketCount ? (
            <TabsContent value="active" className="mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {skeletonCards}
              </div>
            </TabsContent>
          ) : (
            <>
              <TabsContent value="active" className="mt-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  {Array.from({ length: Number(marketCount) }, (_, index) => (
                    <MarketCard key={index} index={index} filter="active" />
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="pending" className="mt-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  {Array.from({ length: Number(marketCount) }, (_, index) => (
                    <MarketCard key={index} index={index} filter="pending" />
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="resolved" className="mt-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  {Array.from({ length: Number(marketCount) }, (_, index) => (
                    <MarketCard key={index} index={index} filter="resolved" />
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="leaderboard" className="mt-6">
                <h2 className="text-xl font-bold mb-4">Top Predictors</h2>
                {isLoadingLeaderboard ? (
                  <div className="animate-pulse space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-6 bg-gray-200 rounded"></div>
                    ))}
                  </div>
                ) : leaderboard.length > 0 ? (
                  <ul className="space-y-2">
                    {leaderboard.map((entry, idx) => (
                      <li
                        key={entry.fid}
                        className="flex justify-between text-sm"
                      >
                        <span>
                          {idx + 1}. {entry.username} (FID: {entry.fid})
                        </span>
                        <span>{entry.winnings} BET</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">
                    No leaderboard data available
                  </p>
                )}
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
      <Footer />
    </div>
  );
}
