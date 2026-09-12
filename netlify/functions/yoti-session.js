import crypto from "crypto";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";

const YOTI_API_URL = "https://api.yoti.com/idv/v1";

// Resolve private key
let YOTI_PEM = process.env.YOTI_PEM_KEY;
if (!YOTI_PEM) {
  try {
    const bancoAtualPath = path.join(process.cwd(), "BancoAtual.md");
    if (fs.existsSync(bancoAtualPath)) {
      const content = fs.readFileSync(bancoAtualPath, "utf8");
      const match = content.match(/-----BEGIN RSA PRIVATE KEY-----[\s\S]+?-----END RSA PRIVATE KEY-----/);
      if (match) {
        YOTI_PEM = match[0];
      }
    }
  } catch (e) {
    console.log("Could not read PEM key from BancoAtual.md:", e.message);
  }
}

if (!YOTI_PEM) {
  // Hardcoded fallback matching BancoAtual.md key
  YOTI_PEM = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEAqh47nLWDdKCN0o9SD+0cuH+HZiX3uXftReArfQkNWwKs+thb
G678JN/wFJP3xI2gHUScGY2d0UOshKdh/ysu0Tv8cOWX4btfldtNxeQIuz08LJE7
N5sFG0nMPAvL8Pqpf/Kgl5yJRgSrGEIUyj4Sr8n5iprW5TYU4rHfanJbpOoY49kI
T/KJ3c/C4c155y0bxh7skQXGsB8l3ax/H2t8EjemZPIoM70RFzwvEKzwDnfDBWVS
cpSno3QV73ewQF+jJ3AK+E+Jq9t2kuQQNe+Lkf68aOpM53ls3+faWys3gYz/uBGv
E87tIWXhHd0Ndndgc21+olLmhopiIhcsZCKdYwIDAQABAoIBAAXx74hiKYYz+pc7
4S5jgKG/LZaqx5wu+wpHM43d+QSctKBBjl5XZtvNCnSI2HUa5yUOs3VxjW0PDeJ6
Gc+GjU8yzV3B3RhxtjBXZsGxkejyBcsGIK+O42zlzwh4992wjNrghxWbtIpo+fSF
K3ltfBt+ySs7jqLM/71AyEhNvcxaDJr6FtNPYWsMqFQUJX33Z/7CI6Ohu2NTlXZN
n7ajEKZXZelESY6cCjMTLs02UPOXyU7dzSAZYK0t0pqhP+CLo7DeJQINiUmdwlPS
PUYAdk85vL08AhIuZUwGVzysKGdVbH6iLu/z7WAWp9H0UBsJORA2fZWBEPmN6/E7
IJf+Rf0CgYEA1aFrv3AfqVqY5UB7KAlUcZ+85HvElcIwHoaWGu3yNX+0eDAPFVkt
WY+ci+LoOwxvniSElPwmrbTaD8EcM+vgjwphApKB1qfOkUNZax/lhAeXpIfP8K+y
T9qj8yYBCE0pFGt/6Z6Zl0IF1WkjhgLC3xCODpxW0eVnXfd2XjEr2e0CgYEAy9uS
SxlGm0DBUyiHP7Z3yvuAfaEwn651m6Jv42u49K9HNPkTcpFThlAyKrf3R0mv3+gq
JOZcisDoZzgK1rOJl7TQDMS1FOzuECgTyHsaUzmyBT/cdU0ynyimM/lJftWrINgu
BqFXY+6j6j07lazxONnXRGL/tFfva8P85Q4PKo8CgYEAm2fpFQOA1NcGIMeOj+px
lpKoe+IZeQQhsyMe8Qolx4tWApSbdGFCH0PcktqHK+V5ESbpl+PyUy0b8Jf/Zznx
Sr03IwLnFvtNxtiipM44TZqkUtlFiIaXhYW8/LWpzJstBiDJlW59ts4dpkjswaEi
l9jYLoLGmbxzPKU3Y4ALsWUCgYB9qGnjyr/AAUlphgjgWAw9XYvVZJ+BPluWRKlt
aMBIayacW5AGRdhTaWmS9XUCR0SW4xffSPPwP3rB7USZFXARyE2aIUJxlJ4l7V5M
bL1MYbr/C19MGvrCKp9QWDBac0CZ7UdppNgmbDozr+zjlQfYAEd2CwQNWUrmhZeE
ZYcptwKBgQC7qoHrcSVG3sTncz/xTevfFB0e5PFNQoxIVpTZioys+anVEweHJgNM
eEVMrtNhbuC8uLFbzRcfzpaiaI+zrp9iuZ4VnBNSSVHQ+IPMaBfd0tuEI9hqdD6h
NJjkmgjcGBVgxegLdWrMWJugikG7N6z/kpuObLcva5OZEMGHk+yM7w==
-----END RSA PRIVATE KEY-----`;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Helper: Get SPKI base64 public key from PEM private key
function getPublicKeyBase64(pemKey) {
  const pubKey = crypto.createPublicKey(pemKey);
  const der = pubKey.export({ type: "spki", format: "der" });
  return der.toString("base64");
}

// Helper: Sign request for Yoti
function signRequest(method, endpoint, queryParams, bodyPayload, pemKey) {
  const nonce = crypto.randomUUID();
  const timestamp = Date.now();
  
  // Format final query and endpoint
  const finalEndpoint = `${endpoint}?nonce=${nonce}&timestamp=${timestamp}${queryParams ? `&${queryParams}` : ""}`;
  
  let stringToSign = `${method}&${finalEndpoint}`;
  if (bodyPayload) {
    const base64Body = Buffer.from(JSON.stringify(bodyPayload)).toString("base64");
    stringToSign += `&${base64Body}`;
  }
  
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(stringToSign);
  const signature = signer.sign(pemKey, "base64");
  
  return {
    endpointWithParams: finalEndpoint,
    headers: {
      "X-Yoti-Auth-Key": getPublicKeyBase64(pemKey),
      "X-Yoti-Auth-Digest": signature,
    },
  };
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { userId } = JSON.parse(event.body);
    if (!userId) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "userId is required" }),
      };
    }

    const sdkId = process.env.YOTI_SDK_ID || "placeholder-yoti-sdk-id";

    // Request body for Yoti Doc Scan (IDV) session creation
    const payload = {
      client_session_token_ttl: 900,
      resources_ttl: 86400,
      user_tracking_id: userId,
      requested_checks: [
        {
          type: "ID_DOCUMENT_AUTHENTICITY",
          config: {},
        },
      ],
      requested_tasks: [
        {
          type: "ID_DOCUMENT_TEXT_DATA_EXTRACTION",
          config: {
            manual_check: "FALLBACK",
          },
        },
      ],
      sdk_config: {
        allowed_capture_methods: "CAMERA_AND_UPLOAD",
        primary_colour: "#ef4444",
      },
    };

    // Sign request
    const path = "/sessions";
    const queryParams = `sdkId=${sdkId}`;
    const signed = signRequest("POST", path, queryParams, payload, YOTI_PEM);

    // Call Yoti API
    const response = await fetch(`${YOTI_API_URL}${signed.endpointWithParams}`, {
      method: "POST",
      headers: {
        ...signed.headers,
        "X-Yoti-SDK-Id": sdkId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Yoti session creation failed (${response.status}): ${errText}`);
    }

    const data = await response.json();

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        sessionId: data.session_id,
        clientSessionToken: data.client_session_token,
        sdkId: sdkId,
        iframeUrl: `https://api.yoti.com/idv/v1/web/index.html?sessionID=${data.session_id}&sessionToken=${data.client_session_token}`,
      }),
    };
  } catch (error) {
    console.error("Yoti Session creation failed:", error.message);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: error.message,
      }),
    };
  }
};
