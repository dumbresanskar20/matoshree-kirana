const prisma = require('../src/database/prisma');

async function test() {
  try {
    const tables = await prisma.$queryRaw`
      SELECT 
        TABLE_NAME AS name, 
        TABLE_ROWS AS \`rows\`, 
        DATA_LENGTH + INDEX_LENGTH AS size
      FROM information_schema.TABLES 
      WHERE table_schema = DATABASE();
    `;
    console.log('Tables found:', tables);

    if (tables.length > 0) {
      const firstTable = tables[0].name;
      console.log('Fetching columns for table:', firstTable);
      
      const columns = await prisma.$queryRaw`
        SELECT 
          COLUMN_NAME AS name, 
          DATA_TYPE AS type, 
          IS_NULLABLE AS nullable, 
          COLUMN_KEY AS \`key\`, 
          COLUMN_DEFAULT AS \`default\`
        FROM information_schema.COLUMNS 
        WHERE table_schema = DATABASE() AND table_name = ${firstTable};
      `;
      console.log('Columns found:', columns);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}
test();
