"use client";

import * as React from "react";
import * as anchor from "@coral-xyz/anchor";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import idl from "../../../../anchor.json";
import { findHospitalPda } from "@/lib/pda";

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

export default function Page() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const [records, setRecords] = React.useState<any[]>([]);
  const [grants, setGrants] = React.useState<any[]>([]);
  const [timeRange, setTimeRange] = React.useState("30d");
  const [loading, setLoading] = React.useState(false);

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

  // ─── PDAs ────────────────────────────────
  const hospitalPda = React.useMemo(
    () =>
      wallet?.publicKey ? findHospitalPda(programId, wallet.publicKey) : null,
    [programId, wallet?.publicKey]
  );

  // ─── FETCH DATA ──────────────────────────
  React.useEffect(() => {
    (async () => {
      if (!program || !hospitalPda) return;
      setLoading(true);

      try {
        // === RECORDS ===
        const allRecords = await program.account.record.all([
          { memcmp: { offset: 8 + 32, bytes: hospitalPda.toBase58() } },
        ]);

        const parsedRecords = allRecords.map((r: any) => ({
          createdAt: Number(r.account.created_at),
          patient: r.account.patient.toBase58(),
        }));
        setRecords(parsedRecords.sort((a, b) => b.createdAt - a.createdAt));

        // === GRANTS ===
        const allGrants = await program.account.grant.all([
          { memcmp: { offset: 8 + 32, bytes: wallet.publicKey.toBase58() } },
        ]);

        const parsedGrants = allGrants.map((r: any) => ({
          createdAt: Number(r.account.created_at),
          revoked: !!r.account.revoked,
          scope: Number(r.account.scope),
          patient: r.account.patient.toBase58(),
        }));
        setGrants(parsedGrants.sort((a, b) => b.createdAt - a.createdAt));
      } catch (e) {
        console.error("Failed to fetch hospital data:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [program, hospitalPda, wallet]);

  // ─── METRICS ─────────────────────────────
  const totalRecords = records.length;
  const uniquePatients = new Set(records.map((r) => r.patient)).size;
  const activeWriteGrants = grants.filter(
    (g) => g.scope === 2 && !g.revoked
  ).length;
  const totalGrants = grants.length;

  // ─── RANGE FILTER (WITH FIX) ──────────────────
  const days =
    timeRange === "7d"
      ? 7
      : timeRange === "30d"
      ? 30
      : timeRange === "90d"
      ? 90
      : timeRange === "365d" // <-- Added this
      ? 365
      : 99999; // <-- Default for "All time"

  // Set cutoff to 0 if "all" is selected, otherwise calculate based on days
  const cutoff = timeRange === "all" ? 0 : Date.now() / 1000 - days * 24 * 3600;

  const filteredRecords = records.filter((r) => r.createdAt >= cutoff);
  const filteredGrants = grants.filter((g) => g.createdAt >= cutoff);

  // ─── CHART: Record Upload Trend ───────────
  const recordChartData = React.useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of filteredRecords) {
      const ts = r.createdAt > 1e12 ? r.createdAt / 1000 : r.createdAt; // auto-detect
      const date = new Date(ts * 1000).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      map[date] = (map[date] || 0) + 1;
    }
    return Object.entries(map).map(([date, count]) => ({ date, count }));
  }, [filteredRecords]);

  // ─── CHART: Grant Activity ───────────────
  const grantChartData = React.useMemo(() => {
    const map: Record<string, { writeActive: number; writeRevoked: number }> =
      {};

    for (const g of filteredGrants) {
      const date = new Date(g.createdAt * 1000).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      if (!map[date]) map[date] = { writeActive: 0, writeRevoked: 0 };
      if (g.scope === 2) {
        g.revoked ? map[date].writeRevoked++ : map[date].writeActive++;
      }
    }
    return Object.entries(map).map(([date, data]) => ({ date, ...data }));
  }, [filteredGrants]);

  // ─── UI ──────────────────────────────────
  return (
    <main className="space-y-8 my-8">
      {/* === HEADER === */}
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Hospital Overview</h1>
        <p className="text-sm text-muted-foreground">
          Real-time summary of on-chain activity for this hospital
        </p>
      </header>

      {/* === METRICS GRID === */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Total Records Uploaded" value={totalRecords} />
        <MetricCard title="Unique Patients Served" value={uniquePatients} />
        <MetricCard title="Active Write Grants" value={activeWriteGrants} />
        <MetricCard title="Total Grants" value={totalGrants} />
      </section>

      {/* === CHARTS === */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <ChartCard
          title="Record Upload Trend"
          desc="Records created and uploaded by this hospital"
          timeRange={timeRange}
          setTimeRange={setTimeRange}
          data={recordChartData}
          dataKey="count"
          label="Records"
          gradientId="fillRecords"
          strokeColor="var(--chart-1)"
        />
        <ChartCard
          title="Write Grant Trend"
          desc="Grants from patients authorizing write access"
          timeRange={timeRange} // <-- Pass props to the second chart too
          setTimeRange={setTimeRange} // <-- Pass props to the second chart too
          data={grantChartData}
          label="Grants"
          multiSeries={[
            {
              key: "writeActive",
              label: "Active Write",
              color: "var(--chart-2)",
            },
            {
              key: "writeRevoked",
              label: "Revoked Write",
              color: "var(--chart-4)",
            },
          ]}
        />
      </section>

      {loading && (
        <p className="text-sm text-muted-foreground italic">
          Fetching on-chain data...
        </p>
      )}
    </main>
  );
}

// ─── REUSABLE METRIC CARD ──────────────────────────────
function MetricCard({
  title,
  value,
}: {
  title: string;
  value: number | string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-bold">{value}</CardContent>
    </Card>
  );
}

// ─── REUSABLE CHART CARD (WITH FIX) ──────────────────
function ChartCard({
  title,
  desc,
  data,
  dataKey,
  label,
  gradientId,
  strokeColor,
  multiSeries,
  timeRange,
  setTimeRange,
}: {
  title: string;
  desc: string;
  data: any[];
  dataKey?: string;
  label?: string;
  gradientId?: string;
  strokeColor?: string;
  multiSeries?: { key: string; label: string; color: string }[];
  timeRange?: string;
  setTimeRange?: (v: string) => void;
}) {
  const chartConfig = multiSeries
    ? multiSeries.reduce((acc, s) => {
        acc[s.key] = { label: s.label, color: s.color };
        return acc;
      }, {} as any)
    : { [dataKey ?? "value"]: { label, color: strokeColor } };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between border-b py-5">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{desc}</CardDescription>
        </div>
        {setTimeRange && timeRange && (
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[130px] text-xs">
              <SelectValue placeholder="Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="365d">Last 365 days</SelectItem>{" "}
              {/* <-- ADDED */}
              <SelectItem value="all">All time</SelectItem> {/* <-- ADDED */}
            </SelectContent>
          </Select>
        )}
      </CardHeader>

      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-[250px] text-sm text-muted-foreground">
            No data for selected range
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[250px] w-full"
          >
            <AreaChart
              data={data}
              margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
            >
              <defs>
                {multiSeries ? (
                  multiSeries.map((s) => (
                    <linearGradient
                      key={s.key}
                      id={`fill-${s.key}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor={s.color} stopOpacity={0.8} />
                      <stop
                        offset="95%"
                        stopColor={s.color}
                        stopOpacity={0.05}
                      />
                    </linearGradient>
                  ))
                ) : (
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor={strokeColor}
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor={strokeColor}
                      stopOpacity={0.05}
                    />
                  </linearGradient>
                )}
              </defs>

              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    indicator="dot"
                    labelFormatter={(label) => `📅 ${label}`}
                    formatter={(value, name) => [
                      `${value}`,
                      chartConfig[name]?.label || name,
                    ]}
                  />
                }
              />

              {multiSeries ? (
                multiSeries.map((s) => (
                  <Area
                    key={s.key}
                    dataKey={s.key}
                    type="monotone"
                    fill={`url(#fill-${s.key})`}
                    stroke={s.color}
                    strokeWidth={2}
                    activeDot={{ r: 4 }}
                  />
                ))
              ) : (
                <Area
                  dataKey={dataKey ?? "value"}
                  type="monotone"
                  fill={`url(#${gradientId})`}
                  stroke={strokeColor}
                  strokeWidth={2}
                  activeDot={{ r: 4 }}
                />
              )}

              {multiSeries && <ChartLegend content={<ChartLegendContent />} />}
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
