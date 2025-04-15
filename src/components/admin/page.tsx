"use client";

import { useState, useEffect } from "react";
import { useActiveAccount, useReadContract } from "thirdweb/react";
import { ConnectButton } from "thirdweb/react";
import { contract } from "@/constants/contract";
import { base } from "thirdweb/chains";
import { createWallet } from "thirdweb/wallets";
import { CreateMarketForm } from "@/components/admin/create-market-form";
import { ResolveMarketList } from "@/components/admin/resolve-market-list";
import { GrantRoleForm } from "@/components/admin/grant-role-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { client } from "@/app/client";
import { redirect } from "next/navigation";

const wallets = [
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
  createWallet("me.rainbow"),
];

// Redirect root to /admin
export const dynamic = "force-dynamic";
if (typeof window === "undefined") {
  redirect("/admin");
}

export default function AdminPage() {
  const account = useActiveAccount();
  const { toast } = useToast();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [canCreate, setCanCreate] = useState(false);
  const [canResolve, setCanResolve] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  // Check if user is owner
  const { data: owner } = useReadContract({
    contract,
    method: "function owner() view returns (address)",
    params: [],
  });

  // Check QUESTION_CREATOR_ROLE
  const { data: hasCreatorRole } = useReadContract({
    contract,
    method:
      "function hasRole(bytes32 role, address account) view returns (bool)",
    params: [
      "0x4f3d93ab9e5b9f246762d74ad245e3ba427d8b95b06e5c3966f91e6c216afeda",
      account?.address || "0x0",
    ],
  });

  // Check QUESTION_RESOLVE_ROLE
  const { data: hasResolveRole } = useReadContract({
    contract,
    method:
      "function hasRole(bytes32 role, address account) view returns (bool)",
    params: [
      "0x3c6e7b6e5c0e8e8e3d6e0b90d8b0d4f9b0e1d3d7f9d1d5d7f8d0d3d7f9d1d5d7",
      account?.address || "0x0",
    ],
  });

  useEffect(() => {
    if (!account) {
      setIsAuthorized(false);
      setIsLoading(false);
      toast({
        title: "Access Denied",
        description: "Please connect your wallet.",
        variant: "destructive",
      });
      return;
    }

    if (owner && account.address.toLowerCase() === owner.toLowerCase()) {
      setIsOwner(true);
      setCanCreate(true);
      setCanResolve(true);
      setIsAuthorized(true);
    } else {
      setCanCreate(!!hasCreatorRole);
      setCanResolve(!!hasResolveRole);
      setIsAuthorized(!!hasCreatorRole || !!hasResolveRole);
    }

    setIsLoading(false);
  }, [account, owner, hasCreatorRole, hasResolveRole, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardHeader>
            <CardTitle>Unauthorized</CardTitle>
          </CardHeader>
          <CardContent>
            <p>You do not have permission to access this page.</p>
            <div className="mt-4">
              <ConnectButton
                client={client}
                chain={base}
                wallets={wallets}
                connectModal={{ size: "compact" }}
                connectButton={{
                  label: "Connect Wallet",
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Forecast Admin</h1>
        <ConnectButton
          client={client}
          chain={base}
          wallets={wallets}
          connectModal={{ size: "compact" }}
          connectButton={{
            label: "Connect Wallet",
          }}
        />
      </div>
      {canCreate && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Create New Market</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateMarketForm />
          </CardContent>
        </Card>
      )}
      {canResolve && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Resolve Markets</CardTitle>
          </CardHeader>
          <CardContent>
            <ResolveMarketList />
          </CardContent>
        </Card>
      )}
      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle>Grant Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <GrantRoleForm />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
