const prisma = require('../src/database/prisma');

async function run() {
  const emails = [
    'dumbresanskar23@gmail.com',
    'dumbresanskar29@gmail.com',
    'dumbresanskar16@gmail.com'
  ];

  try {
    for (const email of emails) {
      console.log(`Searching for student: ${email}...`);
      const student = await prisma.student.findUnique({
        where: { email }
      });

      if (!student) {
        console.log(`Student with email ${email} not found.`);
        continue;
      }

      console.log(`Found student ID: ${student.id}. Deleting associated orders...`);
      const deletedOrders = await prisma.order.deleteMany({
        where: { student_id: student.id }
      });
      console.log(`Deleted ${deletedOrders.count} associated orders.`);

      console.log(`Deleting student record...`);
      await prisma.student.delete({
        where: { id: student.id }
      });
      console.log(`Successfully deleted student: ${email}\n`);
    }
    console.log('Deletion process completed successfully!');
  } catch (err) {
    console.error('Error during deletion:', err);
  } finally {
    await prisma.$disconnect();
  }
}
run();
