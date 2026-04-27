"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminSignInPage() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "admin/invalid-credentials");
      }

      router.replace("/admin");
    } catch {
      setError("Invalid admin credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 px-4 py-10 text-neutral-100">
      <div className="mx-auto w-full max-w-md">
        <Card className="border-neutral-800 bg-neutral-950">
          <CardHeader>
            <CardTitle className="text-xl">Admin access</CardTitle>
            <CardDescription className="text-neutral-400">
              Sign in as super admin to manage users, reports, and verification.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-user">User</Label>
                <Input
                  id="admin-user"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="border-neutral-800 bg-neutral-950"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password">Password</Label>
                <Input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="border-neutral-800 bg-neutral-950"
                />
              </div>
              {error ? (
                <div className="rounded-xl border border-red-900/40 bg-red-950/30 p-3 text-sm text-red-200">
                  {error}
                </div>
              ) : null}
              <Button
                type="submit"
                className="w-full bg-orange-400 text-black hover:bg-orange-300"
                disabled={loading}
              >
                {loading ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
