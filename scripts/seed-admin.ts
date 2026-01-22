import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const username = process.env.ADMIN_USERNAME || 'admin'
  const password = process.env.ADMIN_PASSWORD || 'admin123'

  const passwordHash = await bcrypt.hash(password, 10)

  const admin = await prisma.user.upsert({
    where: { username },
    update: {
      passwordHash,
      isAdmin: true,
    },
    create: {
      username,
      passwordHash,
      isAdmin: true,
    },
  })

  console.log('Admin user created/updated:', {
    id: admin.id,
    username: admin.username,
    isAdmin: admin.isAdmin,
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
