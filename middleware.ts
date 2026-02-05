import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    // Si el usuario está autenticado, permitir acceso
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Rutas públicas que no requieren autenticación
        const publicPaths = [
          '/login', 
          '/api/auth',
          '/api/field-reports',      // Webhook para reportes de campo (n8n)
          '/api/tools/save-field-report', // Tool del agente AI
          '/api/scrape',             // Scraper
          '/api/process-news'        // Procesamiento de noticias
        ]
        const isPublicPath = publicPaths.some(path => 
          req.nextUrl.pathname.startsWith(path)
        )
        
        if (isPublicPath) {
          return true
        }
        
        // Para otras rutas, requiere token
        return !!token
      }
    },
    pages: {
      signIn: '/login'
    }
  }
)

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.svg$|.*\\.ico$).*)'
  ]
}
