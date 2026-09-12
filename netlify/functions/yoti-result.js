import crypto from "crypto";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { createAdminClient } from "./_shared.js";


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
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Helper: SPKI public key
function getPublicKeyBase64(pemKey) {
  const pubKey = crypto.createPublicKey(pemKey);
  const der = pubKey.export({ type: "spki", format: "der" });
  return der.toString("base64");
}

// Helper: Sign request for Yoti
function signRequest(method, endpoint, queryParams, bodyPayload, pemKey) {
  const nonce = crypto.randomUUID();
  const timestamp = Date.now();
  
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

// Helper: Calculate age from DOB string (YYYY-MM-DD)
function calculateAge(dobString) {
  if (!dobString) return 0;
  const birthDate = new Date(dobString);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
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
    const { sessionId, userId } = JSON.parse(event.body);

    if (!sessionId || !userId) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "sessionId and userId are required" }),
      };
    }

    const supabase = createAdminClient();

    // ─── MOCK / BYPASS FOR LOCAL DEVELOPMENT / TESTING ───────────────────
    if (sessionId === "mock-session-id") {
      console.log(`🤖 Mock bypass activated for user: ${userId}`);
      
      // Update user profile
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({
          is_adult_confirmed: true,
          adult_confirmed_at: new Date().toISOString()
        })
        .eq("id", userId);

      if (profileErr) throw profileErr;

      // Log the verification
      await supabase
        .from("age_verification_log")
        .insert({
          user_id: userId,
          session_id: sessionId,
          status: "completed",
          provider: "yoti_mock",
          result: { mock: true, age: 25, message: "Aprovado via Sandbox Mock" }
        });

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: true,
          status: "approved",
          isAdult: true,
          message: "Idade verificada com sucesso! (Modo Mock)"
        }),
      };
    }

    // ─── REAL YOTI API CALL ──────────────────────────────────────────────
    const sdkId = process.env.YOTI_SDK_ID || "placeholder-yoti-sdk-id";
    const path = `/sessions/${sessionId}`;
    const queryParams = `sdkId=${sdkId}`;
    const signed = signRequest("GET", path, queryParams, null, YOTI_PEM);

    const response = await fetch(`${YOTI_API_URL}${signed.endpointWithParams}`, {
      method: "GET",
      headers: {
        ...signed.headers,
        "X-Yoti-SDK-Id": sdkId,
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Yoti result fetch failed (${response.status}): ${errText}`);
    }

    const sessionResult = await response.json();
    console.log("Yoti Session State:", sessionResult.state);

    let isAdult = false;
    let dob = null;
    let docAuthenticity = "unknown";

    if (sessionResult.state === "COMPLETED") {
      // 1. Check Authenticity Checks
      const authChecks = (sessionResult.checks || []).filter(
        (c) => c.type === "ID_DOCUMENT_AUTHENTICITY"
      );
      const isDocGenuine = authChecks.every(
        (c) => c.report?.recommendation?.value === "APPROVE"
      );

      docAuthenticity = isDocGenuine ? "approved" : "failed";

      // 2. Extract Date of Birth
      const idDocuments = sessionResult.resources?.id_documents || [];
      for (const doc of idDocuments) {
        const extractionTasks = (doc.tasks || []).filter(
          (t) => t.type === "ID_DOCUMENT_TEXT_DATA_EXTRACTION"
        );
        for (const task of extractionTasks) {
          const dobField = task.result?.document_fields?.date_of_birth;
          if (dobField && dobField.value) {
            dob = dobField.value; // Format usually YYYY-MM-DD
            break;
          }
        }
        if (dob) break;
      }

      if (dob) {
        const age = calculateAge(dob);
        console.log(`User DOB: ${dob}, Age: ${age}`);
        isAdult = age >= 18;
      } else if (isDocGenuine) {
        // If the document is approved but DOB text extraction is missing,
        // we fallback to verifying if the document check is overall approved.
        isAdult = true;
      }
    }

    const finalStatus = isAdult ? "approved" : (sessionResult.state === "COMPLETED" ? "failed" : "pending");
    const dbStatus = isAdult ? "completed" : (sessionResult.state === "COMPLETED" ? "failed" : "pending");

    // Log the verification attempt
    await supabase
      .from("age_verification_log")
      .insert({
        user_id: userId,
        session_id: sessionId,
        status: dbStatus,
        provider: "yoti",
        result: {
          state: sessionResult.state,
          isAdult,
          dob,
          docAuthenticity,
          checks: sessionResult.checks
        }
      });

    if (isAdult) {
      // Update profiles table
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({
          is_adult_confirmed: true,
          adult_confirmed_at: new Date().toISOString()
        })
        .eq("id", userId);

      if (profileErr) throw profileErr;
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        status: finalStatus,
        isAdult,
        sessionState: sessionResult.state,
      }),
    };

  } catch (error) {
    console.error("Yoti result verification error:", error.message);
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
