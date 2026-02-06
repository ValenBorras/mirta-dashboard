import 'next-auth'
import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      cargo: string | null
      provincia: string | null
      ciudad: string | null
    } & DefaultSession['user']
  }

  interface User {
    id: string
    cargo?: string | null
    provincia?: string | null
    ciudad?: string | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    cargo?: string | null
    provincia?: string | null
    ciudad?: string | null
  }
}
