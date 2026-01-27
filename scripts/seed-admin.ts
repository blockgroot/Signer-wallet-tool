import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Hardcoded admin credentials as per requirements
  const username = 'stader'
  const password = 's2t1'

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
