import pkg from 'agora-access-token';
const { RtcTokenBuilder, RtcRole } = pkg;

export const handler = async (event) => {
    // CORS headers
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Content-Type": "application/json",
    };

    // Handle preflight
    if (event.httpMethod === "OPTIONS") {
        return { statusCode: 200, headers, body: "" };
    }

    if (event.httpMethod !== "POST") {
        return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
    }

    try {
        const { channelName, uid, role } = JSON.parse(event.body);

        const appId = process.env.AGORA_APP_ID || "cfade1e1afb944da9fbcd7c3ae83d97d";
        const appCertificate = process.env.AGORA_APP_CERTIFICATE || "10c44c654e3b49faadc835654f32709a";

        if (!appId || !appCertificate) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: "Agora credentials not configured on server" }),
            };
        }

        if (!channelName) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: "channelName is required" }),
            };
        }

        const expirationTimeInSeconds = 3600;
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

        const rtcRole = role === "publisher" ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

        const token = RtcTokenBuilder.buildTokenWithUid(
            appId,
            appCertificate,
            channelName,
            uid || 0,
            rtcRole,
            privilegeExpiredTs
        );

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ token }),
        };
    } catch (error) {
        console.error("Token generation error:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message }),
        };
    }
};
