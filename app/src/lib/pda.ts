import { PublicKey } from "@solana/web3.js";

export const findConfigPda = (pid: PublicKey) =>
  PublicKey.findProgramAddressSync([Buffer.from("config")], pid)[0];

export const findHospitalPda = (pid: PublicKey, auth: PublicKey) =>
  PublicKey.findProgramAddressSync([Buffer.from("hospital"), auth.toBuffer()], pid)[0];

export const findGrantPda = (pid: PublicKey, patient: PublicKey, grantee: PublicKey, scope: number) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("grant"), patient.toBuffer(), grantee.toBuffer(), Buffer.from([scope & 0xff])],
    pid
  )[0];

export const findPatientPda = (pid: PublicKey, patientPk: PublicKey) =>
  PublicKey.findProgramAddressSync([Buffer.from("patient"), patientPk.toBuffer()], pid)[0];

export const findPatientSeqPda = (pid: PublicKey, patientPk: PublicKey) =>
  PublicKey.findProgramAddressSync([Buffer.from("patient_seq"), patientPk.toBuffer()], pid)[0];