// Serviços de push dos navegadores: Chrome/Android/Edge-Chromium/Samsung (FCM), Firefox, Safari/iPhone e Edge (WNS).
// Só endereços exatos; o banco confere a mesma regra (push_subscriptions_endpoint_host).
const EXACT_HOSTS = ["fcm.googleapis.com", "android.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"];
const SUBDOMAIN_OF = "notify.windows.com";

export function isAllowedPushEndpoint(endpoint: string): boolean {
  if (typeof endpoint !== "string" || endpoint.length > 1000) return false;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  return EXACT_HOSTS.includes(host) || host.endsWith(`.${SUBDOMAIN_OF}`);
}
