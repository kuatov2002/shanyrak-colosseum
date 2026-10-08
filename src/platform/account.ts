// Sign-in for the iDos Games title, modelled on the host template's login screen (the same SDK
// calls): an SSO code from idosgames.com first, then the remembered session, otherwise the player
// picks a method — a Solana wallet (signature, no transaction), the iDos Games account, e-mail, or
// a guest profile. Wallet login uses @idosgames/wallet, loaded only when the player asks for it.

import type { IDosGamesClient } from "@idosgames/core";

export type AccountKind = "wallet" | "idos" | "email" | "guest" | "telegram";

export interface AccountInfo {
  kind: AccountKind;
  /** Wallet address for wallet accounts. */
  address?: string;
}

export type AuthResult = { ok: true; account: AccountInfo } | { ok: false; error: string };

/** Solana network id in the title's Blockchain.Networks. */
export const NETWORK_ID = "solana";

/** Where idosgames.com agrees to send the one-time sign-in code back (mirrors the server allowlist). */
const SSO_ORIGINS = ["https://cloud.idosgames.com", "https://idosgames.com", "https://www.idosgames.com"];
const GAME_HOST = /^https:\/\/[a-z0-9]{8}(-dev)?\.idos\.games$/;

/** «Войти через iDos Games» only where the platform will actually redirect back. */
export function ssoAvailable(): boolean {
  if (typeof window === "undefined") return false;
  const { origin } = window.location;
  if (SSO_ORIGINS.includes(origin) || GAME_HOST.test(origin)) return true;
  return document.querySelector('meta[name="idos-game-host"]') !== null;
}

/** A sign-in code from idosgames.com is waiting in the address (read and removed by the SDK). */
export function ssoCodePending(): boolean {
  return typeof window !== "undefined" && /(^|[#&])idos_sso=/.test(window.location.hash);
}

/** Inside a Telegram Mini App the app hands over signed initData — the only thing its login needs. */
export function telegramAvailable(): boolean {
  const tg = (globalThis as { Telegram?: { WebApp?: { initData?: string } } }).Telegram;
  return Boolean(tg?.WebApp?.initData);
}

export function kindOf(authType: string): AccountKind | null {
  switch (authType) {
    case "Wallet":
      return "wallet";
    case "iDosGames":
      return "idos";
    case "Email":
      return "email";
    case "Device":
      return "guest";
    case "Telegram":
      return "telegram";
    default:
      return null;
  }
}

/** Server refusal codes → words a player can act on (unknown codes pass through). */
export function explainAuthError(code: string | undefined): string {
  const e = code ?? "";
  if (/reject|denied|cancel|declined/i.test(e)) return "Подпись отклонена в кошельке — ничего не произошло.";
  switch (e) {
    case "NO_WALLET":
      return "Кошелёк не найден. Установите Phantom, Solflare или Backpack и обновите страницу.";
    case "PLATFORM_WALLET_UNAVAILABLE":
      return "Сайт не ответил на запрос подписи. Подключите кошелёк на idosgames.com или откройте игру по прямой ссылке.";
    case "WALLET_USE_SITE_PANEL":
      return "Внутри idosgames.com кошелёк подключается на самом сайте.";
    case "WALLET_LOGIN_DISABLED":
      return "Вход кошельком сейчас недоступен. Попробуйте другой способ.";
    case "EMAIL_SENDER_NOT_CONFIGURED":
      return "Вход по почте сейчас недоступен. Выберите другой способ.";
    case "INVALID_VERIFICATION_CODE":
      return "Код не подошёл. Проверьте письмо и попробуйте ещё раз.";
    case "VERIFICATION_CODE_ATTEMPTS_EXCEEDED":
      return "Слишком много неверных попыток. Запросите новый код.";
    case "INCORRECT_EMAIL_OR_PASSWORD":
      return "Неверная почта или пароль.";
    case "INCORRECT_EMAIL":
      return "Это не похоже на адрес почты.";
    case "PASSWORD_LENGTH_INVALID":
      return "Пароль должен быть от 8 до 100 символов.";
    case "TOO_MANY_FAILED_ATTEMPTS":
    case "RATE_LIMIT_EXCEEDED":
      return "Слишком много попыток. Подождите немного и повторите.";
    case "PLAY_ACCESS_WALLET_USED_BY_ANOTHER_ACCOUNT":
      return "Этот кошелёк уже привязан к другому аккаунту.";
    case "WALLET_UNLINK_COOLDOWN":
      return "Кошелёк недавно отвязали от другого аккаунта. Повторите через 7 дней.";
    case "timeout":
    case "connection":
      return "Нет связи с сервером. Проверьте интернет и повторите.";
    default:
      return e ? `Вход не удался: ${e.slice(0, 120)}` : "Вход не удался. Попробуйте ещё раз.";
  }
}

type WalletPkg = typeof import("@idosgames/wallet");
let walletPkg: Promise<WalletPkg> | null = null;
/** @idosgames/wallet, loaded on first use (it is not needed until the player picks the wallet). */
export function loadWalletPkg(): Promise<WalletPkg> {
  walletPkg ??= import("@idosgames/wallet");
  return walletPkg;
}

/** The game sits inside idosgames.com's frame: there the SITE's wallet signs, never the game. */
export async function embeddedInPlatform(): Promise<boolean> {
  try {
    return (await loadWalletPkg()).isEmbeddedInPlatform();
  } catch {
    return false;
  }
}

/** Wallet sign-in: the server's challenge is signed by the wallet (free, no transaction). */
export async function walletLogin(
  client: IDosGamesClient,
  wallet: { address: string; signMessage: (m: Uint8Array) => Promise<Uint8Array> } | null,
): Promise<AuthResult> {
  try {
    const pkg = await loadWalletPkg();
    const res = pkg.isEmbeddedInPlatform()
      ? await pkg.loginWithWalletViaPlatform({ client, networkID: NETWORK_ID, family: "solana" })
      : wallet
        ? await pkg.loginWithWalletSolana({ client, networkID: NETWORK_ID, walletAddress: wallet.address, signMessage: wallet.signMessage })
        : { ok: false as const, error: "NO_WALLET", stage: "connect" };
    if (!res.ok) return { ok: false, error: explainAuthError(res.error) };
    return { ok: true, account: { kind: "wallet", address: wallet?.address } };
  } catch (err) {
    return { ok: false, error: explainAuthError(err instanceof Error ? err.message : String(err)) };
  }
}

/**
 * Mobile browsers have no wallet extension: these links reopen the game inside the wallet app's own
 * browser, where the wallet is available and the sign-in works.
 */
export function walletAppLinks(): { name: string; href: string }[] {
  const url = encodeURIComponent(window.location.href.split("#")[0]);
  const ref = encodeURIComponent(window.location.origin);
  return [
    { name: "Phantom", href: `https://phantom.app/ul/browse/${url}?ref=${ref}` },
    { name: "Solflare", href: `https://solflare.com/ul/v1/browse/${url}?ref=${ref}` },
  ];
}

export function isMobileBrowser(): boolean {
  return typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
}
