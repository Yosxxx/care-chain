use anchor_lang::prelude::*;

pub mod errors;
pub mod event;
pub mod instructions;
pub mod states;

use instructions::*;
use states::*;

declare_id!("6bPVQ5vhpHNUgCWR7Fgc6F5Uf4JgNS2GUsq6nsUTcWuv");

#[program]
pub mod anchor {
    use anchor_lang::solana_program::config;

    use super::*;

    pub fn init_config(ctx: Context<InitConfig>, kms_namespace: String) -> Result<()> {
        config_init(ctx, kms_namespace)
    }
}
