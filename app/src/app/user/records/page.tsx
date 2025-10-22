"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { FilterButton } from "@/components/filter-button";
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Copy, SquareArrowOutUpRight } from "lucide-react";

export default function Page() {
  // --- Expanded Mock Data (10 items) ---
  const mockRecords = [
    {
      id: 1,
      title: "Annual Checkup",
      keywords: "Checkup, BP, Sugar",
      hospital_pubkey: "HOSPITAL_ABC",
      hospital_name: "Medika Central",
      doctor_id: "DOC123",
      doctor_name: "Dr. Albert",
      transaction_id: "TXN001",
      date: "2025-10-02",
      type: "General",
    },
    {
      id: 2,
      title: "Dental Consultation",
      keywords: "Cavity, Cleaning",
      hospital_pubkey: "HOSPITAL_DEF",
      hospital_name: "SmileCare Dental",
      doctor_id: "DOC456",
      doctor_name: "Dr. Benedict",
      transaction_id: "TXN002",
      date: "2025-08-14",
      type: "Dental",
    },
    {
      id: 3,
      title: "Eye Examination",
      keywords: "Vision, Glasses",
      hospital_pubkey: "HOSPITAL_GHI",
      hospital_name: "VisionPlus Eye Center",
      doctor_id: "DOC789",
      doctor_name: "Dr. Clara",
      transaction_id: "TXN003",
      date: "2025-09-21",
      type: "Ophthalmology",
    },
    {
      id: 4,
      title: "Blood Test",
      keywords: "Hemoglobin, Platelets",
      hospital_pubkey: "HOSPITAL_JKL",
      hospital_name: "HealthFirst Labs",
      doctor_id: "DOC321",
      doctor_name: "Dr. David",
      transaction_id: "TXN004",
      date: "2025-07-10",
      type: "Laboratory",
    },
    {
      id: 5,
      title: "Cardiac Screening",
      keywords: "ECG, Blood Pressure",
      hospital_pubkey: "HOSPITAL_MNO",
      hospital_name: "HeartCare Hospital",
      doctor_id: "DOC654",
      doctor_name: "Dr. Elisa",
      transaction_id: "TXN005",
      date: "2025-09-05",
      type: "Cardiology",
    },
    {
      id: 6,
      title: "Allergy Test",
      keywords: "Skin, Reaction",
      hospital_pubkey: "HOSPITAL_PQR",
      hospital_name: "AllerFree Clinic",
      doctor_id: "DOC222",
      doctor_name: "Dr. Frank",
      transaction_id: "TXN006",
      date: "2025-06-20",
      type: "Immunology",
    },
    {
      id: 7,
      title: "X-Ray Scan",
      keywords: "Chest, Bones",
      hospital_pubkey: "HOSPITAL_STU",
      hospital_name: "Radiant Imaging",
      doctor_id: "DOC333",
      doctor_name: "Dr. Grace",
      transaction_id: "TXN007",
      date: "2025-08-25",
      type: "Radiology",
    },
    {
      id: 8,
      title: "Ultrasound Examination",
      keywords: "Abdomen, Pregnancy",
      hospital_pubkey: "HOSPITAL_VWX",
      hospital_name: "EchoWave Diagnostics",
      doctor_id: "DOC444",
      doctor_name: "Dr. Henry",
      transaction_id: "TXN008",
      date: "2025-07-28",
      type: "Imaging",
    },
    {
      id: 9,
      title: "Physiotherapy Session",
      keywords: "Back Pain, Recovery",
      hospital_pubkey: "HOSPITAL_YZA",
      hospital_name: "MoveWell Center",
      doctor_id: "DOC555",
      doctor_name: "Dr. Irene",
      transaction_id: "TXN009",
      date: "2025-09-18",
      type: "Rehabilitation",
    },
    {
      id: 10,
      title: "Vaccination",
      keywords: "COVID-19 Booster",
      hospital_pubkey: "HOSPITAL_BCD",
      hospital_name: "CareVax Station",
      doctor_id: "DOC666",
      doctor_name: "Dr. James",
      transaction_id: "TXN010",
      date: "2025-05-05",
      type: "Preventive",
    },
  ];

  // --- States ---
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const perPage = 5;
  const totalPages = Math.ceil(mockRecords.length / perPage);

  // --- Filtering + Sorting Logic ---
  const filteredRecords = mockRecords.filter((rec) =>
    rec.title.toLowerCase().includes(search.toLowerCase())
  );

  if (filterMode === "doctor") {
    filteredRecords.sort((a, b) => a.doctor_name.localeCompare(b.doctor_name));
  } else if (filterMode === "hospital") {
    filteredRecords.sort((a, b) =>
      a.hospital_name.localeCompare(b.hospital_name)
    );
  } else if (filterMode === "dateAsc") {
    filteredRecords.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  } else if (filterMode === "dateDesc") {
    filteredRecords.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  // --- Pagination Logic ---
  const startIndex = (page - 1) * perPage;
  const paginatedRecords = filteredRecords.slice(
    startIndex,
    startIndex + perPage
  );

  const handleNext = () => {
    if (page < totalPages) setPage(page + 1);
  };

  const handlePrev = () => {
    if (page > 1) setPage(page - 1);
  };

  const handlePageClick = (pageNum: number) => setPage(pageNum);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Records</h1>
        <p>View your medical records</p>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-2">
        <Input
          placeholder="Search records..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <FilterButton
          options={[
            { label: "Default", value: null },
            { label: "Doctor Name (A-Z)", value: "doctor" },
            { label: "Hospital Name (A-Z)", value: "hospital" },
            { label: "Date ↑", value: "dateAsc" },
            { label: "Date ↓", value: "dateDesc" },
          ]}
          selected={filterMode}
          onChange={(val) => {
            setFilterMode(val);
            setPage(1);
          }}
        />
      </div>

      {/* Records */}
      <div className="flex flex-col gap-y-4">
        {paginatedRecords.map((rec) => (
          <Collapsible key={rec.id} className="border p-3 rounded-md">
            <CollapsibleTrigger className="w-full flex justify-between text-left">
              <div>
                <div className="font-semibold">{rec.title}</div>
                <div className="text-sm text-muted-foreground">
                  {rec.keywords}
                </div>
              </div>
              <div className="text-sm">{rec.date}</div>
            </CollapsibleTrigger>

            <CollapsibleContent className="mt-3 space-y-1">
              {[
                { label: "Doctor", value: rec.doctor_name },
                { label: "Hospital", value: rec.hospital_name },
                { label: "Hospital Pubkey", value: rec.hospital_pubkey },
                { label: "Doctor ID", value: rec.doctor_id },
                { label: "Transaction ID", value: rec.transaction_id },
              ].map((item, i) => (
                <div key={i}>
                  <div>{item.label}</div>
                  <div className="flex gap-x-2 items-center">
                    <div className="p-2 border rounded font-mono flex-1">
                      {item.value}
                    </div>
                    <div className="space-x-2">
                      <Button size="icon">
                        <Copy />
                      </Button>
                      <Button size="icon">
                        <SquareArrowOutUpRight />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>

      {/* Pagination */}
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={(e) => {
                e.preventDefault();
                handlePrev();
              }}
            />
          </PaginationItem>

          {Array.from({ length: totalPages }).map((_, i) => (
            <PaginationItem key={i}>
              <PaginationLink
                href="#"
                isActive={page === i + 1}
                onClick={(e) => {
                  e.preventDefault();
                  handlePageClick(i + 1);
                }}
              >
                {i + 1}
              </PaginationLink>
            </PaginationItem>
          ))}

          <PaginationItem>
            <PaginationNext
              href="#"
              onClick={(e) => {
                e.preventDefault();
                handleNext();
              }}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </main>
  );
}
