export function getAppUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function ticketUrl(token: string): string {
  return `${getAppUrl()}/t/${token}`;
}
