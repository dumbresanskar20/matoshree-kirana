const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const students = await prisma.student.findMany({
    where: {
      email: 'dumbresanskar06@gmail.com'
    }
  });
  console.log('Students found:', JSON.stringify(students, null, 2));
}

main()
  .catch((e) => {
    console.error('Error querying student:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
