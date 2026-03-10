import { createServer } from "node:http";

const port = Number.parseInt(process.env.PORT || "3000", 10);
const hydraAdminUrl = (process.env.HYDRA_ADMIN_URL || "http://hydra:4445").replace(/\/$/, "");
const kratosPublicUrl = (process.env.KRATOS_PUBLIC_URL || "http://kratos:4433").replace(
  /\/$/,
  ""
);
const loginConsentPublicUrl = (
  process.env.ORY_LOGIN_CONSENT_PUBLIC_URL || `http://localhost:${port}`
).replace(/\/$/, "");
const kratosBrowserLoginUrl =
  process.env.ORY_KRATOS_BROWSER_LOGIN_URL ||
  "http://localhost:4433/self-service/login/browser";
const rememberFor = Number.parseInt(process.env.HYDRA_REMEMBER_FOR || "3600", 10);

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(payload));
}

function redirect(res, location) {
  res.writeHead(302, { location });
  res.end();
}

async function parseJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function hydraRequest(path, init = {}) {
  const response = await fetch(`${hydraAdminUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });

  const body = await parseJson(response);

  if (!response.ok) {
    const message = body?.error_description || body?.error || response.statusText;
    const error = new Error(`Hydra API error (${response.status}): ${message}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }

  return body;
}

async function getKratosSession(cookieHeader) {
  if (!cookieHeader || cookieHeader.trim().length === 0) return null;

  const response = await fetch(`${kratosPublicUrl}/sessions/whoami`, {
    method: "GET",
    headers: {
      accept: "application/json",
      cookie: cookieHeader,
    },
  });

  if (!response.ok) return null;
  return parseJson(response);
}

function getNameClaims(traits) {
  const firstName = typeof traits?.name?.first === "string" ? traits.name.first.trim() : "";
  const lastName = typeof traits?.name?.last === "string" ? traits.name.last.trim() : "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  return { firstName, lastName, fullName };
}

function buildIdTokenClaims(traits) {
  const email = typeof traits?.email === "string" ? traits.email.trim().toLowerCase() : "";
  const { firstName, lastName, fullName } = getNameClaims(traits);

  const claims = {};
  if (email) {
    claims.email = email;
    claims.preferred_username = email.split("@")[0] || email;
  }
  if (firstName) claims.given_name = firstName;
  if (lastName) claims.family_name = lastName;
  if (fullName) claims.name = fullName;

  return claims;
}

async function handleLogin(req, res, url) {
  const challenge = url.searchParams.get("login_challenge");
  if (!challenge) {
    return sendJson(res, 400, { error: "missing login_challenge" });
  }

  const loginRequest = await hydraRequest(
    `/admin/oauth2/auth/requests/login?login_challenge=${encodeURIComponent(challenge)}`,
    { method: "GET" }
  );

  if (loginRequest?.skip && loginRequest?.subject) {
    const accepted = await hydraRequest(
      `/admin/oauth2/auth/requests/login/accept?login_challenge=${encodeURIComponent(challenge)}`,
      {
        method: "PUT",
        body: JSON.stringify({
          subject: loginRequest.subject,
          remember: true,
          remember_for: rememberFor,
        }),
      }
    );
    return redirect(res, accepted.redirect_to);
  }

  const session = await getKratosSession(req.headers.cookie);
  const identityId = session?.identity?.id;

  if (!identityId) {
    const returnTo = new URL(`${loginConsentPublicUrl}/login`);
    returnTo.searchParams.set("login_challenge", challenge);

    const kratosLoginUrl = new URL(kratosBrowserLoginUrl);
    kratosLoginUrl.searchParams.set("return_to", returnTo.toString());

    return redirect(res, kratosLoginUrl.toString());
  }

  const accepted = await hydraRequest(
    `/admin/oauth2/auth/requests/login/accept?login_challenge=${encodeURIComponent(challenge)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        subject: identityId,
        remember: true,
        remember_for: rememberFor,
        context: {
          traits: session.identity?.traits || {},
        },
      }),
    }
  );

  return redirect(res, accepted.redirect_to);
}

async function handleConsent(req, res, url) {
  const challenge = url.searchParams.get("consent_challenge");
  if (!challenge) {
    return sendJson(res, 400, { error: "missing consent_challenge" });
  }

  const consentRequest = await hydraRequest(
    `/admin/oauth2/auth/requests/consent?consent_challenge=${encodeURIComponent(challenge)}`,
    { method: "GET" }
  );

  const session = await getKratosSession(req.headers.cookie);
  const traits = session?.identity?.traits || consentRequest?.context?.traits || {};

  const accepted = await hydraRequest(
    `/admin/oauth2/auth/requests/consent/accept?consent_challenge=${encodeURIComponent(challenge)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        grant_scope: consentRequest.requested_scope || [],
        grant_access_token_audience:
          consentRequest.requested_access_token_audience || [],
        remember: true,
        remember_for: rememberFor,
        session: {
          id_token: buildIdTokenClaims(traits),
          access_token: {
            sub: session?.identity?.id || consentRequest.subject,
          },
        },
      }),
    }
  );

  return redirect(res, accepted.redirect_to);
}

async function handleLogout(_req, res, url) {
  const challenge = url.searchParams.get("logout_challenge");
  if (!challenge) {
    return sendJson(res, 400, { error: "missing logout_challenge" });
  }

  const accepted = await hydraRequest(
    `/admin/oauth2/auth/requests/logout/accept?logout_challenge=${encodeURIComponent(challenge)}`,
    { method: "PUT", body: JSON.stringify({}) }
  );

  return redirect(res, accepted.redirect_to);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `${loginConsentPublicUrl}`);

    if (req.method === "GET" && url.pathname === "/healthz") {
      return sendJson(res, 200, { status: "ok" });
    }

    if (req.method === "GET" && url.pathname === "/login") {
      return await handleLogin(req, res, url);
    }

    if (req.method === "GET" && url.pathname === "/consent") {
      return await handleConsent(req, res, url);
    }

    if (req.method === "GET" && url.pathname === "/logout") {
      return await handleLogout(req, res, url);
    }

    if (req.method === "GET" && (url.pathname === "/device/verify" || url.pathname === "/device/success")) {
      return sendJson(res, 200, { status: "not_implemented_for_dev" });
    }

    if (req.method === "GET" && url.pathname === "/") {
      return sendJson(res, 200, { service: "ory-login-consent", status: "ok" });
    }

    return sendJson(res, 404, { error: "not_found" });
  } catch (error) {
    console.error("ory-login-consent error", error);
    return sendJson(res, 500, {
      error: "internal_error",
      message: error instanceof Error ? error.message : "unknown error",
    });
  }
});

server.listen(port, () => {
  console.log(`ory-login-consent listening on :${port}`);
});
