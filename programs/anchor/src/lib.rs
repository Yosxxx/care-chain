use anchor_lang::prelude::*;

declare_id!("6bPVQ5vhpHNUgCWR7Fgc6F5Uf4JgNS2GUsq6nsUTcWuv");

pub mod instructions;
pub mod states;
pub mod error;

use instructions::create_record;

#[program]
pub mod anchor {
    use super::*;

    // Add Record
    pub fn add_record(ctx: Context<create_record::AddMedicalRecordAccounts>, cid: String) -> Result<()> {
        create_record::handle(ctx, cid)
    }
}
