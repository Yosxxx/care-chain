"use client";

import * as React from "react";
import * as anchor from "@coral-xyz/anchor";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import idl from "../../../../anchor.json";
import { findPatientPda, findPatientSeqPda, findGrantPda } from "@/lib/pda";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { AreaChart, Area, CartesianGrid, XAxis } from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function OverviewPage() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const [records, setRecords] = React.useState<any[]>([]);
  const [grants, setGrants] = React.useState<any[]>([]);
  const [timeRange, setTimeRange] = React.useState("30d");

  const programId = React.useMemo(
    () => new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID!),
    []
  );
  const provider = React.useMemo(
    () =>
      wallet
        ? new anchor.AnchorProvider(connection, wallet, {
            commitment: "confirmed",
          })
        : null,
    [connection, wallet]
  );
  const program = React.useMemo(
    () => (provider ? new anchor.Program(idl as anchor.Idl, provider) : null),
    [provider]
  );

  const patientPk = wallet?.publicKey ?? null;
  const patientPda = React.useMemo(
    () => (patientPk ? findPatientPda(programId, patientPk) : null),
    [programId, patientPk]
  );

  // === FETCH RECORDS & GRANTS FROM ONCHAIN ===
  React.useEffect(() => {
    (async () => {
      if (!program || !patientPda) return;

      try {
        // --- FETCH RECORDS ---
        const seqPda = findPatientSeqPda(programId, patientPda);
        // @ts-expect-error anchor typing
        const seqAcc = await program.account.patientSeq.fetchNullable(seqPda);
        if (!seqAcc) return;
        const total = Number(seqAcc.value);

        const recs: any[] = [];
        for (let i = 0; i < total; i++) {
          const [recordPda] = PublicKey.findProgramAddressSync(
            [
              Buffer.from("record"),
              patientPda.toBuffer(),
              new anchor.BN(i).toArrayLike(Buffer, "le", 8),
            ],
            programId
          );
          // @ts-expect-error anchor typing
          const rec = await program.account.record.fetchNullable(recordPda);
          if (rec)
            recs.push({
              createdAt: Number(rec.createdAt),
            });
        }
        setRecords(recs.reverse());

        // --- FETCH GRANTS ---
        const allGrants = await program.account.grant.all([
          { memcmp: { offset: 8, bytes: patientPda.toBase58() } },
        ]);

        const parsed = allGrants.map((r: any) => ({
          createdAt: Number(r.account.createdAt),
          revoked: !!r.account.revoked,
          scope: Number(r.account.scope),
        }));
        setGrants(parsed.sort((a, b) => b.createdAt - a.createdAt));
      } catch (err) {
        console.error("Failed to fetch onchain data:", err);
      }
    })();
  }, [program, patientPda]);

  // === METRIC COMPUTATION ===
  const totalRecords = records.length;
  const activeWrite = grants.filter((g) => g.scope === 2 && !g.revoked).length;
  const activeRead = grants.filter((g) => g.scope === 1 && !g.revoked).length;
  const activeTotal = grants.filter((g) => !g.revoked).length;

  // === RANGE FILTER ===
  const days =
    timeRange === "7d"
      ? 7
      : timeRange === "30d"
      ? 30
      : timeRange === "90d"
      ? 90
      : 30;
  const cutoff = Date.now() / 1000 - days * 24 * 3600;

  const filteredRecords = records.filter((r) => r.createdAt >= cutoff);
  const filteredGrants = grants.filter((g) => g.createdAt >= cutoff);

  // === RECORD TREND CHART ===
  const recordChartData = React.useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of filteredRecords) {
      const date = new Date(r.createdAt * 1000).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      map[date] = (map[date] || 0) + 1;
    }
    return Object.entries(map).map(([date, count]) => ({ date, count }));
  }, [filteredRecords]);

  // === GRANT CHART (READ vs WRITE) ===
  const grantChartData = React.useMemo(() => {
    const map: Record<
      string,
      {
        readActive: number;
        writeActive: number;
        readRevoked: number;
        writeRevoked: number;
      }
    > = {};

    for (const g of filteredGrants) {
      const date = new Date(g.createdAt * 1000).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      if (!map[date])
        map[date] = {
          readActive: 0,
          writeActive: 0,
          readRevoked: 0,
          writeRevoked: 0,
        };

      if (g.scope === 1) {
        g.revoked ? map[date].readRevoked++ : map[date].readActive++;
      }
      if (g.scope === 2) {
        g.revoked ? map[date].writeRevoked++ : map[date].writeActive++;
      }
    }

    return Object.entries(map).map(([date, data]) => ({ date, ...data }));
  }, [filteredGrants]);

  return (
    <main className="space-y-8 my-8">
      {/* === HEADER === */}
      <header>
        <h1 className="text-2xl font-bold">Overview</h1>
        <p className="text-sm text-muted-foreground">
          Real-time on-chain overview of your CareChain activity
        </p>
      </header>

      {/* === METRICS GRID === */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Records</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {totalRecords}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Active Write Grants</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {activeWrite}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Active Read Grants</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{activeRead}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Active Grants Total</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {activeTotal}
          </CardContent>
        </Card>
      </section>

      {/* === CHARTS === */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Record Trend */}
        <Card>
          <CardHeader className="flex justify-between border-b py-5">
            <div>
              <CardTitle>Record Creation Trend</CardTitle>
              <CardDescription>
                Based on on-chain creation timestamps
              </CardDescription>
            </div>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[130px] text-xs">
                <SelectValue placeholder="Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>

          <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
            <ChartContainer
              config={{
                count: { label: "Records", color: "var(--chart-1)" },
              }}
              className="aspect-auto h-[250px] w-full"
            >
              <AreaChart data={recordChartData}>
                <defs>
                  <linearGradient id="fillRecords" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--chart-1)"
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--chart-1)"
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      indicator="dot"
                      labelFormatter={(val) => val}
                    />
                  }
                />
                <Area
                  dataKey="count"
                  type="natural"
                  fill="url(#fillRecords)"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* === Grant Comparison === */}
        <Card>
          <CardHeader className="flex justify-between border-b py-5">
            <div>
              <CardTitle>Grant Scope Breakdown</CardTitle>
              <CardDescription>
                Read / Write creation and revoked trends
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
            <ChartContainer
              config={{
                readActive: { label: "Read Active", color: "var(--chart-1)" },
                writeActive: { label: "Write Active", color: "var(--chart-2)" },
                readRevoked: { label: "Read Revoked", color: "var(--chart-3)" },
                writeRevoked: {
                  label: "Write Revoked",
                  color: "var(--chart-4)",
                },
              }}
              className="aspect-auto h-[260px] w-full"
            >
              <AreaChart data={grantChartData}>
                <defs>
                  <linearGradient
                    id="fillReadActive"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="var(--chart-1)"
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--chart-1)"
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                  <linearGradient
                    id="fillWriteActive"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="var(--chart-2)"
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--chart-2)"
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                  <linearGradient
                    id="fillReadRevoked"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="var(--chart-3)"
                      stopOpacity={0.5}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--chart-3)"
                      stopOpacity={0.05}
                    />
                  </linearGradient>
                  <linearGradient
                    id="fillWriteRevoked"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="var(--chart-4)"
                      stopOpacity={0.5}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--chart-4)"
                      stopOpacity={0.05}
                    />
                  </linearGradient>
                </defs>

                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      indicator="dot"
                      labelFormatter={(val) => val}
                    />
                  }
                />

                {/* Active layers */}
                <Area
                  dataKey="readActive"
                  type="natural"
                  fill="url(#fillReadActive)"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  stackId="a"
                />
                <Area
                  dataKey="writeActive"
                  type="natural"
                  fill="url(#fillWriteActive)"
                  stroke="var(--chart-2)"
                  strokeWidth={2}
                  stackId="a"
                />

                {/* Revoked layers */}
                <Area
                  dataKey="readRevoked"
                  type="natural"
                  fill="url(#fillReadRevoked)"
                  stroke="var(--chart-3)"
                  strokeDasharray="4 3"
                  strokeWidth={2}
                  stackId="b"
                />
                <Area
                  dataKey="writeRevoked"
                  type="natural"
                  fill="url(#fillWriteRevoked)"
                  stroke="var(--chart-4)"
                  strokeDasharray="4 3"
                  strokeWidth={2}
                  stackId="b"
                />

                <ChartLegend content={<ChartLegendContent />} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
