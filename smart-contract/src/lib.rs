#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Env, String};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    HealthStatus,
}

#[contract]
pub struct NetworkHealthContract;

#[contractimpl]
impl NetworkHealthContract {
    /// Initialize or update the overall network health status message.
    pub fn update_status(env: Env, new_status: String) {
        env.storage().instance().set(&DataKey::HealthStatus, &new_status);
    }

    /// Retrieve the current health status message.
    pub fn get_status(env: Env) -> String {
        env.storage()
            .instance()
            .get(&DataKey::HealthStatus)
            .unwrap_or_else(|| String::from_str(&env, "Status Uninitialized"))
    }
}
