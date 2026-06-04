import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_EMAIL ?? "admin@transportkm.com";
  const password = process.env.SEED_PASSWORD ?? "Admin1234!";
  const name = process.env.SEED_NAME ?? "Administrador";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`✓ Usuario ya existe: ${email}`);
    return;
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, password: hashed, role: "ADMINISTRADOR" },
  });

  console.log(`✓ Usuario creado: ${user.email} (${user.role})`);
  console.log(`  Contraseña: ${password}`);
  console.log(`  ¡Cámbiala después del primer login!`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
