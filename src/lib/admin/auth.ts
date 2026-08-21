import "server-only";

import { scryptSync, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminConfig, hasAdminConfig } from "./config";

const COOKIE_NAME = "domguima_admin_session";
const SESSION_HOURS = 12;

export async function verifyAdminCredentials(username: string, password: string): Promise<boolean> {
  if (!hasAdminConfig() || username !== adminConfig.username) return false;
  const [algorithm, salt, expectedHex] = adminConfig.passwordHash.split("$");
  if (algorithm !== "scrypt" || !salt || !expectedHex) return false;
  const actual = scryptSync(password, salt, expectedHex.length / 2);
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function createAdminSession() {
  const token = await new SignJWT({ role: "owner", username: adminConfig.username })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${SESSION_HOURS}h`)
    .sign(new TextEncoder().encode(adminConfig.sessionSecret));
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_HOURS * 60 * 60,
  });
}

export async function destroyAdminSession() { (await cookies()).delete(COOKIE_NAME); }

export async function getOwner() {
  if (!hasAdminConfig()) return null;
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(adminConfig.sessionSecret), { algorithms: ["HS256"] });
    if (payload.role !== "owner" || payload.username !== adminConfig.username) return null;
    return { id: adminConfig.username, email: "", name: "Dom Guima" };
  } catch { return null; }
}

export async function ownerOrThrow() {
  const owner = await getOwner();
  if (!owner) throw new Error("Acesso nao autorizado.");
  return owner;
}

export async function requireOwner() {
  if (!hasAdminConfig()) redirect("/painel/login?setup=1");
  const owner = await getOwner();
  if (!owner) redirect("/painel/login");
  return owner;
}
