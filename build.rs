use std::process::Command;

fn main() {
    // Assuming you have a script `create_schema.sh` that sets up your database
    Command::new("sh")
        .arg("./create_schema.sh")
        .status()
        .unwrap();
}
