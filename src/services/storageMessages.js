const lastMessages = {};

export function saveLastMessage(from, body) {
  lastMessages[from] = {
    body,
    timestamp: Date.now(),
  };
}

export function getLastMessageFrom(to) {
  return lastMessages[to] || null;
}

export function clearOldMessages() {
  const now = Date.now();
  for (const [key, msg] of Object.entries(lastMessages)) {
    if (now - msg.timestamp > 10 * 60 * 1000) {
      delete lastMessages[key];
    }
  }
}

setInterval(clearOldMessages, 60 * 1000);
