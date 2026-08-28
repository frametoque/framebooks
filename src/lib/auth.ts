import { NextAuthOptions, getServerSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import sql from "@/lib/db";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user.email) return false;

      // Check if user exists by email
      const existing = await sql`SELECT id FROM admin_users WHERE email = ${user.email} LIMIT 1`;
      
      if (existing.length === 0) {
        // We reuse the clerk_id column to store the Google ID to avoid schema migrations
        await sql`
          INSERT INTO admin_users (email, full_name, role, clerk_id, created_at)
          VALUES (${user.email}, ${user.name}, 'pending', ${user.id}, NOW())
        `;
      } else {
        await sql`UPDATE admin_users SET clerk_id = ${user.id}, full_name = ${user.name} WHERE email = ${user.email}`;
      }

      return true;
    },
    async session({ session, token }) {
      if (session?.user?.email) {
        const dbUser = await sql`SELECT id, tenant_id, role, clerk_id FROM admin_users WHERE email = ${session.user.email} LIMIT 1`;
        if (dbUser.length > 0) {
          session.user.id = dbUser[0].clerk_id;
          (session.user as any).tenantId = dbUser[0].tenant_id;
          (session.user as any).role = dbUser[0].role;
          (session.user as any).dbId = dbUser[0].id;
        }
        if (token.picture) session.user.image = token.picture as string;
        if (token.name) session.user.name = token.name as string;
      }
      return session;
    },
    async jwt({ token, user, account, profile }) {
      if (user) {
        token.sub = user.id;
        if (user.image) token.picture = user.image;
        if (user.name) token.name = user.name;
      }
      if (profile) {
        if ((profile as any).picture) token.picture = (profile as any).picture;
        if ((profile as any).name) token.name = (profile as any).name;
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
