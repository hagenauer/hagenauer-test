const COOKIE_NAME = "hagenauer_database_session";
const SESSION_SECONDS = 8 * 60 * 60;
const textEncoder = new TextEncoder();

export default async function passwordProtection(request, context) {
  const url = new URL(request.url);
  const configuredPassword = Netlify.env.get("PROTECTED_PAGE_PASSWORD");

  // Fail closed: the website must never become public because
  // of a missing password configuration.
  if (!configuredPassword) {
    return configurationErrorPage();
  }

  // Logout URL: https://your-website.netlify.app/logout
  if (url.pathname === "/logout") {
    context.cookies.delete({
      name: COOKIE_NAME,
      path: "/",
    });

    return Response.redirect(new URL("/", url), 303);
  }

  const expectedSessionToken = await createSessionToken(
    configuredPassword,
    context.site?.id || url.hostname,
  );

  const currentSessionToken = context.cookies.get(COOKIE_NAME) || "";

  // Valid session: allow the requested webpage or Netlify function to load.
  if (constantTimeEqual(currentSessionToken, expectedSessionToken)) {
    const response = await context.next();
    const headers = new Headers(response.headers);

    // Prevent protected pages and API results from being cached.
    headers.set("Cache-Control", "private, no-store, max-age=0");
    headers.set("Pragma", "no-cache");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "same-origin");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  // Check the submitted password.
  if (request.method === "POST") {
    const formData = await request.formData();
    const submittedPassword = String(formData.get("password") || "");

    const submittedHash = await sha256(submittedPassword);
    const configuredHash = await sha256(configuredPassword);

    if (constantTimeEqual(submittedHash, configuredHash)) {
      context.cookies.set({
        name: COOKIE_NAME,
        value: expectedSessionToken,
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "Strict",
        maxAge: SESSION_SECONDS,
      });

      return Response.redirect(url, 303);
    }

    return loginPage(url, true, 401);
  }

  // No valid session: show password page.
  return loginPage(url, false, 401);
}

// Protect every page and every Netlify function.
export const config = {
  path: "/*",
};

async function createSessionToken(password, siteIdentity) {
  return sha256(`${password}:${siteIdentity}:hagenauer-password-gate-v1`);
}

async function sha256(value) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    textEncoder.encode(String(value)),
  );

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

function constantTimeEqual(left, right) {
  const a = String(left);
  const b = String(right);
  const maximumLength = Math.max(a.length, b.length);
  let difference = a.length ^ b.length;

  for (let index = 0; index < maximumLength; index += 1) {
    difference |=
      (a.charCodeAt(index) || 0) ^
      (b.charCodeAt(index) || 0);
  }

  return difference === 0;
}

function loginPage(url, hasError, status) {
  const action = escapeHtml(`${url.pathname}${url.search}`);

  const errorMarkup = hasError
    ? `
      <div class="message message-error" role="alert">
        <span aria-hidden="true">!</span>
        Das eingegebene Passwort ist nicht korrekt.
      </div>
    `
    : "";

  return htmlResponse(
    `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow, noarchive" />

  <title>Geschützter Zugang | Hagenauer Datenbank</title>

  <style>
    :root {
      color-scheme: light;

      --brand: #2563eb;
      --brand-dark: #1d4ed8;
      --ink: #0f172a;
      --muted: #64748b;
      --line: #dbe3ef;
      --danger: #b91c1c;
      --danger-bg: #fef2f2;
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      min-height: 100%;
    }

    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;

      font-family:
        Inter,
        ui-sans-serif,
        system-ui,
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;

      color: var(--ink);

      background:
        radial-gradient(
          circle at 15% 10%,
          rgba(37, 99, 235, 0.22),
          transparent 32%
        ),
        radial-gradient(
          circle at 90% 90%,
          rgba(29, 78, 216, 0.18),
          transparent 35%
        ),
        linear-gradient(
          145deg,
          #eef4ff 0%,
          #f8fafc 48%,
          #e9eff9 100%
        );
    }

    .login-shell {
      width: min(100%, 440px);
    }

    .login-card {
      overflow: hidden;

      border: 1px solid rgba(255, 255, 255, 0.8);
      border-radius: 24px;

      background: rgba(255, 255, 255, 0.94);

      box-shadow:
        0 28px 80px rgba(15, 23, 42, 0.18);

      backdrop-filter: blur(18px);
    }

    .login-accent {
      height: 6px;

      background:
        linear-gradient(
          90deg,
          var(--brand),
          #60a5fa,
          var(--brand-dark)
        );
    }

    .login-content {
      padding: 34px 34px 30px;
    }

    .brand-row {
      display: flex;
      align-items: center;
      gap: 13px;
      margin-bottom: 28px;
    }

    .brand-mark {
      width: 48px;
      height: 48px;

      display: grid;
      place-items: center;

      flex: 0 0 48px;

      border-radius: 15px;

      color: white;

      background:
        linear-gradient(
          145deg,
          var(--brand),
          var(--brand-dark)
        );

      box-shadow:
        0 12px 28px rgba(37, 99, 235, 0.28);
    }

    .brand-mark svg {
      width: 25px;
      height: 25px;
    }

    .brand-name {
      margin: 0;

      font-size: 15px;
      font-weight: 800;
      letter-spacing: 0.01em;
    }

    .brand-subtitle {
      margin: 3px 0 0;

      color: var(--muted);

      font-size: 12px;
      font-weight: 600;
    }

    h1 {
      margin: 0;

      font-size: clamp(25px, 6vw, 32px);
      line-height: 1.15;
      letter-spacing: -0.025em;
    }

    .intro {
      margin: 12px 0 25px;

      color: var(--muted);

      font-size: 14px;
      line-height: 1.65;
    }

    .field-label {
      display: block;
      margin-bottom: 8px;

      font-size: 13px;
      font-weight: 800;
    }

    .password-wrap {
      position: relative;
    }

    .password-input {
      width: 100%;
      height: 52px;

      padding: 0 52px 0 15px;

      border: 1px solid var(--line);
      border-radius: 13px;

      outline: none;

      background: #ffffff;
      color: var(--ink);

      font: inherit;

      transition:
        border-color 0.2s ease,
        box-shadow 0.2s ease;
    }

    .password-input:focus {
      border-color: var(--brand);

      box-shadow:
        0 0 0 4px rgba(37, 99, 235, 0.13);
    }

    .password-toggle {
      position: absolute;
      top: 50%;
      right: 8px;

      width: 38px;
      height: 38px;

      display: grid;
      place-items: center;

      transform: translateY(-50%);

      border: 0;
      border-radius: 9px;

      background: transparent;
      color: var(--muted);

      cursor: pointer;
    }

    .password-toggle:hover,
    .password-toggle:focus-visible {
      color: var(--brand-dark);
      background: #eff6ff;
      outline: none;
    }

    .message {
      display: flex;
      align-items: center;
      gap: 9px;

      margin: 0 0 15px;
      padding: 11px 12px;

      border-radius: 11px;

      font-size: 13px;
      font-weight: 700;
    }

    .message span {
      width: 21px;
      height: 21px;

      display: grid;
      place-items: center;

      flex: 0 0 21px;

      border-radius: 50%;

      color: #ffffff;
      background: var(--danger);
    }

    .message-error {
      border: 1px solid #fecaca;

      color: var(--danger);
      background: var(--danger-bg);
    }

    .submit-button {
      width: 100%;
      min-height: 52px;

      margin-top: 17px;

      border: 0;
      border-radius: 13px;

      color: #ffffff;

      background:
        linear-gradient(
          135deg,
          var(--brand),
          var(--brand-dark)
        );

      box-shadow:
        0 12px 24px rgba(37, 99, 235, 0.24);

      font: inherit;
      font-weight: 800;

      cursor: pointer;

      transition:
        transform 0.15s ease,
        box-shadow 0.2s ease;
    }

    .submit-button:hover {
      transform: translateY(-1px);

      box-shadow:
        0 16px 30px rgba(37, 99, 235, 0.32);
    }

    .submit-button:active {
      transform: translateY(0);
    }

    .security-note {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 7px;

      margin: 19px 0 0;

      color: var(--muted);

      font-size: 11px;
      text-align: center;
    }

    .security-note svg {
      width: 14px;
      height: 14px;
    }

    .footer-note {
      margin: 17px 0 0;

      color: #64748b;

      font-size: 11px;
      line-height: 1.5;
      text-align: center;
    }

    @media (max-width: 480px) {
      body {
        padding: 15px;
      }

      .login-content {
        padding: 27px 22px 24px;
      }
    }
  </style>
</head>

<body>
  <main class="login-shell">
    <section class="login-card" aria-labelledby="login-title">

      <div class="login-accent" aria-hidden="true"></div>

      <div class="login-content">

        <div class="brand-row">

          <div class="brand-mark" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect
                x="5"
                y="11"
                width="14"
                height="10"
                rx="2"
              ></rect>

              <path
                d="M8 11V7a4 4 0 0 1 8 0v4"
              ></path>
            </svg>
          </div>

          <div>
            <p class="brand-name">
              Hagenauer GmbH &amp; Co. KG
            </p>

            <p class="brand-subtitle">
              Interne Artikel-Datenbank
            </p>
          </div>

        </div>

        <h1 id="login-title">
          Geschützter Zugang
        </h1>

        <p class="intro">
          Bitte geben Sie das gemeinsame Passwort ein,
          um die Datenbank zu öffnen.
          Ein Benutzername ist nicht erforderlich.
        </p>

        ${errorMarkup}

        <form
          method="POST"
          action="${action}"
          autocomplete="off"
        >

          <label
            class="field-label"
            for="password"
          >
            Passwort
          </label>

          <div class="password-wrap">

            <input
              class="password-input"
              id="password"
              name="password"
              type="password"
              autocomplete="current-password"
              required
              autofocus
              aria-invalid="${hasError ? "true" : "false"}"
            />

            <button
              class="password-toggle"
              id="passwordToggle"
              type="button"
              aria-label="Passwort anzeigen"
              title="Passwort anzeigen"
            >
              <svg
                id="eyeIcon"
                viewBox="0 0 24 24"
                width="19"
                height="19"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path
                  d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"
                ></path>

                <circle
                  cx="12"
                  cy="12"
                  r="3"
                ></circle>
              </svg>
            </button>

          </div>

          <button
            class="submit-button"
            type="submit"
          >
            Datenbank öffnen
          </button>

        </form>

        <p class="security-note">

          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path
              d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"
            ></path>

            <path
              d="m9 12 2 2 4-4"
            ></path>
          </svg>

          Geschützte Sitzung · automatische Abmeldung nach 8 Stunden
        </p>

      </div>
    </section>

    <p class="footer-note">
      Nur für autorisierte Mitarbeiterinnen und Mitarbeiter.
    </p>
  </main>

  <script>
    const passwordInput =
      document.getElementById("password");

    const passwordToggle =
      document.getElementById("passwordToggle");

    passwordToggle.addEventListener("click", function () {
      const shouldShow =
        passwordInput.type === "password";

      passwordInput.type =
        shouldShow ? "text" : "password";

      passwordToggle.setAttribute(
        "aria-label",
        shouldShow
          ? "Passwort ausblenden"
          : "Passwort anzeigen",
      );

      passwordToggle.setAttribute(
        "title",
        shouldShow
          ? "Passwort ausblenden"
          : "Passwort anzeigen",
      );

      passwordInput.focus();
    });
  </script>
</body>
</html>`,
    status,
  );
}

function configurationErrorPage() {
  return htmlResponse(
    `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  />

  <meta
    name="robots"
    content="noindex, nofollow"
  />

  <title>Zugang noch nicht konfiguriert</title>

  <style>
    * {
      box-sizing: border-box;
    }

    body {
      min-height: 100vh;
      margin: 0;

      display: grid;
      place-items: center;

      padding: 24px;

      font-family:
        Inter,
        system-ui,
        sans-serif;

      color: #0f172a;
      background: #f8fafc;
    }

    main {
      width: min(100%, 620px);

      padding: 28px;

      border: 1px solid #fecaca;
      border-radius: 18px;

      background: #ffffff;

      box-shadow:
        0 18px 45px rgba(15, 23, 42, 0.12);
    }

    h1 {
      margin-top: 0;
      font-size: 24px;
    }

    p {
      color: #475569;
      line-height: 1.65;
    }

    code {
      padding: 3px 6px;

      border-radius: 6px;

      color: #991b1b;
      background: #fef2f2;
    }
  </style>
</head>

<body>
  <main>
    <h1>Zugang noch nicht konfiguriert</h1>

    <p>
      Der Webseitenzugang ist aus Sicherheitsgründen gesperrt.
      Der Seiteninhaber muss zuerst die
      Netlify-Umgebungsvariable
      <code>PROTECTED_PAGE_PASSWORD</code>
      einrichten und die Seite neu deployen.
    </p>
  </main>
</body>
</html>`,
    503,
  );
}

function htmlResponse(html, status = 200) {
  return new Response(html, {
    status,

    headers: {
      "Content-Type": "text/html; charset=utf-8",

      "Cache-Control":
        "private, no-store, max-age=0",

      "Content-Security-Policy": [
        "default-src 'none'",
        "style-src 'unsafe-inline'",
        "script-src 'unsafe-inline'",
        "form-action 'self'",
        "base-uri 'none'",
        "frame-ancestors 'none'",
      ].join("; "),

      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}