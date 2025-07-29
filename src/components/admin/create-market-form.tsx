"use client";

import { useState } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { contractAddress, contractAbi } from "@/constants/contract";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";

export function CreateMarketForm() {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash,
  });
  const { toast } = useToast();

  const [question, setQuestion] = useState("");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [duration, setDuration] = useState("");

  const handleCreateMarket = async () => {
    if (!address) {
      toast({
        title: "Error",
        description: "Please connect your wallet.",
        variant: "destructive",
      });
      return;
    }

    if (!question || !optionA || !optionB || !duration) {
      toast({
        title: "Error",
        description: "All fields are required.",
        variant: "destructive",
      });
      return;
    }

    const durationSeconds = Number(duration) * 24 * 60 * 60; // Convert days to seconds
    if (durationSeconds <= 0) {
      toast({
        title: "Error",
        description: "Duration must be greater than 0.",
        variant: "destructive",
      });
      return;
    }

    try {
      writeContract({
        address: contractAddress,
        abi: contractAbi,
        functionName: "createMarket",
        args: [question, optionA, optionB, BigInt(durationSeconds)],
      });

      toast({
        title: "Success",
        description: "Market created successfully!",
      });
      setQuestion("");
      setOptionA("");
      setOptionB("");
      setDuration("");
    } catch (error) {
      console.error("Create market error:", error);
      toast({
        title: "Error",
        description: "Failed to create market. Check console for details.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="question" className="block text-sm font-medium">
          Question
        </label>
        <Input
          id="question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Enter market question"
        />
      </div>
      <div>
        <label htmlFor="optionA" className="block text-sm font-medium">
          Option A
        </label>
        <Input
          id="optionA"
          value={optionA}
          onChange={(e) => setOptionA(e.target.value)}
          placeholder="Enter option A"
        />
      </div>
      <div>
        <label htmlFor="optionB" className="block text-sm font-medium">
          Option B
        </label>
        <Input
          id="optionB"
          value={optionB}
          onChange={(e) => setOptionB(e.target.value)}
          placeholder="Enter option B"
        />
      </div>
      <div>
        <label htmlFor="duration" className="block text-sm font-medium">
          Duration (days)
        </label>
        <Input
          id="duration"
          type="number"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          placeholder="Enter duration in days"
        />
      </div>
      <Button
        onClick={handleCreateMarket}
        disabled={isPending || isConfirming || !address}
      >
        {isPending || isConfirming ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating...
          </>
        ) : (
          "Create Market"
        )}
      </Button>
    </div>
  );
}
