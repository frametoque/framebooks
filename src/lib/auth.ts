import { NextAuthOptions, getServerSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import sql from "@/lib/db";
import { verifyPassword, hashPassword } from "@/app/(dashboard)/admin/_lib/passwords";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    CredentialsProvider({
      id: "admin-credentials",
      name: "Admin Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required.");
        }

        const email = credentials.email.trim().toLowerCase();
        const rows = await sql`
          SELECT id, email, password_hash, full_name, system_role, is_banned, deleted_at, clerk_id
          FROM admin_users 
          WHERE LOWER(email) = ${email} 
          LIMIT 1
        `;

        if (rows.length === 0) {
          throw new Error("Invalid admin email or password.");
        }

        const user = rows[0];

        // Ensure this user has platform administrative role
        const systemRole = user.system_role || 'user';
        if (!['super_admin', 'admin', 'support'].includes(systemRole)) {
          throw new Error("Access denied: Not an administrative account.");
        }

        if (user.is_banned || user.deleted_at) {
          throw new Error("Account has been deactivated or suspended.");
        }

        if (!user.password_hash) {
          throw new Error("No password configured for this staff account. Please contact a super admin.");
        }

        const isValid = verifyPassword(credentials.password, user.password_hash);
        if (!isValid) {
          throw new Error("Invalid admin email or password.");
        }

        // Auto-upgrade legacy plaintext passwords to scrypt
        if (!user.password_hash.includes(':')) {
          const upgraded = hashPassword(credentials.password);
          await sql`UPDATE admin_users SET password_hash = ${upgraded} WHERE id = ${user.id}`;
        }

        // Record last login timestamp
        await sql`UPDATE admin_users SET last_login_at = NOW() WHERE id = ${user.id}`;

        return {
          id: user.clerk_id || String(user.id),
          email: user.email,
          name: user.full_name || 'Admin',
          dbId: user.id,
          systemRole: user.system_role || 'user',
          isBanned: !!user.is_banned,
          tenantId: user.tenant_id,
          role: user.role,
        } as any;
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user.email) return false;

      // Allow admin-credentials logins directly
      if (account?.provider === 'admin-credentials') {
        return true;
      }

      const email = user.email.trim().toLowerCase();
      // Check if user exists by email (case-insensitive)
      const existing = await sql`SELECT id FROM admin_users WHERE LOWER(email) = ${email} LIMIT 1`;
      
      if (existing.length === 0) {
        // We reuse the clerk_id column to store the Google ID to avoid schema migrations
        await sql`
          INSERT INTO admin_users (email, full_name, role, clerk_id, created_at)
          VALUES (${email}, ${user.name}, 'pending', ${user.id}, NOW())
        `;
      } else {
        await sql`UPDATE admin_users SET clerk_id = ${user.id}, full_name = ${user.name} WHERE LOWER(email) = ${email}`;
      }

      return true;
    },
    async session({ session, token }) {
      const email = (session?.user?.email || (token?.email as string) || "").trim().toLowerCase();
      if (email) {
        if (!session.user) session.user = {} as any;
        session.user.email = email;
        session.user.id = (token?.id as string) || (token?.sub as string) || "";
        (session.user as any).dbId = token?.dbId;
        (session.user as any).systemRole = token?.systemRole || 'user';
        (session.user as any).isBanned = !!token?.isBanned;
        (session.user as any).tenantId = token?.tenantId;
        (session.user as any).role = token?.role;
        if (token?.picture) session.user.image = token.picture as string;
        if (token?.name) session.user.name = token.name as string;

        // If systemRole not yet in token (e.g. Google OAuth login), query DB once
        if (!token?.systemRole || token?.systemRole === 'user') {
          try {
            const dbUser = await sql`
              SELECT id, tenant_id, role, clerk_id, system_role, is_banned 
              FROM admin_users 
              WHERE LOWER(email) = ${email} 
              LIMIT 1
            `;
            if (dbUser.length > 0) {
              session.user.id = dbUser[0].clerk_id || String(dbUser[0].id);
              (session.user as any).tenantId = dbUser[0].tenant_id;
              (session.user as any).role = dbUser[0].role;
              (session.user as any).dbId = dbUser[0].id;
              (session.user as any).systemRole = dbUser[0].system_role || 'user';
              (session.user as any).isBanned = !!dbUser[0].is_banned;
            }
          } catch (err) {
            console.error("[Session Callback] DB lookup failed:", err);
          }
        }
      }
      return session;
    },
    async jwt({ token, user, account, profile }) {
      if (user) {
        token.sub = user.id;
        token.id = user.id;
        if (user.email) token.email = user.email.trim().toLowerCase();
        if (user.image) token.picture = user.image;
        if (user.name) token.name = user.name;
        if ((user as any).dbId) token.dbId = (user as any).dbId;
        if ((user as any).systemRole) token.systemRole = (user as any).systemRole;
        if ((user as any).isBanned !== undefined) token.isBanned = (user as any).isBanned;
        if ((user as any).tenantId) token.tenantId = (user as any).tenantId;
        if ((user as any).role) token.role = (user as any).role;
      }
      if (profile) {
        if ((profile as any).picture) token.picture = (profile as any).picture;
        if ((profile as any).name) token.name = (profile as any).name;
        if ((profile as any).email) token.email = (profile as any).email.trim().toLowerCase();
      }
      return token;
    }
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: "jwt"
  },
  secret: process.env.NEXTAUTH_SECRET,
};

/**
 * Replaces Clerk's auth() method.
 * Returns { userId } (where userId is the Google ID stored in clerk_id).
 */
export async function auth() {
  const session = await getServerSession(authOptions);
  return { 
    userId: session?.user?.id || null, 
    session 
  };
}

/**
 * Replaces Clerk's currentUser() method.
 */
export async function currentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return {
    id: session.user.id,
    emailAddresses: [{ emailAddress: session.user.email }],
    primaryEmailAddress: { emailAddress: session.user.email },
    firstName: session.user.name?.split(' ')[0] || "",
    lastName: session.user.name?.split(' ').slice(1).join(' ') || "",
    fullName: session.user.name || "",
    publicMetadata: {
      tenant_id: (session.user as any).tenantId,
      role: (session.user as any).role,
    }
  };
}

/**
 * Mock clerkClient to prevent build errors during migration.
 * Features relying on this must be rewritten to use the DB directly.
 */
export const clerkClient = async () => {
  return {
    users: {
      getUser: async (...args: any[]) => null,
      updateUser: async (...args: any[]) => null,
      deleteUser: async (...args: any[]) => null,
      getUserList: async (...args: any[]) => ({ data: [] }),
      updateUserMetadata: async (...args: any[]) => null,
    }
  };
};
