"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { verifyAdminAuth, type AdminAuth } from "@/lib/api";

const STORAGE_KEY = "gsrtc_admin_auth";

export default function AdminLoginGate({
  children,
}: {
  children: (auth: AdminAuth) => React.ReactNode;
}) {
  const [auth, setAuth] = useState<AdminAuth | null>(null);
  const [user, setUser] = useState("admin");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as AdminAuth;
      verifyAdminAuth(parsed).then((ok) => {
        if (ok) setAuth(parsed);
        else sessionStorage.removeItem(STORAGE_KEY);
        setChecking(false);
      });
    } else {
      setChecking(false);
    }
  }, []);

  async function handleLogin() {
    setError("");
    const candidate = { user, pass };
    const ok = await verifyAdminAuth(candidate);
    if (!ok) {
      setError("Invalid credentials");
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(candidate));
    setAuth(candidate);
  }

  if (checking) return null;

  if (!auth) {
    return (
      <div className="flex h-screen items-center justify-center app-bg">
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <Card className="w-80">
            <CardHeader className="items-center text-center">
              <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg shadow-blue-600/30">
                <Lock className="h-5 w-5 text-white" />
              </div>
              <CardTitle>Admin Login</CardTitle>
              <p className="text-xs text-white/40">Sign in to manage the fleet</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Username" value={user} onChange={(e) => setUser(e.target.value)} />
              <Input
                placeholder="Password"
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
              {error && <p className="text-sm text-red-400">{error}</p>}
              <Button className="w-full" onClick={handleLogin}>
                Sign in
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return <>{children(auth)}</>;
}
