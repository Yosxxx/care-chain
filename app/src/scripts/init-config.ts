import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";

const RPC = process.env.RPC ?? "http://127.0.0.1:8899";     
const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID!);  

const SEED_CONFIG = Buffer.from("config");

async function main() {
  const provider = anchor.AnchorProvider.local(RPC); 
  anchor.setProvider(provider);

  const idl = await anchor.Program.fetchIdl(PROGRAM_ID, provider);
  if (!idl) throw new Error("IDL not found for program");
  const program = new anchor.Program(idl as anchor.Idl, provider);

  const [configPda] = PublicKey.findProgramAddressSync([SEED_CONFIG], PROGRAM_ID);

  console.log("Using authority:", provider.wallet.publicKey.toBase58());
  console.log("Config PDA:", configPda.toBase58());

  // If already exists, just show it and exit
  try {
    const existing = await program.account.config.fetch(configPda);
    console.log("Config already initialized:", existing);
    return;
  } catch (_) {}

  const tx = await program.methods
    .configInit("transit") 
    .accounts({
      config: configPda,
      authority: provider.wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log("Init config tx:", tx);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

// localnet
// export RPC=http://127.0.0.1:8899
// export PROGRAM_ID=2HZmbrh7agvx2M2z7PjY8U97fpXGuVTouVeVJRvDTXnq
// ts-node scripts/init-config.ts

// devnet
// export RPC=https://api.devnet.solana.com
// export PROGRAM_ID=2HZmbrh7agvx2M2z7PjY8U97fpXGuVTouVeVJRvDTXnq
// ts-node scripts/init-config.ts
