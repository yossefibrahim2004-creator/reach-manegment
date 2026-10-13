let sessionExpiryHandled = false;

export function expireSessionOnce(expireSession: () => void): void {
  if (sessionExpiryHandled) return;
  sessionExpiryHandled = true;
  expireSession();
}

export function resetSessionExpiryForTests(): void {
  sessionExpiryHandled = false;
}
