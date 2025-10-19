import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { BN } from 'bn.js';
import { expect } from 'chai';
import { Anchor } from '../target/types/anchor';

const SEED_CONFIG = 'config';
const SEED_PATIENT = 'patient';
const SEED_PATIENT_SEQ = 'patient_seq';
const SEED_HOSPITAL = 'hospital';
const SEED_GRANT = 'grant';
const SEED_RECORD = 'record';

const SCOPE_READ = 1 << 0;
const SCOPE_WRITE = 1 << 1;
const SCOPE_ADMIN = 1 << 2;
const ALLOWED = SCOPE_READ | SCOPE_WRITE | SCOPE_ADMIN;

const COMMITMENT: anchor.web3.Commitment = 'confirmed';

const u64LeBytes = (n: BN | number): Buffer => {
  const bn = BN.isBN(n as any) ? (n as BN) : new BN(n);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(bn.toString()));
  return buf;
};

describe('carechain end-to-end (happy + unhappy paths)', () => {
  // provider with confirmed commitment
  const base = anchor.AnchorProvider.local();
  const provider = new anchor.AnchorProvider(base.connection, base.wallet, {
    commitment: COMMITMENT,
    preflightCommitment: COMMITMENT,
  });
  anchor.setProvider(provider);

  const program = (anchor.workspace.Anchor as Program<Anchor>) as Program<any>;
  const connection = provider.connection;

  // actors
  const admin = anchor.web3.Keypair.generate();              // config.authority / registrar
  const patientAuthority = anchor.web3.Keypair.generate();   // wallet behind Patient PDA
  const hospitalAuthority = anchor.web3.Keypair.generate();  // wallet behind Hospital PDA (also grantee)
  const rando = anchor.web3.Keypair.generate();              // unauthorized

  // PDAs
  let configPda: anchor.web3.PublicKey;
  let patientPda: anchor.web3.PublicKey;
  let patientBump: number;
  let patientSeqPda: anchor.web3.PublicKey;
  let hospitalPda: anchor.web3.PublicKey;
  let grantWritePda: anchor.web3.PublicKey;
  let recordPda: anchor.web3.PublicKey;

  // helpers
  const airdrop = async (pk: anchor.web3.PublicKey, lamports = 2e9) => {
    const sig = await connection.requestAirdrop(pk, lamports);
    await connection.confirmTransaction(sig, COMMITMENT);
  };

  const nowUnix = async () => {
    const slot = await connection.getSlot(COMMITMENT);
    const ts = await connection.getBlockTime(slot);
    return new BN(ts ?? Math.floor(Date.now() / 1000));
  };

  const deriveConfigPda = () => {
    const [pda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from(SEED_CONFIG)],
      program.programId
    );
    configPda = pda;
  };

  const derivePatientPdas = () => {
    const [pda, bump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from(SEED_PATIENT), patientAuthority.publicKey.toBuffer()],
      program.programId
    );
    patientPda = pda;
    patientBump = bump;

    const [seqPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from(SEED_PATIENT_SEQ), patientPda.toBuffer()],
      program.programId
    );
    patientSeqPda = seqPda;
  };

  const deriveHospitalPda = () => {
    const [pda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from(SEED_HOSPITAL), hospitalAuthority.publicKey.toBuffer()],
      program.programId
    );
    hospitalPda = pda;
  };

  // CRITICAL: Grant seeds = [b"grant", patientPda, hospitalAuthority.pubkey, [scope]]
  const deriveGrantPda = (scopeByte: number) => {
    const [pda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from(SEED_GRANT),
        patientPda.toBuffer(),                      // patient (Patient PDA)
        hospitalAuthority.publicKey.toBuffer(),     // grantee (SystemAccount wallet)
        Buffer.from([scopeByte & 0xff]),
      ],
      program.programId
    );
    return pda;
  };

  const deriveRecordPda = (seq: BN | number) => {
    const [pda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from(SEED_RECORD), patientPda.toBuffer(), u64LeBytes(seq)],
      program.programId
    );
    return pda;
  };

  // bootstrap
  before('airdrop & derive PDAs', async () => {
    await Promise.all([
      airdrop(provider.wallet.publicKey),
      airdrop(admin.publicKey),
      airdrop(patientAuthority.publicKey),
      airdrop(hospitalAuthority.publicKey),
      airdrop(rando.publicKey),
    ]);

    deriveConfigPda();
    derivePatientPdas();
    deriveHospitalPda();
  });

  it('HAPPY: init_config (sets program authority and KMS namespace)', async () => {
    const kmsNs = 'carechain-dev';

    let ev: any | null = null;
    const sub = await program.addEventListener('ConfigInitialized', (e: any) => (ev = e));

    await program.methods
      .initConfig(kmsNs)
      .accounts({
        config: configPda,
        authority: admin.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([admin])
      .rpc();

    await program.removeEventListener(sub);

    const cfg = await program.account.config.fetch(configPda);
    expect(cfg.authority.toBase58()).to.eq(admin.publicKey.toBase58());
    expect(cfg.kmsNamespace).to.eq(kmsNs);

    if (ev) {
      expect(ev.authority.toBase58()).to.eq(admin.publicKey.toBase58());
      expect(ev.kmsNamespace).to.eq(kmsNs);
      expect(ev.createdAt).to.be.a('bn');
    }
  });

  it('HAPPY: upsert_patient (creates patient + patient_seq)', async () => {
    const idHash = Buffer.alloc(32, 7);
    const did = 'did:example:kresna';

    let ev: any | null = null;
    const sub = await program.addEventListener('PatientUpserted', (e: any) => (ev = e));

    await program.methods
      .upsertPatient(Array.from(idHash), did)
      .accounts({
        authority: patientAuthority.publicKey,
        patient: patientPda,
        patientSeq: patientSeqPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([patientAuthority])
      .rpc();

    await program.removeEventListener(sub);

    const pat = await program.account.patient.fetch(patientPda);
    expect(pat.patientPubkey.toBase58()).to.eq(patientAuthority.publicKey.toBase58());
    expect(Buffer.from(pat.idHash)).to.have.length(32);
    expect(pat.did).to.eq(did);

    const seq = await program.account.patientSeq.fetch(patientSeqPda);
    expect(seq.patient.toBase58()).to.eq(patientPda.toBase58());
    expect(seq.value.toNumber()).to.be.a('number');

    if (ev) {
      expect(ev.patient.toBase58()).to.eq(patientPda.toBase58());
      expect(ev.patientPubkey.toBase58()).to.eq(patientAuthority.publicKey.toBase58());
    }
  });

  it('HAPPY: register_hospitals (creates Hospital PDA)', async () => {
    const name = 'RS A Sehat';
    const kmsRef = 'vault://hsm/rs-a';

    let ev: any | null = null;
    const sub = await program.addEventListener('HospitalRegistered', (e: any) => (ev = e));

    await program.methods
      .registerHospitals(name, kmsRef)
      .accounts({
        registrar: admin.publicKey,
        config: configPda,
        hospitalAuthority: hospitalAuthority.publicKey,
        hospital: hospitalPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([admin])
      .rpc();

    await program.removeEventListener(sub);

    const hosp = await program.account.hospital.fetch(hospitalPda);
    expect(hosp.authority.toBase58()).to.eq(hospitalAuthority.publicKey.toBase58());
    expect(hosp.name).to.eq(name);
    expect(hosp.kmsRef).to.eq(kmsRef);

    if (ev) {
      expect(ev.hospital.toBase58()).to.eq(hospitalPda.toBase58());
      expect(ev.hospitalAuthority.toBase58()).to.eq(hospitalAuthority.publicKey.toBase58());
    }
  });

  it('HAPPY: grant_access (WRITE) by patient → emits GrantCreated', async () => {
    const scope = SCOPE_WRITE;
    const t0 = await nowUnix();
    const expiresAt = t0.add(new BN(3600));

    // Must match on-chain seeds exactly
    grantWritePda = deriveGrantPda(scope);

    let ev: any | null = null;
    const sub = await program.addEventListener('GrantCreated', (e: any) => (ev = e));

    await program.methods
      .grantAccess(scope, expiresAt)
      .accounts({
        authority: patientAuthority.publicKey,
        config: configPda,
        patient: patientPda,                      // Patient PDA
        grant: grantWritePda,                     // [grant, patientPda, hospitalAuthority, [scope]]
        grantee: hospitalAuthority.publicKey,     // SystemAccount (wallet), not Hospital PDA
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([patientAuthority])
      .rpc();

    await program.removeEventListener(sub);

    const grantAcc = await program.account.grant.fetch(grantWritePda);
    expect(grantAcc.patient.toBase58()).to.eq(patientPda.toBase58());                    // patient = Patient PDA
    expect(grantAcc.grantee.toBase58()).to.eq(hospitalAuthority.publicKey.toBase58());   // grantee = wallet
    expect(grantAcc.scope).to.eq(scope);
    expect(grantAcc.revoked).to.eq(false);

    if (ev) {
      expect(ev.grant.toBase58()).to.eq(grantWritePda.toBase58());
      expect(ev.patient.toBase58()).to.eq(patientPda.toBase58());
      expect(ev.grantee.toBase58()).to.eq(hospitalAuthority.publicKey.toBase58());
      expect(ev.scope).to.eq(scope);
    }
  });

it('HAPPY: create_record (uses WRITE grant)', async () => {
  // 1) read current seq (expected 0 on first insert)
  const seqAcc = await program.account.patientSeq.fetch(patientSeqPda);
  const seq = seqAcc.value.toNumber();

  // 2) derive record PDA with the SAME seq
  recordPda = deriveRecordPda(seq);

  const cidEnc = 'bafybeigdyr-test-enc';
  const metaMime = 'application/json';
  const metaCid = 'bafybeigdyr-meta';
  const sizeBytes = new BN(123456);
  const blake2b = Buffer.alloc(32, 9);
  const edekRoot = Buffer.from('deadbeef', 'hex');
  const edekForPatient = Buffer.from('c0ffeec0ffee', 'hex');
  const edekForHospital = Buffer.from('abbaabba', 'hex');

  // enums MUST be lower-camel variant objects
  const edekRootAlgo     = { kms: {} };
  const edekPatientAlgo  = { sealedBox: {} };
  const edekHospitalAlgo = { sealedBox: {} };
  const encAlgo          = { xChaCha20: {} };
  const kmsRef = 'vault://hsm/patient-file-key';
  const note = 'visit 2025-10-08';
  const encVersion = 1;

  let ev: any | null = null;
  const sub = await program.addEventListener('RecordCreated', (e: any) => (ev = e));

  await program.methods
    .createRecord(
      new BN(seq),            // <-- pass CURRENT counter value
      cidEnc,
      metaMime,
      metaCid,
      sizeBytes,
      Array.from(blake2b),
      edekRoot,
      edekForPatient,
      edekForHospital,
      edekRootAlgo,
      edekPatientAlgo,
      edekHospitalAlgo,
      kmsRef,
      note,
      encVersion,
      encAlgo
    )
    .accounts({
      uploader: hospitalAuthority.publicKey,
      config: configPda,
      patient: patientPda,
      patientSeq: patientSeqPda,
      hospital: hospitalPda,
      grantWrite: grantWritePda,
      record: recordPda,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([hospitalAuthority])
    .rpc();

  const rec = await program.account.record.fetch(recordPda);
  expect(rec.seq.toNumber()).to.eq(seq);

  // Optional: verify the counter incremented on-chain
  const seqAfter = await program.account.patientSeq.fetch(patientSeqPda);
  expect(seqAfter.value.toNumber()).to.eq(seq + 1);

  await program.removeEventListener(sub);
  if (ev) {
    expect(ev.seq.toNumber()).to.eq(seq);
  }
});


  // === UNHAPPY: grant_access ===
  it('UNHAPPY: grant_access by unauthorized authority → UnauthorizedGrant', async () => {
    try {
      const badGrant = deriveGrantPda(SCOPE_READ);
      await program.methods
        .grantAccess(SCOPE_READ, null)
        .accounts({
          authority: rando.publicKey, // not the patient owner
          config: configPda,
          patient: patientPda,
          grant: badGrant,
          grantee: hospitalAuthority.publicKey, // SystemAccount wallet
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([rando])
        .rpc();
      expect.fail('Expected UnauthorizedGrant');
    } catch (e: any) {
      expect(e.error?.errorCode?.code ?? `${e}`).to.include('UnauthorizedGrant');
    }
  });

  it('UNHAPPY: grant_access invalid scope bits → InvalidScope', async () => {
    const badScope = ALLOWED | (1 << 6);
    try {
      const badGrant = deriveGrantPda(badScope);
      await program.methods
        .grantAccess(badScope, null)
        .accounts({
          authority: patientAuthority.publicKey,
          config: configPda,
          patient: patientPda,
          grant: badGrant,
          grantee: hospitalAuthority.publicKey, // SystemAccount wallet
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([patientAuthority])
        .rpc();
      expect.fail('Expected InvalidScope');
    } catch (e: any) {
      expect(e.error?.errorCode?.code ?? `${e}`).to.include('InvalidScope');
    }
  });

  it('UNHAPPY: grant_access with past expiry → BadExpiry', async () => {
    const t0 = await nowUnix();
    const past = t0.sub(new BN(30));
    try {
      const g = deriveGrantPda(SCOPE_READ);
      await program.methods
        .grantAccess(SCOPE_READ, past)
        .accounts({
          authority: patientAuthority.publicKey,
          config: configPda,
          patient: patientPda,
          grant: g,
          grantee: hospitalAuthority.publicKey, // SystemAccount wallet
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([patientAuthority])
        .rpc();
      expect.fail('Expected BadExpiry');
    } catch (e: any) {
      expect(e.error?.errorCode?.code ?? `${e}`).to.include('BadExpiry');
    }
  });

  // === revoke_grant happy + unhappy ===
  it('HAPPY: revoke_grant by patient', async () => {
    const scope = SCOPE_READ;
    const g = deriveGrantPda(scope);
    const t1 = await nowUnix();
    const exp = t1.add(new BN(600));

    await program.methods
      .grantAccess(scope, exp)
      .accounts({
        authority: patientAuthority.publicKey,
        config: configPda,
        patient: patientPda,
        grant: g,
        grantee: hospitalAuthority.publicKey, // SystemAccount wallet
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([patientAuthority])
      .rpc();

    let ev: any | null = null;
    const sub = await program.addEventListener('GrantRevoked', (e: any) => (ev = e));

    await program.methods
      .revokeGrant()
      .accounts({
        patient: patientPda,                       // Patient PDA
        grant: g,                                  // [grant, patientPda, hospitalAuthority, [scope]]
        grantee: hospitalAuthority.publicKey,      // SystemAccount wallet
        authority: patientAuthority.publicKey,
      })
      .signers([patientAuthority])
      .rpc();

    await program.removeEventListener(sub);

    const ga = await program.account.grant.fetch(g);
    expect(ga.revoked).to.eq(true);
    expect(ga.revokedAt?.toNumber() ?? 0).to.be.greaterThan(0);

    if (ev) {
      expect(ev.grant.toBase58()).to.eq(g.toBase58());
      expect(ev.patient.toBase58()).to.eq(patientPda.toBase58());
      expect(ev.grantee.toBase58()).to.eq(hospitalAuthority.publicKey.toBase58());
      expect(ev.scope).to.eq(scope);
    }
  });

  it('UNHAPPY: revoke_grant twice → AlreadyRevoked', async () => {
    const scope = SCOPE_READ;
    const g = deriveGrantPda(scope);
    try {
      await program.methods
        .revokeGrant()
        .accounts({
          patient: patientPda,
          grant: g,
          grantee: hospitalAuthority.publicKey,
          authority: patientAuthority.publicKey,
        })
        .signers([patientAuthority])
        .rpc();
      expect.fail('Expected AlreadyRevoked');
    } catch (e: any) {
      expect(e.error?.errorCode?.code ?? `${e}`).to.include('AlreadyRevoked');
    }
  });

  it('UNHAPPY: revoke_grant by wrong authority → UnauthorizedRevoke', async () => {
    const scope = SCOPE_ADMIN;
    const g = deriveGrantPda(scope);
    const t1 = await nowUnix();
    const exp = t1.add(new BN(600));

    await program.methods
      .grantAccess(scope, exp)
      .accounts({
        authority: patientAuthority.publicKey,
        config: configPda,
        patient: patientPda,
        grant: g,
        grantee: hospitalAuthority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([patientAuthority])
      .rpc();

    try {
      await program.methods
        .revokeGrant()
        .accounts({
          patient: patientPda,
          grant: g,
          grantee: hospitalAuthority.publicKey,
          authority: rando.publicKey, // wrong signer
        })
        .signers([rando])
        .rpc();
      expect.fail('Expected UnauthorizedRevoke');
    } catch (e: any) {
      expect(e.error?.errorCode?.code ?? `${e}`).to.include('UnauthorizedRevoke');
    }
  });
});
