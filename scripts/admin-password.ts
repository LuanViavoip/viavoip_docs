import { emitKeypressEvents } from "node:readline";
import { readFileSync } from "node:fs";
import { hashAdminPassword } from "../src/features/admin/password";

async function readPassword(): Promise<string> {
  if (!process.stdin.isTTY) return readFileSync(0, "utf8").replace(/\r?\n$/, "");
  process.stderr.write("Senha administrativa (não será exibida): ");
  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  return new Promise(resolve => {
    let password = "";
    process.stdin.on("keypress", (text: string, key: { name?: string; ctrl?: boolean }) => {
      if (key.ctrl && key.name === "c") process.exit(1);
      if (key.name === "return") { process.stdin.setRawMode(false); process.stdin.pause(); process.stderr.write("\n"); resolve(password); }
      else if (key.name === "backspace") password = password.slice(0, -1);
      else if (text && !key.ctrl) password += text;
    });
  });
}
readPassword().then(hashAdminPassword).then(hash => process.stdout.write(`${hash}\n`)).catch(error => { console.error(error.message); process.exitCode = 1; });
