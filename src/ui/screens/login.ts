// Sign-in screen, same choices as the iDos host template: a Solana wallet first (signature, free,
// no transaction), then the iDos Games account, e-mail, Telegram inside a Mini App, and a guest
// profile last. Opens on the first launch, when a remembered session ends, from the profile
// ("Сменить аккаунт"), and once a day as an invitation for guests.

import { embeddedInPlatform, isMobileBrowser, ssoAvailable, telegramAvailable, walletAppLinks } from "../../platform/account";
import type { App, Screen } from "../app";
import { button, shanyrakEmblem } from "../components/common";
import { h } from "../dom";

type Mode = "menu" | "wallets" | "email" | "verify" | "forgot" | "reset";

export function loginScreen(app: App, params: Record<string, unknown>): Screen {
  const upgrade = params.upgrade === true || app.store.session.account?.kind === "guest";
  const el = h("div.login-screen.scroll");
  let mode: Mode = "menu";
  let busy = false;
  let error: string | null = null;
  let notice: string | null = typeof params.notice === "string" ? params.notice : null;
  let remember = true;
  let registering = false;
  let email = "";
  let password = "";
  let code = "";
  let resendIn = 0;
  let embedded = false;
  let alive = true;
  let timer: ReturnType<typeof setInterval> | null = null;
  let first = true;

  void embeddedInPlatform().then((v) => {
    embedded = v;
    if (alive) render();
  });

  const done = () => app.account.proceed();
  const act = async (fn: () => Promise<{ ok: boolean; error?: string } | "redirecting">) => {
    if (busy) return;
    busy = true;
    error = null;
    render();
    const r = await fn();
    if (!alive) return;
    busy = false;
    if (r === "redirecting") {
      notice = "Переходим на idosgames.com…";
      busy = true;
    } else if (r.ok) {
      done();
      return;
    } else error = r.error ?? "Вход не удался.";
    render();
  };

  const input = (type: string, placeholder: string, value: string, set: (v: string) => void, extra: Record<string, unknown> = {}) =>
    h("input.text-input", { type, placeholder, value, disabled: busy, oninput: (e: Event) => set((e.target as HTMLInputElement).value), ...extra });

  const startResendTimer = (s: number) => {
    resendIn = s;
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      resendIn = Math.max(0, resendIn - 1);
      const b = el.querySelector<HTMLButtonElement>(".resend-btn");
      if (b) {
        b.textContent = resendIn > 0 ? `Отправить ещё раз через ${resendIn} с` : "Отправить код ещё раз";
        b.disabled = busy || resendIn > 0;
      }
      if (resendIn <= 0 && timer) clearInterval(timer);
    }, 1000);
  };

  function walletBlock(): Node[] {
    const label = embedded ? "◎ Войти кошельком idosgames.com" : "◎ Войти кошельком Solana";
    const options = app.wallet.options();
    const primary = button(label, () => {
      if (embedded) return void act(() => app.account.wallet(null, remember));
      if (options.length === 1) return void act(() => app.account.wallet(options[0].id, remember));
      mode = "wallets";
      render();
    }, { kind: "gold", big: true, disabled: busy, cls: "login-main" });
    return [primary, h("small.login-sub", null, "Бесплатно: кошелёк только подписывает вход, без транзакций и комиссий.")];
  }

  function walletsView(): Node[] {
    const options = app.wallet.options();
    const out: Node[] = [];
    if (options.length) {
      out.push(
        h("p.login-hint", null, "Выберите кошелёк. Он попросит подписать сообщение — это бесплатно."),
        h(
          "div.wallet-options",
          null,
          options.map((o) =>
            h(
              "button.wallet-option",
              { type: "button", disabled: busy, onclick: () => void act(() => app.account.wallet(o.id, remember)) },
              o.icon ? h("img.wo-img", { src: o.icon, alt: "", width: "28", height: "28" }) : h("span.wo-icon", null, "◎"),
              h("span", null, h("b", null, o.name), h("small", null, busy ? "Ждём подпись…" : "Подключить и войти")),
            ),
          ),
        ),
      );
    } else if (isMobileBrowser()) {
      out.push(
        h("p.login-hint", null, "В мобильном браузере кошелька нет. Откройте игру в приложении кошелька — там вход сработает:"),
        h(
          "div.wallet-options",
          null,
          walletAppLinks().map((l) => h("a.wallet-option", { href: l.href, rel: "noopener" }, h("span.wo-icon", null, "◎"), h("span", null, h("b", null, `Открыть в ${l.name}`), h("small", null, "Игра откроется во встроенном браузере")))),
        ),
      );
    } else {
      out.push(
        h(
          "p.login-hint",
          null,
          "Кошелёк не найден. Установите ",
          h("a.link", { href: "https://phantom.app/download", target: "_blank", rel: "noopener" }, "Phantom"),
          ", ",
          h("a.link", { href: "https://solflare.com/download", target: "_blank", rel: "noopener" }, "Solflare"),
          " или ",
          h("a.link", { href: "https://backpack.app/downloads", target: "_blank", rel: "noopener" }, "Backpack"),
          " и обновите страницу.",
        ),
      );
    }
    out.push(button("← Другие способы", () => { mode = "menu"; error = null; render(); }, { kind: "ghost", disabled: busy }));
    return out;
  }

  function menuView(): Node[] {
    const out: Node[] = [...walletBlock()];
    if (ssoAvailable()) out.push(button("Войти через iDos Games", () => void act(() => app.account.idos(remember)), { kind: "primary", disabled: busy }));
    out.push(button("✉ Войти по почте", () => { mode = "email"; error = null; render(); }, { kind: "soft", disabled: busy }));
    if (telegramAvailable()) out.push(button("Войти через Telegram", () => void act(() => app.account.telegram(remember)), { kind: "soft", disabled: busy }));
    out.push(
      h("div.login-or", null, h("span", null, "или")),
      button(upgrade ? "Остаться гостем" : "Играть гостем", () => void act(() => app.account.guest(remember)), { kind: "ghost", disabled: busy }),
      h("small.login-sub", null, upgrade ? "Гостевой профиль привязан к этому устройству." : "Гость играет сразу, но рекорды привязаны только к этому устройству."),
    );
    return out;
  }

  function emailView(): (Node | string)[] {
    return [
      input("email", "Почта", email, (v) => (email = v), { autocomplete: "email", autofocus: true }),
      input("password", "Пароль (8–100 символов)", password, (v) => (password = v), { autocomplete: registering ? "new-password" : "current-password" }),
      button(registering ? "Создать аккаунт" : "Войти", () => {
        if (!email || !password) return;
        if (!registering) return void act(() => app.account.email(email, password, remember));
        void (async () => {
          busy = true;
          error = null;
          render();
          const r = await app.account.register(email, password, remember);
          busy = false;
          if (!alive) return;
          if (r.ok) {
            code = "";
            mode = "verify";
            startResendTimer(r.resendIn);
          } else error = r.error;
          render();
        })();
      }, { kind: "gold", disabled: busy }),
      button(registering ? "У меня уже есть аккаунт" : "Создать аккаунт", () => { registering = !registering; error = null; render(); }, { kind: "ghost", disabled: busy }),
      registering ? "" : button("Забыли пароль?", () => { mode = "forgot"; error = null; notice = null; render(); }, { kind: "ghost", disabled: busy }),
      button("← Назад", () => { mode = "menu"; error = null; render(); }, { kind: "ghost", disabled: busy }),
    ];
  }

  function verifyView(): Node[] {
    return [
      h("p.login-hint", null, "Мы отправили код на ", h("b", null, email), ". Введите его, чтобы закончить регистрацию."),
      input("text", "Код из письма", code, (v) => (code = v), { inputmode: "numeric", autocomplete: "one-time-code", autofocus: true }),
      button("Подтвердить", () => code && void act(() => app.account.confirm(email, code, remember)), { kind: "gold", disabled: busy }),
      button(resendIn > 0 ? `Отправить ещё раз через ${resendIn} с` : "Отправить код ещё раз", async () => {
        const err = await app.account.resend(email);
        if (err) error = err;
        startResendTimer(60);
        render();
      }, { kind: "ghost", disabled: busy || resendIn > 0, cls: "resend-btn" }),
      button("← Назад", () => { mode = "email"; error = null; render(); }, { kind: "ghost", disabled: busy }),
    ];
  }

  function forgotView(): Node[] {
    return [
      h("p.login-hint", null, "Введите почту — пришлём код, чтобы задать новый пароль."),
      input("email", "Почта", email, (v) => (email = v), { autocomplete: "email", autofocus: true }),
      button("Отправить код", async () => {
        if (!email) return;
        busy = true;
        render();
        const err = await app.account.forgot(email);
        busy = false;
        if (err) error = err;
        else {
          code = "";
          password = "";
          mode = "reset";
        }
        render();
      }, { kind: "gold", disabled: busy }),
      button("← Назад", () => { mode = "email"; error = null; render(); }, { kind: "ghost", disabled: busy }),
    ];
  }

  function resetView(): Node[] {
    return [
      h("p.login-hint", null, "Если у ", h("b", null, email), " есть аккаунт, код уже в пути. Введите его и новый пароль."),
      input("text", "Код из письма", code, (v) => (code = v), { inputmode: "numeric", autocomplete: "one-time-code", autofocus: true }),
      input("password", "Новый пароль", password, (v) => (password = v), { autocomplete: "new-password" }),
      button("Сменить пароль", async () => {
        if (!code || !password) return;
        busy = true;
        render();
        const err = await app.account.reset(email, code, password);
        busy = false;
        if (err) error = err;
        else {
          password = "";
          notice = "Пароль изменён. Войдите с новым паролем.";
          mode = "email";
          registering = false;
        }
        render();
      }, { kind: "gold", disabled: busy }),
      button("← Назад", () => { mode = "forgot"; error = null; render(); }, { kind: "ghost", disabled: busy }),
    ];
  }

  function render(): void {
    el.innerHTML = "";
    queueMicrotask(() => (first = false));
    const title = upgrade ? "Закрепите прогресс за собой" : params.notice ? "Вход в кампус" : "Добро пожаловать в кампус!";
    const lead = upgrade
      ? "Сейчас вы играете как гость. Войдите — и рекорды, место факультета и значки будут под вашим аккаунтом."
      : "Войдите, чтобы рекорды, место факультета и значки были закреплены за вами. Проще всего — кошельком Solana: без пароля, вход подписью.";
    const body: (Node | string)[] =
      mode === "menu" ? menuView() : mode === "wallets" ? walletsView() : mode === "email" ? emailView() : mode === "verify" ? verifyView() : mode === "forgot" ? forgotView() : resetView();
    const remembered = h(
      "label.login-remember",
      null,
      h("input", { type: "checkbox", checked: remember, disabled: busy, onchange: (e: Event) => (remember = (e.target as HTMLInputElement).checked) }),
      h("span", null, "Запомнить меня на этом устройстве"),
    );
    el.append(
      h(
        `div.login-card${first ? ".enter" : ""}`,
        { role: "dialog", "aria-labelledby": "login-title" },
        h("div.login-brand", null, shanyrakEmblem(56), h("div", null, h("b.login-logo", null, "ШАНЫРАК"), h("small", null, "Кампус-Башня"))),
        h("h1#login-title.login-title", null, title),
        mode === "menu" ? h("p.login-lead", null, lead) : null,
        mode === "menu"
          ? h(
              "ul.login-perks",
              null,
              h("li", null, h("span.lp-icon", null, "🏆"), "Рекорды под вашим именем"),
              h("li", null, h("span.lp-icon", null, "🏅"), "Значки-NFT в кошельке"),
              h("li", null, h("span.lp-icon", null, "🔒"), "Без пароля и комиссий"),
            )
          : null,
        h("div.login-actions", null, body),
        notice && !error ? h("p.login-notice", { role: "status" }, notice) : null,
        error ? h("p.login-error", { role: "alert" }, error) : null,
        mode !== "verify" ? remembered : null,
      ),
    );
  }

  render();
  return {
    el,
    backdrop: "tower",
    destroy() {
      alive = false;
      if (timer) clearInterval(timer);
    },
  };
}
