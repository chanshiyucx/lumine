use clap::{Parser, Subcommand};

#[derive(Debug, Parser)]
#[command(name = "lumine-pipeline", version, about = "Local photo asset builder")]
pub struct Cli {
    #[command(subcommand)]
    pub command: Commands,
}

#[derive(Debug, Subcommand)]
pub enum Commands {
    Build,
}
