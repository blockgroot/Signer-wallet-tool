import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Vercel Postgres and serverless environments benefit from connection pooling
// For production, consider using Prisma Data Proxy or connection pooling
export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    // For Vercel Postgres, connection pooling is handled automatically
    // If using Prisma Data Proxy, uncomment the following:
    // datasources: {
    //   db: {
    //     url: process.env.DATABASE_URL,
    //   },
    // },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
