import { SignJWT, jwtVerify } from "jose";
const audience = "domguima-order-tracking";
export async function signTrackingToken(orderId: string, secret: string, now = new Date()) {
  if (secret.length < 32 || !/^[a-f0-9-]{36}$/i.test(orderId)) throw new Error("Acompanhamento indisponível.");
  const issued = Math.floor(now.getTime() / 1000);
  return new SignJWT({ purpose: "order_tracking" }).setProtectedHeader({ alg: "HS256" }).setSubject(orderId).setAudience(audience).setIssuer("domguima").setIssuedAt(issued).setExpirationTime(issued + 30 * 86400).sign(new TextEncoder().encode(secret));
}
export async function verifyTrackingToken(token: string, secret: string, now = new Date()): Promise<string | null> {
  if (secret.length < 32 || token.length > 1200) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ["HS256"], audience, issuer: "domguima", currentDate: now });
    return payload.purpose === "order_tracking" && typeof payload.sub === "string" && /^[a-f0-9-]{36}$/i.test(payload.sub) ? payload.sub : null;
  } catch { return null; }
}
