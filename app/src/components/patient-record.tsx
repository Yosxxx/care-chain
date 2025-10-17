import { Button } from "@/components/ui/button";
import AppendRecord from "@/components/append-record";

const records = [
    {
        title: "Annual Check-up",
        diagnosis: "Normal",
        hospital: "CareChain General Hospital",
        doctorId: "DOC-4321",
        date: "2025-03-12",
    },
    {
        title: "Chest Pain Evaluation",
        diagnosis: "Mild Angina",
        hospital: "Metro Heart Center",
        doctorId: "DOC-1177",
        date: "2025-04-09",
    },
    {
        title: "Diabetes Follow-up",
        diagnosis: "Type II Controlled",
        hospital: "St. Mary's Medical",
        doctorId: "DOC-2219",
        date: "2025-06-22",
    },
    {
        title: "Knee Injury Assessment",
        diagnosis: "ACL Tear (Right)",
        hospital: "Elite Sports Hospital",
        doctorId: "DOC-0890",
        date: "2025-08-03",
    },
];

export default function PatientRecord() {
    return (
        <main>
            <div className="flex justify-between items-center mb-2">
                <div>
                    <div className="text-2xl font-bold">PATIENT RECORDS</div>
                    <div className="font-mono">Wallet: 7xKH...m9pL</div>
                </div>
                <div>
                    <div className="flex gap-x-5">
                        <Button>AI Summary</Button>
                        <Button>Append Record</Button>
                    </div>
                </div>
            </div>

            <div className="mb-5">
                <AppendRecord />
            </div>

            <table className="min-w-full border text-sm">
                <thead className="bg-muted">
                    <tr>
                        <th className="border px-3 py-2 text-left">Title</th>
                        <th className="border px-3 py-2 text-left">
                            Diagnosis
                        </th>
                        <th className="border px-3 py-2 text-left">Hospital</th>
                        <th className="border px-3 py-2 text-left">
                            Doctor ID
                        </th>
                        <th className="border px-3 py-2 text-left">Date</th>
                    </tr>
                </thead>
                <tbody>
                    {records.map((r, i) => (
                        <tr key={i}>
                            <td className="border px-3 py-2">{r.title}</td>
                            <td className="border px-3 py-2">{r.diagnosis}</td>
                            <td className="border px-3 py-2">{r.hospital}</td>
                            <td className="border px-3 py-2">{r.doctorId}</td>
                            <td className="border px-3 py-2">{r.date}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </main>
    );
}
