mod build;
mod config;

use std::process::ExitCode;

use anyhow::Result;
use libheif_rs::integration::image::register_all_decoding_hooks;

use crate::build::BuildExit;

fn main() -> ExitCode {
    if let Err(error) = init_tracing() {
        eprintln!("failed to initialize tracing: {error}");
        return ExitCode::from(1);
    }

    match run() {
        Ok(BuildExit::Success) => ExitCode::SUCCESS,
        Ok(BuildExit::PartialFailure) => ExitCode::from(2),
        Err(error) => {
            eprintln!("{error:?}");
            ExitCode::from(1)
        }
    }
}

fn run() -> Result<BuildExit> {
    register_all_decoding_hooks();
    build::run()
}

fn init_tracing() -> Result<()> {
    tracing_subscriber::fmt()
        .with_target(false)
        .without_time()
        .try_init()
        .map_err(|error| anyhow::anyhow!(error.to_string()))?;
    Ok(())
}
