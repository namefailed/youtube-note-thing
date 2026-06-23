// Release builds use the windows subsystem (no console window).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    ytnt_lib::run();
}
