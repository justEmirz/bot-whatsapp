import fs from "fs";

const file = "./lib/session-store.json";

function load() {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, "{}");
  }

  return JSON.parse(fs.readFileSync(file));
}

function save(data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

export function getSession(user) {
  const db = load();
  return db[user] || null;
}

export function setSession(user, sessionId) {
  const db = load();
  db[user] = sessionId;
  save(db);
}
