import { NextAuthOptions, SessionStrategy } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { connectToDatabase } from "@/lib/mongodb";
import User, { UserRole } from "@/models/User";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: UserRole;
      phone?: string;
      vehicleNumber?: string;
      hospitalId?: string;
      avatar?: string;
      isApproved: boolean;
    };
  }

  interface User {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    phone?: string;
    vehicleNumber?: string;
    hospitalId?: string;
    avatar?: string;
    isApproved: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    phone?: string;
    vehicleNumber?: string;
    hospitalId?: string;
    avatar?: string;
    isApproved: boolean;
  }
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt" as SessionStrategy,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    // ─── Email / Password Credentials ───
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: {
          label: "Email",
          type: "email",
          placeholder: "you@example.com",
        },
        password: {
          label: "Password",
          type: "password",
        },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required.");
        }

        await connectToDatabase();

        const user = await User.findOne({
          email: credentials.email.toLowerCase().trim(),
        }).select("+password");

        if (!user) {
          throw new Error("No account found with this email.");
        }

        if (!user.isActive) {
          throw new Error("This account has been deactivated.");
        }

        // Block unapproved drivers and hospital staff from signing in
        if (
          (user.role === "driver" || user.role === "hospital") &&
          !user.isApproved
        ) {
          throw new Error(
            "Your account is pending admin approval. Please wait for an administrator to approve your account."
          );
        }

        const isPasswordValid = await user.comparePassword(
          credentials.password
        );

        if (!isPasswordValid) {
          throw new Error("Invalid password.");
        }

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone,
          vehicleNumber: user.vehicleNumber,
          hospitalId: user.hospitalId,
          avatar: user.avatar,
          isApproved: user.isApproved,
        };
      },
    }),

    // ─── Google OAuth ───
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],

  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // Initial sign-in: attach user data to token
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.phone = user.phone;
        token.vehicleNumber = user.vehicleNumber;
        token.hospitalId = user.hospitalId;
        token.avatar = user.avatar;
        token.isApproved = (user as unknown as { isApproved?: boolean }).isApproved ?? true;
      }

      // Handle session update (e.g., after role change)
      if (trigger === "update" && session) {
        token.role = (session.user?.role as UserRole) ?? token.role;
        token.phone = session.user?.phone ?? token.phone;
        token.vehicleNumber =
          session.user?.vehicleNumber ?? token.vehicleNumber;
        token.hospitalId = session.user?.hospitalId ?? token.hospitalId;
        if (typeof session.user?.isApproved === "boolean") {
          token.isApproved = session.user.isApproved;
        }
      }

      return token;
    },

    async session({ session, token }) {
      // Pass token data to client-side session
      session.user = {
        id: token.id,
        name: token.name ?? session.user?.name ?? "",
        email: token.email ?? session.user?.email ?? "",
        role: token.role,
        phone: token.phone,
        vehicleNumber: token.vehicleNumber,
        hospitalId: token.hospitalId,
        avatar: token.avatar,
        isApproved: token.isApproved ?? true,
      };

      return session;
    },

    async signIn({ user, account }) {
      // For Google OAuth: create or link user in MongoDB
      if (account?.provider === "google" && user?.email) {
        try {
          await connectToDatabase();

          const userEmail = user.email as string;
          const existingUser = await User.findOne({ email: userEmail });

          if (!existingUser) {
            // Create new user from Google profile
            const newUser = await User.create({
              name: user.name || "Google User",
              email: userEmail,
              role: "patient",
              avatar: user.image ?? undefined,
              googleId: user.id,
              isActive: true,
              isApproved: true,
            } as Parameters<typeof User.create>[0]);

            // Update the user object with the new ID and role
            user.id = (newUser as { _id: { toString(): string } })._id.toString();
            (user as { role?: UserRole }).role = "patient";
          } else {
            // Link Google account to existing user
            user.id = existingUser._id.toString();
            (user as { role?: UserRole }).role = existingUser.role;
            (user as { phone?: string }).phone = existingUser.phone;
            (user as { vehicleNumber?: string }).vehicleNumber =
              existingUser.vehicleNumber;
            (user as { hospitalId?: string }).hospitalId =
              existingUser.hospitalId;
            (user as { avatar?: string }).avatar = existingUser.avatar;
          }
        } catch (error) {
          console.error("Google sign-in error:", error);
          return false;
        }
      }

      return true;
    },
  },

  events: {
    async signIn({ user }) {
      const u = user as { role?: string };
      console.log(
        `[AUTH] User signed in: ${user.email} (role: ${u.role ?? "patient"})`
      );
    },
  },
};
