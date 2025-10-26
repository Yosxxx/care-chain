/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import * as anchor from "@coral-xyz/anchor";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  Search,
  Loader2,
  ChevronsUpDown,
  SearchCheck,
  BookCheck,
} from "lucide-react"; // Import icons
import idl from "../../../../anchor.json";
import {
  findGrantPda,
  findHospitalPda,
  findPatientPda,
  findConfigPda,
} from "@/lib/pda";
import { SCOPE_OPTIONS } from "@/lib/constants";

// Import shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

// --- Type definitions (unchanged) ---
type HospitalUi = {
  pubkey: string;
  authority: string;
  name: string;
  kmsRef: string;
  createdAt: number;
} | null;

type GrantUi = {
  pubkey: string;
  scope: number;
  patient: string; // PDA
  grantee: string; // hospital authority
  createdBy: string;
  createdAt: number;
  expiresAt?: number | null;
  revoked: boolean;
  revokedAt?: number | null;
};

// --- CONSTANTS ---
const GRANTS_PER_PAGE = 5;

// Filter out the "Admin" scope
const renderableScopeOptions = SCOPE_OPTIONS.filter(
  (opt) => opt.label.toLowerCase() !== "admin"
);

export default function Page() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  // --- State for inputs ---
  const [filterGranteeStr, setFilterGranteeStr] = useState("");
  const [activeGranteeStr, setActiveGranteeStr] = useState("");
  // const [expiresStr, setExpiresStr] = useState(""); // User commented out

  // --- State for UI feedback ---
  const [err, setErr] = useState("");
  const [sig, setSig] = useState("");
  const [hospital, setHospital] = useState<HospitalUi>(null);
  const [patientExists, setPatientExists] = useState<boolean | null>(null);
  const [grants, setGrants] = useState<GrantUi[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState("");

  // --- NEW STATE ---
  // Map of hospital authority pubkey -> hospital name
  const [hospitalMap, setHospitalMap] = useState<Record<string, string>>({});

  // --- Pagination State ---
  const [currentPage, setCurrentPage] = useState(1);

  // --- Anchor/Program setup (unchanged) ---
  const programId = useMemo(
    () => new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID!),
    []
  );
  const provider = useMemo(
    () =>
      wallet
        ? new anchor.AnchorProvider(connection, wallet, {
            commitment: "confirmed",
          })
        : null,
    [connection, wallet]
  );
  const program = useMemo(
    () => (provider ? new anchor.Program(idl as anchor.Idl, provider) : null),
    [provider]
  );

  // --- PDAs and PubKeys (unchanged) ---
  const patientPk = wallet?.publicKey ?? null;
  const patientPda = useMemo(
    () => (patientPk ? findPatientPda(programId, patientPk) : null),
    [programId, patientPk]
  );

  // --- Grantee parsing (unchanged) ---
  const grantee = useMemo(() => {
    try {
      const t = activeGranteeStr.trim();
      return t ? new PublicKey(t) : null;
    } catch {
      return null;
    }
  }, [activeGranteeStr]);

  // --- Patient check (unchanged) ---
  useEffect(() => {
    (async () => {
      setPatientExists(null);
      if (!program || !patientPda) return;
      try {
        // @ts-expect-error anchor account typing
        const acc = await program.account.patient.fetchNullable(patientPda);
        setPatientExists(!!acc);
      } catch {
        setPatientExists(false);
      }
    })();
  }, [program, patientPda]);

  // --- NEW: Load all hospitals for the name map ---
  useEffect(() => {
    (async () => {
      if (!program) return;
      try {
        const allHospitals = await program.account.hospital.all();
        const map: Record<string, string> = {};
        for (const h of allHospitals as any[]) {
          map[h.account.authority.toBase58()] = h.account.name as string;
        }
        setHospitalMap(map);
      } catch (e) {
        console.error("Failed to load all hospitals:", e);
        // Not critical, can just fallback to pubkeys
      }
    })();
  }, [program]);

  // --- Load hospital preview (for searched hospital) (unchanged) ---
  useEffect(() => {
    (async () => {
      setHospital(null);
      if (!program || !grantee) return;
      try {
        const hospitalPda = findHospitalPda(program.programId, grantee);
        // @ts-expect-error anchor account typing
        const acc = await program.account.hospital.fetchNullable(hospitalPda);
        if (!acc) {
          setHospital(null);
          return;
        }
        setHospital({
          pubkey: hospitalPda.toBase58(),
          authority: grantee.toBase58(),
          name: acc.name as string,
          kmsRef: acc.kmsRef as string,
          createdAt: Number(acc.createdAt),
        });
      } catch {
        setHospital(null);
      }
    })();
  }, [program, grantee]);

  // --- Load GRANTS (unchanged) ---
  const loadGrants = async () => {
    setLoading(true);
    setLoadErr("");
    setCurrentPage(1); // Reset to first page on new load
    try {
      if (!program || !patientPda) {
        setGrants([]);
        setLoading(false);
        return;
      }
      const filters: anchor.web3.GetProgramAccountsFilter[] = [
        { memcmp: { offset: 8, bytes: patientPda.toBase58() } },
      ];
      if (grantee) {
        filters.push({ memcmp: { offset: 8 + 32, bytes: grantee.toBase58() } });
      }

      const raw = await program.account.grant.all(filters as any);
      const rows: GrantUi[] = raw.map((r: any) => ({
        pubkey: r.publicKey.toBase58(),
        scope: r.account.scope as number,
        patient: r.account.patient.toBase58(),
        grantee: r.account.grantee.toBase58(),
        createdBy: r.account.createdBy.toBase58?.() ?? r.account.createdBy,
        createdAt: Number(r.account.createdAt),
        expiresAt: r.account.expiresAt ? Number(r.account.expiresAt) : null,
        revoked: !!r.account.revoked,
        revokedAt: r.account.revokedAt ? Number(r.account.revokedAt) : null,
      }));

      rows.sort((a, b) => b.createdAt - a.createdAt);
      setGrants(rows);
    } catch (e: any) {
      setLoadErr(e?.message ?? String(e));
      setGrants([]);
    } finally {
      setLoading(false);
    }
  };

  // --- Auto-load grants (unchanged) ---
  useEffect(() => {
    void loadGrants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program, patientPda?.toBase58(), grantee?.toBase58()]);

  // --- Handle filter submit (unchanged) ---
  const handleFilterSubmit = () => {
    setActiveGranteeStr(filterGranteeStr);
  };

  // --- UI state for toggles (unchanged) ---
  const current: Record<number, boolean> = useMemo(() => {
    const m: Record<number, boolean> = {};
    for (const g of grants) if (!g.revoked) m[g.scope] = true;
    return m;
  }, [grants]);
  const [desired, setDesired] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setDesired(current);
  }, [current]);

  const flip = (bit: number) => setDesired((d) => ({ ...d, [bit]: !d[bit] }));

  // --- BN parsing (unchanged) ---
  const bnOpt = (durationStr: string): anchor.BN | null => {
    const t = durationStr.trim();
    if (!t) return null;
    if (!/^\d+$/.test(t)) {
      throw new Error(
        "Expiry must be a positive integer (duration in seconds)"
      );
    }
    const durationSecs = parseInt(t, 10);
    if (durationSecs <= 0) throw new Error("Duration must be > 0 seconds");
    return new anchor.BN(durationSecs);
  };

  // --- Validation (unchanged) ---
  const ensureReady = () => {
    if (!program || !wallet) throw new Error("Program/wallet not ready");
    if (!patientPk) throw new Error("Connect wallet first");
    if (!patientExists)
      throw new Error("You have not registered as a patient yet");
    if (!grantee)
      throw new Error("Invalid grantee (hospital authority) pubkey");
  };

  const assertHospitalRegistered = async () => {
    const hospitalPda = findHospitalPda(programId, grantee!);
    // @ts-expect-error anchor account typing
    const acc = await program!.account.hospital.fetchNullable(hospitalPda);
    if (!acc)
      throw new Error(
        "Hospital not registered (no Hospital account for this authority)"
      );
  };

  // --- TX functions (unchanged) ---
  const upsertOne = async (scopeByte: number) => {
    setErr("");
    setSig("");
    ensureReady();
    await assertHospitalRegistered();

    const grantPda = findGrantPda(programId, patientPda!, grantee!, scopeByte);
    const configPda = findConfigPda(programId);

    const tx = await program!.methods
      .grantAccess(scopeByte, bnOpt("")) // User commented out expiresStr
      .accounts({
        authority: wallet!.publicKey,
        config: configPda,
        patient: patientPda!,
        grant: grantPda,
        grantee: grantee!,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    setSig(tx);
  };

  const revokeOne = async (scopeByte: number) => {
    setErr("");
    setSig("");
    ensureReady();
    await assertHospitalRegistered();

    const grantPda = findGrantPda(programId, patientPda!, grantee!, scopeByte);

    const tx = await program!.methods
      .revokeGrant()
      .accounts({
        patient: patientPda!,
        grant: grantPda,
        grantee: grantee!,
        authority: wallet!.publicKey,
      })
      .rpc();
    setSig(tx);
  };

  // --- Main save function (unchanged) ---
  const save = async () => {
    try {
      for (const { bit } of renderableScopeOptions) {
        // Use filtered scopes
        const want = !!desired[bit];
        const have = !!current[bit];
        if (want && !have) {
          await upsertOne(bit);
          await loadGrants();
        } else if (!want && have) {
          await revokeOne(bit);
          await loadGrants();
        }
      }
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  };

  // --- Revoke all (User commented out) ---
  // const revokeAll = async () => { ... };

  const canAct = !!program && !!patientPk && patientExists !== false;

  // --- Pagination Logic ---
  const totalPages = Math.ceil(grants.length / GRANTS_PER_PAGE);
  const paginatedGrants = grants.slice(
    (currentPage - 1) * GRANTS_PER_PAGE,
    currentPage * GRANTS_PER_PAGE
  );

  const goToNextPage = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setCurrentPage((p) => Math.min(p + 1, totalPages));
  };
  const goToPrevPage = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setCurrentPage((p) => Math.max(p - 1, 1));
  };
  const goToPage = (
    e: React.MouseEvent<HTMLAnchorElement>,
    pageNum: number
  ) => {
    e.preventDefault();
    setCurrentPage(pageNum);
  };

  // --- Helper to get scope text ---
  const getScopeText = (scope: number) => {
    if (scope === 1) return "Read";
    if (scope === 2) return "Write";
    return `Unknown (${scope})`;
  };

  // --- JSX (No Cards) ---
  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6">
      <header className="font-architekt p-2 border rounded">
        <div className="flex justify-between items-center">
          <div className="flex text-2xl font-bold gap-x-2 items-center">
            <Search size={20} /> Search for Hospitals
          </div>
          <div>░░░░░░░░░░░░░░░░░░░░░░░░░░</div>
        </div>
      </header>

      <div className="flex w-full items-center space-x-2">
        <Input
          type="text"
          placeholder="grantee (hospital authority pubkey)"
          className="font-mono"
          value={filterGranteeStr}
          onChange={(e) => setFilterGranteeStr(e.target.value)}
          disabled={!canAct}
        />
        <Button
          type="button"
          size="icon"
          onClick={handleFilterSubmit}
          disabled={!canAct}
        >
          <Search className="h-4 w-4" />
        </Button>
      </div>

      {/* Patient registration status */}
      {patientExists === false && (
        <Alert variant="destructive">
          <AlertTitle>Patient Record Not Found</AlertTitle>
          <AlertDescription>
            You haven&apos;t registered as a patient yet. Go to{" "}
            <b>Patients (Upsert)</b> and create your patient record first.
          </AlertDescription>
        </Alert>
      )}

      {/* Grantee Selection Section */}
      <section className="border rounded p-6 space-y-4">
        {/* Hospital verification (only if a grantee is searched) */}
        {activeGranteeStr.trim() ? (
          <div className="text-sm">
            {hospital ? (
              <main>
                <div>
                  <div className="font-medium flex items-center gap-x-2">
                    <div className="bg-green-200 rounded-full p-2">
                      <BookCheck className="text-green-800" />
                    </div>
                    <div>
                      <div className="text-green-800">Hospital Verified</div>
                      Authority confirmed and active
                    </div>
                  </div>
                  <div className="text-muted-foreground">
                    <b>Name:</b> {hospital.name}
                  </div>
                  <div className="text-muted-foreground font-mono text-xs">
                    <b>PDA:</b> {hospital.pubkey}
                  </div>
                  <div className="text-muted-foreground font-mono text-xs">
                    <b>Auth:</b> {hospital.authority}
                  </div>
                </div>
                <div>
                  <h2 className="text-lg font-semibold">2. Manage Access</h2>
                  <p className="text-sm text-muted-foreground">
                    Select the permissions you want to grant or revoke.
                  </p>
                  <div className="flex flex-wrap gap-4 items-center text-sm">
                    {renderableScopeOptions.map(
                      (
                        { label, bit } // Use filtered scopes
                      ) => (
                        <div key={bit} className="flex items-center space-x-2">
                          <Checkbox
                            id={`scope-${bit}`}
                            checked={!!desired[bit]}
                            onCheckedChange={() => flip(bit)}
                            disabled={!canAct || !grantee}
                          />
                          <Label
                            htmlFor={`scope-${bit}`}
                            className="flex flex-col gap-1"
                          >
                            {label}
                            <span className="text-xs text-muted-foreground">
                              {current[bit]
                                ? "(current: ON)"
                                : "(current: off)"}
                            </span>
                          </Label>
                        </div>
                      )
                    )}
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button onClick={save} disabled={!canAct || !grantee}>
                      Save Access
                    </Button>
                  </div>
                </div>
              </main>
            ) : (
              <div className="text-yellow-600">
                Hospital not found for this authority. You can view existing
                grants, but new grants will be blocked.
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Search for a hospital to manage its access.
          </p>
        )}
      </section>

      {/* Transaction Status */}
      {sig && (
        <Alert variant="default">
          <AlertTitle>Transaction Sent</AlertTitle>
          <AlertDescription className="font-mono break-all">
            {sig}
          </AlertDescription>
        </Alert>
      )}
      {err && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription className="whitespace-pre-wrap">
            {err}
          </AlertDescription>
        </Alert>
      )}

      {/* Grants List Section */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Current Grants</h2>
        <p className="text-sm text-muted-foreground">
          {grantee
            ? "Grants for the selected hospital."
            : "All grants for your patient record."}
        </p>

        {loadErr && (
          <Alert variant="destructive">
            <AlertDescription>{loadErr}</AlertDescription>
          </Alert>
        )}
        {loading && (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2">Loading grants...</span>
          </div>
        )}

        {/* Grant List - Collapsible */}
        {!loading && paginatedGrants.length > 0 && (
          <div className="flex flex-col gap-y-3">
            {paginatedGrants.map((g) => (
              <Collapsible key={g.pubkey} className="border p-3 rounded">
                <CollapsibleTrigger className="w-full flex justify-between text-left items-center gap-4">
                  <div className="flex-1 min-w-0">
                    {/* --- UPDATED --- */}
                    <div className="font-semibold truncate text-sm">
                      {/* Show hospital name from map, or fallback to grantee pubkey */}
                      {hospitalMap[g.grantee] ?? g.grantee}
                    </div>
                    <div className="text-sm text-muted-foreground space-x-2">
                      <span>{getScopeText(g.scope)}</span>
                      <span>&bull;</span>
                      <span
                        className={
                          g.revoked ? "text-red-600" : "text-green-600"
                        }
                      >
                        {g.revoked ? "Revoked" : "Active"}
                      </span>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground text-right whitespace-nowrap">
                    {new Date(g.createdAt * 1000).toLocaleDateString()}
                  </div>
                  <ChevronsUpDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </CollapsibleTrigger>

                <CollapsibleContent className="mt-4 pt-4 border-t space-y-3">
                  {/* --- UPDATED: Grant Details --- */}
                  <div className="space-y-2 text-sm">
                    <DetailRow
                      label="Hospital Pubkey (Grantee)"
                      value={g.grantee}
                      isMono
                    />
                    <DetailRow label="Grant PDA (TX)" value={g.pubkey} isMono />
                    <DetailRow label="Created By" value={g.createdBy} isMono />
                  </div>

                  {/* Revoke button (only shows if a grantee is selected) */}
                  {!g.revoked && grantee && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={async () => {
                        try {
                          await revokeOne(g.scope);
                          await loadGrants();
                        } catch (e: any) {
                          setErr(e?.message ?? String(e));
                        }
                      }}
                    >
                      Revoke this grant
                    </Button>
                  )}
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        )}

        {/* No grants found */}
        {!loading && grants.length === 0 && (
          <p className="text-sm text-muted-foreground pt-4">No grants found.</p>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <Pagination className="pt-4">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={goToPrevPage}
                  aria-disabled={currentPage === 1}
                  className={
                    currentPage === 1 ? "pointer-events-none opacity-50" : ""
                  }
                />
              </PaginationItem>

              {Array.from({ length: totalPages }).map((_, i) => (
                <PaginationItem key={i}>
                  <PaginationLink
                    href="#"
                    isActive={currentPage === i + 1}
                    onClick={(e) => goToPage(e, i + 1)}
                  >
                    {i + 1}
                  </PaginationLink>
                </PaginationItem>
              ))}

              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={goToNextPage}
                  aria-disabled={currentPage === totalPages}
                  className={
                    currentPage === totalPages
                      ? "pointer-events-none opacity-50"
                      : ""
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </section>
    </main>
  );
}

// Helper component for collapsible content
const DetailRow = ({
  label,
  value,
  isMono = false,
}: {
  label: string;
  value: string;
  isMono?: boolean;
}) => (
  <div>
    <div className="text-xs font-semibold text-muted-foreground uppercase">
      {label}
    </div>
    <div
      className={`rounded border bg-muted p-2 text-muted-foreground break-all ${
        isMono ? "font-mono" : ""
      }`}
    >
      {value}
    </div>
  </div>
);
