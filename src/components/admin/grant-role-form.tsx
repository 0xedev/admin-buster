"use client";

import { useState } from "react";
import { useActiveAccount, useSendAndConfirmTransaction } from "thirdweb/react";
import { prepareContractCall } from "thirdweb";
import { contract } from "@/constants/contract";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";

export function GrantRoleForm() {
  const account = useActiveAccount();
  const { mutateAsync: sendTransaction, isPending } =
    useSendAndConfirmTransaction();
  const { toast } = useToast();

  const [address, setAddress] = useState("");
  const [role, setRole] = useState<"creator" | "resolver" | "">("");

  const handleGrantRole = async () => {
    if (!account) {
      toast({
        title: "Error",
        description: "Please connect your wallet.",
        variant: "destructive",
      });
      return;
    }

    if (!address || !role) {
      toast({
        title: "Error",
        description: "Address and role are required.",
        variant: "destructive",
      });
      return;
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      toast({
        title: "Error",
        description: "Invalid Ethereum address.",
        variant: "destructive",
      });
      return;
    }

    try {
      const method =
        role === "creator"
          ? "function grantQuestionCreatorRole(address _account)"
          : "function grantQuestionResolveRole(address _account)";

      const transaction = await prepareContractCall({
        contract,
        method,
        params: [address],
      });

      await sendTransaction(transaction);
      toast({
        title: "Success",
        description: `Granted ${role} role to ${address}.`,
      });
      setAddress("");
      setRole("");
    } catch (error) {
      console.error("Grant role error:", error);
      toast({
        title: "Error",
        description: "Failed to grant role. Check console for details.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="address" className="block text-sm font-medium">
          Address
        </label>
        <Input
          id="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Enter Ethereum address (0x...)"
        />
      </div>
      <div>
        <label htmlFor="role" className="block text-sm font-medium">
          Role
        </label>
        <select
          id="role"
          value={role}
          onChange={(e) =>
            setRole(e.target.value as "creator" | "resolver" | "")
          }
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Select role</option>
          <option value="creator">Question Creator</option>
          <option value="resolver">Question Resolver</option>
        </select>
      </div>
      <Button onClick={handleGrantRole} disabled={isPending || !account}>
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Granting...
          </>
        ) : (
          "Grant Role"
        )}
      </Button>
    </div>
  );
}
