import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from './supabase-server'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contraseña', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Por favor ingresa email y contraseña')
        }

        // Buscar usuario en Supabase
        const { data: usuario, error } = await supabaseAdmin
          .from('usuario')
          .select('*')
          .eq('email', credentials.email)
          .eq('activo', true)
          .single()

        if (error || !usuario) {
          throw new Error('Credenciales inválidas')
        }

        // Verificar contraseña
        const passwordMatch = await bcrypt.compare(
          credentials.password,
          usuario.password_hash
        )

        if (!passwordMatch) {
          throw new Error('Credenciales inválidas')
        }

        // Retornar datos del usuario (sin password_hash)
        return {
          id: usuario.id.toString(),
          email: usuario.email,
          name: usuario.nombre,
          cargo: usuario.cargo,
          provincia: usuario.provincia
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.cargo = user.cargo
        token.provincia = user.provincia
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.cargo = token.cargo as string | null
        session.user.provincia = token.provincia as string | null
      }
      return session
    }
  },
  pages: {
    signIn: '/login',
    error: '/login'
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60 // 30 días
  },
  secret: process.env.NEXTAUTH_SECRET
}
