import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import { z } from 'zod';
import Credentials from 'next-auth/providers/credentials';
import { User } from '@/app/lib/definitions';
import { sql } from '@vercel/postgres';
import bcrypt from 'bcrypt';
async function getUser(email: string): Promise<User | undefined> {
  try {
    const user = await sql<User>`SELECT * FROM users where email=${email}`;
    return user.rows[0];
  } catch (e) {
    console.error('Failed to fetch user:', e);
    throw new Error('Failed to fetch user.');
  }
}

export const { auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        const parasedcredentials = z
          .object({
            email: z.string().email(),
            password: z.string().min(6),
          })
          .safeParse(credentials);
        if (parasedcredentials.success) {
          const { email, password } = parasedcredentials.data;
          const user = await getUser(email);
          if (!user) return null;
          const passwordMatch = await bcrypt.compare(password, user.password);
          if (passwordMatch) return user;
        }
        console.log('Invalid credentials');
        return null;
      },
    }),
  ],
});
